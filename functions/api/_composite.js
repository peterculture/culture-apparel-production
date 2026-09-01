/**
 * Salesforce /composite: the 25-sub-request ceiling, chunking, and rollback.
 *
 * WHY THIS MODULE EXISTS
 *
 * Five endpoints in this codebase build a compositeRequest, and each grew its
 * own near-identical copy of the same result-inspection loop. Three of them
 * (_rework.js, run-results/index.js, run-line-items/index.js) also learned --
 * separately, and after separate failures -- that /composite caps at 25
 * sub-requests. Two did not, and neither did production-methods/index.js. This
 * is the one definition, so the next endpoint gets the ceiling for free.
 *
 * The existing three copies are deliberately left alone for now: they work,
 * they are tested, and rewriting working write paths to prove a refactor is how
 * this project breaks things. New code should import from here.
 *
 * THE THREE TRAPS, ALL OF WHICH HAVE COST TIME ON THIS PROJECT
 *
 * 1. HARD CAP OF 25. Salesforce rejects the ENTIRE composite -- not the
 *    overflow -- when compositeRequest holds more than 25 entries. The caller
 *    sees a complete failure with no partial write, which at least fails
 *    safely, but the message names the limit and not the thing the manager
 *    actually did, so it reads as a bug in the app.
 *
 * 2. HTTP 200 ON TOTAL FAILURE. /composite answers 200 even when every
 *    sub-request failed. Reading resp.ok and moving on reports success for a
 *    write that never happened. Every result must be inspected individually.
 *
 * 3. PROCESSING_HALTED NAMES A BYSTANDER. With allOrNone:true, every
 *    sub-request that was NOT at fault comes back as PROCESSING_HALTED ("the
 *    transaction was rolled back since another operation in the same
 *    transaction failed"). Reporting the first failure in array order therefore
 *    usually names an innocent record and buries the real cause. Prefer the
 *    first NON-halted failure, and say which referenceId it came from.
 *
 * ATOMICITY IS PER-CALL, NOT PER-OPERATION
 *
 * allOrNone:true covers ONE composite call. The moment work is chunked across
 * two calls there is no native atomicity left, and a failure in chunk 2 leaves
 * chunk 1 committed. That is why callers here follow the head/tail shape that
 * _rework.js established:
 *
 *   HEAD -- everything that later records reference by @{ref.id}. Those
 *           references only resolve WITHIN a single composite call, so the head
 *           must fit in one, and a head that does not fit is a hard failure
 *           rather than a half-build.
 *   TAIL -- children that need only real Ids. Chunked freely, because each
 *           chunk stands alone.
 *
 * On a tail failure the caller rolls back what the head created. Half-done is
 * worse than not-done for every writer in this app: a half-split order (some
 * items tagged, some not) or a half-built reprint looks FINISHED on the board.
 */
import { sfFetch, apiVersion } from "./_sf.js";

/** Salesforce's hard ceiling. Not a tuning knob -- the API rejects 26. */
export const COMPOSITE_LIMIT = 25;

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

/** @{someRef.id} -- a composite reference, only resolvable inside one call. */
const REF_PATTERN = /@\{([A-Za-z0-9_]+)\.[A-Za-z0-9_.]+\}/;

function errorCodeOf(sub) {
  const b = sub && sub.body;
  if (Array.isArray(b) && b[0]) return b[0].errorCode || "UNKNOWN";
  if (b && b.errorCode) return b.errorCode;
  return "UNKNOWN";
}

function errorMessageOf(sub) {
  const b = sub && sub.body;
  if (Array.isArray(b) && b[0]) return b[0].message || JSON.stringify(b);
  if (b && b.message) return b.message;
  return JSON.stringify(b);
}

const isErr = (sub) => sub.httpStatusCode < 200 || sub.httpStatusCode >= 300;

/**
 * Send ONE composite call of at most COMPOSITE_LIMIT sub-requests.
 *
 * Returns { ok:true, ids } where ids maps referenceId -> created record Id, or
 * { ok:false, detail, failedRef, all } with detail already formatted as
 * "referenceId: ERROR_CODE: message" -- the shape every caller wants to log.
 *
 * Never throws on a Salesforce-side failure; a thrown error here means the
 * fetch itself died.
 */
export async function runComposite(env, compositeRequest, label = "composite") {
  if (!Array.isArray(compositeRequest) || !compositeRequest.length) {
    return { ok: true, ids: {}, all: [] };
  }
  if (compositeRequest.length > COMPOSITE_LIMIT) {
    // A caller bug, not a Salesforce one. Fail here rather than letting
    // Salesforce reject the batch with a message about its own internals.
    return {
      ok: false,
      detail: `${label}: ${compositeRequest.length} sub-requests exceeds the composite ceiling of ${COMPOSITE_LIMIT}`,
      failedRef: null,
      all: [],
    };
  }

  const v = apiVersion(env);
  const resp = await sfFetch(env, `/services/data/${v}/composite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allOrNone: true, compositeRequest }),
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    return { ok: false, detail: `${label}: unparseable response (${resp.status})`, failedRef: null, all: [] };
  }

  const subs = Array.isArray(data && data.compositeResponse) ? data.compositeResponse : [];
  const all = subs.map((s) => ({ referenceId: s.referenceId, httpStatusCode: s.httpStatusCode, body: s.body }));

  const errored = subs.filter(isErr);
  // Trap 3: prefer a genuine error over a PROCESSING_HALTED bystander.
  const real = errored.find((s) => errorCodeOf(s) !== "PROCESSING_HALTED") || errored[0] || null;

  // Trap 2: resp.ok alone proves nothing.
  if (!resp.ok || real) {
    const detail = real
      ? `${real.referenceId}: ${errorCodeOf(real)}: ${errorMessageOf(real)}`
      : `${label}: HTTP ${resp.status}`;
    console.error(`${label}: composite failed`, resp.status, JSON.stringify(data));
    return { ok: false, detail, failedRef: real ? real.referenceId : null, all };
  }

  const ids = {};
  for (const s of subs) {
    if (s.body && s.body.id) ids[s.referenceId] = s.body.id;
  }
  return { ok: true, ids, all };
}

/**
 * Send any number of sub-requests, in order, in chunks of COMPOSITE_LIMIT.
 *
 * `resolved` maps a referenceId from an EARLIER call to its real Id. Any
 * @{ref.id} in a body is rewritten to that real Id before sending, which is
 * what makes it safe for a dependency to sit in a previous chunk.
 *
 * A reference that cannot be resolved and is not created within its OWN chunk
 * is refused outright. Salesforce would otherwise write the literal string
 * "@{leg3.id}" into a lookup field, or fail with MALFORMED_ID -- both of which
 * are far harder to read than being told the reference broke.
 *
 * Stops at the first failing chunk; `createdIds` carries everything written
 * before that point so the caller can roll it back.
 */
export async function runChunked(env, requests, { resolved = {}, label = "composite", refPrefix = "c" } = {}) {
  const createdIds = [];
  if (!Array.isArray(requests) || !requests.length) return { ok: true, ids: {}, createdIds, all: [] };

  const ids = {};
  const all = [];
  for (let i = 0; i < requests.length; i += COMPOSITE_LIMIT) {
    const slice = requests.slice(i, i + COMPOSITE_LIMIT);

    // referenceIds must be unique within a call. Re-label per chunk, but keep
    // any caller-supplied referenceId visible so a failure is still traceable
    // back to the record the caller was thinking about.
    const ownRefs = new Set();
    const chunk = slice.map((r, n) => {
      const ref = r.referenceId || `${refPrefix}${i + n}`;
      ownRefs.add(ref);
      return { ...r, referenceId: ref };
    });

    const substituted = [];
    for (const r of chunk) {
      const out = { ...r, body: substituteRefs(r.body, resolved, ownRefs) };
      if (out.body === undefined) {
        return {
          ok: false,
          detail: `${label}: sub-request ${r.referenceId} references a record created in an earlier chunk that was never resolved`,
          failedRef: r.referenceId,
          createdIds,
        };
      }
      substituted.push(out);
    }

    const res = await runComposite(env, substituted, label);
    if (!res.ok) return { ...res, ids, createdIds };

    all.push(...(res.all || []));
    for (const [ref, id] of Object.entries(res.ids)) {
      ids[ref] = id;
      resolved[ref] = id;
      createdIds.push(id);
    }
  }
  return { ok: true, ids, createdIds, all };
}

/**
 * Rewrite @{ref.id} holes using already-known real Ids. References to a record
 * created inside the SAME chunk are left alone -- Salesforce resolves those
 * itself. Returns undefined when a reference is neither, which the caller turns
 * into a hard failure.
 */
function substituteRefs(body, resolved, ownRefs) {
  if (body == null || typeof body !== "object") return body;
  if (Array.isArray(body)) {
    const out = [];
    for (const v of body) {
      const s = substituteRefs(v, resolved, ownRefs);
      if (s === undefined) return undefined;
      out.push(s);
    }
    return out;
  }
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string") {
      const m = v.match(REF_PATTERN);
      if (m) {
        const ref = m[1];
        if (ownRefs.has(ref)) out[k] = v;               // same chunk: Salesforce resolves it
        else if (resolved[ref]) out[k] = resolved[ref]; // earlier chunk: use the real Id
        else return undefined;                          // neither: refuse
        continue;
      }
      out[k] = v;
    } else if (v && typeof v === "object") {
      const s = substituteRefs(v, resolved, ownRefs);
      if (s === undefined) return undefined;
      out[k] = s;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Best-effort undo of records this request created.
 *
 * Deliberately mirrors _rework.js's rollback: a failure here is LOGGED, never
 * thrown, because the caller has already failed and the genuinely useful
 * artifact is a loud record of exactly which Ids a human has to clean up.
 *
 * `entries` are { object, id } pairs, deleted in the order given -- so callers
 * pass children before parents.
 */
export async function rollbackCreated(env, entries, label = "composite") {
  const v = apiVersion(env);
  const base = `/services/data/${v}/sobjects`;
  const stranded = [];
  for (const { object, id } of entries) {
    if (!object || !SF_ID.test(id || "")) continue;
    try {
      const resp = await sfFetch(env, `${base}/${object}/${id}`, { method: "DELETE" });
      if (resp.status !== 204 && resp.status !== 404) stranded.push(`${object}/${id} (${resp.status})`);
    } catch (e) {
      stranded.push(`${object}/${id} (threw)`);
    }
  }
  if (stranded.length) {
    console.error(`${label} rollback: could not delete, clean up by hand:`, stranded.join(", "));
  }
  return stranded;
}
