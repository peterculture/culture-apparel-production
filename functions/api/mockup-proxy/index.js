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
 * SECURITY: when `url` is a Salesforce servlet link, only the Id-shaped
 * substring is ever used -- the outbound request is always built from OUR
 * OWN env/instance_url via sfFetch, never from the caller's host, so that
 * path can't be turned into an open proxy for arbitrary URLs.
 *
 * FALLBACK (added 2026-08-12): found live on a dev2 order whose Design__c
 * record had a plain external image link in Mockup_URL__c (a Google Images
 * thumbnail, gstatic.com) instead of a Salesforce Vault/servlet URL --
 * apparently a staff member pasted a placeholder image rather than
 * uploading through the documented Vault flow. ID_RE correctly finds no
 * Salesforce Id in a URL like that, and the endpoint used to just 400 there,
 * so the card thumbnail silently failed for any order whose mockup wasn't
 * routed through Vault. Since Mockup_URL__c is documented as "a public
 * image link" in the first place (see _mockup.js), any http(s) URL that
 * isn't a Salesforce Id is now fetched directly instead of rejected --
 * still same-origin from the browser's perspective (no open redirect: we
 * stream the bytes back ourselves rather than 302'ing the browser to the
 * caller-supplied host), and still scoped to GET/no credentials forwarded.
 */
import { sfFetch, apiVersion, jsonError } from "../_sf.js";

// Salesforce record Ids are 15 (case-sensitive) or 18 (case-insensitive,
// checksum-suffixed) alphanumeric characters. Matches the LAST such run in
// the string so it works whether `url` is the full shepherd download link
// or, in the future, just a bare Id someone passes directly.
const ID_RE = /([a-zA-Z0-9]{15,18})(?:[/?#].*)?$/;

function streamResponse(resp) {
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
}

export async function onRequestGet({ request, env }) {
  try {
    const reqUrl = new URL(request.url);
    const raw = reqUrl.searchParams.get("url");
    if (!raw) return jsonError("missing_url", 400);

    const m = raw.match(ID_RE);
    const id = m && m[1];

    if (id) {
      const resp = await sfFetch(
        env,
        `/services/data/${apiVersion(env)}/sobjects/ContentVersion/${encodeURIComponent(id)}/VersionData`,
      );
      if (!resp.ok) {
        console.error("mockup-proxy: ContentVersion VersionData fetch failed", id, resp.status);
        return jsonError("fetch_failed", resp.status);
      }
      return streamResponse(resp);
    }

    // Not a Salesforce servlet link -- if it's still a plain http(s) URL,
    // fetch it directly (see FALLBACK note above). Anything else (bad
    // scheme, unparseable) still 400s same as before.
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      return jsonError("no_id_found", 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return jsonError("no_id_found", 400);
    }
    try {
      const resp = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        console.error("mockup-proxy: external mockup fetch failed", parsed.toString(), resp.status);
        return jsonError("fetch_failed", resp.status);
      }
      return streamResponse(resp);
    } catch (err) {
      console.error("mockup-proxy: external mockup fetch error", parsed.toString(), err);
      return jsonError("fetch_failed", 502);
    }
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
