/**
 * GET /api/art-specs?orderId=<Order Id>
 *
 * Target model S5 (D18, D23), 2026-09-17. The print recipe ("Art Spec") for each decoration on one
 * order, so pre-production.html and order-sheet.html can show ink colours, colour order, dryer
 * settings and the rest without touching their own queries.
 *
 * Build rule 3: this is a FOLLOW-UP endpoint. No board's main SELECT names Art_Spec__c. When the
 * active org has no Art Spec layer (production today), or a field is FLS-hidden, it answers
 * 200 { available:false } and the pages simply show nothing extra.
 *
 * Where the link lives, in order of preference:
 *   1. Decoration_Placement__c.Art_Spec__c  one spec per decoration per location (D23)
 *   2. Decoration__c.Art_Spec__c            a spec set on the whole decoration (used by S3's
 *                                           hand-made samples); shown when no location has one
 *   3. Pre_Production_Item__c.Art_Spec__c   per item (D18), returned as byItem
 *
 * Response:
 *   {
 *     available: true,
 *     specs:        { <specId>: { id, name, method, placement, inkColors, ... } },
 *     byDecoration: { <decorationId>: [ { placement, specId } ] },   // location order as stored
 *     byItem:       { <itemId>: <specId> },                          // {} when that link is missing
 *     itemsAvailable: true|false
 *   }
 *
 * ⛔ Trap 12: Pre_Production_Item__c.Production_Method__c is a FIELD that was never renamed, and
 * its relationship is still Production_Method__r. Decoration__c is the object.
 */
import { jsonError, runQuery, soqlQuoteList } from "../_sf.js";

// Every Art_Spec__c print fact the pages may show. Kept in one list so the two pages agree.
const SPEC_FIELDS = [
  "Id",
  "Name",
  "Decoration_Method__c",
  "Method__r.Name",
  "Placement__r.Name",
  "Ink_Colors__c",
  "Print_Color_Order__c",
  "Mesh_Counts__c",
  "Ink_Type__c",
  "Flash_Notes__c",
  "Dryer_Settings__c",
  "Thread_Colors__c",
  "Stitch_Count__c",
  "Transfer_Type__c",
  "Press_Temperature_F__c",
  "Press_Time_Seconds__c",
  "Press_Pressure__c",
  "Print_Specifications__c",
  "Size_Location__c",
  "Notes__c",
];

function isSfId(s) {
  return typeof s === "string" && /^[a-zA-Z0-9]{15,18}$/.test(s);
}

const NONE = { available: false, specs: {}, byDecoration: {}, byItem: {}, itemsAvailable: false };

function reply(body) {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

function shapeSpec(s) {
  return {
    id: s.Id,
    name: s.Name,
    method: (s.Method__r && s.Method__r.Name) || s.Decoration_Method__c || null,
    placement: (s.Placement__r && s.Placement__r.Name) || null,
    inkColors: s.Ink_Colors__c || null,
    colorOrder: s.Print_Color_Order__c || null,
    meshCounts: s.Mesh_Counts__c || null,
    inkType: s.Ink_Type__c || null,
    flashNotes: s.Flash_Notes__c || null,
    dryerSettings: s.Dryer_Settings__c || null,
    threadColors: s.Thread_Colors__c || null,
    stitchCount: s.Stitch_Count__c == null ? null : s.Stitch_Count__c,
    transferType: s.Transfer_Type__c || null,
    pressTempF: s.Press_Temperature_F__c == null ? null : s.Press_Temperature_F__c,
    pressSeconds: s.Press_Time_Seconds__c == null ? null : s.Press_Time_Seconds__c,
    pressPressure: s.Press_Pressure__c || null,
    printSpecs: s.Print_Specifications__c || null,
    sizeLocation: s.Size_Location__c || null,
    notes: s.Notes__c || null,
  };
}

export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const orderId = (url.searchParams.get("orderId") || "").trim();
    if (!isSfId(orderId)) return jsonError("bad_orderId", 400);

    // 1 + 2: the location rows and the decoration-level link, in one query each.
    const rowsRes = await runQuery(
      env,
      `SELECT Decoration__c, Placement__r.Name, Art_Spec__c FROM Decoration_Placement__c ` +
        `WHERE Decoration__r.Order__c = '${orderId}' ORDER BY Decoration__c, Placement__r.Name`,
    );
    if (!rowsRes.ok) {
      // Missing object/field (production) or FLS: not an error for the page.
      console.warn("[art-specs] location rows not queryable; answering available:false", rowsRes.status);
      return reply(NONE);
    }
    const decRes = await runQuery(
      env,
      `SELECT Id, Art_Spec__c FROM Decoration__c WHERE Order__c = '${orderId}' AND Art_Spec__c != null`,
    );
    if (!decRes.ok) {
      console.warn("[art-specs] Decoration__c.Art_Spec__c not queryable; answering available:false", decRes.status);
      return reply(NONE);
    }

    // 3: per item. Optional on its own -- losing it must not hide the rest.
    const itemRes = await runQuery(
      env,
      `SELECT Id, Art_Spec__c FROM Pre_Production_Item__c ` +
        `WHERE Production_Method__r.Order__c = '${orderId}' AND Art_Spec__c != null`,
    );
    if (!itemRes.ok) console.warn("[art-specs] Pre_Production_Item__c.Art_Spec__c not queryable", itemRes.status);

    const byDecoration = {};
    const specIds = new Set();
    for (const r of rowsRes.records) {
      (byDecoration[r.Decoration__c] = byDecoration[r.Decoration__c] || []).push({
        placement: (r.Placement__r && r.Placement__r.Name) || null,
        specId: r.Art_Spec__c || null,
      });
      if (r.Art_Spec__c) specIds.add(r.Art_Spec__c);
    }
    // A decoration-level spec fills in only where no location row names a spec.
    for (const d of decRes.records) {
      const rows = byDecoration[d.Id] || [];
      if (!rows.some((x) => x.specId)) {
        byDecoration[d.Id] = [{ placement: null, specId: d.Art_Spec__c }];
        specIds.add(d.Art_Spec__c);
      }
    }
    const byItem = {};
    if (itemRes.ok) {
      for (const it of itemRes.records) {
        byItem[it.Id] = it.Art_Spec__c;
        specIds.add(it.Art_Spec__c);
      }
    }

    const specs = {};
    if (specIds.size) {
      const specRes = await runQuery(
        env,
        `SELECT ${SPEC_FIELDS.join(", ")} FROM Art_Spec__c WHERE Id IN (${soqlQuoteList([...specIds])})`,
      );
      if (!specRes.ok) {
        console.warn("[art-specs] Art_Spec__c fields not queryable; answering available:false", specRes.status);
        return reply(NONE);
      }
      for (const s of specRes.records) specs[s.Id] = shapeSpec(s);
    }

    return reply({ available: true, specs, byDecoration, byItem, itemsAvailable: itemRes.ok });
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
