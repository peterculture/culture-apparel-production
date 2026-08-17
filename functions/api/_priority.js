/**
 * The production priority model. Single source of truth for the score and for
 * where a run wants to sit on the calendar.
 *
 * FOUR INPUTS, NOTHING ELSE (Anthony's diagram, 2026-08-14):
 *
 *   Account Manager Urgency # (1-5) ─┐
 *   Print Date ──────────────────────┤
 *   Firm Delivery? ──────────────────┼─▶ PRIORITY SCORE (1-10) ─▶ AUTO-BASE
 *   Pre-Production On Time? ─────────┘                            SCHEDULE
 *                                                                      │
 *                                                            MANAGER ADJUSTMENTS
 *
 * Deliberately NOT inputs, though the org has them and an earlier draft of this
 * model used all four: Class_of_Service__c, In_Hands_Date__c minus shipping
 * transit, Receiving_Status__c, and order age. They are not on the diagram. The
 * transit idea (borrowed from ProductionAutoSchedulerService.shippingBuffer) is
 * genuinely good and worth revisiting once the four-input model has proven
 * itself on the floor -- but adding inputs the production manager did not ask
 * for means he is tuning a model he cannot reason about.
 *
 * WHY THIS IS COMPUTED AT READ TIME, NOT STORED
 * Urgency is a function of days remaining, so the score changes every day
 * whether or not anything happened. A stored number needs a nightly job to stay
 * true, and the morning that job fails the board is quietly wrong with nothing
 * on screen to say so. Computing here means the number is correct by
 * construction. The copy written to Production_Method__c.Production_Priority__c
 * (see _priority-rollup.js) exists for Salesforce reports, list views, and the
 * station queues -- never for this app's own display.
 *
 * Note on the score's twin: Order.Priority_Score__c already exists in the org
 * (Uros Popovic, 6/12/2026) and drives ProductionAutoSchedulerService. It runs
 * the OPPOSITE WAY -- lower means more urgent, six-digit values. Ours is
 * higher-is-urgent on 1-10 and lives on Production_Method__c under a different
 * name on purpose. Do not conflate them.
 */

/** Tunable weights. Changing these is a deploy, not a Salesforce release. */
export const WEIGHTS = {
  urgency: 0.45,   // wU  how much raw closeness to the print date matters
  amRating: 0.30,  // wA  the account manager's 1-5
  prepRisk: 0.25,  // wP  unfinished pre-production, amplified by proximity
  firmBonus: 1.0,  // flat points added when the delivery date is firm
  halfLife: 3,     // days out at which urgency reads 5/10
  // Calendar placement: how much the print date decides the suggested day
  // versus how much priority is allowed to pull it. Anthony's 60/40.
  placeByDate: 0.6,
  placeByPriority: 0.4,
};

/**
 * The prep checklist that actually counts, per Production_Method__c.Type__c.
 *
 * These are the PREREQ sets the boards already show (see PREREQ in index.html
 * and M[].prereq in pre-production.html) -- two per type, not the seven fields
 * in _pm-rollup.js's CHECKLIST_FIELD_TYPE. That difference is deliberate:
 * Design_Received__c is still written and rolled up, but it was dropped from
 * the visible prereqs, so counting it here would make "prep complete" mean
 * something different from what the shop sees on the pre-production board.
 *
 * Promotional Items has no checklist at all, so a promo-only order reads as
 * fully ready and contributes no prep risk. That is correct -- there is nothing
 * to prepare -- but it is worth knowing before someone reports it as a bug.
 */
export const PREREQ_BY_TYPE = {
  "Screen Print": ["Screens_Completed__c", "Mix_Inks__c"],
  "Embroidery": ["Digitize_File__c", "Thread_Color_Materials__c"],
  "Heat Press": ["Transfers_Received__c", "Transfers_Ready__c"],
  "Promotional Items": [],
};

const MS_PER_DAY = 86400000;

/** Whole days from today (UTC midnight) to a Salesforce Date or DateTime. */
export function daysUntil(value, now) {
  if (!value) return null;
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return null;
  const today = now == null ? Date.now() : now;
  const a = Math.floor(then / MS_PER_DAY);
  const b = Math.floor(today / MS_PER_DAY);
  return a - b;
}

/**
 * Urgency, 0-10. Hyperbolic rather than linear on purpose: going from 14 days
 * out to 13 is not the same size of event as going from 2 days to 1, and a
 * linear countdown treats them identically. halfLife is the day count at which
 * this reads 5/10 -- lower makes the board stay calm and then spike late.
 */
export function urgency(days, halfLife) {
  if (days == null) return 0;
  if (days <= 0) return 10;
  return 10 / (1 + days / (halfLife || WEIGHTS.halfLife));
}

/**
 * Fraction of the visible prep checklist complete across every non-cancelled
 * method on the order, 0-1. Order-level by design: Anthony's rule is one rating
 * per order shared by every method, run and item, so a fully-prepped Screen
 * Print method still carries a number dragged down by an unprepped Heat Press
 * sibling. Returns 1 when there is nothing to check.
 */
export function readiness(methods) {
  let total = 0;
  let done = 0;
  (methods || []).forEach((m) => {
    if (m.Status__c === "Cancelled") return;
    const fields = PREREQ_BY_TYPE[m.Type__c];
    if (!fields) return; // unknown type contributes nothing rather than zeroing the order
    fields.forEach((f) => {
      total += 1;
      if (m[f]) done += 1;
    });
  });
  return total === 0 ? 1 : done / total;
}

/**
 * The score. `order` needs Print_Date__c, Priority_Rating__c and Firm__c;
 * `methods` is that order's Production_Method__c rows.
 *
 * Returns the score plus every intermediate value, because the calendar shows
 * the breakdown and a number nobody can decompose is a number nobody trusts.
 */
export function scoreOrder(order, methods, weights, now) {
  const w = { ...WEIGHTS, ...(weights || {}) };
  const days = daysUntil(order && order.Print_Date__c, now);

  const U = urgency(days, w.halfLife);
  const rating = Number(order && order.Priority_Rating__c);
  const A = Number.isFinite(rating) ? (rating / 5) * 10 : 0;
  const ready = readiness(methods);
  const P = (1 - ready) * U;
  const F = order && order.Firm__c ? w.firmBonus : 0;

  // Weights are normalised so the three can be tuned independently without
  // anyone having to keep them summing to 1 by hand.
  const wsum = w.urgency + w.amRating + w.prepRisk || 1;
  const cU = (w.urgency / wsum) * U;
  const cA = (w.amRating / wsum) * A;
  const cP = (w.prepRisk / wsum) * P;

  const raw = cU + cA + cP + F;
  // Range is 1-10, not 0-10: an order at the bottom of the queue still scores 1.
  const score = Math.max(1, Math.min(10, raw));

  return {
    score: Math.round(score * 100) / 100,
    raw,
    capped: raw > 10,
    days,
    ready,
    components: { U, A, P, F },
    contributions: { urgency: cU, amRating: cA, prepRisk: cP, firm: F },
  };
}

/**
 * Prep tracker status. Anthony's thresholds, matching prepBufferStats() in
 * ca-api.js so the calendar and the existing boards never disagree.
 * A fully-checked order reads "ready" whatever the date -- it has nothing left
 * to run out of time for.
 */
export function prepStatus(days, ready) {
  if (ready >= 1) return { key: "good", label: "Ready" };
  if (days == null) return { key: "warn", label: "Unknown" };
  if (days >= 3) return { key: "good", label: "Great" };
  if (days >= 1) return { key: "warn", label: "Mediocre" };
  return { key: "crit", label: "Very bad" };
}

/**
 * Where a run wants to sit before anyone drags it -- the AUTO-BASE SCHEDULE
 * step on the diagram.
 *
 *   earliest = today
 *   target   = Order.Print_Date__c                    where the date says it goes
 *   latest   = Order.Customer_Facing_Delivery_Date__c the last day it can print
 *              (falls back to target + 7 days)
 *
 * `latest` is a physical constraint, not a scoring input -- you cannot print
 * after the customer needed it. It bounds validity and contributes nothing to
 * the score.
 *
 * PRIORITY ONLY EVER PULLS EARLIER, NEVER LATER. The first version of this
 * spread priority across the whole earliest..latest window, which meant a
 * low-scoring order drifted PAST its own print date -- an order printing today
 * was suggested for tomorrow purely because nothing else about it was urgent.
 * The print date is a commitment, not an opening bid. So priority's own
 * preferred day runs earliest..TARGET: a 10 wants today, a 1 is content to sit
 * exactly on its print date, and the blend can only ever land on or before it.
 *
 * Returns day offsets from today (integers), which is what the calendar grid
 * wants -- callers turn them back into dates.
 */
export function suggestPlacement(order, score, weights, now) {
  const w = { ...WEIGHTS, ...(weights || {}) };

  const target = daysUntil(order && order.Print_Date__c, now);
  if (target == null) return null; // nothing to anchor on; the run is unplaceable

  const earliest = 0; // today
  const latest = daysUntil(order && order.Customer_Facing_Delivery_Date__c, now);

  // Priority pulls back toward today, bounded by the print date itself.
  const pullSpan = Math.max(0, target - earliest);
  const priorityDay = earliest + (1 - score / 10) * pullSpan;

  const blended = w.placeByDate * target + w.placeByPriority * priorityDay;
  const suggested = Math.round(Math.max(earliest, Math.min(target, blended)));

  // A print date that falls after the client deadline is a data problem, not
  // something to silently schedule around. Surfaced for the calendar to flag.
  const pastDeadline = latest != null && target > latest;

  return { suggested, earliest, target, latest, priorityDay, pastDeadline };
}

/**
 * Order the whole board. Highest score first; ties break on the sooner print
 * date so the queue is stable rather than arbitrary.
 */
export function byPriority(a, b) {
  const d = (b.priority ? b.priority.score : 0) - (a.priority ? a.priority.score : 0);
  if (d !== 0) return d;
  const da = a.priority ? a.priority.days : null;
  const db = b.priority ? b.priority.days : null;
  if (da == null && db == null) return 0;
  if (da == null) return 1;
  if (db == null) return -1;
  return da - db;
}
