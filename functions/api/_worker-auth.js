/**
 * Real per-worker PIN auth for the general boards' login screen (login.html
 * -> POST /api/worker-login). Same shape as the station PIN auth that used to
 * live in _station.js -- same "PINs never ship to the browser" rule -- but
 * keyed by WORKER NAME rather than by station. That station system was removed
 * in E6.6 because nothing ever called it; this one is what actually runs, and
 * it now covers the station tablets too.
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
 * ORIGINALLY not a session system: the verified {name, role} was written into
 * localStorage by login.html exactly the way the old client-only check did, so
 * every board's existing identity model kept working unchanged and only the
 * VERIFICATION step became real. That is still true of the client half -- but
 * worker-login ALSO issues a signed HttpOnly ca_sess cookie now (see
 * issueSession in _session.js), which is what requireCap() reads on every
 * mutating route. Two identities, deliberately: localStorage for what the
 * screen shows, the cookie for what the server will allow.
 *
 * THREE-TIER ROLE (2026-08-13): originally just manager/worker (manager ==
 * Gian/Anthony/Parker). Split further so per-person UI access can differ
 * within the old "manager" bucket:
 *   admin   -- Anthony only. Every dashboard (including Pre-Production
 *              Management) plus the Salesforce environment switcher.
 *   manager -- Gian, Parker. Every dashboard including Pre-Production
 *              Management, but NOT the environment switcher.
 *   worker  -- everyone else. Every dashboard EXCEPT Pre-Production
 *              Management; no environment switcher.
 * ADMIN_NAMES/MANAGER_NAMES below are the AUTHORITATIVE roster: this is the
 * only place that decides which role a name gets. ca-api.js never reads
 * these lists directly -- it just trusts whatever role() comes back from
 * here (via login.html's or a switch-account gate's call to this endpoint)
 * and stored in localStorage, then gates on that string (buildNavBoards()'s
 * canAccessManagement(), isAdmin() for the env-switcher button). Separate
 * from ca-api.js's OWN MANAGER_NAMES (['Gian','Anthony','Parker']), which
 * still gates the confirmManager() destructive-action re-check and is
 * intentionally unchanged -- that feature draws the line at "elevated"
 * (admin or manager), not at this finer admin/manager split.
 */
import { safeEqual } from "./_station.js";

export const ADMIN_NAMES = ["Anthony"];
export const MANAGER_NAMES = ["Gian", "Parker"];

/**
 * @param {string} pin - raw PIN string from the request body.
 * @returns {Promise<{name:string, role:'admin'|'manager'|'worker'}|null>}
 *   the matching person + their role, or null if the PIN matched nobody.
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
  //
  // TWO ENTRY SHAPES (2026-08-18). A value may be the PIN as a bare string, or
  // an object { pin, caps }. Both are supported on purpose: converting the
  // whole roster in one go is exactly the kind of edit that locks a shop out
  // of its own system at 6am, so entries can move over one at a time.
  let matched = null;
  for (const name of Object.keys(pins)) {
    const entry = pins[name];
    if (entry == null) continue;
    const expected = typeof entry === "object" ? entry.pin : entry;
    if (expected == null) continue;
    if (safeEqual(candidate, String(expected))) matched = name;
  }
  if (!matched) return null;

  const role = ADMIN_NAMES.includes(matched) ? "admin" : MANAGER_NAMES.includes(matched) ? "manager" : "worker";
  return { name: matched, role };
}
