/**
 * POST /api/orders/:id/complete
 *
 * Marks a shipping/receiving order finished: PATCHes the standard Order.Status
 * field to 'Complete'. This is deliberately a narrow, single-purpose endpoint
 * rather than adding "Status" to the generic PATCH allow-list in
 * ../[id].js -- that allow-list exists specifically so the public proxy can
 * never be used to write an arbitrary Salesforce field/value (see that file's
 * header comment), and the standard Status field drives real order-fulfillment
 * automation elsewhere in the org (Order_Substatus__c's rollup is separate and
 * untouched by this -- see ../../_pm-rollup.js -- but Status itself is NOT a
 * field this app should ever set to anything other than this one known-good
 * value). Mirrors the shape of ../[id]/reprint.js: one action, one outcome,
 * no caller-supplied field name or value.
 *
 * 'Complete' is the same literal string /api/production-orders already reads
 * (`Order__r.Status = 'Complete'`) to force a fully-closed order into that
 * board's Done column, and the same value the existing Production Dashboard
 * sets directly in Salesforce today -- this endpoint doesn't introduce a new
 * status, it just gives the Shipping/Receiving Dashboard a way to set the
 * same one.
 *
 * Body (all optional): { by: "Worker Name" }
 */
import { sfFetch, apiVersion, jsonError } from "../../_sf.js";
import { requireCap } from "../../_session.js";

const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

export async function onRequestPost({ params, request, env }) {
  const gate = await requireCap(request, env, "orders.edit");
  if (gate.denied) return gate.response;
  try {
    const id = params && params.id;
    if (!SF_ID.test(id)) return jsonError("invalid_id", 400);

    let body = {};
    try {
      body = (await request.json()) || {};
    } catch {
      // No body / non-JSON body is fine -- `by` is optional.
    }
    const by = (body.by == null ? "" : String(body.by)).trim().slice(0, 80);

    const payload = { Status: "Complete" };
    if (by) payload.Last_Updated_By__c = by;

    const path = `/services/data/${apiVersion(env)}/sobjects/Order/${id}`;
    const resp = await sfFetch(env, path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.status === 204) {
      return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const detail = await resp.text();
    console.error("orders/:id/complete: Order PATCH failed", resp.status, detail);
    return jsonError("update_failed", resp.status);
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
