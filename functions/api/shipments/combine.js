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
 * This used to run as ONE Composite request with allOrNone:true, which is the
 * nicest shape available because Salesforce makes it atomic for free. But
 * /composite caps at 25 sub-requests and this array is 2N+2 -- one leg and one
 * Order PATCH per selected order, plus the shipment and its package. Twelve
 * orders is 26, and Salesforce rejects the ENTIRE request rather than the
 * overflow. The ceiling was never checked, so a manager combining a dozen
 * orders got a bare failure naming nothing they had done. (E5.10.)
 *
 * It now runs in three phases -- see ../_composite.js for the full reasoning:
 *
 *   HEAD  the legs, which the shipment references by @{legN.id}
 *   MID   the shipment + its package, 2 sub-requests, always one call
 *   TAIL  the Order PATCHes, chunked freely against real Ids
 *
 * Only the head must fit in one call, so the real limit went from 12 orders to
 * 25 -- and 25 orders in one physical box is a different conversation.
 *
 * Chunking costs the free atomicity, so a failure rolls back: the package,
 * shipment and legs this request created are deleted, and every order in the
 * group is PATCHed back to the Is_Master_Shipment_Order__c /
 * Master_Shipment_Order__c values captured BEFORE the write. Restoring an order
 * that was never reached is a no-op, which is why all of them are restored
 * rather than only the ones a partial chunk touched -- there is no reliable way
 * to know which PATCHes landed, and an idempotent restore does not need to.
 *
 * Body:
 *   {
 *     orderIds: ["<Order Id>", ...],      // 2+ orders, including primaryOrderId
 *     primaryOrderId: "<Order Id>",       // must be one of orderIds
 *     carrier, serviceType, tracking, weight
 *   }
 */
import { apiVersion, jsonError, runQuery } from "../_sf.js";
import { runComposite, runChunked, rollbackCreated, COMPOSITE_LIMIT } from "../_composite.js";
import { requireCap } from "../_session.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

const ORDER_FIELDS = [
  "Id",
  "OrderNumber",
  "GOA_Order_Number__c",
  "ShippingAddress",
  // Read only to capture the pre-write state for rollback. Safe to name:
  // shipping-orders/index.js already SELECTs both against every org, so
  // they are known visible to the integration profile (trap 1).
  "Is_Master_Shipment_Order__c",
  "Master_Shipment_Order__c",
];

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

    // Pre-write state, captured before anything is touched, so a failed tail
    // can put every order back exactly as it was.
    const priorOrderState = orderIds.map((id) => {
      const o = orderById.get(id) || {};
      return {
        id,
        Is_Master_Shipment_Order__c: o.Is_Master_Shipment_Order__c === true,
        Master_Shipment_Order__c: o.Master_Shipment_Order__c || null,
      };
    });

    // Newest first, so a rollback deletes children before their parents.
    const created = [];
    const bail = async (detail, failedRef) => {
      await rollbackCreated(env, created, "combine");
      const restore = priorOrderState.map((p, i) => ({
        method: "PATCH",
        url: `${base}/Order/${p.id}`,
        referenceId: `restore${i}`,
        body: {
          Is_Master_Shipment_Order__c: p.Is_Master_Shipment_Order__c,
          Master_Shipment_Order__c: p.Master_Shipment_Order__c,
        },
      }));
      const restoreRes = await runChunked(env, restore, { label: "combine restore", refPrefix: "r" });
      if (!restoreRes.ok) {
        console.error("combine rollback: order restore failed, clean up by hand", orderIds.join(","), restoreRes.detail);
      }
      return Response.json(
        {
          error: "create_failed",
          failedRef: failedRef || null,
          detail,
          rolledBack: created.length,
          restoreOk: restoreRes.ok,
        },
        { status: 502 },
      );
    };

    // --- HEAD: one leg per order. The shipment references one of these. ---
    if (orderIds.length > COMPOSITE_LIMIT) {
      // 25 separate orders in one physical box. Fail loudly rather than
      // half-build -- this is an upstream problem, not a request to chunk.
      return Response.json(
        { error: "too_many_orders", detail: `${orderIds.length} orders exceeds the composite ceiling of ${COMPOSITE_LIMIT}` },
        { status: 400 },
      );
    }

    const legReq = orderIds.map((orderId, i) => {
      const o = orderById.get(orderId);
      const label = o.GOA_Order_Number__c || o.OrderNumber || orderId;
      const isPrimary = orderId === primaryOrderId;
      return {
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
      };
    });
    const legRes = await runComposite(env, legReq, "combine legs");
    if (!legRes.ok) return bail(legRes.detail, legRes.failedRef);
    const legIds = orderIds.map((_, i) => legRes.ids[`leg${i}`]);
    legIds.forEach((id) => created.unshift({ object: "Shipment_Order__c", id }));

    // --- MID: the shipment and its package. Two sub-requests, always one
    // call, so the package can still reference @{combinedShip.id} natively. ---
    const primaryIdx = orderIds.indexOf(primaryOrderId);
    const midReq = [
      {
        method: "POST",
        url: `${base}/zkmulti__MCShipment__c`,
        referenceId: "combinedShip",
        body: {
          Order__c: primaryOrderId,
          Shipment_Order__c: legIds[primaryIdx],
          zkmulti__Carrier__c: carrier,
          zkmulti__Service_Type_Name__c: serviceType || null,
          zkmulti__Tracking_Number__c: tracking,
          zkmulti__Ship_Date__c: today,
        },
      },
    ];
    if (weight != null) {
      midReq.push({
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
    const midRes = await runComposite(env, midReq, "combine shipment");
    if (!midRes.ok) return bail(midRes.detail, midRes.failedRef);
    const shipmentId = midRes.ids.combinedShip || null;
    // Shipment first, THEN package -- unshift reverses, so this leaves the
    // package ahead of its own parent shipment in the delete order.
    if (shipmentId) created.unshift({ object: "zkmulti__MCShipment__c", id: shipmentId });
    if (midRes.ids.combinedPkg) created.unshift({ object: "zkmulti__MCPackage__c", id: midRes.ids.combinedPkg });

    // --- TAIL: the Order flags. Real Ids only, so chunk freely. ---
    const tail = orderIds.map((orderId, i) => {
      const isPrimary = orderId === primaryOrderId;
      return {
        method: "PATCH",
        url: `${base}/Order/${orderId}`,
        referenceId: `orderPatch${i}`,
        body: isPrimary
          ? { Is_Master_Shipment_Order__c: true, Master_Shipment_Order__c: null }
          : { Is_Master_Shipment_Order__c: false, Master_Shipment_Order__c: primaryOrderId },
      };
    });
    const tailRes = await runChunked(env, tail, { label: "combine tail", refPrefix: "t" });
    if (!tailRes.ok) return bail(tailRes.detail, tailRes.failedRef);

    return Response.json(
      {
        ok: true,
        legs: legIds,
        shipmentId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
