/**
 * GET /api/rework-check?orderNumber=00013491
 * GET /api/rework-check?orderId=801...
 *
 * READ-ONLY diagnostic for the reprint automation (_rework.js). Creates
 * nothing, writes nothing, PATCHes nothing -- it re-runs every gate the
 * automation passes through and reports which one stopped it, plus the raw
 * records behind each answer.
 *
 * WHY THIS EXISTS (2026-08-27): the reprint fires from a chain that is four
 * hops long and silent at every hop --
 *
 *   PATCH production-methods/:id
 *     -> rollupOrderSubstatus()          (6 separate paths return null)
 *       -> gate: rolledUpSubstatus === 'Completed'
 *         -> createReworkIfNeeded()      (9 more bail-out reasons)
 *
 * -- and the only symptom of a failure anywhere along it is "no reprint order
 * appeared", which is also what a perfectly healthy clean order looks like.
 * Chasing that by adding logs and re-running the whole shop workflow costs a
 * real test cycle each time. This endpoint answers it in one URL.
 *
 * Every SOQL query is reported independently with its own ok/status. That is
 * deliberate and is the single most valuable thing here: in this org a field
 * that does not exist, OR that exists but is hidden from the integration
 * user's profile by field-level security, makes the ENTIRE SELECT a parse
 * error -- the query fails, it does not return a row with a blank column.
 * Production_Run_Line_Items__c and its quantity fields are new enough that
 * their FLS has already been wrong once (see the build log), and the
 * integration user's profile is not the profile anyone checks in the UI.
 * A `false` next to one query name here is the whole diagnosis.
 */
import { runQuery, jsonError } from "./_sf.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;
const q = (v) => `'${String(v).replace(/'/g, "")}'`;
const quoteList = (ids) => ids.map(q).join(",");

// Same ranks as _pm-rollup.js -- kept local on purpose so this diagnostic
// still reports the truth even if that file is mid-edit.
const PM_RANK = {
  "Pre-Production": 0,
  "On Hold": 0,
  "Ready for Print": 1,
  "In Production": 2,
  "Post-Production": 3,
  Completed: 4,
};
const RANK_TO_ORDER_SUBSTATUS = {
  0: "Pre-Production",
  1: "Ready for Print",
  2: "Production",
  3: "Post-Production",
  4: "Completed",
};

/** Run one query and fold its outcome into `report.queries` under `name`. */
async function probe(env, report, name, soql) {
  const res = await runQuery(env, soql);
  report.queries[name] = {
    ok: res.ok,
    status: res.status,
    count: res.records.length,
    soql,
  };
  if (!res.ok) {
    // Salesforce puts the parse error / INVALID_FIELD detail in the body.
    report.queries[name].error = res.data;
  }
  return res;
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const orderNumber = (url.searchParams.get("orderNumber") || "").trim();
    let orderId = (url.searchParams.get("orderId") || "").trim();

    if (!orderId && !orderNumber) {
      return jsonError("pass_orderNumber_or_orderId", 400);
    }
    if (orderId && !SF_ID.test(orderId)) return jsonError("invalid_orderId", 400);

    const report = { orderId: orderId || null, orderNumber: orderNumber || null, queries: {} };

    // ---------------------------------------------------------------------
    // 0. Resolve the order. OrderNumber is the human-facing number on the
    //    board; nothing downstream can run without the real 18-char Id.
    // ---------------------------------------------------------------------
    const lookup = await probe(
      env,
      report,
      "order",
      orderId
        ? `SELECT Id, OrderNumber, Status, Order_Substatus__c, Original_Production_Order__c ` +
            `FROM Order WHERE Id = ${q(orderId)}`
        : `SELECT Id, OrderNumber, Status, Order_Substatus__c, Original_Production_Order__c ` +
            `FROM Order WHERE OrderNumber = ${q(orderNumber)}`,
    );
    if (!lookup.ok) {
      report.verdict = "order_query_failed -- see queries.order.error";
      return Response.json(report, { headers: { "Cache-Control": "no-store" } });
    }
    if (!lookup.records.length) {
      report.verdict = "order_not_found";
      return Response.json(report, { headers: { "Cache-Control": "no-store" } });
    }

    const order = lookup.records[0];
    orderId = order.Id;
    report.orderId = orderId;
    report.orderNumber = order.OrderNumber;
    report.order = {
      Status: order.Status,
      Order_Substatus__c: order.Order_Substatus__c,
      Original_Production_Order__c: order.Original_Production_Order__c,
      isItselfAReprint: !!order.Original_Production_Order__c,
    };

    // ---------------------------------------------------------------------
    // 1. The hook's own gate, recomputed. production-methods/[id].js only
    //    calls the rework when rollupOrderSubstatus() RETURNS 'Completed' --
    //    not merely when the order IS complete. That helper returns null on
    //    six different paths, including a non-204 from its own PATCH of
    //    Order_Substatus__c, and a null there skips the rework silently.
    // ---------------------------------------------------------------------
    const methods = await probe(
      env,
      report,
      "methods",
      `SELECT Id, Name, Type__c, Status__c, Placements__c, Vendor__c ` +
        `FROM Production_Method__c WHERE Order__c = ${q(orderId)}`,
    );

    let expectedSubstatus = null;
    if (methods.ok) {
      const live = methods.records.filter((m) => m.Status__c !== "Cancelled");
      report.methods = methods.records.map((m) => ({
        id: m.Id,
        name: m.Name,
        type: m.Type__c,
        status: m.Status__c,
        rank: PM_RANK[m.Status__c] ?? null,
        counted: m.Status__c !== "Cancelled",
      }));

      let minRank = null;
      for (const m of live) {
        const rank = PM_RANK[m.Status__c];
        if (rank == null) continue;
        if (minRank == null || rank < minRank) minRank = rank;
      }
      expectedSubstatus = minRank == null ? null : RANK_TO_ORDER_SUBSTATUS[minRank];
    }

    report.hookGate = {
      leastAdvancedMethodGives: expectedSubstatus,
      orderSubstatusOnRecord: order.Order_Substatus__c,
      // The gate is on the helper's RETURN value, and the helper returns the
      // value it wrote only when the Order PATCH came back 204. If the record
      // already says Completed but the methods no longer all do, the next
      // method PATCH will roll DOWN and the rework will never be reached.
      wouldFireOnNextMethodPatch: expectedSubstatus === "Completed",
      // A mismatch means the last roll-up PATCH did not land -- validation
      // rule, dependent-picklist restriction, FLS on Order_Substatus__c for
      // the integration user, or a required field on Order.
      rollupWriteLooksBroken:
        expectedSubstatus != null && order.Order_Substatus__c !== expectedSubstatus,
    };

    // ---------------------------------------------------------------------
    // 2. Idempotency: has a reprint already been built off this order? This
    //    is _rework.js's FIRST bail-out, so a stray child order from an
    //    earlier test blocks every later attempt, permanently and silently.
    // ---------------------------------------------------------------------
    const existing = await probe(
      env,
      report,
      "existingReprint",
      `SELECT Id, OrderNumber, CreatedDate FROM Order ` +
        `WHERE Original_Production_Order__c = ${q(orderId)}`,
    );
    if (existing.ok) {
      report.existingReprints = existing.records.map((r) => ({
        id: r.Id,
        orderNumber: r.OrderNumber,
        createdDate: r.CreatedDate,
      }));
    }

    // ---------------------------------------------------------------------
    // 3. Runs must all be Submitted. With no "complete" field on a line item,
    //    an untouched run and a flawless run are byte-identical -- this flag
    //    is the only thing that says a human actually counted.
    // ---------------------------------------------------------------------
    const runs = await probe(
      env,
      report,
      "runs",
      `SELECT Id, Name, Result_Status__c FROM Production_Run__c ` +
        `WHERE PrintMethod__c IN (SELECT Id FROM Production_Method__c WHERE Order__c = ${q(orderId)})`,
    );
    if (runs.ok) {
      report.runs = runs.records.map((r) => ({
        id: r.Id,
        name: r.Name,
        resultStatus: r.Result_Status__c,
        submitted: r.Result_Status__c === "Submitted",
      }));
    }

    // ---------------------------------------------------------------------
    // 4. The damage itself. Method__c is the CASESAFEID formula on the line
    //    item, which is why this can reach every line on the order without
    //    walking run by run.
    // ---------------------------------------------------------------------
    if (methods.ok && methods.records.length) {
      const methodIds = methods.records.map((m) => m.Id);
      const lines = await probe(
        env,
        report,
        "lineItems",
        `SELECT Id, Name, Method__c, Order_Product__c, Planned_Qty__c, ` +
          `Incomplete_Qty__c, Misprint_Qty__c, Damaged_Qty__c ` +
          `FROM Production_Run_Line_Items__c WHERE Method__c IN (${quoteList(methodIds)})`,
      );
      if (lines.ok) {
        report.lineItems = lines.records.map((l) => ({
          id: l.Id,
          name: l.Name,
          method: l.Method__c,
          orderProduct: l.Order_Product__c,
          planned: l.Planned_Qty__c,
          incomplete: l.Incomplete_Qty__c,
          misprint: l.Misprint_Qty__c,
          damaged: l.Damaged_Qty__c,
          reworkQty: (Number(l.Damaged_Qty__c) || 0) + (Number(l.Misprint_Qty__c) || 0),
        }));
        report.totalReworkQty = report.lineItems.reduce((s, l) => s + l.reworkQty, 0);
        // A line with damage but no Order_Product__c cannot be reworked --
        // there is nothing to reorder. Worth calling out separately from
        // "no damage at all", because the two look the same from outside.
        report.linesWithDamageButNoOrderProduct = report.lineItems.filter(
          (l) => l.reworkQty > 0 && !l.orderProduct,
        ).length;
      }

      // Same MATCH against the raw line-item table with no field list beyond
      // Id -- if this succeeds while the query above failed, the problem is a
      // specific FIELD (missing, or FLS-hidden from the integration user),
      // not the object or the filter.
      if (!lines.ok) {
        await probe(
          env,
          report,
          "lineItemsBareIdOnly",
          `SELECT Id FROM Production_Run_Line_Items__c WHERE Method__c IN (${quoteList(methodIds)})`,
        );
      }
    }

    // ---------------------------------------------------------------------
    // 5. Verdict, in the same order _rework.js checks them.
    // ---------------------------------------------------------------------
    const Q = report.queries;
    const failedQuery = Object.keys(Q).find((k) => !Q[k].ok);

    if (failedQuery) {
      report.verdict =
        `QUERY FAILED: ${failedQuery}. A field named in that SELECT either does not ` +
        `exist in this org or is hidden from the integration user's profile by ` +
        `field-level security -- either way the whole query is a parse error. ` +
        `See queries.${failedQuery}.error.`;
    } else if (report.existingReprints && report.existingReprints.length) {
      report.verdict =
        `already_reworked -- reprint ${report.existingReprints[0].orderNumber} exists, ` +
        `so the automation bails out first thing every time. Delete it to re-test.`;
    } else if (!report.runs || !report.runs.length) {
      report.verdict = "no_runs -- no Production Runs hang off this order's methods.";
    } else if (report.runs.some((r) => !r.submitted)) {
      report.verdict =
        `runs_not_submitted -- ` +
        report.runs
          .filter((r) => !r.submitted)
          .map((r) => `${r.name}=${r.resultStatus || "(blank)"}`)
          .join(", ") +
        `. Result_Status__c must read exactly 'Submitted' on every run.`;
    } else if (!report.totalReworkQty) {
      report.verdict =
        report.linesWithDamageButNoOrderProduct
          ? `nothing_to_rework -- ${report.linesWithDamageButNoOrderProduct} line(s) carry damage ` +
            `but have no Order_Product__c, so there is no product to reorder.`
          : `nothing_to_rework -- every line item's Misprint_Qty__c + Damaged_Qty__c is 0 or blank.`;
    } else if (!report.hookGate.wouldFireOnNextMethodPatch) {
      report.verdict =
        `GATES PASS but the hook never runs: the least-advanced method gives ` +
        `'${expectedSubstatus}', not 'Completed'. production-methods/[id].js only calls ` +
        `the rework when the substatus roll-up returns 'Completed'.`;
    } else if (report.hookGate.rollupWriteLooksBroken) {
      report.verdict =
        `GATES PASS and the methods say 'Completed', but Order_Substatus__c on the ` +
        `record reads '${order.Order_Substatus__c}' -- the roll-up's PATCH is not landing, ` +
        `so rollupOrderSubstatus() returns null and the rework is skipped.`;
    } else {
      report.verdict =
        `ALL GATES PASS (${report.totalReworkQty} garment(s) to rework). The next ` +
        `method status PATCH that lands on Completed should build the reprint. If it ` +
        `does not, the failure is inside the composite create, not the gates.`;
    }

    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("rework-check failed", err);
    return jsonError("internal_error", 500);
  }
}
