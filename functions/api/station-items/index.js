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
import { runQuery, jsonError } from "../_sf.js";
import { STATION_CONFIG, normalizeSubStatus } from "../_station.js";
import { fetchMockupsByOpportunity } from "../_mockup.js";

export async function onRequestGet({ env, request }) {
  try {
    const station = (new URL(request.url).searchParams.get("station") || "").toLowerCase();

    const cfg = STATION_CONFIG[station];
    if (!cfg || !cfg.selectFields) return jsonError("station_not_configured", 400);

    const soql =
      `SELECT ${cfg.selectFields.join(", ")} ` +
      `FROM Pre_Production_Item__c ` +
      `WHERE Type__c = '${cfg.type}' AND Status__c != '${cfg.doneStatus}' ` +
      `ORDER BY ${cfg.orderBy}`;

    // Not scoped to one order/method -- this is every not-done item of one
    // type across the whole shop, so of everything in this app it's one of
    // the more realistic candidates to eventually grow past one query batch.
    // runQuery follows Salesforce's nextRecordsUrl pagination -- see _sf.js.
    const { ok, status, records } = await runQuery(env, soql);
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
