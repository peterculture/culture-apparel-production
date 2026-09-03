/**
 * Adopt a pasted mockup image INTO Salesforce, once, on first use. (B1 / D8.)
 *
 * THE PROBLEM. Design__c.Mockup_URL__c is documented as a Vault link, and in
 * practice holds whatever somebody pasted. Measured across both sandboxes:
 * ZERO orders have ever used the Vault flow. In dev2, 38 of 54 mockups were
 * blocked by mockup-proxy's host allow-list; in staging the five most recent
 * orders gave one gstatic.com thumbnail, one freepngimg.com link and three
 * blank. So the allow-list was doing exactly what it was written to do and the
 * feature still failed for most of the shop.
 *
 * WHAT THIS DOES INSTEAD OF WIDENING THE LIST. On the first request for an
 * external mockup, the proxy fetches it once and hands the bytes here. We save
 * them as a file on the Design record and rewrite Mockup_URL__c to the
 * Salesforce servlet URL. Every later request finds a 068 ContentVersion Id and
 * takes branch A -- authenticated, no allow-list, no outbound request at all.
 *
 * This is not a cache built beside the problem. It converts the data into the
 * shape _mockup.js always documented, permanently, one Design record at a time.
 * Widening ALLOWED_MOCKUP_HOSTS would have been a treadmill: a new host per
 * customer, forever, each one a deploy, each one re-opening a little more of
 * the SSRF surface E6.2 closed.
 *
 * ⚠️ THIS TURNS A GET INTO A WRITE, which brings retries, prefetch and two
 * tablets opening the same board at once. Four rules hold it together:
 *
 *   1. WE NEVER TRUST A CALLER FOR THE WRITE TARGET. The proxy is only ever
 *      given ?url= -- it does not know the Design record, and _mockup.js does
 *      not even SELECT its Id. Rather than add a caller-supplied designId
 *      (which would let anyone aim this write at any Design record), we look
 *      the record up BY the URL we were asked to fetch. The lookup is the
 *      authorisation: we can only ever write to a record that already holds
 *      exactly this value.
 *   2. IT IS THE IDEMPOTENCY CHECK TOO. That same query re-reads
 *      Mockup_URL__c at write time. A record already holding a 068 Id was won
 *      by another request; we stop.
 *   3. A VAULT URL IS NEVER OVERWRITTEN, for the same reason.
 *   4. A FAILURE LEAVES THE FIELD ALONE. Half-adopted is worse than
 *      unadopted: the pasted link would be gone and the new one would not
 *      work. Nothing here throws, and nothing here can fail the caller --
 *      serving the image is the job, adoption is opportunistic.
 *
 * 📌 FLS IS THE TRAP (CLAUDE.md trap 1). The integration user needs CREATE on
 * ContentVersion and UPDATE on Design__c.Mockup_URL__c, in EVERY org. This
 * endpoint has only ever read, so it has never needed write permission on
 * anything and probably does not have it yet. That is exactly why adoption is
 * best-effort and logs loudly: in an org where the grant is missing, every
 * mockup still renders, every request just keeps taking branch B, and the log
 * says why. Nothing breaks while the permission is being sorted out.
 */
import { getSalesforceToken, sfFetch, apiVersion, runQuery, soqlQuote } from "./_sf.js";

/* A ContentVersion Id. Same prefix branch A requires -- if Mockup_URL__c
   already contains one there is nothing to adopt. */
const CV_ID_RE = /068[a-zA-Z0-9]{12,15}/;

/* Only images are adopted. A host answering 200 with an HTML error page is a
   real case, and writing that into Salesforce as the mockup would replace a
   broken link with a broken link that looks fixed. */
const IMAGE_TYPE_RE = /^image\//i;

const EXT_BY_TYPE = {
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/gif": "gif",
  "image/webp": "webp", "image/svg+xml": "svg", "image/bmp": "bmp", "image/avif": "avif",
};

/* One isolate's worth of "somebody is already adopting this". Two boards
   opening at once is the ordinary case, not the exotic one -- every tablet in
   the shop loads the same board. This does not replace rule 2 above (it cannot
   see other isolates), it just stops the common duplicate. */
const inFlight = new Set();

/** ArrayBuffer -> base64, chunked so a few hundred KB doesn't blow the stack. */
function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** A filename Salesforce will accept and a human will recognise. */
function fileNameFor(sourceUrl, contentType) {
  let base = "mockup";
  try {
    const last = new URL(sourceUrl).pathname.split("/").filter(Boolean).pop() || "";
    const cleaned = decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, "").replace(/[^\w.-]+/g, "-").slice(0, 60);
    if (cleaned) base = cleaned;
  } catch (_) { /* keep the default */ }
  const ext = EXT_BY_TYPE[String(contentType || "").split(";")[0].trim().toLowerCase()] || "png";
  return `${base}.${ext}`;
}

/**
 * @returns {Promise<{adopted:boolean, reason:string, designId?:string, contentVersionId?:string}>}
 *   Never throws. `reason` is for the log, not for a caller to branch on.
 */
export async function adoptMockup(env, sourceUrl, bytes, contentType) {
  const key = String(sourceUrl || "");
  if (!key) return { adopted: false, reason: "no_source_url" };
  if (!IMAGE_TYPE_RE.test(String(contentType || ""))) {
    return { adopted: false, reason: "not_an_image:" + contentType };
  }
  if (!bytes || !bytes.byteLength) return { adopted: false, reason: "empty_body" };
  if (inFlight.has(key)) return { adopted: false, reason: "already_in_flight" };
  inFlight.add(key);

  try {
    /* Rules 1 and 2: find the record BY the URL, and re-read the field in the
       same breath. soqlQuote escapes it -- a URL is not Id-shaped so it cannot
       be shape-validated, and this is the house helper for exactly that. */
    const { ok, records } = await runQuery(
      env,
      `SELECT Id, Mockup_URL__c FROM Design__c WHERE Mockup_URL__c = ${soqlQuote(key)} LIMIT 5`,
    );
    if (!ok) return { adopted: false, reason: "design_lookup_failed" };
    /* Rule 3. A record that moved to a Vault URL between the proxy's fetch and
       this write is not ours to touch. */
    const targets = (records || []).filter((r) => r.Id && !CV_ID_RE.test(String(r.Mockup_URL__c || "")));
    if (!targets.length) return { adopted: false, reason: "no_adoptable_design" };

    const token = await getSalesforceToken(env);
    if (!token || !token.instance_url) return { adopted: false, reason: "no_instance_url" };

    const v = apiVersion(env);
    const fileName = fileNameFor(key, contentType);
    const versionData = toBase64(bytes);
    const results = [];

    /* One upload PER Design record. The same placeholder pasted onto two
       designs is a real case, and sharing one ContentVersion between them
       would mean deleting one design's mockup deletes the other's. */
    for (const design of targets) {
      const cvResp = await sfFetch(env, `/services/data/${v}/sobjects/ContentVersion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Title: fileName,
          PathOnClient: fileName,
          VersionData: versionData,
          FirstPublishLocationId: design.Id,
        }),
      });
      const cv = await cvResp.json().catch(() => null);
      if (!cvResp.ok || !cv || !cv.id) {
        // The FLS trap, most likely. Named in the log because "mockups still
        // don't work" is otherwise indistinguishable from the old symptom.
        console.error(
          "mockup adopt: ContentVersion create failed", design.Id, cvResp.status,
          JSON.stringify(cv),
          "-- check the integration user has Create on ContentVersion in THIS org",
        );
        results.push({ designId: design.Id, ok: false });
        continue;
      }

      /* The servlet URL is what staff see in the field today and what branch A
         already knows how to read -- ID_RE pulls the 068 out of exactly this
         shape. Writing a bare Id would work for us and confuse every human
         who opens the record. */
      const servlet = `${token.instance_url}/sfc/servlet.shepherd/version/download/${cv.id}`;
      const patchResp = await sfFetch(env, `/services/data/${v}/sobjects/Design__c/${design.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Allow-listed by construction: this endpoint writes exactly one field
        // and its name is a literal here, never anything a caller supplied.
        body: JSON.stringify({ Mockup_URL__c: servlet }),
      });
      if (patchResp.status !== 204) {
        let detail = "";
        try { detail = JSON.stringify(await patchResp.json()); } catch (_) { /* empty */ }
        /* Rule 4, the important half: the file is uploaded but the field still
           holds the pasted link. That is the SAFE way round -- the mockup keeps
           working through branch B, and the next request simply tries again.
           An orphan ContentVersion on the Design record is untidy, not broken. */
        console.error(
          "mockup adopt: Mockup_URL__c update failed", design.Id, patchResp.status, detail,
          "-- check the integration user has Edit on Design__c.Mockup_URL__c in THIS org",
        );
        results.push({ designId: design.Id, ok: false, contentVersionId: cv.id });
        continue;
      }
      console.log("mockup adopt: adopted", design.Id, "->", cv.id);
      results.push({ designId: design.Id, ok: true, contentVersionId: cv.id });
    }

    const won = results.find((r) => r.ok);
    return won
      ? { adopted: true, reason: "adopted", designId: won.designId, contentVersionId: won.contentVersionId }
      : { adopted: false, reason: "write_failed" };
  } catch (err) {
    console.error("mockup adopt: unexpected error", err);
    return { adopted: false, reason: "error" };
  } finally {
    inFlight.delete(key);
  }
}
