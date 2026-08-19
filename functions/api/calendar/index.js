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
import { runQuery, jsonError } from "../_sf.js";
import { fetchMockupsByOpportunity } from "../_mockup.js";
import { scoreOrder, suggestSlot, prepStatus, byPriority, WEIGHTS, SHOP,
         PRESS_GROUPS, pressGroupOf, pressAcceptsOrder } from "../_priority.js";

const PM_FIELDS = [
  "Id",
  "Order__c",
  "Type__c",
  "Status__c",
  "Placements__c",
  "Vendor__r.Name",
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

const DEFAULT_BACK_DAYS = 14;
const DEFAULT_FORWARD_DAYS = 42;

/**
 * Once a method reaches Post-Production its press work is DONE -- the job has
 * come off the press and belongs to shipping/receiving now, not to a board about
 * what still has to be printed. Same for Completed, and for Cancelled (which
 * readiness() in _priority.js already ignores when scoring).
 *
 * Filtering at the METHOD level, not just the order level, is deliberate. An
 * order with Screen Print + Embroidery can have the screen print finished and
 * off the press while the embroidery still has to run. Dropping only the
 * finished METHOD keeps the embroidery on the board where it belongs; dropping
 * the whole order the moment its first method finished would hide real work.
 *
 * The order-level filter below it catches the other direction. Order_Substatus__c
 * is a rollup pinned to the LEAST advanced sibling method (see _pm-rollup.js),
 * so it normally cannot say Post-Production while a method lags -- but
 * orders/[id].js lets a manager PATCH it directly, and when someone does that
 * they mean "this order is off the print floor." Both filters, so either signal
 * takes it off the calendar.
 *
 * NOTE the occupancy query further down is deliberately NOT filtered this way.
 * A run that printed this morning genuinely occupied that press this morning;
 * excluding it would let the placer suggest a slot on top of work that really
 * happened. Capacity is about the press, not about the job's paperwork.
 */
const DONE_METHOD_STATUSES = ["Post-Production", "Completed", "Cancelled"];
const DONE_ORDER_SUBSTATUSES = ["Post-Production", "Completed"];

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
    const to = isDay(url.searchParams.get("to"))
      ? url.searchParams.get("to")
      : dayOffset(DEFAULT_FORWARD_DAYS);

    // Completed orders are excluded: the calendar is about what still has to be
    // made. Order.Status = 'Complete' is the standard field (no "d"), which is
    // NOT the same string as Production_Method__c.Status__c's 'Completed'.
    const soql =
      `SELECT ${PM_FIELDS.join(", ")}, ${ORDER_FIELDS.join(", ")} ` +
      `FROM Production_Method__c ` +
      `WHERE Order__c != null ` +
      `AND Order__r.Status != 'Complete' ` +
      // The `= null OR` halves are not redundant padding. SOQL's null handling
      // on NOT IN is not something to be casually confident about, and the
      // failure mode if it goes the ANSI-SQL way is silent: a method with no
      // status set, or an order whose substatus rollup has not run yet, would
      // vanish from the calendar with nothing to indicate why. Spelling it out
      // makes the query behave the same either way. A blank status means "not
      // started", which is exactly the work this board exists to show.
      `AND (Status__c = null OR Status__c NOT IN (${quoteList(DONE_METHOD_STATUSES)})) ` +
      `AND (Order__r.Order_Substatus__c = null OR Order__r.Order_Substatus__c NOT IN (${quoteList(DONE_ORDER_SUBSTATUSES)})) ` +
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

        };
        byOrder.set(pm.Order__c, order);
      }
      order.ProductionMethods.push({
        Id: pm.Id,
        Type__c: pm.Type__c,
        Status__c: pm.Status__c,
        Placements: pm.Placements__c ? pm.Placements__c.split(";").filter(Boolean) : [],
        Vendor: (pm.Vendor__r && pm.Vendor__r.Name) || null,
        Screens_Completed__c: !!pm.Screens_Completed__c,
        Mix_Inks__c: !!pm.Mix_Inks__c,
        Digitize_File__c: !!pm.Digitize_File__c,
        Thread_Color_Materials__c: !!pm.Thread_Color_Materials__c,
        Transfers_Received__c: !!pm.Transfers_Received__c,
        Transfers_Ready__c: !!pm.Transfers_Ready__c,
      });
    });

    const orders = Array.from(byOrder.values());

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
      const quoted = methodIds.map((id) => `'${id}'`).join(",");
      const runWhere =
        `(Scheduled_Start__c >= ${soqlDateTime(from, false)} ` +
        `AND Scheduled_Start__c <= ${soqlDateTime(to, true)})` +
        (methodIds.length ? ` OR PrintMethod__c IN (${quoted})` : "");
      const runsResult = await runQuery(
        env,
        `SELECT ${RUN_FIELDS.join(", ")} FROM Production_Run__c WHERE ${runWhere}`,
      );
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
            // Proposal = the machine suggested it. Confirmed = a human placed it
            // and nothing should move it again. Uros's field, doing exactly the
            // job a drag-to-reschedule calendar needs.
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
        const quotedIds = orderIds.map((oid) => `'${oid}'`).join(",");
        const itemsResult = await runQuery(
          env,
          `SELECT OrderId, Quantity FROM OrderItem WHERE OrderId IN (${quotedIds})`,
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
        const quotedIds = orderIds.map((oid) => `'${oid}'`).join(",");
        const propResult = await runQuery(
          env,
          `SELECT Id, Name, Order__c, Machine_Group__c, Proposed_Start__c, Proposed_Hours__c, ` +
          `Quantity__c, Sequence__c, Notes__c, Status__c, CreatedBy.Name ` +
          `FROM Proposed_Run__c WHERE Order__c IN (${quotedIds}) AND Status__c = 'Proposed' ` +
          `ORDER BY Sequence__c ASC NULLS LAST, Proposed_Start__c ASC NULLS LAST, CreatedDate ASC`,
        );
        if (propResult.ok) {
          const byOrderId = new Map();
          propResult.records.forEach((p) => {
            const list = byOrderId.get(p.Order__c) || [];
            list.push({
              id: p.Id,
              name: p.Name,
              machineGroup: p.Machine_Group__c || null,
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

    const mockups = await fetchMockupsByOpportunity(env, orders.map((o) => o.OpportunityId));
    orders.forEach((o) => {
      o.DesignMockupUrl = mockups.get(o.OpportunityId) || null;
    });

    orders.sort(byPriority);

    return Response.json(
      {
        window: { from, to },
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
