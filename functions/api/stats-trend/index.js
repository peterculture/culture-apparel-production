/**
 * GET /api/stats-trend
 *
 * Powers the day-over-day trend chart on the Stats page (stats.html).
 * Per Anthony (2026-08-11): ship real history now rather than waiting on
 * point-in-time metrics (prep-time buffer, current pipeline size) to
 * accumulate their own history from a new snapshot system that doesn't
 * exist yet. Both series here are reconstructed from Salesforce's own
 * existing date fields, so there's a full 7 days of real data from the
 * very first load -- nothing to wait on.
 *
 *   - New orders per day: Order.CreatedDate, last 7 days.
 *   - Completed/shipped per day: Order.LastModifiedDate on rows where
 *     Status = 'Complete', last 7 days. There's no dedicated
 *     Shipped_Date__c/Completed_Date__c field on Order today, so
 *     LastModifiedDate is a proxy for "when this was marked complete" --
 *     approximate for any order edited again *after* being completed
 *     (e.g. a note added later), but it's the closest real signal
 *     available without a schema change. Same convention the long-standing
 *     (but previously hardcoded) "Shipped - 7d" KPI on index.html was
 *     always meant to reflect.
 *
 * Both queries use SOQL's LAST_N_DAYS:n date literal (org-timezone based,
 * same as every other "today" boundary in this app being an approximation
 * across timezones) rather than hand-computing date bounds.
 *
 * WEEKDAYS ONLY (added 2026-08-11): the shop doesn't run Saturday/Sunday,
 * so the chart shows the last 7 WEEKDAYS, not the last 7 calendar days --
 * otherwise two of the seven bars would always read zero and the "week"
 * would only really cover 5 working days of signal. QUERY_WINDOW_DAYS pulls
 * a wider calendar window than DAYS so there's always enough history behind
 * it to find 7 real weekdays no matter where today falls in the week (worst
 * case -- today just past a weekend -- 7 weekdays can span up to 11
 * calendar days).
 */
import { runQuery, jsonError } from "../_sf.js";

const DAYS = 7;
const QUERY_WINDOW_DAYS = 14;

function dateKey(iso) {
  // Salesforce datetimes come back "YYYY-MM-DDTHH:MM:SS.sss+0000" -- the
  // first 10 characters are always the org-local calendar date.
  return String(iso).slice(0, 10);
}

// Last `n` WEEKDAYS (Mon-Fri), oldest first, walking back from today (UTC)
// and skipping Saturday/Sunday entirely -- including if today itself is a
// weekend, in which case the most recent bucket is simply the last weekday
// before it.
function lastNWeekdays(n) {
  const out = [];
  const now = new Date();
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (out.length < n) {
    const dow = cursor.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (dow !== 0 && dow !== 6) out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out.reverse();
}

export async function onRequestGet({ env }) {
  try {
    const dates = lastNWeekdays(DAYS);

    const [newResult, shippedResult] = await Promise.all([
      runQuery(env, `SELECT Id, CreatedDate FROM Order WHERE CreatedDate = LAST_N_DAYS:${QUERY_WINDOW_DAYS}`),
      runQuery(
        env,
        `SELECT Id, LastModifiedDate FROM Order WHERE Status = 'Complete' AND LastModifiedDate = LAST_N_DAYS:${QUERY_WINDOW_DAYS}`,
      ),
    ]);

    if (!newResult.ok || !shippedResult.ok) {
      console.error("stats-trend query failed", newResult.status, shippedResult.status);
      return jsonError("query_failed", 502);
    }

    const newCounts = Object.fromEntries(dates.map((d) => [d, 0]));
    newResult.records.forEach((r) => {
      const k = dateKey(r.CreatedDate);
      if (k in newCounts) newCounts[k] += 1;
    });

    const shippedCounts = Object.fromEntries(dates.map((d) => [d, 0]));
    shippedResult.records.forEach((r) => {
      const k = dateKey(r.LastModifiedDate);
      if (k in shippedCounts) shippedCounts[k] += 1;
    });

    return Response.json(
      {
        dates,
        newOrders: dates.map((d) => newCounts[d]),
        shipped: dates.map((d) => shippedCounts[d]),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
