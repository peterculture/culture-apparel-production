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
  amRating: 0.30,  // wA  the account manager's rating, see AM_RATING_MAX
  prepRisk: 0.25,  // wP  unfinished pre-production, amplified by proximity
  firmBonus: 1.0,  // flat points added when the delivery date is firm
  halfLife: 3,     // days out at which urgency reads 5/10
  // Calendar placement: how much the print date decides the suggested day
  // versus how much priority is allowed to pull it. Anthony's 60/40.
  placeByDate: 0.6,
  placeByPriority: 0.4,
};

/**
 * The top of the Account Manager's rating scale, matching the
 * Order.Priority_Rating__c picklist.
 *
 * CHANGED 2026-08-18: the picklist went from 1-5 to 1-3. This was hardcoded as
 * `/ 5` inside scoreOrder(), which is the kind of thing that breaks silently --
 * with a 1-3 picklist and a /5 divisor, the AM's strongest possible signal
 * scores 6 out of 10 instead of 10, so their input quietly carries 60% of the
 * weight it is supposed to and every score is a little wrong forever. Nothing
 * errors, no test fails, the numbers just drift.
 *
 * If the scale ever changes again, this is the only line to touch -- and the
 * clamp below means stale records left on an out-of-range value can't push a
 * contribution above its ceiling in the meantime.
 */
export const AM_RATING_MAX = 3;

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

/**
 * PRESS GROUPS -- the five calendars the shop actually thinks in.
 *
 * Salesforce holds one Account (Type = 'Press') per physical machine: Press 1,
 * Press 2, Embroidery Machine, Hat Press, Shirt Press. That is not how the shop
 * talks about them:
 *
 *   Press 1      -- screen print, its own calendar. Kept SEPARATE from Press 2
 *                   even though both are screen print, because two operators
 *                   can run them at the same time and each needs its own board.
 *   Press 2      -- likewise.
 *   Embroidery   -- the embroidery machine.
 *   Heat Press   -- Hat Press and Shirt Press COMBINED. Two machines, one
 *                   calendar, because they are scheduled as one station.
 *   Master       -- everything, including any press that matches none of the
 *                   above.
 *
 * Matching is on the press NAME rather than the Id, because the Ids differ
 * between dev2, staging and production and hardcoding them would silently break
 * on promotion. The alternates in each pattern cover the vocabulary in the
 * Google Calendar the shop already schedules in (10 Head Press / 6 Head Press /
 * Embroidery / Heat Press) so the same code works if the Account names are ever
 * renamed to match it.
 *
 * ORDER MATTERS. `press1`/`press2` are tested before `heat`, and `heat`'s
 * pattern deliberately spells out hat|shirt|heat rather than anything looser --
 * "Hat Press" and "Heat Press" are one letter apart and a sloppy pattern would
 * swallow "Press 1" too.
 *
 * methodTypes is the other direction: which Production_Method__c.Type__c values
 * belong on this calendar. It drives both the unscheduled queue's filter and --
 * more importantly -- which presses the auto-placer is allowed to suggest. A
 * screen print job must never be offered the embroidery machine.
 */
export const PRESS_GROUPS = [
  { key: "press1", label: "Press 1", pattern: /(^|\b)(press\s*0*1\b|10\s*head)/i, methodTypes: ["Screen Print"] },
  { key: "press2", label: "Press 2", pattern: /(^|\b)(press\s*0*2\b|6\s*head)/i, methodTypes: ["Screen Print"] },
  { key: "embroidery", label: "Embroidery", pattern: /embroider/i, methodTypes: ["Embroidery"] },
  { key: "heat", label: "Heat Press", pattern: /(heat|hat|shirt)\s*press|transfer/i, methodTypes: ["Heat Press"] },
];

/** Group key for a press name, or null when nothing matches (Master only). */
export function pressGroupOf(name) {
  const n = String(name || "").trim();
  if (!n) return null;
  for (const g of PRESS_GROUPS) if (g.pattern.test(n)) return g.key;
  return null;
}

/**
 * Can this press take this order? True when the order has at least one method
 * whose Type__c belongs to the press's group. An ungrouped press accepts
 * anything -- it is a machine we do not have a rule for, so refusing to
 * schedule on it would be worse than allowing it.
 */
export function pressAcceptsOrder(groupKey, methods) {
  if (!groupKey) return true;
  const g = PRESS_GROUPS.filter((x) => x.key === groupKey)[0];
  if (!g) return true;
  const types = (methods || [])
    .filter((m) => m && m.Status__c !== "Cancelled")
    .map((m) => String((m && m.Type__c) || "").trim());
  if (!types.length) return true; // nothing to go on -- don't block scheduling
  return types.some((t) => g.methodTypes.indexOf(t) > -1);
}

const MS_PER_DAY = 86400000;

/**
 * Whole days from today to a Salesforce Date or DateTime, counted on the SHOP's
 * calendar.
 *
 * CHANGED 2026-09-01 (E5.7). This used to floor both ends onto UTC days:
 *
 *     Math.floor(then / MS_PER_DAY) - Math.floor(today / MS_PER_DAY)
 *
 * which rolls over at UTC midnight -- 7pm Chicago on CDT. So for the last five
 * or six hours of every working day the shop was already "tomorrow" as far as
 * this function was concerned, and every print date read one day closer than it
 * was. That feeds urgency() and therefore the score, and it feeds
 * suggestPlacement()'s target day, so the whole board drifted for part of each
 * evening and settled back overnight -- the kind of wrongness nobody reports
 * because it corrects itself before anyone can point at it.
 *
 * Both ends are now real calendar dates in the shop's timezone, differenced as
 * calendar dates. That also makes the result exact rather than
 * offset-dependent: no DST-shortened day can round to 0.96 of a day and floor
 * away.
 */
export function daysUntil(value, now, tz) {
  if (!value) return null;
  const target = shopDateOf(value, tz);
  if (!target) return null;
  const today = shopDate(0, now, tz);
  const a = Date.UTC(target.year, target.month - 1, target.day);
  const b = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((a - b) / MS_PER_DAY);
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
export function scoreOrder(order, methods, weights, now, tz) {
  const w = { ...WEIGHTS, ...(weights || {}) };
  const days = daysUntil(order && order.Print_Date__c, now, tz);

  const U = urgency(days, w.halfLife);
  // Picklist values come back as strings ("3"), which Number() coerces cleanly;
  // null contributes nothing rather than counting as the bottom of the scale,
  // because "not rated" and "rated lowest" are different statements.
  //
  // Clamped to 10 so a record still holding a pre-2026-08-18 rating of 4 or 5
  // can't score above the ceiling and outrank everything on the board.
  const rating = Number(order && order.Priority_Rating__c);
  const A = Number.isFinite(rating) ? Math.min(10, (rating / AM_RATING_MAX) * 10) : 0;
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
export function suggestPlacement(order, score, weights, now, tz) {
  const w = { ...WEIGHTS, ...(weights || {}) };

  const target = daysUntil(order && order.Print_Date__c, now, tz);
  if (target == null) return null; // nothing to anchor on; the run is unplaceable

  const earliest = 0; // today
  const latest = daysUntil(order && order.Customer_Facing_Delivery_Date__c, now, tz);

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

/* ── Time-of-day placement ────────────────────────────────────────────────
 *
 * suggestPlacement() above picks a DAY. The calendar needs a real start and end
 * time, because the shop genuinely packs a press: Monday 17 Aug had eight runs
 * back to back on 10 Head Press from 07:00 to 16:00. A day-level suggestion
 * cannot express that, and Uros's Apex cannot either -- it marks a whole day
 * busy per run (slot.addDays(1)), which is the single assumption in that code
 * most at odds with how the floor actually works.
 */

/**
 * Shop hours, taken from the real print-shop calendar (7am-4pm), not from
 * ProductionAutoSchedulerService, which assumes 8-5 and disagrees with it.
 *
 * timeZone ADDED 2026-09-01 (E5.7), and it is the whole point of this fix.
 *
 * These hours used to be applied with Date.prototype.setHours, which means the
 * RUNTIME's local timezone. Cloudflare Workers run in UTC -- measured, not
 * assumed: getTimezoneOffset() is 0 and resolvedOptions().timeZone is "UTC" in
 * workerd. So "07:00" meant 07:00 UTC, which is 02:00 in Chicago on CDT and
 * 01:00 on CST. Every suggested slot landed roughly five hours before the shop
 * opened, and the working day ended at 11:00 local. The numbers on screen still
 * read 7am-4pm, so nothing looked wrong -- the suggestion was just always for
 * the middle of the night.
 *
 * The Sunday skip had the same defect: it tested a UTC weekday, so for the
 * five or six hours between Chicago midnight and UTC midnight it was asking
 * about the wrong day entirely.
 *
 * Everything below therefore goes through shopInstant()/shopDate() rather than
 * setHours/getDay. Do not reintroduce a bare setHours here -- it will pass
 * every local test on a Central-time laptop and be wrong in production, which
 * is exactly how this survived as long as it did.
 */
export const SHOP = { startHour: 7, endHour: 16, timeZone: "America/Chicago" };

/* ── Shop-timezone arithmetic ─────────────────────────────────────────────
 *
 * Intl with an IANA timeZone is available in workerd and handles DST
 * correctly -- verified in the runtime: 2026-07-15T12:00Z formats as 07:00
 * Chicago (CDT, UTC-5) and 2026-01-15T12:00Z as 06:00 (CST, UTC-6). That is
 * the only DST-correct tool available here; there is no date library in this
 * project and no build step to add one.
 */

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const _dtfCache = new Map();
function dtf(tz) {
  let f = _dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23", // without this, midnight formats as hour "24" in en-US
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    _dtfCache.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of an instant, as the shop's clock reads them. */
export function shopParts(ts, tz) {
  const got = {};
  for (const part of dtf(tz || SHOP.timeZone).formatToParts(new Date(ts))) {
    if (part.type !== "literal") got[part.type] = part.value;
  }
  return {
    year: +got.year, month: +got.month, day: +got.day,
    hour: +got.hour % 24, minute: +got.minute, second: +got.second,
    weekday: WEEKDAY_INDEX[got.weekday],
  };
}

/** The zone's UTC offset, in ms, at a given instant. */
function offsetMsAt(ts, tz) {
  const p = shopParts(ts, tz);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - Math.floor(ts / 1000) * 1000; // formatToParts has second precision
}

/**
 * The instant at which the shop's clock reads this wall-clock time.
 *
 * Two passes: the first offset is looked up at an instant that is itself off by
 * the offset, which is wrong on the two days a year the offset changes. Feeding
 * the corrected instant back settles it. Both DST transitions happen at 02:00
 * local, outside 07:00-16:00, so the genuinely ambiguous cases (a wall-clock
 * time that happens twice, or not at all) cannot arise for shop hours.
 */
export function shopInstant(year, month, day, hour, minute, tz) {
  const zone = tz || SHOP.timeZone;
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0);
  let ts = wall - offsetMsAt(wall, zone);
  ts = wall - offsetMsAt(ts, zone);
  return ts;
}

/** Normalise the `now` a caller passed (number, Date, or omitted). */
function nowMs(now) {
  if (now == null) return Date.now();
  return now instanceof Date ? now.getTime() : Number(now);
}

/**
 * The shop's calendar date `offset` days from now, plus its weekday.
 *
 * The roll is done with Date.UTC purely as calendar arithmetic -- month and
 * year boundaries handled for free, and no timezone involved, because a
 * calendar date has none. weekday comes from the same rolled value, so it is
 * the shop's weekday and not UTC's.
 */
export function shopDate(offset, now, tz) {
  const p = shopParts(nowMs(now), tz);
  const rolled = new Date(Date.UTC(p.year, p.month - 1, p.day + (offset || 0)));
  return {
    year: rolled.getUTCFullYear(),
    month: rolled.getUTCMonth() + 1,
    day: rolled.getUTCDate(),
    weekday: rolled.getUTCDay(),
  };
}

/**
 * The shop's calendar date for a Salesforce value.
 *
 * A date-only "2026-09-05" IS already a calendar date -- parsing it to an
 * instant and back would drag it through UTC midnight and hand back the
 * previous day for anyone behind Greenwich. A DateTime is converted through the
 * shop's clock, which is the date the shop would call it.
 */
function shopDateOf(value, tz) {
  const raw = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) return { year: +dateOnly[1], month: +dateOnly[2], day: +dateOnly[3] };
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  const p = shopParts(ts, tz);
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * How long a run occupies a press, in hours.
 *
 * Order.Duration__c is the hours the OrderScheduling flow writes (V31+) and is
 * the total for the ORDER. When an order has several runs we divide it rather
 * than giving each run the full span, which would triple-book a press for a
 * three-run order. Falls back to 2 hours when Duration__c is blank or zero.
 *
 * THAT FALLBACK NOW MATCHES Print_End_Date_Time__c, AND DID NOT UNTIL
 * 2026-09-02. This comment used to assert the agreement as settled fact -- "the
 * same default Print_End_Date_Time__c already uses" -- and it was false for the
 * whole life of the field. That formula's own 2-hour branch never executed
 * once after it was created in January 2023: it returns Date/Time, so
 * Salesforce does not offer the "treat blank fields as blanks" option and
 * defaults to treating a blank number as zero. Duration__c was coerced to 0
 * before ISBLANK saw it, ISBLANK(0) is false, and every evaluation took the
 * other branch -- Print_Date__c + 0/24, i.e. the start time. In dev2, 15 of 20
 * scheduled orders had an end exactly equal to their start.
 *
 * So this function reserved 2 hours while the New Run form beside it prefilled
 * 0, for three orders in four, and the comment saying they agreed is the
 * reason nobody went looking. Anthony fixed the formula on 2026-09-02
 * (IF( Duration__c > 0, ... , Print_Date__c + (2/24) )) and ca-api.js's
 * runFormWindow() floors the form at the same 2 hours, so the three now agree
 * -- deliberately, and for the first time. Left written down rather than
 * quietly corrected, because an order scheduled before that date still carries
 * a zero-hour Print_End_Date_Time__c and this is the note that explains it.
 */
export function runDurationHours(order, runCount) {
  const total = Number(order && order.Duration__c);
  const n = Math.max(1, runCount || 1);
  const hours = Number.isFinite(total) && total > 0 ? total / n : 2;
  // Never longer than a working day, never shorter than 15 minutes.
  return Math.max(0.25, Math.min(SHOP.endHour - SHOP.startHour, hours));
}

/**
 * First free window of `durationH` hours on a given day, given the ranges that
 * press is already busy. Returns {start, end} as Dates, or null if the day is
 * too full.
 *
 * `busy` is [{start, end}] in any order; overlapping entries are fine.
 */
export function packInto(dayOffset, durationH, busy, now, tz) {
  // Open and close are built from the shop's own calendar date, so they are
  // 07:00 and 16:00 as the floor reads them whatever the runtime thinks the
  // time is, and they survive DST because shopInstant() resolves the offset on
  // the day in question rather than today's.
  const d = shopDate(dayOffset, now, tz);
  const open = new Date(shopInstant(d.year, d.month, d.day, SHOP.startHour, 0, tz));
  const close = new Date(shopInstant(d.year, d.month, d.day, SHOP.endHour, 0, tz));
  const needMs = durationH * 3600000;

  // Only ranges that touch this day matter, sorted by start.
  const ranges = (busy || [])
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => b.end > open && b.start < close)
    .sort((a, b) => a.start - b.start);

  let cursor = open;
  for (const r of ranges) {
    if (r.start - cursor >= needMs) break;      // gap before this booking fits
    if (r.end > cursor) cursor = r.end;         // otherwise slide past it
  }
  const end = new Date(cursor.getTime() + needMs);
  return end <= close ? { start: cursor, end } : null;
}

/**
 * The AUTO-BASE SCHEDULE step, with times. Starts at the day the priority blend
 * suggests and walks forward until the press has room, so a busy day pushes a
 * job to the next one rather than double-booking.
 *
 * Walking FORWARD only is deliberate: the blend has already decided the
 * earliest day this job deserves, and searching backwards from there would
 * quietly undo the pull-earlier-only rule in suggestPlacement().
 */
export function suggestSlot(order, score, busy, opts) {
  const o = opts || {};
  const now = o.now;
  // Optional override, defaulting to SHOP.timeZone inside the helpers. Nothing
  // in the app passes it; it exists so the DST and midnight-rollover cases can
  // be driven from a test without moving the shop.
  const tz = o.timeZone;
  const place = suggestPlacement(order, score, o.weights, now, tz);
  if (!place) return null;

  const durationH = runDurationHours(order, o.runCount);
  const horizon = Math.max(place.latest == null ? place.target + 14 : place.latest, place.suggested);

  for (let day = place.suggested; day <= horizon + 14; day++) {
    // The SHOP's Sunday, not UTC's. getDay() on a UTC-anchored Date called
    // Sunday from 6pm/7pm Saturday Chicago through 6pm/7pm Sunday, so late
    // Saturday was skipped and late Sunday was bookable.
    if (shopDate(day, now, tz).weekday === 0) continue;
    const slot = packInto(day, durationH, busy, now, tz);
    if (slot) {
      return {
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        day,
        durationHours: durationH,
        bumped: day !== place.suggested,        // the press was full on the suggested day
        placement: place,
      };
    }
  }
  // Every day to the horizon is full. Say so rather than inventing a slot --
  // the calendar shows these in the Unassigned lane for a human to sort out.
  return { start: null, end: null, day: null, durationHours: durationH, bumped: false, unplaceable: true, placement: place };
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
