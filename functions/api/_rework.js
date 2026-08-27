/**
 * When a production order finishes, turn its damage into a reprint.
 *
 * WHAT THIS REPLACES. functions/api/orders/[id]/reprint.js and the drawer form
 * that called it. That path required a manager to open a drawer, re-read the
 * run sheets, and type the misprint counts a second time -- numbers the shop
 * had already written down once. It also created only an Order + OrderItems,
 * with no Production Method, so every reprint then had to be routed through
 * Create Production Method by hand. This module does the whole thing from
 * numbers that already exist, at the moment they become final.
 *
 * WHEN IT FIRES. rollupOrderSubstatus() (see _pm-rollup.js) recomputes
 * Order.Order_Substatus__c from the least-advanced method every time a method
 * changes. When that roll-up lands on 'Completed', every method on the order is
 * done -- which is the moment this runs. It is called from
 * production-methods/[id].js, immediately after that roll-up.
 *
 * DELIBERATELY NOT orders/[id]/complete.js. That endpoint is the SHIPPING
 * dashboard saying the order left the building, which is far too late: if
 * garments were damaged the order cannot fully ship yet. Production completion
 * and shipping completion are two different events in this app and this is the
 * production one.
 *
 * THE GATE IS 'Submitted', NOT 'has numbers'. A run whose counts are still
 * being typed looks exactly like a run that went perfectly -- both are blank,
 * because the model records only problems (see the Production Result design
 * notes). Result_Status__c = 'Submitted' is the only thing that distinguishes
 * "counted, all fine" from "nobody has touched this yet", so every run on the
 * order must be Submitted before a single record is created. Without that gate
 * an order finishing before the counts are in would silently produce no
 * reprint at all, and nobody would notice until the customer did.
 *
 * INCOMPLETE IS NOT HANDLED HERE, ON PURPOSE. Incomplete garments are intact
 * and staged -- they never went through the press. They need press time on the
 * SAME method, not a reprint, and they are handled at data-entry time by the
 * run-creation redirect. Only Damaged + Misprint reach this module. Anything
 * that merges the two makes recording damage silently change the number of
 * garments a manager is told to reschedule.
 *
 * WHY IT GROUPS BY ORDER PRODUCT. An earlier design said not to group -- one
 * reprint line per damaged line item, even where several shared a size. That
 * was a workaround for Flow, which has no maps, and it is wrong here: a shirt
 * damaged during back-printing on a two-method order would be counted once per
 * method and you would order two blanks to replace one garment. Summing per
 * Order Product across every method gives one replacement per ruined garment,
 * with all of its decorations rebuilt.
 */
import { sfFetch, apiVersion, runQuery } from "./_sf.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

/** Salesforce hard-caps a composite call at 25 sub-requests. */
const COMPOSITE_LIMIT = 25;

/**
 * Order fields copied onto the reprint. Same list ORIGINAL_ORDER_FIELDS used in
 * reprint.js, which was confirmed field-by-field against Setup on 2026-07-27 --
 * kept verbatim rather than trimmed, because an org-required field left off
 * fails the whole call.
 *
 * NOTE WHAT IS ABSENT: Receiving_Status__c. The reprint needs new blanks that
 * nobody has ordered yet, so receiving must start empty rather than inheriting
 * the original's "received". Do not add it to this list.
 */
const CLONED_ORDER_FIELDS = [
  "AccountId",
  "BillToContactId",
  "ShipToContactId",
  "Customer_Facing_Delivery_Date__c",
  "Customer_Order_Name__c",
  "Decoration_Method__c",
  "OpportunityId",
  "Pricebook2Id",
  "Printer__c",
  "RecordTypeId",
  "Shipping_Delivery__c",
  "Special_Notes__c",
  "Specifications_for_Printing__c",
  "Type",
];

/** Everything Salesforce needs to insert an OrderItem, minus OrderId/Quantity. */
const CLONED_ITEM_FIELDS = ["Product2Id", "PricebookEntryId", "UnitPrice", "Description", "Color__c", "Size__c"];

/**
 * Pre-Production Item state on the clone, by type.
 *
 * The split is physical, not arbitrary. A burned screen, mixed ink, matched
 * thread and a digitised file all still EXIST after the run -- making prep redo
 * them is pure waste, so they clone as Ready. A transfer is consumed the moment
 * it is heat-applied, and it was consumed on the garment that got ruined, so a
 * reprint genuinely needs new ones printed.
 *
 * _ppi-checklist.js recomputes the method's own checkbox from its items, so
 * setting these correctly is what makes the mirrored method show the right prep
 * state on the board without anyone touching it.
 */
const CONSUMED_ITEM_TYPES = new Set(["Transfer"]);
const ITEM_STATUS_REUSABLE = "Ready";
const ITEM_STATUS_CONSUMED = "Not Started";

/** Type-specific fields, copied only onto the matching item type. */
const ITEM_FIELDS_BY_TYPE = {
  Screen: ["Mesh_Count__c"],
  Ink: ["Pantone_Color__c"],
  Thread: ["Thread_Color__c", "Thread_Number__c"],
  Digitization: ["Stitch_Count__c"],
  Transfer: ["Transfer_Type__c"],
};

const q = (id) => `'${String(id).replace(/'/g, "")}'`;
const quoteList = (ids) => ids.map(q).join(",");

/**
 * Something failed. Log it and say which thing, in the RESPONSE, not just the
 * log.
 *
 * This exists because the first version returned a bare null on every query
 * failure, which is indistinguishable in the API response from "there was
 * nothing to rework" -- the single most common healthy outcome. A silently
 * mistyped relationship name therefore looked exactly like a clean order, and
 * cost an afternoon to find. Never collapse a failure into the success shape.
 *
 * 2026-08-27: that first pass only converted the QUERY failures. The four
 * failures in the build itself (composite head, composite tail, method
 * overflow, thrown exception) were still returning bare null, so a reprint
 * that passed every gate and then died inside Salesforce's composite API
 * reported `"rework": null` -- again indistinguishable from a clean order,
 * again only visible in Cloudflare's logs. `detail` carries Salesforce's own
 * errorCode/message straight back to the caller so the next failure names
 * itself on the first try instead of the third.
 */
function fail(reason, orderId, detail) {
  console.error(`rework: ${reason} for order ${orderId}`, detail == null ? "" : detail);
  const out = { created: false, reason, failed: true };
  if (detail != null) out.detail = typeof detail === "string" ? detail : String(detail);
  return out;
}

/**
 * Create the reprint order for one finished production order, if it needs one.
 *
 * Returns { created: false, reason } when no reprint is warranted -- that is the
 * normal, common outcome and is never an error. Returns { created: true, orderId,
 * methodCount, itemCount, totalQty } when one was built. Returns null only on a
 * genuine failure, which is logged.
 *
 * @param {object} env      Cloudflare env (Salesforce creds live here)
 * @param {string} orderId  the ORIGINAL production order
 * @param {string} [by]     worker name, stamped as Last_Updated_By__c
 */
export async function createReworkIfNeeded(env, orderId, by) {
  if (!SF_ID.test(orderId || "")) return { created: false, reason: "invalid_id" };

  try {
    // ---------------------------------------------------------------------
    // 1. Idempotency, checked FIRST because it is the cheapest bail-out.
    //
    // This function runs off a roll-up that fires on every method change, and
    // Order_Substatus__c is directly PATCHable from orders/[id].js, so landing
    // on 'Completed' more than once is expected, not exceptional. Without this
    // check a re-save would order a second set of replacement garments.
    // ---------------------------------------------------------------------
    const existing = await runQuery(
      env,
      `SELECT Id FROM Order WHERE Original_Production_Order__c = ${q(orderId)} LIMIT 1`,
    );
    if (!existing.ok) return fail("idempotency_query_failed", orderId);
    if (existing.records.length) {
      return { created: false, reason: "already_reworked", orderId: existing.records[0].Id };
    }

    // ---------------------------------------------------------------------
    // 2. Every run must be Submitted. See the header -- blank counts are
    //    ambiguous, so "no numbers yet" and "went perfectly" are the same
    //    shape and only Result_Status__c can tell them apart.
    // ---------------------------------------------------------------------
    // Semi-join, NOT PrintMethod__r.Order__c. A custom lookup's relationship
    // name is whatever was typed when the field was created and is not
    // guaranteed to be the field name minus __c -- guessing it wrong makes the
    // whole SELECT a parse error, which surfaces as zero rows rather than an
    // exception. _print-date-rollup.js walks Order -> runs the same way for the
    // same reason; match it rather than inventing a second idiom.
    const runs = await runQuery(
      env,
      `SELECT Id, Result_Status__c FROM Production_Run__c ` +
        `WHERE PrintMethod__c IN (SELECT Id FROM Production_Method__c WHERE Order__c = ${q(orderId)})`,
    );
    if (!runs.ok) return fail("runs_query_failed", orderId);
    if (!runs.records.length) return { created: false, reason: "no_runs" };

    const unsubmitted = runs.records.filter((r) => r.Result_Status__c !== "Submitted");
    if (unsubmitted.length) {
      return { created: false, reason: "runs_not_submitted", pending: unsubmitted.length };
    }

    // ---------------------------------------------------------------------
    // 3. Every method must be finished, and what was ruined on each.
    //
    // THE COMPLETION CHECK LIVES HERE, NOT IN THE CALLER. It used to be
    // implicit: there was one call site, the method-status PATCH, and it only
    // called this function when the substatus roll-up returned 'Completed', so
    // "all methods done" was already established by the time we got here.
    //
    // That stopped being true when the counting screen became a second caller.
    // Counting happens per RUN, and a run can be counted while sibling methods
    // are still on the press -- so without this check, counting the first of
    // two methods would order replacement garments for a job that is still
    // half-printed, and the idempotency guard would then block the real reprint
    // when the order genuinely finished. A precondition that only holds because
    // of who calls you is not a precondition; it is a coincidence.
    //
    // Cancelled methods are excluded throughout, matching _pm-rollup.js: a
    // cancelled method must not hold the order back, and must not be mirrored
    // onto the reprint either.
    // ---------------------------------------------------------------------
    const methodsRes = await runQuery(
      env,
      `SELECT Id, Type__c, Status__c, Placements__c, Vendor__c ` +
        `FROM Production_Method__c WHERE Order__c = ${q(orderId)}`,
    );
    if (!methodsRes.ok) return fail("methods_query_failed", orderId);

    const methods = {
      records: methodsRes.records.filter((m) => m.Status__c !== "Cancelled"),
    };
    if (!methods.records.length) return { created: false, reason: "no_methods" };

    const unfinished = methods.records.filter((m) => m.Status__c !== "Completed");
    if (unfinished.length) {
      return { created: false, reason: "methods_not_complete", pending: unfinished.length };
    }

    const methodIds = methods.records.map((m) => m.Id);

    // Method__c is the formula (CASESAFEID of the run's PrintMethod__c) added
    // for exactly this kind of grouping -- it lets one query reach every line
    // item on the order without walking run-by-run.
    const lines = await runQuery(
      env,
      `SELECT Id, Method__c, Order_Product__c, Damaged_Qty__c, Misprint_Qty__c ` +
        `FROM Production_Run_Line_Items__c WHERE Method__c IN (${quoteList(methodIds)})`,
    );
    if (!lines.ok) return fail("line_items_query_failed", orderId);

    // Damaged + Misprint are the same kind of loss: the garment is spent and
    // needs a fresh blank and a fresh print. Incomplete is deliberately absent.
    const damaged = lines.records
      .map((l) => ({
        methodId: l.Method__c,
        orderProductId: l.Order_Product__c,
        qty: (Number(l.Damaged_Qty__c) || 0) + (Number(l.Misprint_Qty__c) || 0),
      }))
      .filter((l) => l.qty > 0 && l.orderProductId);

    if (!damaged.length) return { created: false, reason: "nothing_to_rework" };

    // One replacement garment per ruined garment, however many methods touched
    // it -- see the header note on grouping.
    const qtyByOrderProduct = new Map();
    for (const d of damaged) {
      qtyByOrderProduct.set(d.orderProductId, (qtyByOrderProduct.get(d.orderProductId) || 0) + d.qty);
    }

    // Only mirror methods that actually lost something. A two-method order
    // where only the front print was damaged gets a one-method reprint.
    const affectedMethodIds = [...new Set(damaged.map((d) => d.methodId))].filter(Boolean);
    const affectedMethods = methods.records.filter((m) => affectedMethodIds.includes(m.Id));
    if (!affectedMethods.length) return { created: false, reason: "no_affected_methods" };

    // ---------------------------------------------------------------------
    // 4. Read what we are cloning.
    // ---------------------------------------------------------------------
    const [orderRes, itemsRes, ppiRes] = await Promise.all([
      runQuery(env, `SELECT ${CLONED_ORDER_FIELDS.join(", ")} FROM Order WHERE Id = ${q(orderId)}`),
      runQuery(
        env,
        `SELECT Id, ${CLONED_ITEM_FIELDS.join(", ")} FROM OrderItem ` +
          `WHERE Id IN (${quoteList([...qtyByOrderProduct.keys()])})`,
      ),
      runQuery(
        env,
        `SELECT Id, Production_Method__c, Type__c, Mesh_Count__c, Pantone_Color__c, ` +
          `Thread_Color__c, Thread_Number__c, Stitch_Count__c, Transfer_Type__c ` +
          `FROM Pre_Production_Item__c WHERE Production_Method__c IN (${quoteList(affectedMethodIds)})`,
      ),
    ]);
    if (!orderRes.ok) return fail("order_query_failed", orderId);
    if (!itemsRes.ok) return fail("order_products_query_failed", orderId);
    if (!ppiRes.ok) return fail("pre_production_items_query_failed", orderId);
    if (!orderRes.records.length) return fail("original_order_not_found", orderId);

    const original = orderRes.records[0];

    // ---------------------------------------------------------------------
    // 5. Build it.
    //
    // The tree is deeper than "an order with a method":
    //   Order -> ProductionRequirements__c -> ProductionPlan__c
    //         -> Production_Method__c -> Pre_Production_Item__c
    // The first three are master-detail, so they must exist before their
    // children and cannot be reparented afterwards.
    // ---------------------------------------------------------------------
    const v = apiVersion(env);
    const base = `/services/data/${v}/sobjects`;

    // Cloned fields first, then the values that must NOT be inherited.
    const orderBody = {};
    for (const f of CLONED_ORDER_FIELDS) {
      if (original[f] != null) orderBody[f] = original[f];
    }
    Object.assign(orderBody, {
      // EffectiveDate ("Order Start Date") is a REQUIRED standard field on
      // Order. The first version of this file left it off, and the whole
      // composite died with REQUIRED_FIELD_MISSING -- invisibly, because
      // /composite returns HTTP 200 even when every sub-request failed, and
      // because this function then collapsed that into a bare null. reprint.js
      // has always set these; it is the working reference for what this org
      // needs to insert an Order, so match it rather than rediscovering it.
      EffectiveDate: new Date().toISOString().slice(0, 10),
      IsReductionOrder: false,
      Status: "Pre-Production",
      Order_Substatus__c: "Pre-Production",
      Original_Production_Order__c: orderId,
      // Drives the reprint badge on the pre-production board
      // (isReprint: !!r.Misprint__c in pre-production.html). Without it the
      // reprint reaches the floor looking like an ordinary new job, and the
      // person picking it up has no signal that it is replacing ruined stock.
      Misprint__c: true,
    });
    if (by) orderBody.Last_Updated_By__c = by;

    // Head chunk: everything that later records reference by @{ref.id}. Those
    // references only resolve WITHIN one composite call, so the order, its
    // requirement, its plan and every method have to travel together.
    const head = [
      { method: "POST", url: `${base}/Order`, referenceId: "order", body: orderBody },
      {
        method: "POST",
        url: `${base}/ProductionRequirements__c`,
        referenceId: "req",
        body: { Order__c: "@{order.id}" },
      },
      {
        method: "POST",
        url: `${base}/ProductionPlan__c`,
        referenceId: "plan",
        body: { ProductionRequirement__c: "@{req.id}" },
      },
    ];

    affectedMethods.forEach((m, i) => {
      const body = {
        ProductionPlan__c: "@{plan.id}",
        Order__c: "@{order.id}",
        Status__c: "Pre-Production",
        Type__c: m.Type__c,
      };
      if (m.Vendor__c) body.Vendor__c = m.Vendor__c;
      if (m.Placements__c) body.Placements__c = m.Placements__c;
      if (by) body.Last_Updated_By__c = by;
      head.push({ method: "POST", url: `${base}/Production_Method__c`, referenceId: `pm${i}`, body });
    });

    if (head.length > COMPOSITE_LIMIT) {
      // Only reachable with ~22 damaged methods on one order, which would mean
      // something is very wrong upstream. Fail loudly rather than half-build.
      return fail("too_many_methods", orderId, `${affectedMethods.length} affected methods`);
    }

    const headRes = await composite(env, head);
    if (!headRes.ok) return fail("head_composite_failed", orderId, headRes.detail);

    const newOrderId = headRes.ids.order;
    const newMethodIds = affectedMethods.map((_, i) => headRes.ids[`pm${i}`]);
    const methodIdMap = new Map(affectedMethods.map((m, i) => [m.Id, newMethodIds[i]]));

    // Tail: children that only needed real Ids, so they can be chunked freely.
    const tail = [];

    ppiRes.records.forEach((p) => {
      const newMethodId = methodIdMap.get(p.Production_Method__c);
      if (!newMethodId) return;
      const body = {
        Production_Method__c: newMethodId,
        Type__c: p.Type__c,
        Status__c: CONSUMED_ITEM_TYPES.has(p.Type__c) ? ITEM_STATUS_CONSUMED : ITEM_STATUS_REUSABLE,
      };
      for (const f of ITEM_FIELDS_BY_TYPE[p.Type__c] || []) {
        if (p[f] != null) body[f] = p[f];
      }
      if (by) body.Last_Updated_By__c = by;
      tail.push({ method: "POST", url: `${base}/Pre_Production_Item__c`, body });
    });

    let totalQty = 0;
    itemsRes.records.forEach((it) => {
      const qty = qtyByOrderProduct.get(it.Id) || 0;
      if (qty <= 0) return;
      totalQty += qty;
      const body = { OrderId: newOrderId, Quantity: qty };
      for (const f of CLONED_ITEM_FIELDS) {
        if (it[f] != null) body[f] = it[f];
      }
      tail.push({ method: "POST", url: `${base}/OrderItem`, body });
    });

    // ---------------------------------------------------------------------
    // 6. Send the tail in chunks, and undo everything if any chunk fails.
    //
    // allOrNone only covers ONE composite call, so a multi-chunk build has no
    // native atomicity. A half-built reprint order -- right garments, missing
    // screens -- is worse than none at all, because it looks finished on the
    // board. Deleting the Order cascades through Requirement, Plan, Method and
    // OrderItem (all master-detail); Pre-Production Items hang off a lookup and
    // are cleaned up explicitly.
    // ---------------------------------------------------------------------
    const createdIds = [];
    for (let i = 0; i < tail.length; i += COMPOSITE_LIMIT) {
      const chunk = tail.slice(i, i + COMPOSITE_LIMIT).map((r, n) => ({ ...r, referenceId: `t${i}_${n}` }));
      const res = await composite(env, chunk);
      if (!res.ok) {
        await rollback(env, newOrderId, createdIds);
        return fail("tail_composite_failed", orderId, res.detail);
      }
      createdIds.push(...Object.values(res.ids));
    }

    return {
      created: true,
      orderId: newOrderId,
      methodCount: affectedMethods.length,
      itemCount: qtyByOrderProduct.size,
      totalQty,
    };
  } catch (e) {
    return fail("threw", orderId, (e && e.stack) || (e && e.message) || String(e));
  }
}

/**
 * One composite call. /composite returns HTTP 200 even when a sub-request
 * failed, so every result is inspected individually -- the same trap
 * production-methods/index.js documents.
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
  const ids = {};
  for (const s of subs) {
    if (s.httpStatusCode >= 400) {
      const b = s.body;
      const detail = Array.isArray(b) && b[0] ? `${b[0].errorCode}: ${b[0].message}` : JSON.stringify(b);
      return { ok: false, detail };
    }
    if (s.body && s.body.id) ids[s.referenceId] = s.body.id;
  }
  return { ok: true, ids };
}

/**
 * Undo a partial build. Best-effort: a failure here is logged rather than
 * thrown, because the caller has already failed and the useful thing is a loud
 * record of exactly which Ids need cleaning up by hand.
 */
async function rollback(env, orderId, extraIds) {
  const v = apiVersion(env);
  const base = `/services/data/${v}/sobjects`;
  try {
    // Pre-Production Items first -- lookup, not master-detail, so they would
    // otherwise survive their method.
    for (const id of extraIds) {
      if (!SF_ID.test(id || "")) continue;
      await sfFetch(env, `${base}/Pre_Production_Item__c/${id}`, { method: "DELETE" }).catch(() => {});
    }
    const resp = await sfFetch(env, `${base}/Order/${orderId}`, { method: "DELETE" });
    if (resp.status !== 204) {
      console.error("rework rollback: Order delete failed, clean up by hand", orderId, resp.status);
    }
  } catch (e) {
    console.error("rework rollback threw, clean up by hand", orderId, extraIds, e);
  }
}
