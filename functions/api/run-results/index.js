/**
 * GET  /api/run-results                 -> runs that can be counted
 * GET  /api/run-results?runId=<id>      -> one run + its line-item rows (+ its Run Results)
 * POST /api/run-results                 -> record the counts and submit the run (legacy form)
 * POST /api/run-results {action:"add"}     -> log counts as Run Result rows (S6, D17/D28)
 * POST /api/run-results {action:"remove"}  -> delete one Run Result (run not submitted)
 * POST /api/run-results {action:"submit"}  -> mark the run's counts final (+ reprint check)
 * POST /api/run-results {action:"reopen"}  -> manager: back to Draft so counts can be fixed
 *
 * ── S6 (2026-09-17): "add a count" ─────────────────────────────────────────
 * D17 supersedes the paragraph below. Each count is now a Run_Result__c row
 * (good / misprint / damaged / incomplete + when + who) under its line item,
 * and Apex RunResultRollup keeps the line item's Misprint/Damaged/Incomplete
 * (and new Good_Qty__c) equal to the SUM of its Run Results (D28), so every
 * reader of those fields -- the run roll-ups, _rework.js gate 4, rework-check,
 * shortfalls, the skeleton flow, B9's email -- is untouched. The org also
 * refuses any Run Result change on a Submitted run; a manager reopens it.
 *
 * Build rule 3: in an org WITHOUT Run_Result__c (production today) GET answers
 * `resultsAvailable:false` and the counting screen keeps the old four-box form,
 * which still posts to the legacy path below. In an org WITH it, the legacy
 * path refuses typed numbers (409 counting_screen_updated) -- writing the line
 * fields directly would be silently overwritten by the next Run Result.
 *
 * This is the write path for the four-quantity production result model. Until
 * this file existed, NOTHING in the app wrote Planned/Incomplete/Misprint/
 * Damaged or Result_Status__c -- the fields were readable only through
 * Salesforce itself, and _rework.js (which consumes them) could therefore
 * never fire from a real shop workflow. See claude/production-result-design.md.
 *
 * THE MODEL, IN ONE PARAGRAPH, BECAUSE EVERY DECISION BELOW FOLLOWS FROM IT:
 * only problems are recorded. There is no "good" or "complete" count -- what
 * went right is whatever is left over. That makes a perfect run and an
 * untouched run byte-identical (all blanks), so `Result_Status__c` is the ONLY
 * evidence a human actually counted. Submitting is therefore a deliberate act
 * with its own button, not a side effect of typing a number, and a run with
 * every box empty is a completely normal thing to submit.
 *
 * WHY INCOMPLETE IS NOT JUST ANOTHER LOSS: misprinted and damaged garments are
 * spent -- the blank is ruined and a replacement has to be bought and printed,
 * which is what _rework.js builds. Incomplete garments are intact and sitting
 * on the shelf; they never reached the press. They need press time on the SAME
 * method, not a new order. Merging the two would silently order replacement
 * stock for garments the shop already owns. The response returns
 * `incompleteTotal` separately so the client can route the counter to run
 * creation instead.
 *
 * ON THE ORDER OF WRITES IN THE POST: line items first, run second. If the run
 * were stamped Submitted first and a line-item write then failed, the order
 * would look counted while carrying wrong numbers -- and _rework.js gates on
 * Submitted, so it would build a reprint from them. Failing before the stamp
 * leaves the run in Draft, which is exactly the recoverable state: the counter
 * sees it still in the list and enters it again.
 */
import { runQuery, runChunkedIdQuery, sfFetch, apiVersion, jsonError, soqlQuote, soqlQuoteList } from "../_sf.js";
import { requireCap } from "../_session.js";
import { orderIdForMethod } from "../_print-date-rollup.js";
import { createReworkIfNeeded } from "../_rework.js";
import { runQueryOptionalField } from "../_placements.js";

const RUN_OBJECT = "Production_Run__c";
const LINE_OBJECT = "Production_Run_Line_Item__c";
const RESULT_OBJECT = "Run_Result__c";

// Client key -> Run_Result__c field for the "add a count" path. Good is new
// with D17 and optional (D28); the other three mean what they always meant.
const RESULT_COUNT_FIELDS = {
  goodQty: "Good_Qty__c",
  misprintQty: "Misprint_Qty__c",
  damagedQty: "Damaged_Qty__c",
  incompleteQty: "Incomplete_Qty__c",
};
const RESULT_FIELDS = [
  "Id",
  "Name",
  "Line_Item__c",
  "Good_Qty__c",
  "Misprint_Qty__c",
  "Damaged_Qty__c",
  "Incomplete_Qty__c",
  "Counted_At__c",
  "Counted_By__c",
  "Note__c",
  "Good_Qty_Estimated__c",
];
const NOTE_MAX = 255;

// Keep in sync with production-runs/index.js -- the org's Field Name really is
// `Quantity_Planned_c`, so the automatic __c lands on top of an existing _c.
// Do not "fix" this; the corrected name does not exist and the write 400s.
const RUN_QTY_FIELD = "Quantity_Planned_c__c";

// The three numbers a counter types, and the client key each arrives under.
// Planned_Qty__c is deliberately NOT writable here: it is generated with the
// skeleton when the run is confirmed, and it is the yardstick the counts are
// measured against. Letting the person reporting a loss also edit the target
// would erase the discrepancy they are reporting.
const COUNT_FIELDS = {
  misprintQty: "Misprint_Qty__c",
  damagedQty: "Damaged_Qty__c",
  incompleteQty: "Incomplete_Qty__c",
};

// Methods whose runs are worth counting. A method still in Pre-Production or
// Ready for Print has not been printed, so its runs have nothing to report.
const COUNTABLE_METHOD_STATUSES = ["In Production", "Post-Production", "Completed"];

const RESULT_DRAFT = "Draft";
const RESULT_SUBMITTED = "Submitted";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;
const COMPOSITE_LIMIT = 25;
const MAX_QTY = 99999;
const LIST_LIMIT = 200;

/* Escaping lives in _sf.js now. These were five diverging copies that
   stripped apostrophes and let backslashes through -- a trailing "\\"
   escaped the closing quote and killed the query. Local aliases so every
   call site below reads unchanged. */
/* Single-select on Production_Run__c; the placement this run prints. Kept
   out of RUN_RESULT_FIELDS deliberately -- see the query in
   getCountableRuns() for why. */
const PR_LOCATION_FIELD = "Print_Location__c";

const q = soqlQuote;
const quoteList = soqlQuoteList;

/**
 * Every field this endpoint needs on Production_Run__c that did not exist
 * before the 2026-08 production-result build.
 *
 * These are queried as a GROUP rather than through runQueryOptionalField (see
 * _placements.js) on purpose. That helper degrades gracefully when ONE optional
 * field is missing, which is right for Print_Location__c -- a nice-to-have
 * column on an otherwise working board. It is wrong here: this endpoint has no
 * meaningful degraded mode, because without Result_Status__c there is nothing
 * to submit and without the roll-ups there is nothing to show. So the query is
 * attempted whole and, if the org has not been migrated yet, the endpoint says
 * so plainly (`available:false`) instead of returning a half-working screen.
 */
const RUN_RESULT_FIELDS = [
  "Result_Status__c",
  "Result_Recorded_By__c",
  "Result_Recorded_At__c",
  "Total_Planned_Qty__c",
  "Total_Incomplete_Qty__c",
  "Total_Misprint_Qty__c",
  "Total_Damaged_Qty__c",
];

const RUN_BASE_FIELDS = [
  "Id",
  "Name",
  "PrintMethod__c",
  "Press__c",
  "Press__r.Name",
  "Scheduled_Start__c",
  "Scheduled_End__c",
  "Actual_Start__c",
  "Actual_End__c",
  RUN_QTY_FIELD,
  "LastModifiedDate",
];

/**
 * NOTE WHAT IS ABSENT: Reject_Reason__c and Notes__c.
 *
 * Both exist on the object in dev2 (Peter Larson created them 2026-05-22) and
 * both are invisible to the integration user's profile. Naming an FLS-hidden
 * field in a SELECT does not return a blank column -- it makes the ENTIRE query
 * a parse error ("No such column 'Reject_Reason__c'"), so including them for
 * completeness took down the whole counting screen with an empty run list.
 *
 * They are omitted rather than FLS-fixed because the counting screen does not
 * render either one: a shop worker recording a misprint is not writing prose,
 * and a free-text box on a tablet at a press gets used roughly never. If they
 * are ever wanted, grant the integration profile read/edit on both FIRST, in
 * every org, and only then add them back here -- an org that has not had the
 * permission granted will otherwise lose the whole board rather than one field.
 */
const LINE_FIELDS = [
  "Id",
  "Name",
  "ProductionRun__c",
  "Order_Product__c",
  "Size__c",
  "Color__c",
  "Planned_Qty__c",
  "Incomplete_Qty__c",
  "Misprint_Qty__c",
  "Damaged_Qty__c",
];

/** The org has not had the production-result fields deployed yet. */
function notAvailable(detail) {
  return Response.json(
    { available: false, records: [], detail: detail || "production_result_fields_missing" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Whole-number quantity, or null if the caller sent nothing for it. */
function parseQty(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MAX_QTY || Math.floor(n) !== n) return { ok: false };
  return { ok: true, value: n };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const runId = (url.searchParams.get("runId") || "").trim();
    if (runId && !SF_ID.test(runId)) return jsonError("invalid_runId", 400);

    return runId ? await getOneRun(env, runId) : await getCountableRuns(env, url);
  } catch (err) {
    console.error("run-results GET failed", err);
    return jsonError("internal_error", 500);
  }
}

/**
 * The tablet's worklist: every run on a method that has actually been printed.
 *
 * Deliberately returns counted runs too, tagged by Result_Status__c, rather
 * than filtering to Draft. A counter who fat-fingers a number needs to find
 * that run again, and a run that vanishes the instant it is submitted gives
 * them nowhere to go. The client splits the list into tabs.
 */
/**
 * How many GARMENTS the whole ORDER is, per order id (B20).
 *
 * The counting screen is the only board that did not already have this: a
 * counter sees the run's own scheduled figure and had no way to tell a 40 out
 * of 40 from a 40 out of 300 without leaving the screen.
 *
 * Deliberately a SEPARATE, FAIL-OPEN follow-up rather than a field added to
 * the query this screen depends on -- B8's rule, and trap 1's: one FLS-hidden
 * field turns the WHOLE select into a parse error and empties the board with
 * an HTTP 200. A count is not worth that. Chunked through runChunkedIdQuery
 * because an unbounded IN list is rejected at the HTTP level, not by SOQL
 * (B12 is that bug live).
 *
 * `Size__c != null` is what makes this the SAME number the other boards show.
 * A blank Size__c OrderItem is not a garment (order-sizes/index.js: "treated
 * as a non-garment line on the front end") -- a setup fee is an OrderItem too.
 * pivotItems() in ca-api.js skips those rows, so this must as well.
 *
 * Returns a Map of orderId -> positive integer. An order missing from the map
 * is UNKNOWN, and the screen renders nothing for it. Never 0: blank means
 * nobody knows, 0 would be a claim that the job has no garments.
 */
async function garmentCountByOrder(env, orderIds) {
  const ids = [...new Set((orderIds || []).filter(Boolean))];
  const byOrder = new Map();
  if (!ids.length) return byOrder;
  try {
    const res = await runChunkedIdQuery(ids, (quotedIds) =>
      runQuery(
        env,
        `SELECT OrderId, Quantity FROM OrderItem WHERE OrderId IN (${quotedIds}) AND Size__c != null`,
      ),
    );
    if (!res.ok) {
      console.error("run-results order garment count failed", res.status);
      return byOrder;
    }
    const sums = new Map();
    res.records.forEach((it) => {
      const q = Number(it.Quantity);
      if (!Number.isFinite(q)) return;
      sums.set(it.OrderId, (sums.get(it.OrderId) || 0) + q);
    });
    sums.forEach((q, id) => {
      if (Number.isFinite(q) && q > 0) byOrder.set(id, Math.round(q));
    });
  } catch (e) {
    console.error("run-results order garment count error", e);
  }
  return byOrder;
}

async function getCountableRuns(env, url) {
  /* Print_Location__c rides along through runQueryOptionalField, NOT in
     RUN_RESULT_FIELDS. That group is all-or-nothing on purpose (see its
     comment above): without Result_Status__c there is nothing to submit, so a
     missing field there should take the whole endpoint to available:false
     rather than half-work. Placement is the opposite kind of field -- a label
     on a panel. It is created by hand per org (see _placements.js) and trap 1
     applies with full force: naming it in a plain SELECT where the integration
     user cannot see it does not blank one column, it makes the entire query a
     parse error and empties the counting screen. So the helper tries it, and
     retries without it only when the failure actually names that field. An org
     without it shows "Placement not recorded" and keeps every number. */
  const buildSoql = (include) =>
    `SELECT ${RUN_BASE_FIELDS.concat(RUN_RESULT_FIELDS, include ? [PR_LOCATION_FIELD] : []).join(", ")} FROM ${RUN_OBJECT} ` +
    `WHERE PrintMethod__c IN (` +
    `SELECT Id FROM Decoration__c WHERE Status__c IN (${quoteList(COUNTABLE_METHOD_STATUSES)})` +
    `) ORDER BY Scheduled_Start__c DESC NULLS LAST LIMIT ${LIST_LIMIT}`;

  const runs = await runQueryOptionalField(env, buildSoql, PR_LOCATION_FIELD);
  if (!runs.ok) return notAvailable(describeQueryFailure(runs));
  if (!runs.records.length) {
    return Response.json({ available: true, records: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  // Order + method context, resolved by explicit queries rather than by
  // guessing __r relationship names. A custom lookup's relationship name is
  // whatever was typed when the field was created -- it is NOT guaranteed to be
  // the field name minus __c -- and getting it wrong makes the whole SELECT a
  // parse error that surfaces as zero rows, which on this screen would read as
  // "nothing to count today". _print-date-rollup.js and _rework.js both walk it
  // this way for the same reason.
  const methodIds = [...new Set(runs.records.map((r) => r.PrintMethod__c).filter(Boolean))];
  const methods = methodIds.length
    ? await runQuery(
        env,
        `SELECT Id, Type__c, Status__c, Placements__c, Order__c FROM Decoration__c ` +
          `WHERE Id IN (${quoteList(methodIds)})`,
      )
    : { ok: true, records: [] };
  if (!methods.ok) return jsonError("methods_query_failed", 502);

  const methodById = new Map(methods.records.map((m) => [m.Id, m]));
  const orderIds = [...new Set(methods.records.map((m) => m.Order__c).filter(Boolean))];
  const orders = orderIds.length
    ? await runQuery(
        env,
        `SELECT Id, OrderNumber, GOA_Order_Number__c, Customer_Order_Name__c, Account.Name, ` +
            `Customer_Facing_Delivery_Date__c ` +
          `FROM Order WHERE Id IN (${quoteList(orderIds)})`,
      )
    : { ok: true, records: [] };
  if (!orders.ok) return jsonError("orders_query_failed", 502);

  const orderById = new Map(orders.records.map((o) => [o.Id, o]));
  const qtyByOrder = await garmentCountByOrder(env, orderIds);
  const goodByRun = await totalGoodByRun(env, runs.records.map((r) => r.Id));

  const records = runs.records.map((r) => {
    const m = methodById.get(r.PrintMethod__c) || null;
    const o = m && m.Order__c ? orderById.get(m.Order__c) || null : null;
    return {
      id: r.Id,
      name: r.Name,
      methodId: r.PrintMethod__c || null,
      methodType: m ? m.Type__c : null,
      methodStatus: m ? m.Status__c : null,
      placements: m ? m.Placements__c : null,
      orderId: m ? m.Order__c : null,
      orderNumber: o ? o.OrderNumber : null,
      // The shop's own number ("20484-10"), which is what anyone at a press
      // actually calls the job -- OrderNumber is the Salesforce counter and
      // means nothing on the floor. Both are returned; the card leads with this.
      goaNumber: o ? o.GOA_Order_Number__c : null,
      orderName: o ? o.Customer_Order_Name__c : null,
      customer: o && o.Account ? o.Account.Name : null,
      // B20. ABSENT, not 0, when the count could not be established -- see
      // garmentCountByOrder. The card hides the line rather than claiming zero.
      orderQty: (m && m.Order__c && qtyByOrder.has(m.Order__c)) ? qtyByOrder.get(m.Order__c) : null,
      dueDate: o ? o.Customer_Facing_Delivery_Date__c : null,
      pressName: r.Press__r ? r.Press__r.Name : null,
      /* B4. Null covers both "this org has no Print_Location__c" and "this run
         has no placement set" -- the screen says "Placement not recorded" for
         both, because from a counter's side they are the same fact: nobody
         wrote down which pass this was. */
      placement: r[PR_LOCATION_FIELD] || null,
      scheduledStart: r.Scheduled_Start__c,
      actualEnd: r.Actual_End__c,
      scheduledQty: r[RUN_QTY_FIELD],
      resultStatus: r.Result_Status__c || RESULT_DRAFT,
      recordedBy: r.Result_Recorded_By__c,
      recordedAt: r.Result_Recorded_At__c,
      totalPlanned: r.Total_Planned_Qty__c,
      totalIncomplete: r.Total_Incomplete_Qty__c,
      totalMisprint: r.Total_Misprint_Qty__c,
      totalDamaged: r.Total_Damaged_Qty__c,
      // S6. Absent (null) when the org has no Total_Good_Qty__c yet.
      totalGood: goodByRun.has(r.Id) ? goodByRun.get(r.Id) : null,
      // Computed, not stored. A stored "needs rescheduling" checkbox is one
      // more thing that can drift out of step with the numbers underneath it;
      // the roll-up already knows. Same argument _priority.js makes for
      // computing priority at read time instead of maintaining a roll-up field.
      needsReschedule: Number(r.Total_Incomplete_Qty__c) > 0,
    };
  });

  return Response.json({ available: true, records }, { headers: { "Cache-Control": "no-store" } });
}

/** One run and the rows to be counted. */
async function getOneRun(env, runId) {
  const runRes = await runQuery(
    env,
    `SELECT ${RUN_BASE_FIELDS.concat(RUN_RESULT_FIELDS).join(", ")} ` +
      `FROM ${RUN_OBJECT} WHERE Id = ${q(runId)}`,
  );
  if (!runRes.ok) return notAvailable(describeQueryFailure(runRes));
  if (!runRes.records.length) return jsonError("run_not_found", 404);
  const r = runRes.records[0];

  const linesRes = await runQuery(
    env,
    `SELECT ${LINE_FIELDS.join(", ")} FROM ${LINE_OBJECT} ` +
      `WHERE ProductionRun__c = ${q(runId)} ORDER BY Name ASC`,
  );
  if (!linesRes.ok) return notAvailable(describeQueryFailure(linesRes));

  // S6. Separate and fail-open: an org without Run_Result__c (or with it
  // FLS-hidden) keeps the old form rather than losing the run.
  const results = await loadResults(env, runId);
  const goodByLine = new Map();
  if (results) {
    for (const x of results) {
      if (x.goodQty == null) continue;
      goodByLine.set(x.lineId, (goodByLine.get(x.lineId) || 0) + x.goodQty);
    }
  }

  let method = null;
  let order = null;
  if (r.PrintMethod__c) {
    const mRes = await runQuery(
      env,
      `SELECT Id, Type__c, Status__c, Placements__c, Order__c FROM Decoration__c ` +
        `WHERE Id = ${q(r.PrintMethod__c)}`,
    );
    method = mRes.ok && mRes.records.length ? mRes.records[0] : null;
    if (method && method.Order__c) {
      const oRes = await runQuery(
        env,
        `SELECT Id, OrderNumber, GOA_Order_Number__c, Customer_Order_Name__c, Account.Name FROM Order ` +
          `WHERE Id = ${q(method.Order__c)}`,
      );
      order = oRes.ok && oRes.records.length ? oRes.records[0] : null;
    }
  }

  // B20, single-run path. Same fail-open helper the list uses, so the count on
  // the open run's header is the same number its card showed a moment ago.
  const oneQty = method && method.Order__c
    ? (await garmentCountByOrder(env, [method.Order__c])).get(method.Order__c)
    : undefined;

  return Response.json(
    {
      available: true,
      run: {
        id: r.Id,
        name: r.Name,
        methodId: r.PrintMethod__c || null,
        methodType: method ? method.Type__c : null,
        placements: method ? method.Placements__c : null,
        orderId: method ? method.Order__c : null,
        orderNumber: order ? order.OrderNumber : null,
        goaNumber: order ? order.GOA_Order_Number__c : null,
        orderName: order ? order.Customer_Order_Name__c : null,
        customer: order && order.Account ? order.Account.Name : null,
        // null = unknown; the header hides the line rather than showing 0.
        orderQty: oneQty == null ? null : oneQty,
        pressName: r.Press__r ? r.Press__r.Name : null,
        scheduledStart: r.Scheduled_Start__c,
        scheduledQty: r[RUN_QTY_FIELD],
        resultStatus: r.Result_Status__c || RESULT_DRAFT,
        recordedBy: r.Result_Recorded_By__c,
        recordedAt: r.Result_Recorded_At__c,
        lastModifiedDate: r.LastModifiedDate,
      },
      lines: linesRes.records.map((l) => ({
        id: l.Id,
        name: l.Name,
        orderProductId: l.Order_Product__c,
        size: l.Size__c,
        color: l.Color__c,
        plannedQty: l.Planned_Qty__c,
        incompleteQty: l.Incomplete_Qty__c,
        misprintQty: l.Misprint_Qty__c,
        damagedQty: l.Damaged_Qty__c,
        // Summed from the Run Results, not read from Good_Qty__c: naming that
        // field in LINE_FIELDS would break this whole query in production.
        goodQty: goodByLine.has(l.Id) ? goodByLine.get(l.Id) : null,
      })),
      resultsAvailable: !!results,
      results: results || [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * The Run Results under one run, oldest first, or null when the org cannot
 * answer (no Run_Result__c, or FLS). Null is what switches the screen back to
 * the old form.
 */
async function loadResults(env, runId) {
  const res = await runQuery(
    env,
    `SELECT ${RESULT_FIELDS.join(", ")} FROM ${RESULT_OBJECT} ` +
      `WHERE Line_Item__r.ProductionRun__c = ${q(runId)} ORDER BY Counted_At__c ASC, Name ASC`,
  );
  if (!res.ok) {
    console.warn("[run-results] Run_Result__c not queryable; using the legacy form", res.status);
    return null;
  }
  return res.records.map((x) => ({
    id: x.Id,
    name: x.Name,
    lineId: x.Line_Item__c,
    goodQty: x.Good_Qty__c,
    misprintQty: x.Misprint_Qty__c,
    damagedQty: x.Damaged_Qty__c,
    incompleteQty: x.Incomplete_Qty__c,
    countedAt: x.Counted_At__c,
    countedBy: x.Counted_By__c,
    note: x.Note__c,
    goodEstimated: !!x.Good_Qty_Estimated__c,
  }));
}

/**
 * Does the active org have a WORKING Run Result layer?
 *
 * Deliberately the same field list loadResults() uses, not `SELECT Id`. Found in dev2 while
 * testing T6: hiding ONE Run Result field from the dashboard's profile made the GET fall back to
 * the old four-box form (right) while `SELECT Id` still succeeded, so the legacy POST kept
 * refusing typed numbers as "use the new screen" (wrong) -- the page offered boxes nothing would
 * accept. The two decisions have to be made on the same question.
 */
async function resultsLayerExists(env) {
  const res = await runQuery(env, `SELECT ${RESULT_FIELDS.join(", ")} FROM ${RESULT_OBJECT} LIMIT 1`);
  return res.ok;
}

/**
 * Production_Run__c.Total_Good_Qty__c per run, fail-open (S6). A separate query
 * so an org without the roll-up keeps the whole list (trap 1).
 */
async function totalGoodByRun(env, runIds) {
  const out = new Map();
  const ids = [...new Set((runIds || []).filter(Boolean))];
  if (!ids.length) return out;
  try {
    const res = await runChunkedIdQuery(ids, (quoted) =>
      runQuery(env, `SELECT Id, Total_Good_Qty__c FROM ${RUN_OBJECT} WHERE Id IN (${quoted})`),
    );
    if (!res.ok) return out;
    for (const r of res.records) {
      if (r.Total_Good_Qty__c != null) out.set(r.Id, Number(r.Total_Good_Qty__c));
    }
  } catch (e) {
    console.error("run-results total good error", e);
  }
  return out;
}

/** Turn a failed query into something a human can act on. */
function describeQueryFailure(res) {
  const b = res && res.data;
  const first = Array.isArray(b) && b[0] ? b[0] : null;
  if (first && first.message) return `${first.errorCode || "QUERY_FAILED"}: ${first.message}`;
  return `query failed with status ${res && res.status}`;
}

// ---------------------------------------------------------------------------
// POST -- record the counts and submit the run
// ---------------------------------------------------------------------------
export async function onRequestPost({ request, env }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_json", 400);
    }
    if (!body || typeof body !== "object") return jsonError("invalid_body", 400);

    // Counting is floor work, so this gates on a capability the press operator
    // can hold -- NOT runs.schedule, which is a manager's power. Gate is
    // report-only unless ACCESS_ENFORCE=1 (see _session.js); if it is ever
    // switched on, `results.submit` must be granted to workers or the shop
    // loses the ability to record its own output.
    const gate = await requireCap(request, env, "results.submit");
    if (gate.denied) return gate.response;

    const runId = body.runId;
    if (!runId || !SF_ID.test(runId)) return jsonError("missing_runId", 400);

    const by = typeof body.by === "string" && body.by.trim() ? body.by.trim().slice(0, 80) : null;

    // ── S6 actions ──
    if (body.action === "add") return await addCounts(env, runId, body, by);
    if (body.action === "remove") return await removeCount(env, runId, body);
    if (body.action === "submit") return await submitRun(env, runId, by, 0);
    if (body.action === "reopen") {
      // A manager's power: it un-finalises counts the reprint builder trusts.
      const mgr = await requireCap(request, env, "runs.schedule");
      if (mgr.denied) return mgr.response;
      return await reopenRun(env, runId, by);
    }
    if (body.action !== undefined) return jsonError("unknown_action", 400);

    if (!Array.isArray(body.lines)) return jsonError("missing_lines", 400);
    if (body.lines.length > 500) return jsonError("too_many_lines", 400);

    // Parse and validate before writing anything.
    const parsed = [];
    for (const raw of body.lines) {
      if (!raw || typeof raw !== "object") return jsonError("bad_line", 400);
      if (!raw.id || !SF_ID.test(raw.id)) return jsonError("bad_line_id", 400);

      const fields = {};
      for (const [key, field] of Object.entries(COUNT_FIELDS)) {
        if (!(key in raw)) continue;
        const parsedQty = parseQty(raw[key]);
        if (!parsedQty.ok) return Response.json({ error: "bad_quantity", detail: `${raw.id}.${key}` }, { status: 400 });
        // null clears the field -- a counter correcting a mistyped 5 back to
        // blank must be able to, and blank is the model's "nothing wrong here".
        fields[field] = parsedQty.value;
      }
      // No Reject_Reason__c / Notes__c here either -- see LINE_FIELDS above.
      // A write to an FLS-hidden field fails the whole composite sub-request,
      // which would roll back a counter's numbers over a field they never saw.
      if (Object.keys(fields).length) parsed.push({ id: raw.id, fields });
    }

    // Every row must actually belong to THIS run. Without this check a caller
    // could pass any line-item Id in the org and overwrite another run's
    // counts -- the endpoint would happily PATCH them, because Salesforce has
    // no idea which run the request thought it was working on.
    const ownRes = await runQuery(
      env,
      `SELECT Id FROM ${LINE_OBJECT} WHERE ProductionRun__c = ${q(runId)}`,
    );
    if (!ownRes.ok) return jsonError("line_items_query_failed", 502);
    const ownIds = new Set(ownRes.records.map((l) => l.Id));
    // Salesforce returns 18-char Ids; a caller may hold the 15-char form.
    const owns = (id) => ownIds.has(id) || [...ownIds].some((o) => o.slice(0, 15) === id.slice(0, 15));
    const foreign = parsed.filter((p) => !owns(p.id));
    if (foreign.length) {
      return Response.json(
        { error: "line_not_on_run", detail: foreign.map((f) => f.id).join(",") },
        { status: 400 },
      );
    }

    // S6: in an org with Run Results, typed numbers must go through "add".
    // The line fields are sums there, and a direct write would be overwritten
    // by the next Run Result without anyone noticing. An empty submit is fine.
    if (parsed.length && (await resultsLayerExists(env))) {
      return Response.json(
        {
          error: "counting_screen_updated",
          detail: "This org logs each count as a Run Result. Reload the counting screen and add the counts again.",
        },
        { status: 409 },
      );
    }

    const v = apiVersion(env);
    const base = `/services/data/${v}/sobjects`;

    // 1. The counts. Chunked at the composite ceiling of 25 sub-requests.
    for (let i = 0; i < parsed.length; i += COMPOSITE_LIMIT) {
      const chunk = parsed.slice(i, i + COMPOSITE_LIMIT).map((p, n) => ({
        method: "PATCH",
        url: `${base}/${LINE_OBJECT}/${p.id}`,
        referenceId: `l${i}_${n}`,
        body: p.fields,
      }));
      const res = await composite(env, chunk);
      if (!res.ok) {
        console.error("run-results: line item write failed", runId, res.detail);
        return Response.json({ error: "line_write_failed", detail: res.detail }, { status: 502 });
      }
    }

    // 2. Only now stamp the run. See this file's header on write order.
    return await submitRun(env, runId, by, parsed.length);
  } catch (err) {
    console.error("run-results POST failed", err);
    return jsonError("internal_error", 500);
  }
}

/**
 * Stamp the run Submitted, report the totals Salesforce holds, and give the
 * reprint its chance to build. Shared by the legacy POST and action "submit".
 * Moved out of the legacy handler unchanged (S6); see the comments inside.
 */
async function submitRun(env, runId, by, linesUpdated) {
  const base = `/services/data/${apiVersion(env)}/sobjects`;
  const runPayload = {
    Result_Status__c: RESULT_SUBMITTED,
    Result_Recorded_At__c: new Date().toISOString(),
  };
  if (by) runPayload.Result_Recorded_By__c = by;

  const runResp = await sfFetch(env, `${base}/${RUN_OBJECT}/${runId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(runPayload),
  });
  if (runResp.status !== 204) {
    const detail = await runResp.text().catch(() => "");
    console.error("run-results: run submit failed", runId, runResp.status, detail);
    return Response.json({ error: "submit_failed", detail }, { status: 502 });
  }

  // 3. Re-read the line items so the totals reported back are what Salesforce
  // actually holds, not what this request believed it wrote. The roll-ups on
  // the run are recalculated asynchronously and are not safe to read here.
  const afterRes = await runQuery(
    env,
    `SELECT Id, Planned_Qty__c, Incomplete_Qty__c, Misprint_Qty__c, Damaged_Qty__c ` +
      `FROM ${LINE_OBJECT} WHERE ProductionRun__c = ${q(runId)}`,
  );
  const totals = { planned: 0, incomplete: 0, misprint: 0, damaged: 0 };
  if (afterRes.ok) {
    for (const l of afterRes.records) {
      totals.planned += Number(l.Planned_Qty__c) || 0;
      totals.incomplete += Number(l.Incomplete_Qty__c) || 0;
      totals.misprint += Number(l.Misprint_Qty__c) || 0;
      totals.damaged += Number(l.Damaged_Qty__c) || 0;
    }
  }
  // S6: good pieces, from the Run Results. Absent in an org without them.
  const results = await loadResults(env, runId);
  if (results) {
    totals.good = results.reduce((a, x) => a + (Number(x.goodQty) || 0), 0);
  }

  // 4. Resolve the order, then give the rework its second chance to fire.
  //
  // THIS IS THE HALF OF THE TRIGGER THAT WAS MISSING. The other call site is
  // the method-status PATCH, which fires when the last method reaches
  // Completed -- but in the real sequence, printing finishing is what
  // completes the method and counting happens AFTER that, so by the time the
  // numbers exist the triggering event has already gone by. Submitting a run
  // is the other moment where "complete" and "counted" can both become true,
  // so the check belongs here too. createReworkIfNeeded re-checks all of its
  // own preconditions -- including, as of this build, that every method on
  // the order is actually Completed -- so calling it eagerly is safe and
  // returns a named reason when there is nothing to do.
  const { methodId, orderId } = await methodAndOrderForRun(env, runId);
  let rework = null;
  if (orderId) {
    rework = await createReworkIfNeeded(env, orderId, by).catch((e) => {
      console.error("run-results: rework creation failed", orderId, e);
      return null;
    });
    if (rework && rework.created) {
      console.log(
        `rework: created order ${rework.orderId} from ${orderId} via run ${runId} -- ` +
          `${rework.methodCount} decoration(s), ${rework.itemCount} product(s), ${rework.totalQty} garment(s)`,
      );
    }
  }

  return Response.json(
    {
      ok: true,
      runId,
      methodId,
      orderId,
      resultStatus: RESULT_SUBMITTED,
      linesUpdated,
      totals,
      // The client uses this to route the counter to run creation on the SAME
      // method. Incomplete garments are intact and just need press time --
      // they must never become a reprint order.
      incompleteTotal: totals.incomplete,
      needsReschedule: totals.incomplete > 0,
      rework,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function methodAndOrderForRun(env, runId) {
  const runMethod = await runQuery(env, `SELECT PrintMethod__c FROM ${RUN_OBJECT} WHERE Id = ${q(runId)}`);
  const methodId = runMethod.ok && runMethod.records.length ? runMethod.records[0].PrintMethod__c : null;
  let orderId = null;
  if (methodId) {
    orderId = await orderIdForMethod(env, methodId).catch((e) => {
      console.error("run-results: orderIdForMethod failed", methodId, e);
      return null;
    });
  }
  return { methodId, orderId };
}

/** Salesforce REST error body -> {code, message}. */
function sfError(body) {
  const first = Array.isArray(body) && body[0] ? body[0] : null;
  return first ? { code: first.errorCode || "ERROR", message: first.message || "" } : { code: "ERROR", message: "" };
}

/** The run's status and its line-item Ids, or an error Response. */
async function runForWrite(env, runId) {
  const runRes = await runQuery(env, `SELECT Id, Result_Status__c FROM ${RUN_OBJECT} WHERE Id = ${q(runId)}`);
  if (!runRes.ok) return { error: jsonError("run_query_failed", 502) };
  if (!runRes.records.length) return { error: jsonError("run_not_found", 404) };
  const linesRes = await runQuery(env, `SELECT Id FROM ${LINE_OBJECT} WHERE ProductionRun__c = ${q(runId)}`);
  if (!linesRes.ok) return { error: jsonError("line_items_query_failed", 502) };
  const ids = linesRes.records.map((l) => l.Id);
  const find = (id) => ids.find((o) => o === id || o.slice(0, 15) === String(id).slice(0, 15)) || null;
  return { status: runRes.records[0].Result_Status__c || RESULT_DRAFT, findLine: find };
}

function submittedResponse() {
  return Response.json(
    {
      error: "run_submitted",
      detail: "This run's counts are final. A manager has to reopen the run before counts can change.",
    },
    { status: 409 },
  );
}

/** The one-run payload, re-read after a write so the screen shows what Salesforce holds. */
async function freshRun(env, runId, extra) {
  const resp = await getOneRun(env, runId);
  const data = await resp.json().catch(() => null);
  return Response.json(Object.assign({ ok: true }, data || {}, extra || {}), {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * action "add": {runId, counts:[{lineId, goodQty, misprintQty, damagedQty, incompleteQty, note}], by}
 * One Run_Result__c per entry that carries at least one number. All-or-nothing.
 */
async function addCounts(env, runId, body, by) {
  if (!Array.isArray(body.counts) || !body.counts.length) return jsonError("missing_counts", 400);
  if (body.counts.length > 200) return jsonError("too_many_counts", 400);
  if (!(await resultsLayerExists(env))) return jsonError("results_not_available", 409);

  const run = await runForWrite(env, runId);
  if (run.error) return run.error;
  if (run.status === RESULT_SUBMITTED) return submittedResponse();

  const records = [];
  for (const c of body.counts) {
    if (!c || typeof c !== "object" || !c.lineId || !SF_ID.test(c.lineId)) return jsonError("bad_line_id", 400);
    const lineId = run.findLine(c.lineId);
    if (!lineId) return Response.json({ error: "line_not_on_run", detail: c.lineId }, { status: 400 });
    const rec = { attributes: { type: RESULT_OBJECT }, Line_Item__c: lineId };
    let any = false;
    for (const [key, field] of Object.entries(RESULT_COUNT_FIELDS)) {
      const p = parseQty(c[key]);
      if (!p.ok) return Response.json({ error: "bad_quantity", detail: `${c.lineId}.${key}` }, { status: 400 });
      if (p.value != null) {
        rec[field] = p.value;
        any = true;
      }
    }
    if (!any) continue;
    if (typeof c.note === "string" && c.note.trim()) rec.Note__c = c.note.trim().slice(0, NOTE_MAX);
    if (by) rec.Counted_By__c = by;
    rec.Counted_At__c = new Date().toISOString();
    records.push(rec);
  }
  if (!records.length) return jsonError("nothing_to_add", 400);

  // sObject Collections: one call, all-or-none, up to 200 records.
  const resp = await sfFetch(env, `/services/data/${apiVersion(env)}/composite/sobjects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allOrNone: true, records }),
  });
  const data = await resp.json().catch(() => null);
  const failed = !resp.ok || !Array.isArray(data) || data.some((x) => !x || !x.success);
  if (failed) {
    const errs = Array.isArray(data) ? data.flatMap((x) => (x && x.errors) || []) : [];
    const real = errs.find((e) => e.statusCode !== "ALL_OR_NONE_OPERATION_ROLLED_BACK") || errs[0];
    const msg = real ? `${real.statusCode}: ${real.message}` : `HTTP ${resp.status}`;
    console.error("run-results: add failed", runId, JSON.stringify(data));
    // The org's own lock (RunResultRollup) answers in words; keep them.
    if (real && /submitted/i.test(real.message || "")) return submittedResponse();
    return Response.json({ error: "add_failed", detail: msg }, { status: 502 });
  }
  return freshRun(env, runId, { added: records.length });
}

/** action "remove": {runId, resultId} */
async function removeCount(env, runId, body) {
  const resultId = body.resultId;
  if (!resultId || !SF_ID.test(resultId)) return jsonError("missing_resultId", 400);
  const run = await runForWrite(env, runId);
  if (run.error) return run.error;
  if (run.status === RESULT_SUBMITTED) return submittedResponse();

  const own = await runQuery(
    env,
    `SELECT Id, Line_Item__c FROM ${RESULT_OBJECT} WHERE Id = ${q(resultId)}`,
  );
  if (!own.ok) return jsonError("results_not_available", 409);
  if (!own.records.length) return jsonError("result_not_found", 404);
  if (!run.findLine(own.records[0].Line_Item__c)) return jsonError("result_not_on_run", 400);

  const resp = await sfFetch(env, `/services/data/${apiVersion(env)}/sobjects/${RESULT_OBJECT}/${own.records[0].Id}`, {
    method: "DELETE",
  });
  if (resp.status !== 204) {
    const e = sfError(await resp.json().catch(() => null));
    console.error("run-results: remove failed", resultId, resp.status, e.code, e.message);
    if (/submitted/i.test(e.message)) return submittedResponse();
    return Response.json({ error: "remove_failed", detail: `${e.code}: ${e.message}` }, { status: 502 });
  }
  return freshRun(env, runId, { removed: resultId });
}

/**
 * action "reopen": Submitted -> Draft (D28). Says whether a reprint was already
 * built from the old counts: reopening does not change that order.
 */
async function reopenRun(env, runId, by) {
  const run = await runForWrite(env, runId);
  if (run.error) return run.error;
  if (run.status !== RESULT_SUBMITTED) return freshRun(env, runId, { reopened: false });

  const resp = await sfFetch(env, `/services/data/${apiVersion(env)}/sobjects/${RUN_OBJECT}/${runId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Result_Status__c: RESULT_DRAFT }),
  });
  if (resp.status !== 204) {
    const e = sfError(await resp.json().catch(() => null));
    console.error("run-results: reopen failed", runId, resp.status, e.code, e.message);
    return Response.json({ error: "reopen_failed", detail: `${e.code}: ${e.message}` }, { status: 502 });
  }
  console.log(`run-results: run ${runId} reopened by ${by || "unknown"}`);

  let reprintExists = false;
  const { orderId } = await methodAndOrderForRun(env, runId);
  if (orderId) {
    const rx = await runQuery(env, `SELECT Id FROM Order WHERE Original_Production_Order__c = ${q(orderId)} LIMIT 1`);
    reprintExists = !!(rx.ok && rx.records.length);
  }
  return freshRun(env, runId, { reopened: true, reprintExists });
}

/**
 * One composite call. /composite returns HTTP 200 even when a sub-request
 * failed, so every result is inspected individually -- the trap that hid the
 * reprint bug for three test cycles (see _rework.js).
 */
async function composite(env, compositeRequest) {
  const v = apiVersion(env);
  const resp = await sfFetch(env, `/services/data/${v}/composite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allOrNone: true, compositeRequest }),
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    return { ok: false, detail: `unparseable response (${resp.status})` };
  }

  const subs = Array.isArray(data.compositeResponse) ? data.compositeResponse : [];
  const failures = [];
  for (const s of subs) {
    if (s.httpStatusCode >= 400) {
      const b = s.body;
      const first = Array.isArray(b) && b[0] ? b[0] : null;
      failures.push({
        referenceId: s.referenceId,
        code: first ? first.errorCode : "UNKNOWN",
        message: first ? first.message : JSON.stringify(b),
      });
    }
  }
  if (!resp.ok || failures.length) {
    /* B11, 2026-09-09. THE `!resp.ok` HALF IS NOT REDUNDANT -- READ THIS BEFORE
       SIMPLIFYING IT BACK OUT.
       /composite fails in two different shapes and this function used to check
       only one of them:
         1. It accepts the batch, runs it, and reports per-sub-request results
            inside a 200. That is the loop above.
         2. It REFUSES the whole batch -- malformed request, refused token, a
            governor limit -- with a 4xx/5xx whose body is a top-level error
            ARRAY and no compositeResponse at all.
       In case 2 `subs` fell back to [], the loop found nothing, and this
       returned ok:true. The caller took that as a successful write and went on
       to PATCH Result_Status__c = 'Submitted' (see step 2 below).
       That is the worst possible place for a false success: under D1 this app
       stores only problems, so a perfect run and an untouched run are
       byte-identical and Result_Status__c is the ONLY evidence a human counted.
       A refused batch therefore forged exactly that flag -- the run read as
       "counted, nothing wrong" over counts Salesforce had thrown away, gate 4
       of createReworkIfNeeded saw blanks, and the reprint was never built.
       Nothing on any screen can tell the two apart afterwards.
       `_composite.js` says the same thing in one line ("Trap 2: resp.ok alone
       proves nothing") and `run-line-items/index.js` checks it too. This copy
       was the one that drifted. Reproduced against a fake Salesforce answering
       400 with a top-level error array, then re-run after the fix. */
    // allOrNone:true makes every innocent sub-request report PROCESSING_HALTED.
    // Reporting in array order therefore names a bystander and hides the real
    // cause. Same fix as _rework.js -- see the longer note there.
    const real = failures.find((f) => f.code !== "PROCESSING_HALTED") || failures[0];
    // Nothing was logged here at all before, so a refused batch left no trace
    // in the Pages log either -- the defect was silent in both directions.
    console.error("run-results: composite failed", resp.status, JSON.stringify(data));
    return {
      ok: false,
      detail: real
        ? `${real.referenceId}: ${real.code}: ${real.message}`
        : `composite refused: HTTP ${resp.status}`,
    };
  }
  return { ok: true };
}
