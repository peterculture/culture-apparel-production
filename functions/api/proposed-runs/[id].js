/**
 * PATCH /api/proposed-runs/:id
 *
 * Records what the shop decided about one of the Account Manager's suggestions.
 *
 * Body (send any subset):
 *   {
 *     "status": "Proposed" | "Accepted" | "Rejected" | "Superseded",
 *     "createdRunId": "a3X..."   // the Production_Run__c built from it, or
 *                                // "" / null to unlink
 *   }
 *
 * The usual path is both at once: a manager creates the real run from the
 * suggestion, and that same save marks the proposal Accepted and links it. The
 * link is what lets anyone later ask "did we actually honour what the AM asked
 * for?" -- without it an Accepted proposal is just an assertion.
 *
 * DELIBERATELY NOT DELETING REJECTED PROPOSALS. A rejected suggestion is the
 * most useful record on this object: it says the shop was asked for a date and
 * said no. That is the conversation the AM and the floor need to have, and it
 * disappears if the row does.
 *
 * This endpoint CANNOT touch a Production Run. It writes only to
 * Proposed_Run__c, so no accept/reject can move press time or reach the
 * calendar -- the same isolation the object itself was designed for.
 */
import { sfFetch, apiVersion, jsonError } from "../_sf.js";

const OBJECT = "Proposed_Run__c";
const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

const STATUSES = ["Proposed", "Accepted", "Rejected", "Superseded"];

export async function onRequestPatch({ params, request, env }) {
  try {
    const id = params && params.id;
    if (!SF_ID.test(id)) return jsonError("invalid_id", 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("invalid_json", 400);
    }
    if (!body || typeof body !== "object") return jsonError("invalid_body", 400);

    const payload = {};

    if ("status" in body) {
      // Status__c is a restricted picklist, so a bad value would 400 from
      // Salesforce anyway -- but with a message about the field, not about the
      // request. Checking here gives the caller something it can act on.
      if (STATUSES.indexOf(body.status) === -1) return jsonError("bad_status", 400);
      payload.Status__c = body.status;
    }

    if ("createdRunId" in body) {
      if (body.createdRunId == null || body.createdRunId === "") {
        payload.Created_Run__c = null;
      } else {
        if (!SF_ID.test(body.createdRunId)) return jsonError("bad_createdRunId", 400);
        payload.Created_Run__c = body.createdRunId;
      }
    }

    if (Object.keys(payload).length === 0) return jsonError("no_valid_fields", 400);

    const path = `/services/data/${apiVersion(env)}/sobjects/${OBJECT}/${id}`;
    const resp = await sfFetch(env, path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.status !== 204) {
      const detail = await resp.text().catch(() => "");
      console.error("Proposed run update failed", resp.status, detail);
      return jsonError("update_failed", resp.status);
    }

    return Response.json(
      { ok: true, id, updated: Object.keys(payload) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("internal_error", 500);
  }
}
