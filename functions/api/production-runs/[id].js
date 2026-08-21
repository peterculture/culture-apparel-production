/**
 * PATCH /api/production-runs/:id
 *
 * Updates ONE Production_Run__c -- powers the editable "Production Runs"
 * section inside a card's drawer on the pre-production board
 * (pre-production.html), added 2026-07-22 so a manager can revisit a run
 * after creation and change the press/schedule/quantity it was created with,
 * plus log its Actual Start/End once work actually begins/finishes.
 *
 * Body (send any subset -- only the keys present are written):
 *   {
 *     "pressId":        "001...",                    // Account Id, Type='Press'
 *     "scheduledStart":  "2026-07-25T14:00:00.000Z",  // ISO datetime
 *     "scheduledEnd":    "2026-07-25T17:00:00.000Z",  // ISO datetime
 *     "quantity": 48,                                  // positive integer
 *     "actualStart": "2026-07-25T14:05:00.000Z",       // ISO datetime, OR
 *                     "" / null to CLEAR the field
 *     "actualEnd":   "2026-07-25T17:20:00.000Z",       // same clear rule
 *     "ifUnmodifiedSince": "2026-07-25T13:58:02.000Z"  // OPTIONAL -- the
 *                     Production_Run__c.LastModifiedDate the client had
 *                     when it opened this row for editing (see the
 *                     LastModifiedDate now selected in production-runs/
 *                     index.js's GET). If someone else saved this run more
 *                     recently, this PATCH is rejected with 409
 *                     {error:"conflict", currentLastModifiedDate} instead of
 *                     silently overwriting -- added 2026-07-29, same reason
 *                     and pattern as production-methods/[id].js.
 *   }
 *
 * scheduledStart/scheduledEnd are sent together by the UI every save (same
 * as the create endpoint) so the end>=start check below only fires when
 * both are present in one request. actualStart/actualEnd are independently
 * nullable -- the drawer lets a manager blank out either date/time pair to
 * clear it (e.g. correcting a mis-logged Actual Start) without touching the
 * other. Field names match production-runs/index.js exactly -- see that
 * file's docblock for the Quantity_Planned_c__c naming quirk AND the
 * Auto-Scheduling (POC) trigger gotcha.
 *
 * REMOVED 2026-08-21: the "confirm": true|false key, and with it the Confirm /
 * Unconfirm actions on every board. Runs are published when they are created
 * (see production-runs/index.js) and there is no longer any such thing as a
 * run waiting for a human to validate it. A stale browser tab still sending
 * the key now gets "no_valid_fields" rather than un-publishing anything.
 *
 * When the schedule moves, the run is pinned AND published -- see
 * statusForScheduleWrite() in _run-schedule-status.js. Dragging a run moves
 * its calendar entry; nothing here ever removes one.
 *
 * DELETE /api/production-runs/:id
 *
 * Removes ONE Production_Run__c (added 2026-07-29) -- lets a manager delete
 * a run created by mistake, or one that's no longer needed, straight from
 * the card drawer's Production Runs section.
 */
import { sfFetch, apiVersion, jsonError, checkNotModifiedSince } from "../_sf.js";
import { rollupPrintDateFromRun, rollupPrintDateToOrder, orderIdForRun } from "../_print-date-rollup.js";
import { statusForScheduleWrite } from "../_run-schedule-status.js";
import { requireCap } from "../_session.js";
import { parsePlacement } from "../_placements.js";

const PR_OBJECT = "Production_Run__c";
const PR_LOCATION_FIELD = "Print_Location__c";
const PR_PRESS_FIELD = "Press__c";
const PR_SCHED_START_FIELD = "Scheduled_Start__c";
const PR_SCHED_END_FIELD = "Scheduled_End__c";
const PR_QTY_FIELD = "Quantity_Planned_c__c";
const PR_ACTUAL_START_FIELD = "Actual_Start__c";
const PR_ACTUAL_END_FIELD = "Actual_End__c";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

function parseIso(v) {
  if (v == null || v === "") return undefined; // key present but blank -- caller decides what that means
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d; // null signals "provided but invalid"
}

export async function onRequestPatch({ params, request, env }) {
  try {
    const id = params && params.id;
    if (!SF_ID.test(id)) return jsonError("invalid_id", 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_json", 400);
    }
    if (!body || typeof body !== "object") return jsonError("invalid_body", 400);

    // This used to pick between "runs.confirm" and "runs.schedule" depending on
    // whether the body carried a confirm key. With confirming gone there is one
    // kind of write left here -- moving a run around -- so there is one gate.
    // ("runs.confirm" still exists in _session.js's manager caps; it is now
    // unused rather than removed, so an org that granted it isn't broken by a
    // deploy.)
    const gate = await requireCap(request, env, "runs.schedule");
    if (gate.denied) return gate.response;

    const payload = {};
    // Set when this request moves the run's scheduled window, which decides
    // whether we need to pin it against the auto-scheduler. Resolved into an
    // actual status further down, once we know what the run is today.
    let scheduleTouched = false;

    if ("pressId" in body) {
      if (!body.pressId || !SF_ID.test(body.pressId)) return jsonError("bad_pressId", 400);
      payload[PR_PRESS_FIELD] = body.pressId;
    }

    // Print location. "" clears it -- same affordance the actual start/end
    // fields below already have, because a run stamped with the wrong
    // location needs a route back to blank and Salesforce wants null, not "".
    // Unlike the create path this DOES write null: a PATCH naming the field
    // is a deliberate act from a UI that only renders the control when the
    // org actually has the field.
    if ("printLocation" in body) {
      const loc = parsePlacement(body.printLocation);
      if (!loc.ok) return Response.json({ error: "bad_printLocation", detail: loc.detail }, { status: 400 });
      if (loc.value !== undefined) payload[PR_LOCATION_FIELD] = loc.value;
    }

    if ("scheduledStart" in body || "scheduledEnd" in body) {
      const start = parseIso(body.scheduledStart);
      const end = parseIso(body.scheduledEnd);
      if (start === null) return jsonError("bad_scheduledStart", 400);
      if (end === null) return jsonError("bad_scheduledEnd", 400);
      if (start && end && end.getTime() < start.getTime()) {
        return jsonError("scheduledEnd_before_scheduledStart", 400);
      }
      if (start) payload[PR_SCHED_START_FIELD] = start.toISOString();
      if (end) payload[PR_SCHED_END_FIELD] = end.toISOString();
      // See production-runs/index.js for the full writeup: the org's
      // "Auto-Scheduling (POC)" trigger rewrites Scheduled_Start__c/
      // Scheduled_End__c on every insert/update unless the run carries a
      // pinned status. A manager editing the schedule is deliberately
      // overriding the machine, so the run must stay pinned.
      //
      // CHANGED 2026-08-21: a human moving a run always lands it on Confirmed
      // -- see statusForScheduleWrite(). Dragging a machine suggestion onto the
      // calendar IS a person choosing it, and there is no Confirm button left
      // to finish the job with afterwards.
      if (start || end) scheduleTouched = true;
    }

    if ("quantity" in body) {
      const n = Number(body.quantity);
      if (!Number.isFinite(n) || n <= 0 || n > 999999 || Math.floor(n) !== n) {
        return jsonError("bad_quantity", 400);
      }
      payload[PR_QTY_FIELD] = n;
    }

    // Actual Start/End: nullable. Empty string/null CLEARS the field (a
    // manager un-logging a mistaken entry); a valid ISO string sets it; the
    // key being absent entirely leaves it untouched.
    if ("actualStart" in body) {
      if (body.actualStart == null || body.actualStart === "") {
        payload[PR_ACTUAL_START_FIELD] = null;
      } else {
        const d = parseIso(body.actualStart);
        if (!d) return jsonError("bad_actualStart", 400);
        payload[PR_ACTUAL_START_FIELD] = d.toISOString();
      }
    }
    if ("actualEnd" in body) {
      if (body.actualEnd == null || body.actualEnd === "") {
        payload[PR_ACTUAL_END_FIELD] = null;
      } else {
        const d = parseIso(body.actualEnd);
        if (!d) return jsonError("bad_actualEnd", 400);
        payload[PR_ACTUAL_END_FIELD] = d.toISOString();
      }
    }
    if (payload[PR_ACTUAL_START_FIELD] && payload[PR_ACTUAL_END_FIELD]) {
      if (new Date(payload[PR_ACTUAL_END_FIELD]).getTime() < new Date(payload[PR_ACTUAL_START_FIELD]).getTime()) {
        return jsonError("actualEnd_before_actualStart", 400);
      }
    }

    // Pin the run against the auto-scheduler, and publish it.
    //
    // SIMPLIFIED 2026-08-21: this used to read the run's current status back
    // from Salesforce first, because the answer depended on it -- already
    // Confirmed meant stay Confirmed, anything else meant Planned. Now every
    // human schedule write lands on Confirmed regardless, so the extra SOQL
    // round-trip bought nothing and has been dropped. That also removes its
    // failure mode: an unreadable status used to fall through to Planned,
    // which after this change would strand the run off the calendar with no
    // Confirm button left to recover it.
    if (scheduleTouched) {
      payload.Auto_Scheduling_Status__c = statusForScheduleWrite();
    }

    if (Object.keys(payload).length === 0) return jsonError("no_valid_fields", 400);

    if (body.ifUnmodifiedSince) {
      const check = await checkNotModifiedSince(env, PR_OBJECT, id, body.ifUnmodifiedSince);
      if (check.conflict) {
        return Response.json(
          { error: "conflict", detail: "modified_since_load", currentLastModifiedDate: check.currentLastModifiedDate },
          { status: 409 },
        );
      }
    }

    const path = `/services/data/${apiVersion(env)}/sobjects/${PR_OBJECT}/${id}`;
    const resp = await sfFetch(env, path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.status !== 204) {
      const detail = await resp.text();
      console.error("Production run update failed", resp.status, detail);
      return jsonError("update_failed", resp.status);
    }

    // Keep Order.Print_Date__c in step with the runs. Scheduled start moves it;
    // actual start overrides scheduled. Awaited so the caller's next read sees
    // the new date, but best-effort inside -- it can never fail this write.
    // See _print-date-rollup.js.
    await rollupPrintDateFromRun(env, id);

    return Response.json(
      { ok: true, id, updated: Object.keys(payload) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}

export async function onRequestDelete({ params, env, request }) {
  try {
    const id = params && params.id;
    if (!SF_ID.test(id)) return jsonError("invalid_id", 400);

    const gate = await requireCap(request, env, "runs.delete");
    if (gate.denied) return gate.response;

    // Resolve the order BEFORE deleting -- the hop back to it runs through the
    // run's own PrintMethod__c, which is gone the moment the delete lands.
    const orderId = await orderIdForRun(env, id);

    const path = `/services/data/${apiVersion(env)}/sobjects/${PR_OBJECT}/${id}`;
    const resp = await sfFetch(env, path, { method: "DELETE" });

    if (resp.status !== 204) {
      const detail = await resp.text().catch(() => "");
      console.error("Production run delete failed", resp.status, detail);
      return jsonError("delete_failed", resp.status);
    }

    // Removing a run can move the order's print date back to a later run, or
    // leave no runs at all -- in which case the rollup deliberately leaves the
    // Account Manager's original date standing rather than blanking it.
    if (orderId) await rollupPrintDateToOrder(env, orderId);

    return Response.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
