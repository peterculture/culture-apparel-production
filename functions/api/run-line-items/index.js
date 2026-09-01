/**
 * GET   /api/run-line-items?runId=<15/18-char SF Id>
 * GET   /api/run-line-items?methodId=<15/18-char SF Id>
 * PATCH /api/run-line-items
 *
 * The allocation grid behind a production run: which sizes of the parent order
 * this run is printing, and how many of each.
 *
 * Two GET shapes. `runId` answers "what is THIS run printing, and what have the
 * others taken" -- the grid. `methodId` answers only "how much of the order has
 * this method committed in total", which is what the New Run form needs to tell
 * a manager how many garments are still unallocated BEFORE any run exists to
 * ask about. Both return `methodCommitted`, so the grid gets it for free.
 *
 * ── WHO OWNS THESE ROWS ────────────────────────────────────────────────────
 * NOT this endpoint. The Salesforce Flow `Production_Run_Generate_Line_Item_
 * Skeleton` (dev2 + staging) creates every Production_Run_Line_Items__c row,
 * on Production_Run__c create OR update, computing each size's planned quantity
 * as:
 *
 *     that size's OrderItem.Quantity
 *       - SUM(Planned_Qty__c)    across every line on the METHOD
 *       + SUM(Incomplete_Qty__c) across every line on the METHOD
 *
 * (incomplete garments were planned but never reached the press, so they give
 * their capacity back). It has two terminal Create Records elements -- rows
 * with quantities where the remainder covers the size, blank rows otherwise --
 * so every OrderItem on the order ends up with a row either way. It has NO
 * Delete element and never replaces a row.
 *
 * This endpoint therefore only ever PATCHES `Planned_Qty__c` onto rows the Flow
 * already made. Two writers creating the same rows is the collision this design
 * exists to avoid.
 *
 * ── WHY IT NEVER DELETES (CLAUDE.md rule 10) ───────────────────────────────
 * To un-allocate a size, set Planned_Qty__c to 0. Never delete the row.
 *
 * The Flow re-enters on update and its ONLY guard is "does this run have any
 * rows" -- not "were rows generated". Empty a run and the next save to it
 * regenerates the whole skeleton from the arithmetic above, silently
 * overwriting whatever a manager just decided. A row holding 0 keeps that guard
 * satisfied, so zeroing inherits the Flow's idempotency for free.
 *
 * Zero is also arithmetically free everywhere else: it contributes 0 to the
 * Flow's give-back sum, Total_Planned_Qty__c is a SUM roll-up, and _rework.js
 * filters `qty > 0`.
 *
 * 0, NOT null. In this codebase blank means "nobody touched this" and a number
 * means "someone decided" -- counting.html seeds its inputs as '' for exactly
 * that reason. A 0 here records a manager's decision not to print that size on
 * this run, which is a real statement.
 *
 * ── WHAT IS DELIBERATELY ABSENT ────────────────────────────────────────────
 * No create path. Every OrderItem gets a row from the Flow, so a missing row is
 * a signal that something is wrong (a run created before the Flow existed, or a
 * product added to the order afterwards) rather than something to paper over by
 * inventing rows behind the Flow's back.
 *
 * This endpoint does NOT report which OrderItems lack a row, because it never
 * loads the OrderItem list -- that is /api/order-sizes' job and duplicating its
 * SELECT here would be a second place to get the field list wrong. The CLIENT
 * spots them: CAApi.runAllocRows joins the order's sizes against these lines and
 * marks any size with no line as `missing`, which the grid renders as "no row"
 * and refuses to make editable.
 *
 * If creates are ever needed, the row must match the Flow's own shape:
 * ProductionRun__c, Order_Product__c, Size__c, Color__c, Planned_Qty__c.
 * Method__c must NOT be written -- it is a CASESAFEID formula (see
 * rework-check.js) and resolves itself.
 *
 * No writes to Misprint_Qty__c / Damaged_Qty__c / Incomplete_Qty__c. Those
 * belong to /api/run-results and to the person counting, not to the manager
 * allocating. Keeping the two writers separated BY FIELD rather than only by
 * endpoint is what stops an allocation edit from erasing a recorded loss.
 *
 * SECURITY: runId and every line Id are shape-validated before reaching a WHERE
 * clause. The PATCH allow-list is a single field. Every line is re-checked
 * server-side to belong to the named run before it is written, and every
 * quantity is re-validated against the order's own remainder -- the browser's
 * arithmetic is never trusted.
 */
import { runQuery, sfFetch, apiVersion, jsonError, soqlQuote, soqlQuoteList } from "../_sf.js";
import { requireCap } from "../_session.js";

const RUN_OBJECT = "Production_Run__c";
const LINE_OBJECT = "Production_Run_Line_Items__c";

// The ONLY field this endpoint may write. See the header.
const PLANNED_FIELD = "Planned_Qty__c";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;
const COMPOSITE_LIMIT = 25;   // hard Salesforce ceiling -- chunk beyond this
const MAX_QTY = 99999;

/* Escaping lives in _sf.js now. These were five diverging copies that
   stripped apostrophes and let backslashes through -- a trailing "\\"
   escaped the closing quote and killed the query. Local aliases so every
   call site below reads unchanged. */
const q = soqlQuote;
const quoteList = soqlQuoteList;

/* Every one of these is already selected by run-results/index.js or
   rework-check.js against the same object, so all are proven visible to the
   integration user. Naming an FLS-hidden field here would not blank a column --
   it would make the whole SELECT a parse error and empty the grid. See
   CLAUDE.md rule 1. */
const LINE_FIELDS = [
  "Id",
  "Name",
  "ProductionRun__c",
  "Order_Product__c",
  "Size__c",
  "Color__c",
  "Planned_Qty__c",
  "Incomplete_Qty__c",
];

/** The org has not had the production-result fields deployed yet. */
function notAvailable(detail) {
  return Response.json(
    { available: false, detail: detail || "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function describeQueryFailure(res) {
  const b = res && res.data;
  const first = Array.isArray(b) && b[0] ? b[0] : null;
  return first ? `${first.errorCode}: ${first.message}` : `status ${res && res.status}`;
}

/**
 * Everything the grid needs about one run, plus the method-wide allocation the
 * remainder is computed from.
 *
 * The OrderItem rows themselves are NOT returned here -- the client already
 * fetches them from /api/order-sizes for the drawer, and duplicating that
 * SELECT would be a second place to get the field list wrong.
 */
async function loadRun(env, runId) {
  const runRes = await runQuery(
    env,
    `SELECT Id, Name, PrintMethod__c FROM ${RUN_OBJECT} WHERE Id = ${q(runId)}`,
  );
  if (!runRes.ok) return { error: notAvailable(describeQueryFailure(runRes)) };
  if (!runRes.records.length) return { error: jsonError("run_not_found", 404) };

  const run = runRes.records[0];
  const methodId = run.PrintMethod__c;
  if (!methodId) return { error: jsonError("run_has_no_method", 409) };

  /* Every line on the METHOD, not just this run: the remainder for a size is a
     method-wide figure, and it is the same sum the Flow computes. Method__c is
     a CASESAFEID formula on the line item, which is what lets this reach every
     line without walking run by run. */
  const linesRes = await runQuery(
    env,
    `SELECT ${LINE_FIELDS.join(", ")} FROM ${LINE_OBJECT} ` +
      `WHERE Method__c = ${q(methodId)} ORDER BY Name ASC`,
  );
  if (!linesRes.ok) return { error: notAvailable(describeQueryFailure(linesRes)) };

  return { run, methodId, lines: linesRes.records };
}

/**
 * Every line on one METHOD, without needing a run to hang the question on.
 * Method__c is a CASESAFEID formula on the line item, which is what lets this
 * reach every line across every run in one query.
 */
async function loadMethodLines(env, methodId) {
  const res = await runQuery(
    env,
    `SELECT ${LINE_FIELDS.join(", ")} FROM ${LINE_OBJECT} ` +
      `WHERE Method__c = ${q(methodId)} ORDER BY Name ASC`,
  );
  if (!res.ok) return { error: notAvailable(describeQueryFailure(res)) };
  return { lines: res.records };
}

/**
 * How much of the order this METHOD has committed, across every one of its
 * runs: planned MINUS incomplete, the skeleton Flow's own arithmetic. The
 * caller subtracts it from the order's own garment total to get what is still
 * unallocated -- see CAApi.runQtyHint's third argument.
 */
function methodCommittedTotal(lines) {
  return (lines || []).reduce(function (a, l) {
    if (!l.Order_Product__c) return a;             // non-size row
    return a + (Number(l[PLANNED_FIELD]) || 0) - (Number(l.Incomplete_Qty__c) || 0);
  }, 0);
}

/** The parent order's Id, for the caller to pair with /api/order-sizes. */
async function orderIdForMethod(env, methodId) {
  const res = await runQuery(
    env,
    `SELECT Order__c FROM Production_Method__c WHERE Id = ${q(methodId)}`,
  );
  return (res.ok && res.records[0] && res.records[0].Order__c) || null;
}

/**
 * Per OrderItem, how much of the order this method has already committed.
 *
 * Mirrors the Flow's arithmetic exactly -- planned MINUS incomplete -- so the
 * app and the Flow can never disagree about what is left. `excludeRunId` drops
 * one run's own contribution, which is what makes "what may THIS run have"
 * answerable: its current allocation is being replaced, not added to.
 */
function allocationByOrderProduct(lines, excludeRunId) {
  const out = new Map();
  for (const l of lines) {
    const opId = l.Order_Product__c;
    if (!opId) continue;                       // no OrderItem -> not a size row
    if (excludeRunId && l.ProductionRun__c === excludeRunId) continue;
    const planned = Number(l[PLANNED_FIELD]) || 0;
    const incomplete = Number(l.Incomplete_Qty__c) || 0;
    out.set(opId, (out.get(opId) || 0) + planned - incomplete);
  }
  return out;
}

export async function onRequestGet({ env, request }) {
  try {
    const params = new URL(request.url).searchParams;
    const runId = (params.get("runId") || "").trim();
    const methodOnly = (params.get("methodId") || "").trim();

    /* methodId form: no run, no grid -- just the committed total. Used by the
       New Run form, which has to say what is unallocated before a run exists. */
    if (!runId && methodOnly) {
      if (!SF_ID.test(methodOnly)) return jsonError("invalid_method_id", 400);
      const ml = await loadMethodLines(env, methodOnly);
      if (ml.error) return ml.error;
      return Response.json(
        {
          available: true,
          methodId: methodOnly,
          orderId: await orderIdForMethod(env, methodOnly),
          methodCommitted: methodCommittedTotal(ml.lines),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!SF_ID.test(runId)) return jsonError("invalid_run_id", 400);

    const loaded = await loadRun(env, runId);
    if (loaded.error) return loaded.error;
    const { run, methodId, lines } = loaded;

    const mine = lines.filter((l) => l.ProductionRun__c === runId);
    const elsewhere = allocationByOrderProduct(lines, runId);

    return Response.json(
      {
        available: true,
        runId,
        runName: run.Name,
        methodId,
        orderId: await orderIdForMethod(env, methodId),
        /* This run's own rows -- one per size the Flow created. */
        lines: mine.map((l) => ({
          id: l.Id,
          name: l.Name,
          orderProductId: l.Order_Product__c,
          size: l.Size__c,
          color: l.Color__c,
          plannedQty: l[PLANNED_FIELD] == null ? null : Number(l[PLANNED_FIELD]),
          incompleteQty: l.Incomplete_Qty__c == null ? null : Number(l.Incomplete_Qty__c),
        })),
        /* What the OTHER runs on this method have committed, per OrderItem.
           The client subtracts this (and the order's own quantity, from
           /api/order-sizes) to show the remainder. Returned rather than a
           finished "remaining" figure because the OrderItem quantities do not
           come from this endpoint. */
        allocatedElsewhere: Array.from(elsewhere.entries()).map(([orderProductId, qty]) => ({
          orderProductId,
          qty,
        })),
        /* Every run on the method, this one included -- the figure the qty hint
           subtracts from the order total. */
        methodCommitted: methodCommittedTotal(lines),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("run-line-items GET failed", err);
    return jsonError("internal_error", 500);
  }
}

/**
 * PATCH body:
 *   { "runId": "a0R…", "updates": [ { "id": "a0S…", "plannedQty": 24 }, … ] }
 *
 * plannedQty is a non-negative integer. 0 means "this run is not printing this
 * size" -- see the header on why that is a write and not a delete.
 */
export async function onRequestPatch({ env, request }) {
  const gate = await requireCap(request, env, "runs.schedule");
  if (gate.denied) return gate.response;
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_json", 400);
    }
    if (!body || typeof body !== "object") return jsonError("invalid_body", 400);

    const runId = String(body.runId || "").trim();
    if (!SF_ID.test(runId)) return jsonError("invalid_run_id", 400);

    const updates = Array.isArray(body.updates) ? body.updates : null;
    if (!updates || !updates.length) return jsonError("no_updates", 400);

    // --- shape-validate every element before touching Salesforce ---
    const wanted = new Map();
    for (const u of updates) {
      if (!u || typeof u !== "object") return jsonError("invalid_update", 400);
      const id = String(u.id || "").trim();
      if (!SF_ID.test(id)) return jsonError("invalid_line_id", 400);
      const n = Number(u.plannedQty);
      if (!Number.isInteger(n) || n < 0 || n > MAX_QTY) {
        return Response.json(
          { error: "invalid_quantity", detail: `Line ${id}: quantity must be a whole number between 0 and ${MAX_QTY}.` },
          { status: 400 },
        );
      }
      wanted.set(id, n);
    }

    const loaded = await loadRun(env, runId);
    if (loaded.error) return loaded.error;
    const { methodId, lines } = loaded;

    const byId = new Map(lines.map((l) => [l.Id, l]));

    /* Every line must exist AND belong to the named run. Without this a caller
       could pass any line Id and rewrite another run's allocation. */
    for (const id of wanted.keys()) {
      const line = byId.get(id);
      if (!line) return jsonError("line_not_found", 404);
      if (line.ProductionRun__c !== runId) return jsonError("line_not_on_this_run", 409);
    }

    /* --- the order's own quantities, to validate the remainder against ---
       Fields match /api/order-sizes' SELECT, so all are proven visible. */
    const orderId = await orderIdForMethod(env, methodId);
    if (!orderId) return jsonError("method_has_no_order", 409);

    const itemsRes = await runQuery(
      env,
      `SELECT Id, Size__c, Color__c, Quantity FROM OrderItem WHERE OrderId = ${q(orderId)}`,
    );
    if (!itemsRes.ok) return notAvailable(describeQueryFailure(itemsRes));
    const orderQtyById = new Map(
      itemsRes.records.map((r) => [r.Id, Number(r.Quantity) || 0]),
    );
    const labelById = new Map(
      itemsRes.records.map((r) => [r.Id, [r.Size__c, r.Color__c].filter(Boolean).join(" · ") || "this size"]),
    );

    /* Committed by the OTHER runs on this method. Recomputed here rather than
       taken from the request: the browser's figure can be stale by the time it
       arrives, and it is exactly the number that decides whether a write is
       allowed. */
    const elsewhere = allocationByOrderProduct(lines, runId);

    /* A run may allocate at most what the order has left for that size after
       every other run on the method. Refused by NAME and with the remainder, so
       the message is actionable at the press rather than just a rejection. */
    for (const [id, qty] of wanted.entries()) {
      const line = byId.get(id);
      const opId = line.Order_Product__c;
      if (!opId) continue;                       // non-size row: nothing to bound it by
      const orderQty = orderQtyById.get(opId);
      if (orderQty == null) continue;            // OrderItem gone: not this endpoint's call to make
      const remaining = orderQty - (elsewhere.get(opId) || 0);
      if (qty > remaining) {
        return Response.json(
          {
            error: "over_allocated",
            detail:
              `${labelById.get(opId)}: only ${remaining} left to allocate on this order` +
              ` (${orderQty} ordered, ${orderQty - remaining} already planned on other runs).` +
              ` You asked for ${qty}.`,
            orderProductId: opId,
            requested: qty,
            remaining,
          },
          { status: 409 },
        );
      }
    }

    // --- write. One field, chunked at the composite ceiling. ---
    const v = apiVersion(env);
    const entries = Array.from(wanted.entries());
    for (let i = 0; i < entries.length; i += COMPOSITE_LIMIT) {
      const chunk = entries.slice(i, i + COMPOSITE_LIMIT).map(([id, qty], n) => ({
        method: "PATCH",
        url: `/services/data/${v}/sobjects/${LINE_OBJECT}/${id}`,
        referenceId: `line${i + n}`,
        body: { [PLANNED_FIELD]: qty },
      }));
      const res = await composite(env, chunk);
      if (!res.ok) return res.response;
    }

    return Response.json(
      { ok: true, runId, updated: entries.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("run-line-items PATCH failed", err);
    return jsonError("internal_error", 500);
  }
}

/**
 * One composite call.
 *
 * /composite returns HTTP 200 even when every sub-request failed, so the array
 * is inspected entry by entry. With allOrNone:true the innocent sub-requests
 * report PROCESSING_HALTED -- reporting the first failure in array order names
 * a bystander and hides the cause, so the first NON-halted failure wins and the
 * referenceId it came from is returned with it. Same handling as
 * run-results/index.js and production-methods/index.js.
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
    /* empty or non-JSON body */
  }

  const subs = Array.isArray(data && data.compositeResponse) ? data.compositeResponse : [];
  const isErr = (r) => r.httpStatusCode < 200 || r.httpStatusCode >= 300;
  const codeOf = (r) =>
    (Array.isArray(r.body) && r.body[0] && r.body[0].errorCode) || "";

  const errored = subs.filter(isErr);
  const realFailure =
    errored.find((r) => codeOf(r) !== "PROCESSING_HALTED") || errored[0] || null;

  if (!resp.ok || realFailure) {
    console.error("run-line-items composite failed", resp.status, JSON.stringify(data));
    return {
      ok: false,
      response: Response.json(
        {
          error: "update_failed",
          failedRef: realFailure ? realFailure.referenceId : null,
          detail: realFailure ? realFailure.body : data,
        },
        { status: 502 },
      ),
    };
  }
  return { ok: true };
}
