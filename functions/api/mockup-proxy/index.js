/**
 * GET /api/mockup-proxy?url=<Design__c.Mockup_URL__c value, url-encoded>
 *
 * BACKGROUND (found 2026-08-11 while debugging why the new card-face mockup
 * thumbnails -- and, it turns out, the drawer's mockup image too, which
 * predates this endpoint -- always rendered as a blank box): _mockup.js's
 * header comment documents Mockup_URL__c as "a public image link" that
 * staff produce by dropping a file into the Design record's Vault tab
 * marked Public. Confirmed live against a real Staging record that this
 * isn't what actually ends up in the field -- it's Salesforce's own
 * session-gated file-download servlet URL instead, e.g.
 *   https://cultureapparel--staging.sandbox.lightning.force.com/sfc/servlet.shepherd/version/download/068ca000003q4ozAAA
 * That path only resolves for a browser holding an active Salesforce
 * session in that exact org. This app never has one -- it authenticates
 * server-to-server via OAuth Client Credentials (see _sf.js) -- so an
 * <img src> pointed straight at that URL always fails with no visible
 * error (no alt text to fall back to), which is exactly the "blank slate"
 * symptom reported against the new thumbnails.
 *
 * FIX: don't fetch the caller's URL directly. The trailing path segment of
 * that servlet URL is a ContentVersion Id (Salesforce's "068" prefix), so
 * pull that Id out and fetch the file the same way every other Salesforce
 * call in this app works -- an authenticated sfFetch() against the
 * documented REST API download route, /sobjects/ContentVersion/<id>/VersionData
 * -- then stream the bytes back same-origin so the browser never needs a
 * Salesforce session of its own.
 *
 * SECURITY: only a Salesforce-Id-shaped substring is ever extracted from
 * the caller-supplied `url` param -- the actual outbound request URL is
 * always built from OUR OWN env/instance_url via sfFetch, never from the
 * caller's host. That means this endpoint can't be turned into an open
 * proxy for arbitrary URLs the way a naive "refetch whatever url= says"
 * implementation could.
 */
import { sfFetch, apiVersion, jsonError } from "../_sf.js";

// Salesforce record Ids are 15 (case-sensitive) or 18 (case-insensitive,
// checksum-suffixed) alphanumeric characters. Matches the LAST such run in
// the string so it works whether `url` is the full shepherd download link
// or, in the future, just a bare Id someone passes directly.
const ID_RE = /([a-zA-Z0-9]{15,18})(?:[/?#].*)?$/;

export async function onRequestGet({ request, env }) {
  try {
    const reqUrl = new URL(request.url);
    const raw = reqUrl.searchParams.get("url");
    if (!raw) return jsonError("missing_url", 400);

    const m = raw.match(ID_RE);
    const id = m && m[1];
    if (!id) return jsonError("no_id_found", 400);

    const resp = await sfFetch(
      env,
      `/services/data/${apiVersion(env)}/sobjects/ContentVersion/${encodeURIComponent(id)}/VersionData`,
    );
    if (!resp.ok) {
      console.error("mockup-proxy: ContentVersion VersionData fetch failed", id, resp.status);
      return jsonError("fetch_failed", resp.status);
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    return new Response(resp.body, {
      headers: {
        "Content-Type": contentType,
        // Private (not a shared/public cache) since this is proxied through
        // an authenticated org session; short-lived since a design mockup
        // can be replaced. Same-origin only, no CORS headers needed.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
