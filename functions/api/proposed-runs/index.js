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
import { jsonError } from "../_sf.js";
import { runQueryOptionalField, failureMentionsField } from "../_placements.js";

const OBJECT = "Proposed_Run__c";
const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

// Print_Location__c added 2026-08-20 -- the CAM picks it on the Repeater
// screen in "Order and Order Items Subflow Design", so the shop manager can
// see which location a proposal is for before turning it into a real run.
// Single-select, same eleven values as Production_Method__c.Placements__c.
//
// UNLIKE the run's copy this one is NOT scoped to a method's placements:
// Proposed_Run__c exists precisely because no Production_Method__c exists yet
// at close time, so there is nothing to scope to. The CAM sees all eleven.
const LOCATION_FIELD = "Print_Location__c";
/* Dropped together: a lookup and its relationship are one thing to the org, and asking for
   Press__r.Name without Press__c would be a second parse error one line later. */
const PRESS_FIELDS = ["Press__c", "Press__r.Name"];
const FIELDS = [
  "Id",
  "Name",
  "Order__c",
  "Machine_Group__c",
  // Press__c added 2026-09-11. Lookup(Account) -- presses are Accounts with
  // Type = 'Press' (see ../presses/index.js) -- and it is deliberately the
  // SAME field name and type as Production_Run__c.Press__c, so adopting a
  // proposal copies the Id straight across with no name matching. The CAM
  // picks it on the Repeater screen in "Order and Order Items Subflow
  // Design", alongside Print_Location__c, and it is OPTIONAL: at close time
  // the CAM often does not know the press yet, and a blank here means "shop
  // manager decides", not "no press".
  "Press__c",
  "Press__r.Name",
  LOCATION_FIELD,
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
    const buildSoql = (withLocation, withPress) =>
      `SELECT ${FIELDS.filter(
        (f) => (withLocation || f !== LOCATION_FIELD) && (withPress || PRESS_FIELDS.indexOf(f) === -1),
      ).join(", ")} FROM ${OBJECT} ` +
      `WHERE Order__c = '${orderId}' ` +
      `ORDER BY Sequence__c ASC NULLS LAST, Proposed_Start__c ASC NULLS LAST, CreatedDate ASC`;

    // Tolerant of Print_Location__c not existing yet: naming a missing or
    // FLS-hidden field in a SELECT is a parse error that kills the whole
    // query, and CAApi.getProposedRuns() swallows a failure into [] -- so
    // without this, an org one step behind on metadata would silently show
    // "no suggestions" on every order instead of the CAM's actual proposals.
    /* TWO optional things in one SELECT, and they fail the same way. Press__c is newer than
       Print_Location__c and, like it, does not exist in every org -- one deployment serves dev2,
       staging and production (CLAUDE.md), and naming a field the active org lacks is not a blank
       column, it is a parse error that takes the WHOLE query down. getProposedRuns() swallows a
       failure into [], so the cost of getting this wrong is every order quietly reporting "no
       suggestions" while the CAM's proposals sit there in Salesforce.

       runQueryOptionalField retries for ONE named field, so press is handled around it: ask with
       press, and only if the org's complaint actually names Press__ do we ask again without it.
       Location's own fallback rides along inside both attempts. Any other failure is still a real
       failure and is reported as one. */
    let hadPress = true;
    let res = await runQueryOptionalField(env, (withLocation) => buildSoql(withLocation, true), LOCATION_FIELD);
    if (!res.ok && failureMentionsField(res.data, "Press__")) {
      hadPress = false;
      console.warn("proposed-runs: Press__c is not queryable in the active org -- serving proposals without it");
      res = await runQueryOptionalField(env, (withLocation) => buildSoql(withLocation, false), LOCATION_FIELD);
    }
    if (!res.ok) {
      console.error("proposed-runs query failed", res.status, res.detail);
      return jsonError("query_failed", 502);
    }

    const proposals = res.records.map((r) => ({
      id: r.Id,
      name: r.Name,
      orderId: r.Order__c,
      machineGroup: r.Machine_Group__c || null,
      // hadPress keeps "this org has no press field" distinct from "the CAM left it blank" --
      // same distinction runQueryOptionalField's hadField draws for the location.
      pressId: hadPress ? r.Press__c || null : null,
      pressName: (hadPress && r.Press__r && r.Press__r.Name) || null,
      printLocation: r[LOCATION_FIELD] || null,
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
        // Diagnostic, not a feature: a board showing every proposal with a blank press can be
        // read two ways, and this says which. It is the answer to "is the press missing because
        // nobody set one, or because this org has not got the field yet" without a deploy.
        pressAvailable: hadPress,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
