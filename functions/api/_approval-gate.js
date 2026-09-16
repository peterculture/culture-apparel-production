/**
 * The artwork approval gate.  (Target model S2, decision D16, 2026-09-16.)
 *
 * WHAT IT DOES. An order must not be printed until its artwork is approved.
 * "Printing" starts when a decoration moves to Ready for Print or In
 * Production, or when a production run is booked for it. For orders created
 * on or after a start date, each of those is refused while
 * Order.Artwork_Approved__c is not ticked.
 *
 * WHERE THE START DATE LIVES. Custom Metadata, not code and not a record:
 *   Production_Gate__mdt, record "Default", field Approval_Gate_Start__c.
 * Custom Metadata records travel in change sets, so the date moves between
 * orgs with the rule. A BLANK DATE MEANS THE GATE IS OFF. It stays blank until
 * Anthony confirms the date the whole new design is built.
 *
 * TWO LOCKS, ONE RULE.
 *   1. Salesforce: validation rule Decoration__c.Artwork_Approval_Gate (dev2 +
 *      staging) refuses the status change for anyone, including flows.
 *   2. This file: the dashboard asks BEFORE writing, so the worker gets a clear
 *      sentence instead of a generic failure, and so a run is never created
 *      for an unapproved order.
 *      ⛔ The org rule is deliberately NOT on Production_Run__c: a rule failing
 *      the Planned -> Confirmed PATCH would strand the run on Planned with no
 *      calendar Event (§2 trap 9). The run side is enforced here, before the
 *      insert, and only here.
 * Both locks compare the order's CreatedDate as a UTC date, the same thing
 * DATEVALUE(CreatedDate) gives the validation rule.
 *
 * DEGRADES OPEN, ON PURPOSE (build rule 3). One deployment serves three orgs,
 * and production has none of this yet. If the metadata type, the record, the
 * date or Order.Artwork_Approved__c is missing, or a lookup fails, the gate is
 * treated as OFF and the write goes ahead. A gate that cannot be read must not
 * stop the shop floor. Failures are logged, never thrown.
 */

import { runQuery, getActiveSfEnv } from "./_sf.js";
import { runQueryOptionalField } from "./_placements.js";

/** Decoration statuses that count as "printing has started". */
export const GATED_STATUSES = new Set(["Ready for Print", "In Production"]);

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The start date is read at most once a minute per org, per isolate. Changing
// it in Setup takes effect within a minute; nothing else caches it.
const CACHE_MS = 60 * 1000;
const _cache = new Map(); // envKey -> { at, start }
const _warned = new Set();

function warnOnce(key, ...args) {
  if (_warned.has(key)) return;
  _warned.add(key);
  console.warn(...args);
}

/**
 * The gate's start date for the active org, as 'YYYY-MM-DD', or null when the
 * gate is off (blank date, no record, no metadata type, or the read failed).
 */
export async function loadGateStart(env) {
  let envKey = "default";
  try {
    envKey = (await getActiveSfEnv(env)) || "default";
  } catch {
    /* fall through with the default cache key */
  }

  const hit = _cache.get(envKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.start;

  let start = null;
  try {
    const res = await runQuery(
      env,
      "SELECT Approval_Gate_Start__c FROM Production_Gate__mdt WHERE DeveloperName = 'Default' LIMIT 1",
    );
    if (res.ok) {
      const raw = res.records[0] && res.records[0].Approval_Gate_Start__c;
      start = typeof raw === "string" && ISO_DATE.test(raw) ? raw : null;
    } else {
      warnOnce(
        `gate-read-${envKey}`,
        `[approval-gate] could not read Production_Gate__mdt in org "${envKey}" -- gate treated as OFF.`,
        res.status,
        JSON.stringify(res.data || "").slice(0, 300),
      );
    }
  } catch (err) {
    console.error("[approval-gate] start date read threw -- gate treated as OFF", err);
  }

  _cache.set(envKey, { at: Date.now(), start });
  return start;
}

/**
 * Should this order be blocked from printing right now?
 *
 * Pass `orderId`, or `decorationId` and the order is looked up from it.
 * Returns:
 *   { blocked: false, reason: "gate_off" | "approved" | "before_start" | "unknown" }
 *   { blocked: true, orderId, orderNumber, message }
 */
export async function checkApprovalGate(env, { orderId, decorationId } = {}) {
  const start = await loadGateStart(env);
  if (!start) return { blocked: false, reason: "gate_off" };

  try {
    let oid = orderId && SF_ID.test(orderId) ? orderId : null;
    if (!oid && decorationId && SF_ID.test(decorationId)) {
      const d = await runQuery(env, `SELECT Order__c FROM Decoration__c WHERE Id = '${decorationId}'`);
      oid = d.ok && d.records[0] ? d.records[0].Order__c : null;
    }
    if (!oid) {
      console.warn("[approval-gate] no order to check -- allowing", { orderId, decorationId });
      return { blocked: false, reason: "unknown" };
    }

    const res = await runQueryOptionalField(
      env,
      (inc) =>
        `SELECT Id, OrderNumber, CreatedDate${inc ? ", Artwork_Approved__c" : ""} FROM Order WHERE Id = '${oid}'`,
      "Artwork_Approved__c",
    );
    if (!res.ok || !res.records[0]) {
      console.error("[approval-gate] order read failed -- allowing", oid, res.status);
      return { blocked: false, reason: "unknown" };
    }
    if (!res.hadField) {
      warnOnce("gate-no-field", "[approval-gate] Order.Artwork_Approved__c not readable here -- gate treated as OFF.");
      return { blocked: false, reason: "gate_off" };
    }

    const o = res.records[0];
    if (o.Artwork_Approved__c === true) return { blocked: false, reason: "approved" };

    const created = typeof o.CreatedDate === "string" ? o.CreatedDate.slice(0, 10) : "";
    if (!created || created < start) return { blocked: false, reason: "before_start" };

    const orderNumber = o.OrderNumber || "";
    return {
      blocked: true,
      orderId: oid,
      orderNumber,
      message:
        `Artwork is not approved on order ${orderNumber || oid} yet. ` +
        "Tick Artwork Approved on the Order in Salesforce, then try again.",
    };
  } catch (err) {
    console.error("[approval-gate] check threw -- allowing", err);
    return { blocked: false, reason: "unknown" };
  }
}

/** The response every endpoint sends when the gate refuses a write. */
export function gateResponse(result) {
  return Response.json(
    {
      error: "artwork_not_approved",
      message: result.message,
      detail: result.message,
      orderId: result.orderId || null,
      orderNumber: result.orderNumber || null,
    },
    { status: 409 },
  );
}

/**
 * True when a Salesforce error body is the org-side validation rule firing.
 * The dashboard's own check normally answers first, but the org can still
 * refuse (for example, the start date changed less than a minute ago), so
 * callers use this to turn that refusal into the same clear 409.
 */
export function isApprovalRuleFailure(text) {
  return (
    typeof text === "string" &&
    text.indexOf("FIELD_CUSTOM_VALIDATION_EXCEPTION") !== -1 &&
    text.indexOf("Artwork is not approved") !== -1
  );
}

export const RULE_MESSAGE =
  "Artwork is not approved on this order yet. Tick Artwork Approved on the Order in Salesforce, then try again.";
