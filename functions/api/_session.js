/**
 * Who is calling, and are they allowed to do this?
 *
 * THE PROBLEM THIS SOLVES. Until now the app's permissions were UI-only:
 * login.html wrote {name, role} into localStorage and every board read it back
 * to decide which buttons to draw. No request carried any identity, so the
 * server could not have enforced a rule even if one existed -- and anyone who
 * opened devtools could set caShopRole to 'admin' and get every button. That is
 * fine while everyone inside the perimeter is trusted equally. It stops being
 * fine the moment one person is allowed to do something another isn't.
 *
 * HOW THIS WORKS. On a successful PIN login the server issues a signed cookie
 * naming the person. It is HttpOnly, so page JavaScript cannot read or forge
 * it, and it is signed with SESSION_SECRET, so the browser cannot mint one.
 * Every guarded endpoint verifies the signature, looks the person's
 * capabilities up, and decides.
 *
 * CAPABILITIES ARE LOOKED UP FRESH, NOT BAKED INTO THE COOKIE. The cookie
 * carries only the name. Editing WORKER_PINS therefore takes effect on the next
 * request instead of after everyone logs out and back in -- which matters
 * because the whole point of this is being able to change someone's access
 * quickly.
 *
 * REPORT-ONLY BY DEFAULT. With ACCESS_ENFORCE unset, a denial is logged and the
 * request is ALLOWED through. Watch the logs, confirm nobody legitimate is
 * being blocked, then set ACCESS_ENFORCE=1. A wrong guess about who needs what
 * shows up as a log line instead of a press operator stuck mid-shift.
 *
 * WHAT THIS IS NOT. Cloudflare Access is still the perimeter -- this decides
 * what an already-admitted person may do, not who gets in. And it deliberately
 * FAILS OPEN when SESSION_SECRET is missing: an unsigned deployment logs
 * loudly and keeps working rather than locking the whole shop out of its own
 * production system over a config mistake. That is a considered trade, not an
 * oversight; the threat here is a curious employee, not an attacker who has
 * already breached Access.
 */

import { ADMIN_NAMES, MANAGER_NAMES } from "./_worker-auth.js";

const COOKIE = "ca_sess";
const DEFAULT_TTL_HOURS = 12;

/**
 * What a manager can do when WORKER_PINS hasn't been given an explicit list.
 *
 * These mirror what the UI already allows: ca-api.js's canAccessManagement()
 * (admin or manager) is what gates every edit button on the calendar board, and
 * ADMIN_NAMES/MANAGER_NAMES in _worker-auth.js is what decides that role. So
 * the server now permits exactly what the client already permits -- Anthony,
 * Gian and Parker edit and confirm; everyone else is view-only.
 *
 * Deliberately NOT env.switch: that is admin-only today (isAdmin(), Anthony
 * alone), and a default shouldn't quietly widen it.
 */
const DEFAULT_MANAGER_CAPS = [
  "management",
  "runs.schedule",
  "runs.confirm",
  "runs.delete",
  "orders.edit",
  "methods.edit",
  "items.edit",
  "proposals.decide",
  // The shop-floor set below. A manager standing at a station has to be able to
  // do what the worker beside them can do, or enforcement would lock the person
  // in charge out of the counting screen.
  ...["items.status", "orders.receive", "inventory.edit", "results.submit"],
];

/**
 * What a worker can do. (E6.5, 2026-09-01.)
 *
 * THIS LIST IS THE DIFFERENCE BETWEEN ENFORCEMENT AND A STOPPED SHOP. Before
 * it, capsFor() returned [] for anyone who was not an admin or a manager -- so
 * every worker held zero capabilities, and the moment ACCESS_ENFORCE=1 was set
 * they would have been locked out of every station: garment count-in, item
 * sub-status, ink and screen stock, and recording production results. The
 * roadmap already flagged the last one ("results.submit appears in exactly one
 * place -- the check itself"); it was not one field, it was the whole
 * shop-floor surface.
 *
 * Each entry maps to exactly one endpoint a worker uses to do their job, and
 * nothing else. Notably absent: anything under orders.edit, methods.edit or
 * runs.* -- a worker records what happened, they do not reschedule the shop.
 *
 * ⚠️ CONFIRM THIS LIST AGAINST THE REPORT-ONLY LOG BEFORE ENFORCING. Five
 * working days of `[access] would deny` lines will say whether it is right;
 * a missing capability here shows up there as a worker being denied something
 * they legitimately do all day. That log is the point of report-only mode --
 * do not skip it on the strength of this comment.
 */
const DEFAULT_WORKER_CAPS = [
  "items.status",     // POST /api/update-item-status  -- station sub-status
  "orders.receive",   // POST /api/update-order-receiving -- garment count-in
  "inventory.edit",   // POST /api/inventory -- ink and screen stock
  "results.submit",   // POST /api/run-results -- the counting screen
];

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(env) {
  const secret = env && env.SESSION_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

/** True when a denial should actually block. Anything other than "1" is report-only. */
export function isEnforcing(env) {
  return String((env && env.ACCESS_ENFORCE) || "") === "1";
}

/**
 * Mint a session cookie value for a person. Called only by worker-login.
 * Returns null when SESSION_SECRET is unset -- login still succeeds, it just
 * doesn't hand out a session, and every guard stays in report-only.
 */
export async function issueSession(env, name) {
  const k = await key(env);
  if (!k) {
    console.error("SESSION_SECRET is not set -- no session issued, access checks are report-only");
    return null;
  }
  const ttlH = Number(env.SESSION_TTL_HOURS) > 0 ? Number(env.SESSION_TTL_HOURS) : DEFAULT_TTL_HOURS;
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlEncode(enc.encode(JSON.stringify({ n: name, iat: now, exp: now + ttlH * 3600 })));
  const sig = b64urlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(payload))));
  return { value: `${payload}.${sig}`, maxAge: ttlH * 3600 };
}

/** The Set-Cookie header for a freshly issued session. */
export function sessionCookieHeader(session) {
  // HttpOnly is the whole point -- page JS must not be able to read or replace
  // this the way it can localStorage. SameSite=Lax is enough because every
  // caller is same-origin (the app only ever fetches relative /api/* paths).
  return `${COOKIE}=${session.value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${session.maxAge}`;
}

/** Clears it, for logout. */
export function clearCookieHeader() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
  return null;
}

/**
 * Verify the cookie and return { name } or null.
 * Null covers every failure the same way -- absent, malformed, bad signature,
 * expired. Callers only ever need "do I know who this is".
 */
export async function readSession(request, env) {
  try {
    const raw = readCookie(request);
    if (!raw) return null;
    const [payload, sig] = raw.split(".");
    if (!payload || !sig) return null;

    const k = await key(env);
    if (!k) return null;

    const ok = await crypto.subtle.verify("HMAC", k, b64urlDecode(sig), enc.encode(payload));
    if (!ok) return null;

    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    if (!data || !data.n) return null;
    if (Number(data.exp) < Math.floor(Date.now() / 1000)) return null;
    return { name: String(data.n) };
  } catch (e) {
    console.error("readSession failed", e);
    return null;
  }
}

/**
 * The capabilities configured for one person, read fresh from WORKER_PINS.
 *
 * Two entry shapes, both valid:
 *   "Anthony": "7042"                              -> PIN only, caps DERIVED
 *   "Anthony": { "pin": "7042", "caps": ["*"] }    -> PIN + explicit caps
 *
 * WHEN NO CAPS ARE SPELLED OUT, THEY ARE DERIVED FROM THE EXISTING ROSTER.
 * Anthony (ADMIN_NAMES) gets everything; Gian and Parker (MANAGER_NAMES) get
 * DEFAULT_MANAGER_CAPS; everyone else gets nothing, i.e. view-only.
 *
 * This started out returning [] for a bare string, which was a mistake worth
 * naming: it meant the correct behaviour depended on somebody hand-writing a
 * JSON blob without a typo, and a single misspelled name would silently strip a
 * manager of everything. Deriving from the roster the org already maintains
 * makes the common case correct with no configuration at all, and leaves the
 * object form for the exceptions -- which is what per-person overrides are
 * actually for.
 *
 * An explicit caps array always wins, including an empty one: `"caps": []` is a
 * deliberate "this person may do nothing", not a missing value.
 */
export function capsFor(env, name) {
  if (!name) return [];

  let pins = null;
  try {
    pins = JSON.parse(env.WORKER_PINS || "");
  } catch {
    // Fall through to the derived defaults rather than returning nothing. A
    // malformed WORKER_PINS is already going to break login for everyone; it
    // shouldn't also silently strip capabilities from the people who are
    // already signed in.
    console.error("WORKER_PINS is not valid JSON -- falling back to role-derived capabilities");
  }

  const entry = pins && pins[name];
  if (entry && typeof entry === "object" && Array.isArray(entry.caps)) {
    return entry.caps.map(String);
  }

  if (ADMIN_NAMES.includes(name)) return ["*"];
  if (MANAGER_NAMES.includes(name)) return DEFAULT_MANAGER_CAPS.slice();
  /* Anyone who reached here signed in with a real personal PIN from
     WORKER_PINS -- they are shop floor, not a stranger. This used to return []
     and that was the enforcement trap: a signed-in worker with no capabilities
     is indistinguishable from no session at all. (E6.5) */
  return DEFAULT_WORKER_CAPS.slice();
}

export function hasCap(caps, cap) {
  return caps.indexOf("*") !== -1 || caps.indexOf(cap) !== -1;
}

/**
 * The guard every protected endpoint calls:
 *
 *   const gate = await requireCap(request, env, "runs.confirm");
 *   if (gate.denied) return gate.response;
 *
 * In report-only mode `denied` is always false and the reason is logged, so
 * wiring this into an endpoint cannot break it before you choose to enforce.
 */
export async function requireCap(request, env, cap) {
  const session = await readSession(request, env);
  const caps = session ? capsFor(env, session.name) : [];
  const allowed = !!session && hasCap(caps, cap);
  if (allowed) return { denied: false, name: session.name };

  const who = session ? session.name : "(no session)";
  const enforcing = isEnforcing(env);
  console.warn(
    `[access] ${enforcing ? "DENIED" : "would deny"} ${who} -> ${cap} ` +
    `(${new URL(request.url).pathname}) caps=[${caps.join(",")}]`,
  );

  if (!enforcing) return { denied: false, name: session ? session.name : null, wouldDeny: true };

  return {
    denied: true,
    name: session ? session.name : null,
    response: Response.json(
      {
        error: "forbidden",
        detail: session ? "missing_capability" : "no_session",
        capability: cap,
        // Named so the UI can say something useful instead of "something went
        // wrong" -- "you need runs.confirm" is actionable; a 403 is not.
        message: session
          ? `${session.name} is not allowed to ${cap}. Ask Anthony to grant it.`
          : "Your session has expired. Sign in again.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    ),
  };
}
