/**
 * GET /api/production-orders
 *
 * Powers the Production Dashboard (index.html). Production_Method__c --
 * NOT Order -- is the root of this query. Every row already IS a board
 * card: it carries its own Status__c (which decides its column, see
 * stageOfMethod() in ca-api.js) and every order-level field a card needs,
 * pulled through the Order__r relationship. Rows are grouped into an
 * order-shaped payload afterward purely for DISPLAY -- Order is a grouping
 * label here, not a gate.
 *
 * WHY THIS SHAPE (2026-07-22): a per-method status should be the only
 * thing that decides whether a card shows up here and which column it
 * lands in. Earlier versions of this endpoint queried Order first and
 * filtered by Order.Order_Substatus__c -- a field that's rolled up to
 * whichever sibling method is LEAST advanced (see _pm-rollup.js) -- or by
 * a side-query checking for a qualifying method, with a fallback back to
 * that same order-level filter on error. Both approaches kept Order as the
 * source of truth for visibility, so a multi-method order (e.g. a Screen
 * Print method still in Pre-Production alongside a Heat Press method
 * already in Post-Production) could vanish from this whole dashboard --
 * or the "fixed" version could silently degrade back into that exact bug
 * the moment the side-query had a transient failure. Querying
 * Production_Method__c directly removes the order-level gate entirely:
 * each method's visibility depends only on itself, with no side-query and
 * nothing to fall back to.
 *
 * WHY A SEPARATE ENDPOINT FROM /api/orders: /api/orders filters on the
 * standard `Status` field (`WHERE Status = 'Pre-Production'`), which is
 * correct for the Pre-Production Dashboard but doesn't track production
 * work -- `Status` is a standard order-fulfillment field that advances on
 * its own (e.g. to "Enter Tracking") once shipping/tracking info is
 * entered, well before production work is actually done. Confirmed on
 * Order 00013456, 2026-07-14.
 */
import { runQuery, jsonError, runChunkedIdQuery } from "../_sf.js";
import { fetchMockupsByOpportunity } from "../_mockup.js";

// Production_Method__c.Status__c values shown on this board -- kept in
// sync with STAGE_KEY in ca-api.js (drives column placement) and PM_RANK
// in _pm-rollup.js. On Hold ranks the same as Pre-Production in both, so
// it's deliberately excluded here too: a method on hold shouldn't put its
// order on the production floor board.
const BOARD_STATUSES = [
  "Ready for Print",
  "In Production",
  "Post-Production",
  "Completed",
];

// Production_Method__c fields every card needs -- same set the old
// enrichment query fetched, just as the primary SELECT now.
const PM_FIELDS = [
  "Id",
  "Order__c",
  "Type__c",
  "Placement__c",
  "Placements__c",
  "Status__c",
  // Renamed from Films_Printed__c 2026-08-10 -- see ca-api.js's CHECK_FIELD.
  "Design_Received__c",
  "Screens_Completed__c",
  "Mix_Inks__c",
  "Digitize_File__c",
  "Thread_Color_Materials__c",
  "Transfers_Received__c",
  "Transfers_Ready__c",
  // Per-method timers (2026-07-22): each Production_Method__c now has its own
  // copy of these, same as the checklist fields -- sibling methods on one
  // order time independently. The order-level totals below are computed as
  // a live SUM across siblings during grouping, not read from Order.
  "Print_Setup_Timer__c",
  "Production_Timer__c",
];

// Order-level fields every card needs, reached through the Order__r
// relationship -- the same fields the old FIELDS list selected directly
// off Order, just re-pathed.
const ORDER_FIELDS = [
  "Order__r.Id",
  "Order__r.GOA_Order_Number__c",
  "Order__r.OpportunityId",
  "Order__r.Opportunity.SyncedQuoteId",
  "Order__r.OrderNumber",
  "Order__r.Customer_Order_Name__c",
  "Order__r.Print_Date__c",
  // Added 2026-08-14 so the "Create Production Run" modal can prefill
  // Scheduled Start/End from what's already on the Order -- Duration__c is
  // the raw hours the OrderScheduling flow now writes (see UpdateOrder in
  // that flow, V31+), and Print_End_Date_Time__c is a pre-existing formula
  // field (Print_Date__c + Duration__c/24, falls back to +2h if Duration__c
  // is blank) that already computes the end time. No new Order fields were
  // needed -- both existed unused before this.
  "Order__r.Duration__c",
  "Order__r.Print_End_Date_Time__c",
  "Order__r.Account.Name",
  "Order__r.Printer__r.Name",
  "Order__r.Status",
  "Order__r.Order_Substatus__c",
  "Order__r.Receiving_Status__c",
  "Order__r.Partial_Check_in_Missing_Items__c",
  "Order__r.Misprint__c",
  "Order__r.Misprint_Details__c",
  "Order__r.TotalQtyMisprints__c",
  "Order__r.Packaging_Count__c",
  "Order__r.Production_Notes__c",
  "Order__r.Shipping_Delivery__c",
  "Order__r.Shipping_Label_Printed__c",
  "Order__r.ShippingAddress",
  "Order__r.Special_Notes__c",
  "Order__r.Specifications_for_Printing__c",
];

export async function onRequestGet({ env }) {
  try {
    const statusList = BOARD_STATUSES.map((s) => `'${s}'`).join(",");
    // Order__r.Status = 'Complete' (the standard field, set directly in
    // Salesforce -- NOT the same string as Production_Method__c.Status__c's
    // "Completed") is pulled in here even when a method's own Status__c
    // never advanced past Pre-Production/Cancelled/On Hold. Without this,
    // a method stuck in Pre-Production on an order someone just marked
    // Complete would never be fetched at all, so the client-side override
    // in index.html (which forces it into the Done column) would never get
    // the chance to run.
    const soql =
      `SELECT ${PM_FIELDS.join(", ")}, ${ORDER_FIELDS.join(", ")} ` +
      `FROM Production_Method__c ` +
      `WHERE (Status__c IN (${statusList}) OR Order__r.Status = 'Complete') AND Order__c != null`;
    // runQuery follows Salesforce's nextRecordsUrl pagination -- this is the
    // one query in the whole app with no date bound (it deliberately pulls
    // in every Completed order ever, see the comment above), so it's the
    // most likely of the bunch to eventually exceed one query batch as
    // history accumulates. See _sf.js.
    const { ok, status, records } = await runQuery(env, soql);
    if (!ok) {
      console.error("Salesforce query failed", status);
      return jsonError("query_failed", status);
    }

    // Group method rows into one object per Order__c. Order-level fields
    // are identical across sibling methods on the same order, so they're
    // taken from the first row seen for that order; every row still adds
    // its own entry to ProductionMethods.
    const byOrder = new Map();
    records.forEach((pm) => {
      const o = pm.Order__r || {};
      let order = byOrder.get(pm.Order__c);
      if (!order) {
        order = {
          Id: o.Id || pm.Order__c,
          GOA_Order_Number__c: o.GOA_Order_Number__c,
          OpportunityId: o.OpportunityId,
          Opportunity: o.Opportunity,
          OrderNumber: o.OrderNumber,
          Customer_Order_Name__c: o.Customer_Order_Name__c,
          Print_Date__c: o.Print_Date__c,
          Duration__c: o.Duration__c,
          Print_End_Date_Time__c: o.Print_End_Date_Time__c,
          Account: o.Account,
          Printer__r: o.Printer__r,
          Status: o.Status,
          Order_Substatus__c: o.Order_Substatus__c,
          Receiving_Status__c: o.Receiving_Status__c,
          Partial_Check_in_Missing_Items__c: o.Partial_Check_in_Missing_Items__c,
          // Live SUM across sibling Production_Method__c rows, accumulated
          // below as each method is pushed -- NOT read from Order. Two
          // methods each showing 20 elapsed seconds add up to 40 here.
          Print_Setup_Timer__c: 0,
          Production_Timer__c: 0,
          Misprint__c: o.Misprint__c,
          Misprint_Details__c: o.Misprint_Details__c,
          TotalQtyMisprints__c: o.TotalQtyMisprints__c,
          Packaging_Count__c: o.Packaging_Count__c,
          Production_Notes__c: o.Production_Notes__c,
          Shipping_Delivery__c: o.Shipping_Delivery__c,
          Shipping_Label_Printed__c: o.Shipping_Label_Printed__c,
          ShippingAddress: o.ShippingAddress,
          Special_Notes__c: o.Special_Notes__c,
          Specifications_for_Printing__c: o.Specifications_for_Printing__c,
          DesignMockupUrl: null,
          OrderItems: { totalSize: 0, done: true, records: [] },
          ProductionMethods: [],
        };
        byOrder.set(pm.Order__c, order);
      }
      const pmSetup = Number(pm.Print_Setup_Timer__c) || 0;
      const pmProd = Number(pm.Production_Timer__c) || 0;
      order.ProductionMethods.push({
        Id: pm.Id,
        Type__c: pm.Type__c,
        Placement__c: pm.Placement__c || null,
        Placements: pm.Placements__c
          ? pm.Placements__c.split(";").filter(Boolean)
          : (pm.Placement__c ? [pm.Placement__c] : []),
        Status__c: pm.Status__c,
        Design_Received__c: !!pm.Design_Received__c,
        Screens_Completed__c: !!pm.Screens_Completed__c,
        Mix_Inks__c: !!pm.Mix_Inks__c,
        Digitize_File__c: !!pm.Digitize_File__c,
        Thread_Color_Materials__c: !!pm.Thread_Color_Materials__c,
        Transfers_Received__c: !!pm.Transfers_Received__c,
        Transfers_Ready__c: !!pm.Transfers_Ready__c,
        Print_Setup_Timer__c: pmSetup,
        Production_Timer__c: pmProd,
      });
      order.Print_Setup_Timer__c += pmSetup;
      order.Production_Timer__c += pmProd;
    });

    const orders = Array.from(byOrder.values());

    // OrderItems is a child of Order, not of Production_Method__c, so it
    // can no longer ride along as a nested subquery now that
    // Production_Method__c is the query root -- fetch it in one batched
    // follow-up keyed by order Id instead, same pattern as the mockup
    // lookup below. Fails open (empty items) so a transient error never
    // breaks a card, just its size/qty display.
    const orderIds = orders.map((o) => o.Id).filter(Boolean);
    if (orderIds.length) {
      try {
        const quoted = orderIds.map((oid) => `'${oid}'`).join(",");
        const soqlItems =
          `SELECT OrderId, Product2.Name, Color__c, Size__c, Quantity ` +
          `FROM OrderItem WHERE OrderId IN (${quoted})`;
        const itemsResult = await runQuery(env, soqlItems);
        if (itemsResult.ok) {
          const itemsByOrder = new Map();
          itemsResult.records.forEach((it) => {
            const arr = itemsByOrder.get(it.OrderId) || [];
            arr.push(it);
            itemsByOrder.set(it.OrderId, arr);
          });
          orders.forEach((o) => {
            const recs = itemsByOrder.get(o.Id) || [];
            o.OrderItems = { totalSize: recs.length, done: true, records: recs };
          });
        } else {
          console.error("Order item fetch failed", itemsResult.status);
        }
      } catch (e) {
        console.error("Order item fetch error", e);
      }
    }

    /* ── runs left to print, per method ───────────────────────────────────
       So a manager can see it on the card without opening the drawer. The
       board had no run data at all: runs arrive per-method through
       loadRunsForCard() -> getProductionRuns(methodId), which only fires when
       a drawer opens, so state.runsByMethod holds opened cards only.

       WHY THIS IS A FOLLOW-UP QUERY AND NOT PART OF THE SELECT ABOVE. That
       SELECT is what the whole board depends on, and trap 1 is that one
       FLS-hidden field fails the ENTIRE statement rather than dropping a
       column -- the board empties. A run count is not worth that risk. This is
       the same shape, and the same fail-open contract, as the OrderItem
       follow-up directly above: a transient error costs the badge and nothing
       else.

       WHY NOT A NESTED SUBQUERY. E3.4 removed the last one in the API on
       purpose -- child rows page at 200 independently of the top-level
       locator, so runQuery follows only the outer one and row 201 vanishes
       with no error. A flat IN list has top-level pagination only, which
       runQuery already handles, and runChunkedIdQuery keeps the IN list under
       the URL length ceiling.

       WHY NOT A ROLLUP FIELD ON THE METHOD. D9 is the precedent: a stored
       derived number that nothing refreshes is worse than no number, and it
       would have to travel to three orgs under E7.4.

       PrintMethod__c, not a __r walk -- trap 2. PrintMethod__r has never
       existed in any org; the relationship is Production_Runs, and a wrong
       guess is a parse error that reads as zero rows, i.e. "nothing left to
       print" on every card.

       ⚠️ UNKNOWN IS NOT ZERO. On failure the counts are left absent entirely
       rather than defaulted to 0. A card that renders "0 left" because a fetch
       failed is telling a manager there is no printing to do, which is the
       same class of lie as a demo board. The client shows nothing until it
       actually knows. */
    const methodIds = [];
    orders.forEach((o) => (o.ProductionMethods || []).forEach((pm) => { if (pm.Id) methodIds.push(pm.Id); }));
    if (methodIds.length) {
      try {
        const runs = await runChunkedIdQuery(methodIds, (quoted) =>
          runQuery(
            env,
            `SELECT Id, PrintMethod__c, Actual_End__c FROM Production_Run__c ` +
              `WHERE PrintMethod__c IN (${quoted})`,
          ),
        );
        if (runs.ok) {
          /* "Left to print" is EXACTLY index.html's own rule: a run with no
             Actual End is still to be printed. That is the same test that
             advances a method to Post-Production when the last run is stamped
             (stopTimer -> remaining). Two definitions here would show "2 left"
             on a method the board had already moved on, and it would look like
             a data problem rather than a definition one.

             Every run counts regardless of Print_Location__c: since B4 made
             allocation placement-aware a Front+Back method legitimately has a
             run per placement, and both still go through the press. */
          const byMethod = new Map();
          runs.records.forEach((r) => {
            const mid = r.PrintMethod__c;
            if (!mid) return;
            const acc = byMethod.get(mid) || { total: 0, remaining: 0 };
            acc.total += 1;
            if (!r.Actual_End__c) acc.remaining += 1;
            byMethod.set(mid, acc);
          });
          orders.forEach((o) => (o.ProductionMethods || []).forEach((pm) => {
            const acc = byMethod.get(pm.Id) || { total: 0, remaining: 0 };
            pm.RunsTotal = acc.total;
            pm.RunsRemaining = acc.remaining;
          }));
        } else {
          console.error("Run count fetch failed", runs.status);
        }
      } catch (e) {
        console.error("Run count fetch error", e);
      }
    }

    const mockups = await fetchMockupsByOpportunity(
      env,
      orders.map((o) => o.OpportunityId),
    );
    orders.forEach((o) => {
      o.DesignMockupUrl = mockups.get(o.OpportunityId) || null;
    });

    // Match the old ORDER BY Print_Date__c ASC (SOQL's default puts nulls
    // first on an ascending sort), so card order within a column reads the
    // same as before.
    orders.sort((a, b) => {
      const da = a.Print_Date__c, db = b.Print_Date__c;
      if (!da && !db) return 0;
      if (!da) return -1;
      if (!db) return 1;
      return da < db ? -1 : da > db ? 1 : 0;
    });

    return Response.json(
      { totalSize: orders.length, done: true, records: orders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
