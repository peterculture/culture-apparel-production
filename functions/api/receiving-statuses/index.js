/**
 * GET /api/receiving-statuses
 *
 * Which garment count-in statuses may this deployment offer RIGHT NOW, against
 * whichever org the runtime KV switch is currently pointed at.
 *
 *   -> { statuses: [...canonical...], supported: [...], optional: [...],
 *        known: true|false }
 *
 * WHY A WHOLE ENDPOINT FOR ONE PICKLIST. `Receiving_Status__c` is a RESTRICTED
 * picklist and one deployment serves three orgs at once, so the boards cannot
 * simply render a hardcoded list: offering a chip the active org does not have
 * produces INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST on tap, which reads to a
 * worker as "the tablet is broken". "Received" is exactly that case today --
 * live in dev2 and staging, absent from production until E7.4.
 *
 * `supported` is what the client should render. `statuses` is the full
 * canonical pipeline in delivery order, exposed so a board can tell "this org
 * does not have that value" apart from "that value does not exist at all".
 *
 * ⚠️ `known:false` means the describe could not be read, NOT that nothing is
 * supported -- in that case `supported` falls back to the full canonical list
 * and the write path lets Salesforce speak for itself. See _picklist.js.
 *
 * Read-only and cheap: _picklist.js caches the describe per isolate, so the
 * common case costs no Salesforce call at all. Deliberately NOT folded into
 * /api/orders -- rule #1 is that the board must never go blank, and a describe
 * failure has no business taking the order list down with it.
 */
import { jsonError } from "../_sf.js";
import { STATION_CONFIG } from "../_station.js";
import { activePicklistValues, supportedFrom } from "../_picklist.js";

export async function onRequestGet({ env }) {
  try {
    const cfg = STATION_CONFIG.garment;
    const canonical = cfg.statuses;
    const optional = cfg.optionalStatuses || [];

    const orgValues = await activePicklistValues(
      env,
      "Order",
      cfg.field /* Receiving_Status__c */
    );

    return new Response(
      JSON.stringify({
        statuses: canonical,
        supported: supportedFrom(canonical, optional, orgValues),
        optional,
        known: Array.isArray(orgValues),
      }),
      {
        headers: {
          "content-type": "application/json",
          /* Short browser cache: the boards ask on every mount and this answer
             changes only when somebody edits Setup. */
          "cache-control": "private, max-age=60",
        },
      }
    );
  } catch (e) {
    console.error("[receiving-statuses] failed:", e && e.message);
    return jsonError("receiving_statuses_failed", 502);
  }
}
