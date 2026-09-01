/**
 * POST /api/production-methods
 *
 * Creates a Production Method (+ its Pre-Production Items) for one order,
 * atomically. The Method's ProductionPlan__c parent is supplied one of two ways:
 *
 *   A) EXISTING PLAN  — body includes { planId }.
 *      Just the Method + Items are created, attached to that plan.
 *
 *   B) CREATE FRESH   — body omits planId.
 *      The chain Order → ProductionRequirements__c → ProductionPlan__c is
 *      created first, then the Method + Items hang off the new plan:
 *
 *        Order (exists)
 *          └─ ProductionRequirements__c   (Order__c master-detail)
 *               └─ ProductionPlan__c      (ProductionRequirement__c master-detail)
 *                    └─ Production_Method__c
 *                         └─ Pre_Production_Item__c × N
 *
 * Everything runs in ONE Composite call with allOrNone:true, so a partial
 * failure rolls the whole thing back. Levels reference each other via @{ref.id}.
 *
 * Expected JSON body from the browser:
 *   {
 *     "orderId":  "801...",          // existing Order Id (required)
 *     "status":   "Pre-Production",  // Production_Method__c.Status__c (required, manager-set)
 *     "type":     "Screen Print",    // Production_Method__c.Type__c (required)
 *     "placements":["Front","Back"], // Production_Method__c.Placements__c (required,
 *                                    //   non-empty array) -- every decoration location
 *                                    //   this ONE method/plan covers. Written to the
 *                                    //   multi-select picklist as a ";"-joined string
 *                                    //   (Salesforce's own multi-select wire format).
 *                                    //   An order with genuinely different METHODS
 *                                    //   (e.g. screen print + a heat-press tag) still
 *                                    //   gets one Production_Method__c per method,
 *                                    //   created via separate calls to this endpoint --
 *                                    //   but multiple locations for the SAME method now
 *                                    //   live together on one record/one checklist.
 *     "planId":   "a0X...",          // OPTIONAL existing ProductionPlan__c Id.
 *                                    //   present -> path A (attach); absent -> path B (create chain)
 *     "items": [ { "type": "Screen" }, { "type": "Ink" } ]   // 0+ items
 *   }
 *
 * SECURITY: hard-codes exactly which SObjects/fields get written; the browser
 * can only ever create these objects with these fields, and picklist values are
 * checked against allow-lists below.
 */
import { apiVersion, jsonError, runQuery } from "../_sf.js";
import { rollupOrderSubstatus } from "../_pm-rollup.js";
import { runComposite, runChunked, rollbackCreated } from "../_composite.js";

// ---------------------------------------------------------------------------
// ORG-SPECIFIC API NAMES  (confirmed against the sandbox 2026-07-02)
// A wrong name makes the Composite API name the exact bad field/object in its
// error, which this handler forwards as `detail` — loud, never a silent no-op.
// ---------------------------------------------------------------------------
const REQ_OBJECT        = "ProductionRequirements__c";
const REQ_ORDER_FIELD   = "Order__c";                 // master-detail: Requirement -> Order

const PLAN_OBJECT       = "ProductionPlan__c";
const PLAN_REQ_FIELD    = "ProductionRequirement__c"; // master-detail: Plan -> Requirement

const PM_OBJECT         = "Production_Method__c";
const PM_PLAN_FIELD     = "ProductionPlan__c";         // master-detail: Method -> Plan (required)
const PM_ORDER_FIELD    = "Order__c";                  // also required on Method
const PM_STATUS_FIELD   = "Status__c";                 // picklist (required, manager-set)
const PM_TYPE_FIELD     = "Type__c";                   // picklist (required)
// DEPRECATED (2026-07-21): single-select Placement__c has been replaced by
// the multi-select Placements__c below, so one Production_Method__c can
// cover several print locations for the same method instead of needing a
// separate record per location. No longer written by this endpoint; left
// defined only because older records still carry a value in it.
const PM_PLACEMENT_FIELD = "Placement__c";
// Multi-select picklist: every decoration location this method/plan covers
// (Front / Back / Left Sleeve / etc). Order__c is master-detail, so an order
// can still carry several Production_Method__c children -- now one per
// distinct METHOD (e.g. "Screen Print" and "Heat Press" on the same order),
// with each method's own record listing all the locations it covers.
const PM_PLACEMENTS_FIELD = "Placements__c";

/* Salesforce Id shape. Every value that reaches a SOQL literal in this file
   is checked against this first -- the query is built by string concatenation,
   so an unchecked id closes the quote and appends its own WHERE. Same constant
   and same regex as ./[id].js and ../production-runs/index.js; kept per-file
   rather than shared because these route modules deliberately import only
   from _sf.js and the rollups. */
const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

const ITEM_OBJECT       = "Pre_Production_Item__c";
const ITEM_PM_FIELD     = "Production_Method__c";      // lookup -> Method
const ITEM_TYPE_FIELD   = "Type__c";                   // picklist: Screen|Ink|Thread|Digitization|Transfer
const ITEM_STATUS_FIELD = "Status__c";                 // picklist
const ITEM_STATUS_DEFAULT = "Not Started";

// Type-specific item fields (only set on the matching item type).
// Sub-status fields (Screen/Ink/Transfers) default to blank in SF and are
// optional+restricted, so we OMIT them entirely rather than risk a bad value.
const ITEM_MESH_FIELD     = "Mesh_Count__c";       // Screen  (restricted picklist)
const ITEM_PANTONE_FIELD  = "Pantone_Color__c";    // Ink     (text)
const ITEM_THREADCOLOR_FIELD  = "Thread_Color__c"; // Thread  (text)
const ITEM_THREADNUM_FIELD    = "Thread_Number__c";// Thread  (text)
const ITEM_STITCH_FIELD   = "Stitch_Count__c";     // Digitization (number)
const ITEM_TRANSFERTYPE_FIELD = "Transfer_Type__c";// Transfer (restricted picklist)

// Restricted picklists — validate server-side so a bad value can't reach SF.
const ALLOWED_MESH          = new Set(["110","125","156","180","196","230","305"]);
const ALLOWED_TRANSFER_TYPE = new Set(["Screen Transfer","Digital Transfer","Sublimation","Vinyl"]);

// Allow-lists, enforced server-side so the browser can't write arbitrary values.
const ALLOWED_METHOD_TYPES = new Set(["Screen Print", "Embroidery", "Heat Press", "Promotional Items"]);
const ALLOWED_ITEM_TYPES   = new Set(["Screen", "Ink", "Thread", "Digitization", "Transfer"]);
// Placement__c picklist values. MUST match Salesforce exactly (Setup ->
// Object Manager -> Production Method -> Fields -> Placement) or the create
// call fails with INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST. If the shop adds a
// new print location, add it in Salesforce first, then add it here.
const ALLOWED_PLACEMENTS = new Set([
  "Front", "Back", "Left Sleeve", "Right Sleeve",
  "Left Chest", "Right Chest", "Full Front", "Full Back",
  "Tag", "Hood", "Pocket",
]);
// Exact Status__c picklist values, confirmed from Setup 2026-07-02.
const ALLOWED_STATUSES     = new Set([
  "Pre-Production", "Ready for Print", "In Production",
  "Post-Production", "Completed", "Cancelled", "On Hold",
]);

/**
 * GET /api/production-methods?orderId=<id>
 *
 * Lists every Production_Method__c on ONE order, regardless of its Status__c
 * (so this includes methods still sitting in Pre-Production, unlike the
 * board queries which only surface methods that have reached the floor).
 * Powers the "Production Methods" section of a card's drawer on both boards
 * (index.html / pre-production.html) -- lets a manager see, edit, add, and
 * remove every method on the order the open card belongs to, not just the
 * one method that card itself represents.
 *
 *   GET /api/production-methods?orderId=801...  ->  { records: [ {...}, ... ] }
 */
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const orderId = (url.searchParams.get("orderId") || "").trim();
    /* Shape-checked BEFORE it reaches the WHERE clause below. A truthiness
       test alone let `x' OR Id != null OR Name = 'x` terminate the literal and
       return every Production_Method__c in the org. Rejected here without
       touching Salesforce. */
    if (!SF_ID.test(orderId)) return jsonError("missing_orderId", 400);

    // LastModifiedDate added 2026-07-29 so the drawer's method-edit form can
    // capture "what I loaded" and the PATCH endpoint can reject a save if
    // someone else changed the record more recently (see the
    // ifUnmodifiedSince param documented in production-methods/[id].js).
    const soql =
      `SELECT Id, Name, ${PM_TYPE_FIELD}, ${PM_STATUS_FIELD}, ${PM_PLACEMENTS_FIELD}, ` +
      `LastModifiedDate ` +
      `FROM ${PM_OBJECT} WHERE ${PM_ORDER_FIELD} = '${orderId}' ORDER BY CreatedDate ASC`;
    // Naturally small (scoped to one order's own methods), but runQuery is
    // used everywhere a query runs now for consistency -- see _sf.js.
    const { ok, status, records } = await runQuery(env, soql);
    if (!ok) {
      console.error("Production method list query failed", status);
      return jsonError("query_failed", status);
    }

    return Response.json(
      { records },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}

export async function onRequestPost({ env, request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const { orderId, status, type, placements, planId, items } = payload || {};
  // Optional worker-name attribution -- who set this order's pre-production
  // up. Stamped onto each created item's Last_Updated_By__c (see
  // pre-production-items/[id].js for the field prerequisite).
  const by = (payload && payload.by == null ? "" : String(payload.by)).trim().slice(0, 80);

  // --- validate before touching Salesforce ---
  // Same shape check as the GET. Not exploitable on this path today -- a
  // malformed Id fails the composite create before the rollup runs -- but
  // rollupOrderSubstatus() below documents its orderId as already-validated
  // and drops it straight into a WHERE clause, so validate it here rather
  // than rely on Salesforce rejecting it first.
  if (!orderId || typeof orderId !== "string")   return jsonError("missing_orderId", 400);
  if (!SF_ID.test(orderId))                      return jsonError("missing_orderId", 400);
  if (!status || typeof status !== "string")     return jsonError("missing_status", 400);
  if (!ALLOWED_STATUSES.has(status))             return jsonError("bad_status", 400);
  if (!type || typeof type !== "string")         return jsonError("missing_type", 400);
  if (!ALLOWED_METHOD_TYPES.has(type))           return jsonError("bad_method_type", 400);
  if (!Array.isArray(placements) || placements.length === 0) return jsonError("missing_placements", 400);
  for (const p of placements) {
    if (typeof p !== "string" || !ALLOWED_PLACEMENTS.has(p)) {
      return Response.json({ error: "bad_placement", detail: p }, { status: 400 });
    }
  }
  // De-dupe, preserve first-seen order; Salesforce multi-select picklists are
  // written as a ";"-joined string of the selected values.
  const placementsValue = Array.from(new Set(placements)).join(";");

  const hasExistingPlan = typeof planId === "string" && planId.length > 0;

  const itemList = Array.isArray(items) ? items : [];
  for (const it of itemList) {
    if (!it || !ALLOWED_ITEM_TYPES.has(it.type)) {
      return Response.json({ error: "bad_item_type", detail: it && it.type }, { status: 400 });
    }
    // Restricted picklists: reject bad values before they reach Salesforce.
    if (it.type === "Screen" && it.mesh != null && it.mesh !== "" && !ALLOWED_MESH.has(String(it.mesh))) {
      return Response.json({ error: "bad_mesh", detail: it.mesh }, { status: 400 });
    }
    if (it.type === "Transfer" && it.transferType != null && it.transferType !== "" && !ALLOWED_TRANSFER_TYPE.has(it.transferType)) {
      return Response.json({ error: "bad_transfer_type", detail: it.transferType }, { status: 400 });
    }
  }

  const v = apiVersion(env);
  const base = `/services/data/${v}/sobjects`;

  // The Method's plan parent: either the existing planId, or @{plan.id} from the
  // freshly-created chain.
  const planRef = hasExistingPlan ? planId : "@{plan.id}";

  // -----------------------------------------------------------------------
  // Write in two phases. See ../_composite.js.
  //
  // This used to be one composite with allOrNone:true and no cap check, which
  // is 1-3 parent records plus ONE PER PRE-PRODUCTION ITEM. A method carrying
  // more than ~22 screens/inks/threads emits over 25 and Salesforce rejects the
  // whole request -- the method included -- rather than the overflow. (E5.10.)
  //
  //   HEAD  requirement + plan + method. At most three records, and the only
  //         ones anything references by @{ref.id}, so this always fits.
  //   TAIL  the pre-production items, chunked against the method's real Id.
  // -----------------------------------------------------------------------
  const head = [];

  // Path B: create Requirement + Plan first.
  if (!hasExistingPlan) {
    head.push(
      {
        method: "POST",
        url: `${base}/${REQ_OBJECT}`,
        referenceId: "req",
        body: { [REQ_ORDER_FIELD]: orderId },
      },
      {
        method: "POST",
        url: `${base}/${PLAN_OBJECT}`,
        referenceId: "plan",
        body: { [PLAN_REQ_FIELD]: "@{req.id}" },
      }
    );
  }

  // Method (both paths).
  head.push({
    method: "POST",
    url: `${base}/${PM_OBJECT}`,
    referenceId: "pm",
    body: {
      [PM_PLAN_FIELD]:   planRef,
      [PM_ORDER_FIELD]:  orderId,
      [PM_STATUS_FIELD]: status,
      [PM_TYPE_FIELD]:   type,
      [PM_PLACEMENTS_FIELD]: placementsValue,
    },
  });

  try {
    const headRes = await runComposite(env, head, "method create");
    if (!headRes.ok) {
      return Response.json(
        {
          error: "create_failed",
          // Which record failed (referenceId: req | plan | pm) + SF's message.
          failedRef: headRes.failedRef,
          detail: headRes.detail,
          all: headRes.all,
        },
        { status: 502 }
      );
    }

    const requirementId = hasExistingPlan ? null : headRes.ids.req || null;
    const newPlanId     = hasExistingPlan ? planId : headRes.ids.plan || null;
    const pmId          = headRes.ids.pm || null;

    // Newest first, so a rollback deletes children before their parents.
    // Requirement -> Plan -> Method is master-detail (see _rework.js's
    // rollback), so deleting the requirement would cascade -- but deleting
    // explicitly in child order works whether or not it does, and
    // rollbackCreated treats an already-gone 404 as success.
    const created = [];
    if (!hasExistingPlan && requirementId) created.unshift({ object: REQ_OBJECT, id: requirementId });
    if (!hasExistingPlan && newPlanId)     created.unshift({ object: PLAN_OBJECT, id: newPlanId });
    if (pmId)                              created.unshift({ object: PM_OBJECT, id: pmId });

    // TAIL: items (both paths). Each item carries only its type-specific
    // fields. Sub-status fields are intentionally omitted (default blank in SF).
    const tail = itemList.map((item, i) => {
      const body = {
        [ITEM_PM_FIELD]:     pmId,
        [ITEM_TYPE_FIELD]:   item.type,
        [ITEM_STATUS_FIELD]: item.status || ITEM_STATUS_DEFAULT,
      };
      if (by) body.Last_Updated_By__c = by;
      if (item.type === "Screen") {
        if (item.mesh) body[ITEM_MESH_FIELD] = String(item.mesh);
      } else if (item.type === "Ink") {
        if (item.pantone) body[ITEM_PANTONE_FIELD] = String(item.pantone);
      } else if (item.type === "Thread") {
        if (item.threadColor)  body[ITEM_THREADCOLOR_FIELD] = String(item.threadColor);
        if (item.threadNumber) body[ITEM_THREADNUM_FIELD]   = String(item.threadNumber);
      } else if (item.type === "Digitization") {
        if (item.stitchCount != null && item.stitchCount !== "") {
          const n = Number(item.stitchCount);
          if (!Number.isNaN(n)) body[ITEM_STITCH_FIELD] = n;
        }
      } else if (item.type === "Transfer") {
        if (item.transferType) body[ITEM_TRANSFERTYPE_FIELD] = String(item.transferType);
      }
      return {
        method: "POST",
        url: `${base}/${ITEM_OBJECT}`,
        referenceId: `item${i}`,
        body,
      };
    });

    const tailRes = await runChunked(env, tail, { label: "method items", refPrefix: "i" });
    if (!tailRes.ok) {
      // A method with only some of its screens is worse than no method: it
      // reaches the floor looking complete. Undo the whole thing. Items are
      // a lookup off the method, not master-detail, so they go first and
      // explicitly (same reason _rework.js deletes Pre-Production Items itself).
      const strandedItems = (tailRes.createdIds || []).map((id) => ({ object: ITEM_OBJECT, id }));
      await rollbackCreated(env, [...strandedItems, ...created], "method create");
      return Response.json(
        {
          error: "create_failed",
          failedRef: tailRes.failedRef || null,
          detail: tailRes.detail,
          rolledBack: strandedItems.length + created.length,
        },
        { status: 502 }
      );
    }

    // Best-effort: a brand-new method starts life at whatever Status__c the
    // manager picked (often "Pre-Production"), which can be LESS advanced
    // than the order's existing sibling methods. rollupOrderSubstatus only
    // ever fires from a PATCH to an EXISTING method's Status__c, so without
    // this call, adding a new not-yet-started method to an order that had
    // already progressed left Order_Substatus__c stuck at its old, now-stale
    // value until some other method's status happened to change later. See
    // ../_pm-rollup.js.
    const rolledUpSubstatus = await rollupOrderSubstatus(env, orderId).catch((e) => {
      console.error("order substatus rollup failed (method create)", e);
      return null;
    });

    return Response.json(
      {
        ok: true,
        requirementId,
        planId: newPlanId,
        productionMethodId: pmId,
        rolledUpSubstatus,
        raw: [...(headRes.all || []), ...(tailRes.all || [])],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
