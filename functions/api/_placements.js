/**
 * The print-location picklist, in one place.
 *
 * Added 2026-08-20, when Production_Run__c and Proposed_Run__c gained their
 * own Print_Location__c. Before that the list lived as a private
 * ALLOWED_PLACEMENTS Set in production-methods/index.js AND a second copy in
 * production-methods/[id].js. Four copies of an eleven-value restricted
 * picklist is how you end up with one endpoint accepting a value another one
 * rejects -- and because the picklists are RESTRICTED in Salesforce, a copy
 * that drifts doesn't fail politely, it 400s from the org with
 * INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST after the request has already been
 * accepted here.
 *
 * These are the exact API values, confirmed from Setup. Production_Method__c
 * .Placements__c is MULTI-select (";"-joined, see splitPlacements below);
 * Print_Location__c on both run objects is SINGLE-select and draws from this
 * same value set, so a run's location is always something its parent method
 * could actually have.
 *
 * Client-side counterpart: CAApi.PLACEMENTS in ca-api.js. If a value is ever
 * added in Setup it has to be added in BOTH places, plus the picklist itself.
 */

import { runQuery } from "./_sf.js";

export const PLACEMENTS = [
  "Front",
  "Back",
  "Left Sleeve",
  "Right Sleeve",
  "Left Chest",
  "Right Chest",
  "Full Front",
  "Full Back",
  "Tag",
  "Hood",
  "Pocket",
];

export const ALLOWED_PLACEMENTS = new Set(PLACEMENTS);

/** True if `v` is exactly one of the eleven values. */
export function isPlacement(v) {
  return typeof v === "string" && ALLOWED_PLACEMENTS.has(v);
}

/**
 * Normalise one incoming Print_Location__c value.
 *
 * Returns:
 *   { ok: true,  value: "Front" }   -- a real value, write it
 *   { ok: true,  value: null }      -- caller sent "" / null, meaning "clear it"
 *   { ok: false, detail: "..." }    -- not a valid value, 400 before the org does
 *
 * The empty-string-means-null branch exists because that is how every other
 * clearable field in this app behaves (see actualStart/actualEnd in
 * production-runs/[id].js) -- a run whose location was set by mistake has to
 * have a way back to blank, and Salesforce wants null for that, not "".
 */
export function parsePlacement(v) {
  if (v === undefined) return { ok: true, value: undefined }; // field not sent at all
  if (v === null || v === "") return { ok: true, value: null };
  if (!isPlacement(v)) return { ok: false, detail: String(v) };
  return { ok: true, value: v };
}

/**
 * Run a SOQL query that SELECTs a field which may not exist in this org yet,
 * falling back to the same query without it.
 *
 * WHY THIS EXISTS. Print_Location__c has to be created by hand in each org
 * (dev2, staging, then production via Peter's change set), and the app
 * deploys from the repo on a completely different schedule. A field named in
 * a SELECT that the running user can't see -- because the field doesn't exist
 * yet, OR because a change set deployed it with field-level security off for
 * every profile, which is the default and has bitten this project twice --
 * does not come back as an empty column. Salesforce rejects the whole
 * statement as a parse error, so the Production Runs list on every board goes
 * to zero rows and the drawer looks broken.
 *
 * So: try with the field, and only if the failure actually names that field,
 * retry without it. Any other failure (a real syntax error, a permissions
 * problem elsewhere) is returned untouched so it still surfaces loudly.
 *
 * `buildSoql(include)` must return the same query twice, once with the field
 * in the SELECT list and once without.
 *
 * Returns runQuery's shape plus `hadField`, so a caller can tell "the org
 * has no location on these runs" apart from "every run's location is blank".
 */
const _warnedMissing = new Set();
function failureMentionsField(data, field) {
  try {
    const arr = Array.isArray(data) ? data : data ? [data] : [];
    return arr.some(
      (e) =>
        e &&
        (e.errorCode === "INVALID_FIELD" || e.errorCode === "INVALID_TYPE") &&
        typeof e.message === "string" &&
        e.message.indexOf(field) !== -1,
    );
  } catch {
    return false;
  }
}
export async function runQueryOptionalField(env, buildSoql, field) {
  const first = await runQuery(env, buildSoql(true));
  if (first.ok) return { ...first, hadField: true };
  if (!failureMentionsField(first.data, field)) return { ...first, hadField: true };

  if (!_warnedMissing.has(field)) {
    _warnedMissing.add(field);
    console.warn(
      `[placements] ${field} is not queryable in the active org -- falling back ` +
        `to the query without it. Either the field hasn't been created here yet, ` +
        `or it was deployed by a change set with field-level security off (check ` +
        `FLS for the integration user's profile).`,
    );
  }
  const second = await runQuery(env, buildSoql(false));
  return { ...second, hadField: false };
}

/**
 * Split a Production_Method__c.Placements__c multi-select into an array.
 * Salesforce stores multi-selects as "Front;Back;Tag". Unknown values are
 * kept rather than dropped -- if Setup gains a value before this file does,
 * the UI should still show what the method actually says.
 */
export function splitPlacements(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
