/**
 * Shared helper: mirror an order's computed priority onto every
 * Production_Method__c beneath it (Production_Priority__c, Number(4,2)).
 *
 * This is rollup number five, alongside the four in _pm-rollup.js, and it
 * follows exactly the same contract: recompute from the truth, write it where
 * other consumers can see it, and NEVER fail the caller's own write if it
 * throws. Callers should await it and ignore the result.
 *
 * WHY WRITE IT AT ALL, when _priority.js computes the same number live on every
 * request? Three consumers that cannot call us:
 *
 *   1. The station boards. _station.js already dot-walks Production_Method__r on
 *      every query, so with the score on the method all four stations sort by
 *      priority for the cost of one extra field in a SELECT that exists. Without
 *      it, every station request would have to climb back to the Order and
 *      recompute from the whole method set.
 *   2. Salesforce reports and list views, which need something to sort on.
 *   3. Anything Apex-side that wants to read a priority without an HTTP call.
 *
 * The app itself never reads this copy. That is the whole safety property: a
 * missed refresh degrades a report, it can never put a wrong number on a screen.
 *
 * ONE RATING PER ORDER. Every method on the order gets the SAME value -- that is
 * Anthony's rule, and it is why this writes a flat value to all of them rather
 * than scoring each method independently.
 */
import { runQuery, sfFetch, apiVersion } from "./_sf.js";
import { scoreOrder } from "./_priority.js";

const PM_OBJECT = "Production_Method__c";

/** Everything scoreOrder() needs, in one query. */
const ORDER_FIELDS = [
  "Order__r.Id",
  "Order__r.Print_Date__c",
  "Order__r.Priority_Rating__c",
  "Order__r.Firm__c",
  "Order__r.Customer_Facing_Delivery_Date__c",
];
const PM_FIELDS = [
  "Id",
  "Type__c",
  "Status__c",
  "Screens_Completed__c",
  "Mix_Inks__c",
  "Digitize_File__c",
  "Thread_Color_Materials__c",
  "Transfers_Received__c",
  "Transfers_Ready__c",
];

/**
 * @param {string} orderId - already-validated Salesforce Id of the parent Order.
 * @returns {Promise<{score:number, methodIds:string[]}|null>} what was written, or null.
 */
export async function rollupPriorityToMethods(env, orderId) {
  if (!orderId) return null;
  const v = apiVersion(env);
  try {
    const soql =
      `SELECT ${PM_FIELDS.join(", ")}, ${ORDER_FIELDS.join(", ")} ` +
      `FROM ${PM_OBJECT} WHERE Order__c = '${orderId}'`;
    const { ok, records } = await runQuery(env, soql);
    if (!ok || !records.length) return null;

    // Order-level fields are identical across siblings, so the first row carries
    // them. Cancelled methods still get the value written -- they are excluded
    // from the CALCULATION (see readiness()) but a cancelled method with a stale
    // number on it is more confusing than one that simply agrees with its order.
    const order = records[0].Order__r;
    if (!order) return null;

    const { score } = scoreOrder(order, records);

    // One PATCH per method. These are always tiny (an order has one to three
    // methods), so the composite API would be more machinery than it saves.
    const results = await Promise.all(
      records.map((pm) =>
        sfFetch(env, `/services/data/${v}/sobjects/${PM_OBJECT}/${pm.Id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Production_Priority__c: score }),
        }).then((r) => ({ id: pm.Id, status: r.status, resp: r }))
         .catch((e) => ({ id: pm.Id, status: 0, err: e })),
      ),
    );

    const failed = results.filter((r) => r.status !== 204);
    if (failed.length) {
      // Log loudly but never throw. The most likely cause by far is the
      // integration user lacking EDIT on Production_Priority__c -- read access
      // is not enough, this field is written on every refresh -- so say so
      // rather than leaving a bare status code in the log.
      for (const f of failed) {
        let detail = "";
        try { detail = f.resp ? JSON.stringify(await f.resp.json()) : String(f.err); } catch { /* empty */ }
        console.error(
          "rollupPriorityToMethods: PATCH failed", f.id, f.status, detail,
          "-- check the integration user has Edit (not just Read) on Production_Method__c.Production_Priority__c",
        );
      }
    }

    return { score, methodIds: results.filter((r) => r.status === 204).map((r) => r.id) };
  } catch (e) {
    console.error("rollupPriorityToMethods failed", orderId, e);
    return null;
  }
}

/**
 * Same thing, starting from a method rather than an order -- for the PATCH
 * handlers in production-methods/[id].js, which know the method they just wrote
 * but not always its parent.
 */
export async function rollupPriorityFromMethod(env, methodId) {
  if (!methodId) return null;
  try {
    const { records } = await runQuery(
      env,
      `SELECT Order__c FROM ${PM_OBJECT} WHERE Id = '${methodId}'`,
    );
    const orderId = records[0] && records[0].Order__c;
    return orderId ? rollupPriorityToMethods(env, orderId) : null;
  } catch (e) {
    console.error("rollupPriorityFromMethod failed", methodId, e);
    return null;
  }
}
