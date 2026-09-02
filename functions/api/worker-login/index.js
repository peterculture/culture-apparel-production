/**
 * POST /api/worker-login
 * Body: { "pin": "7042" }
 *
 * Verifies a PERSONAL PIN against the WORKER_PINS env var (see
 * ../_worker-auth.js) and, on a match, returns who it belongs to and their
 * role. Replaces the old client-only check in login.html against two
 * shared, hardcoded PINs (worker "1234" / manager "6767") that were also
 * printed on the login screen itself. The PIN map itself never leaves this
 * function -- only the matched name + role go back to the browser.
 *
 * Response, success:  { ok:true, name:"Anthony", role:"admin"|"manager"|"worker" }
 * Response, no match: 401 { error:"invalid_pin" }
 * Response, WORKER_PINS unset/invalid: 500 { error:"server_misconfigured" }
 * Response, PIN shared by two people: 500 { error:"pin_ambiguous" } (E6.8)
 *
 * login.html writes the returned name/role into localStorage, so every board's
 * localStorage-based identity check keeps working unchanged -- but this DOES
 * also issue the signed HttpOnly ca_sess cookie (see the Set-Cookie below),
 * which is what requireCap() reads on every mutating route. The header used to
 * say "not a session/cookie endpoint" and had done since before the cookie was
 * added forty lines further down its own file. See ../_worker-auth.js's header
 * comment for the full rationale.
 */
import { jsonError } from "../_sf.js";
import { matchWorkerPin, AmbiguousPinError } from "../_worker-auth.js";
import { issueSession, sessionCookieHeader } from "../_session.js";

export async function onRequestPost({ env, request }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_body", 400);
    }
    const pin = String(body && body.pin != null ? body.pin : "");
    if (!pin) return jsonError("missing_pin", 400);

    let match;
    try {
      match = await matchWorkerPin(env, pin);
    } catch (e) {
      /* Named in the log because the fix is a thirty-second edit in the Pages
         settings, and unfindable without knowing WHICH two people collided.
         The PIN itself is never logged. The browser is told only
         "pin_ambiguous" -- login.html turns any 500 into "ask a manager",
         which is the right instruction and, unlike "incorrect PIN", doesn't
         send someone away retyping a PIN that was correct. (E6.8) */
      if (e instanceof AmbiguousPinError) {
        console.error(`worker-login: that PIN is configured for more than one person: ${e.names.join(", ")}`);
        return jsonError("pin_ambiguous", 500);
      }
      console.error("worker-login: WORKER_PINS misconfigured", e);
      return jsonError("server_misconfigured", 500);
    }

    if (!match) return jsonError("invalid_pin", 401);

    // ADDED 2026-08-18: hand back a signed, HttpOnly session cookie as well as
    // the name/role. The body is unchanged, so login.html keeps writing
    // localStorage exactly as before and every board's existing identity check
    // still works -- but from here on the SERVER can also tell who is calling,
    // which is what makes per-person capability checks possible at all.
    // localStorage decides which buttons get drawn; the cookie decides what the
    // API will actually do.
    // The cookie is issued for EVERY successful check, including the manager
    // PIN typed into confirmManager()'s prompt -- which therefore leaves that
    // tablet's server session as the manager. Accepted by Anthony 2026-09-02
    // on the basis that the manager logs out when they walk away; the full
    // reasoning, and what would have to change if that ever stops holding, is
    // in ca-api.js above confirmManager(). (E6.8)
    const headers = { "Cache-Control": "no-store" };
    const session = await issueSession(env, match.name);
    if (session) headers["Set-Cookie"] = sessionCookieHeader(session);

    return Response.json(
      { ok: true, name: match.name, role: match.role },
      { headers },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
