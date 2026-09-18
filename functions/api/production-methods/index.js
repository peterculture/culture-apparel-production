/**
 * /api/production-methods  —  COMPATIBILITY ALIAS, added 2026-09-18.
 *
 * The handlers live in ../decorations/index.js. This file adds nothing and
 * decides nothing; it re-exports them so the OLD url keeps answering.
 *
 * WHY IT EXISTS. Cloudflare Pages builds each route from the path under
 * functions/, so when the Decoration rename moved
 * functions/api/production-methods/ to functions/api/decorations/, the URL
 * moved with it — and ca-api.js was still calling the old one. A Pages
 * request with no matching function is not a 404 you can read: it falls
 * through to the static assets, so GET answered **200 with the SPA's HTML**
 * (every board's JSON.parse then failed and it fell back to demo data) and
 * POST / PATCH / DELETE answered **405 with an empty body** — the same
 * signature as the extensionless-route incident in tools/smoke.mjs check 2.
 * Anthony hit it on 2026-09-18: Create Production Plan & Send failed and the
 * page could not say why, because nothing came back to say it with.
 *
 * ca-api.js now calls /api/decorations. This alias is here for the clients
 * that are not reloaded on our schedule — a shop-floor tablet holding a
 * cached ca-api.js, a bookmarked link — so they keep working through the
 * rollout instead of dying quietly on a 405.
 *
 * ⛔ Do not point new code at this path, and do not add logic here. If the
 * two paths ever need to behave differently, that is a second endpoint with
 * its own file, not a branch in an alias.
 */
export { onRequestGet, onRequestPost } from "../decorations/index.js";
