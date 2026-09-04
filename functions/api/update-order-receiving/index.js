/**
 * POST /api/update-order-receiving
 * Body: { "orderId": "<15/18-char SF Id>", "status": "<value>", "missing": "<text?>" }
 *
 * The GARMENT count-in station writes the standard Order directly (no pre-prod
 * item / production method). Sets Receiving_Status__c, and manages the free-text
 * "missing count-in" note: it's kept only while the order is at the "Partial"
 * stage, and cleared otherwise — matching how the Salesforce box disappears once
 * an order moves to Counted In / Staged.
 *
 * "missing" is OPTIONAL and its ABSENCE is the only gate on the note. Omit the
 * key and the note is left exactly as Salesforce has it; send a string (even "")
 * and that string is written. Until 2026-08-28 the client always sent the key,
 * so every tap of Partial wrote "" over a note someone had typed in Salesforce,
 * and nothing in this app ever read the field back to make the loss visible.
 *
 * The STATUS no longer decides anything about the note. Moving an order to
 * Counted In or Staged does NOT blank it: silent clearing is the bug being
 * fixed here, and a stale note left visible on the card is a prompt to clear it,
 * which a worker does by emptying the box and saving. cfg.missingAtStage still
 * exists in _station.js and still tells the TABLET when to offer the box; it no
 * longer gates this write. If that ever needs to change -- clear on Counted In,
 * say -- it is one added condition here, and it is a product decision, not a
 * tidy-up.
 *
 * Gated on the signed station token; only a station whose config is source:"order"
 * (i.e. garment) may call it. The order Id is shape-validated and the status must
 * be one the station config allows.
 *
 * Body may also include "by": an optional free-text worker name (captured
 * client-side at station login), stamped onto Order.Last_Updated_By__c in the
 * same write -- audit trail for a shared station tablet. NOTE: that field
 * (Text(80)) must exist on Order in Salesforce before this ships.
 */
import { sfFetch, apiVersion, jsonError } from "../_sf.js";
import { STATION_CONFIG } from "../_station.js";
import { activePicklistValues } from "../_picklist.js";
import { requireCap } from "../_session.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

/* Truncation guard for the count-in note. 255 is the Salesforce default for
   Text; if Partial_Check_in_Missing_Items__c is a Long Text Area (or a shorter
   Text) in the org, correct this to the real length -- a note silently cut at
   255 is its own small version of the bug this endpoint just fixed. Truncating
   here rather than letting Salesforce reject the whole PATCH keeps a long note
   from also losing the status change it rode in with. */
const MISSING_MAX = 255;

export async function onRequestPost({ env, request }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_body", 400);
    }

    /* E6.5 gate, added 2026-09-02. This route was the one mutating endpoint the
       E6.5 sweep missed: `orders.receive` has been defined in _session.js and
       granted to BOTH workers and managers since that story -- its comment there
       even names this endpoint -- but nothing ever checked it, so the garment
       count-in was ungated while every sibling write was covered.

       Report-only until ACCESS_ENFORCE=1, so adding it cannot break the station
       today. It matters on the day enforcement is switched on: an ungated route
       does not log a `[access] would deny` line either, so this hole would not
       have shown up in the five-day report-only soak that is meant to catch
       exactly this. */
    const gate = await requireCap(request, env, "orders.receive");
    if (gate.denied) return gate.response;

    const station = String(body.station || "").toLowerCase();
    const cfg = STATION_CONFIG[station];
    if (!cfg || cfg.source !== "order") return jsonError("station_not_configured", 400);

    const orderId = String(body.orderId || "");
    const status = String(body.status || "");
    // hasOwnProperty, not truthiness: "" is a legitimate value to write (a
    // worker clearing the box on purpose) and must stay distinct from "the
    // caller said nothing about this field".
    const hasMissing =
      Object.prototype.hasOwnProperty.call(body, "missing") && body.missing != null;
    const missing = hasMissing ? String(body.missing) : "";

    if (!SF_ID.test(orderId)) return jsonError("invalid_order_id", 400);
    if (!cfg.statuses.includes(status)) return jsonError("invalid_status", 400);

    /* ORG-CAPABILITY GATE, added 2026-09-04 with the "Received" status.
       `Receiving_Status__c` is a RESTRICTED picklist and one deployment serves
       three orgs, so a value that is valid in dev2 can be absent in the org
       the KV switch currently points at -- and a restricted picklist answers
       that with INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST on the WHOLE PATCH,
       not by ignoring the field. Refusing here turns "the tablet is broken"
       into a named reason the board can show.

       Only `optionalStatuses` are checked. The long-standing four are never
       gated: if describe ever answered strangely about those, failing the
       write would be a much worse bug than the one this prevents.

       ⚠️ UNKNOWN IS NOT NO. activePicklistValues returns null when describe
       could not be read, and this deliberately lets the write through in that
       case so Salesforce's own error surfaces through the normal path rather
       than the station going dead on a transient hiccup. */
    const optional = cfg.optionalStatuses || [];
    if (optional.includes(status)) {
      const orgValues = await activePicklistValues(env, "Order", cfg.field);
      if (Array.isArray(orgValues) && !orgValues.includes(status)) {
        console.error(
          `[receiving] "${status}" is not an active value on Order.${cfg.field} in the active org`
        );
        return jsonError("status_not_in_org", 400);
      }
    }

    const payload = { [cfg.field]: status };

    // Written only when the request carried the key -- see the header note.
    // Never cleared as a side effect of a status change.
    if (cfg.missingField && hasMissing) {
      payload[cfg.missingField] = missing.slice(0, MISSING_MAX);
    }

    const by = (body.by == null ? "" : String(body.by)).trim();
    if (by) payload.Last_Updated_By__c = by.slice(0, 80);

    const path = `/services/data/${apiVersion(env)}/sobjects/Order/${orderId}`;
    const resp = await sfFetch(env, path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // A successful Salesforce sObject PATCH returns 204 No Content.
    if (!resp.ok && resp.status !== 204) {
      let detail = "";
      try {
        detail = JSON.stringify(await resp.json());
      } catch {
        /* body may be empty */
      }
      console.error("update-order-receiving failed", resp.status, detail);
      return jsonError("update_failed", resp.status);
    }

    return Response.json(
      {
        ok: true,
        orderId,
        status,
        // `missing` is only meaningful when this write actually touched the
        // field; null when it was deliberately left alone.
        missingWritten: !!cfg.missingField && cfg.missingField in payload,
        missing: cfg.missingField && cfg.missingField in payload ? payload[cfg.missingField] : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
