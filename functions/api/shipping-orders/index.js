/**
 * GET /api/shipping-orders
 *
 * Powers the Shipping/Receiving Dashboard (shipping.html). Order -- NOT
 * Production_Method__c -- is the root of this query, unlike /api/orders and
 * /api/production-orders. Those two deliberately key off each individual
 * Production_Method__c's own Status__c so a multi-method order can't vanish
 * from the production floor just because one sibling lags behind (see the
 * long header comment in production-orders/index.js). This board wants the
 * OPPOSITE guarantee: an order should only show up here once EVERY method on
 * it has finished production, not as soon as the fastest one does. That's
 * exactly what Order.Order_Substatus__c already means -- it's a rollup,
 * recomputed by rollupOrderSubstatus() (../_pm-rollup.js) every time any
 * sibling method's Status__c changes, and it's pinned to the LEAST advanced
 * sibling. So "Order_Substatus__c = 'Post-Production'" already IS "every
 * method on this order has reached Post-Production or later" -- no need to
 * re-derive it from Production_Method__c here, and no risk of a still-mid-
 * production order surfacing on the shipping floor.
 *
 * `AND Status != 'Complete'` drops orders the shipping/receiving manager has
 * already closed out via POST /api/orders/:id/complete (../orders/[id]/complete.js)
 * -- Order_Substatus__c has no "Shipped"/"Done" value of its own (see
 * ALLOWED_SUBSTATUSES in ../orders/[id].js), so the standard Status field is
 * what actually marks an order finished here, same convention
 * /api/production-orders already relies on for its own Done column.
 *
 * Shipping_Delivery__c (label "Delivery Method" in Setup) is the filter this
 * board's tabs key off. CONFIRMED LIVE VALUES (Setup -> Object Manager ->
 * Order -> Fields, 2026-08-10) -- five, not the four the shop usually talks
 * about out loud:
 *   Shipping, Local Dropoff, Pickup, Order Fulfillment, Split Ship
 * TRAP: the picklist entry Salesforce shows on screen as "Local Dropoff" is
 * stored under the API value "Delivery" -- its on-screen label and its
 * stored value do NOT match (same kind of quirk already documented for
 * Order_Substatus__c's "In Production"/"Production" pair in
 * ../orders/[id].js). "Delivery" is the correct value to filter/write; never
 * add a literal "Local Dropoff" value expecting it to match live data.
 */
import { runQuery, jsonError } from "../_sf.js";

// Order fields the board list + drawer need. ShipToContact fields cover the
// Pickup/Delivery/Order Fulfillment cases, which have no Zenkraft wizard step
// and need a name/phone to hand off to instead.
const ORDER_FIELDS = [
  "Id",
  "OrderNumber",
  "GOA_Order_Number__c",
  "Customer_Order_Name__c",
  "Account.Name",
  "Print_Date__c",
  "Customer_Facing_Delivery_Date__c",
  "Status",
  "Order_Substatus__c",
  "Shipping_Delivery__c",
  "Shipping_Label_Printed__c",
  "ShippingAddress",
  "Weight__c",
  "ShipToContact.Name",
  "ShipToContact.Phone",
  "ShipToContact.Email",
  "Special_Notes__c",
  "Packaging_Count__c",
  // "Combined shipment" feature (unrelated to this board's own Split Ship
  // filter -- see Setup help text on Is_Master_Shipment_Order__c: "Used as
  // the Primary Order that defines the shipping address and contact
  // information in combined shipments"). Surfaced so the drawer can warn a
  // manager who opens a non-master order that's part of one, instead of
  // silently letting them ship it separately.
  "Is_Master_Shipment_Order__c",
  "Master_Shipment_Order__c",
  "Master_Shipment_Order__r.OrderNumber",
];

export async function onRequestGet({ env }) {
  try {
    const soql =
      `SELECT ${ORDER_FIELDS.join(", ")} FROM Order ` +
      `WHERE Order_Substatus__c = 'Post-Production' AND Status != 'Complete'`;
    // runQuery follows Salesforce's nextRecordsUrl pagination -- see _sf.js.
    const { ok, status, records } = await runQuery(env, soql);
    if (!ok) {
      console.error("Salesforce query failed", status);
      return jsonError("query_failed", status);
    }

    const orders = records.map((o) => ({
      Id: o.Id,
      OrderNumber: o.OrderNumber,
      GOA_Order_Number__c: o.GOA_Order_Number__c,
      Customer_Order_Name__c: o.Customer_Order_Name__c,
      Account: o.Account,
      Print_Date__c: o.Print_Date__c,
      Customer_Facing_Delivery_Date__c: o.Customer_Facing_Delivery_Date__c,
      Status: o.Status,
      Order_Substatus__c: o.Order_Substatus__c,
      Shipping_Delivery__c: o.Shipping_Delivery__c,
      Shipping_Label_Printed__c: o.Shipping_Label_Printed__c,
      ShippingAddress: o.ShippingAddress,
      Weight__c: o.Weight__c,
      ShipToContact: o.ShipToContact,
      Special_Notes__c: o.Special_Notes__c,
      Packaging_Count__c: o.Packaging_Count__c,
      Is_Master_Shipment_Order__c: o.Is_Master_Shipment_Order__c,
      Master_Shipment_Order__c: o.Master_Shipment_Order__c,
      MasterShipmentOrderNumber: (o.Master_Shipment_Order__r && o.Master_Shipment_Order__r.OrderNumber) || null,
      ShipmentCount: 0,
    }));

    // Batched follow-up (same pattern as OrderItems in ../orders/index.js):
    // how many zkmulti__MCShipment__c rows already exist per order, so the
    // list view can flag "already has a label logged" without a per-order
    // detail fetch. Fails open (0 for every order) so a transient error
    // never breaks the board, just this one badge.
    const orderIds = orders.map((o) => o.Id).filter(Boolean);
    if (orderIds.length) {
      try {
        const quoted = orderIds.map((oid) => `'${oid}'`).join(",");
        const soqlShip = `SELECT Order__c FROM zkmulti__MCShipment__c WHERE Order__c IN (${quoted})`;
        const shipResult = await runQuery(env, soqlShip);
        if (shipResult.ok) {
          const counts = new Map();
          shipResult.records.forEach((s) => {
            counts.set(s.Order__c, (counts.get(s.Order__c) || 0) + 1);
          });
          orders.forEach((o) => {
            o.ShipmentCount = counts.get(o.Id) || 0;
          });
        } else {
          console.error("Shipment count fetch failed", shipResult.status);
        }
      } catch (e) {
        console.error("Shipment count fetch error", e);
      }
    }

    // Soonest print date first, same convention as the other boards --
    // unknown dates sort last.
    orders.sort((a, b) => {
      const da = a.Print_Date__c, db = b.Print_Date__c;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
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
