/**
 * POST /api/worker-logout
 *
 * Clears the signed session cookie issued by /api/worker-login.
 *
 * WHY THIS HAS TO EXIST. These are shared tablets. Before the session cookie,
 * "switch user" only had to clear localStorage, because localStorage was the
 * whole identity. Now the server holds one too -- and a cookie that outlives
 * the person who earned it is exactly the stale-privilege problem the app's
 * own comments have worried about for months, except worse, because this one
 * the UI can't see and therefore can't warn about.
 *
 * So every path that ends a session client-side must call this. If it doesn't,
 * the next person to pick up the tablet inherits the last person's
 * capabilities on every API call, while the UI cheerfully shows them as
 * themselves.
 *
 * Always returns 200. There is no failure mode worth reporting: no cookie to
 * clear is the same outcome as a cleared one, and a logout that appears to
 * fail invites someone to walk away from a tablet that is still signed in.
 */
import { clearCookieHeader } from "../_session.js";

export async function onRequestPost() {
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "Set-Cookie": clearCookieHeader() } },
  );
}
