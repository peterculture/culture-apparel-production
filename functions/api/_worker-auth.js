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
 *   WORKER_PINS   JSON map of name -> entry. Three shapes, all valid, and they
 *                 can be mixed freely so the roster converts one person at a
 *                 time rather than in one all-or-nothing edit:
 *
 *                   "Titus":   "4417"
 *                   "Parker":  { "pin": "3391", "role": "manager" }
 *                   "Gian":    { "pin": "8820", "caps": ["management"] }
 *
 *                 Every name here should also be in VALID_NAMES (ca-api.js).
 *
 *                 THIS MAP IS THE ROSTER (E6.8, 2026-09-02). Being in it is
 *                 what makes someone staff. Deleting an entry is a real
 *                 revocation that takes effect on their very next request --
 *                 see capsFor() in _session.js, which returns NO capabilities
 *                 for a name the map does not contain, even if that person
 *                 still holds a validly signed session cookie.
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
 * WHERE A ROLE COMES FROM (E6.8, 2026-09-02). An entry's own "role" wins;
 * ADMIN_NAMES/MANAGER_NAMES below are the fallback for entries that don't
 * carry one. Those arrays used to be the only answer, which meant promoting
 * Parker to admin -- or handing "manager" to a new lead on their first
 * morning -- was a code edit, a commit and a deploy, for a decision that is
 * organisational rather than technical. It is a secret edit now, and it takes
 * effect on their next login. The arrays stay because they are the correct
 * answer for today's shop and a roster that needs no configuration to be
 * right is worth more than one that is merely configurable.
 *
 * An unrecognised role string does NOT become a role -- "Manager", "admin ",
 * or a typo like "manger" logs and falls back to the arrays. A permission
 * system must never grant on the strength of a string it doesn't understand.
 *
 * ca-api.js never reads these lists directly -- it just trusts whatever role()
 * comes back from here (via login.html's or a switch-account gate's call to
 * this endpoint) and stored in localStorage, then gates on that string
 * (buildNavBoards()'s canAccessManagement(), isAdmin() for the env-switcher
 * button). Separate
 * from ca-api.js's OWN MANAGER_NAMES (['Gian','Anthony','Parker']), which
 * still gates the confirmManager() destructive-action re-check and is
 * intentionally unchanged -- that feature draws the line at "elevated"
 * (admin or manager), not at this finer admin/manager split.
 */
import { safeEqual } from "./_station.js";

export const ADMIN_NAMES = ["Anthony"];
export const MANAGER_NAMES = ["Gian", "Parker"];

const ROLES = ["admin", "manager", "worker"];

/**
 * The role for one WORKER_PINS entry: the entry's own "role" if it names a
 * real one, otherwise derived from ADMIN_NAMES/MANAGER_NAMES.
 *
 * Exported because _session.js has to derive CAPABILITIES from the same
 * answer. Before E6.8 it consulted the two arrays itself, so a "role" set in
 * the secret moved the UI without moving the server -- the promoted person saw
 * the management buttons and the API refused the writes behind them. One
 * function, one answer.
 *
 * @param {*} entry - the raw WORKER_PINS value: a PIN string, or {pin,role,caps}.
 * @param {string} name - used for the ADMIN_NAMES/MANAGER_NAMES fallback.
 */
export function rosterRole(entry, name) {
  const asked = entry && typeof entry === "object" ? entry.role : null;
  if (asked != null) {
    if (ROLES.includes(asked)) return asked;
    // Loud, because the person this was meant to promote is about to quietly
    // not be promoted, and the only symptom is a missing button.
    console.error(
      `WORKER_PINS: ${name} has role ${JSON.stringify(asked)}, which is not one of ` +
      `${ROLES.join("/")} -- falling back to the built-in roster`,
    );
  }
  if (ADMIN_NAMES.includes(name)) return "admin";
  if (MANAGER_NAMES.includes(name)) return "manager";
  return "worker";
}

/** Thrown when one PIN is configured for more than one person. */
export class AmbiguousPinError extends Error {
  constructor(names) {
    super(`PIN is configured for ${names.length} people`);
    this.code = "pin_ambiguous";
    this.names = names;
  }
}

/**
 * @param {string} pin - raw PIN string from the request body.
 * @returns {Promise<{name:string, role:'admin'|'manager'|'worker'}|null>}
 *   the matching person + their role, or null if the PIN matched nobody.
 *   Throws if WORKER_PINS is missing/invalid JSON (server misconfigured --
 *   distinct from "wrong PIN" so the caller can tell those apart), and throws
 *   AmbiguousPinError if the PIN belongs to more than one person.
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
  // matched -- same constant-time spirit as the imported safeEqual(), just
  // applied across the whole map instead of one comparison.
  //
  // TWO ENTRY SHAPES (2026-08-18). A value may be the PIN as a bare string, or
  // an object { pin, caps }. Both are supported on purpose: converting the
  // whole roster in one go is exactly the kind of edit that locks a shop out
  // of its own system at 6am, so entries can move over one at a time.
  const matches = [];
  for (const name of Object.keys(pins)) {
    const entry = pins[name];
    if (entry == null) continue;
    const expected = typeof entry === "object" ? entry.pin : entry;
    if (expected == null) continue;
    if (safeEqual(candidate, String(expected))) matches.push(name);
  }

  /* A SHARED PIN IS REFUSED, NOT RESOLVED (E6.8, 2026-09-02).
     This loop deliberately doesn't stop at the first match, for the timing
     reason above -- but it used to keep the LAST one, so two people sharing a
     PIN resolved to whichever happened to sit later in JSON key order. Nobody
     was told. If the two held different roles, one of them silently signed in
     with the other's, and every write they made that shift was attributed to
     a person who wasn't there.

     Four-digit PINs and a roster this size make a collision a plausible typo
     rather than an attack, and there is no safe way to pick a winner: identity
     is the ONE thing this function exists to establish. So it refuses, names
     both people in the log so the fix takes thirty seconds in the Pages
     settings, and lets login.html show its "ask a manager" message -- which is
     the honest answer, and crucially NOT "incorrect PIN", so nobody stands at
     a tablet retyping a PIN that was right all along. */
  if (matches.length > 1) throw new AmbiguousPinError(matches);
  if (!matches.length) return null;

  const matched = matches[0];
  return { name: matched, role: rosterRole(pins[matched], matched) };
}
