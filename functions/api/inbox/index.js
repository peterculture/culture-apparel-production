/**
 * GET /api/inbox
 *
 * Returns the manager inbox: Orders that are in Pre-Production but do NOT yet
 * have a Production Method attached. As soon as a method is created for an
 * order (via POST /api/production-methods), that order falls out of this list
 * on the next load — the semi-join below excludes any Order whose Id appears
 * as the Order__c master-detail parent of an existing Production_Method__c.
 *
 * Uses Order__c (the confirmed master-detail field) in the sub-select, so this
 * needs no child-relationship name. Same fixed-query, no-client-SOQL shape as
 * /api/orders — the browser can't run arbitrary queries.
 */
import { runQuery, jsonError, runChunkedIdQuery } from "../_sf.js";
import { runQueryOptionalField, splitPlacements } from "../_placements.js";
import { fetchMockupsByOpportunity } from "../_mockup.js";
const FIELDS = [
  "Id",
  "OrderNumber",
  "GOA_Order_Number__c",
  "Customer_Order_Name__c",
  "Print_Date__c",
  // Added 2026-08-14, mirrors /api/orders and /api/production-orders -- lets
  // the post-creation "Create Production Run" panel prefill Scheduled
  // Start/End right after a manager creates the first method for a
  // brand-new inbox order. See those files' comments for what these are.
  "Duration__c",
  "Print_End_Date_Time__c",
  "Account.Name",
  "Customer_Facing_Delivery_Date__c",
  "OpportunityId", // <-- used server-side to look up the Design__c mockup image
  "Mockup__c",
  "Specifications_for_Printing__c",
  "Special_Notes__c",
  "Printer__r.Name",
];

/**
 * OrderItems are fetched SEPARATELY, not as a nested subquery. (E3.4.)
 *
 * This used to ride along in the SELECT above as
 *
 *     (SELECT Product2.Name, Color__c, Size__c, Quantity FROM OrderItems)
 *
 * which reads well and is wrong past 200 line items. Salesforce returns at
 * most 200 child rows inline per parent and hands back a per-record
 * `nextRecordsUrl` for the rest; runQuery follows only the TOP-LEVEL locator
 * (see _sf.js), so item 201 onward was dropped on the floor. The manager saw a
 * confident, complete-looking size breakdown that was quietly missing garments,
 * with no error anywhere -- the worst failure shape this project has, because
 * nothing on the screen suggests you should not trust the number.
 *
 * A flat `WHERE OrderId IN (...)` has only top-level pagination, which runQuery
 * already handles correctly, so the cap disappears rather than moving. This is
 * also the pattern orders/index.js and production-orders/index.js already use
 * for exactly this data -- the inbox was the last nested subquery in the API.
 */
const ITEM_FIELDS = ["OrderId", "Product2.Name", "Color__c", "Size__c", "Quantity"];

/** Attach each order's line items as the {records:[...]} shape pivotItems reads. */
async function attachOrderItems(env, records) {
  const ids = records.map((r) => r.Id).filter(Boolean);
  // Default every order to an empty-but-present list, so a record that genuinely
  // has no line items and one whose fetch failed are told apart by the flag
  // below rather than by both being absent.
  records.forEach((r) => {
    r.OrderItems = { totalSize: 0, done: true, records: [] };
  });
  if (!ids.length) return;

  // Chunked because the SOQL rides in the GET /query URL and that URL has a
  // length ceiling -- swapping a nested subquery for an UNBOUNDED IN list would
  // only have traded a silent truncation for a silent 414. runChunkedIdQuery
  // owns that in one place now; the calendar endpoint uses the same helper
  // against four IN lists of its own (E5.12).
  const res = await runChunkedIdQuery(ids, (quoted) =>
    runQuery(env, `SELECT ${ITEM_FIELDS.join(", ")} FROM OrderItem WHERE OrderId IN (${quoted})`),
  );
  if (!res.ok) {
    // Fail OPEN for the items, same call orders/index.js makes: the inbox's
    // job is listing orders that need a method, and losing a size preview must
    // not empty the board. But say so -- an empty breakdown that is really a
    // failed fetch is precisely the "wrong number, no error" shape this story
    // exists to remove.
    console.error("Inbox order-item fetch failed", res.status);
    records.forEach((r) => {
      r.OrderItemsError = true;
    });
    return;
  }

  const byOrder = new Map();
  res.records.forEach((it) => {
    const arr = byOrder.get(it.OrderId) || [];
    arr.push(it);
    byOrder.set(it.OrderId, arr);
  });

  records.forEach((r) => {
    const recs = byOrder.get(r.Id) || [];
    r.OrderItems = { totalSize: recs.length, done: true, records: recs };
  });
}
/* Ticked by the CAM on the Opportunity during Close and Create Order and copied
   onto every Order the flow creates. It is the ONLY signal the shop has that a
   job needs more than one production method -- the dashboard cannot infer it
   from anything else, because a second method does not exist until someone
   creates it. Pre-Production Management gates its "Create Another Method"
   button on this.

   Queried through runQueryOptionalField because it will not exist in every org
   at once (dev2 first, then staging, then production). A field that is missing
   or FLS-hidden is a PARSE error returning zero rows, which would empty the
   Management inbox entirely rather than just losing this one flag. */
/* ── reprints, which the query above excludes by construction ─────────────
   createReworkIfNeeded (_rework.js) creates the reprint Order with its
   Production_Method__c ALREADY MADE -- type, placements and vendor mirrored
   from the method that was misprinted. The inbox query above is "orders with
   NO method", so a reprint never appears there, and the pre-production board
   it does land on has no way to create a run. The blanks get reordered and
   nobody can book press time for them.

   So this is a SECOND query rather than a relaxed first one. The existing
   query is left exactly as it is: it answers "who needs a method", which is
   still the inbox's main job, and widening it would put every methodless
   reprint edge case into the one query the whole screen depends on.

   WHY "HAS NO RUNS" IS AN EXPLICIT FOLLOW-UP AND NOT A SEMI-JOIN.
   Production_Run__c hangs off Production_Method__c through PrintMethod__c, not
   off Order, so there is no Order-rooted sub-select to write. Guessing a
   relationship name here is trap 2, and a wrong guess is a parse error that
   surfaces as ZERO ROWS -- which on this screen reads as "no reprints to
   route today", the most expensive way for it to be wrong. Two plain queries
   that each say what they select cannot fail that way.

   Misprint__c IS SELECTED UNCONDITIONALLY, and that is checked rather than
   assumed. orders/index.js and production-orders/index.js both select it plain
   (Order__r.Misprint__c) and pre-production.html's isReprint flag reads the
   result -- so if the integration user could not see it, the board that flag
   drives would already be empty in every org. It does not need the
   optional-field treatment Multiple_Production_Methods__c gets below, and this
   query fails open anyway.

   DELIBERATE: a reprint now appears in BOTH the Management inbox and the
   pre-production board. It still needs new blanks received and its prep
   ticked, which is the board's job, while scheduling is the inbox's. It drops
   out of here on its own once a run exists. */
const REPRINT_METHOD_FIELDS = ["Id", "Order__c", "Type__c", "Placements__c", "Status__c"];

async function fetchReprintsAwaitingRuns(env) {
  // 1. Pre-Production reprints. Same field list and order as the main query so
  //    the two merge into one list the client cannot tell apart by shape.
  const orders = await runQuery(
    env,
    `SELECT ${FIELDS.join(", ")}, Misprint__c FROM Order ` +
      `WHERE Status = 'Pre-Production' AND Misprint__c = true ` +
      `ORDER BY Print_Date__c ASC`,
  );
  if (!orders.ok) throw new Error("reprint_order_query_failed:" + orders.status);
  if (!orders.records.length) return [];

  // 2. Their methods. Order__c is the confirmed master-detail field -- the same
  //    one the main query's sub-select uses -- so no relationship name is guessed.
  const orderIds = orders.records.map((r) => r.Id).filter(Boolean);
  const methods = await runChunkedIdQuery(orderIds, (quoted) =>
    runQuery(env, `SELECT ${REPRINT_METHOD_FIELDS.join(", ")} FROM Production_Method__c WHERE Order__c IN (${quoted})`),
  );
  if (!methods.ok) throw new Error("reprint_method_query_failed:" + methods.status);

  const methodsByOrder = new Map();
  const methodIds = [];
  methods.records.forEach((m) => {
    if (!m.Order__c || !m.Id) return;
    const arr = methodsByOrder.get(m.Order__c) || [];
    arr.push(m);
    methodsByOrder.set(m.Order__c, arr);
    methodIds.push(m.Id);
  });

  // 3. Which of those methods already carry a run. PrintMethod__c is the field
  //    run-results and _rework.js both walk for the same reason.
  const withRuns = new Set();
  if (methodIds.length) {
    const runs = await runChunkedIdQuery(methodIds, (quoted) =>
      runQuery(env, `SELECT PrintMethod__c FROM Production_Run__c WHERE PrintMethod__c IN (${quoted})`),
    );
    if (!runs.ok) throw new Error("reprint_run_query_failed:" + runs.status);
    runs.records.forEach((r) => { if (r.PrintMethod__c) withRuns.add(r.PrintMethod__c); });
  }

  /* A reprint belongs here only while NONE of its methods has a run. The
     moment one is booked it drops out on its own, which is why nothing has to
     remember that it was routed. A reprint whose method row is missing
     entirely is left out too -- there would be nothing to schedule against,
     and the main query above will already be showing it. */
  return orders.records
    .filter((o) => {
      const ms = methodsByOrder.get(o.Id) || [];
      return ms.length > 0 && !ms.some((m) => withRuns.has(m.Id));
    })
    .map((o) => Object.assign({}, o, {
      IsReprint: true,
      NeedsMethod: false,
      ProductionMethods: (methodsByOrder.get(o.Id) || []).map((m) => ({
        Id: m.Id,
        Type__c: m.Type__c || null,
        Status__c: m.Status__c || null,
        Placements: splitPlacements(m.Placements__c),
      })),
    }));
}

const MULTI_METHOD_FIELD = "Multiple_Production_Methods__c";
export async function onRequestGet({ env }) {
  try {
    const buildSoql = (withMulti) =>
      `SELECT ${FIELDS.concat(withMulti ? [MULTI_METHOD_FIELD] : []).join(", ")} FROM Order ` +
      `WHERE Status = 'Pre-Production' ` +
      `AND Id NOT IN (SELECT Order__c FROM Production_Method__c) ` +
      `ORDER BY Print_Date__c ASC`;
    // runQuery follows Salesforce's nextRecordsUrl pagination so the inbox
    // doesn't silently truncate if it ever grows past one query batch. See
    // _sf.js.
    const { ok, status, records } = await runQueryOptionalField(env, buildSoql, MULTI_METHOD_FIELD);
    if (!ok) {
      console.error("Inbox query failed", status);
      return jsonError("query_failed", status);
    }

    /* Every record from the query above needs a method -- that is what it
       selected for. Stated explicitly so the client branches on a field the
       server set, not on the absence of one. */
    records.forEach((r) => { r.NeedsMethod = true; r.IsReprint = false; r.ProductionMethods = []; });

    /* Reprints, merged in. FAILS OPEN: if any part of it throws, the ordinary
       inbox still renders and the response says the reprint half is missing --
       same call attachOrderItems makes below with OrderItemsError. A blank
       Management inbox is worse than a missing reprint, because a blank one
       looks like there is no work rather than like something broke. */
    let reprintsUnavailable = false;
    try {
      const reprints = await fetchReprintsAwaitingRuns(env);
      const seen = new Set(records.map((r) => r.Id));
      reprints.forEach((r) => { if (!seen.has(r.Id)) { records.push(r); seen.add(r.Id); } });
      // One list, one order. Print date ascending, exactly as both queries asked
      // for -- merging two sorted lists does not keep them sorted.
      records.sort((a, b) => String(a.Print_Date__c || "9999").localeCompare(String(b.Print_Date__c || "9999")));
    } catch (e) {
      console.error("Inbox reprint lookup failed", e && e.message);
      reprintsUnavailable = true;
    }

    // Line items, in their own paginated query -- see attachOrderItems.
    await attachOrderItems(env, records);

    const mockups = await fetchMockupsByOpportunity(
      env,
      records.map((r) => r.OpportunityId),
    );
    records.forEach((r) => {
      r.DesignMockupUrl = mockups.get(r.OpportunityId) || null;
    });

    return Response.json(
      { totalSize: records.length, done: true, records, reprintsUnavailable },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
