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
 *
 * Not a session/cookie endpoint -- login.html writes the returned name/role
 * into localStorage exactly like before, so every other board's existing
 * localStorage-based identity check keeps working with no changes needed
 * there. See ../_worker-auth.js's header comment for the full rationale.
 */
import { jsonError } from "../_sf.js";
import { matchWorkerPin } from "../_worker-auth.js";
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
