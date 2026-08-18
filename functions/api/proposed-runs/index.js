/**
 * GET /api/proposed-runs?orderId=801...
 *
 * The Account Manager's suggested runs for one order, oldest first.
 *
 * WHERE THESE COME FROM. The chief AM fills in a "Schedule Runs" repeater on
 * the Close and Create Order screen (subflow v37), and each row becomes a
 * Proposed_Run__c hanging off the new Order. They are recommendations, not
 * bookings -- the shop reads them while creating the real Production Runs.
 *
 * WHY THEY ARE A SEPARATE OBJECT, not Production_Run__c rows with a flag:
 *   1. A real run needs a Production_Method__c, and methods don't exist yet at
 *      close time -- they're created later on the Management path. There is
 *      nothing for the AM's run to hang off.
 *   2. Inserting a Production_Run__c fires ProductionRunTrigger, which collects
 *      that run's press and RE-SLOTS every unpinned run on it. An account
 *      manager's guess would rearrange live press time. Proposed_Run__c has no
 *      trigger and Allow Activities is off, so it cannot reach the schedule or
 *      the calendar even by accident.
 *
 * Read-only apart from the accept/reject PATCH in [id].js -- nothing here ever
 * writes to a Production Run.
 */
import { runQuery, jsonError } from "../_sf.js";

const OBJECT = "Proposed_Run__c";
const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

const FIELDS = [
  "Id",
  "Name",
  "Order__c",
  "Machine_Group__c",
  "Proposed_Start__c",
  "Proposed_Hours__c",
  "Quantity__c",
  "Sequence__c",
  "Notes__c",
  "Status__c",
  "Created_Run__c",
  "CreatedDate",
  "CreatedBy.Name",
];

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    if (!orderId || !SF_ID.test(orderId)) return jsonError("missing_orderId", 400);

    // Sequence__c is what the AM meant by "first run, second run", but it is
    // optional on the screen, so it is frequently null. Ordering by it alone
    // would scatter the unnumbered ones unpredictably; NULLS LAST then date
    // keeps a numbered list numbered and an unnumbered one chronological.
    const soql =
      `SELECT ${FIELDS.join(", ")} FROM ${OBJECT} ` +
      `WHERE Order__c = '${orderId}' ` +
      `ORDER BY Sequence__c ASC NULLS LAST, Proposed_Start__c ASC NULLS LAST, CreatedDate ASC`;

    const res = await runQuery(env, soql);
    if (!res.ok) {
      console.error("proposed-runs query failed", res.status, res.detail);
      return jsonError("query_failed", 502);
    }

    const proposals = res.records.map((r) => ({
      id: r.Id,
      name: r.Name,
      orderId: r.Order__c,
      machineGroup: r.Machine_Group__c || null,
      proposedStart: r.Proposed_Start__c || null,
      proposedHours: r.Proposed_Hours__c == null ? null : Number(r.Proposed_Hours__c),
      quantity: r.Quantity__c == null ? null : Number(r.Quantity__c),
      sequence: r.Sequence__c == null ? null : Number(r.Sequence__c),
      notes: r.Notes__c || null,
      status: r.Status__c || "Proposed",
      createdRunId: r.Created_Run__c || null,
      proposedBy: (r.CreatedBy && r.CreatedBy.Name) || null,
      createdDate: r.CreatedDate || null,
    }));

    return Response.json(
      {
        orderId,
        proposals,
        // Convenience for the drawer's badge -- it only wants to shout about
        // suggestions nobody has dealt with yet.
        openCount: proposals.filter((p) => p.status === "Proposed").length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
