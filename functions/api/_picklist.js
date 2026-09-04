/**
 * Which picklist values does the ACTIVE org actually have?
 *
 * WHY THIS EXISTS. One deployment serves dev2, staging and production -- the
 * active org is a KV value switched at runtime -- so a code change goes live
 * for all three at once and you cannot ship a value "to staging only". When a
 * new picklist value is added to some orgs and not others, the app must not
 * offer it against an org that lacks it: `Receiving_Status__c` is a RESTRICTED
 * picklist, and a restricted picklist does not degrade politely. It rejects
 * the whole PATCH with INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST, so the worker
 * taps a chip and the write simply fails.
 *
 * That is trap 5 in PRODUCTION-DASHBOARD-INFO.md, one level up: not "the
 * stored value is not the label" but "the value does not exist here at all".
 *
 * HOW. One describe call per (org, object) per isolate, cached. Describe is
 * the only thing that answers this question -- a SOQL query tells you which
 * values are IN USE, which is a different and much weaker claim (a value can
 * be perfectly valid and simply unused, which is exactly the state a
 * just-added value is in).
 *
 * ⚠️ FAILS OPEN, DELIBERATELY. If describe errors, this returns null meaning
 * "could not tell" -- NOT an empty list. Callers must treat null as "assume
 * the value is fine" and let the write go through, so Salesforce's own error
 * surfaces via the paths E4.2/E4.3 built. The alternative -- treating a failed
 * describe as "the org has nothing" -- would take the whole garment station
 * offline on a transient Salesforce hiccup, which is a far worse failure than
 * the one being guarded against. "Could not tell" is not "no", the same rule
 * E5.6 settled for shipment counts.
 *
 * The cache is per-isolate and TTL'd. A value added in Setup therefore shows
 * up within CACHE_TTL_MS rather than instantly; that is the right trade for
 * not describing on every board load. There is no invalidation hook because
 * there is nothing to hook -- Setup changes do not call this app.
 */
import { sfFetch, apiVersion, getActiveSfEnv } from "./_sf.js";

const CACHE_TTL_MS = 10 * 60 * 1000;

/* key -> { at: <epoch ms>, values: string[] } */
const _cache = new Map();

/**
 * Active picklist values for one field on one object, in the ACTIVE org.
 *
 * Returns an array of stored values (NOT labels -- these are what a write must
 * send, and on this org's picklists the two happen to be identical, which is
 * exactly the coincidence trap 5 warns you not to lean on elsewhere).
 *
 * Returns null when the answer is unknown: describe failed, the object or the
 * field is not visible to the integration user, or the field is not a picklist.
 * Null means "could not tell", never "none".
 */
export async function activePicklistValues(env, sobject, field) {
  let orgKey = "unknown";
  try {
    orgKey = (await getActiveSfEnv(env)) || "unknown";
  } catch {
    /* fall through with "unknown" -- a shared cache key across orgs would be
       wrong, but this only happens when the env lookup itself is broken, in
       which case the describe below is about to fail too and we return null. */
  }
  const key = `${orgKey}:${sobject}.${field}`;

  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.values;

  try {
    const path = `/services/data/${apiVersion(env)}/sobjects/${encodeURIComponent(
      sobject
    )}/describe`;
    const resp = await sfFetch(env, path);
    if (!resp.ok) {
      console.error(
        `[picklist] describe ${sobject} failed: HTTP ${resp.status}`
      );
      return null;
    }
    const data = await resp.json().catch(() => null);
    const def = data && Array.isArray(data.fields)
      ? data.fields.find((f) => f.name === field)
      : null;
    if (!def || !Array.isArray(def.picklistValues)) {
      console.error(`[picklist] ${sobject}.${field} is not a picklist here`);
      return null;
    }
    const values = def.picklistValues
      .filter((v) => v && v.active)
      .map((v) => v.value);
    _cache.set(key, { at: Date.now(), values });
    return values;
  } catch (e) {
    console.error(`[picklist] describe ${sobject}.${field} threw:`, e && e.message);
    return null;
  }
}

/**
 * Filter a canonical, ORDERED list down to what the active org supports.
 *
 * `optional` names the members that are allowed to be missing. Anything not in
 * `optional` is kept regardless of what describe said -- those are values the
 * app has always depended on, and silently dropping one because a describe
 * came back odd would empty the board rather than lose a chip.
 *
 * Order is preserved from `canonical`: it is the pipeline order the boards
 * render, not the order Salesforce happens to store the values in (dev2 lists
 * them Not Received / Partial / Staged / Counted In, which is not the sequence
 * a delivery actually moves through).
 */
export function supportedFrom(canonical, optional, orgValues) {
  if (!Array.isArray(orgValues)) return canonical.slice(); // could not tell
  const opt = new Set(optional || []);
  return canonical.filter((v) => !opt.has(v) || orgValues.includes(v));
}
