/**
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Powers the Calendar dashboard (calendar.html). Returns every order printing
 * in the window, each carrying its computed priority, its suggested calendar
 * position, and whatever Production_Run__c records already exist beneath it.
 *
 * ORDERS, WITH RUNS OVERLAID -- not runs alone. dev2 has 21 Production_Run__c
 * records against ~41 for one real week off the print shop's Google Calendar,
 * so a runs-only board would show a third of the shop and say nothing about the
 * orders nobody has scheduled yet. Every order with a Print_Date__c therefore
 * gets a block: where runs exist they take over and sit in their press lane,
 * and where they don't the order shows in the Unassigned lane. Dragging an
 * unassigned order onto a press is what creates the run -- which makes the
 * calendar the tool that closes the gap rather than something waiting on it.
 *
 * Production_Method__c is the query root, same as /api/orders and
 * /api/production-orders. Consistent with both boards, and it means the prep
 * checklist needed for the score arrives in the primary SELECT rather than a
 * follow-up.
 *
 * The score is computed here, per request, by _priority.js -- never read from
 * Production_Method__c.Production_Priority__c. That stored copy exists for
 * reports and the station queues (see _priority-rollup.js); this endpoint
 * deliberately does not trust it, so a missed nightly refresh can never put a
 * stale number on the calendar.
 */
import { runQuery, jsonError, runChunkedIdQuery } from "../_sf.js";
import { runQueryOptionalField } from "../_placements.js";
import { fetchMockupsByOpportunity } from "../_mockup.js";
import { scoreOrder, suggestSlot, prepStatus, byPriority, WEIGHTS, SHOP,
         PRESS_GROUPS, pressGroupOf, pressAcceptsOrder } from "../_priority.js";

const PM_FIELDS = [
  "Id",
  "Order__c",
  "Type__c",
  "Status__c",
  "Placements__c",
  // The visible prep checklist -- the four inputs need these to compute
  // Pre-Production On Time. See PREREQ_BY_TYPE in _priority.js.
  "Screens_Completed__c",
  "Mix_Inks__c",
  "Digitize_File__c",
  "Thread_Color_Materials__c",
  "Transfers_Received__c",
  "Transfers_Ready__c",
];

const ORDER_FIELDS = [
  "Order__r.Id",
  "Order__r.OrderNumber",
  "Order__r.GOA_Order_Number__c",
  "Order__r.Customer_Order_Name__c",
  "Order__r.Account.Name",
  "Order__r.OpportunityId",
  "Order__r.Status",
  "Order__r.Order_Substatus__c",
  "Order__r.Receiving_Status__c",
  // The four inputs, plus the placement window's late bound.
  "Order__r.Print_Date__c",
  "Order__r.Print_End_Date_Time__c",
  "Order__r.Duration__c",
  "Order__r.Priority_Rating__c",
  "Order__r.Priority_Notes__c",
  "Order__r.Firm__c",
  "Order__r.Customer_Facing_Delivery_Date__c",
  "Order__r.Special_Notes__c",
  "Order__r.Specifications_for_Printing__c",
];

const RUN_FIELDS = [
  "Id",
  "Name",
  "PrintMethod__c",
  "Press__c",
  "Press__r.Name",
  "Scheduled_Start__c",
  "Scheduled_End__c",
  "Actual_Start__c",
  "Actual_End__c",
  "Quantity_Planned_c__c", // the double _c__c really is the API name -- do not "fix" it
  "Auto_Scheduling_Status__c",
  "LastModifiedDate",
];
// Queried separately because the org may not have it yet -- see
// runQueryOptionalField in _placements.js. The stakes are highest on this
// endpoint: if the run query dies, it doesn't just lose locations, it strips
// every run off the calendar grid while still returning 200, so the board
// would render as a shop with nothing scheduled.
const RUN_LOCATION_FIELD = "Print_Location__c";

/**
 * Hard ceiling on the requested window (E5.12).
 *
 * from/to are shape-checked as YYYY-MM-DD but the SPAN between them was never
 * bounded, so /api/calendar?from=1900-01-01&to=2100-01-01 asked this endpoint
 * to score every order the shop has ever had and run four follow-up roll-ups
 * over all of them. Chunking below makes that correct; it does not make it
 * wise.
 *
 * calendar.html never asks for more than six days (windowDays(): day, 3day, or
 * Mon-Sat), and the server default is 56. A year is therefore enormously
 * generous for every real caller and still bounds the work. Clamped rather
 * than rejected, and reported back in `window.clamped`, because a board that
 * renders a year of work is more useful than a 400 nobody expected.
 */
const MAX_RANGE_DAYS = 366;

const DEFAULT_BACK_DAYS = 14;
const DEFAULT_FORWARD_DAYS = 42;

/**
 * WHAT COUNTS AS FINISHED.
 *
 * Checked at BOTH levels, deliberately. An order with Screen Print + Embroidery
 * can have the screen print off the press while the embroidery still has to
 * run, so "every method is done" is one signal. Order_Substatus__c is a rollup
 * pinned to the least advanced sibling (see _pm-rollup.js) but orders/[id].js
 * lets a manager PATCH it directly, and when someone does that they mean "this
 * order is off the print floor" -- so that is a second signal. Order.Status is
 * maintained by a different part of the business again, and is the third.
 *
 * NOTE the occupancy query further down is unaffected by any of this. A run
 * that printed this morning genuinely occupied that press this morning;
 * ignoring it would let the placer suggest a slot on top of work that really
 * happened. Capacity is about the press, not about the job's paperwork.
 *
 * CHANGED 2026-08-19: finished work is no longer hidden, it is FLAGGED.
 *
 * The board used to filter Post-Production and Completed out of the query
 * entirely, which was right while Google Calendar was the shop's system of
 * record. It is wrong now that this board IS the calendar: scroll back a week
 * and last Tuesday's jobs had silently vanished, because finishing them made
 * them disappear. "What did we run?" is a question people ask constantly and
 * the app had no answer.
 *
 * So these two lists now mark an order as DONE rather than excluding it, and
 * the UI greys it. It stays on the press it ran on, at the time it ran.
 *
 * CANCELLED IS STILL EXCLUDED, and deliberately. A cancelled job is not
 * finished work, it is work that never happened -- drawing it on the calendar
 * in the same "we did this" grey as a completed job would misrepresent the
 * week. It belongs to a different question than the one this board answers.
 */
const DONE_METHOD_STATUSES = ["Post-Production", "Completed"];
const DONE_ORDER_SUBSTATUSES = ["Post-Production", "Completed"];
const HIDDEN_METHOD_STATUSES = ["Cancelled"];

/** ['a','b'] -> "'a','b'" for a SOQL IN list. Values here are all literals we
 *  own -- never interpolate user input through this. */
function quoteList(values) {
  return values.map((v) => `'${v}'`).join(",");
}

/** YYYY-MM-DD -> a SOQL DateTime literal (unquoted, UTC). */
function soqlDateTime(day, endOfDay) {
  return `${day}T${endOfDay ? "23:59:59" : "00:00:00"}Z`;
}
function isDay(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function dayOffset(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const from = isDay(url.searchParams.get("from"))
      ? url.searchParams.get("from")
      : dayOffset(-DEFAULT_BACK_DAYS);
    let to = isDay(url.searchParams.get("to"))
      ? url.searchParams.get("to")
      : dayOffset(DEFAULT_FORWARD_DAYS);

    // Clamp an over-long window to MAX_RANGE_DAYS from `from`. Date.UTC on the
    // parsed parts, not Date.parse on the strings, so this is plain calendar
    // arithmetic and cannot be shifted by the runtime's timezone (see the E5.7
    // note in _priority.js -- Workers run in UTC and setHours-style code was
    // wrong here for months).
    let clamped = false;
    {
      const asUtc = (d) => {
        const [y, m, dd] = d.split("-").map(Number);
        return Date.UTC(y, m - 1, dd);
      };
      const span = (asUtc(to) - asUtc(from)) / 86400000;
      if (!(span >= 0)) {
        // `to` before `from` yields no rows and reads as an empty shop rather
        // than a bad request. Say so instead.
        return jsonError("to_before_from", 400);
      }
      if (span > MAX_RANGE_DAYS) {
        to = new Date(asUtc(from) + MAX_RANGE_DAYS * 86400000).toISOString().slice(0, 10);
        clamped = true;
      }
    }

    // Everything with a print date in the window comes back, finished or not.
    // Only Cancelled is filtered out -- see the note on HIDDEN_METHOD_STATUSES.
    //
    // The `= null OR` half below is not redundant padding. SOQL's null handling
    // on NOT IN is not something to be casually confident about, and the
    // failure mode if it goes the ANSI-SQL way is silent: a method with no
    // status set would vanish from the calendar with nothing to indicate why.
    // Spelling it out makes the query behave the same either way. A blank
    // status means "not started", which is exactly the work this board exists
    // to show.
    //
    // Note Order.Status = 'Complete' is the standard field (no "d"), which is
    // NOT the same string as Production_Method__c.Status__c's 'Completed'.
    const soql =
      `SELECT ${PM_FIELDS.join(", ")}, ${ORDER_FIELDS.join(", ")} ` +
      `FROM Production_Method__c ` +
      `WHERE Order__c != null ` +
      // The `= null OR` halves are not redundant padding. SOQL's null handling
      // on NOT IN is not something to be casually confident about, and the
      // failure mode if it goes the ANSI-SQL way is silent: a method with no
      // status set, or an order whose substatus rollup has not run yet, would
      // vanish from the calendar with nothing to indicate why. Spelling it out
      // makes the query behave the same either way. A blank status means "not
      // started", which is exactly the work this board exists to show.
      `AND (Status__c = null OR Status__c NOT IN (${quoteList(HIDDEN_METHOD_STATUSES)})) ` +
      `AND Order__r.Print_Date__c >= ${soqlDateTime(from, false)} ` +
      `AND Order__r.Print_Date__c <= ${soqlDateTime(to, true)}`;

    const { ok, status, records } = await runQuery(env, soql);
    if (!ok) {
      console.error("Calendar query failed", status);
      return jsonError("query_failed", status);
    }

    // Group methods under their order. Order-level fields are identical across
    // siblings, so the first row seen carries them.
    const byOrder = new Map();
    records.forEach((pm) => {
      const o = pm.Order__r || {};
      let order = byOrder.get(pm.Order__c);
      if (!order) {
        order = {
          Id: o.Id || pm.Order__c,
          OrderNumber: o.OrderNumber,
          GOA_Order_Number__c: o.GOA_Order_Number__c,
          Customer_Order_Name__c: o.Customer_Order_Name__c,
          Account: o.Account,
          OpportunityId: o.OpportunityId,
          Status: o.Status,
          Order_Substatus__c: o.Order_Substatus__c,
          Receiving_Status__c: o.Receiving_Status__c,
          Print_Date__c: o.Print_Date__c,
          Print_End_Date_Time__c: o.Print_End_Date_Time__c,
          Duration__c: o.Duration__c,
          Priority_Rating__c: o.Priority_Rating__c,
          Priority_Notes__c: o.Priority_Notes__c,
          Firm__c: o.Firm__c,
          Customer_Facing_Delivery_Date__c: o.Customer_Facing_Delivery_Date__c,
          Special_Notes__c: o.Special_Notes__c,
          Specifications_for_Printing__c: o.Specifications_for_Printing__c,
          DesignMockupUrl: null,
          ProductionMethods: [],
          ProductionRuns: [],
          TotalQuantity: null, // filled by the OrderItem roll-up below
          // Set once every method is known -- see the pass below the grouping
          // loop. Order-level, not method-level, because the board draws one
          // card per order and a half-finished order is still live work.
          Done: false,
        };
        byOrder.set(pm.Order__c, order);
      }
      order.ProductionMethods.push({
        Id: pm.Id,
        Type__c: pm.Type__c,
        Status__c: pm.Status__c,
        Placements: pm.Placements__c ? pm.Placements__c.split(";").filter(Boolean) : [],
        Screens_Completed__c: !!pm.Screens_Completed__c,
        Mix_Inks__c: !!pm.Mix_Inks__c,
        Digitize_File__c: !!pm.Digitize_File__c,
        Thread_Color_Materials__c: !!pm.Thread_Color_Materials__c,
        Transfers_Received__c: !!pm.Transfers_Received__c,
        Transfers_Ready__c: !!pm.Transfers_Ready__c,
      });
    });

    const orders = Array.from(byOrder.values());

    /* Which of these are finished?
     *
     * Three independent signals, any one of which is enough, because the org
     * does not keep them perfectly in step: the order-level substatus rollup
     * can lag its methods, and Order.Status is maintained by a different part
     * of the business entirely. Treating "any says done" as done errs toward
     * greying a job that has actually finished rather than leaving stale work
     * looking live -- and a wrongly-greyed job is a visible, correctable
     * mistake, where a wrongly-live one quietly implies the press is booked. */
    orders.forEach((o) => {
      const methods = o.ProductionMethods || [];
      const allMethodsDone =
        methods.length > 0 &&
        methods.every((m) => DONE_METHOD_STATUSES.indexOf(m.Status__c) !== -1);
      o.Done =
        allMethodsDone ||
        DONE_ORDER_SUBSTATUSES.indexOf(o.Order_Substatus__c) !== -1 ||
        o.Status === "Complete";
    });

    // Presses, and every run already occupying them.
    //
    // The occupancy query is deliberately NOT limited to the orders above: a
    // press is busy because of whatever is booked on it, including runs for
    // orders outside this window. Suggesting a slot against a partial view of
    // the press would double-book it.
    const methodIds = records.map((r) => r.Id).filter(Boolean);
    const busyByPress = new Map();
    let presses = [];

    try {
      const pressResult = await runQuery(
        env,
        `SELECT Id, Name FROM Account WHERE Type = 'Press' ORDER BY Name ASC`,
      );
      if (pressResult.ok) {
        // group is resolved HERE, once, and shipped to the UI. The browser does
        // not get its own copy of the matching rules -- a second copy would
        // drift the first time a press is renamed.
        presses = pressResult.records.map((p) => ({
          Id: p.Id,
          Name: p.Name,
          group: pressGroupOf(p.Name),
        }));
        presses.forEach((p) => busyByPress.set(p.Id, []));
      }
    } catch (e) {
      console.error("Calendar press fetch error", e);
    }

    try {
      /* Runs come from two halves that used to be ORed into one query:
         everything scheduled inside the window, plus everything belonging to a
         method on this board whatever its schedule says.

         The second half was an unbounded `PrintMethod__c IN (...)` built from
         the primary result set, which is exactly the shape that dies when the
         query URL gets too long (E5.12) -- and dies as an HTTP rejection, not a
         SOQL error, so this whole block would have fallen into its catch and
         the board would have rendered with no runs at all and no explanation.

         Split and deduped rather than chunked in place: chunking an
         `A OR B IN (...)` re-runs the A half on every chunk, so the range rows
         would come back once per chunk. One query for the range, then chunked
         queries for the method Ids, merged through a Map keyed on run Id.

         Deliberately ONE code path rather than keeping the old single query for
         the common small case -- the rare branch is always the untested one,
         and with no methodIds this is just the range query as before. */
      const runSelect = (withLocation) =>
        `SELECT ${RUN_FIELDS.concat(withLocation ? [RUN_LOCATION_FIELD] : []).join(", ")} ` +
        `FROM Production_Run__c WHERE `;
      const byRunId = new Map();
      let runsOk = true;
      let runsStatus = null;

      const rangeRes = await runQueryOptionalField(
        env,
        (withLocation) =>
          runSelect(withLocation) +
          `(Scheduled_Start__c >= ${soqlDateTime(from, false)} ` +
          `AND Scheduled_Start__c <= ${soqlDateTime(to, true)})`,
        RUN_LOCATION_FIELD,
      );
      if (rangeRes.ok) rangeRes.records.forEach((r) => byRunId.set(r.Id, r));
      else { runsOk = false; runsStatus = rangeRes.status; }

      if (runsOk && methodIds.length) {
        const byMethod = await runChunkedIdQuery(methodIds, (quoted) =>
          runQueryOptionalField(
            env,
            (withLocation) => runSelect(withLocation) + `PrintMethod__c IN (${quoted})`,
            RUN_LOCATION_FIELD,
          ),
        );
        if (byMethod.ok) byMethod.records.forEach((r) => byRunId.set(r.Id, r));
        else { runsOk = false; runsStatus = byMethod.status; }
      }

      const runsResult = { ok: runsOk, status: runsStatus, records: Array.from(byRunId.values()) };
      if (runsResult.ok) {
        const methodToOrder = new Map(records.map((r) => [r.Id, r.Order__c]));
        runsResult.records.forEach((run) => {
          // Every scheduled run occupies its press, whether or not its order is
          // on this board.
          if (run.Press__c && run.Scheduled_Start__c && run.Scheduled_End__c) {
            if (!busyByPress.has(run.Press__c)) busyByPress.set(run.Press__c, []);
            busyByPress.get(run.Press__c).push({
              start: run.Scheduled_Start__c,
              end: run.Scheduled_End__c,
            });
          }
          const order = byOrder.get(methodToOrder.get(run.PrintMethod__c));
          if (!order) return;
          order.ProductionRuns.push({
            Id: run.Id,
            Name: run.Name,
            PrintMethod__c: run.PrintMethod__c,
            Press__c: run.Press__c,
            Press: (run.Press__r && run.Press__r.Name) || null,
            Scheduled_Start__c: run.Scheduled_Start__c,
            Scheduled_End__c: run.Scheduled_End__c,
            Actual_Start__c: run.Actual_Start__c,
            Actual_End__c: run.Actual_End__c,
            Quantity_Planned_c__c: run.Quantity_Planned_c__c,
            // Which location this block prints. Null both when the run has
            // none set and when the org has no such field -- the grid treats
            // the two the same (show nothing), so neither needs a code path.
            Print_Location__c: run[RUN_LOCATION_FIELD] || null,
            // Uros's field, doing exactly the job a drag-to-reschedule calendar
            // needs. Three values reach this board, not two (E5.13):
            //   Proposal   the machine suggested it; it may move again
            //   Confirmed  a human placed it, and it is on the shop calendar
            //   Planned    NOT "awaiting confirmation" -- runs publish at
            //              creation now, so a run still sitting on Planned is
            //              one whose PATCH to Confirmed failed. calendar.html's
            //              schedState() words it as a publish failure, and it
            //              is the state the auto-scheduler must still treat as
            //              booked. See _run-schedule-status.js.
            Auto_Scheduling_Status__c: run.Auto_Scheduling_Status__c,
            LastModifiedDate: run.LastModifiedDate,
          });
        });
      } else {
        console.error("Calendar run fetch failed", runsResult.status);
      }
    } catch (e) {
      console.error("Calendar run fetch error", e);
    }

    orders.sort((a, b) => {
      // Provisional sort so the suggestion loop below hands out capacity
      // highest-priority-first. Re-sorted properly once every score exists.
      const sa = scoreOrder(a, a.ProductionMethods).score;
      const sb = scoreOrder(b, b.ProductionMethods).score;
      return sb - sa;
    });

    // Score, then place. One number per order, shared by every method and run
    // beneath it -- see _priority.js.
    //
    // Orders that already have runs are placed; they need no suggestion. Orders
    // without one get a slot proposed on the press that can take them soonest,
    // which is the AUTO-BASE SCHEDULE step. Dragging that suggestion into a lane
    // is what turns it into a real Production_Run__c.
    orders.forEach((o) => {
      const priority = scoreOrder(o, o.ProductionMethods);
      o.priority = priority;
      o.prep = prepStatus(priority.days, priority.ready);
      o.needsScheduling = o.ProductionRuns.length === 0;
      o.suggestion = null;

      if (!o.needsScheduling) return;

      let best = null;
      for (const press of presses) {
        // A screen print job must never be offered the embroidery machine.
        // Without this the loop just took whichever press was free soonest,
        // which on a quiet week is the WRONG machine more often than the right
        // one -- and the suggestion is what a manager drags into place.
        if (!pressAcceptsOrder(press.group, o.ProductionMethods)) continue;
        const slot = suggestSlot(o, priority.score, busyByPress.get(press.Id) || [], {
          runCount: 1,
        });
        if (!slot || !slot.start) continue;
        if (!best || slot.start < best.start) {
          best = { ...slot, pressId: press.Id, pressName: press.Name };
        }
      }
      // No press at all (none configured, or every one full to the horizon) --
      // still return the day-level intent so the UI can say something useful.
      o.suggestion =
        best ||
        (presses.length
          ? { start: null, end: null, unplaceable: true }
          : { start: null, end: null, noPresses: true });

      // Reserve the suggested window so the next order in the loop does not get
      // handed the same slot. Suggestions compete for capacity exactly the way
      // real runs do, and the loop runs in priority order.
      if (best && best.start) {
        busyByPress.get(best.pressId).push({ start: best.start, end: best.end });
      }
    });

    /**
     * Piece count per order.
     *
     * This is not decoration: POST /api/production-runs REQUIRES a positive
     * integer quantity and 400s with bad_quantity without one, so a calendar
     * that cannot state an order's size cannot create a run at all -- which is
     * exactly the "drag an unscheduled job onto a press" path.
     *
     * OrderItem is a child of Order, not of Production_Method__c, so it cannot
     * ride along as a subquery now that Production_Method__c is the query root.
     * Batched follow-up keyed by order Id, same pattern as orders/index.js and
     * the mockup lookup below. Fails open: a transient error leaves
     * TotalQuantity null and the UI asks the manager for a count rather than
     * guessing one.
     */
    const orderIds = orders.map((o) => o.Id).filter(Boolean);
    if (orderIds.length) {
      try {
        const itemsResult = await runChunkedIdQuery(orderIds, (quotedIds) =>
          runQuery(env, `SELECT OrderId, Quantity FROM OrderItem WHERE OrderId IN (${quotedIds})`),
        );
        if (itemsResult.ok) {
          const qtyByOrder = new Map();
          itemsResult.records.forEach((it) => {
            const q = Number(it.Quantity);
            if (!Number.isFinite(q)) return;
            qtyByOrder.set(it.OrderId, (qtyByOrder.get(it.OrderId) || 0) + q);
          });
          orders.forEach((o) => {
            const q = qtyByOrder.get(o.Id);
            o.TotalQuantity = Number.isFinite(q) && q > 0 ? Math.round(q) : null;
          });
        } else {
          console.error("Calendar order-item fetch failed", itemsResult.status);
        }
      } catch (e) {
        console.error("Calendar order-item fetch error", e);
      }
    }

    /**
     * The Account Manager's SUGGESTED runs (Proposed_Run__c), attached to the
     * orders in this window.
     *
     * WHY THEY RIDE ALONG HERE rather than being fetched per order by the
     * board: the shop manager now owns the scheduling decision, and these are
     * the input to it. If the board had to ask for them one order at a time
     * they would only load when a drawer opens, which means the queue could
     * never show which jobs have a suggestion waiting -- and a suggestion
     * nobody can see is the same as no suggestion at all.
     *
     * Only Status__c = 'Proposed' comes back. Accepted ones already produced a
     * run that is on the board in its own right, and offering them again would
     * invite double-booking the same job.
     *
     * Fails open, same contract as the OrderItem roll-up above: on any error
     * the board renders exactly as it did before proposals existed.
     */
    if (orderIds.length) {
      try {
        const propResult = await runChunkedIdQuery(orderIds, (quotedIds) =>
          runQueryOptionalField(
            env,
            (withLocation) =>
              `SELECT Id, Name, Order__c, Machine_Group__c, ` +
              (withLocation ? `${RUN_LOCATION_FIELD}, ` : "") +
              `Proposed_Start__c, Proposed_Hours__c, ` +
              `Quantity__c, Sequence__c, Notes__c, Status__c, CreatedBy.Name ` +
              `FROM Proposed_Run__c WHERE Order__c IN (${quotedIds}) AND Status__c = 'Proposed' ` +
              // ORDER BY is per-chunk, but the consumer regroups by Order__c
              // and each order's proposals land in one chunk (chunking is by
              // order Id), so each order's list keeps its order.
              `ORDER BY Sequence__c ASC NULLS LAST, Proposed_Start__c ASC NULLS LAST, CreatedDate ASC`,
            RUN_LOCATION_FIELD,
          ),
        );
        if (propResult.ok) {
          const byOrderId = new Map();
          propResult.records.forEach((p) => {
            const list = byOrderId.get(p.Order__c) || [];
            list.push({
              id: p.Id,
              name: p.Name,
              machineGroup: p.Machine_Group__c || null,
              printLocation: p[RUN_LOCATION_FIELD] || null,
              proposedStart: p.Proposed_Start__c || null,
              proposedHours: p.Proposed_Hours__c == null ? null : Number(p.Proposed_Hours__c),
              quantity: p.Quantity__c == null ? null : Number(p.Quantity__c),
              notes: p.Notes__c || null,
              proposedBy: (p.CreatedBy && p.CreatedBy.Name) || null,
            });
            byOrderId.set(p.Order__c, list);
          });
          orders.forEach((o) => { o.Proposals = byOrderId.get(o.Id) || []; });
        } else {
          // A 400 here is the expected shape when Proposed_Run__c does not
          // exist yet in whichever org is active -- staging and production
          // won't have it until the object is promoted. Not worth alarming
          // about; the board simply shows no suggestions.
          console.warn("Calendar proposed-run fetch failed", propResult.status);
          orders.forEach((o) => { o.Proposals = []; });
        }
      } catch (e) {
        console.error("Calendar proposed-run fetch error", e);
        orders.forEach((o) => { o.Proposals = []; });
      }
    }

    /**
     * Outstanding pre-production items for the orders in this window.
     *
     * WHY THE CALENDAR CARES. A run block says when a job prints. It says
     * nothing about whether the screens are burned or the ink is mixed -- and
     * a run scheduled for Tuesday morning with three unfinished prep items is
     * not really scheduled, it is a plan waiting on somebody. The prep BAR on
     * each block already hints at this via the method-level checklist, but a
     * colour cannot tell you WHICH item is outstanding or let you go do
     * anything about it.
     *
     * "Ready" is the finished state (see pre-production-items/index.js), so
     * anything else -- Not Started, In Progress, or blank -- is still work.
     * Blank counts as outstanding on purpose: an item nobody has touched is
     * the most outstanding kind there is.
     *
     * Fails open like the other roll-ups: on error the board simply shows no
     * prep detail, exactly as it did before this existed.
     */
    if (orderIds.length) {
      try {
        const itemResult = await runChunkedIdQuery(orderIds, (quotedIds) =>
          runQuery(
            env,
            // Pre_Production_Item__c has NO Order__c of its own -- it reaches the
            // order through its method (item -> Production_Method__c -> Order__c),
            // exactly as pre-production-items/index.js does. Filtering on a
            // non-existent Order__c would 400, and because this whole block fails
            // open, it would have failed SILENTLY: no prep detail, no error, no
            // clue why.
            `SELECT Id, Name, Type__c, Status__c, Mesh_Count__c, Pantone_Color__c, ` +
            `Thread_Color__c, Thread_Number__c, Transfer_Type__c, ` +
            // The per-type sub-status is what the station board tabs on, so
            // carrying it lets the calendar link straight to the stage the item
            // is actually sitting at rather than the station's master list.
            `Screen_Sub_Status__c, Ink_Sub_Status__c, Transfers_Sub_Status__c, ` +
            `Production_Method__c, Production_Method__r.Type__c, Production_Method__r.Order__c ` +
            `FROM Pre_Production_Item__c WHERE Production_Method__r.Order__c IN (${quotedIds}) ` +
            `AND (Status__c = null OR Status__c != 'Ready') ` +
            `ORDER BY Type__c, Name`,
          ),
        );
        if (itemResult.ok) {
          const byOrderId = new Map();
          itemResult.records.forEach((it) => {
            const oid = (it.Production_Method__r && it.Production_Method__r.Order__c) || null;
            if (!oid) return;
            const list = byOrderId.get(oid) || [];
            list.push({
              id: it.Id,
              name: it.Name,
              type: it.Type__c || "Item",
              status: it.Status__c || "Not Started",
              methodId: it.Production_Method__c || null,
              methodType: (it.Production_Method__r && it.Production_Method__r.Type__c) || null,
              // The one identifying detail that makes an item recognisable on
              // the floor -- a mesh count for a screen, a Pantone for an ink.
              // Which field that is depends on the type.
              detail:
                it.Type__c === "Screen" ? (it.Mesh_Count__c ? it.Mesh_Count__c + " mesh" : null)
                : it.Type__c === "Ink" ? (it.Pantone_Color__c || null)
                : it.Type__c === "Thread" ? ([it.Thread_Color__c, it.Thread_Number__c].filter(Boolean).join(" ") || null)
                : it.Type__c === "Transfer" ? (it.Transfer_Type__c || null)
                : null,
              // Which station board actually completes this, and which of its
              // tabs the item is sitting on. See STATIONS in station.html --
              // these keys are that map's keys, and the stage strings are the
              // Salesforce sub-status API values the tabs are built from.
              //
              // Thread and Digitization get NO station on purpose: the shop
              // has no board for them (the four stations are ink, screen,
              // transfer, garment). Sending someone to a station that cannot
              // complete their item is worse than sending them nowhere, so the
              // UI shows those without a link rather than guessing.
              station:
                it.Type__c === "Screen" ? "screen"
                : it.Type__c === "Ink" ? "ink"
                : it.Type__c === "Transfer" ? "transfer"
                : null,
              stage:
                it.Type__c === "Screen" ? (it.Screen_Sub_Status__c || null)
                : it.Type__c === "Ink" ? (it.Ink_Sub_Status__c || null)
                : it.Type__c === "Transfer" ? (it.Transfers_Sub_Status__c || null)
                : null,
            });
            byOrderId.set(oid, list);
          });
          orders.forEach((o) => { o.OpenPrepItems = byOrderId.get(o.Id) || []; });
        } else {
          console.warn("Calendar prep-item fetch failed", itemResult.status);
          orders.forEach((o) => { o.OpenPrepItems = []; });
        }
      } catch (e) {
        console.error("Calendar prep-item fetch error", e);
        orders.forEach((o) => { o.OpenPrepItems = []; });
      }
    }

    const mockups = await fetchMockupsByOpportunity(env, orders.map((o) => o.OpportunityId));
    orders.forEach((o) => {
      o.DesignMockupUrl = mockups.get(o.OpportunityId) || null;
    });

    orders.sort(byPriority);

    return Response.json(
      {
        window: { from, to, clamped },
        shopHours: SHOP,
        weights: WEIGHTS, // echoed so the UI can show the breakdown without hardcoding it
        presses,
        // The five tabs, in shop order, plus which real presses feed each.
        // Master is synthesised by the UI (it is "no filter"), so it is not in
        // this list. A press whose name matches no group has group:null and
        // shows on Master only -- pressesUngrouped says how many, so that is
        // visible in the UI instead of silently swallowing a machine.
        pressGroups: PRESS_GROUPS.map((g) => ({
          key: g.key,
          label: g.label,
          methodTypes: g.methodTypes,
          pressIds: presses.filter((p) => p.group === g.key).map((p) => p.Id),
        })),
        pressesUngrouped: presses.filter((p) => !p.group).length,
        totalSize: orders.length,
        unscheduled: orders.filter((o) => o.needsScheduling).length,
        done: true,
        records: orders,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
