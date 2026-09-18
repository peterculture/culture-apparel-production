/**
 * /api/production-methods/:id  —  COMPATIBILITY ALIAS, added 2026-09-18.
 *
 * See ./index.js for why this exists. The handlers live in
 * ../decorations/[id].js; this file only forwards the two verbs that file
 * serves, so a client still on the pre-rename URL can PATCH a decoration's
 * status, checklist or fields and DELETE one exactly as before.
 *
 * ⛔ No logic here, ever. New code calls /api/decorations/:id.
 */
export { onRequestPatch, onRequestDelete } from "../decorations/[id].js";
