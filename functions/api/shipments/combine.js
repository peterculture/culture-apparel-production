/**
 * POST /api/shipments/combine
 *
 * Combines two or more orders into ONE physical shipment -- the
 * Shipment_Order__c junction object's combine-ship use case (see ../split.js
 * for the split-ship half of this same object, and the header comment in
 * ../../shipping-orders/index.js for the pre-existing, order-level "combined
 * shipment" fields this endpoint also writes).
 *
 * One order is designated PRIMARY (its address/contact is what the box
 * actually ships to; every other selected order is SECONDARY, riding along
 * inside the same box for reporting/visibility purposes but without its own
 * separate shipment record). This mirrors the object's own Order_Type__c
 * picklist, which -- confirmed via Setup, 2026-08-10 -- has exactly two
 * values, "Primary" and "Secondary", and nothing else. That field has sat
 * unused since Peter Larson created it 2/25/2025 (no records, no
 * automation, no validation rules on the object at all); this endpoint is
 * the first thing to actually write to it.
 *
 * For the whole group:
 *   1. Create ONE Shipment_Order__c leg per selected order (Primary or
 *      Secondary per Order_Type__c), each stamped with the SAME Ship_Date__c
 *      and the SAME shipping address -- copied from the Primary order's own
 *      ShippingAddress, broken out into the object's flat
 *      Shipping_Address__c/Address_2__c/City__c/State__c/Postal_Code__c/
 *      Country__c fields (Shipment_Order__c has no compound address field
 *      of its own).
 *   2. Create ONE zkmulti__MCShipment__c (the real tracking number/carrier)
 *      linked to the PRIMARY order's leg only -- Secondary legs exist to
 *      link their own order into the group for reporting, not to hold a
 *      second copy of the same shipment.
 *   3. PATCH every selected Order's existing Is_Master_Shipment_Order__c /
 *      Master_Shipment_Order__c fields (already read + displayed by
 *      shipping.html's drawer today, just never written by this app before
 *      now) so the "Combined shipment" banner shows correctly for every
 *      order in the group without shipping.html needing any new display
 *      logic.
 *
 * Everything runs in ONE Composite request, allOrNone: true (same pattern
 * as ../split.js and ../../orders/[id]/reprint.js).
 *
 * Body:
 *   {
 *     orderIds: ["<Order Id>", ...],      // 2+ orders, including primaryOrderId
 *     primaryOrderId: "<Order Id>",       // must be one of orderIds
 *     carrier, serviceType, tracking, weight
 *   }
 */
import { sfFetch, apiVersion, jsonError, runQuery } from "../_sf.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

const ORDER_FIELDS = ["Id", "OrderNumber", "GOA_Order_Number__c", "ShippingAddress"];

export async function onRequestPost({ env, request }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_json", 400);
    }
    if (!body || typeof body !== "object") return jsonError("invalid_body", 400);

    const orderIds = Array.isArray(body.orderIds) ? [...new Set(body.orderIds.filter((id) => SF_ID.test(id)))] : [];
    const primaryOrderId = body.primaryOrderId || "";
    if (orderIds.length < 2) return jsonError("need_at_least_two_orders", 400);
    if (!SF_ID.test(primaryOrderId) || !orderIds.includes(primaryOrderId)) {
      return jsonError("bad_primary_order", 400);
    }

    const carrier = (body.carrier || "").toString().trim();
    const serviceType = (body.serviceType || "").toString().trim();
    const tracking = (body.tracking || "").toString().trim();
    if (!carrier) return jsonError("missing_carrier", 400);
    if (!tracking) return jsonError("missing_tracking_number", 400);
    const weightNum = Number(body.weight);
    const weight = Number.isFinite(weightNum) && weightNum > 0 ? weightNum : null;

    const quotedIds = orderIds.map((id) => `'${id}'`).join(",");
    const orderSoql = `SELECT ${ORDER_FIELDS.join(", ")} FROM Order WHERE Id IN (${quotedIds})`;
    const orderResult = await runQuery(env, orderSoql);
    if (!orderResult.ok) {
      console.error("combine: order fetch failed", orderResult.status);
      return jsonError("order_fetch_failed", orderResult.status);
    }
    if (orderResult.records.length !== orderIds.length) {
      return jsonError("order_not_found", 404);
    }
    const orderById = new Map(orderResult.records.map((o) => [o.Id, o]));
    const primary = orderById.get(primaryOrderId);
    const primaryLabel = primary.GOA_Order_Number__c || primary.OrderNumber || primaryOrderId;
    const addr = primary.ShippingAddress || {};

    const v = apiVersion(env);
    const base = `/services/data/${v}/sobjects`;
    const today = new Date().toISOString().slice(0, 10);
    const compositeRequest = [];

    orderIds.forEach((orderId, i) => {
      const o = orderById.get(orderId);
      const label = o.GOA_Order_Number__c || o.OrderNumber || orderId;
      const isPrimary = orderId === primaryOrderId;
      compositeRequest.push({
        method: "POST",
        url: `${base}/Shipment_Order__c`,
        referenceId: `leg${i}`,
        body: {
          Name__c: `Combined w/ ${primaryLabel} - ${label}`,
          Order__c: orderId,
          Order_Type__c: isPrimary ? "Primary" : "Secondary",
          Ship_Date__c: today,
          Shipping_Address__c: addr.street || null,
          Shipping_City__c: addr.city || null,
          Shipping_State__c: addr.state || null,
          Shipping_Postal_Code__c: addr.postalCode || null,
          Shipping_Country__c: addr.country || null,
        },
      });
    });

    const primaryIdx = orderIds.indexOf(primaryOrderId);
    compositeRequest.push({
      method: "POST",
      url: `${base}/zkmulti__MCShipment__c`,
      referenceId: "combinedShip",
      body: {
        Order__c: primaryOrderId,
        Shipment_Order__c: `@{leg${primaryIdx}.id}`,
        zkmulti__Carrier__c: carrier,
        zkmulti__Service_Type_Name__c: serviceType || null,
        zkmulti__Tracking_Number__c: tracking,
        zkmulti__Ship_Date__c: today,
      },
    });

    if (weight != null) {
      compositeRequest.push({
        method: "POST",
        url: `${base}/zkmulti__MCPackage__c`,
        referenceId: "combinedPkg",
        body: {
          zkmulti__Shipment__c: "@{combinedShip.id}",
          zkmulti__Weight__c: weight,
          zkmulti__Weight_Units__c: "lbs",
        },
      });
    }

    orderIds.forEach((orderId, i) => {
      const isPrimary = orderId === primaryOrderId;
      compositeRequest.push({
        method: "PATCH",
        url: `${base}/Order/${orderId}`,
        referenceId: `orderPatch${i}`,
        body: isPrimary
          ? { Is_Master_Shipment_Order__c: true, Master_Shipment_Order__c: null }
          : { Is_Master_Shipment_Order__c: false, Master_Shipment_Order__c: primaryOrderId },
      });
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
      console.error("combine: composite failed", resp.status, JSON.stringify(data));
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
        legs: orderIds.map((_, i) => byRef(`leg${i}`)),
        shipmentId: byRef("combinedShip"),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
