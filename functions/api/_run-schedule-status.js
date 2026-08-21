/**
 * The scheduling state machine for a Production Run, in one place.
 *
 * Three systems care about Auto_Scheduling_Status__c and they used to disagree
 * about what it meant, so this module is the single definition:
 *
 *   Proposal                 The auto-scheduler's own guess. It will re-slot
 *                            this run on any save. NOT on the calendar.
 *   Unable to auto-schedule  It tried and found no free slot. NOT on the calendar.
 *   Planned                  A human placed it, but it is not public yet.
 *                            The auto-scheduler leaves the times alone AND
 *                            treats the slot as booked. NOT on the calendar.
 *   Confirmed                Validated by a production manager. Pinned, and
 *                            PUBLISHED to the Salesforce Event calendar --
 *                            which in production syncs straight to Google.
 *
 * 'Planned' IS NOW A TRANSIENT STATE (2026-08-21). The Confirm step was
 * removed from every dashboard: a run publishes the moment it is created.
 *
 * Planned survives for exactly one reason -- production-runs/index.js INSERTS
 * a run as Planned and PATCHes it to Confirmed a moment later, so the Apex
 * publisher sees the Planned -> Confirmed UPDATE it has always handled, rather
 * than an insert that is already Confirmed (which it may not handle at all: it
 * keys off Trigger.oldMap, and oldMap is null on insert). Nothing else writes
 * Planned any more, and no UI offers a way to reach it.
 *
 * So a run found sitting on Planned is NOT "awaiting confirmation" -- it is a
 * run whose second write failed. Grep the Pages logs for "NOT published".
 *
 * WHY 'Planned' EXISTED (2026-08-18; superseded above). Before it there were two
 * usable states, and they were welded together: the ONLY way to stop the
 * auto-scheduler rewriting a manager's typed times was to mark the run
 * Confirmed, and Confirmed is what publishes. So scheduling a run and
 * announcing it to the whole shop were the same keystroke -- there was no way
 * to lay out a week before anyone saw it.
 *
 * 'Planned' splits those two ideas apart. It buys the same protection from the
 * auto-scheduler that 'Confirmed' does, without publishing anything. The
 * Confirm action is then a real decision a human makes, rather than a side
 * effect of typing a date.
 *
 * THIS REQUIRES THE MATCHING APEX CHANGE. ProductionAutoSchedulerSelector must
 * treat Planned exactly like Confirmed in both of its queries -- skip it when
 * choosing runs to re-slot, and count it as occupied time when building the
 * press calendar. Without that second half, Planned runs get their times
 * rewritten AND their press reads as free while a human has booked it, which
 * is the worse of the two failure modes. See SELECTOR-CHANGE.md.
 */

export const RUN_PROPOSAL = "Proposal";
export const RUN_PLANNED = "Planned";
export const RUN_CONFIRMED = "Confirmed";
export const RUN_UNABLE = "Unable to auto-schedule";

/** Statuses the auto-scheduler must not touch, and must treat as booked time. */
export const PINNED_STATUSES = [RUN_PLANNED, RUN_CONFIRMED];

/** A human has placed this run; its times are not the machine's to move. */
export function isPinned(status) {
  return PINNED_STATUSES.indexOf(status) !== -1;
}

/** This run is on the shop calendar (and therefore on Google, in production). */
export function isPublished(status) {
  return status === RUN_CONFIRMED;
}

/**
 * What status a write should land on when the caller didn't say.
 *
 * The rule that matters: **an edit never un-publishes.** If a run is already
 * Confirmed and a manager drags it to a new time, it stays Confirmed and the
 * calendar entry moves with it. Silently dropping it back would pull it off
 * the shop's calendar -- and off people's Google calendars -- as a side effect
 * of a small correction, which nobody would connect to what they just did.
 *
 * CHANGED 2026-08-21: this used to return Planned for anything not already
 * Confirmed, which was correct while a Confirm button existed to finish the
 * job. It doesn't any more, so that branch had become a trap: touching the
 * schedule of an auto-scheduler-owned run (Proposal / Unable to auto-schedule)
 * would pin it to Planned and leave it there permanently, invisible to the
 * shop and unrecoverable from the UI.
 *
 * Now every human schedule write lands on Confirmed. Dragging a machine
 * suggestion onto the calendar is a person saying "yes, this one" -- which is
 * exactly what publishing it means. The parameter is kept so callers stay
 * unchanged and the intent stays greppable.
 */
export function statusForScheduleWrite(_currentStatus) {
  return RUN_CONFIRMED;
}
