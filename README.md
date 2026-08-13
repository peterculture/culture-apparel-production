# Culture Apparel — Redesigned dashboards (drop-in for the Pages repo)

Static pages that replace/augment the HTML in your `culture-apparel-prepod`
Cloudflare Pages repo. They call your **existing** `functions/api/*` proxy over
same-origin `fetch` — no backend changes.

## This build removes the loading splash
Earlier files were single self-contained bundles that showed a brief unpack
splash (the "CA" box) on every navigation. These are **plain pages** instead:
each HTML loads a shared `support.js` runtime — no unpack, no splash. That means
two small shared files ship alongside the HTML.

## Files → all at repo root, next to `functions/`

| File | Purpose | Action |
|------|---------|--------|
| `index.html` | Production Dashboard (kanban) | replace existing |
| `pre-production.html` | Pre-Production board | replace existing |
| `station.html` | Station tablet board | replace existing |
| `shipping.html` | Shipping/Receiving Dashboard (Post-Production → ship/complete) | new |
| `login.html` | PIN + name capture gate | new |
| `order-sheet.html` | Printable order sheet (`order-sheet.html?orderId=<SF Id>`) | new |
| `support.js` | shared UI runtime — **required by all pages** | new |
| `ca-api.js` | Salesforce API client — **required by index / pre-production / station / shipping / order-sheet** | new |
| `doc-page.js` | print helper — **required by `order-sheet.html`** | new |

Upload all nine to the repo root. Keep `functions/`, `wrangler.toml`, env vars
and secrets as-is. Commit + push; Pages redeploys.

### Shipping/Receiving Dashboard (`shipping.html`)
Lists every Order with `Order_Substatus__c = 'Post-Production'` (rollup of every
production method on the order finishing) that isn't already `Status =
'Complete'`. Filter tabs: All Post-Production, Shipping, Delivery (labeled
"Local Dropoff" in Setup — same stored value trap as everywhere else in this
app), Pickup, Split Ship, Order Fulfillment. Backed by new endpoints:
- `GET /api/shipping-orders` — the board's query (`functions/api/shipping-orders/index.js`)
- `POST /api/orders/:id/complete` — sets `Status = 'Complete'` only (`functions/api/orders/[id]/complete.js`)

"Ship Now" opens the existing Zenkraft wizard (`GET /api/orders/:id/zk-wizard-url`,
already shipped) pre-filled with the order; the dashboard then polls
`GET /api/shipments` for a new `zkmulti__MCShipment__c` row and auto-marks
`Shipping_Label_Printed__c`, with a manual "Mark Shipped" toggle as a fallback
since Zenkraft has no callback into this app. UPS is called out as the default
carrier in the UI copy only — no code enforces it (Zenkraft still lets a user
pick another carrier in the wizard itself).

> `support.js` and `ca-api.js` must sit at the site root next to the HTML (each
> page loads `./support.js` and `./ca-api.js` from its `<head>`). If a page
> renders blank, `support.js` is missing; if it's stuck on **Demo data**,
> `ca-api.js` is missing or the API isn't responding (see below).

## Live link / troubleshooting
On load each page calls `GET /api/orders`; the header badge shows
**Live · Salesforce** (green) when it responds, or **Demo data** (amber) with
sample orders if it can't reach the API. If you still see Demo data after
deploy, open DevTools → Network → reload → check `/api/orders`:
- **200 + records** → live (hard-refresh).
- **401 / 500** → Function can't reach Salesforce; check `SF_LOGIN_URL`,
  `SF_CLIENT_ID`, `SF_CLIENT_SECRET` and the Client-Credentials "Run As" user.
- **404** → `functions/` isn't deployed at the project root.

## Notes on this update
- **Assignee / Coordinator picker removed** from the order drawers (it showed
  placeholder names). The small avatar on a card still reflects the real
  `Last_Updated_By__c` when present — pure attribution, no assignment action.
- **Pre-Production Management** is back: the **Management** button (top-right of
  the Pre-Production board) opens the manager inbox (`/api/inbox`) — orders with
  no production method yet. Pick one → set method, vendor (`/api/vendors`), a new
  or existing plan (`/api/plans`), status, and items → **Create Production Plan**
  posts to `/api/production-methods` (builds Requirement → Plan → Method → Items).
- **Print method** inferred from `Printer__r.Name`; edit `methodOf()` in
  `ca-api.js` to tune the keywords.
- **Timers** stored as seconds, shown adaptively (`SS`/`M:SS`/`H:MM:SS`).
- **Specifications for Printing** left as the single field.

## Order tracking / stage placement
The Production Dashboard reads your existing **`/api/production-orders`**
endpoint (filters by `Order_Substatus__c`), not `/api/orders`. That's the one
your repo already built for exactly this, so **no backend change is needed** —
an order whose standard `Status` has advanced (e.g. to "Enter Tracking") still
shows in the right column. The Pre-Production board and the Garment station keep
using `/api/orders` (Status = 'Pre-Production'), unchanged.

## Auth & offline
`login.html` verifies a real, personal PIN per worker server-side (`POST
/api/worker-login`, checked against the `WORKER_PINS` env var — a JSON map of
`name -> PIN`, e.g. `{"Anthony":"7042","Gian":"3391"}` — set in the Cloudflare
Pages dashboard, never in the repo) instead of the old shared, on-screen `1234`
/ `6767` codes. One PIN identifies both who's logging in and their role (see
`ADMIN_NAMES`/`MANAGER_NAMES` in `functions/api/_worker-auth.js`) in a single
step — there's no separate "pick your name" screen anymore. The verified name
+ role still get written to `localStorage` (`caShopRole`, `caShopWorkerName`)
exactly as before, so every other board's own identity check is unchanged.

**Three-tier role & dashboard visibility (2026-08-13):** role is one of
`admin` (Anthony only), `manager` (Gian, Parker), or `worker` (everyone
else) — decided server-side in `functions/api/_worker-auth.js` and never
client-editable. What each tier sees:

| | Dashboards (sidebar) | Pre-Production Management | Salesforce env switcher | Login badge |
|---|---|---|---|---|
| `admin` | all | yes | yes | "Systems Operator" |
| `manager` | all | yes | no | "Manager" |
| `worker` | all except Management | no | no | "Worker" |

This is enforced in `ca-api.js`: `buildNavBoards()` drops the "Pre-Production
Management" sidebar entry unless `canAccessManagement()` (admin or manager)
is true, and `isAdmin()` gates the env-switcher button in every board's
header. `pre-production.html` also re-checks `canAccessManagement()` live
inside `openMgr()`/`openMgrForOrder()` — not just the sidebar link — so a
worker can't reach the Management view via a direct URL (`?view=mgr`) or the
deep link from index.html's "Add another method" button either; both of
those entry points are hidden for workers too, but the live re-check is what
actually stops it if someone still has the link. This is separate from (and
layered on top of) `confirmManager()`'s existing destructive-action PIN
re-check, which is unchanged and still treats admin + manager as equally
"elevated" for that one purpose.

This is app-level auth, same caveat as `station.html`'s PIN gate: it's not a
replacement for **Cloudflare Access** in front of the whole project and
`/api/*` — keep that as the real perimeter. Fonts + Tabler icons load from a
CDN, so the pages need internet.

**Update (2026-08-13):** each board's own "Who's this?" switch-user picker
(the repeat icon on index.html/pre-production.html/shipping.html/
station.html) used to let someone pick any name from the roster directly,
with no PIN — meaning the PIN only gated the FIRST login on a tablet, and
anyone with physical access to an already-logged-in tablet could attribute
their own changes to someone else's name. That gap is now closed: switching
accounts on any of those four boards re-runs the same `POST
/api/worker-login` PIN check as the initial login (a numeric PIN pad replaces
the old grid of name buttons), and the identity that gets set is whatever the
server verifies the PIN belongs to — not whichever name was tapped. On
index.html/pre-production.html this also re-derives `caShopRole`, so a worker
PIN can no longer combine with a stale manager/admin role to grant elevated
rights. `station.html`/`shipping.html` store the verified name under their
own `caStationWorkerName` key as before, but now ALSO write the verified role
to the shared `caShopRole` key, so the three-tier visibility rules above work
correctly even on a tablet that only ever used one of those two boards' own
switch-account gate and never went through `login.html` itself.
