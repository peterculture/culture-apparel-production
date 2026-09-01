/**
 * POST /api/shipments/split
 *
 * Splits ONE order's items across two or more physical shipments -- the
 * Shipment_Order__c junction object's split-ship use case (see the header
 * comment in ../../shipping-orders/index.js for the "combine" half of this
 * same object; that's ../combine.js, a separate endpoint).
 *
 * For each group submitted:
 *   1. Create ONE Shipment_Order__c "leg" record (Order__c = this order,
 *      Ship_Date__c = today). Shipment_Order__c.Name__c is the object's own
 *      required field (confirmed via Setup -> New Shipment Order form,
 *      2026-08-10 -- every other field on the object is optional); it's
 *      stamped with the order number + a "Leg N" suffix so it's readable in
 *      Salesforce list views/reports without any extra input from the
 *      manager.
 *   2. PATCH every OrderItem in that group's itemIds so its own
 *      Shipment_Order__c lookup points at the new leg -- this is what
 *      actually records "these specific line items shipped together,
 *      separately from the rest of the order."
 *   3. Create ONE zkmulti__MCShipment__c for that leg (Order__c = this
 *      order, Shipment_Order__c = the leg) carrying the carrier/service/
 *      tracking number logged for that specific box, exactly like a normal
 *      single-shipment POST /api/shipments -- just linked to a leg instead
 *      of being the order's only shipment.
 *   4. If a weight was given, one child zkmulti__MCPackage__c under that
 *      shipment (same convention as ../index.js's onRequestPost).
 *
 * A half-split order -- some items tagged, some not, some shipments missing --
 * would be worse than the whole action just failing and asking the manager to
 * retry, because it looks FINISHED on the board. That requirement has not
 * changed. How it is met has.
 *
 * This used to run as ONE Composite request with allOrNone:true, which is the
 * nicest possible shape because Salesforce makes it atomic for free. But
 * /composite caps at 25 sub-requests and this array is
 * 1 leg + N items + 1 shipment (+1 package) PER GROUP. An order with 20 line
 * items split across two boxes emits 26, and Salesforce rejects the entire
 * thing. That is not an exotic order, it is a Tuesday, and the ceiling was
 * never checked -- so the manager just got a bare failure with nothing to act
 * on. (E5.10.)
 *
 * It now runs in three phases -- see ../_composite.js for the full reasoning:
 *
 *   HEAD 1  the legs        -- referenced by @{legN.id} later, so one call
 *   HEAD 2  the shipments   -- referenced by @{shipN.id} later, so one call
 *   TAIL    item PATCHes + packages, chunked freely against real Ids
 *
 * Both heads are sized by the number of BOXES, never the number of line items,
 * so the guard on them is a genuine backstop rather than a limit anyone meets.
 * The item PATCHes -- the part that actually scales with order size -- now
 * chunk without a ceiling.
 *
 * Atomicity across chunks is not free, so a tail failure rolls back the legs
 * and shipments this request created. Deleting a leg clears the
 * Shipment_Order__c lookup on any OrderItem already pointing at it, which is
 * what un-tags the items. Best-effort, and loud when it cannot: see
 * rollbackCreated.
 *
 * Body:
 *   {
 *     orderId: "<Order Id>",
 *     groups: [
 *       { itemIds: ["<OrderItem Id>", ...], carrier, serviceType, tracking, weight },
 *       ...  // at least 2 groups
 *     ]
 *   }
 * Every itemId across every group must belong to `orderId` and must not be
 * repeated across groups (each line item ships in exactly one box). Groups
 * need at least one item and a carrier + tracking number, same minimum
 * ../index.js already requires for a normal shipment log.
 */
import { apiVersion, jsonError, runQuery } from "../_sf.js";
import { runComposite, runChunked, rollbackCreated, COMPOSITE_LIMIT } from "../_composite.js";
import { requireCap } from "../_session.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

export async function onRequestPost({ env, request }) {
  const gate = await requireCap(request, env, "orders.edit");
  if (gate.denied) return gate.response;
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_json", 400);
    }
    if (!body || typeof body !== "object") return jsonError("invalid_body", 400);

    const orderId = body.orderId || "";
    if (!SF_ID.test(orderId)) return jsonError("invalid_order_id", 400);

    const rawGroups = Array.isArray(body.groups) ? body.groups : [];
    if (rawGroups.length < 2) return jsonError("need_at_least_two_groups", 400);

    const seenItemIds = new Set();
    const groups = [];
    for (const g of rawGroups) {
      if (!g || typeof g !== "object") return jsonError("bad_group", 400);
      const itemIds = Array.isArray(g.itemIds) ? g.itemIds.filter((id) => SF_ID.test(id)) : [];
      if (!itemIds.length) return jsonError("group_needs_items", 400);
      for (const id of itemIds) {
        if (seenItemIds.has(id)) return jsonError("item_in_multiple_groups", 400);
        seenItemIds.add(id);
      }
      const carrier = (g.carrier || "").toString().trim();
      const serviceType = (g.serviceType || "").toString().trim();
      const tracking = (g.tracking || "").toString().trim();
      if (!carrier) return jsonError("missing_carrier", 400);
      if (!tracking) return jsonError("missing_tracking_number", 400);
      const weight = Number(g.weight);
      groups.push({ itemIds, carrier, serviceType, tracking, weight: Number.isFinite(weight) && weight > 0 ? weight : null });
    }

    // Confirm the order exists and grab its number for the leg names.
    const orderSoql = `SELECT Id, OrderNumber, GOA_Order_Number__c FROM Order WHERE Id = '${orderId}'`;
    const orderResult = await runQuery(env, orderSoql);
    if (!orderResult.ok) {
      console.error("split: order fetch failed", orderResult.status);
      return jsonError("order_fetch_failed", orderResult.status);
    }
    const order = orderResult.records[0];
    if (!order) return jsonError("order_not_found", 404);
    const orderLabel = order.GOA_Order_Number__c || order.OrderNumber || orderId;

    // Every submitted item must actually belong to this order -- same
    // defensive check ../../orders/[id]/reprint.js uses, so a client can't
    // smuggle in a line from a different order.
    const allItemIds = groups.flatMap((g) => g.itemIds);
    const quotedIds = allItemIds.map((id) => `'${id}'`).join(",");
    const itemSoql = `SELECT Id FROM OrderItem WHERE Id IN (${quotedIds}) AND OrderId = '${orderId}'`;
    const itemResult = await runQuery(env, itemSoql);
    if (!itemResult.ok) {
      console.error("split: item verification failed", itemResult.status);
      return jsonError("items_fetch_failed", itemResult.status);
    }
    if (itemResult.records.length !== allItemIds.length) {
      return jsonError("item_order_mismatch", 400);
    }

    const v = apiVersion(env);
    const base = `/services/data/${v}/sobjects`;
    const today = new Date().toISOString().slice(0, 10);

    // Ids of everything this request creates, newest first, so a rollback
    // deletes children before their parents.
    const created = [];
    const bail = async (detail, failedRef) => {
      await rollbackCreated(env, created, "split");
      return Response.json(
        { error: "create_failed", failedRef: failedRef || null, detail, rolledBack: created.length },
        { status: 502 },
      );
    };

    // --- HEAD 1: the legs. Referenced by @{legN.id} from here on. ---
    if (groups.length > COMPOSITE_LIMIT) {
      // One order split into more than 25 boxes. Fail loudly rather than
      // half-build: something is wrong upstream, not with this request.
      return Response.json(
        { error: "too_many_groups", detail: `${groups.length} groups exceeds the composite ceiling of ${COMPOSITE_LIMIT}` },
        { status: 400 },
      );
    }

    const legReq = groups.map((g, i) => ({
      method: "POST",
      url: `${base}/Shipment_Order__c`,
      referenceId: `leg${i}`,
      body: {
        Name__c: `${orderLabel} - Leg ${i + 1}`,
        Order__c: orderId,
        Ship_Date__c: today,
      },
    }));
    const legRes = await runComposite(env, legReq, "split legs");
    if (!legRes.ok) return bail(legRes.detail, legRes.failedRef);
    const legIds = groups.map((_, i) => legRes.ids[`leg${i}`]);
    // Unshift: legs are the last thing a rollback should remove.
    legIds.forEach((id) => created.unshift({ object: "Shipment_Order__c", id }));

    // --- HEAD 2: the shipments. Referenced by @{shipN.id} by the packages. ---
    const shipReq = groups.map((g, i) => ({
      method: "POST",
      url: `${base}/zkmulti__MCShipment__c`,
      referenceId: `ship${i}`,
      body: {
        Order__c: orderId,
        Shipment_Order__c: legIds[i],
        zkmulti__Carrier__c: g.carrier,
        zkmulti__Service_Type_Name__c: g.serviceType || null,
        zkmulti__Tracking_Number__c: g.tracking,
        zkmulti__Ship_Date__c: today,
      },
    }));
    const shipRes = await runComposite(env, shipReq, "split shipments");
    if (!shipRes.ok) return bail(shipRes.detail, shipRes.failedRef);
    const shipIds = groups.map((_, i) => shipRes.ids[`ship${i}`]);
    shipIds.forEach((id) => created.unshift({ object: "zkmulti__MCShipment__c", id }));

    // --- TAIL: item PATCHes and packages. Real Ids only, so chunk freely. ---
    //
    // Item PATCHes go FIRST. They are the part that scales with order size and
    // the part a manager would most notice missing, so if anything is going to
    // fail on a big order, fail before the packages rather than after.
    const tail = [];
    groups.forEach((g, i) => {
      g.itemIds.forEach((itemId, j) => {
        tail.push({
          method: "PATCH",
          url: `${base}/OrderItem/${itemId}`,
          referenceId: `leg${i}item${j}`,
          body: { Shipment_Order__c: legIds[i] },
        });
      });
    });
    groups.forEach((g, i) => {
      if (g.weight == null) return;
      tail.push({
        method: "POST",
        url: `${base}/zkmulti__MCPackage__c`,
        referenceId: `pkg${i}`,
        body: {
          zkmulti__Shipment__c: shipIds[i],
          zkmulti__Weight__c: g.weight,
          zkmulti__Weight_Units__c: "lbs",
        },
      });
    });

    const tailRes = await runChunked(env, tail, { label: "split tail", refPrefix: "t" });
    if (!tailRes.ok) {
      // Packages created by an earlier chunk have to go too. They are children
      // of the shipments, so they are unshifted ahead of them.
      for (let i = 0; i < groups.length; i++) {
        const pkgId = tailRes.ids && tailRes.ids[`pkg${i}`];
        if (pkgId) created.unshift({ object: "zkmulti__MCPackage__c", id: pkgId });
      }
      return bail(tailRes.detail, tailRes.failedRef);
    }

    return Response.json(
      {
        ok: true,
        legs: legIds,
        shipments: shipIds,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
