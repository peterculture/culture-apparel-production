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
 * SECURITY (rewritten 2026-08-28 -- the previous note described only the
 * Salesforce branch and did not mention the direct-fetch branch below, which
 * was at the time an unrestricted server-side proxy):
 *
 *   BRANCH A -- Salesforce ContentVersion. Only the Id-shaped substring of the
 *   caller's string is ever used, and the outbound request is built from OUR
 *   OWN env/instance_url via sfFetch, never from the caller's host. The Id must
 *   now carry the ContentVersion key prefix (068); before that check, any URL
 *   ending in a 15-18 character run -- a Google Images thumbnail token, for
 *   instance -- was fed to /sobjects/ContentVersion/<junk>/VersionData.
 *
 *   BRANCH B -- direct fetch. This USED TO fetch any http(s) URL the caller
 *   supplied and stream the bytes back: a server-side request forgery hole
 *   reaching anything the Worker could route to, internal and link-local
 *   addresses included. It is now closed on three sides:
 *     - the host must match ALLOWED_MOCKUP_HOSTS below;
 *     - literal IPs, loopback/private/link-local/CGNAT ranges and internal
 *       suffixes (.local, .internal, localhost) are refused outright;
 *     - redirects are followed MANUALLY, at most MAX_REDIRECTS hops, and every
 *       hop is re-validated -- `redirect: "follow"` would have let an
 *       allow-listed host bounce the request to anywhere on the second hop.
 *   Nothing is forwarded outbound: no credentials, no caller headers, GET only.
 *
 * Adding a host to the allow-list is a deliberate decision, not a shrug: this
 * endpoint fetches on the server's behalf from inside the network boundary.
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
import { adoptMockup } from "../_mockup-adopt.js";

/* Salesforce record Ids are 15 (case-sensitive) or 18 (case-insensitive,
   checksum-suffixed) alphanumeric characters. Matches the LAST such run in
   the string so it works whether `url` is the full shepherd download link
   or, in the future, just a bare Id someone passes directly.

   The leading 068 is the ContentVersion key prefix and it is REQUIRED. Without
   it this pattern matched any trailing 15-18 character run, so a Google Images
   URL ending in a token of that length took the ContentVersion branch and was
   sent to Salesforce as an Id -- the wrong branch, a guaranteed failure, and a
   confusing one to debug. Branch A only knows how to fetch ContentVersion, so
   only a ContentVersion Id belongs in it. */
const ID_RE = /(068[a-zA-Z0-9]{12,15})(?:[/?#].*)?$/;

/* ALLOWED_MOCKUP_HOSTS IS GONE (B1 / D8, 2026-09-02). It held six hosts and
   blocked 38 of 54 mockups in dev2 -- pinimg, freepngimg, flaticon,
   hometownapparel, emojiterra, artsdupage. The list was not too short; the
   assumption under it was wrong. It was written expecting Mockup_URL__c to
   hold Vault links with pasted ones as the exception, and measured across both
   sandboxes, NOT ONE order has ever used the Vault flow. Every mockup in the
   shop is a pasted link.

   Widening it per host would have been a treadmill: a new customer host is a
   new deploy, forever, each one re-opening a little more of the surface E6.2
   closed. Instead branch B now fetches once and ADOPTS the image into
   Salesforce (see _mockup-adopt.js), after which the record holds a 068 Id and
   every later request takes branch A -- authenticated, no outbound request at
   all. The list is not widened; it stops being the mechanism.

   WHAT STILL GUARDS BRANCH B, because caching relocates the SSRF risk rather
   than removing it: http(s) only; literal IPs and loopback/private/link-local/
   CGNAT ranges and .local/.internal/localhost refused; redirects followed
   manually with every hop re-validated; GET only, no credentials or caller
   headers forwarded; and now a byte cap and a timeout, neither of which
   existed while the allow-list was making them feel less urgent.

   ⚠️ SAY THE COST OUT LOUD: for PUBLIC hosts this is now an open image proxy.
   Anyone who can reach /api/mockup-proxy can have this server fetch any public
   http(s) URL and hand back up to MAX_MOCKUP_BYTES of it. Nothing internal is
   reachable -- that is what isBlockedAddress() is for, and it is tested -- and
   a URL matching no Design record is fetched but never adopted, so it cannot
   write anything. What is gone is the ability to say "this server only ever
   talks to six hosts."

   That trade was made deliberately (D8): the alternative was a per-customer
   allow-list treadmill, and 70% of the shop's mockups were broken meanwhile.
   The thing that keeps strangers off this endpoint is the perimeter --
   Cloudflare Access, E6.4 -- which is NOT enabled yet. If E6.4 is never
   switched on, this endpoint is the reason to revisit, not the allow-list. */

const MAX_REDIRECTS = 3;

/* A mockup is a few hundred KB. This is not a tuned figure -- it is "refuse
   the absurd" -- and it exists because the bytes are now buffered in the
   Worker and base64'd into a Salesforce request rather than streamed straight
   through. */
const MAX_MOCKUP_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

/* Refuse anything that could point back inside the network. The allow-list
   above already excludes bare IPs (an IP literal matches no domain suffix), so
   this is the second lock rather than the first -- it exists so that widening
   the allow-list later cannot quietly re-open the SSRF hole. */
function isBlockedAddress(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".home.arpa")) return true;
  // Any IPv6 literal. Too many ways to spell loopback/ULA/link-local to
  // enumerate, and no mockup host is ever a bare IPv6 address.
  if (h.includes(":")) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if ([a, Number(v4[2]), Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return true;
    if (a === 0 || a === 10 || a === 127) return true;              // this-network, private, loopback
    if (a === 169 && b === 254) return true;                        // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;               // private
    if (a === 192 && b === 168) return true;                        // private
    if (a === 100 && b >= 64 && b <= 127) return true;              // CGNAT
    if (a >= 224) return true;                                      // multicast + reserved
    return false;
  }
  return false;
}

/** Both gates, in one place, so every hop of a redirect chain gets the same check. */
function hopAllowed(u) {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (isBlockedAddress(u.hostname)) return false;
  return true;
}

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

export async function onRequestGet({ request, env, waitUntil }) {
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

    // BRANCH B -- not a ContentVersion link. See the SECURITY note above for
    // why each of these gates is here.
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      return jsonError("no_id_found", 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return jsonError("no_id_found", 400);
    }
    if (!hopAllowed(parsed)) {
      // Logged with the host so a legitimate mockup on a new host is a
      // one-line allow-list change rather than a mystery blank thumbnail.
      console.error("mockup-proxy: blocked host", parsed.hostname);
      return jsonError("blocked_host", 400);
    }

    try {
      /* Manual redirect handling. `redirect: "follow"` would validate only the
         FIRST hop -- an allow-listed host answering 302 to http://169.254.169.254
         would be followed by the platform with no further checks, which is the
         SSRF hole wearing a hat. Every hop is re-validated here instead. */
      let current = parsed;
      let resp = null;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        resp = await fetch(current.toString(), {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(8000),
        });
        if (resp.status < 300 || resp.status > 399) break;
        const location = resp.headers.get("location");
        if (!location) break;
        let next;
        try {
          next = new URL(location, current);
        } catch (_) {
          console.error("mockup-proxy: unparseable redirect target", location);
          return jsonError("fetch_failed", 502);
        }
        if (!hopAllowed(next)) {
          console.error("mockup-proxy: blocked redirect", current.hostname, "->", next.hostname);
          return jsonError("blocked_host", 400);
        }
        if (hop === MAX_REDIRECTS) {
          console.error("mockup-proxy: too many redirects", parsed.toString());
          return jsonError("fetch_failed", 502);
        }
        current = next;
      }
      if (!resp || !resp.ok) {
        console.error("mockup-proxy: external mockup fetch failed", current.toString(), resp && resp.status);
        return jsonError("fetch_failed", (resp && resp.status) || 502);
      }

      /* Buffered, not streamed, because the same bytes are about to be written
         into Salesforce -- a stream can only be read once. The declared length
         is checked first so an absurd file is refused before it is pulled into
         memory, and the real length after, because Content-Length is a claim
         and not every host sends one. */
      const declared = Number(resp.headers.get("content-length") || 0);
      if (declared > MAX_MOCKUP_BYTES) {
        console.error("mockup-proxy: mockup too large (declared)", current.toString(), declared);
        return jsonError("mockup_too_large", 502);
      }
      const bytes = await resp.arrayBuffer();
      if (bytes.byteLength > MAX_MOCKUP_BYTES) {
        console.error("mockup-proxy: mockup too large", current.toString(), bytes.byteLength);
        return jsonError("mockup_too_large", 502);
      }
      const contentType = resp.headers.get("content-type") || "application/octet-stream";

      /* Adopt in the BACKGROUND. The person waiting on this request wants the
         picture, not a round trip to Salesforce -- so the bytes go back now and
         the upload runs after the response, via waitUntil where the platform
         offers it. Best-effort in every sense: adoptMockup never throws, and a
         failure here must never turn a working image into a broken one. It is
         the same contract the rollups follow (CLAUDE.md) -- await it, ignore
         the result. */
      const adopting = adoptMockup(env, current.toString(), bytes, contentType)
        .catch((e) => { console.error("mockup-proxy: adopt threw", e); });
      if (typeof waitUntil === "function") waitUntil(adopting);

      return new Response(bytes, {
        headers: {
          "Content-Type": contentType,
          /* Deliberately shorter than branch A's 600s. This copy is about to
             stop being the one served: once adoption lands, the record holds a
             068 Id and the next request takes branch A. A long cache here would
             keep the browser on the pre-adoption answer well past the point the
             data changed underneath it. */
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch (err) {
      console.error("mockup-proxy: external mockup fetch error", parsed.toString(), err);
      return jsonError("fetch_failed", 502);
    }
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
