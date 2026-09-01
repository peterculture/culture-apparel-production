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
import { runQuery, jsonError } from "../_sf.js";
import { runQueryOptionalField } from "../_placements.js";
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

/**
 * Order Ids per follow-up query.
 *
 * Salesforce takes the SOQL in the GET /query URL, and that URL has a length
 * ceiling -- the calendar endpoint runs into it somewhere around 700-800 Ids
 * (E5.12). The inbox is "Pre-Production orders with no method yet" and is
 * normally small, but nothing bounds it, and swapping a nested subquery for an
 * unbounded IN list would just trade a silent truncation for a silent 414.
 * 200 x 18 chars plus quoting is about 4KB of query, comfortably inside it.
 */
const ID_CHUNK = 200;

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

  const byOrder = new Map();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const quoted = ids.slice(i, i + ID_CHUNK).map((id) => `'${id}'`).join(",");
    const soql = `SELECT ${ITEM_FIELDS.join(", ")} FROM OrderItem WHERE OrderId IN (${quoted})`;
    const res = await runQuery(env, soql);
    if (!res.ok) {
      // Fail OPEN for the items, same call orders/index.js makes: the inbox's
      // job is listing orders that need a method, and losing a size preview
      // must not empty the board. But say so -- an empty breakdown that is
      // really a failed fetch is precisely the "wrong number, no error" shape
      // this story exists to remove.
      console.error("Inbox order-item fetch failed", res.status, `chunk ${i / ID_CHUNK}`);
      records.forEach((r) => {
        r.OrderItemsError = true;
      });
      return;
    }
    res.records.forEach((it) => {
      const arr = byOrder.get(it.OrderId) || [];
      arr.push(it);
      byOrder.set(it.OrderId, arr);
    });
  }

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
      { totalSize: records.length, done: true, records },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
