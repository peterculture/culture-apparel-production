# CLAUDE.md — culture-apparel-production

Working notes for Claude Code. Read this before touching anything.

## What this is

A production dashboard for a screen-printing shop. Nine static HTML pages plus ~50 Cloudflare
Pages Functions that proxy Salesforce. Deployed as the Pages project `culture-apparel-preprod`.

**There is no build step, no bundler, no test suite, and no package.json.** Files are committed
as-is and Cloudflare Pages redeploys on push to `main`. `wrangler.toml` exists only for local
`npx wrangler pages dev .` — it is not used by the deploy.

**There is one deployment, and it can point at any of three Salesforce orgs.** The active org is a
KV value (`sf_env:active` in the `INVENTORY` namespace), switched at runtime from the UI. So a code
change goes live for dev2, staging and production at once — you can't ship a fix "to staging only."
Write code that degrades safely when a field doesn't exist in the active org.

Anthony pushes to `main` himself and runs his own tests after yours. Don't push.

## Layout

```
*.html              one page each; see "Editing a page" below
ca-api.js           the browser-side API client — window.CAApi, classic script, not a module
support.js          GENERATED runtime — do not edit (rebuild is `cd dc-runtime && bun run build`)
doc-page.js         printable-document element, used only by order-sheet.html
functions/api/
  _*.js             NOT routes. Pages won't expose them; route handlers import them.
  <name>/index.js   a route: GET /api/<name>
  <name>/[id].js    a route: /api/<name>/:id
  _to_delete/       dead code, ignore
```

Underscore modules are where the logic lives; routes are mostly validation and response shape.
`_sf.js` (auth + query), `_session.js` (capabilities), `_rework.js` (reprint builder),
`_pm-rollup.js` / `_print-date-rollup.js` / `_priority-rollup.js` (Order rollups),
`_placements.js` (the print-location picklist), `_station.js` (station auth).

## Hard rules — these have each cost a real afternoon

**1. An FLS-hidden field is a parse error, not a blank column.**
Naming a field the integration user can't see makes the *entire* SELECT fail with
`No such column 'X' on entity 'Y'` — identical wording to a genuinely missing field. The whole
board empties rather than losing one value. This has bitten the project four times. Before adding
any field to a SELECT list, know that it is visible to the integration profile in **every** org.
When a field may be missing, use `runQueryOptionalField` from `_placements.js` (retries without it)
or put the feature on its own endpoint that can answer `available:false`.

Reading the error: only the field named after the `^` is the offender; the text before it is just
the surrounding SELECT. Salesforce reports one at a time.

**2. `__r` relationship names are not guessable.** A custom lookup's child relationship name is
whatever was typed when the field was created. `PrintMethod__r` has never existed in any org — the
relationship is `Production_Runs`. Use a semi-join (`WHERE PrintMethod__c IN (SELECT Id FROM
Production_Method__c WHERE Order__c = …)`) or an explicit follow-up query, matching what
`_rework.js`, `_print-date-rollup.js`, `run-results` and `shortfalls` already do. A wrong guess is a
parse error that surfaces as zero rows, which reads as "nothing to do today."

**3. `/composite` returns HTTP 200 even when every sub-request failed.** Always inspect
`compositeResponse` entry by entry. With `allOrNone:true`, innocent sub-requests report
`PROCESSING_HALTED` — reporting the first failure in array order names a bystander and hides the
cause. Prefer the first non-`PROCESSING_HALTED` failure, and say which `referenceId` it came from.
Hard cap is **25 sub-requests** per call; chunk beyond that.

`_composite.js` is the one implementation — `runComposite` (a single call, ≤25), `runChunked` (any
number, chunked, rewriting `@{ref.id}` to real Ids across chunk boundaries, and refusing a reference
it cannot resolve rather than writing the literal string into a lookup) and `rollbackCreated`.
**Import it rather than writing a sixth copy.** `_rework.js`, `run-results/index.js` and
`run-line-items/index.js` still carry their own older copies; they work, they are deliberately left
alone, and nothing new should follow them.

`allOrNone` covers **one call only**, so chunked work has no native atomicity. Follow the head/tail
shape `_rework.js` established: the *head* is everything referenced later by `@{ref.id}` and must fit
in a single call — a head that doesn't fit is a hard failure, never a half-build; the *tail* needs
only real Ids and chunks freely. A tail failure rolls the head back. Half-done is worse than not-done
on every board here, because a half-built record looks **finished** to the person who picks it up.

**4. `Quantity_Planned_c__c` is the real API name.** The org's Field Name is literally
`Quantity_Planned_c`, so the automatic `__c` lands on top of an existing `_c`. Do not "fix" it —
`Quantity_Planned__c` does not exist and the write 400s. Flagged in three files already.

**5. Picklist values are not their labels.**

| Field | Trap |
|---|---|
| `Order.Order_Substatus__c` | The entry shown as "In Production" **stores as `Production`** |
| `Order.Shipping_Delivery__c` | The entry shown as "Local Dropoff" **stores as `Delivery`** |
| `Order.Status` | `'Complete'` — no "d" |
| `Production_Method__c.Status__c` | `'Completed'` — with the "d". Mixing these up is a real past bug |

These picklists are **restricted**, so a drifted copy doesn't fail politely — the org 400s with
`INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` after the request was already accepted here.

**6. Formula fields return HTML.** `GOA_Order_Number__c` and `Customer_Order_Name__c` come back as
`HYPERLINK()` markup (`<a href="/801…">18171-15</a>`). Anything from a formula field goes through
`api.text()` before rendering or comparing. No exceptions — this has shipped as a visible bug twice.

`text()` parses with `DOMParser` into an inert document, **not** `innerHTML` on a detached div
(E6.7). A detached element does not run `<script>`, which is why the old version looked safe, but it
still loads resources — so `<img src=x onerror=…>` fired the handler. Measured in Chrome against the
real function, not assumed. The input is Salesforce rich text: whatever somebody typed into a field,
with nothing in between sanitising it. Don't change the entity or whitespace behaviour while you are
in there — the boards depend on the exact strings it returns today.

**7. Deliberately excluded fields — leave them out.**
`Reject_Reason__c` and `Notes__c` on `Production_Run_Line_Items__c` (invisible to the integration
user; including them took down the whole counting screen). `Pre_Production_Item__c.Notes__c` (same
cause, since fixed, but nothing reads it). If you ever want them back: grant FLS in **every** org
first, then add them.

**8. Never add `Last_Updated_By__c` to `Production_Method__c` or `Pre_Production_Item__c`.** That
field exists on `Order` only. Adding it made the entire `_rework.js` head composite fail with
`PROCESSING_HALTED` — and only when a worker name was present, so the first test passed. Attribution
for a method is `CreatedBy`.

**9. Runs are inserted `Planned`, then PATCHed to `Confirmed`.** Not born Confirmed. The Apex
`ProductionEventPublisher` keys off `Trigger.oldMap`, which is null on insert, so a run created
already-Confirmed may publish no calendar Event at all. See `publishRun()` in
`production-runs/index.js`. Every write must end at `Confirmed` regardless, because
`ProductionAutoSchedulerService` silently overwrites `Scheduled_Start__c`/`Scheduled_End__c` on any
run that isn't pinned.

**10. Nothing in this app ever deletes a `Production_Run_Line_Items__c` row.** To un-allocate a
size, set `Planned_Qty__c` to **0** — never delete, and never null.

The Salesforce Flow `Production_Run_Generate_Line_Item_Skeleton` (dev2 + staging) creates these
rows and fires on create OR update. Its only guard is **"does this run have any rows"** — not "were
rows generated". So if the app ever empties a run, the Flow regenerates the whole skeleton from its
own arithmetic on that run's next save, silently overwriting whatever a manager just did. A row
holding 0 keeps the guard satisfied.

Zero is also arithmetically free: the Flow's give-back loop adds `Planned_Qty__c` and subtracts
`Incomplete_Qty__c` per matching row, so a 0 row contributes 0 — identical to absence.
`Total_Planned_Qty__c` is a SUM roll-up (0 adds nothing) and `_rework.js` filters `qty > 0`, so
zero rows are skipped there too.

**0, not null.** In this codebase blank means "nobody touched this" and a number means "someone
decided" — which is why `counting.html` seeds its inputs as `''` rather than `0`. A 0 here records
a manager's decision not to print that size on this run, and should read as one.

## Conventions to follow

- **Allow-list every write.** No endpoint accepts a caller-supplied field name. See
  `ALLOWED_FIELDS` in `orders/[id].js` for the pattern.
- **No client-supplied SOQL.** Queries are fixed-shape; the browser supplies parameters, which are
  shape-validated (Salesforce Id regex `^[a-zA-Z0-9]{15,18}$`) before reaching a WHERE clause.
- **Use `runQuery`, not raw `sfFetch`, for lists.** It follows `nextRecordsUrl` pagination; reading
  `data.records` off the first response silently truncates at 2000 rows.
- **Compare Ids on the first 15 chars.** Salesforce returns 18; callers may hold 15.
- **Rollups are best-effort.** Callers `await` them and ignore the result — a rollup must never fail
  the caller's own write.
- **Failures must not look like success.** `_rework.js` returns a named `reason` and a `detail`
  carrying Salesforce's own errorCode/message. Never collapse a failure into the "nothing to do"
  shape; that cost an afternoon once already.
- Comments in this codebase carry the *why*, often forty lines of it above the code. Read them
  before changing behavior, and update them when you do.

## Editing a page

Pages are not React source. Each is an `<x-dc>` template plus a logic block:

- Markup uses `{{binding}}` holes, `<sc-if value="{{cond}}">`, `<sc-for list="{{arr}}" as="x">`.
- `<helmet>` children (fonts, `<style>`) are hoisted into `document.head`.
- `<script type="text/x-dc" data-dc-script>` defines `class Component extends DCLogic` with
  constructor state, `componentDidMount/DidUpdate/WillUnmount`, handlers, and `renderVals()`.

`renderVals()` returns **one flat object** — anything the markup references must come back from it.
There is no JSX. Bindings resolve through a small safe evaluator (dotted paths, indexing, simple
`==`/`===`), not `eval`, so no arbitrary expressions in the markup. A whole-value attribute binding
passes the raw value through, which is how `onClick="{{ handler }}"` gets a real function.
`hint-placeholder-*` attributes are authoring-tool only and do nothing at runtime.
Render errors show as a red `.sc-logic-error` overlay, not a blank page.

**Never put `<sc-for>`, `<sc-if>` or `<x-import>` inside a `<table>`.** The HTML parser only allows
table-related elements there, so it foster-parents the custom element OUT of the table before any
script runs — and the runtime adopts its template from the live DOM (`parseDcDocument` →
`dc.innerHTML`), so it compiles the mangled version. The loop simply does not render. This shipped:
`order-sheet.html`'s garment size breakdown printed with **no size columns and no per-size
quantities** on the sheet that tells the press how many of each size to run. Measured — 2 `<sc-for>`
inside `<table>` in the raw source became 0 in the parsed DOM.

`support.js` *has* a repair for this: it refetches the page as raw text and re-parses the unmangled
template. It is gated on `if (!window.__resources)` — and **E4.4 set `window.__resources` on all nine
pages to self-host React, so that repair has been dead since 2026-08-31.** Do not rely on it.

Use `display:table` / `table-row` / `table-cell` on divs instead: identical layout, and the parser
leaves custom elements alone because none of it is a table. `sc-for` renders as a React Fragment
(`walkFor`), so its children land directly in the row with no anonymous cell box. Spell out
`text-align` and `vertical-align`, which `<th>`/`<td>` got free from the UA stylesheet. Worked
example: the size grid in `order-sheet.html`. `node tools/check-dc-templates.mjs` fails on any
regression — **`<select>` is NOT affected**, measured: all 39 `<sc-for>` inside `<select>` survive.

Loading a library from a page: append a real `<script>` to `document.head` (see how `stats.html`
loads Chart.js) rather than putting it in `<helmet>` — script execution through the template
compiler's `<template>` parsing step is untested.

Shared board behavior lives in `ca-api.js`: identity, `buildNavBoards()`, `stageOfMethod()`,
`text()`, the loader, `PLACEMENTS`, `SIZE_ORDER`. Prefer adding there over a fourth copy in a page.

**Colours live in `tokens.css`** (E10.2), linked from every page's real `<head>` before `support.js`.
It holds the base chrome — reset, body, links, scrollbars, the `ca-shake` / `ca-slide-left`
keyframes — which used to be duplicated in seven to nine pages, plus the palette as CSS custom
properties. Custom properties work in inline styles here (`cssToObj` keeps `--x` keys and passes
values through), so `style="color:var(--text-muted)"` is the house style; a new hex literal is not.

**Tokens are named by role, not by value, and that matters.** `#232327` is a border 108 times and
text exactly once (calendar's "nothing scheduled"). `--border-subtle` and `--text-ghost` share a
value today and have nothing else in common — E9.4 has to lighten the text one without touching any
border. Never collapse two roles because they currently look the same.

Two things that must stay literal hex: **Chart.js config in `stats.html`** (it paints a canvas and
cannot resolve a custom property — the two `ticks.color` values are deliberately still `#6C665C`),
and anything compared as a string. A quoted `color:'#…'` is JavaScript; an unquoted `color:#…` is a
style attribute.

## Auth model

Two layers, and only one of them is enforced today.

- **UI:** `POST /api/worker-login` verifies a personal PIN against `WORKER_PINS` and returns
  `{name, role}`, written to `localStorage`. Roles come from `ADMIN_NAMES` / `MANAGER_NAMES` in
  `_worker-auth.js` — Anthony is admin; Gian and Parker are managers.
- **Server:** the same login issues a signed HttpOnly `ca_sess` cookie. `requireCap()` verifies it
  and looks capabilities up fresh per request.

`requireCap` is **report-only** unless `ACCESS_ENFORCE=1`: it logs what it would have denied and
lets the request through. Wiring it into a new endpoint therefore can't break that endpoint today.

**Coverage as of E6.5 (2026-09-01): 21 of 24 files with a mutating handler call `requireCap`.** The
three that don't are `worker-login`, `worker-logout` and `station-login` — requiring a session to
create a session is circular, and they are deliberately left open.

**Workers now derive capabilities.** `capsFor()` used to return `[]` for anyone who was not an admin
or a manager, which meant enforcement would have locked every worker out of every station — count-in,
item sub-status, ink and screen stock, and the counting screen. `DEFAULT_WORKER_CAPS` in
`_session.js` grants exactly the four endpoints a worker needs (`items.status`, `orders.receive`,
`inventory.edit`, `results.submit`) and nothing else. Verified with `ACCESS_ENFORCE=1`: a worker
reaches every station endpoint, is refused on the manager surface, and an anonymous request is
refused everywhere.

⚠️ **Still read the report-only log before setting `ACCESS_ENFORCE=1`.** Five working days of
`[access] would deny` lines is what says whether that worker list is actually right — a capability
missing from it shows up there as somebody being denied something they do all day. The list above is
derived from the endpoints, not from watching the shop.

## In-flight work: Production Results

The four-quantity model (`Planned` / `Incomplete` / `Misprint` / `Damaged` on
`Production_Run_Line_Items__c`) is deployed to dev2 and staging, not production.

**Only problems are recorded.** There is deliberately no "good" or "complete" field — what went
right is whatever's left over. **Confirmed as permanent by the product owner 2026-08-31 (D1):** the
Path to Pilot's E1.4, which asked for a stored produced quantity, is REJECTED, not deferred. The
counting screen shows an *implied* produced figure — `planned − (incomplete + misprint + damaged)`,
computed at render time, read-only, never written. Persisting it re-opens D1. That makes a perfect run and an untouched run byte-identical, so
`Result_Status__c` (`Draft` → `Submitted`) is the only evidence a human counted. Keep that invariant:
submit stays enabled with every box empty, and a run with zero line items is submittable on purpose.

**Incomplete is not a loss like the others.** Misprinted and damaged garments are spent and need new
blanks — that's the reprint. Incomplete garments are intact on a shelf and need press time on the
*same* method — that's a make-up run. Never merge them, and never derive one from the other.

**The reprint automation is application code, not Salesforce metadata.** `createReworkIfNeeded` in
`_rework.js`, called from exactly two places: the method-status PATCH in `production-methods/[id].js`
and the submit in `run-results/index.js`. There is no reprint Flow or trigger — don't look for one.
Its four gates, in order: (1) no existing reprint for this order, (2) every run `Submitted`,
(3) every non-Cancelled method `Completed`, (4) some line carrying misprint or damaged > 0.

`GET /api/rework-check?orderNumber=…` re-runs every gate read-only and names the one that stopped
it. Use it before debugging by hand.

## Known rough edges (not urgent, but don't be surprised)

- `index.html`: the KPI strip is all real as of 2026-08-31. It used to carry three hardcoded demo
  constants (On-Time 96%, Misprint Rate 1.8%, Shipped·7d 14) with invented trend arrows, rendered
  even in live mode. Now: Overdue and Misprints are computed from the board's own cards (both
  deduped **per order** — a two-method job is one late job and its `TotalQtyMisprints__c` is an
  Order-level rollup repeated onto each sibling card), and Shipped·7d sums `/api/stats-trend`'s
  `shipped` series, showing an em dash if that call fails rather than a plausible number.
  **On-Time % was removed, not fixed** — it needs a delivered-vs-promised comparison and there is
  no completion/ship date on Order (see `/api/stats-trend`'s header). Bringing it back needs that
  field; do not reconstruct it from `LastModifiedDate`, which is a fine proxy for a trend line but
  silently skews for any order edited after completion.
- `calendar.html`: `commitDrop` and `durationOf` read only `ProductionRuns[0]` and
  `ProductionMethods[0]`, so dragging a multi-run or multi-method order silently moves the first
  one. Relevant if front/back ever become two methods.
- `pre-production.html`: `assign()` is local-only — worker assignment never writes to Salesforce,
  and its name list is hardcoded demo people unrelated to `VALID_NAMES`.
- `README.md` is stale above the fold: it names the pre-switcher `SF_LOGIN_URL` / `SF_CLIENT_ID` /
  `SF_CLIENT_SECRET` env vars, references `/api/vendors` (now in `_to_delete`), and calls the Pages
  project `culture-apparel-prepod`. The roles table and Zenkraft sections are still accurate.

## Verifying a change

There are no tests. What's available:

- **`node tools/smoke.mjs` — run this before every push.** Under three seconds, no network. It
  catches the failure this project actually has: a file the code depends on that is not in the
  repo. Every check in it is an incident that really happened — `tokens.css` linked by nine pages
  and never committed (site down, twice, the second time as `token.css` one letter off), the two
  shipment routes saved without a `.js` extension (both endpoints dead, answering 405 with an empty
  body), `_placements.js` nearly shipping untracked with four importers. It also parses every server
  module and every board's embedded logic, and folds in `check-dc-templates.mjs` and `contrast.mjs`.
  Install it as a hook with:
  `printf '#!/bin/sh\nexec node tools/smoke.mjs\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push`

  A green run means the deployment is **well-formed**, not that it works — it never talks to
  Salesforce. The rule below still stands.
- `npx wrangler pages dev .` with a git-ignored `.dev.vars` for local Functions.
- `GET /api/admin/sf-env` — which org the deployment is currently pointed at.
- `GET /api/rework-check?orderNumber=…` — read-only trace of the reprint gates.
- Cloudflare Pages logs — most failure paths here `console.error` with the Salesforce errorCode and
  message, deliberately.
- Every board falls back to demo data and an amber "Demo data" chip when its fetch fails, so a
  broken query looks like a working page with fake numbers. Check the network tab, not the screen.
