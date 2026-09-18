/**
 * /api/shop-floor  —  target model S7 (D29), 2026-09-18.
 *
 * GET  ?station=screen|ink   which physical frames / ink batches exist, and which job is using what
 * POST { station, itemId, valueId|null }   point one Pre-Production Item at a frame or a batch
 *
 * WHY THIS IS ITS OWN ENDPOINT (build rule 3). D29 made `Screen__c` a physical frame and added
 * `Pre_Production_Item__c.Screen__c` / `.Ink_Mix__c`. Those fields exist in dev2 and staging but NOT in
 * production, and one deployment serves all three orgs. Trap 1 says a field the active org lacks is not
 * a blank column — it is a parse error that empties the WHOLE SELECT behind an HTTP 200. So the station
 * board's own query (`_station.js` selectFields, read by station-items) must never name them, and this
 * follow-up answers 200 { available:false } instead. station.html then simply shows no picker, and the
 * screen and ink pipelines carry on exactly as they did before S7.
 *
 * ⛔ Do not "simplify" this by moving these two fields into STATION_CONFIG.selectFields. That is the
 * one change that would take the ink and screen boards to zero rows in an org that is one step behind.
 *
 * The link is deliberately OPTIONAL and blank by default: the shop's frames are not labelled yet
 * (see the production gate in §4 S7), so a job with no frame recorded is the normal case, not an error.
 */
import { jsonError, runQuery, sfFetch, apiVersion } from "../_sf.js";
import { requireCap } from "../_session.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

/**
 * One entry per station that owns a piece of shop-floor kit. `field` is the lookup on
 * Pre_Production_Item__c; `type` is the Type__c value whose jobs may carry it.
 */
const KIND = {
  screen: {
    type: "Screen",
    field: "Screen__c",
    object: "Screen__c",
    // Only frames that are actually usable. A retired or damaged frame stays in the org for its
    // history (Times_Prepped__c etc.) but must never be offered to a worker.
    where: "Frame_Status__c != 'Retired' AND Frame_Status__c != 'Damaged'",
    select: "Id, Name, Mesh_Count__c, Frame_Status__c, Location__c, Label_Printed__c",
    order: "Mesh_Count__c, Name",
    shape: (r) => ({
      id: r.Id,
      name: r.Name,
      match: r.Mesh_Count__c || null, // the job's Mesh_Count__c is matched against this
      detail: r.Mesh_Count__c ? r.Mesh_Count__c + " mesh" : null,
      status: r.Frame_Status__c || null,
      location: r.Location__c || null,
      labelled: !!r.Label_Printed__c,
    }),
  },
  ink: {
    type: "Ink",
    field: "Ink_Mix__c",
    object: "Ink_Mix__c",
    // A batch with nothing left is not an option. Blank means nobody has said how much is left,
    // which is not the same as empty — so blank stays on the list.
    where: "(Amount_Remaining__c = null OR Amount_Remaining__c > 0)",
    select: "Id, Name, Pantone__c, Amount_Remaining__c, Amount_Mixed__c",
    order: "Pantone__c, Name",
    shape: (r) => ({
      id: r.Id,
      name: r.Name,
      match: r.Pantone__c || null, // the job's Pantone_Color__c is matched against this
      detail: r.Pantone__c || null,
      remaining: r.Amount_Remaining__c == null ? null : r.Amount_Remaining__c,
      mixed: r.Amount_Mixed__c == null ? null : r.Amount_Mixed__c,
      labelled: true,
    }),
  },
};

const reply = (body) => Response.json(body, { headers: { "Cache-Control": "no-store" } });
const NONE = { available: false, options: [], byItem: {} };

export async function onRequestGet({ env, request }) {
  try {
    const station = (new URL(request.url).searchParams.get("station") || "").toLowerCase();
    const cfg = KIND[station];
    if (!cfg) return jsonError("station_not_configured", 400);

    // 1. The kit itself. A missing object (production) or FLS-hidden field lands here, and is not an
    //    error as far as the board is concerned — it just means this org has no shop-floor layer yet.
    const kit = await runQuery(
      env,
      `SELECT ${cfg.select} FROM ${cfg.object} WHERE ${cfg.where} ORDER BY ${cfg.order}`,
    );
    if (!kit.ok) {
      console.warn(`[shop-floor] ${cfg.object} not queryable; answering available:false`, kit.status);
      return reply(NONE);
    }

    // 2. Which job is already using which. Separately guarded: if the lookup is missing but the
    //    object is not, the picker is still worth showing — it just starts with nothing selected.
    const byItem = {};
    const used = await runQuery(
      env,
      `SELECT Id, ${cfg.field} FROM Pre_Production_Item__c ` +
        `WHERE Type__c = '${cfg.type}' AND ${cfg.field} != null`,
    );
    if (used.ok) {
      for (const r of used.records) byItem[r.Id] = r[cfg.field];
    } else {
      console.warn(`[shop-floor] Pre_Production_Item__c.${cfg.field} not queryable`, used.status);
      // The lookup is what the POST writes, so without it the picker cannot do anything useful.
      return reply(NONE);
    }

    return reply({ available: true, options: kit.records.map(cfg.shape), byItem });
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}

export async function onRequestPost({ env, request }) {
  // Same capability as the sub-status write next to it: this is a station worker recording what they
  // used, on the same screen, with the same consequences.
  const gate = await requireCap(request, env, "items.status");
  if (gate.denied) return gate.response;
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_body", 400);
    }

    const station = String(body.station || "").toLowerCase();
    const cfg = KIND[station];
    if (!cfg) return jsonError("station_not_configured", 400);

    const itemId = String(body.itemId || "");
    if (!SF_ID.test(itemId)) return jsonError("bad_itemId", 400);

    // null clears the link, which is a normal thing to want: a worker grabbed the wrong frame, or is
    // undoing a mistap. Anything else must be a real Id — never a caller-supplied field name.
    const raw = body.valueId;
    const valueId = raw === null || raw === undefined || raw === "" ? null : String(raw);
    if (valueId !== null && !SF_ID.test(valueId)) return jsonError("bad_valueId", 400);

    const resp = await sfFetch(
      env,
      `/services/data/${apiVersion(env)}/sobjects/Pre_Production_Item__c/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cfg.field]: valueId }),
      },
    );
    if (!resp.ok && resp.status !== 204) {
      let detail = "";
      try {
        detail = JSON.stringify(await resp.json());
      } catch {
        /* empty body */
      }
      // An org without the field answers INVALID_FIELD here. Report it as "this org has no shop-floor
      // layer" rather than a failure the worker can do anything about.
      console.error("[shop-floor] link write failed", resp.status, detail);
      if (/INVALID_FIELD|No such column/i.test(detail)) return jsonError("not_available", 409);
      return jsonError("update_failed", resp.status);
    }

    return reply({ ok: true, itemId, valueId });
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
