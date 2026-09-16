/**
 * GET  /api/shipments?orderId=<Order Id>
 *   Lists shipments logged against one order. Backed by the Zenkraft
 *   Multi-Carrier Shipping managed package's `zkmulti__MCShipment__c`
 *   object -- the same object behind the "Shipments" related list on the
 *   Order page in Salesforce. Real label purchase happens through
 *   Zenkraft's own Shipment Wizard (calls FedEx/UPS/USPS APIs and spends
 *   real money) -- this endpoint does NOT do that. It only logs the
 *   reference info (carrier, service, tracking number, weight) for a
 *   shipment *after* the real label has already been bought, either
 *   through the Zenkraft wizard (linked from the app) or elsewhere.
 *
 *   Weight lives on a child `zkmulti__MCPackage__c` record
 *   (`zkmulti__Shipment__c` lookup back to the shipment) in Zenkraft's
 *   data model, not on the shipment itself, so this handler runs a second
 *   query and merges each shipment's package weights in before returning.
 *
 *   ONE SHIPMENT CAN HAVE MANY PACKAGES. This endpoint used to keep the
 *   first package per shipment and drop the rest, so a three-box shipment
 *   reported one box's weight as the shipment's weight -- a number that
 *   looks perfectly reasonable and is simply wrong. THIS app only ever
 *   creates one package per shipment (see POST below, and split.js /
 *   combine.js), which is why it went unnoticed; the multi-box shipments
 *   come from Zenkraft's own wizard, writing straight into Salesforce,
 *   and those are exactly the ones the boards poll for afterwards.
 *   ../shipments/[id].js already loops over every package when deleting,
 *   so the data model was never in doubt -- only this read.
 *
 *   Each shipment therefore comes back with:
 *     Packages          every package: { Id, Weight, WeightUnits }
 *     PackageCount      how many
 *     Weight            the SUM across packages (null if none carry one)
 *     WeightUnits       the shared unit
 *     MixedWeightUnits  true when packages disagree on units, in which
 *                       case Weight is null rather than a fabricated total
 *   For the one-package case -- everything this app creates -- Weight and
 *   WeightUnits are exactly what they were before.
 *
 * POST /api/shipments
 *   Logs one shipment: creates a zkmulti__MCShipment__c row, then (if a
 *   weight was given) a linked zkmulti__MCPackage__c row underneath it.
 *   Body: { orderId, Carrier, ServiceType, TrackingNumber, Weight }
 */
import { sfFetch, apiVersion, jsonError, runQuery, runChunkedIdQuery } from "../_sf.js";
import { requireCap } from "../_session.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

const SHIPMENT_FIELDS = [
  "Id",
  "Name",
  "zkmulti__Carrier__c",
  "zkmulti__Service_Type_Name__c",
  "zkmulti__Tracking_Number__c",
  "zkmulti__Ship_Date__c",
  "CreatedDate",
];

/**
 * Total one shipment's packages.
 *
 * Adding weights only means anything when the packages agree on units, and
 * Zenkraft's wizard is perfectly capable of writing a mix. Adding 2 lb to
 * 3 kg gives 5 of nothing, so mixed units return a null total and say so --
 * a consumer can then show the per-package list, which is why Packages is
 * returned alongside. Refusing to answer is the correct answer here; a
 * plausible wrong number on a shipping screen is how a box gets underpaid.
 *
 * A package with no weight is skipped rather than counted as zero: "two
 * boxes, one weighed" is 6 lb of known weight, not a 6 lb shipment. The
 * unit still comes back if any package names one.
 */
function totalPackageWeight(packages) {
  let total = 0;
  let weighed = 0;
  let units = null;
  let mixed = false;

  for (const p of packages) {
    const u = p.WeightUnits ? String(p.WeightUnits).trim() : "";
    if (u) {
      if (units === null) units = u;
      else if (u.toLowerCase() !== units.toLowerCase()) mixed = true;
    }
    const n = Number(p.Weight);
    if (p.Weight === null || p.Weight === undefined || p.Weight === "" || !Number.isFinite(n)) continue;
    total += n;
    weighed++;
  }

  if (mixed) return { weight: null, units: null, mixed: true };
  if (!weighed) return { weight: null, units, mixed: false };
  // Float addition: 1.1 + 2.2 is 3.3000000000000003, and that reaches a
  // screen verbatim. Six decimals is far past any scale in the shop.
  return { weight: Math.round(total * 1e6) / 1e6, units, mixed: false };
}

export async function onRequestGet({ env, request }) {
  try {
    const orderId = new URL(request.url).searchParams.get("orderId") || "";
    if (!SF_ID.test(orderId)) return jsonError("invalid_order_id", 400);

    const soql =
      `SELECT ${SHIPMENT_FIELDS.join(", ")} FROM zkmulti__MCShipment__c ` +
      `WHERE Order__c = '${orderId}' ORDER BY CreatedDate DESC`;

    // Naturally small (one order's own shipments), but runQuery is used
    // everywhere a query runs now for consistency -- see _sf.js.
    const shipResult = await runQuery(env, soql);
    if (!shipResult.ok) {
      console.error("Shipment query failed", shipResult.status);
      return jsonError("query_failed", shipResult.status);
    }

    const shipments = shipResult.records;
    if (shipments.length) {
      // Chunked at 200 Ids. One order's shipments is normally a handful, but
      // a split-heavy order has no ceiling and the failure mode is silent:
      // past 200 the IN list is a parse error, so every weight reads null.
      const pkgResult = await runChunkedIdQuery(
        shipments.map((s) => s.Id),
        (quoted) =>
          runQuery(
            env,
            `SELECT Id, zkmulti__Shipment__c, zkmulti__Weight__c, zkmulti__Weight_Units__c ` +
              `FROM zkmulti__MCPackage__c WHERE zkmulti__Shipment__c IN (${quoted})`,
          ),
      );
      if (pkgResult.ok) {
        /* EVERY package, not the first one. The old code set the map entry
           only when the key was absent, which silently kept box 1 of 3. */
        const byShipment = new Map();
        pkgResult.records.forEach((p) => {
          const arr = byShipment.get(p.zkmulti__Shipment__c);
          if (arr) arr.push(p);
          else byShipment.set(p.zkmulti__Shipment__c, [p]);
        });
        shipments.forEach((s) => {
          /* Renamed out of the zkmulti__ namespace on the way out, matching
             how Weight/WeightUnits have always been presented on the
             shipment itself -- the managed-package prefix is an
             implementation detail of where the data lives. */
          s.Packages = (byShipment.get(s.Id) || []).map((p) => ({
            Id: p.Id,
            Weight: p.zkmulti__Weight__c === undefined ? null : p.zkmulti__Weight__c,
            WeightUnits: p.zkmulti__Weight_Units__c || null,
          }));
          s.PackageCount = s.Packages.length;
          const total = totalPackageWeight(s.Packages);
          s.Weight = total.weight;
          s.WeightUnits = total.units;
          s.MixedWeightUnits = total.mixed;
        });
      }
    }

    return Response.json(
      { totalSize: shipments.length, done: true, records: shipments },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}

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

    const carrier = (body.Carrier || "").toString().trim();
    const serviceType = (body.ServiceType || "").toString().trim();
    const trackingNumber = (body.TrackingNumber || "").toString().trim();
    if (!carrier) return jsonError("missing_carrier", 400);
    if (!trackingNumber) return jsonError("missing_tracking_number", 400);

    const shipPayload = {
      Order__c: orderId,
      zkmulti__Carrier__c: carrier,
      zkmulti__Service_Type_Name__c: serviceType || null,
      zkmulti__Tracking_Number__c: trackingNumber,
      zkmulti__Ship_Date__c: new Date().toISOString().slice(0, 10),
    };

    const shipPath = `/services/data/${apiVersion(env)}/sobjects/zkmulti__MCShipment__c`;
    const shipResp = await sfFetch(env, shipPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shipPayload),
    });
    const shipData = await shipResp.json().catch(() => null);
    if (!shipResp.ok || !shipData || shipData.success === false) {
      console.error("Shipment create failed", shipResp.status, JSON.stringify(shipData));
      return jsonError("create_failed", shipResp.status || 502);
    }
    const shipmentId = shipData.id;

    const weight = Number(body.Weight);
    if (Number.isFinite(weight) && weight > 0) {
      const pkgPath = `/services/data/${apiVersion(env)}/sobjects/zkmulti__MCPackage__c`;
      const pkgResp = await sfFetch(env, pkgPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zkmulti__Shipment__c: shipmentId,
          zkmulti__Weight__c: weight,
          zkmulti__Weight_Units__c: "lbs",
        }),
      });
      if (!pkgResp.ok) {
        const detail = await pkgResp.text();
        // The shipment itself was created fine -- log the package failure but
        // don't fail the whole request over it, the weight just won't show.
        console.error("Package create failed", pkgResp.status, detail);
      }
    }

    return Response.json(
      { ok: true, id: shipmentId },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
