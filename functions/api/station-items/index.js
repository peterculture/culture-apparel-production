/**
 * GET /api/station-items?station=<name>
 *
 * Returns the schedule for the requested station: every Pre-Production Item of
 * that station's Type__c that isn't done yet, each with its Order details for
 * the worker to read. Read-only: one SELECT, nothing else.
 *
 * The station name selects a fixed server-side config (Type + field list); the
 * browser can't inject SOQL. Access is open (no login) — the real perimeter is
 * Cloudflare Access in front of /api/*.
 */
import { jsonError } from "../_sf.js";
import { runQueryOptionalField } from "../_placements.js";
import { STATION_CONFIG, normalizeSubStatus } from "../_station.js";
import { fetchMockupsByOpportunity } from "../_mockup.js";

// The one entry in STATION_CONFIG's selectFields that may not exist in every
// org. OPTIONAL_FIELD is the exact string to drop from the SELECT list;
// OPTIONAL_FIELD_NAME is what Salesforce names in "No such column '...'", so
// it's what runQueryOptionalField matches the failure against.
const OPTIONAL_FIELD = "Production_Method__r.Placement__c";
const OPTIONAL_FIELD_NAME = "Placement__c";

export async function onRequestGet({ env, request }) {
  try {
    const station = (new URL(request.url).searchParams.get("station") || "").toLowerCase();

    const cfg = STATION_CONFIG[station];
    if (!cfg || !cfg.selectFields) return jsonError("station_not_configured", 400);

    // Production_Method__r.Placement__c is in the ink/screen/transfer station
    // field lists but is NOT deployed in every org -- and a missing or
    // FLS-hidden field doesn't come back blank, it makes the whole SELECT a
    // parse error, so the station board goes to zero rows and looks broken
    // rather than just losing one column. Same guard, same reason, as the
    // Print_Location__c one in _placements.js; build the query both ways and
    // let runQueryOptionalField drop the field only if the org names it.
    const buildSoql = (withPlacement) => {
      const fields = withPlacement
        ? cfg.selectFields
        : cfg.selectFields.filter((f) => f !== OPTIONAL_FIELD);
      return (
        `SELECT ${fields.join(", ")} ` +
        `FROM Pre_Production_Item__c ` +
        `WHERE Type__c = '${cfg.type}' AND Status__c != '${cfg.doneStatus}' ` +
        `ORDER BY ${cfg.orderBy}`
      );
    };

    // Not scoped to one order/method -- this is every not-done item of one
    // type across the whole shop, so of everything in this app it's one of
    // the more realistic candidates to eventually grow past one query batch.
    // runQuery follows Salesforce's nextRecordsUrl pagination -- see _sf.js.
    const { ok, status, records } = await runQueryOptionalField(
      env,
      buildSoql,
      OPTIONAL_FIELD_NAME,
    );
    if (!ok) {
      console.error("station-items query failed", status);
      return jsonError("query_failed", status);
    }

    // Map any pre-rename sub-status value onto its current equivalent before
    // the board sees it, so a stale row still lands on a real stage instead of
    // rendering as an unreachable card. No-op for values already current --
    // see normalizeSubStatus/LEGACY_SUBSTATUS in _station.js.
    if (cfg.subStatusField) {
      records.forEach((r) => {
        const cur = r[cfg.subStatusField];
        const next = normalizeSubStatus(cfg.subStatusField, cur);
        if (next !== cur) r[cfg.subStatusField] = next;
      });
    }

    const oppIds = records
      .map((r) => r.Production_Method__r && r.Production_Method__r.Order__r && r.Production_Method__r.Order__r.OpportunityId)
      .filter(Boolean);
    if (oppIds.length) {
      const mockups = await fetchMockupsByOpportunity(env, oppIds);
      records.forEach((r) => {
        const order = r.Production_Method__r && r.Production_Method__r.Order__r;
        if (order) order.DesignMockupUrl = mockups.get(order.OpportunityId) || null;
      });
    }

    return Response.json(
      { totalSize: records.length, done: true, records },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
