/**
 * GET  /api/run-results                 -> runs that can be counted
 * GET  /api/run-results?runId=<id>      -> one run + its line-item rows
 * POST /api/run-results                 -> record the counts and submit the run
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
import { runQuery, sfFetch, apiVersion, jsonError } from "../_sf.js";
import { requireCap } from "../_session.js";
import { orderIdForMethod } from "../_print-date-rollup.js";
import { createReworkIfNeeded } from "../_rework.js";

const RUN_OBJECT = "Production_Run__c";
const LINE_OBJECT = "Production_Run_Line_Items__c";

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

const q = (v) => `'${String(v).replace(/'/g, "")}'`;
const quoteList = (ids) => ids.map(q).join(",");

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
async function getCountableRuns(env, url) {
  const soql =
    `SELECT ${RUN_BASE_FIELDS.concat(RUN_RESULT_FIELDS).join(", ")} FROM ${RUN_OBJECT} ` +
    `WHERE PrintMethod__c IN (` +
    `SELECT Id FROM Production_Method__c WHERE Status__c IN (${quoteList(COUNTABLE_METHOD_STATUSES)})` +
    `) ORDER BY Scheduled_Start__c DESC NULLS LAST LIMIT ${LIST_LIMIT}`;

  const runs = await runQuery(env, soql);
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
        `SELECT Id, Type__c, Status__c, Placements__c, Order__c FROM Production_Method__c ` +
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
      dueDate: o ? o.Customer_Facing_Delivery_Date__c : null,
      pressName: r.Press__r ? r.Press__r.Name : null,
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

  let method = null;
  let order = null;
  if (r.PrintMethod__c) {
    const mRes = await runQuery(
      env,
      `SELECT Id, Type__c, Status__c, Placements__c, Order__c FROM Production_Method__c ` +
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
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
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
    let orderId = null;
    let rework = null;
    const runMethod = await runQuery(
      env,
      `SELECT PrintMethod__c FROM ${RUN_OBJECT} WHERE Id = ${q(runId)}`,
    );
    const methodId = runMethod.ok && runMethod.records.length ? runMethod.records[0].PrintMethod__c : null;
    if (methodId) {
      orderId = await orderIdForMethod(env, methodId).catch((e) => {
        console.error("run-results: orderIdForMethod failed", methodId, e);
        return null;
      });
    }
    if (orderId) {
      rework = await createReworkIfNeeded(env, orderId, by).catch((e) => {
        console.error("run-results: rework creation failed", orderId, e);
        return null;
      });
      if (rework && rework.created) {
        console.log(
          `rework: created order ${rework.orderId} from ${orderId} via run ${runId} -- ` +
            `${rework.methodCount} method(s), ${rework.itemCount} product(s), ${rework.totalQty} garment(s)`,
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
        linesUpdated: parsed.length,
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
  } catch (err) {
    console.error("run-results POST failed", err);
    return jsonError("internal_error", 500);
  }
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
  if (failures.length) {
    // allOrNone:true makes every innocent sub-request report PROCESSING_HALTED.
    // Reporting in array order therefore names a bystander and hides the real
    // cause. Same fix as _rework.js -- see the longer note there.
    const real = failures.find((f) => f.code !== "PROCESSING_HALTED") || failures[0];
    return { ok: false, detail: `${real.referenceId}: ${real.code}: ${real.message}` };
  }
  return { ok: true };
}
