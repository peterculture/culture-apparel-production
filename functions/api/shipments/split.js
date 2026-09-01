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
 * Everything runs in ONE Salesforce Composite request with allOrNone: true
 * (same pattern as ../../orders/[id]/reprint.js) -- either every leg/tag/
 * shipment/package gets created together, or none of it does. A half-split
 * order (some items tagged, some not, some shipments missing) would be
 * worse than the whole action just failing and asking the manager to retry.
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
import { sfFetch, apiVersion, jsonError, runQuery } from "../_sf.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

export async function onRequestPost({ env, request }) {
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
    const compositeRequest = [];

    groups.forEach((g, i) => {
      const legRef = `leg${i}`;
      compositeRequest.push({
        method: "POST",
        url: `${base}/Shipment_Order__c`,
        referenceId: legRef,
        body: {
          Name__c: `${orderLabel} - Leg ${i + 1}`,
          Order__c: orderId,
          Ship_Date__c: today,
        },
      });

      g.itemIds.forEach((itemId, j) => {
        compositeRequest.push({
          method: "PATCH",
          url: `${base}/OrderItem/${itemId}`,
          referenceId: `${legRef}item${j}`,
          body: { Shipment_Order__c: `@{${legRef}.id}` },
        });
      });

      const shipRef = `ship${i}`;
      compositeRequest.push({
        method: "POST",
        url: `${base}/zkmulti__MCShipment__c`,
        referenceId: shipRef,
        body: {
          Order__c: orderId,
          Shipment_Order__c: `@{${legRef}.id}`,
          zkmulti__Carrier__c: g.carrier,
          zkmulti__Service_Type_Name__c: g.serviceType || null,
          zkmulti__Tracking_Number__c: g.tracking,
          zkmulti__Ship_Date__c: today,
        },
      });

      if (g.weight != null) {
        compositeRequest.push({
          method: "POST",
          url: `${base}/zkmulti__MCPackage__c`,
          referenceId: `pkg${i}`,
          body: {
            zkmulti__Shipment__c: `@{${shipRef}.id}`,
            zkmulti__Weight__c: g.weight,
            zkmulti__Weight_Units__c: "lbs",
          },
        });
      }
    });

    const resp = await sfFetch(env, `/services/data/${v}/composite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allOrNone: true, compositeRequest }),
    });
    const data = await resp.json();

    const subResults = Array.isArray(data.compositeResponse) ? data.compositeResponse : [];
    const codeOf = (r) => {
      const b = r && r.body;
      if (Array.isArray(b) && b[0]) return b[0].errorCode || "";
      if (b && b.errorCode) return b.errorCode;
      return "";
    };
    const isErr = (r) => r.httpStatusCode < 200 || r.httpStatusCode >= 300;
    const errored = subResults.filter(isErr);
    const realFailure = errored.find((r) => codeOf(r) !== "PROCESSING_HALTED") || errored[0] || null;

    if (!resp.ok || realFailure) {
      console.error("split: composite failed", resp.status, JSON.stringify(data));
      return Response.json(
        {
          error: "create_failed",
          failedRef: realFailure ? realFailure.referenceId : null,
          detail: realFailure ? realFailure.body : data,
          all: subResults.map((r) => ({ referenceId: r.referenceId, httpStatusCode: r.httpStatusCode, body: r.body })),
        },
        { status: 502 },
      );
    }

    const byRef = (ref) => subResults.find((r) => r.referenceId === ref)?.body?.id ?? null;
    return Response.json(
      {
        ok: true,
        legs: groups.map((_, i) => byRef(`leg${i}`)),
        shipments: groups.map((_, i) => byRef(`ship${i}`)),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
