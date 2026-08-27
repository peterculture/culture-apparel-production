/**
 * GET /api/shortfalls
 *
 * Every production run that finished with garments that never made it onto the
 * press -- the manager-facing half of the incomplete alert. Read-only.
 *
 * WHY THIS IS ITS OWN ENDPOINT rather than extra fields on the board queries:
 * index.html and calendar.html are load-bearing screens that the shop uses all
 * day, and both drive off one big query whose SELECT list already reaches
 * across several objects. Adding a brand-new field to those SELECTs would put
 * every board one FLS mistake away from going blank -- a field the integration
 * user cannot see is a PARSE ERROR, not a null column, so the whole board
 * empties rather than losing one badge. That has now happened twice on this
 * project. A separate endpoint fails alone: if the production-result fields are
 * not deployed in this org, this returns `available:false` and the boards carry
 * on exactly as they did before, minus a badge.
 *
 * WHAT COUNTS AS OUTSTANDING -- read this before trusting the number.
 *
 * `Incomplete_Qty__c` is a permanent historical fact about a run: 12 shirts
 * never got printed that day. Nothing ever clears it, and nothing should --
 * rewriting history to mean "handled" is how you lose the ability to ask how
 * often this happens. But a badge that can never go away is furniture, and
 * managers stop seeing furniture.
 *
 * So "outstanding" is DERIVED, not stored: a shortfall is considered handled
 * once another run exists on the SAME method that was created after the
 * shortfall was recorded. Scheduling the make-up run IS the resolution, so the
 * manager's own action clears the flag without anyone having to remember to
 * tick a box.
 *
 * The honest limitation: any run added to that method afterwards clears it,
 * whatever it was actually for. On a method that has already finished printing
 * that is a safe assumption -- you do not add runs to a completed method except
 * to catch up -- but it IS an assumption. `resolvedByRunId` is returned so the
 * reasoning can be checked, and `outstanding:false` rows are still in the
 * payload rather than filtered away. If this ever guesses wrong in practice,
 * the sturdier fix is a `Shortfall_Resolved__c` checkbox on Production_Run__c
 * set by whoever schedules the make-up run; this endpoint would then read that
 * instead, and nothing on the client side would need to change.
 */
import { runQuery, jsonError } from "../_sf.js";

const RUN_OBJECT = "Production_Run__c";
const q = (v) => `'${String(v).replace(/'/g, "")}'`;
const quoteList = (ids) => ids.map(q).join(",");

/** The org has not had the production-result fields deployed yet. */
function notAvailable(detail) {
  return Response.json(
    { available: false, records: [], byMethod: {}, byOrder: {}, totalOutstanding: 0, detail },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function onRequestGet({ env }) {
  try {
    // 1. The shortfalls themselves. Roll-up summary fields are filterable, so
    // this never touches the line items.
    const runs = await runQuery(
      env,
      `SELECT Id, Name, PrintMethod__c, Total_Incomplete_Qty__c, ` +
        `Result_Status__c, Result_Recorded_At__c, Result_Recorded_By__c ` +
        `FROM ${RUN_OBJECT} WHERE Total_Incomplete_Qty__c > 0`,
    );
    if (!runs.ok) {
      const b = runs.data;
      const first = Array.isArray(b) && b[0] ? b[0] : null;
      return notAvailable(first ? `${first.errorCode}: ${first.message}` : `status ${runs.status}`);
    }

    const empty = { available: true, records: [], byMethod: {}, byOrder: {}, totalOutstanding: 0 };
    if (!runs.records.length) {
      return Response.json(empty, { headers: { "Cache-Control": "no-store" } });
    }

    const methodIds = [...new Set(runs.records.map((r) => r.PrintMethod__c).filter(Boolean))];
    if (!methodIds.length) {
      return Response.json(empty, { headers: { "Cache-Control": "no-store" } });
    }

    // 2. Every run on those same methods, so a later one can clear the flag.
    const siblings = await runQuery(
      env,
      `SELECT Id, Name, PrintMethod__c, CreatedDate FROM ${RUN_OBJECT} ` +
        `WHERE PrintMethod__c IN (${quoteList(methodIds)})`,
    );
    if (!siblings.ok) return jsonError("sibling_runs_query_failed", 502);

    const siblingsByMethod = new Map();
    for (const s of siblings.records) {
      if (!siblingsByMethod.has(s.PrintMethod__c)) siblingsByMethod.set(s.PrintMethod__c, []);
      siblingsByMethod.get(s.PrintMethod__c).push(s);
    }

    // 3. Order context, resolved by explicit queries rather than by guessing
    // __r relationship names -- a wrong guess is a parse error that surfaces as
    // zero rows, which here would read as "no shortfalls anywhere".
    const methods = await runQuery(
      env,
      `SELECT Id, Type__c, Status__c, Order__c FROM Production_Method__c ` +
        `WHERE Id IN (${quoteList(methodIds)})`,
    );
    if (!methods.ok) return jsonError("methods_query_failed", 502);
    const methodById = new Map(methods.records.map((m) => [m.Id, m]));

    const orderIds = [...new Set(methods.records.map((m) => m.Order__c).filter(Boolean))];
    const orders = orderIds.length
      ? await runQuery(
          env,
          `SELECT Id, OrderNumber, Customer_Order_Name__c, Account.Name, ` +
            `Customer_Facing_Delivery_Date__c FROM Order WHERE Id IN (${quoteList(orderIds)})`,
        )
      : { ok: true, records: [] };
    if (!orders.ok) return jsonError("orders_query_failed", 502);
    const orderById = new Map(orders.records.map((o) => [o.Id, o]));

    const records = runs.records.map((r) => {
      const m = methodById.get(r.PrintMethod__c) || null;
      const o = m && m.Order__c ? orderById.get(m.Order__c) || null : null;

      // A run created after this shortfall was recorded is the make-up run.
      // Fall back to the shortfall run's own CreatedDate when it was never
      // stamped (counted directly in Salesforce rather than on the tablet) --
      // without a reference point every sibling would look like a make-up run
      // and the shortfall would clear itself the moment it appeared.
      const after = r.Result_Recorded_At__c;
      let resolvedBy = null;
      if (after) {
        const cutoff = Date.parse(after);
        const later = (siblingsByMethod.get(r.PrintMethod__c) || []).find(
          (s) => s.Id !== r.Id && Date.parse(s.CreatedDate) > cutoff,
        );
        if (later) resolvedBy = later;
      }

      return {
        runId: r.Id,
        runName: r.Name,
        methodId: r.PrintMethod__c || null,
        methodType: m ? m.Type__c : null,
        methodStatus: m ? m.Status__c : null,
        orderId: m ? m.Order__c : null,
        orderNumber: o ? o.OrderNumber : null,
        orderName: o ? o.Customer_Order_Name__c : null,
        customer: o && o.Account ? o.Account.Name : null,
        dueDate: o ? o.Customer_Facing_Delivery_Date__c : null,
        qty: Number(r.Total_Incomplete_Qty__c) || 0,
        recordedAt: r.Result_Recorded_At__c || null,
        recordedBy: r.Result_Recorded_By__c || null,
        // Never counted, so the number is not yet trustworthy as a shortfall.
        counted: r.Result_Status__c === "Submitted",
        outstanding: !resolvedBy,
        resolvedByRunId: resolvedBy ? resolvedBy.Id : null,
        resolvedByRunName: resolvedBy ? resolvedBy.Name : null,
      };
    });

    // Pre-summed lookups so a board can render a badge without doing its own
    // grouping. index.html keys cards by METHOD id; calendar.html works per
    // ORDER -- hence both.
    const byMethod = {};
    const byOrder = {};
    let totalOutstanding = 0;
    for (const rec of records) {
      if (!rec.outstanding || !rec.qty) continue;
      totalOutstanding += rec.qty;
      if (rec.methodId) byMethod[rec.methodId] = (byMethod[rec.methodId] || 0) + rec.qty;
      if (rec.orderId) byOrder[rec.orderId] = (byOrder[rec.orderId] || 0) + rec.qty;
    }

    return Response.json(
      { available: true, records, byMethod, byOrder, totalOutstanding },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("shortfalls GET failed", err);
    return jsonError("internal_error", 500);
  }
}
