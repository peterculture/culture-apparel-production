/**
 * Real per-worker PIN auth for the general boards' login screen (login.html
 * -> POST /api/worker-login). Mirrors how _station.js/station-login already
 * do real server-side PIN auth for the station tablets -- same shape, same
 * "PINs never ship to the browser" rule, just keyed by WORKER NAME instead
 * of station.
 *
 * WHY THIS EXISTS (2026-08-13): until now, login.html checked its PIN
 * entirely client-side against two SHARED, hardcoded values (worker PIN
 * "1234", manager PIN "6767") that were also printed right on the login
 * screen -- anyone could read them out of the page source or the UI itself.
 * "Manager" role only ever meant anything because of a second, separate
 * check (MANAGER_NAMES in ca-api.js): the PIN alone never actually proved
 * who was typing. This replaces that with one real PIN per person, verified
 * here, that identifies BOTH who they are and their role in a single lookup
 * -- the shared-secret hint text is gone from login.html because there's no
 * longer a single secret to print.
 *
 * SECRET (set in the Cloudflare Pages project settings, NEVER in the repo)
 *   WORKER_PINS   JSON map of name -> PIN, e.g. {"Anthony":"7042","Gian":"3391"}
 *                 Every name here should also be in VALID_NAMES (ca-api.js) --
 *                 a name with no PIN configured simply can't log in via PIN
 *                 (existing per-board "switch user" name pickers are a
 *                 separate, lower-friction path and aren't gated by this).
 *
 * NOT a session/cookie system (unlike station-login): the verified {name,
 * role} this returns gets written into localStorage by login.html exactly
 * the way the old client-only check did, so every other board's existing
 * localStorage-based identity model keeps working unchanged. Only the
 * VERIFICATION step at login became real; nothing downstream had to change.
 */
import { safeEqual } from "./_station.js";

// Manager role only sticks for this named roster, regardless of whose PIN
// was entered -- same list as MANAGER_NAMES in ca-api.js. Keep both in sync
// if it ever changes; this server-side copy is now the AUTHORITATIVE one
// (it's what actually decides the role written into the login response),
// ca-api.js's copy remains for the isManager()/confirmManager() UI checks
// that run after login.
export const MANAGER_NAMES = ["Gian", "Anthony", "Parker"];

/**
 * @param {string} pin - raw PIN string from the request body.
 * @returns {Promise<{name:string, role:'manager'|'worker'}|null>} the
 *   matching person + their role, or null if the PIN matched nobody.
 *   Throws if WORKER_PINS is missing/invalid JSON (server misconfigured --
 *   distinct from "wrong PIN" so the caller can tell those apart).
 */
export async function matchWorkerPin(env, pin) {
  let pins;
  try {
    pins = JSON.parse(env.WORKER_PINS || "");
  } catch {
    throw new Error("WORKER_PINS is missing or not valid JSON");
  }
  if (!pins || typeof pins !== "object") throw new Error("WORKER_PINS is missing or not valid JSON");

  const candidate = String(pin == null ? "" : pin);
  // Check EVERY configured entry (not just until the first match) so how
  // long the check takes doesn't itself leak which position in the roster
  // matched -- same constant-time spirit as safeEqual() below, just applied
  // across the whole map instead of one comparison.
  let matched = null;
  for (const name of Object.keys(pins)) {
    const expected = pins[name];
    if (expected == null) continue;
    if (safeEqual(candidate, String(expected))) matched = name;
  }
  if (!matched) return null;

  const role = MANAGER_NAMES.includes(matched) ? "manager" : "worker";
  return { name: matched, role };
}
