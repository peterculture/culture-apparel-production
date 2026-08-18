/**
 * Shared helper: keep Order.Print_Date__c in step with the production runs
 * underneath it.
 *
 * THE RULE THE SHOP ASKED FOR. The Account Manager sets a print date and time
 * on Close and Create Order, and that is the order's opening position. Once
 * the job reaches the floor the runs are the truth:
 *
 *   scheduled start  overrides  the AM's date
 *   actual start     overrides  the scheduled start
 *
 * Per run the "effective start" is therefore Actual_Start__c if it exists,
 * else Scheduled_Start__c. The ORDER's print date is the EARLIEST effective
 * start across its runs -- an order prints when its first run starts, and a
 * three-run order should not report the date of whichever run happened to be
 * edited last.
 *
 * WHY THIS LIVES ON THE SERVER, not in calendar.html. Runs get edited from at
 * least three places: the Calendar dashboard's drawer and drag, the card drawer
 * on index.html, and the Create Production Run modal on pre-production.html.
 * Putting the rule in one board would mean the other two silently leave the
 * order's date stale. Hanging it off the run endpoints means every path gets it
 * for free, including any future one.
 *
 * PRINT END NEEDS NO HANDLING. Order.Print_End_Date_Time__c is a FORMULA field
 * -- Print_Date__c + Duration__c/24, falling back to +2h when Duration__c is
 * blank (see the notes in orders/index.js and production-orders/index.js). It
 * is not writable and it does not need to be: moving Print_Date__c moves the
 * end with it automatically. Duration__c is deliberately left alone -- that is
 * the AM's planned span, not something a run should overwrite.
 *
 * Same contract as the other rollups in this folder: best effort, logs loudly,
 * and NEVER throws into the caller. A failed rollup must not fail the run write
 * that triggered it.
 */
import { runQuery, sfFetch, apiVersion } from "./_sf.js";

const PR_OBJECT = "Production_Run__c";
const PM_OBJECT = "Production_Method__c";

/** Ids are validated by the callers before they reach us; this is belt and
 *  braces so a bad value can never be interpolated into SOQL. */
const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

/**
 * Recompute and write Order.Print_Date__c from the order's runs.
 *
 * @returns {Promise<{printDate:string|null, changed:boolean}|null>}
 */
export async function rollupPrintDateToOrder(env, orderId) {
  if (!SF_ID.test(orderId || "")) return null;
  try {
    // Semi-join rather than two round trips. Production_Run__c points at a
    // method (PrintMethod__c) and the method points at the order, so this is
    // the one hop that gets every run on the order regardless of how many
    // methods it has.
    const runsSoql =
      `SELECT Id, Scheduled_Start__c, Actual_Start__c FROM ${PR_OBJECT} ` +
      `WHERE PrintMethod__c IN (SELECT Id FROM ${PM_OBJECT} WHERE Order__c = '${orderId}')`;
    const runs = await runQuery(env, runsSoql);
    if (!runs.ok) {
      console.error("rollupPrintDateToOrder: run query failed", orderId, runs.status);
      return null;
    }

    // Actual beats scheduled, per run. A run with neither contributes nothing
    // rather than counting as "now" -- an unscheduled run must not drag the
    // order's date to today.
    const starts = runs.records
      .map((r) => Date.parse(r.Actual_Start__c || r.Scheduled_Start__c || ""))
      .filter(Number.isFinite);

    // No runs, or none with a date: leave the AM's original date alone. This is
    // the case that makes deleting the last run safe -- the order falls back to
    // what the Account Manager committed to rather than being blanked.
    if (!starts.length) return { printDate: null, changed: false };

    const earliest = new Date(Math.min(...starts)).toISOString();

    // Read before write. Order is touched by record-triggered automation in
    // this org, so a no-op PATCH is not free -- it burns a DML, bumps
    // LastModifiedDate, and re-fires those triggers for nothing.
    const cur = await runQuery(
      env,
      `SELECT Print_Date__c FROM Order WHERE Id = '${orderId}'`,
    );
    const currentIso = cur.ok && cur.records[0] ? cur.records[0].Print_Date__c : null;
    if (currentIso && Date.parse(currentIso) === Date.parse(earliest)) {
      return { printDate: earliest, changed: false };
    }

    const resp = await sfFetch(
      env,
      `/services/data/${apiVersion(env)}/sobjects/Order/${orderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Print_Date__c: earliest }),
      },
    );

    if (resp.status !== 204) {
      let detail = "";
      try { detail = await resp.text(); } catch { /* empty */ }
      console.error(
        "rollupPrintDateToOrder: Order PATCH failed", orderId, resp.status, detail,
        "-- check the integration user has Edit on Order.Print_Date__c",
      );
      return null;
    }

    return { printDate: earliest, changed: true };
  } catch (e) {
    console.error("rollupPrintDateToOrder failed", orderId, e);
    return null;
  }
}

/**
 * Same thing starting from a run. The run endpoints know the run they just
 * wrote, not its order, so they call this.
 *
 * IMPORTANT for DELETE: call this BEFORE deleting the run -- once it is gone
 * the hop back to its order is gone with it. Capture the order id first, then
 * delete, then call rollupPrintDateToOrder with the id you kept.
 */
export async function rollupPrintDateFromRun(env, runId) {
  if (!SF_ID.test(runId || "")) return null;
  try {
    const orderId = await orderIdForRun(env, runId);
    return orderId ? rollupPrintDateToOrder(env, orderId) : null;
  } catch (e) {
    console.error("rollupPrintDateFromRun failed", runId, e);
    return null;
  }
}

/** Run -> its method -> that method's order. Exported because DELETE needs to
 *  resolve the order while the run still exists. */
export async function orderIdForRun(env, runId) {
  if (!SF_ID.test(runId || "")) return null;
  try {
    const r = await runQuery(
      env,
      `SELECT PrintMethod__c FROM ${PR_OBJECT} WHERE Id = '${runId}'`,
    );
    const methodId = r.ok && r.records[0] ? r.records[0].PrintMethod__c : null;
    return methodId ? orderIdForMethod(env, methodId) : null;
  } catch (e) {
    console.error("orderIdForRun failed", runId, e);
    return null;
  }
}

/** Method -> its order. Used by the create path, which knows the method. */
export async function orderIdForMethod(env, methodId) {
  if (!SF_ID.test(methodId || "")) return null;
  try {
    const r = await runQuery(
      env,
      `SELECT Order__c FROM ${PM_OBJECT} WHERE Id = '${methodId}'`,
    );
    return (r.ok && r.records[0] && r.records[0].Order__c) || null;
  } catch (e) {
    console.error("orderIdForMethod failed", methodId, e);
    return null;
  }
}
