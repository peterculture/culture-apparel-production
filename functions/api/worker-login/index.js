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
 * Response, success:  { ok:true, name:"Anthony", role:"manager" }
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

    return Response.json(
      { ok: true, name: match.name, role: match.role },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
