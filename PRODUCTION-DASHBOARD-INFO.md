# Production Dashboard Info

**The single source of truth for the Culture Apparel production dashboard.** Handoff material,
system reference, trap list, task tracking, validation checklists and change history — one file, so
there is one place to look and one place to update.

**Last updated: 2026-09-04.** Replaces `ROADMAP.md`, `CLAUDE-CODE-QUEUE.md`, `CLAUDE.md`,
`HANDOFF.md`, `VALIDATION-INTEGRATIONS.md`, `VALIDATION-SCENARIOS.md`, `SELECTOR-CHANGE.md` and
`README.md`. See §12 for what happened to each of the old files and which ones were deliberately not
carried over.

---

## How to use and maintain this document

**If you are picking this up cold** — a new session, a switch to Claude Code, a different project —
read **§1 Start here** and **§2 The traps** before anything else, then **§4** for where things stand.
That is the whole handoff; nothing else is required reading.

**The update rule. Every change to Salesforce or to the repo gets written down here, at the moment
it lands — not at the end of a batch, not "when it settles."** The previous set of documents went
stale exactly that way, and a completed week of work read as untouched. Specifically:

| When you… | Update |
|---|---|
| Ship a code change | Its story in §4 or §7 — branch, commit, files, what was verified and what was not |
| Change Salesforce metadata | §4 (the story) **and** §9 (org parity — which orgs now have it) |
| Make a product decision | §5, with a new D-number, and reference it from the story it governs |
| Finish or start a task | §4 — move it between the tables, keep the status marks honest |
| Add new work | §4 for the story, §7 if Claude Code can pick it up |
| Anything at all | §11 Change log — one line, newest first |

**Status marks used throughout:** ✅ done and verified · ⚠️ done with a caveat, read it ·
📝 written but not yet run · 🔴 blocking · 🔵 planned · ⛔ blocked · 📌 remember this ·
🚩 a trap that has already bitten.

📌 **Two rules that govern every entry in this file.**

1. **Record what was measured, not what was assumed.** If something was checked live, say so and say
   how. If it was taken on someone's word, say that too. A story that reads as verified when it was
   not is worse than one that reads as unknown — see D7, which was decided on how the system was
   documented and overturned the same day by one query against real data.
2. **A green board is not a passing test.** Every board falls back to demo data with an amber chip
   when its fetch fails, so a broken change renders as a working page full of plausible fake
   numbers. Check the network tab, not the screen; open the record, not the card.

⚠️ **This file is tracked but has historically lived only as an uncommitted working copy on top of
`origin/main`, which means a branch cut from `origin/main` silently replaces it with a stale version.
That has already destroyed a day of notes twice.** Until the docs branch is merged, copy this file
somewhere outside the repo before switching branches. See §11 for the incident.

---

## Contents

1. **Start here** — how to work on this repo, and what a session can and cannot do
2. **The traps** — the hard rules, each of which has cost a real afternoon
3. **What the system is** — shape, boards, orgs, auth, the data model
4. **Where things stand** — blocking work, phases, closed items, progress to deployment
5. **Decisions** — D1 through D11, and the open ones
6. **Who owns what, and the rules of engagement**
7. **Work queue** — what can be handed to Claude Code right now
8. **Validation** — the integration checklist and the end-to-end scenarios
9. **Org parity and change management** — what each org has, and how to move metadata safely
10. **Deployment and file layout**
11. **Change log**
12. **Retired documents**

---

## 1. Start here
**Written 2026-09-02.** One page, for a session picking this up cold. `ROADMAP.md` is the source of
truth for *what* is left; this is *how to work on it* and what is not written down anywhere else.

A production dashboard for a screen-printing shop. Nine static HTML pages plus ~50 Cloudflare Pages
Functions that proxy Salesforce. **There is no build step, no bundler, no package.json.**

📌 **The one fact that governs everything: there is ONE deployment and it can point at any of three
Salesforce orgs.** The active org is a KV value switched at runtime. A code change goes live for
dev2, staging and production at once — you cannot ship a fix "to staging only." Write code that
degrades safely when a field is missing from the active org.

#### Where it stands

The **app track is essentially finished** — 34 of 53 stories closed, and the code is in good shape.
**Everything still open is a person, not a program:** Peter's Apex tests (E7.2, the long pole —
nothing reaches production without 75% coverage and it has not started), the production promotion
behind it, the validation checklists, and shop-floor testing on real tablets. `ROADMAP.md` has the
detail; do not re-derive it from the code.

#### How to work on this repo

- **Do not push.** Anthony pushes to `main` himself and runs his own tests. Leave work committed on
  a branch. One story per commit, with the Asana id in the message.
- **Anthony commits through the GitHub web UI**, re-applying branch work by hand. So a branch being
  "done" does not mean it is on `main`, and `main` moving does not mean the branch is merged.
  **Audit, do not assume** — that is how an access gate went missing for a day.
- **The repo lives in an iCloud-synced Desktop folder.** iCloud evicts file contents and leaves
  placeholders; git then hangs on a file that is not really there. Expect
  `Resource deadlock avoided`, stale `.lock` files, and the occasional bus error mid-command. Git
  *reads* are mostly fine; **git writes are unreliable.** Moving the repo to `~/dev/` would end this.
- **Two folder mounts share the same name**, one of them empty — the husk of an earlier location.
  Check which one has files before concluding something is missing.

#### The habit that actually caught things

**Verify against the deployed artifact — not the repo, not the dashboard, not the plan.**

Nearly every real find this project has produced came from that one move:

- Six failed builds traced to a named import that no longer existed — the repo looked fine
- An `IF` branch that could never execute, dead since Jan 2023 — the formula read correctly
- 70% of mockups blocked — the code was behaving exactly as designed
- An Access application that looked configured and protected a hostname that did not exist

📌 **A green board is not a passing test.** Every board falls back to demo data with an amber chip
when its fetch fails, so a broken query renders as a working page full of plausible fake numbers.
**Check the network tab, not the screen.**

📌 And the counterpart, learned the hard way: **do not close a question on how the system is
documented.** D7 was decided on the documented mockup workflow, and one query against real data
overturned it the same day.

#### One tool, and its failure mode

To tell whether a branch's work is already on `main`, take the lines its own commits *added* and
check each against `main`'s copy of that file. The script is in `CLAUDE-CODE-QUEUE.md`.

⚠️ **A low percentage means "look at it", never "it is missing."** It flagged `e3.4` at 64% when
`main` had simply refactored that code into a shared helper — legitimately changing every line.

#### What a session like this cannot do

- **Push, commit reliably, or change security settings.** Cloudflare Access applications, account
  settings and secrets are Anthony's to click; the right role is to prepare, instruct and verify.
- **Reach staging from browser automation.** The Chrome extension needs permission on
  `cultureapparel--staging.sandbox.lightning.force.com`, `...my.salesforce-setup.com` and
  `...my.salesforce.com`. dev2 works today; staging does not. This blocks running E8.1/E8.2.
- **Test from outside the shop network.** Access now has a Bypass on the shop's public IP, so a
  browser there proves the bypass, not the block. The decisive external test is a phone with Wi-Fi
  off — that is why E6.4 says *prove a request from outside the policy is blocked*.

#### Working with Anthony

Explain in plain language, not jargon — "branch", "merge" and "checked out" have all needed
unpacking, and unpacking them was never wasted. Lead with what you actually verified and what you
did not. He would rather hear "I was wrong about that" early than have it stand in a document.

---

## 2. The traps
Every rule below has already cost a real afternoon. Read this section before touching code — it is the minefield map, and it is the reason several of the stories in §4 read the way they do.
Working notes for Claude Code. Read this before touching anything.

#### What this is

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

#### Layout

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

#### Hard rules — these have each cost a real afternoon

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

#### Conventions to follow

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

#### Editing a page

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

#### Auth model

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

#### In-flight work: Production Results

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

#### Known rough edges (not urgent, but don't be surprised)

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

#### Verifying a change

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

---

## 3. What the system is
A production dashboard for a screen-printing shop. Workers on shop-floor tablets and managers on
desktops drive an order from pre-production intake through printing to shipping. Salesforce is the
system of record; this app is a faster, purpose-built face on it.

##### Shape of the thing

Nine static HTML pages plus roughly fifty Cloudflare Pages Functions that proxy Salesforce.
Deployed as the Pages project `culture-apparel-preprod`.

**There is no build step, no bundler, no test suite and no `package.json`.** Files are committed
as-is and Cloudflare Pages redeploys on push to `main`. `wrangler.toml` exists only for local
`npx wrangler pages dev .` — the deploy does not read it.

```
*.html              one page each — see "Editing a page" below
ca-api.js           browser-side API client — window.CAApi, classic script, not a module
support.js          GENERATED runtime — do not edit (rebuild: cd dc-runtime && bun run build)
doc-page.js         printable-document element, used only by order-sheet.html
functions/api/
  _*.js             NOT routes. Pages won't expose them; route handlers import them.
  <name>/index.js   a route: GET /api/<name>
  <name>/[id].js    a route: /api/<name>/:id
  _to_delete/       dead code, ignore
```

The underscore modules are where the logic lives; routes are mostly validation and response shape.
`_sf.js` (auth, `runQuery`, SOQL escaping), `_session.js` (capabilities), `_rework.js` (reprint
builder), `_pm-rollup.js` / `_print-date-rollup.js` / `_priority-rollup.js` (Order rollups),
`_placements.js` (print-location picklist), `_station.js` (station auth), `_worker-auth.js` (roles).

##### The boards

| Page | Who uses it | What it does |
|---|---|---|
| `index.html` | managers | Production kanban by `Order_Substatus__c`; run rows, timers, KPI strip |
| `pre-production.html` | managers | Pre-production board + Management inbox (orders with no method yet) |
| `calendar.html` | managers | Press schedule; drag to book a run |
| `station.html` | shop floor | Station tablet — garment count-in and step stations |
| `counting.html` | shop floor | Production results — the four-quantity counting screen |
| `shipping.html` | shipping | Post-Production → ship / complete, Zenkraft wizard |
| `stats.html` | managers | Trends and charts |
| `order-sheet.html` | shop floor | Printable order sheet |
| `login.html` | everyone | PIN gate |

##### One deployment, three orgs

**This is the single most important operational fact.** The active Salesforce org is a KV value
(`sf_env:active` in the `INVENTORY` namespace), switched at runtime from the UI by an admin. There
is one deployment and it can point at dev2, staging or production.

A code change therefore goes live for all three at once — **you cannot ship a fix "to staging
only."** Write code that degrades safely when a field does not exist in the active org. And the
env switch is global: it changes the org for every user and every tablet simultaneously.

`DEFAULT_ENV = "dev2"`. Production is deliberately unconfigured today (`SF_ENV_PRODUCTION_*` unset),
which is why the switcher shows "Not configured yet" — that is E7.5.

##### Auth model

Two layers, and only one of them is enforced today.

- **UI:** `POST /api/worker-login` verifies a personal PIN against the `WORKER_PINS` env var and
  returns `{name, role}`, written to `localStorage`. Roles come from `ADMIN_NAMES` / `MANAGER_NAMES`
  in `_worker-auth.js` — Anthony is admin; Gian and Parker are managers.
- **Server:** the same login issues a signed HttpOnly `ca_sess` cookie. `requireCap()` verifies it
  and looks capabilities up fresh per request.

`requireCap` is **report-only** unless `ACCESS_ENFORCE=1`. It logs what it would have denied and
lets the request through. Only 4 of ~20 mutating routes even call it (E6.5).

In-app PINs are **attribution, not authorization.** Cloudflare Access in front of the whole Pages
project and `/api/*` is meant to be the real perimeter, and nobody in this workstream has confirmed
it is switched on. That is E6.4 and it should be the first thing anyone does.

##### Editing a page

Pages are not React source. Each is an `<x-dc>` template plus a logic block:

- Markup uses `{{binding}}` holes, `<sc-if value="{{cond}}">`, `<sc-for list="{{arr}}" as="x">`.
- `<helmet>` children (fonts, `<style>`) are hoisted into `document.head`.
- `<script type="text/x-dc" data-dc-script>` defines `class Component extends DCLogic` with
  constructor state, `componentDidMount/DidUpdate/WillUnmount`, handlers, and `renderVals()`.

`renderVals()` returns **one flat object** — anything the markup references must come back from it.
There is no JSX. Bindings resolve through a small safe evaluator (dotted paths, indexing, simple
`==`/`===`), not `eval`. A whole-value attribute binding passes the raw value through, which is how
`onClick="{{ handler }}"` gets a real function. Render errors show as a red `.sc-logic-error`
overlay, not a blank page.

To load a library from a page, append a real `<script>` to `document.head` (see how `stats.html`
loads Chart.js) rather than putting it in `<helmet>`.

##### The Production Results model — do not redesign this by accident

`Production_Run_Line_Items__c` carries four quantities: `Planned_Qty__c`, `Incomplete_Qty__c`,
`Misprint_Qty__c`, `Damaged_Qty__c`.

**Only problems are recorded.** There is deliberately no "good" or "produced" or "complete" field —
what went right is whatever is left over. That makes a perfect run and an untouched run
byte-identical, so `Result_Status__c` (`Draft` → `Submitted`) is the only evidence a human counted.
Keep that invariant: submit stays enabled with every box empty, and a run with zero line items is
submittable on purpose.

**Incomplete is not a loss like the others.** Misprinted and damaged garments are spent and need new
blanks — that is a reprint. Incomplete garments are intact on a shelf and need press time on the
*same* method — that is a make-up run. Never merge them; never derive one from the other.

**The reprint automation is application code, not Salesforce metadata.** `createReworkIfNeeded` in
`_rework.js`, called from exactly two places: the method-status PATCH in `production-methods/[id].js`
and the submit in `run-results/index.js`. There is no reprint Flow or trigger — don't go looking for
one. Its four gates, in order: (1) no existing reprint for this order, (2) every run `Submitted`,
(3) every non-Cancelled method `Completed`, (4) some line carrying misprint or damaged > 0.
`GET /api/rework-check?orderNumber=…` re-runs every gate read-only and names the one that stopped it.

##### The allocation grid and the skeleton Flow

`Production_Run_Generate_Line_Item_Skeleton` (active in dev2 and staging) creates the line items on
run create, computing each size's planned quantity as *order size qty − what earlier runs on the
method already planned − `Incomplete_Qty__c`*.

The app **displays what the Flow produced**; it does not compute a second opinion. The manager can
then edit a size, which writes `Planned_Qty__c` back. Clearing a size **writes 0** — it never
deletes the row, because deleting a Flow-created row is the app reaching into another system's
output.

`Total_Planned_Qty__c` on `Production_Run__c` is a **roll-up summary (SUM of the line items)** —
confirmed live 2026-08-31, along with `Total_Incomplete/Misprint/Damaged_Qty__c`. The run's Total
Garments field is read-only in the UI and derived from the grid.

##### Salesforce automation you are sharing the org with

- **`ProductionAutoSchedulerService`** silently overwrites `Scheduled_Start__c` / `Scheduled_End__c`
  on any run that is not pinned, in fixed 9-hour blocks ordered by `Priority_Score__c`. It is a
  proof of concept by another author and it is the reason manual times used not to stick.
- **`ProductionEventPublisher`** publishes the shop calendar Event, keying off `Trigger.oldMap` —
  which is null on insert. So a run created already-Confirmed may publish no Event at all. Runs are
  therefore inserted `Planned` and then PATCHed to `Confirmed`. **Every write must end at
  `Confirmed`.**
- **`ProductionAutoSchedulerSelector`** was changed in dev2 on 2026-08-31 to treat `Planned` as
  pinned: excluded from `getSchedulableByPress`, included in `getConfirmedByPress`. Verified live —
  a typed 6:45–9:45 AM slot survived creation intact.
- **`OrderScheduling`** flow still contains `CreateCalendarEvent`, an older path that writes an
  Event at close time and bypasses the confirm gate (E7.8).

---

---

## 4. Where things stand
Blocking work first, then what is closed, then the remaining phases. **This is the section that tracks progress to deployment — keep the status marks honest and move items between the tables as they land.**
**Added 2026-09-01** from Anthony's test pass. These jump the queue ahead of Phase A. Each was
reproduced against live dev2 before being written down; the numbers below are measured, not
estimated. Owner column: **CC** = Claude Code (repo change), **SF** = this Salesforce/docs project
(live-org work, or a decision).

| Id | P | Owner | What |
|---|---|---|---|
| **B1** | ✅ DONE | CC | **Shipped and verified live 2026-09-02.** `adoptMockup()` in `_mockup-adopt.js`, called from `mockup-proxy`. Measured on the dev2 board before and after: **adopted (branch A, `068…`) went 0 → 39, blocked went 38 → 16**, and `ALLOWED_MOCKUP_HOSTS` is still in place for the paths that need it. The remaining 16 are orders nobody has opened yet plus any whose original link is now dead — the latter can never adopt and are the permanent floor. **Re-check the census in a few days: it should keep falling and must never rise.** Journey worth remembering: called a P0 defect, closed as not-a-defect on how the process was *documented* (D7), reopened when staging showed the same pasted links and zero Vault uploads in either sandbox, then fixed by adopting the data into the documented shape rather than widening an allowlist (D8). |
| **B2** | ✅ step 1 | CC (+SF) | **Step 1 DONE 2026-09-02**, branch `feat/b2-timer-persistence` (committed on `fix/b3-run-create-error`). ✅ **On `origin/main` and LIVE** — verified 2026-09-02 in the deployed `index.html`. localStorage keyed by method id; survives reload AND the 15s poll with the drawer closed (that second half was a live in-session bug, not just a reload one). Failed saves persist too, with their warning. Demo ids excluded. E2.4's ceiling verified against a rehydrated 14h timer — capped at 12h. **Step 2 still blocked on E2.3.** |
| **B3** | ✅ | SF + CC | **DONE 2026-09-02**, branch `feat/b3-results-by-order`. ✅ **On `origin/main` and LIVE** — verified 2026-09-02: the deployed `counting.html` carries the sibling make-up panel, and the deployed `index.html` surfaces the real run-create reason via `errText(e)` instead of the old fixed sentence. Grouped by order (no endpoint change — orderId/goaNumber were already in the payload); headers describe the whole ORDER not the filtered tab, so a two-method job reads "1 of 2 runs · Screen Print · Heat Press" instead of "1 run". Sibling panel shows the make-up quantity ("20 screen print garments still to be made up") and the sibling's misprint/damaged **for reference only** — verified all six inputs still render empty, D5 intact. The swallowed `catch(_)` on run creation was fixed separately and first. |
| **B4** | ✅ dev2 + staging | SF | **A second run on a method is created with NO line items, so there is nothing to count.** Verified live in dev2 2026-09-03 on order 00013503 (Walkthrough MPM), and the pattern holds across the org. The skeleton Flow allocates **per method**, so the first run takes the whole order quantity and every later run on that method gets zero rows. ✅ **DECIDED (D11): allocation becomes placement-aware.** ✅ **SHIPPED IN DEV2 2026-09-03** — new formula field `Run_Print_Location__c` plus one filter row in the Flow; both placements now get full rows. ✅ **Staging done and verified 2026-09-04** — the flow arrived as a DRAFT and needed activating by hand; production still has none of it (E7.4). The summed reprint is still unmeasured and same-placement second runs are still empty. Full detail below. |
| **B5** | ✅ | CC | **DONE 2026-09-03 and ON `origin/main`.** Submitting results that record incomplete garments now routes straight to booking the make-up run, instead of offering a button that can be ignored — D10's argument, one step later. `counting.html` +63/−4, `ca-api.js` +43/−1, `production-runs/index.js` +84/−2, plus `index.html`, `pre-production.html` and `calendar.html`. ⚠️ Shipped with a dead end that **B6b** then fixed. Full detail below. |
| **B6** | ✅ | CC | **DONE 2026-09-03 and ON `origin/main`.** A reprint is created with its method already mirrored, so the Management inbox — defined as Pre-Production orders with **no** method — excluded it by construction and its runs could not be scheduled. The inbox now also carries reprints that have a method but no runs. `inbox/index.js` +123/−2, `pre-production.html` +59/−6, `ca-api.js` +12/−1. Full detail below. |
| **B6b** | ⚠️ unpushed | CC | **DONE 2026-09-03**, branch `fix/b6b-postprod-new-run`, commit `ee19fc6`, `index.html` +21/−1. **A hole B5 opened and only showed up once something used it:** Post-Production collapsed the Production Runs section, so the status a make-up run is most likely to be booked from was the one status with no button to book it — and B5's deep link opened a drawer with no form in it. Full detail below. |
| **B7** | 🔵 P1 | CC (+SF) | **Setup / production time on the method cards** — Ready for Print shows the setup clock, In Production shows the production clock. The clocks are **per method, not per run**, so the run picker is not involved and the card needs no selection logic. **Stage 1 (no blocker):** show the stored figure, presented as *saved* rather than live. **Stage 2 (blocked on E2.3):** make it tick. Full detail below. |

> ⚠️ **THIS FILE EXISTS ONLY ON ANTHONY'S DISK, AND THAT HAS NOW COST REAL WORK TWICE IN ONE DAY.**
> `ROADMAP.md` and `CLAUDE-CODE-QUEUE.md` are tracked, but every committed copy — `origin/main` and
> every branch — is the older 74,316 / 51,546-byte version. Everything written since 2026-09-02
> lives as an **uncommitted working-tree change on top of `origin/main`**, so **cutting a branch from
> `origin/main` silently replaces these files with the stale committed copies.**
>
> On 2026-09-03 that happened twice. `ROADMAP.md` and `CLAUDE-CODE-QUEUE.md` were recovered from an
> incidental backup taken minutes earlier. **`VALIDATION-INTEGRATIONS.md` was not** — it went 13,570
> → 12,956 bytes, and 12,956 is what every branch and remote holds, so roughly 600 bytes of E8.1
> edited that afternoon is gone for good.
>
> 📌 **Until `docs/decisions-and-e13-groundwork` is merged, copy these files somewhere outside the
> repo before any branch switch.** That merge is in `CLAUDE-CODE-QUEUE.md` under "Still to do" and it
> stopped being housekeeping.

---

##### B1 · Mockup thumbnails blank on 38 of 54 orders

**Cause is known and it is not this week's changes.** `ALLOWED_MOCKUP_HOSTS` in
`functions/api/mockup-proxy/index.js` landed **2026-08-28** (commit `9caf322`) as part of E6.2's
SSRF fix. The endpoint answers `{"error":"blocked_host"}` — HTTP 400 — for any host not on it. The
E9.4/E10.2 token work is unrelated.

Measured live on dev2, 2026-09-01:

| | |
|---|---|
| Orders on the production board | 65 |
| Carrying a mockup URL | 54 |
| **Blocked by the allowlist** | **38 (70%)** |
| Passing | 16 (all `gstatic.com`) |
| Using the documented Salesforce Vault path | **0** |

Blocked hosts: `i.pinimg.com` (11), `freepngimg.com` (10), `artsdupage.org` (6),
`cdn-icons-png.flaticon.com` (5), `images.hometownapparel.com` (4), `images.emojiterra.com` (2).

**The real problem is not the list, it is the assumption underneath it.** The proxy has two
branches. Branch A fetches a Salesforce ContentVersion by Id — the documented Vault flow, always
safe, no allowlist needed. Branch B direct-fetches an external URL and is what the allowlist
guards. **Not one order in dev2 uses Branch A.** Every mockup in the org is a pasted external link,
so the allowlist is doing exactly what it was written to do and the feature still fails.

**Decide before coding — this is Anthony's call:**

1. **Widen the allowlist** per host. Fastest; the file's own header says adding a host is "a
   deliberate decision, not a shrug." Endless in practice: every new customer host is a new deploy.
2. **Fetch and cache at intake.** Pull the mockup once into R2 when the order lands and serve our
   own copy. The proxy stops reaching out at render time and the allowlist problem disappears.
3. **Enforce the Vault flow in Salesforce** so Branch A is used, which is what `Mockup_URL__c` is
   already documented to contain.

⚠️ **Check what staging and production actually hold before choosing.** The dev2 URLs are visibly
placeholders — emoji, Flaticon icons, a Pinterest pin, a stock calendar PNG. If real orders arrive
as Vault uploads, this is a dev2 data problem and option 3 is already true. If they arrive as
pasted vendor links, option 2 is the only one that scales. **The fix is different in each case, so
answer this first.** That check is SF work; the code change that follows is CC.

---

##### B2 · A running timer does not survive a refresh or a closed tab

This is **E2.1**, promoted to blocking. Confirmed in the code:

- `index.html:1065` — every `load()` rebuilds all timers as
  `{elapsed: <last saved>, running:false, startedAt:0}`. `load()` runs **every 15 seconds**.
- `startedAt` exists only in page memory. Nothing persists it.
- Elapsed time only reaches Salesforce on **Pause or Stop** (`pushMethodFields`, `index.html:1928`).
- `mergeServerTimers` protects local state **only** for a timer whose save is known to have failed.
  A healthy running timer gets no protection; it survives a poll only because polling is suppressed
  while the drawer is open.

So closing the tab discards everything since the last Pause or Stop. On a shared tablet that is
most of a shift — exactly the roadmap's original wording, now confirmed by Anthony hitting it.

**Fix in two steps. Step 1 ships today; do not wait for Salesforce.**

**Step 1 — `localStorage`, no org work, CC.** Persist `{running, startedAt, elapsed}` keyed by
method id; rehydrate on mount; teach `mergeServerTimers` not to clobber a locally-running timer.
Gets Anthony exactly what he asked for — the timer keeps running with the tab closed — on that
device. **Do E2.2 first**, or a failed write still vanishes silently and step 1 papers over it.

**Step 2 — `Timer_Started_At__c` / `Timer_Running__c` on `Production_Method__c`, needs E2.3, SF.**
Only this makes two tablets agree, and only this survives a worker switching devices.

📌 **E2.4 stops being optional once this lands.** Today a timer left running overnight dies with the
tab. After step 1 it runs until someone notices, and that duration poisons every efficiency number
built on it. Ship the auto-stop ceiling in the same batch.

---

##### B3 · Run Results is organized by method; it needs to be organized by order

**Today.** `GET /api/run-results` lists **runs** — `ORDER BY Scheduled_Start__c DESC` — with the
method and order joined on for display only (`functions/api/run-results/index.js:189`). There is no
grouping. A multi-method order appears as unrelated rows.

**The flow it should follow**, per Anthony:

1. Group the board **by order**, not by method.
2. On a sibling method, misprint and damaged appear **already populated from the order**.
3. **Incomplete stays per-method** and starts empty — it is press time on the *same* method.
4. A banner at the top of the card carries the outstanding make-up quantity from the other method
   ("20 screen print shirts to be made up"), so whoever counts the heat press can see it.

Points 3 and 4 match the documented model exactly — incomplete is not a loss, it is a make-up run
on the same method — so that half is presentation work, not a model change.

> 🛑 **Point 2 needs an explicit decision before anyone writes code, and it is the whole risk in
> this story.** "Populated" must mean **displayed for reference**, not **written again**. Misprint
> and damaged drive gate 4 of `createReworkIfNeeded` in `_rework.js`, and `TotalQtyMisprints__c` is
> already an **Order-level rollup repeated onto each sibling card**. If the heat-press submit writes
> the screen-print counts onto its own line items, the order double-counts, the reprint is built
> from inflated numbers, and D1's invariant — that `Result_Status__c` is the only evidence a human
> counted — is gone.
>
> ✅ **DECIDED 2026-09-01 (D5): reference-only.** The sibling method's misprint and damaged figures
> are **displayed, never written**. Nothing on a second method's submit may touch another method's
> line items. Build to this.

**The make-up run would not submit — and the error message is misleading by construction.**

`index.html:1661` is the whole failure path for creating a run:

```js
} catch(_) {
  this.setState({runCreateSubmitting:false,
    runCreateErr:'Could not create run — check press / schedule and try again'});
}
```

`catch(_)` — the error is **not even inspected**. Whatever Salesforce actually said (a restricted
picklist rejection, an FLS refusal, a validation rule, a failed publish) is discarded and replaced
with a sentence blaming the press and the schedule. That is the "Check Press" message Anthony saw,
and it appears for **every** cause of failure. This is precisely the anti-pattern E4.2 and E4.3 were
written to kill, still live on this one path.

🔧 **Fix this first, before diagnosing anything else** — one small CC change, and nothing else in
B3 can be diagnosed until the real reason is visible. Surface the endpoint's own error code the way
`jget`/`jdel` already do; `production-runs/index.js` returns `missing_printMethodId`,
`missing_pressId`, `bad_scheduledStart`, `bad_scheduledEnd`, `scheduledEnd_before_scheduledStart`,
`bad_quantity` and Salesforce's own errorCode, and each points somewhere different.

**Every org-side candidate has now been checked in dev2, and all three are CLEAR (2026-09-02).**
The insert writes PrintMethod, Press, Scheduled Start/End, `Quantity_Planned_c__c`,
`Auto_Scheduling_Status__c` and optionally `Print_Location__c`. Each was read directly from Setup:

| Checked | Result |
|---|---|
| `Auto_Scheduling_Status__c` is restricted, and does it hold `Planned`? | Restricted **yes**, and the value set is `Proposal`, `Confirmed`, `Unable to auto-schedule`, **`Planned`** — **present**. ✅ |
| Validation rules on `Production_Run__c` | **0 items.** Nothing can reject the insert. ✅ |
| `Print_Location__c` value set vs. the code's `PLACEMENTS` | **Exact match**, all 11: Front, Back, Left Sleeve, Right Sleeve, Left Chest, Right Chest, Full Front, Full Back, Tag, Hood, Pocket. `_placements.js` and `ca-api.js` agree with the org and each other — no drift, despite E7.3's warning that four independent copies invite it. ✅ |

**So dev2 is not rejecting the record.** That is a useful negative: the failure is either in the
request the browser assembles on the make-up path, or in the publish/PATCH step after the insert —
and **there is no way to tell which while `catch(_)` is discarding the reason.**

⛔ **This is now blocked on exactly one thing: surfacing the real error.** Do not spend more time
guessing at the org; it has been checked. Ship the error-surfacing change, reproduce once, read the
code, then fix the actual cause.

**"Nothing popped up" — the press picker is search-only, and it searches the wrong words.**
Verified live: `GET /api/presses` returns 5 records — `Embroidery Machine`, `Hat Press`, `Press 1`,
`Press 2`, `Shirt Press`. But the query is `Name LIKE '%term%'` against the Account **Name** alone,
so typing the *method type* — the natural thing to do — returns nothing:

| Typed | Results |
|---|---|
| `press` | 4 |
| `heat` | **0** (the heat press is named "Hat Press") |
| `screen` | **0** |
| *(empty)* | 5 — but the form never asks with an empty term |

There is no browsable list and no empty-state text, so a manager who types "heat" sees a dead box
and no indication that five presses exist. **CC:** show the full list on focus (the endpoint already
returns all 5 for an empty query), and say "no press matches" instead of rendering nothing.


**Split:** the model decision and reproducing the submit error are SF work here. The regrouped
endpoint, the banner and the counting screen are CC.

---

##### B4 · A second run on a method is created with no line items

**Reproduced and measured live in dev2, 2026-09-03.** Order **00013503** (Walkthrough MPM), one
Screen Print method **PM-00115** with `Placements__c` = `Back;Front`, three runs — all created by
Anthony that morning:

| Run | `Print_Location__c` | Created | Line items | `Total_Planned_Qty__c` | `Scheduled_Qty__c` |
|---|---|---|---|---|---|
| PR-0089 | **Front** | 9:01 AM | 5 rows × 200 | 1,000 | 1,000 |
| PR-0090 | **Back** | 9:02 AM | **0 rows** | **0** | 1,000 |
| PR-0092 | Front | 9:28 AM | 1 row (2XL × 200) | 200 | 200 |

PR-0090 is not rows-at-zero — it has **no rows at all** (`GET /api/run-results?runId=…` returns
`"lines":[]`), and the record carries a `Planned_Qty_Variance__c` of **−1,000**. It was submitted at
9:23 with nothing to record, which the D1 invariant permits by design; the invariant is not the
problem, the empty run is. PR-0092 is correct — it is the make-up run and it received exactly the
200 that PR-0089 recorded as incomplete, so **the Flow's give-back arithmetic works.**

**Cause, read out of the Flow itself** (`Production Run - Generate Line Item Skeleton`, V3, active
in dev2; `Line Item Skeleton` V1 sits alongside it, inactive):

1. `Get Rows Across This Method` gathers every existing line item **on the whole method**.
2. The `Each Order Product` loop sums those into "already planned" per order product, `Work Out
   Whats Left` subtracts, and `Build the Row` appends to `varRows` **only when something is left**.
3. `Print_Location__c` is never consulted. The Front run took all 1,000, so one minute later the
   Back run had nothing left for any size.

📌 **The Flow's own safety net cannot fire.** `Does This Run Cover The Remainder` has a default
branch — `Blank Each Quantity` → `Create Blank Rows` — that exists precisely to give a run rows when
it covers none of the remainder. That loop iterates **`varRows`**, which is empty in exactly that
case. Verified by opening the loop element: collection variable `varRows`. So the fallback creates
zero records and the run ends with nothing. **It is dead code in the only situation it was written
for** — the same shape of defect as E7.6's unreachable `ISBLANK` branch.

**Not a one-off.** Of the 12 most recently created runs in dev2, **7 have no line items**, and every
multi-run method follows the same pattern — one run holds the quantity, its siblings hold nothing:
00013486 (PR-0083 = 5, PR-0084 = 0), 00013501 (PR-0086 = 100, PR-0087 = 0), 00013503 as above.
⚠️ **The control case matters:** PR-0088 is a *second method* on 00013501 and received its full 100.
The boundary is the **method** — two methods on an order are fine, two runs on one method are not.

> ✅ **DECIDED 2026-09-03 (D11): allocation becomes placement-aware.** The scope key changes from
> *method* to *method + `Print_Location__c`*, so each placement is allocated the order's full size
> breakdown. Anthony's reasoning is physical: the Back pass really does put all 1,000 garments
> through the press, and a run that claims to plan zero of them is lying about the work. Claude
> raised that this makes a method's runs sum to 2,000 for a 1,000-garment order; Anthony accepted it.
> **The exposure was then checked and is small:** `Total_Planned_Qty__c` is per-run (a SUM of that
> run's own line items) and is the only planned figure the app reads — `Planned_Qty_Variance__c` and
> `Scheduled_Qty__c` are read by no endpoint, and `_rework.js` reads **only** `Damaged_Qty__c` and
> `Misprint_Qty__c`, so the reprint builder is untouched by planned quantities entirely.
> ⚠️ **Still to check before shipping:** any Salesforce report, formula or Apex that sums planned
> quantity across a method's runs. That is a Setup question and it has not been answered.

📌 **This is a bug fix with a gain attached.** Because the Back run has no rows today, a misprint on
the Back pass **cannot be recorded at all** — so on every multi-placement job the reprint has been
silently under-counting the blanks it needs. Placement-aware allocation is what makes those
misprints recordable.

**Two changes, both in the Flow, and both are needed:**

1. **Scope the allocation to method + placement.** `Get Rows Across This Method` must filter to rows
   whose run carries the same `Print_Location__c` as the triggering run. ⚠️ Treat **blank as its own
   bucket** — `Print_Location__c` is optional on create, and a null must not match every placement.
2. **Repair the blank-row fallback.** Build the blank rows from the order's products, not from
   `varRows`. This is the backstop for the case placement-awareness does *not* cover: two runs on the
   **same** placement — a manager splitting 1,000 across two press sessions — where the second still
   ends up with nothing left and therefore no rows. Rows at 0 are free (`Total_Planned_Qty__c` is a
   SUM, and 0 adds nothing) and they keep the Flow's own "does this run have any rows" guard
   satisfied so it will not regenerate over a manager's edits.

**Where it lands.** This is org metadata, not app code, so unlike a code change it *can* be fixed in
one org at a time — which is exactly the trap. dev2 and staging both run this Flow; production has no
flows at all and picks it up with **E7.4**. 📌 **E7.1 is the precedent for why staging must be done
and verified, not assumed.**

✅ **SHIPPED IN DEV2 2026-09-03.** Both halves of the org change are in and the second placement's
run now receives a full set of line items.

**The supporting field.** `Production_Run_Line_Items__c` has no placement of its own, and a Get
Records filter can only test the object's own fields — so the Flow could not scope by placement as
it stood. The line item already reaches its parent run exactly once, through `Method__c`, a text
formula reading `CASESAFEID(ProductionRun__r.PrintMethod__c)`. Its sibling now exists:
**`Run_Print_Location__c`**, a text formula on the same object.

⚠️ **It needs `TEXT()`, and the first attempt without it was rejected:** *"Field Print_Location__c is
a picklist field. Picklist fields are only supported in certain functions."* The working formula is

```
TEXT(ProductionRun__r.Print_Location__c)
```

📌 **`TEXT()` on a picklist returns the STORED value, not the label** — which is the right half of
trap 5 and is exactly what makes the filter work, because `{!$Record.Print_Location__c}` in Flow
also resolves to the stored value. The eleven placement labels and stored values happen to look
identical, so a future "tidy-up" that switches either side to a label would break this silently.
**Do not.**

**The Flow.** Saved as a new version (V3 left intact for rollback), one condition added to
`Get Rows Across This Method` — `Run_Print_Location__c` **Equals** `{!$Record.Print_Location__c}`,
with Condition Requirements still AND — then activated.

⚠️ **A permissions scare here was a false alarm, recorded so nobody re-chases it.** Creating the
field returned **Insufficient Privileges** when this project navigated straight to the
field-creation URL, which read as a lost `Customize Application` on the System Administrator
profile — a plausible story, since that profile had been edited the day after `Method__c` was
created. It was wrong: going through the Object Manager UI by hand worked first time. **The direct
URL was the problem, not the profile.**

⛔ **What is NOT verified, and must not be written up as if it were:**

- **The summed reprint.** The arithmetic is right by construction — `_rework.js` sums damaged +
  misprint per Order Product across every line item on the order — but nobody has yet run
  `GET /api/rework-check?orderNumber=…` on a Front+Back job and compared the figure to what was
  recorded. Until that is done, "6 on Front + 3 on Back gives 9 blanks" is a reading of the code,
  not a measurement.
- **A run with a blank `Print_Location__c`.** The formula returns blank for it and the filter then
  compares blank to blank. If blank runs merely share a bucket with each other that is fine; if a
  blank run matches **every** placement, the original defect is back for those runs. `Print_Location__c`
  is optional on create, so this is reachable.
- **Staging.** dev2 only. Staging runs this same Flow and needs **both** the field and the new
  version. 📌 **E7.1 is the precedent** — dev2 done, staging assumed, story half-finished for days.
  Production has no flows at all and picks this up with **E7.4**, where the field must travel too:
  a formula field that fails to deploy is a silent regression, not an error.

📌 **Still open, deliberately deferred:** two runs on the **same** placement — a manager splitting a
quantity across two press sessions — still produce an empty second run, because the blank-row
fallback described above remains dead. Placement-awareness does not touch that case.

✅ **STAGING DONE 2026-09-04, and INDEPENDENTLY VERIFIED** — not recorded on anyone's word. Change
set **"Placement-Aware Line Item Skeleton (B4)"**, two components:
`Production_Run_Line_Items__c.Run_Print_Location__c` and the
`Production Run - Generate Line Item Skeleton` flow. Confirmed by reading staging directly:
the line item object went **16 → 17 fields** with `Run_Print_Location__c` present as Formula (Text),
and Flow Trigger Explorer shows **V2 Active** on **both** the Created and the Updated trigger views.

🚩 **THE FLOW DEPLOYED AS A DRAFT, AND THE DEPLOYMENT STILL REPORTED SUCCESS.** Immediately after the
change set landed, `Run_Print_Location__c` was there and the flow was sitting at **V2 · Draft with V1
still Active** — so staging had the new field, a successful deployment, and *the old allocation logic
still running*. Nothing was wrong; change sets deploy flows inactive unless **Process Automation
Settings → "Deploy processes and flows as active"** is switched on. One click on **Activate** finished
it, and V1 remains as the rollback.

📌 **This is E7.4's warning arriving somewhere new.** That story already says a clean "Deployment
succeeded" is not evidence of FLS or of permission-set assignments. Add flows to that list: **a flow
in a change set is inactive on arrival, so the deploy that looks finished changes no behaviour at
all.** It will happen again on every flow that travels — including the production promotion. Check
the ACTIVE VERSION NUMBER after any change set carrying a flow, not the deployment status page.

⛔ **Still outstanding in staging:**

- **FLS on `Run_Print_Location__c`** — fields arrive with FLS off. The flow reads the formula in
  system context so the placement logic works regardless, which is exactly why this is easy to leave
  undone; grant it so anything else reading the field can see it.
- **The Front+Back proof against staging records.** dev2's was measured; staging's has not been. Same
  test: fresh method with both placements, one run each, both runs must receive a full set of line
  items with `Planned_Qty_Variance__c` at 0. **Check the records, not the board.**
- **The four staging-only fields.** `Actual_Good_Qty__c` and `Reprint_Qty_Needed__c` on the line item;
  `Quantity_Completed_c__c` and `Reprint_Quantity_c__c` on the run. Destructive changes do not travel
  in a change set, so these are hand deletions. 📌 **`Actual_Good_Qty__c` is the one to do first** —
  it is a "good quantity" field on the object whose entire model is *only problems are recorded*
  (D1), and the field D1 says must not exist.

📌 **Production still has none of this** and picks it up with **E7.4** — the field, the flow, and the
same two manual steps after.

**Verifying it.** On a fresh Front+Back method: create the Front run, confirm 5 rows; create the Back
run, confirm it also has 5 rows totalling the order quantity; record a misprint on each pass and
confirm `GET /api/rework-check?orderNumber=…` counts both. Then the same-placement case: two Front
runs, and confirm the second has rows rather than nothing. **Check the records, not the board.**

---

##### B5 · Submitting incomplete results must lead straight to scheduling the make-up run

**✅ DONE 2026-09-03, on `origin/main`.** Built as described below, with the destination left alone — the existing `index.html?card=<methodId>&makeup=<qty>` deep link, not `calendar.html`, which had been this destination until 2026-08-27 and was replaced for cause. ⚠️ **It shipped with a dead end:** on a Post-Production method the drawer it opened had no run form in it. See **B6b**.

**Anthony, 2026-09-03.** When a counter submits results that record incomplete garments, the app
should take them to the production calendar to book a make-up run on that method, rather than
leaving them on the counting screen to navigate there themselves.

**Why it is P0 and not a convenience.** Incomplete garments are intact stock sitting on a shelf
needing press time on the same method — they are the one thing coming out of the counting screen
that has no owner until a human schedules it. Misprints and damage are picked up automatically:
`createReworkIfNeeded` builds the reprint from gate 4. Incomplete has no automation behind it at all,
by design (never merge the two). So a make-up run that nobody books is simply lost.

**This is D10's argument again, one step later.** The same reasoning that sent a stopped timer
straight to `counting.html` applies here: counting was the step that got skipped, and scheduling the
make-up run is the next one. B3 already put the make-up quantity on screen ("20 screen print garments
still to be made up") — B5 is the step from seeing it to acting on it.

**Two things need answering before this is built:**

1. **Which surface** — `calendar.html`, or the New Run form on `index.html`? The calendar is what
   Anthony named, and it is the right place to see press availability; the New Run form is fewer
   steps and is where run creation already lives.
2. **Multi-method orders.** ⚠️ `calendar.html`'s `commitDrop` and `durationOf` read only
   `ProductionRuns[0]` and `ProductionMethods[0]`, so a make-up run for the *second* method of an
   order lands in code that assumes there is one. Front and back as two methods is exactly the case
   the roadmap already flags. Whichever surface is chosen must carry the **method id** through and be
   proven on a two-method order, not just a one-method one.

**Also in this story.** Only navigate when there is actually something to make up — incomplete > 0
on the submitted run. A submit with every box empty must still behave exactly as it does today, or
D1's invariant (submit stays enabled on an empty form) starts to feel like a trap.


---

##### B6 · A reprint never reaches the Management inbox, so its runs cannot be scheduled

**✅ DONE 2026-09-03, on `origin/main`.** `inbox/index.js` +123/−2, `pre-production.html` +59/−6,
`ca-api.js` +12/−1.

**What was wrong.** `createReworkIfNeeded` creates the reprint Order with `Misprint__c = true`,
`Original_Production_Order__c` set, and one `Production_Method__c` per affected method — type,
placements and vendor mirrored. The Management inbox is:

```sql
WHERE Status = 'Pre-Production'
AND Id NOT IN (SELECT Order__c FROM Production_Method__c)
```

— orders with **no** method. The reprint has one, so it was excluded by construction and landed on
the pre-production board, where there is no way to create a run. Observed on order 20489-3
("Pre-Walkthrough 2", 7 pcs), which sat on the Screen Print column carrying a REPRINT badge,
`0/2` prerequisites and NOT RECEIVED, with nothing that could move it forward.

📌 **Two things on that card that look wrong and are not.** NOT RECEIVED is deliberate —
`_rework.js` refuses to clone `Receiving_Status__c` because the reprint needs new blanks nobody has
ordered yet, and the comment above `CLONED_ORDER_FIELDS` says so. `0/2` is the Screen Print
prerequisite checklist (`Screens completed`, `Inks mixed`), which starts empty on any new order.
**Neither was changed.**

**What shipped.** A separate `fetchReprintsAwaitingRuns()` helper, kept deliberately OUT of the one
query the whole screen depends on, finds Pre-Production reprints and excludes those that already
have runs; the inbox card for a reprint skips method creation and goes to the run panel.

⚠️ **Trap 1 was handled by checking rather than assuming.** `Misprint__c` was not in the inbox
`FIELDS`. It is now selected **unconditionally** — but only after confirming the field is already
read elsewhere (`Order__r.Misprint__c`, and `pre-production.html`'s `isReprint`), rather than
routing it through `runQueryOptionalField` on a guess. The file's own comment records why the bar is
that high here: an FLS-hidden field is a **parse error returning zero rows**, which on this screen
reads as "no reprints to route today".

📌 **DELIBERATE — do not "fix" it:** a reprint now appears in **both** the Management inbox and the
pre-production board. It still needs blanks received and its prep ticked, which is the board's job,
while scheduling is the inbox's. It drops out of the inbox on its own once a run exists.

📌 **Considered and not taken.** Two alternatives were on the table. Carrying the original method's
prerequisite ticks forward onto the reprint was rejected for now — it depends on whether the shop
reclaims screens between jobs, and if it does, `Screens completed` would start as a lie. Not
creating the method on the reprint at all was rejected outright: that is precisely what `_rework.js`
was written to eliminate, per its own header — the old path *"created only an Order + OrderItems,
with no Production Method, so every reprint then had to be routed through Create Production Method
by hand."*

⛔ **Still open:** the reprint continues to show `0/2` with screens that physically exist, so the
prep ticks get done by hand on every reprint. If that becomes annoying, carrying them forward is a
small change to `_rework.js` — and it needs the screens question answered first.

---

##### B6b · Post-Production had no way to book the make-up run B5 sends people to

**✅ DONE 2026-09-03**, branch `fix/b6b-postprod-new-run`, commit `ee19fc6`, `index.html` +21/−1.
⚠️ **Unpushed.**

**This is a hole B5 opened, and it only surfaced once something used the link.** The drawer's
collapse used to end *after* Production Runs, which was right while Post-Production meant "the
printing is finished, permanently". B5 and B6 changed that: a method in Post-Production can
legitimately need another run — a make-up run for garments that never reached the press — and
`stopTimer()` puts a method **there** the moment its last run ends.

So the one status a make-up run is most likely to be booked from was the one status with no button
to book it, and **B5's deep link (`index.html?card=…&makeup=…`) opened a drawer with no form in
it.** Only the runs section comes back out of the collapse; specifications and the checklist stay
collapsed.

📌 **Worth remembering as a pattern, not just a fix.** B5 shipped, was verified, and still had a
dead end in it — because the verification exercised the navigation and not the thing it navigated
to. The lesson is the roadmap's existing one in a new place: **follow the link to where it lands.**


---

##### B7 · Setup and production time on the method cards

**Asked for by Anthony, 2026-09-03.** A method card on the production board and the pre-production
board should show the relevant timer's figure: **Ready for Print → the setup clock, In Production →
the production clock**, so a manager can see at a glance how long a job has been sitting in setup or
on the press without opening the drawer.

📌 **The clocks are per METHOD, not per run, and that removes most of the apparent complexity.**
`index.html` says it plainly:

> the elapsed seconds themselves are per-METHOD, not per-run (`Print_Setup_Timer__c` /
> `Production_Timer__c` on `Production_Method__c`), so switching runs does not switch clocks — it
> re-points which run's actual start/end the next Start/Stop will stamp.

So the run picker (`selectedRunId` / `selectRun`) changes which run gets stamped, **not which number
is counting**. There is exactly one setup figure and one production figure per method, and the card
needs no selection logic at all. **E2.6's derived "which cycle am I on" pointer is not involved** —
an earlier draft of this story said it was, and that was wrong.

**Build it in two stages, and do not let the first one impersonate the second.**

**Stage 1 — no blocker, CC.** Put the method's stored `Print_Setup_Timer__c` / `Production_Timer__c`
on the card, chosen by status, **presented as the last saved figure** rather than as a live one.
Small change to `index.html` and `pre-production.html`; both figures are already on the client (E2.5
established they come back in `production-orders`' SELECT, so this adds no FLS risk and no new SOQL).

⚠️ **Stage 1 must say *saved*, not imply live.** The server holds elapsed seconds as of the last
Pause or Stop and nothing about whether a clock is running now — that lives on the tablet. A card
reading `Setup 00:42:15` that has not moved in an hour is the same class of defect as a demo-data
board: plausible, wrong, and acted on. It has to read as a stored figure or carry the time it was
saved.

**Stage 2 — ticking, blocked on E2.3.** Once `Timer_Started_At__c` and `Timer_Running__c` exist on
`Production_Method__c`, the card computes `now − startedAt` and knows whether to tick. **No
redesign** — the display from stage 1 stays and gains a second hand.

✅ **The 12-hour cap is not a concern here (Anthony, 2026-09-03).** E2.4 stops a runaway timer and
records the capped value; real runs never approach it, so the card shows the same figure either way.

📌 **E2.3 now carries three things, not one**, which is the argument for treating it as more than a
P1: **B2 step 2** (two tablets agreeing on one method), **B7 stage 2** (this), and **E2.4's
trustworthiness flag** — the roadmap already notes there is no Salesforce field for "this number is
not trustworthy" and that adding one belongs with E2.3. One org change, three payoffs.

---


##### Closed. Do not re-open, do not re-audit.

Week 1 — **E6.1** SOQL injection in production-methods · **E5.1** method edit / order stage ·
**E5.2** 'Local Dropoff' picklist · **E5.3** cancelled calendar drag · **E5.4** demo fixtures in
live mode · **E5.5** garment-station missing-items note · **E4.7** order sheet sample data ·
**E6.2** mockup-proxy open proxy · **E6.3** cleartext manager PIN.

Week 2 — **E4.1** recovery from demo mode · **E4.2** real error reasons out of `jget`/`jdel` ·
**E4.3** no phantom saves · **E4.4** unpkg single point of failure (React is self-hosted now) ·
**E10.1** shared run-row module.

Line items — **E1.1** data model · **E1.2** endpoints · **E1.3** allocation grid.
KPIs — **E5.9** hardcoded KPI tiles.

**Weeks 3–4, closed 2026-09-03 — landed on `origin/main`.** Verified by the branch audit of
2026-09-02 (added lines checked against `main`'s copy of each file, not by assuming a branch was
merged), with `E1.4` and `E2.4` re-confirmed directly against `origin/main` on 2026-09-03:

- **Timers** — **E2.2** failed timer writes never swallowed · **E2.4** 12-hour runaway ceiling ·
  **E2.5** Actual vs Scheduled panel.
- **Boards not lying** — **E4.5** loading / empty / error states · **E4.6** unresolved bindings
  (the real bug was `<table>` foster-parenting the order sheet's size grid) · **E10.2** design
  tokens · **E9.4** contrast ramp.
- **Correctness** — **E5.6** Ship Now race · **E5.7** shop timezone · **E5.11** clearing a
  scheduled time · **E5.12** unbounded IN lists · **E5.13** stale doc comments · **E6.7** `text()`
  sanitising.
- **Access** — **E6.4** Cloudflare Access, proven from a bypassed IP *and* from outside ·
  **E6.6** station tokens deleted · **E6.8** roster and revocation from config.
- **Line items and pre-production** — **E1.4** timer stop routes to counting · **E1.5** line-item
  detail on the sheet and the calendar · **E3.1** Begin Set-up inventory · **E3.2** prefill ·
  **E3.3** method suggestion · **E3.4** nested OrderItems.
- **Org and tooling** — **E7.6** `Print_End_Date_Time__c` formula plus the app-side floor ·
  **E8.5** pre-deploy smoke script.

📌 **The detailed entries stay in Part 3** — they carry the reasoning, the measurements and the
caveats, and several record a bug that has already been fixed twice. Closed means *do not re-open*,
not *delete the write-up*.

⚠️ **Four ✅ stories are deliberately NOT in this list, and must not be added without a fresh check:**

- **E5.8** — marked done, **but `functions/api/_priority-rollup.js` is still on `origin/main` at its
  full 130 lines.** The deletion never landed. Read directly on 2026-09-03.
- **E4.8** and **E6.5** — unverified. Reads of `stats.html` and `run-results/index.js` from
  `origin/main` came back empty on 2026-09-03, which was the folder erroring rather than the code
  being absent, and a failed read is not evidence. Re-check both.
- **E5.10** — landed, but its own entry says the Salesforce-touching paths are untested and need a
  real split and combine on staging. Code done, validation not.

📌 **Still to confirm alongside E6.5:** the `orders.receive` gate on
`functions/api/update-order-receiving/index.js`. The 2026-09-02 audit found it missing from `main`
and recorded the fix as an **uncommitted working-tree change**. If that was never committed, a
mutating route is ungated on the day `ACCESS_ENFORCE=1` goes on.

**Three of those shipped against a different design than the Asana text**, and the difference
matters:

- **E1.1** — the object is `Production_Run_Line_Items__c` (plural), fields are `Planned_Qty__c` /
  `Incomplete_Qty__c` / `Misprint_Qty__c` / `Damaged_Qty__c`. There is no `Quantity_Produced`,
  by decision D1.
- **E1.2** — endpoints are `/api/run-results` (GET list, GET one, POST submit) and
  `/api/run-line-items`, not `/api/production-run-items`. There is no DELETE — cleared rows go to
  zero.
- **E5.9** — On-Time % was **removed, not fixed.** It needs a real delivered-vs-promised comparison
  and there is no completion or ship date on Order. Overdue took its slot. Bringing On-Time back
  needs that field first, and must not be reconstructed from `LastModifiedDate`.

##### Four things from the closed work that are still load-bearing

1. **`confirmManager()` returns a Promise.** Every call site must `await` it — `!somePromise` is
   always false, so an un-awaited guard silently confirms nothing while looking healthy. All 11
   sites are converted. If you add one, grep the identifier and check it.
2. **Presence of the `missing` key is the only gate** on `Partial_Check_in_Missing_Items__c`. Status
   decides nothing and **nothing auto-clears the note**. `missingAtStage` in `_station.js` is a UI
   hint only. Do not "restore" the status-based clear without asking — it is a product decision.
3. **SOQL escaping is now one definition** — `soqlEscape` / `soqlQuote` / `soqlQuoteList` in
   `_sf.js`, imported by all seven former copies. Order matters and is written down: backslash
   first, then apostrophe.
4. **`CAApi.shouldPoll(connection, key)`** is the single gate on every board's auto-refresh. A demo
   board retries every 5th tick instead of never.

##### Verified live in dev2 on 2026-08-31

- E1.3 allocation grid on PR-0083 — pre-fill matched the Flow, editing a size updated the existing
  row, `Total_Planned_Qty__c` followed, clearing wrote 0.
- E5.5 missing-items note on order 20484-9 — survived taps through all four statuses. This also
  settles **write-side FLS** on `Partial_Check_in_Missing_Items__c` and confirms the endpoint's
  `MISSING_MAX = 255` matches the real `Text Area(255)`.
- `ProductionAutoSchedulerSelector` change on PR-0085 — typed time preserved, run ended `Confirmed`.
- **E7.1 in dev2 only.** `Production_Calendar_Setting__c` had *zero records*; an org-level record was
  created with `Calendar_Owner_Id__c = 005ca00000BhcA9AAJ` (Anthony Martinez).

##### Two known-stale documents in the repo

- **`SELECTOR-CHANGE.md`** — ✅ **rewritten 2026-09-01 (E5.13).** The Apex instructions were always
  correct and are untouched; dev2 has them, **staging and production still do not.** What was wrong
  was everything around them: the rationale sold a "lay out a week privately, publish when settled"
  workflow that the 2026-08-21 removal of Confirm/Unconfirm deleted, and the verification's steps 2
  and 3 pressed buttons that no longer exist. Now: `Planned` is documented as the few-hundred-
  millisecond window between insert and PATCH, the selector change is explained as what stops the
  trigger clobbering typed times *during that window*, and the three verification steps can all be
  performed on the shipped app.
- **`culture-apparel-handoff.md`** (517 lines) is the same generation as three analysis docs deleted
  on 2026-08-31 and is probably as stale. Verify before trusting.

##### Open findings that are not yet stories

- **`Planned_Qty_Variance__c` goes non-zero when a manager edits an allocation.** On PR-0083,
  `Scheduled_Qty__c` stayed 5 while `Total_Planned_Qty__c` went to 3, leaving the variance at −2.
  The two numbers are allowed to disagree by design, but nothing on the board explains it, so a
  manager seeing −2 cannot tell a real shortfall from an edited allocation. Decide whether to
  surface it, reconcile it, or hide it.
- **`Quantity_Planned_c__c` vs `Total_Planned_Qty__c`.** Two totals on a run that can drift — the
  writable one typed by a manager, the derived one summed from line items. The UI now shows only the
  derived one, but the writable field is still there and still written on create.

---


50 open stories, same Asana ids. Sequenced into phases by what blocks what, not by the original
week numbers.

##### Phase A — Perimeter and org readiness *(do first, mostly not code)*

| Id | P | Owner | What |
|---|---|---|---|
| **E6.4** | ✅ CLOSED | Ops / Anthony | **DONE and PROVEN 2026-09-02.** A self-hosted Access application now fronts `culture-apparel-preprod.pages.dev` with an empty path, so it covers `/api/*` as well. Two policies, in order: **Bypass** on the shop's public IP `74.51.3.3`, then **Allow** on the manager email list. That shape was chosen deliberately — the app already identifies people via `WORKER_PINS`, so Access's job is to keep the open internet out, not to re-identify workers at a shared tablet. **Verified both ways, which is what this story actually asked for:** from the bypassed IP every board and endpoint loads normally (`/`, `/api/admin/sf-env`, `/api/production-orders` 66 rec, `counting.html`, `station.html` — the shop floor is untouched); from a phone with Wi-Fi off the site demands an email and a one-time code. ⚠️ **First attempt looked configured and protected nothing** — the application name had been typed into the *Subdomain* field, so Access guarded `culture-apparel-production-dashboard.culture-apparel-preprod.pages.dev`, a hostname that does not exist, while an external unauthenticated fetch still returned all 66 live orders. The Applications list looked entirely healthy. **That is why this story says *prove a request from outside the policy is blocked* rather than *confirm Access is enabled*** — keep the wording. 📌 **The Allow policy is the failsafe:** if the shop IP ever changes, the floor sees a login rather than a lockout and a manager can still get in to fix it. Never make this Bypass-only. |
| **E7.1** | P0 | Salesforce | **Half done.** dev2 is set. Staging still needs `Production_Calendar_Setting__c.Calendar_Owner_Id__c = 005ca00000BhcA9AAJ` — and note the object may have zero records there too, in which case create one. Then confirm a run publishes an Event on that calendar. |
| **E7.2** | P0 | Peter Larson | Apex test classes to clear the 75% gate. `ProductionEventPublisherTest` is written but has never run in an org; `OrderPrintDateRollup` has no test at all. Sandboxes do not enforce the gate — production will refuse the deployment. **This is the long pole on the whole project.** Start it now, in parallel with everything else. |
| **E2.3** | P1 → **treat as P0** | Salesforce | 📌 **Three things now wait on this: B2 step 2, B7 stage 2, and E2.4's trustworthiness flag.** Timer fields (`Print_Setup_Timer__c`, `Production_Timer__c`, plus whatever E2.1 adds) exist with FLS in all three orgs and are in the permission set. |

##### Phase B — Stop the app lying about writes *(the rest of week 2's theme)*

| Id | P | What |
|---|---|---|
| **E2.1** | P0 | A running timer must survive a reload. Today `startedAt` lives only in page state; a sleep, reload or demo flip loses everything since the last stop — on a shared tablet that is most of a shift. Needs a `Timer_Started_At__c` / `Timer_Running__c` on `Production_Method__c` (which is why E2.3 is Phase A). Two tablets on the same method must agree. |
| **E2.2** | ✅ | **DONE 2026-09-01**, branch `fix/e2.2-timer-write-failures`, unpushed. **The story as written was already done** — E4.3 had replaced the `.catch(()=>{})` with `canWriteNow`/`writeFailed`, so a failed timer write already raised a toast. What remained is what the story was *for*: a toast is enough for a checklist tick (re-tick it) and not for a timer, because **nobody can retype how long a job took**, and once the toast fades a tile reading 47:13 that never saved looks identical to one that did. Worse, `load()` polls every 15s and `Object.assign({},st.timers,serverTimers)` let the stale server value overwrite the unsaved local one, destroying the only copy. Now: `pushMethodFields` returns its outcome, a failed *or blocked* write sets a standing per-timer flag, the tile carries a red "Not saved to Salesforce — this time is only on this tablet" strip until a later write succeeds, and `mergeServerTimers()` stops the poll eating the unsaved seconds. Verified in a browser (demo mode blocks writes, so the path is reachable without an org) plus 11 unit tests. |
| **E4.5** | ✅ | **DONE 2026-09-01**, branch `fix/e4.5-board-states`, unpushed. Every board computed its empty state as `count === 0` and nothing else, so the **first paint of every board asserted the shop was empty** — in the same words it uses when that is true. `shipping.html` said "the shop floor is caught up" while still fetching; `calendar.html` said "everything is placed", "every counted run is accounted for", "everything has runway"; `stats.html` opened with twelve confident zeros; `counting.html` said "every printed run is accounted for". New shared `listState()` / `listNotice()` in `ca-api.js`; all seven boards now show **Loading… / a real reason on demo / a genuinely-empty message that says what would put something here**. Verified in a browser behind a deliberately slow API: at 3.2s all seven show "Connecting…", six show "Loading…", and **zero false claims**; after the API returns empty each shows its own explanatory copy. The centre overlay was already opt-in (nav + login + env switch only, per its 2026-08-20 second pass), so that half needed no work. |
| **E4.6** | ✅ | **DONE 2026-09-01**, branch `fix/e4.6-unresolved-bindings`, unpushed. **The premise was wrong in both halves, and the real bug was worse.** (1) Nothing depends on the boot-time `fetch(location.href)` — it is gated on `if (!window.__resources)` and **E4.4 set `window.__resources` on all nine pages**, so it has not run since 2026-08-31. (2) `<select>` is unaffected: measured, all 39 `<sc-for>` inside `<select>` survive the parse intact. The actual bug is `<table>`: the parser foster-parents custom elements out, the runtime adopts the mangled DOM, and **`order-sheet.html`'s size grid has been printing with no size columns and no per-size quantities** — just "Qty" and a grand total — on the sheet that tells the press how many of each size to run. Reproduced in a browser, fixed by converting that grid to `display:table` divs, re-verified rendering S/M/L/XL/2XL = 12/40/55/28/9/144. Guarded by `tools/check-dc-templates.mjs`, which fails on the pre-fix file and passes after. |
| **E4.8** | ✅ | **DONE 2026-09-01**, unpushed. Worse than written: because `login.html`'s `componentDidMount` (:125) auto-admits whenever a role + valid name are already in localStorage — setting `screen:'done'` and never showing the PIN pad — Switch Account on `stats.html` was a **complete no-op**. It handed the tapper straight back the previous person's session, unasked for a PIN, on a screen that looked like a successful switch. Now calls `clearIdentity()` first. Verified in a browser: before, `login.html` showed "Welcome, Gian / MANAGER"; after, all three localStorage keys are null, `POST /api/worker-logout` returns 200, and `login.html` shows "Enter your PIN to continue". Swept all nine pages — `stats.html` was the only one broken; `calendar.html` was a false alarm, it binds `onSwitchUser` and clears correctly at :1141. |

##### Phase C — Correctness defects

| Id | P | What |
|---|---|---|
| **E5.6** | ✅ | **DONE 2026-09-01**, branch `fix/e5.6-shipnow-race`, unpushed. **Reproduced before fixing:** on the `origin/main` build, opening an order that already has shipments and tapping Ship Now within ~300ms PATCHed `Shipping_Label_Printed__c: true` to Salesforce with the wizard opened to a blank page and never touched. `openOrder()` fires `loadShipments()` without awaiting it, so `(this.state.shipments[id]||[]).length` is **0** while that fetch is in flight; the first 6s poll tick then sees the order's *existing* shipments as new. It only bites on re-ships, second boxes and splits — orders that already have shipments. Now the baseline is fetched fresh, in parallel with the wizard URL so the tab still opens promptly, and the poll only starts when the count is actually **known**. `loadShipments` returns `null` rather than `[]` on failure — "could not tell" is not "zero" — and all three consumers guard it. Verified three ways: old build writes, fixed build with nothing printed does not write, fixed build with a genuinely new shipment still auto-marks. |
| **E5.7** | ✅ | **DONE 2026-09-01**, branch `fix/e5.7-shop-timezone`, unpushed. `SHOP` gains `timeZone: "America/Chicago"`; all `setHours`/`getDay` replaced with `Intl`-based `shopInstant()` / `shopDate()` / `shopParts()`. Runtime UTC confirmed by measurement (`getTimezoneOffset()` 0, `resolvedOptions().timeZone` "UTC" in workerd), and `Intl` with an IANA zone verified working there including DST. **Scope note: `daysUntil()` had the same defect and is also fixed** — it floored both ends onto UTC days, so from 7pm Chicago onward every print date read one day closer, which feeds `urgency()` and therefore the score. **That is a behaviour change: evening scores and suggested days will shift.** Proven runtime-independent — old code gave 4 different answers under 4 runtime timezones (and the *correct* one only on a Central-time laptop, which is why it survived); new code is identical under all 4 and matches inside real workerd. 22 tests. |
| **E5.8** | ✅ | **DONE 2026-09-02**, branch `chore/e5.8-delete-priority-rollup`, unpushed. **Deleted, per Anthony (D9).** `_priority-rollup.js` was 130 lines with **zero importers** — both exported functions never called, `Production_Priority__c` written by nothing and read by nothing. **Two things in the story and the file were wrong:** the story said to "remove the field from every sort" — nothing sorted by it, there was no sort to remove; and the file's own headline justification claimed that with the score on the method "all four stations sort by priority", when every station query sorts by `Print_Date__c` and always had. The app computes priority live via `scoreOrder()` on every calendar request, so nothing on any screen changed. The Salesforce field itself is untouched — deleting code does not delete a field. Comments in `_priority.js` and `calendar/index.js` now record why it went and on what condition it could come back. |
| **E5.10** | ✅ | **DONE 2026-09-01**, branch `fix/s1-shipment-route-extensions`, unpushed. Three endpoints were unguarded, not four — `run-results` and `run-line-items` already chunk at 25, and `_rework.js` already had head/tail + rollback. Fixed `shipments/split.js`, `shipments/combine.js` and `production-methods/index.js` onto a new shared `_composite.js`. **Split was the worse bug and is not in the original note:** it emits 1 leg + N items + 1 shipment (+1 package) *per box*, so a 20-line order in two boxes already hits 26 — an ordinary order, not a large one. Combine's real ceiling moved from 12 orders to 25. Error reporting needed no work: all five copies already preferred the non-`PROCESSING_HALTED` failure. 16 unit tests on the chunker pass; **the Salesforce-touching paths are untested** (no org credentials locally) and need a real split and combine on staging. |
| **E5.11** | ✅ | **DONE 2026-09-01**, branch `fix/e5.11-clear-scheduled-time`, unpushed. `""` / `null` now writes null, matching `actualStart` — **but the server was only half the bug.** The run-row drawers hard-required both halves, so blanking the schedule failed client-side with "Set the scheduled start date & time" and never sent a request; fixing the API alone would have changed nothing a manager could see. `index.html` and `pre-production.html` `saveRunRow` now accept a fully blank window. Create paths (`submitRunCreate`, and `calendar.html`'s combined create/edit form) deliberately still require it — `production-runs/index.js` rejects a create with no schedule. Clearing is **pair-only**: a half-clear returns `scheduled_window_must_clear_together`, because a run with an end and no start reads as "Not scheduled yet" everywhere and would be invisible and stuck. **Decision (Anthony, 2026-09-01): a clear still lands on `Confirmed`**, so nothing re-books a slot a manager just cleared — the cost is that the run still reads as "On the shop calendar" with no time, and `ProductionEventPublisher` gets an Event with null start/end. **That Apex behaviour is UNVERIFIED** and must be checked under E8.3 before production. |
| **E6.7** | ✅ | **DONE 2026-09-01**, branch `fix/e6.7-text-sanitise`, unpushed. **The vulnerability was reproduced before it was fixed** — the payload's `onerror` executed against the real function in Chrome, from a detached element, exactly as the story said. Now parses with `DOMParser` into an inert document. Trap 6 was the risk: `text()` processes every formula field on every board, so the replacement had to return byte-identical strings. Verified across 14 input shapes — both `HYPERLINK()` formulas, nested tags, entities, `<br>`, multi-paragraph rich text, numbers, null, whitespace collapsing — **all identical, zero mismatches**, then re-confirmed against the shipped `CAApi.text()` rather than a copy. Swept the other two `innerHTML` sites in `ca-api.js`: both take literal icon names and static copy, no Salesforce data. |

##### Phase D — Access control, for real

| Id | P | What |
|---|---|---|
| **E6.5** | ✅ | **DONE 2026-09-01**, branch `feat/e6.5-gate-mutating-routes`, unpushed. **21 of 24** files with a mutating handler now call `requireCap`, up from 4. The three left open are `worker-login`, `worker-logout` and `station-login` — requiring a session to create one is circular. **The blocker was never the wiring, it was that workers had no capabilities at all:** `capsFor()` returned `[]` for anyone not admin or manager, so flipping the flag would have locked every worker out of count-in, item sub-status, inventory and the counting screen. The roadmap flagged `results.submit`; it was the entire shop-floor surface. New `DEFAULT_WORKER_CAPS` grants exactly four endpoints and nothing else. Verified end-to-end with `ACCESS_ENFORCE=1`: worker reaches every station endpoint (400s from their own validation), is **403** on the manager surface, manager works everywhere, anonymous **403** everywhere. Report-only confirmed to change nothing today. ⚠️ Still run five days of `[access] would deny` before enforcing — that log, not this list, is what proves the worker set is right. |
| **E6.6** | ✅ | **DONE 2026-09-01**, branch `feat/e6.6-remove-station-tokens`, unpushed. **Deleted, per Anthony's decision.** The whole per-station auth system — HMAC signing, verify, 12h cookie, station PINs, `/api/station-login` — was complete, correct, and had never been plugged in: `verifyStationToken()` had zero callers, no page called `CAApi.stationLogin()`, no endpoint checked anything. It read like protection, which is worse than nothing because people trust it. **`STATION_CONFIG` stays** — six live endpoints import it, and the file was two unrelated things sharing a name. **`safeEqual()` stays too**, and that mattered: `admin/sf-env.js` imports it to compare `SF_ENV_SWITCH_PIN`, which is a *real* gate today (unlike `requireCap`, still report-only), so removing it would have weakened the env switcher. What protects these endpoints instead: personal PINs plus E6.5's `requireCap` (`items.status`, `orders.receive`, `inventory.edit`). Verified with `ACCESS_ENFORCE=1` that a worker still reaches every station write, and that `/api/station-login` is gone. −129 lines. |
| **E6.8** | ✅ | **DONE 2026-09-02**, branch `feat/e6.8-roster-from-config` (stacked on E6.6), unpushed. All three claims were real and the middle one was worse than written. **(1) Roles from config:** an entry may now carry `"role"` (`{"Parker":{"pin":"3391","role":"admin"}}`); `ADMIN_NAMES`/`MANAGER_NAMES` remain the fallback. `rosterRole()` is shared with `capsFor` so a role change moves the UI *and* the API together — deriving them separately would have meant promoted-in-the-buttons, refused-by-every-endpoint. An unrecognised role string logs and falls back; it never grants. **(2) Revocation:** `capsFor` fell back to role-derived defaults for a name it could not find, so removing someone from `WORKER_PINS` changed *nothing* until their cookie expired — and a removed manager kept manager caps, because the fallback read the hardcoded arrays rather than the secret. Absence from a roster that parsed is now `[]`. Gated on the JSON having actually parsed, so a stray comma can't read as "everyone revoked". Also closed a prototype leak: `capsFor(env, 'constructor')` used to return worker caps. **(3) Shared PIN:** last-match-wins is now a refusal (`pin_ambiguous`, 500, no cookie). Measured before/after: with Titus and Parker sharing a PIN, Titus typing it signed in **as Parker, role manager, with a manager session cookie**. ⚠️ Revocation only *blocks* once `ACCESS_ENFORCE=1`; today it still correctly blocks new logins. **Decided, not built** (Anthony, 2026-09-02): `confirmManager()` leaves the tablet's server session as the manager for 12h. Accepted — the manager logs out when they walk away, and `worker-logout` does clear the cookie. Recorded in `ca-api.js` above `confirmManager()`, including the one caveat if it is ever revisited: nothing on screen says the session changed, so the habit it relies on has no cue in the UI. |

> ⚠️ **Before anyone sets `ACCESS_ENFORCE=1`:** the counting screen's submit gates on
> `results.submit`, which appears in exactly one place in the codebase — the check itself. It is
> not in `DEFAULT_MANAGER_CAPS` and workers derive no capabilities, so enforcement would leave only
> Anthony able to record production results. **Grant it first.**
>
> Also unresolved: `confirmManager()` confirms via `POST /api/worker-login`, which *also* issues the
> signed `ca_sess` cookie — so a successful manager confirmation leaves that tablet's server session
> as that manager. Inert while `requireCap` is report-only. Needs an answer before enforcement.

##### Phase E — Closing the production loop

| Id | P | What |
|---|---|---|
| **E1.4** | ✅ | **DONE 2026-09-02**, branch `feat/e1.4-stop-to-counting`, unpushed. **Rewritten, not cancelled (D10).** The story as written was dead — D1 removed the produced field on purpose. Rebuilt as: stopping the PRODUCTION timer on a run takes the operator straight to `counting.html?runId=<that run>`. **The gap was worse than the story said:** the board's one Run Results link is gated on `isPP`, and a multi-run method goes BACK to Ready for Print after each stop — so between runs there was no path to counting at all, and gate 2 of `createReworkIfNeeded` needs every run Submitted, so one uncounted run silently blocks the reprint for the whole order. I argued for a prompt over a jump (it interrupts the changeover on multi-run jobs); **Anthony chose the jump** — counting is the step that gets skipped and a button can be ignored. Navigation now waits for all three writes (seconds, actual end, status), which needed `pushMethod`/`stampRunActual` to stop being fire-and-forget; on a write slower than the 6s cap the seconds are written into B2's localStorage store **synchronously** before leaving. Verified both paths. |
| **E2.4** | ✅ | **DONE 2026-09-01**, branch `feat/e2.4-timer-guardrails`, unpushed. `TIMER_MAX_HOURS = 12` (a deploy-time constant, like `WEIGHTS`); past it a timer stops itself, records the **capped** value rather than the runaway one, and says so on the tile. **Deliberately not `stopTimer()`** — stop means "this run is finished" and stamps the run's Actual End, releases the run pick and advances the method to Post-Production. None of that is true when a tile was simply left counting, and moving a job on the board because a timer expired overnight would be a worse bug than the one being fixed. Verified: writes the ceiling once, **zero** status PATCHes, no Actual End. **The ceiling measures one continuous stretch, not accumulated total** — testing caught that against cumulative elapsed the guardrail traps itself (after an auto-stop the elapsed IS the ceiling, so Start re-trips it instantly and the worker can never resume); it also would have stopped a legitimately long job spread over two days. Also caught in testing: stale DEMO timers survive the demo→live transition, and the guardrail was PATCHing `production-methods/GOA-4809` — a demo card id. Now scoped to cards actually on the board, with a re-entrancy guard against two ticks firing before the first `setState` commits. ⚠️ The flag is UI-only — there is no Salesforce field for "this number is not trustworthy"; adding one belongs with E2.3. The **capped value** is the durable half. |
| **E2.5** | ✅ | **DONE 2026-09-02**, branch `feat/e2.5-actual-vs-scheduled` (stacked on E6.6/E6.8), unpushed. New "Actual vs Scheduled" panel on `stats.html`: jobs compared, scheduled hours (`Order.Duration__c`), actual hours (`Print_Setup_Timer__c + Production_Timer__c`), signed variance, plus a per-method table. **No new SOQL** — both figures were already in `production-orders`' SELECT and on the client, so this carries none of the FLS risk of adding a field. **Only finished orders count** (`Status === 'Complete'`); a job still on the press has banked partial hours and would report the shop as permanently ahead. **Untimed jobs are excluded, not counted as zero**, and the excluded count is displayed as prominently as the comparison — "we only timed 6 of 19" is the more useful finding, and averaging in a 0 would report a shop that finishes instantly. **Per-method rows cover single-method orders only**: `Duration__c` is one figure per order, so splitting it across a two-method job would be inventing data. A11y: the Chart.js canvas gets `role="img"` and a generated name, and both it and the new panel get real ARIA data tables (divs with explicit roles — `<table>` is unusable here, `<sc-for>` gets foster-parented out). Verified: unit-tested the arithmetic against crafted records, then drove all four states in a browser (live, all-untimed, nothing-finished, demo) with the a11y tree confirming both tables announce. Also added `--border-card` to `tokens.css` — E10.2 missed it; still a literal `#1b1b1e` in 40 places across seven pages, a mechanical follow-up. |
| **E2.6** | P1 | Verify timer-to-run derivation on multi-run methods. The "which cycle am I on" pointer is derived from run actuals, not stored — elegant, and untested against a real three-run method. |
| **E1.5** | ✅ | **DONE 2026-09-02**, branch `feat/e1.5-line-item-detail` (stacked), unpushed. Two halves in very different states. **The order sheet already had a grid — and it was silently wrong.** It grouped by COLOUR alone and labelled each row with whichever garment arrived first, so black tees and black hoodies on one order merged into a single row. Measured: 50 tees + 15 hoodies printed as "Black · Next Level 3600 Tee · S 12 / M 24 / L 29" — the hoodies appeared **nowhere on the sheet** and the press was told to run 65 of a garment only 50 of which existed. On the one document whose whole job is telling the press what to pull. **The calendar had no line detail at all**, just a piece count; its drawer now shows the same breakdown. Both go through one new `sizeGrid()` in `ca-api.js`, grouped by garment **and** colour, so the screen a run is booked from and the sheet the press works off cannot disagree. It also **sorts** the rows — `/api/order-sizes` has no `ORDER BY`, so the same order could previously print its rows differently on different days. Calendar data is fetched per-order **on drawer open**, deliberately not added to `/api/calendar`'s bulk OrderItem roll-up: a drawer is a click, the board is the thing that must never go blank (rule #1). Loading / failed / genuinely empty are three distinct messages. ARIA table roles on the new grid. Verified in a browser across all three states plus the printed sheet. Zebra striping re-keyed to colour — with colours now repeating, index striping rendered two "BLACK" tags differently. |

##### Phase F — Pre-production automation *(the biggest feature still unbuilt)*

| Id | P | What |
|---|---|---|
| **E3.1** | ✅ | **DONE 2026-09-01**, `BEGIN-SETUP-INVENTORY.md`. No new queries needed — `/api/inbox` already returns everything with a source, and five fields come back unused. Of seven form inputs: 2 prefilled, 1 inferable (Print Method, via `Printer__r.Name`), 4 with **no source** and no way to get one. |
| **E3.2** | ✅ | **DONE 2026-09-01**, branch `feat/e3.2-prefill-begin-setup`, unpushed. Scoped by the E3.1 inventory: only specs and notes have a source, so the story is the prefill *mechanics*, not new prefills — the method inference belongs to E3.3. **"Reopening must not overwrite a manual edit" was a live bug, reproduced first:** `updateOrderFieldLocally()` refreshes `st.orders` but not `st.inbox`, and `pickInbox()` seeds from `st.inbox` — so editing the specs, going back to incoming and reopening the same order returned the ORIGINAL text, and `submitMethod()` would then flush that stale value back over the edit already in Salesforce. New `updateInboxFieldLocally()` keeps the cache truthful. Both prefilled fields now carry a **"From Salesforce"** marker that clears on the first keystroke. Verified in a browser: both marked on open, typing in specs left only the notes marker, and the edit survived a reopen. **"Never guessed" already held** — no method or placement is pre-selected and the items list is empty; confirmed by computed style, all four method buttons identical. |
| **E3.3** | ✅ | **DONE 2026-09-01**, branch `feat/e3.3-method-suggestion`, unpushed. **Found a live wrong guess while building it:** `methodOf()`'s heat pattern contained a bare `press`, so `Press 1`, `Press 2`, `10 Head Press` and `6 Head Press` — the shop's four SCREEN PRINT presses per `PRESS_GROUPS` — were confidently classified **Heat Press**, and that is what the Method chip printed on the order sheet that goes to the floor. Patterns are now aligned with the server's `PRESS_GROUPS` (which requires a qualifier: `(heat\|hat\|shirt)\s*press`); proven by a matrix where client and server agree on **18/18** names the server has an opinion about, 0 disagreements. New `methodGuess()` returns `{type, key, confident, from, reason}`; `methodOf()` is a wrapper over it and is **provably unchanged** — 108 records, 0 differences — so the only behaviour change anywhere is those four names, each of which was wrong. Form: pre-selects only when confident with an amber *"Suggested from press X — check it"* chip, blank otherwise with the reason spelled out (`no-match` vs `no-press-name`), and picking by hand clears the label. **Placements deliberately get no suggestion** — the E3.1 inventory established there is no source to infer one from. |
| **E3.4** | ✅ | **DONE 2026-09-01**, branch `fix/e3.4-nested-orderitems`, unpushed. The nested `(SELECT ... FROM OrderItems)` is gone; line items now come from a flat `WHERE OrderId IN (...)` follow-up, which has only top-level pagination — the kind `runQuery` already handles — so the 200 cap disappears rather than moving. This is the pattern `orders/index.js` and `production-orders/index.js` already used for the same data; **the inbox was the last nested subquery in the API.** The IN list is chunked at 200 Ids so the fix doesn't create a sibling of E5.12 (unbounded IN blowing the query-URL limit). A failed item fetch fails open — the inbox still lists its orders — but sets `OrderItemsError` so an empty breakdown isn't mistaken for an order with no garments. 18 tests, including a simulated 400-line order returning all 400. |

##### Phase G — Production promotion *(gated on E7.2)*

| Id | P | Owner | What |
|---|---|---|---|
| **E7.3** | P1 | Salesforce | Consolidate Print Location onto a Global Value Set. Four independent local copies today, six once production exists, plus two code copies. Cheapest it will ever be is before production. |
| **E7.6** | ✅ CLOSED | Salesforce + App | **INVESTIGATED 2026-09-02. The original premise is wrong, and what is actually happening is worse.** The formula in dev2 reads, verbatim: `IF( ISBLANK(Duration__c), Print_Date__c +(2/24), Print_Date__c +(Duration__c/24))` — so a 2-hour fallback **does** exist, and `Duration__c` **does** reach the formula: of 20 scheduled orders, the 5 with a duration set (1, 3, 4, **4.5**) have `Print_End_Date_Time__c − Print_Date__c` **exactly equal** to it. 4.5 surviving also settles the decimal-places worry — **not the problem here.** ⚠️ **But the other 15 orders (75%) have `Duration__c` null and an end time EXACTLY equal to their start time — a zero-hour gap, where the formula says +2h.** Both boards prefill run Scheduled End from this field, so for three orders in four the New Run form opens with **Scheduled End == Scheduled Start**. Worse, `runDurationHours()` in `_priority.js` assumes **2 hours** in exactly this case (its comment claims that is "the same default `Print_End_Date_Time__c` already uses" — **that comment is wrong**), so the scheduling suggestion reserves 2h while the form prefills 0h, for 75% of orders. ✅ **ROOT CAUSE FOUND.** The SOQL was run against order `801ca00000T4m0aAAB`: `Duration__c` is **blank** and `Print_End_Date_Time__c` returns `2026-08-19T12:15:00Z` — **identical to `Print_Date__c`**, not +2h. The mechanism is Salesforce's **blank-field handling**: the "treat blank fields as zeroes / as blanks" option is only offered for formulas returning Number, Currency or Percent. This formula returns **Date/Time**, so the option is not shown — confirmed by opening the formula editor, where no such radio group exists — and Salesforce defaults to **treating blank number fields as zeroes**. `Duration__c` is therefore coerced to `0` *before* `ISBLANK` sees it, `ISBLANK(0)` is **false**, and evaluation always takes the second branch: `Print_Date__c + (0/24)` = `Print_Date__c`. 🚩 **The 2-hour fallback is dead code. It has never once executed since the field was created on 12 Jan 2023.** ✅ **FIXED IN DEV2 2026-09-02 by Anthony**, and independently verified. The formula is now `IF( Duration__c > 0, Print_Date__c + (Duration__c/24), Print_Date__c + (2/24) )` — testing the value rather than asking `ISBLANK` about one that has already been coerced, so blank and zero both fall to the 2-hour branch and a real duration still wins. **Verified twice over two different connections:** Anthony's Query Editor as himself, and the app's own read as the integration user over OAuth. Across the 20 orders on the calendar, **zero-hour gaps went 15 → 0**; the distribution is now 2h×15, 1h×2, 3h×1, 4h×1, 4.5h×1. Control checks: order `00013478` (blank duration) moved 12:15 → **14:15**, while `00013499` (4.5h) and `00013501` (4h) are **byte-identical to before** — the orders that already worked were not disturbed. All eight read endpoints still return JSON with real rows. **Staging: the same edit was applied by Anthony 2026-09-02.** ⚠️ Recorded on his word — staging is not reachable from browser automation, so unlike dev2 it has **not** been independently verified. E7.1 is the precedent for why that matters (dev2 done, staging assumed, story sat half-finished). **To make it airtight:** run the same two queries in staging — one blank-duration order should now show a 2-hour gap, one order with a real duration should be unchanged — and log the date and result in `VALIDATION-INTEGRATIONS.md`. **App half also DONE and LIVE.** `runFormWindow()` in `ca-api.js` floors the end at start + `RUN_FALLBACK_HOURS` (= 2, per D6) whenever `Print_End_Date_Time__c` is missing, unparseable, or not strictly after the start; `index.html` uses it in place of two bare `splitDT()` calls, and the false comment in `_priority.js` is gone. Verified on `origin/main` **and on the deployed site** — `runFormWindow` is present in the live `ca-api.js` and referenced by the live `index.html`. **Production is the only org left, and it belongs to E7.4** — it has none of this metadata yet, so the formula travels with that promotion rather than as a change of its own. ✅ **FORMULA FIXED BY ANTHONY 2026-09-02.** ✅ **APP HALF DONE 2026-09-02**, branch `feat/e7.6-run-end-floor`, unpushed — `runFormWindow()` in `ca-api.js` floors the New Run end at start + 2h whenever `Print_End_Date_Time__c` is missing, equal to or before the start; used by `openRunCreate()` (index) and `defaultRunForm()` (pre-production), and `runDurationHours()`'s false comment is corrected. Verified in a browser on both pages: the zero-gap order prefills 07:15→09:15, a healthy 4.5h order passes through 07:15→11:45 untouched, and feeding the guard's own output back in changes nothing. **Original note, kept for the record — an app-side story for Claude Code:** `openRunCreate()` prefills Scheduled End straight from this field, so it must never seed an end equal to or before the start; and `runDurationHours()` in `_priority.js` carries a comment claiming 2 hours is "the same default `Print_End_Date_Time__c` already uses", which is **false** and should be corrected whichever way the formula lands. |
| **E7.4** | P0 | Peter Larson | Promote the full metadata set to production. Production has **none** of it — no Apex, no `Proposed_Run__c`, no calendar setting, no priority fields, no `Print_Location__c`, no flows. Promote from staging. **After deployment, by hand:** FLS for every new field (change sets deploy fields with FLS off) and permission-set assignments (assignments never travel). A clean "Deployment succeeded" is **not** evidence of either. The `Planned` value must exist in the restricted `Auto_Scheduling_Status__c` picklist before the app is pointed at production. 📌 **Carry E7.6's corrected formula with this promotion.** `Order.Print_End_Date_Time__c` must read `IF( Duration__c > 0, Print_Date__c + (Duration__c/24), Print_Date__c + (2/24) )` — **not** the original `ISBLANK` version, whose 2-hour branch can never execute because a Date/Time formula gets no blank-field-handling option and Salesforce coerces blank numbers to zero. If production is built from an old change set, this regresses silently and every order without a duration gets a zero-length print window again. |
| **E7.5** | ⚠️ partly done | Ops | **The three `SF_ENV_PRODUCTION_*` secrets now EXIST** — verified 2026-09-02 in Pages → Settings → Variables and secrets (CLIENT_ID, CLIENT_SECRET, LOGIN_URL, all encrypted), and `/api/admin/sf-env` now reports production as `configured: true`. **Anthony did not set them.** The Cloudflare account is Peter's, so ask him to confirm before assuming. 🚨 **This is now ahead of E7.4, which is the dangerous order:** production has none of the metadata — no Apex, no `Proposed_Run__c`, no `Print_Location__c`, no calendar setting, no flows — yet the env switcher will offer it as a destination and the switch is global and instant. The only thing standing in the way is `SF_ENV_SWITCH_PIN`, which `admin/sf-env.js` checks with `safeEqual` and enforces **regardless of `ACCESS_ENFORCE`** (`requireCap` there is still report-only, so the PIN is the real gate). **Until E7.4 lands, treat production as configured-but-not-ready** and keep that PIN closely held. | Configure the production environment in Cloudflare. `SF_ENV_PRODUCTION_LOGIN_URL` / `_CLIENT_ID` / `_CLIENT_SECRET` from a production Connected App, with the Client Credentials run-as user chosen deliberately and its FLS reviewed. `SF_ZK_ORDER_FIELD_ID_PRODUCTION` is a per-org metadata Id that does **not** migrate with a change set. Verify the switch *back* to staging too — that is the rollback. |
| **E7.7** | P2 | Salesforce | `ProductionRunTrigger` is after insert/update only, so deleting a run inside Salesforce skips `OrderPrintDateRollup` and leaves `Print_Date__c` stale. The app's delete path handles it; the Salesforce UI path does not. |
| **E7.8** | P2 | Salesforce | Decide the fate of `OrderScheduling`'s `CreateCalendarEvent` — keep it and document the duplicate-event behaviour, or remove it and let `ProductionEventPublisher` own the calendar end to end. |

##### Phase H — Validation *(no code, and it is the actual gate)*

| Id | P | What |
|---|---|---|
| **E8.1** | 📝 | **CHECKLIST WRITTEN 2026-09-02 — `VALIDATION-INTEGRATIONS.md`. Not yet run: writing it is the artifact, running it is the validation.** 40 items over **eight** surfaces, not seven — access and identity is the one that tends not to get counted, and it is the seam that is currently open. Every item names the expected Salesforce record state, and the stored picklist values in its appendix were read from live dev2 data and dev2 Setup rather than copied from the code, so no item asserts a value that does not exist. Carries the run log. **Next: run it in full against staging, with date, org and result recorded.** |
| **E8.2** | 📝 | **SCENARIOS WRITTEN 2026-09-02 — `VALIDATION-SCENARIOS.md`. Not yet run.** All eight scripted, each naming the record state expected at every checkpoint **and its false pass** — the specific way it can look right while being wrong, drawn from bugs that have already shipped here (the Heat Press mis-classification reaching the order sheet; `combine.js` breaking only past twelve orders; a reprint failure wearing the "nothing to do" shape). S6 proves the reprint loop all the way round and records D5's reference-only rule as a check. ⚠️ **S6 is expected to FAIL at the make-up run step until B3's error-surfacing fix lands** — that is known, not a surprise. **Next: run S1–S8 against staging.** |
| **E8.3** | P1 | Prove coexistence with the auto-scheduler. A `Planned` run's times survive a scheduler run; a Confirmed run publishes and un-confirming deletes; a Proposal-status run is still moved, as intended; press occupancy accounts for `Planned` runs so it doesn't double-book. Partially evidenced by the PR-0085 test — finish it. |
| **E8.4** | P1 | Shipping and Zenkraft validation. Least-exercised board, no manual retry, polls every 6s for up to four minutes, carries E5.6 and E5.10. |
| **E8.5** | ✅ | **DONE 2026-09-01**, branch `fix/e8.5-smoke-script`, unpushed. `node tools/smoke.mjs` — **2.4 seconds**, no network. Seven checks, every one an incident that really happened: an asset referenced but not committed (`tokens.css`, twice), an extensionless route file (S1), an import that does not resolve or is untracked (`_placements.js`'s near-miss), server modules that do not parse, board logic that does not parse (caught a real break during E4.5), plus `check-dc-templates.mjs` and `contrast.mjs` folded in. **Verified by replaying all eight failure modes in a throwaway worktree — 8 caught, 0 missed, and the clean tree passes.** Untracked files with broken imports warn rather than fail, which surfaces the `_to_delete` import that silently breaks `wrangler pages dev` without blocking a push. Install as a pre-push hook; hooks are not tracked, so each clone opts in. |
| **E5.12** | ✅ | **DONE 2026-09-01**, branch `fix/e5.12-calendar-in-lists`, unpushed. Both halves done. **Four** unbounded IN lists, not one — runs by method, OrderItem, `Proposed_Run__c` and `Pre_Production_Item__c` — all now go through a new shared `runChunkedIdQuery` in `_sf.js` (200 Ids/chunk). The runs one needed *splitting* rather than chunking: it was `(date range) OR PrintMethod__c IN (...)`, and chunking that in place re-runs the range half per chunk, so it is now one range query plus chunked method queries merged through a Map keyed on run Id. **And it would have failed invisibly** — an over-long URL is an HTTP rejection, not a SOQL error, so the whole block fell into its `catch` and the calendar rendered with no runs and no explanation. Window span capped at `MAX_RANGE_DAYS = 366` (clamped, reported in `window.clamped`; the client never asks for more than 6 days), and `to` before `from` now returns `to_before_from` instead of reading as an empty shop. `inbox/index.js` converted off its own E3.4 chunk loop onto the shared helper — its 18 tests re-run green. 13 calendar + 10 helper tests. |
| **E5.13** | ✅ | **DONE 2026-09-01**, branch `fix/e5.13-stale-comments`. Only one of the three cited comments was actually stale (`production-runs/index.js`); `orders/[id].js` was accurate and left alone, and `calendar/index.js:327` was the wrong location. `SELECTOR-CHANGE.md` rewritten — its Apex steps are still needed for staging and production, but its verification pressed buttons removed on 2026-08-21. |

##### Phase I — Shop-floor readiness and the pilot

| Id | P | What |
|---|---|---|
| **E9.1** | P0 | Test on the actual tablets. Everything so far has been developed and audited on a desktop. Touch targets, on-screen keyboards, drawer scrolling, and the drag-and-drop kanban and calendar by touch — all unproven. Log findings with device and browser version. |
| **E9.2** | P0 | Shared-device identity. Switching workers takes under fifteen seconds and clears the previous identity everywhere — client state *and* server cookie. Test with three workers in sequence on one device. |
| **E9.3** | P0 | Behaviour on slow and interrupted connectivity. This is the acceptance test for E4.1–E4.4 and E2.2. No board shows a save that did not happen; every board recovers on its own; a blocked CDN still yields a usable page. |
| **E9.4** | ✅ | **DONE 2026-09-01**, branch `fix/e9.4-contrast`, unpushed. All 14 text/surface pairs now clear 4.5:1, checkable with `node tools/contrast.mjs`. Two corrections to the story: the ratios are worse than stated because **cards (`#121215`) are lighter than the page**, so muted was 3.29:1 and faint 2.06:1 against the surface they actually sit on; and **the whole ramp had to move, not just the three failing tokens** — `--text-tertiary` was only 4.98:1, so raising muted past 4.5 would have made it lighter than tertiary and inverted the hierarchy. Re-spaced to steps of 19.3 / 9.0 / 7.0 / 4.6 in L\*. That meant tokenising `#9C978C` and `#8a8378` too (291 more conversions, which E10.2 had left literal). **`order-sheet.html` deliberately excluded** — it prints on cream `#f2ede6`, where lightening text *lowers* contrast (3.22 → 2.35); it keeps its own literals. Verified across all nine pages: no render errors and **zero elements left painted on the old failing colours**. ⚠️ AA is the floor — sign-off is still a tablet under real shop lights, now a one-line tune per token. |
| **E9.5** | P1 | Lock down manager and admin controls — verified *after* `ACCESS_ENFORCE` is on. The env switcher must be unreachable for anyone but Anthony, including by direct URL. |
| **E9.6** | P1 | Long-session soak test. Boards refresh every 15–20s, Zenkraft polls every 6s, timers tick, and nothing has run for eight hours. Memory growth, timer drift and session expiry only surface here. |
| **E9.7** | P1 | One-page station guides, in shop vocabulary, printed and posted. A pilot that fails on unfamiliarity teaches nothing about the software. |
| **E9.8** | P0 | **Run the controlled pilot.** Entry: every P0 closed, E8.1 and E8.2 passing on the target org, and the rollback path exercised at least once. Two or three workers plus Gian or Parker, real orders, one week, alongside the existing process. Daily ten-minute check-in for the first three days. Exit: no data-loss or wrong-print incident, every workflow completed at least once by a worker without help, issue list triaged, and a written go / no-go with reasons. |
| **E9.9** | P2 | Keyboard and screen-reader access. Every card and calendar block is a `div` with `onClick` and no role, tabIndex or key handler; no drawer or modal sets dialog semantics, focus or Escape-to-close; icon-only buttons have no names; only `calendar.html` has `lang` and a title. |
| **E10.2** | ✅ | **DONE 2026-09-01**, branch `fix/e10.2-design-tokens`, unpushed. New `tokens.css`, linked from all nine pages' real `<head>`. The base chrome that was duplicated 7–9 times is gone from the pages; 2,754 hex literals / 102 distinct values become a role-named palette. **252 conversions** — 206 inline `color:` uses and 46 JS style literals. calendar.html's standing warning (*"do not tidy this into variables unless the other five boards move at the same time"*) is satisfied: all nine moved together, and the comment is rewritten. **Tokens are named by role, not value** — `#232327` is a border 108× and text 1×, so `--border-subtle` and `--text-ghost` are separate and E9.4 can raise the text without touching a single border. Chart.js tick colours in stats.html deliberately stay literal (canvas cannot resolve a custom property). Verified in a browser: all nine pages render, no errors, order-sheet keeps its own print grey, and **overriding one token moved all 66 affected elements with zero stragglers** — which is the E9.4 unblock, demonstrated rather than assumed. |

---

---

## 5. Decisions
Numbered, dated, and referenced from the stories they govern. **A new decision gets the next D-number and a line saying what it rules out, not just what it chooses.**
**D1 — no produced field. DECIDED.** The four-quantity model records only problems. The board shows
the *implied* produced number where it is useful, but nothing is stored. This is why E1.4 needs
rewriting rather than building.

**D2 — the garment station gets a missing-items field. DECIDED and shipped.** Workers record *what*
is short at count-in, not just that an order is partial. Presence of the key is the only write gate;
nothing auto-clears the note.

**D3 — the run shows both the total and the size breakdown. DECIDED and shipped.** Total Garments is
derived from the size rows and read-only. One source of truth.

**D5 — the run-results carry-over is reference-only. DECIDED 2026-09-01.** On a multi-method order,
a sibling method's misprint and damaged counts are **displayed for reference** on the next method's
counting card and are **never written** to that method's line items. Incomplete stays strictly
per-method. Writing them twice would double-count the order, inflate the reprint that
`createReworkIfNeeded` builds from gate 4, and destroy D1's invariant. See **B3** in Part 0.

**D6 — the New Run form prefills start + 2 hours when the order's end time is unusable. DECIDED
2026-09-02.** When `Print_End_Date_Time__c` is missing, equal to, or before `Print_Date__c` — 75% of
scheduled orders today — `openRunCreate()` seeds Scheduled End as **start + 2 hours**, matching what
`runDurationHours()` in `_priority.js` already reserves, so the form and the scheduler stop
disagreeing. It is a floor, not a correction: once the formula is fixed it should quietly stop
firing. See **E7.6** and the story in `CLAUDE-CODE-QUEUE.md`.

**D11 — line-item allocation is placement-aware. DECIDED 2026-09-03.** The skeleton Flow's scope key
becomes *method + `Print_Location__c`* instead of *method*, so each placement on a method is allocated
the order's full size breakdown. The Back pass physically runs every garment through the press again,
and a run planning zero of them cannot be counted. Claude flagged that a method's runs then sum to
twice the order quantity on a two-placement job and recommended rows-at-zero instead; Anthony chose
placement-aware on the physical argument. The exposure was checked afterwards and is contained — the
app reads planned quantity only as per-run `Total_Planned_Qty__c`, and `_rework.js` reads only
misprint and damaged — but **any Salesforce report or Apex that sums planned across a method's runs
is still unchecked.** See **B4** in Part 0.

**D9 — the stored priority copy is deleted, not wired. DECIDED 2026-09-02.** `Production_Method__c.Production_Priority__c` and `_priority-rollup.js` are gone. The rollup had never been called, the field was never written or read, and its stated consumers (station sorting, reports, Apex) did not exist — the stations sort by `Print_Date__c`. Priority is computed live by `_priority.js` on every request, which that file argues is correct by construction anyway. If a Salesforce report ever needs a stored copy it comes back from git history, but it comes back **wired**: an unrefreshed priority field is worse than none. See **E5.8**.

**D10 — timer stop navigates to the counting screen. DECIDED 2026-09-02.** Stopping the production timer on a run sends the operator to `counting.html?runId=<run>` rather than showing a prompt they can dismiss. Claude argued for a non-blocking button (on a multi-run job the next action is setting up the press for run 2, and this takes the board away mid-changeover); Anthony chose the navigation on the grounds that counting is precisely the step that gets skipped. See **E1.4**.

**D7 — OVERTURNED 2026-09-02, same day. ~~Mockups arrive as Vault uploads.~~** Staging disproved it: real orders carry pasted third-party links and **not one order in either sandbox has ever used the Vault flow**. The belief that they did came from how the process is *documented*, not from the data. Left here rather than deleted, because the failure mode is worth remembering — a decision was nearly closed on how the system was believed to work. **D7b stands and is now the plan.** The original text: ~~mockups arrive as Vault uploads, so the allowlist is not the problem.~~ Real artwork is uploaded to the Design record's Vault tab, which yields a Salesforce ContentVersion URL and takes branch A of `mockup-proxy` — no allowlist involved. dev2's 38 blocked images are test junk, not a defect. **D7b, the contingency:** if a real org is ever found to hold pasted third-party links, the fix is to **fetch and cache the image at intake**, never to widen `ALLOWED_MOCKUP_HOSTS` — widening is a permanent treadmill and re-opens the SSRF surface E6.2 closed. See **B1** in Part 0.

**D8 — pasted mockups are adopted INTO Salesforce, lazily, on first use. DECIDED 2026-09-02.** Supersedes D7b's "cache it at intake". On the first request for an uncached external mockup, the proxy fetches it once, saves it as a file on the Design record, rewrites `Mockup_URL__c` to the Salesforce servlet URL, and serves the bytes; every later request takes branch A. **No R2 bucket, no binding, no ops step** — and it does not build a cache beside the problem, it converts the data into the shape `_mockup.js` always documented. Lazy rather than at intake: self-healing, no trigger to build, and it only ever fetches images someone actually looked at. ⚠️ **Caching relocates the SSRF risk rather than removing it** — every branch-B protection stays except the host allowlist, plus a new size cap and timeout; and this turns a GET into a write, so adoption must be idempotent, must never overwrite a Vault URL, and must leave the field untouched when the fetch fails. Full spec in `CLAUDE-CODE-QUEUE.md`. **Owner: Claude Code.**

**Still open — cleared allocation rows.** Today a cleared size is set to `Planned_Qty__c = 0` and the
row is never deleted, so zero rows still render on the counting screen. The alternative is deleting
non-last rows and zeroing only the final one. Setting to zero is reversible and does not reach into
the Flow's output; deleting is tidier on screen. **Anthony's call, and nobody is blocked on it.**

---

---

## 6. Who owns what, and the rules of engagement
- **Anthony** — pushes to `main` himself and runs his own tests. Owns E6.4 and E7.5 (ops), the env
  switch, and every product decision.
- **Peter Larson** — Salesforce flows and Apex. Owns E7.2 (the long pole) and E7.4.
- **Claude Code** — everything in the App track: Phases B, C, D, E, F, and the code half of H.
- **A Claude project with Salesforce browser access** — the live org work: E7.1's staging half,
  E7.3, E7.6, and running the E8 checklists against a real org.

⚠️ ~~**Staging is currently unreachable from browser automation.**~~ **No longer true — corrected
2026-09-04**, by driving staging Setup and Flow Builder end to end (the proposed-runs relabel, §9).
No permission grant was needed. The one real obstacle is a "Sorry to interrupt · CSS Error" modal
that Flow Builder throws when a screen editor is opened on a freshly loaded page; reloading and
retrying clears it. **This unblocks running E8.1 / E8.2 against staging** — which was the reason
that note mattered. Staging also still has
`Quantity_Completed__c` and `Reprint_Quantity__c`, which should be deleted.

---


There are no tests. What exists:

- `npx wrangler pages dev .` with a git-ignored `.dev.vars` for local Functions.
- `GET /api/admin/sf-env` — which org the deployment is pointed at right now.
- `GET /api/rework-check?orderNumber=…` — read-only trace of all four reprint gates.
- Cloudflare Pages logs — most failure paths `console.error` the Salesforce errorCode and message,
  deliberately.

**A green board is not a passing test.** Every board falls back to demo data with an amber "Demo
data" chip when its fetch fails, so a broken SOQL change renders as a working page full of plausible
fake numbers. **Check the network tab, not the screen.**

---


- **Don't push.** Anthony pushes to `main` himself and runs his own tests after yours. Leave work
  committed on a branch.
- **One story per commit**, with the Asana id (`E6.1`, `E5.1`) in the message.
- **Keep this file current.** Not at the end of a batch, not "when it settles" — every time
  something lands. This file and `CLAUDE.md` are the only durable record of why the code looks the
  way it does. The previous queue going stale is what made a completed week read as untouched.
- **Read the comments before changing behaviour**, and update them when you do. Most of the
  non-obvious code here has forty lines of reasoning above it, and several of those comments record
  a bug that has already been fixed twice.
- **Before deferring anything as "blocked on Salesforce", grep the Functions headers.** Several
  record live Setup findings with dates. E5.2 was parked for a day on a question that had already
  been answered in `shipping-orders/index.js`'s header.
- **Before touching a SELECT list**, re-read trap 1. An FLS-hidden field empties a whole board rather
  than losing one value, and it returns HTTP 200 while doing it.

---

## 7. Work queue — ready for Claude Code
What can be handed over right now without waiting on Salesforce, ops, or a decision. Completed stories are kept with their write-ups: several record a bug that has already been fixed twice, and the reasoning is the point.
**Written 2026-08-31.** Companion to `ROADMAP.md`, which stays the source of truth for scope and
sequencing. This file exists to answer one question: *what can be handed to Claude Code right now,
without waiting on Salesforce, ops, or a decision from Anthony?*

Read `CLAUDE.md` first. Every trap in it has already cost an afternoon.

**Rules that apply to every item below.** One story per commit, Asana id in the message. Work on a
branch off `origin/main` — do not push; Anthony pushes and runs his own tests. A green board is not
a passing test: every board falls back to demo data with an amber chip, so a broken change renders
as a working page full of plausible fake numbers. Check the network tab, not the screen.

> **Branch warning.** The local branch `docs/decisions-and-e13-groundwork` is **27 commits behind
> `origin/main`** and holds one unpushed docs commit. Do not build on it. Branch from `origin/main`.
>
> Confirmed 2026-08-31: every *file* on disk already matched `origin/main` — only the branch pointer
> was stale — so this reads as "up to date" from the editor while sitting 27 commits back. The one
> real difference was `NEXT-STEPS.md`, which `origin/main` has deleted; the 438-line working copy is
> stashed as `stash@{0}`.
>
> Two local-only snags worth knowing about, neither of which affects the deploy:
> `functions/api/_to_delete/vendors/index.js` imports `../_sf.js`, which does not exist at that path,
> and that **breaks `npx wrangler pages dev .` outright** — the documented verification tool fails to
> build Functions until that untracked directory is moved aside. A stale zero-byte `.git/index.lock`
> was also blocking every write command.

---

#### Branch audit — 2026-09-02 (supersedes the earlier merge warning)

**An earlier note here warned that 21 unpushed branches would collide badly. That warning was
wrong, and this replaces it.** It measured `git merge-tree` conflicts without checking whether the
work was *already on `main`* — and almost all of it is. Anthony re-applies each branch's changes to
`main` through the GitHub UI, so the branches are mostly stale copies of shipped work, not pending
work. A branch cut from an older `main` "conflicts" on every file `main` has changed since, which is
what produced those 50-hunk numbers.

**Method used here instead:** for each branch, take the lines its own commits *added*, and check
whether each one is present in `origin/main`'s copy of that file. That is robust to how the work
landed.

##### Safe to delete — 20 branches

**Fully landed (17):** `feat/e1.5`, `feat/e2.5`, `feat/e3.2`, `feat/e3.3`, `feat/e6.6`,
`feat/e6.8`, `feat/e7.6-run-end-floor`, `fix/e2.2`, `fix/e4.5`, `fix/e4.6`, `fix/e5.11`,
`fix/e5.12`, `fix/e5.6`, `fix/e5.7`, `fix/e6.7`, `fix/e9.4`, `fix/s1` — 95–100% of added lines
present on `main`.

**Nothing to land (3):** `docs/e3.1`, `fix/e5.13`, `fix/e8.5` — no content changes remain.

##### Keep — 4 branches, and 2 carry real gaps

| Branch | Landed | Verdict |
|---|---|---|
| `fix/e10.2-design-tokens` | 88% | **Stale, safe to delete.** The "missing" lines are the pre-token inline hex (`#9C978C`, `#1A1409`) that later work replaced with `var(--…)`. `main` has evolved *past* it. |
| `fix/e3.4-nested-orderitems` | 64% | ✅ **False alarm — retracted 2026-09-02. Nothing to cherry-pick; delete it.** `main` chunks too, but through a **shared `runChunkedIdQuery()` helper** in `_sf.js` used by `inbox` (1 call) and `calendar` (4 calls) — strictly better than the branch's inline `ID_CHUNK` loop. The 64% was an artifact of comparing literal added lines: a refactor into a shared helper legitimately changes them. **Lesson for this audit method — a low percentage means "look at it", never "it is missing".** |
| `feat/e2.4-timer-guardrails` | 96% | ✅ **CONFIRMED REAL, and FIXED 2026-09-02** (edit sits uncommitted in the working tree — see below). **A route lost its access gate.** `functions/api/update-order-receiving/index.js` on the branch imports `requireCap` and calls `requireCap(request, env, "orders.receive")`; **`main` has neither.** 4 lines in `_session.js` are missing too, likely the matching capability. E6.5 gated the mutating routes — this one is ungated on `main`. **Re-apply before `ACCESS_ENFORCE=1`,** or it is a hole on the day enforcement goes on. |
| `docs/decisions-and-e13-groundwork` | **0%** | **The docs branch, entirely unpushed.** `CLAUDE.md`, `.gitignore` and `NEXT-STEPS.md` do not exist on `main` at all, and `README.md` is 11 lines behind. This is the "docs live only on Anthony's disk" problem, now precisely located. |

**Net: the merge backlog was not real, and only ONE of the two suspected gaps was.**

##### Done 2026-09-02

- **20 branches deleted.** Every SHA is recorded in `DELETED-BRANCHES-2026-09-02.txt` at the repo
  root — restore any with `git branch <name> <sha>`, the commits are still there.
- **The `orders.receive` gate is applied** to `functions/api/update-order-receiving/index.js`:
  the `requireCap` import plus a two-line gate after the body parse, matching the placement
  `run-results/index.js` uses. Verified — the module parses and imports cleanly, and
  `node tools/smoke.mjs` passes all 7 checks. **It is an uncommitted working-tree change**, because
  git writes on this mount are unreliable (`checkout` refused over a `.DS_Store`, `git diff` hit a
  bus error, ref deletion needed stale `.lock` files cleared by hand). Commit and push it the way
  you normally do.

##### Still to do — three branches left

| Branch | Action |
|---|---|
| `docs/decisions-and-e13-groundwork` | **Merge it.** `CLAUDE.md`, `.gitignore`, `NEXT-STEPS.md` are on no other branch and not on `main`. Add `ROADMAP.md`, `CLAUDE-CODE-QUEUE.md`, `VALIDATION-INTEGRATIONS.md` and `VALIDATION-SCENARIOS.md` in the same commit. |
| `fix/e3.4-nested-orderitems` | Delete — retracted above. |
| `feat/e7.6-run-end-floor` | Delete once you are off it (it is the checked-out branch, so it was left alone). Its work is fully on `main`. |


---

#### Tier 0 — ~~Ship this first~~ DONE 2026-08-31

##### S1 · Shipment routes are committed without a file extension — ✅ FIXED, awaiting push
**Files:** `functions/api/shipments/combine` → `combine.js`, `functions/api/shipments/split` → `split.js`

Both are committed to `origin/main` with **no extension**, so Cloudflare never compiles them into
routes. Verified empirically with wrangler 4.127.1 against a scratch Pages project:

| Request | Result |
|---|---|
| `POST /api/demo/withext` | 200, function runs |
| `POST /api/demo/noext` | **405, empty body** |
| `POST /api/demo/does-not-exist` | **405, empty body** — identical |

`shipping.html` calls `POST /api/shipments/split` and `POST /api/shipments/combine` (`ca-api.js`
:1459, :1463), so **both shipping actions are dead on the deployed site, on whichever org the
switch points at.** `jsend` gets a 405 with an empty body, so `httpError` has no Salesforce reason
to surface — the board shows a bare status code.

It passes locally because correct `combine.js` / `split.js` copies sit on disk, byte-identical to
the extensionless ones, and were never added to Git.

**Fix:** `git mv -f functions/api/shipments/combine functions/api/shipments/combine.js` (same for
`split`). No code change. Confirm no other extensionless file is acting as a route:
`find functions -type f ! -name '*.js' ! -path '*_to_delete*'`.

**Landed** on branch `fix/s1-shipment-route-extensions` (off `origin/main`), commit `d4a7479`.
Pure rename — git reports 0 insertions, 0 deletions. **Not pushed.**

Re-verified before *and* after with wrangler 4.127.1, in a clean tracked-only worktree so no
untracked file could mask the result:

| Request | Before | After |
|---|---|---|
| `POST /api/shipments/split` | 405, 0 bytes | **400 `{"error":"invalid_order_id"}`** |
| `POST /api/shipments/combine` | 405, 0 bytes | **400 `{"error":"need_at_least_two_orders"}`** |
| `POST /api/shipments/does-not-exist` | 405, 0 bytes | 405, 0 bytes *(control, unchanged)* |

Each route now runs its own validation on an empty body; the control is unchanged, so this is the
rename and not a restart artifact. Sweep came back clean — no other extensionless file exists under
`functions/`, tracked or on disk. E8.5 should encode that sweep.

`GET /api/shipments/split` returns the SPA HTML rather than 405, because the module exports only
`onRequestPost`. Expected, and harmless — `ca-api.js` only ever POSTs.

---

#### Tier 1 — Self-contained, no blockers, small blast radius

##### E4.8 · `stats.html` Switch Account never clears identity — ✅ DONE 2026-09-01
**File:** `stats.html:464`

```js
onSwitchAccount:()=>{ window.location.href='login.html'; },
```

No `clearIdentity()` call — confirmed, the identifier appears nowhere in the file. The next person
lands signed in as the previous one. Every other board clears first: `counting.html:490`,
`index.html:1093`, `calendar.html:1141`, `pre-production.html:1147`. Breaks attribution on a shared
tablet, which is the whole point of the PIN. Match the existing pattern; clear client state **and**
the `ca_sess` cookie.

**Landed 2026-09-01.** One line, plus the comment above it.

**It was worse than this note says.** `login.html`'s `componentDidMount` (:125) auto-admits whenever
a role and a valid name are already in localStorage — it sets `screen:'done'` and never renders the
PIN pad. So Switch Account was not "leaving the old identity lying around", it was a **complete
no-op**: it navigated to `login.html`, which immediately handed the tapper back the *previous*
person's session without ever asking for a PIN, on a screen that reads as a successful switch.

Verified in a browser against a local `wrangler pages dev`:

| | Before | After |
|---|---|---|
| `login.html` with an identity stored | "Welcome, Gian · MANAGER" + board list | — |
| localStorage after tapping Switch Account | (unchanged) | all three keys `null` |
| `POST /api/worker-logout` | never sent | **200 OK** (survives the navigation via `keepalive:true`) |
| `login.html` on arrival | auto-admitted | **"Enter your PIN to continue"** |

Swept all nine pages: `stats.html` was the only broken one. `calendar.html` looked missing to a grep
for `onSwitchAccount` but is fine — it binds `onSwitchUser` and clears correctly at :1141.

##### E6.7 · `text()` strips HTML by assigning `innerHTML` — ✅ DONE 2026-09-01
**File:** `ca-api.js:1702`

Builds a detached `div` and assigns `innerHTML`. An `<img src=x onerror=…>` still fires in Chrome
from a detached element. The input is Salesforce rich text. Replace with
`DOMParser.parseFromString(s, 'text/html')` and read `.body.textContent`.

Careful: trap 6 says **everything** from a formula field goes through `text()` —
`GOA_Order_Number__c` and `Customer_Order_Name__c` return `HYPERLINK()` markup. Whatever replaces
it must still yield the same visible strings on every board.

**Landed 2026-09-01.**

**Reproduced before it was fixed.** Ran `<img src=x onerror="…">` through the real function in
Chrome: the handler executed. A detached element does not run `<script>` — which is presumably why
this looked safe — but it *does* load resources, so the error handler fires anyway. The input is
Salesforce rich text, i.e. whatever somebody typed into a field, with nothing in between sanitising
it.

Now `new DOMParser().parseFromString(s, 'text/html')` and `.body.textContent`. That builds an inert
document: no scripts, no resource loads, no handlers.

**Trap 6 was the actual risk here**, not the fix. `text()` runs on every formula field on every
board, so the replacement had to return the same strings — a "safer" version that formatted
differently would have been a visible regression on nine pages. Checked across 14 input shapes:

both `HYPERLINK()` formulas · plain strings · nested tags · HTML entities · `<br>` ·
multi-paragraph rich text · numbers · `null` / `undefined` · empty · a bare `<` in
`qty < 5` · the payload itself · whitespace collapsing

**All 14 identical, zero mismatches**, then re-confirmed against the shipped `CAApi.text()` loaded
from `ca-api.js` rather than a copy of it. Note the entity case deliberately still returns
`Ridgeline &amp; Co` undecoded — there is no `<` so the branch is skipped, and that is existing
behaviour the boards render today. Not this story's job to "improve".

Swept the other two `innerHTML` assignments in `ca-api.js` (lightbox button icons, mockup-failure
message): both take literal Tabler class names and static copy. No Salesforce data reaches either.

##### E5.11 · A run's scheduled time cannot be cleared — ✅ DONE 2026-09-01
**File:** `functions/api/production-runs/[id].js:72` (`parseIso`), :124–125, :195

`parseIso('')` returns `undefined`, the field never lands in the payload, and the request falls
through to `no_valid_fields` at :195. Meanwhile `actualStart` (:161) explicitly nulls. There is no
way to un-schedule a run without deleting it. Make an empty string an explicit null for
`scheduledStart` / `scheduledEnd`, matching the `actualStart` path.

Trap 9 applies: every write must end at `Confirmed`.

**Landed 2026-09-01.** Server + both run-row drawers.

**The server was only half of it.** `index.html:1516` and `pre-production.html:1608` hard-required
both halves of the window, so blanking the schedule failed client-side with *"Set the scheduled
start date & time"* and never sent a request. A manager never saw `no_valid_fields` at all — that
path was only reachable from the API directly. Fixing the endpoint alone would have changed nothing
anyone could observe, which is worth remembering for the next story written from an endpoint read.

- **Clearing is pair-only.** A half-clear returns `scheduled_window_must_clear_together`. A run with
  an end and no start reads as "Not scheduled yet" on every board (they test `Scheduled_Start__c`
  alone), so the orphaned end would be invisible and permanent.
- **Create still requires a schedule.** `production-runs/index.js` 400s on a blank, so
  `submitRunCreate` and `calendar.html`'s combined create/edit form keep their guards. Only an
  existing run can be un-placed.
- **A clear lands on `Confirmed`** — Anthony's call, 2026-09-01, over the alternative of dropping to
  `Proposal` and letting the auto-scheduler re-slot it. Nothing should silently re-book a slot a
  manager just cleared. ⚠️ The cost: a cleared run still reads "On the shop calendar" in
  `schedState()` while carrying no time, and `ProductionEventPublisher` is handed an Event with null
  start/end. **What the Apex does with that is unverified** — check it under E8.3 before production.

Verified: every server path probed against a local wrangler — clear-both gets past validation and
reaches the real Salesforce PATCH (fails only on `sf_env_not_configured_dev2`, identical to the
known-good "valid both" control) instead of `no_valid_fields`; all four half-clear shapes return
`scheduled_window_must_clear_together`; `no_valid_fields`, `bad_scheduledStart`,
`scheduledEnd_before_scheduledStart` and independently-nullable `actualStart` all unchanged. Plus 6
tests driving the *real* patched guard extracted from `index.html` against the *real*
`CAApi.buildRunDateTime`. Both drawers' guards are byte-identical.

**Not verified:** anything requiring a live org — the write itself, and what the Apex publisher does
with a null-dated Confirmed run.

##### E5.13 · Three stale doc comments — ✅ DONE 2026-09-01
**Files:** `production-runs/index.js:56`, `orders/[id].js:30`, `calendar/index.js:327`

All still describe pre-`Planned` behaviour ("every write here sets Confirmed"). Fold the dead
verification section of `SELECTOR-CHANGE.md` into this — it assumes `Planned` is a durable state a
manager parks a run in, which the shipped code contradicts (`calendar.html`'s `schedState()` calls
it a publish failure, and Unconfirm was removed from every board).

**Landed 2026-09-01 — and only one of the three cited comments was actually stale.**

| cited | verdict |
|---|---|
| `production-runs/index.js:56` | **stale, and the dangerous one.** Header claims "every write here sets `Auto_Scheduling_Status__c = 'Confirmed'`" while the same file, forty lines down, documents insert-`Planned`-then-PATCH-`Confirmed`. Read alone it invites collapsing the two writes — which is precisely what makes `ProductionEventPublisher` publish nothing (trap 9). Corrected, and it now says *why* two steps. |
| `orders/[id].js:30` | **accurate — left alone.** A dragged run genuinely is stamped `Confirmed`: `statusForScheduleWrite()` returns `RUN_CONFIRMED`, and `production-runs/[id].js:252` writes it on any schedule touch. The note was wrong about this one. |
| `calendar/index.js:327` | **wrong location** — that line is press-grouping code. The run-state comment in that file was *incomplete*, not stale: a two-value description (`Proposal` / `Confirmed`) of a three-value field. It now names `Planned` and says it means the publish failed, not that someone still has to act. |

**`SELECTOR-CHANGE.md` rewritten rather than deleted.** Its two Apex changes are still correct and
still needed — **dev2 has them as of 2026-08-31; staging and production do not** — so deleting the
file would have thrown away live instructions. What was rewritten is everything around them:

- The rationale sold `Planned` as "lay out a whole week privately and publish when it's settled."
  That workflow was deleted on 2026-08-21 along with Confirm/Unconfirm.
- Steps 2 and 3 of the verification said "Hit Confirm" / "Hit Unconfirm". Those buttons do not exist,
  so the check could not be run at all.

The replacement documents what the change actually buys now: `Planned` is a **few-hundred-millisecond
window** between the insert and the PATCH, `ProductionRunTrigger` fires on that insert while the run
is still `Planned`, and excluding it from `getSchedulableByPress` is what stops the auto-scheduler
rewriting a manager's typed times inside that window. The `getConfirmedByPress` half still matters
for a different reason: a run whose PATCH *fails* stays `Planned` indefinitely and holds real press
time. Three verification steps that can be performed on the shipped app, the first already evidenced
live on PR-0085.

---

#### Tier 2 — Real work, no external blockers

##### E2.2 · Never swallow a failed timer write — ✅ DONE 2026-09-01
**File:** `index.html:1209` (`pushMethodFields`), called from :1866

No-ops when not live, `.catch(()=>{})` otherwise. A failed timer write is indistinguishable from a
successful one. Apply the treatment E4.3 already used elsewhere: no phantom saves, real reason
surfaced. Pairs with E2.1 but does **not** depend on it — E2.1 needs fields that do not exist yet.

**Landed 2026-09-01.**

**The literal fix was already in.** E4.3 had replaced the `.catch(()=>{})`: `pushMethodFields`
already called `canWriteNow()` and `writeFailed()`, and both raise a visible toast. This note was
stale. What was left is the thing the story is actually *named* for.

**A toast is the right alarm for a checklist tick and the wrong one for a timer.** The worker
re-ticks a box; nobody can retype how long a job took. The moment a timer write loses, the elapsed
seconds in that tab are the ONLY copy — and once the toast fades a tile reading 47:13 that never
reached Salesforce is indistinguishable from one that did.

**And the poll was actively destroying them.** `load()` runs every 15s and merged with
`Object.assign({}, st.timers, serverTimers)`, so the stale server value overwrote the unsaved local
one. The worker's time vanished with no trace at all. (The poll is suppressed while a drawer is
open — `index.html:941` — so this bites once the drawer is closed.)

What landed:

- `pushMethodFields` returns `Promise<boolean>` instead of `undefined`, so callers can react.
  Both its callers are timer paths; it has no other users.
- `noteTimerSave()` records a failed **or blocked** write per card+timer. Blocked (demo mode) counts:
  from the worker's side it is the same lie.
- The tile carries a standing red strip — *"Not saved to Salesforce — this time is only on this
  tablet. Press Stop again once the connection is back."* — and the readout turns warning-coloured,
  until a later write succeeds.
- `mergeServerTimers()` replaces the blanket `Object.assign`, protecting only flagged timers.

Verified end to end in a browser: demo mode blocks writes, so this is reachable **without an org**.
Before Stop, no strip; after Stop, the strip appears on the setup tile only, survives 6s (a toast
would not), the readout holds 22:00, and the production timer keeps running untouched. Plus 11 unit
tests on the extracted logic — including that the unsaved 47 minutes survive a poll where the old
`Object.assign` reverted them to 0, that protection is per-timer rather than per-card, and that a
flagged card no longer on the board doesn't throw.

**Not addressed (E2.1's, still blocked on E2.3):** a *running* timer is still page-only, so closing
the drawer and letting the poll run resets it. That needs `Timer_Started_At__c` / `Timer_Running__c`,
which exist in no org yet.

##### E5.7 · Shop hours computed in UTC — ✅ DONE 2026-09-01
**File:** `functions/api/_priority.js`

`setHours(0/7/16)` at runtime-local time. Workers run at UTC, so 07:00 UTC is about 02:00 Central.
Every suggested slot is off by the offset and the Sunday skip skips a *UTC* Sunday. Anchor to an
explicit shop timezone (`America/Chicago`), not the runtime's.

**Landed 2026-09-01.** `SHOP` now carries `timeZone: "America/Chicago"`, and every `setHours` /
`getDay` is gone, replaced by `Intl`-based `shopInstant()` / `shopDate()` / `shopParts()`.

**Measured rather than assumed**, in real workerd: `getTimezoneOffset()` is `0` and
`resolvedOptions().timeZone` is `"UTC"`, and `Intl` with an IANA zone works there and gets DST right
(2026-07-15T12:00Z → 07:00 CDT; 2026-01-15T12:00Z → 06:00 CST). There is no date library and no
build step here, so `Intl` is the only DST-correct tool available.

**`daysUntil()` had the same defect and is fixed too** — not in the note above, but the same bug.
It floored both ends onto UTC days, which roll at 7pm Chicago, so for the last five or six hours of
every working day each print date read one day closer than it was. That feeds `urgency()` and so the
score, and `suggestPlacement()`'s target day. ⚠️ **This is a behaviour change: evening scores and
suggested days will shift.** Fixing the hours but not the day boundary would have been half a fix.

`dayStart()` was left dead by the change and removed. `scoreOrder` / `suggestPlacement` /
`suggestSlot` / `packInto` / `daysUntil` gained an optional trailing `tz`, defaulting to
`SHOP.timeZone`; nothing in the app passes it and it exists so DST and rollover can be driven from a
test.

**The proof this is fixed** — same code, four runtime timezones:

| runtime TZ | OLD `julyOpenUTC` | NEW |
|---|---|---|
| UTC *(= production)* | `07:00Z` — 2am in Chicago | **`12:00Z`** |
| America/Chicago | `12:00Z` — correct | **`12:00Z`** |
| Asia/Tokyo | `2026-07-14T22:00Z` | **`12:00Z`** |
| Pacific/Kiritimati | `17:00Z` | **`12:00Z`** |

The old code was right *only* on a Central-time laptop, which is exactly why this survived — it
passes every local test and is wrong in production. 22 tests cover both DST regimes, both transition
weekends, the fully-booked day, sliding past an existing booking, the UTC-Sunday/shop-Saturday
boundary, and the evening day-rollover. Confirmed identical inside real workerd.

Not covered: `SHOP.startHour`/`endHour` remain hardcoded 7-16, and `shopHours` is still returned to
the client by `calendar/index.js:621` but no page reads it.

##### E5.10 · Composite requests exceed the 25-subrequest ceiling — ✅ DONE 2026-09-01
**Files:** `functions/api/shipments/combine.js` (:98–165), plus three more unguarded endpoints

`combine.js` builds one `compositeRequest` with `allOrNone: true` and no cap check. It emits 2N+2,
so twelve orders is 26 and Salesforce rejects the whole thing. Trap 3: `/composite` returns HTTP
200 even when every sub-request failed, and with `allOrNone:true` innocent sub-requests report
`PROCESSING_HALTED` — reporting the first failure in array order names a bystander. Chunk to 25 and
report the real failure.

Do S1 first, or you will be fixing a route that is not reachable.

**Landed 2026-09-01.** New shared module `functions/api/_composite.js`; `shipments/split.js`,
`shipments/combine.js` and `production-methods/index.js` rewritten onto it.

Three corrections to the note above, from reading the code rather than the roadmap:

- **Three endpoints were unguarded, not four.** `run-results` and `run-line-items` already chunk at
  `COMPOSITE_LIMIT = 25`, and `_rework.js` already had the head/tail split *and* a rollback.
- **`split.js` was the worse bug**, and it is not mentioned above at all. It emits
  1 leg + N items + 1 shipment (+1 package) **per box** — a 20-line order split into two boxes is 26.
  Combine needs twelve orders in one box to break; split breaks on an ordinary Tuesday.
- **The error reporting was already correct** in all five copies — every one already prefers the
  first non-`PROCESSING_HALTED` failure. Only the ceiling was ever missing.

Verified: 16 unit tests against the chunker (chunk sizes, cross-chunk `@{ref.id}` substitution,
refusal of an unresolvable reference, real-error-over-bystander selection, rollback delete ordering,
stranded-delete reporting). All three endpoints rebuild under wrangler and every validation path
still returns its own error. **The Salesforce-touching paths are untested** — there are no org
credentials locally — so a real split and a real combine on staging are still required.

##### E4.6 · Sweep unresolved `{{ }}` bindings — ✅ DONE 2026-09-01
An unresolved path renders empty and only logs. 34 `<sc-for>` loops inside `<select>` / `<table>`
depend on the boot-time `fetch(location.href)`; if it fails, every dropdown in the app is silently
empty forever. Make that failure visible rather than blank.

**Landed 2026-09-01 — and the note above is wrong in both halves. The real bug was worse.**

**1. Nothing depends on that fetch. It never runs.** `support.js:158` gates it on
`if (!window.__resources)`, and **E4.4 (2026-08-31, self-hosted React) sets `window.__resources` on
all nine pages** to redirect the unpkg URLs to `./vendor/`. So the boot refetch has been dead since
the day E4.4 shipped. There is no "if it fails" — there is no request.

**2. `<select>` is not affected.** Measured on raw source vs parsed DOM, per page: all 39 `<sc-for>`
inside `<select>` (index 13, pre-production 17, calendar 9) survive intact. Counts match exactly.

**3. `<table>` is, and it had already shipped.** The HTML parser only permits table-related elements
inside `<table>`, so it foster-parents `<sc-for>` out before any script runs. `parseDcDocument()`
adopts `dc.innerHTML` — the mangled DOM — so the runtime compiles a table with the loops removed.
`order-sheet.html`, raw source 2 `<sc-for>` inside `<table>` → parsed DOM **0**.

Reproduced in a browser against stubbed endpoints. The garment size breakdown rendered:

| | before | after |
|---|---|---|
| header cells | `["", "", "TOTAL"]` | `["", "S", "M", "L", "XL", "2XL", "TOTAL"]` |
| quantity row | `["QTY", "", "144"]` | `["QTY", "12", "40", "55", "28", "9", "144"]` |

**That is the sheet that goes to the press to say how many of each size to print, and it had no
sizes on it.** Total 144 pieces and no breakdown.

**Fix:** the grid is now `display:table` / `table-row` / `table-cell` on divs. Identical layout,
and the parser leaves custom elements alone because none of it is a table. `sc-for` renders as a
React Fragment (`walkFor` in support.js — checked, not assumed), so its children land directly in
the row with no anonymous cell box. `text-align` / `vertical-align` spelled out where `<th>`/`<td>`
got them free from the UA stylesheet. Verified visually as well as structurally.

`support.js` was NOT touched — it is generated and `dc-runtime/` is not in this repo, so it could
not be rebuilt even if it should be.

**Guard:** `tools/check-dc-templates.mjs` fails on any dc-runtime element inside a `<table>`.
Verified both ways — exit 1 against `origin/main`'s order-sheet naming both lines, exit 0 against the
fixed tree. **This belongs in E8.5's pre-deploy script**; it is a down payment on it.

Also added to `CLAUDE.md`'s "Editing a page" section, since the next person to write a table needs
it before they write it. ⚠️ `CLAUDE.md` is still **untracked and not on `origin/main`**.

**Left alone:** the generic "unresolved binding renders empty and only logs" behaviour
(`warnUnresolved` in support.js). Making that visible means changing the generated runtime, which
this repo cannot rebuild. The concrete damage it was cited for is fixed and now guarded.

##### E4.5 · Distinct loading / empty / error states on every board — ✅ DONE 2026-09-01
Each board needs the three states distinguishable, and the empty state must say what would put
something here. The centre overlay must stop blocking clicks for reads. This is the story that
makes E9.3's acceptance test possible.

**Landed 2026-09-01.**

**Every board computed its empty state as `count === 0` and nothing else.** So the FIRST PAINT of
every board — before a single row had arrived — stated the shop was empty, in exactly the words it
uses when that is true:

| board | what it said while still fetching |
|---|---|
| `shipping.html` | "Nothing in Post-Production for this view — the shop floor is caught up." |
| `calendar.html` | "everything is placed" · "every counted run is accounted for" · "everything has runway" · "0 orders in window" |
| `stats.html` | twelve KPI tiles reading **0** |
| `counting.html` | "No runs waiting to be counted — every printed run is accounted for." |
| `index.html` | "No orders — drag one here", in every column |
| `pre-production.html` | "Nothing in pre-production.", in every column |
| `station.html` | "All screens ready — board clear." / "All inks mixed — nothing waiting." |

That is not a missing spinner. It is the app making a confident, false statement about the shop.

New `listState(connection, count)` and `listNotice(state, emptyMsg)` in `ca-api.js` — one definition,
three states: **loading** (say nothing about the work), **error/demo** ("Could not reach Salesforce —
showing demo data. Do not work from these numbers."), **empty** (the board's own sentence saying what
would put something here). `listNotice` deliberately carries no copy for `empty`: only the board
knows, and a generic "nothing here" is what this story exists to remove. Numbers that cannot be stood
behind show an em dash — the treatment E5.9 already settled on for the Shipped·7d tile.

**The overlay half needed no work.** It has been opt-in since its 2026-08-20 second pass — navigation,
login and the env switch only. Saves, drawer opens, per-row edits, searches and polls are all silent
already.

Verified in a browser against a rig whose API succeeds *slowly* (7s) and returns nothing, so both the
loading and the genuinely-empty state are observable without an org:

- at 3.2s — all seven boards show "Connecting…", six show "Loading…", **zero false claims** and zero
  render errors
- after the API returns — each board shows its own empty copy, e.g. *"Nothing in Post-Production for
  this view. Orders arrive here once every production method on them is marked Completed."*
- the demo path was confirmed separately against the real (credential-less) endpoints: the notice
  reads "Could not reach Salesforce — showing demo data" rather than "the shop floor is caught up"

Two bugs the testing caught, both mine: a `listState` const inserted inside `pool.map`'s callback
instead of `renderVals` (counting.html rendered "listState is not defined" — reverted the file and
re-applied), and an early false pass on calendar that turned out to be a stale iframe. Worth the rig.

`index.html`, `pre-production.html` and `station.html` are CRLF and stay CRLF.

##### E9.4 + E10.2 · Contrast tokens — ✅ BOTH DONE 2026-09-01
No shared stylesheet exists; every page repeats a base `<style>` and inline literals, so the same
colour is fixed once per board or not at all. `calendar.html:19` warns against refactoring one board
alone. Failing pairs: `#4d483f` on `#08080A` ≈ 2.2:1, `#6C665C` ≈ 3.5:1, and `calendar.html`'s
"nothing scheduled" at `#232327` on `#0A0A0C` ≈ 1.1:1 — effectively invisible. Fix once in the
shared token set. Final sign-off happens under real shop lights, not a contrast checker.

**E10.2 landed 2026-09-01. The shared token set now exists, so E9.4 is a one-file change.**

`tokens.css`, linked from every page's real `<head>` before `support.js` (not `<helmet>`, which is
hoisted at runtime and would paint unstyled first). It carries the base chrome that was duplicated
in seven to nine pages — reset, body, links, scrollbars, `ca-shake` / `ca-slide-left` — and the
palette as CSS custom properties. 252 conversions: 206 inline `color:` uses, 46 JS style literals.

**Tokens are named by ROLE, not by value, and `#232327` is why.** It is a border 108 times and text
exactly once — calendar's "nothing scheduled". A value-named token would force those to move
together and E9.4 could not fix the text without wrecking every border. `--border-subtle` and
`--text-ghost` are therefore separate tokens that happen to share a value today.

**What E9.4 does now:** edit three lines in `tokens.css` — `--text-muted`, `--text-faint`,
`--text-ghost`. They are flagged in the file with their measured ratios. Do **not** raise
`--border-subtle` to match `--text-ghost`; borders are decoration and are not held to a text ratio.

Two things deliberately still literal hex: **Chart.js config in `stats.html`** (canvas cannot
resolve a custom property — the two `ticks.color` values), and any hex compared as a string. A
quoted `color:'#…'` is JavaScript; an unquoted `color:#…` is a style attribute. The conversion regex
used that distinction, and a `(?<![-\w])` lookbehind so `background-color:` was never eaten.

Verified in a browser: all nine pages render with no errors, tokens resolve, `order-sheet.html`
keeps its own print-sheet grey (page `<style>` still wins, being parsed after), and **overriding
`--text-muted` and `--text-faint` at runtime moved all 66 affected elements with zero left on the
old value.** That is the E9.4 unblock demonstrated, not assumed.

calendar.html's standing warning — *"Do not 'tidy' this into variables unless the other five boards
move at the same time"* — is satisfied and rewritten; so is its "there is no shared stylesheet to
inherit from" docblock.

---

**E9.4 landed 2026-09-01.** All 14 text/surface pairs clear 4.5:1; `node tools/contrast.mjs` checks
it and exits 1 on a regression.

**Two corrections to the story.**

1. **The ratios were worse than stated, because cards are lighter than the page.** The note measured
   against `--surface-page` `#08080A`. Much of this text sits on `--surface-card` `#121215`, where
   muted was **3.29:1** (not 3.5) and faint **2.06:1** (not 2.2). Every token is now solved against
   the worst surface it actually appears on.
2. **The whole ramp had to move, not just the three failing tokens.** `--text-tertiary` was 4.98:1 —
   passing, but barely. Raising `--text-muted` to clear 4.5 would have put it *lighter than
   tertiary* and inverted the hierarchy; fitting muted and faint into the 4.5–4.98 gap instead made
   three tiers indistinguishable from each other. You cannot have five separable greys above 4.5:1
   on a near-black background. Re-spaced upward: L\* steps of 19.3 / 9.0 / 7.0 / 4.6.

That meant tokenising `#9C978C` → `--text-secondary` and `#8a8378` → `--text-tertiary` as well —
**291 conversions E10.2 had left as literals**, because it only converted the two failing values.
Without that step the new token values would have had no effect at all: the upper tiers were defined
but referenced zero times.

**`order-sheet.html` is deliberately excluded.** It prints on cream `#f2ede6`, where the dark-board
ramp runs backwards — lightening its text takes contrast from 3.22:1 down to 2.35:1. Its two
substitutions were reverted and it keeps its own literals. (Separate finding, not fixed here: the
printed sheet's own 3.22:1 is itself under AA. That is ink on paper, a different judgement from
tablets under shop lights, and it should be its own story.)

Chart.js tick colours in `stats.html` remain literal — canvas cannot resolve a custom property.

Verified across all nine pages: no render errors, tokens resolve, and **zero elements still painted
on any of the three old failing colours**.

⚠️ **AA is the floor, not the sign-off.** These are computed ratios on a desk monitor. The real test
is a tablet at arm's length under shop lights — and it is now one line per token to tune.

##### E3.4 · Size breakdown wrong on large orders — ✅ DONE 2026-09-01
**File:** `functions/api/inbox/index.js`

The nested OrderItems subquery pages at 200 rows and `runQuery` follows only the top-level locator.
A 400-line order shows a wrong breakdown **with no error**. Follow the nested locator.

**Landed 2026-09-01** — but *not* by following the nested locator.

The nested subquery is removed entirely. Line items now come from a flat
`SELECT ... FROM OrderItem WHERE OrderId IN (...)` follow-up, which has only top-level pagination —
exactly what `runQuery` already follows correctly. Chasing per-record `nextRecordsUrl` locators would
have added a second pagination mechanism to maintain and left the nested shape in place to trip over
again; this way the cap disappears rather than moving.

It is also the pattern the neighbours already use for this exact data — `orders/index.js:212` and
`production-orders/index.js:224`, the latter with a comment explaining the same reasoning.
**A sweep confirmed the inbox held the last real nested subquery in the API.**

- **The IN list is chunked at 200 Ids.** An unbounded IN list would have traded a silent truncation
  for a silent 414 — the calendar endpoint already hits that ceiling around 700-800 Ids (E5.12), and
  the inbox is unbounded in principle.
- **A failed item fetch fails open**, matching `orders/index.js`: the inbox's job is listing orders
  that need a method, and losing a size preview must not empty the board. But it sets
  `OrderItemsError` on the records, because an empty breakdown that is really a failed fetch is the
  same "wrong number, no error" shape this story exists to remove. Nothing reads that flag yet.

Verified: 18 tests driving the real handler against a stubbed Salesforce — a 400-line order returns
all 400 items and totals 400 rather than 200; the output shape is exactly the `rec.OrderItems.records`
that `CAApi.pivotItems` reads; items group to the right order with no cross-contamination; an order
with no items is present-but-empty and NOT flagged; 450 orders produce 3 chunked queries with no
chunk over 200 Ids; a failed fetch still returns the inbox but flags it; and no query contains a
nested subquery any more. Compiles and serves under wrangler.

**Not verified:** the real query against a live org.

##### E5.12 · Unbounded IN lists on the calendar endpoint — ✅ DONE 2026-09-01
The GET `/query` URL exceeds Salesforce's limit somewhere around 700–800 Ids, and the endpoint
accepts an arbitrary from/to. Chunk or bound the range.

**Landed 2026-09-01.** Both — they defend different things: chunking is correctness, the bound is
resource.

**There were FOUR unbounded IN lists, not one:** runs by method (`PrintMethod__c`), the OrderItem
quantity roll-up, `Proposed_Run__c`, and `Pre_Production_Item__c`. All four now go through a new
shared `runChunkedIdQuery()` in `_sf.js`, 200 Ids per chunk. It takes a *callback* receiving the
quoted list rather than a SOQL string, which is what lets it serve both `runQuery` and
`runQueryOptionalField` — their signatures differ.

**The runs query needed splitting, not chunking.** It was
`(Scheduled_Start__c BETWEEN ...) OR PrintMethod__c IN (...)`, and chunking an `A OR B IN (...)`
re-runs the A half on every chunk, so the range rows come back once per chunk. It is now one range
query plus chunked method queries, merged through a `Map` keyed on run Id. Deliberately one code
path rather than keeping the old single query for the small case — the rare branch is always the
untested one, and with no method Ids it is just the range query as before.

**And this would have failed invisibly.** An over-long query URL is an HTTP-level rejection, not a
SOQL error, so the whole `try` block fell into its `catch` and the calendar rendered with **no runs
at all** and nothing on screen to say why.

- **Window capped** at `MAX_RANGE_DAYS = 366`, clamped rather than rejected and reported back in
  `window.clamped`. `calendar.html` never asks for more than 6 days (`windowDays()`); the server
  default is 56. The cap only exists for a hand-typed URL.
- **`to` before `from`** now returns `to_before_from` (400) instead of quietly matching nothing and
  reading as an empty shop.
- **`inbox/index.js` converted** off the chunk loop E3.4 gave it onto the shared helper, so there is
  one definition rather than two. Its 18 tests were re-run against the refactor — green, and now
  exercising the *real* helper rather than a copy.

Verified: 13 tests on the calendar endpoint against a stubbed Salesforce (clamping, the 400, chunk
counts and sizes, no surviving `OR` form, dedupe of a run matching both halves, and that an
out-of-range run still arrives via its method) plus 10 on the helper itself (chunk boundaries at
exactly 200/201, quoting, empty/null, short-circuit on failure returning partial records with
`ok:false`, apostrophe escaping). Compiles under wrangler; `to_before_from` confirmed live.

One caught in testing worth recording: the first stub answered the method query with the *range*
query's rows, because `/Scheduled_Start__c/` matches the SELECT list as well as the WHERE. The test
failed, the production code was fine. Match on the WHERE clause when faking these.

**Not verified:** the real queries against a live org.

##### E8.5 · Pre-deploy smoke script — ✅ DONE 2026-09-01
Under ten minutes, committed to the repo. Must include a pre-push check that `git status` is clean
of untracked files that are imported — `_placements.js` nearly shipped missing, and S1 above is the
same failure one level subtler. **Have it fail on an extensionless file under `functions/`.**

**Landed 2026-09-01.** `node tools/smoke.mjs` — **2.4 seconds**, no network, exits 1 on failure.

Seven checks. Every one is an incident this project actually had, not generic linting:

| check | the incident |
|---|---|
| referenced asset exists **and is committed** | `tokens.css` linked by nine pages, never added — site down; then pushed as `token.css`, one letter off — still down |
| no extensionless file under `functions/` | S1: `shipments/combine` + `split` — both endpoints answering 405 with an empty body |
| relative imports resolve and are committed | `_placements.js` nearly shipped untracked with four importers |
| server modules parse | 53 files |
| board logic parses | caught a real `const`-in-wrong-scope break during E4.5 that took the counting screen down |
| no dc-runtime elements inside `<table>` | E4.6 — delegated to `check-dc-templates.mjs` |
| text tokens meet contrast | E9.4 — delegated to `contrast.mjs` |

**"…and is committed" is the load-bearing half.** Existing on the author's disk is not the same as
existing in the deployment, and a `??` in `git status` is the only difference. Both `tokens.css`
outages passed a file-exists check on the machine that made them.

**Verified by replaying all eight failure modes** in a throwaway worktree — each was reconstructed,
the script run against it, and every one failed the run. **8 caught, 0 missed**, and the untouched
tree passes clean. Re-do that if you change a check: a smoke script that only ever passes is worse
than none, because it gets trusted.

Untracked files with broken imports **warn** rather than fail — that surfaces
`functions/api/_to_delete/vendors/index.js` importing a `../_sf.js` that isn't there, which silently
breaks `npx wrangler pages dev .` (the only local verification this project has) without blocking a
push over dead code that cannot reach the deploy.

Install as a hook — hooks are not tracked, so each clone opts in:

```
printf '#!/bin/sh\nexec node tools/smoke.mjs\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

**A green run means the deployment is well-formed, not that it works.** It never talks to Salesforce,
so it cannot tell you a SOQL change is wrong. Every board still falls back to demo data — check the
network tab, not the screen.

---

#### Tier 3 — Code is ready, but answer the question first

| Id | Blocked on | Question |
|---|---|---|
| **E2.1** | **E2.3** | Timer persistence needs `Timer_Started_At__c` / `Timer_Running__c` on `Production_Method__c`. The fields do not exist in any org yet. Do not write code against them until they do. |
| **E1.4** | Anthony | The story as written asks for produced quantities pre-filled with planned — decision **D1** removed the produced field on purpose. Rewrite as "timer stop routes the operator to the counting screen for that run", or cancel it and let `counting.html` be the answer. |
| **E5.8** | Anthony | `Production_Priority__c` is never written. `_priority-rollup.js` exports two functions no route imports, despite its own header saying otherwise. Wire it, or delete it and remove the field from every sort. Either way, record the decision. |
| **E6.5 / E6.6 / E6.8** | **E6.4** | Access control. E6.4 — is Cloudflare Access actually switched on? — is unanswered, and until it is, every access control in the app is attribution, not authorization. See the two traps below before touching enforcement. |

##### Two traps that must be cleared before `ACCESS_ENFORCE=1`

1. **`results.submit` appears in exactly one place in the codebase — the check itself.** It is not
   in `DEFAULT_MANAGER_CAPS`, and workers derive no capabilities. Turning enforcement on would leave
   only Anthony able to record production results. Grant it first.
2. **`confirmManager()` confirms via `POST /api/worker-login`, which also issues the signed
   `ca_sess` cookie.** A successful manager confirmation therefore leaves that tablet's server
   session as that manager. Inert while `requireCap` is report-only. Needs an answer before
   enforcement.

Current state, confirmed by grep: **4** route files call `requireCap`, against **24** files with
POST/PATCH/DELETE handlers. `verifyStationToken` (`functions/api/_station.js:84`) has **zero
callers** — it reads as active protection and is not.

Run report-only for at least five working days and read every `[access] would deny` line before
flipping the flag.

---

#### Not Claude Code's

Listed so nothing is picked up twice.

- **Anthony / ops:** E6.4 (Cloudflare Access), E7.5 (production env config), and every product
  decision — including the open one on cleared allocation rows.
- **Peter Larson:** E7.2 (Apex test classes — the long pole on the whole project, start now),
  E7.4 (metadata promotion).
- **This Claude project, via Salesforce in Chrome:** E7.1 staging half, E7.3, E7.6, E7.7, E7.8,
  E2.3 field + FLS verification, and running the E8 checklists against a real org.
- **Anthony + shop floor:** E9.1, E9.2, E9.3, E9.6, E9.7, E9.8 — tablets, connectivity, soak,
  guides, pilot.

~~Staging is currently unreachable from browser automation.~~ **Corrected 2026-09-04 — staging is
reachable, no permission grant needed. See §6 and §9.** The staging pass is not blocked.


---

#### E7.6 (app half) · Never prefill a Scheduled End that is not after the Scheduled Start

**✅ DONE 2026-09-02**, branch `feat/e7.6-run-end-floor`, unpushed. Anthony shipped the formula fix the same day, so the guard below is already a floor that rarely fires rather than a workaround. Both call sites go through one `runFormWindow()` in `ca-api.js`; `runDurationHours()`'s comment corrected. Verified end-to-end in a browser on both boards.

**Added 2026-09-02. Ready to build — the decision is made and the Salesforce half is independent.**

**Background, verified in dev2.** `Order.Print_End_Date_Time__c` is a formula:

```
IF( ISBLANK(Duration__c), Print_Date__c +(2/24), Print_Date__c +(Duration__c/24))
```

Because the formula returns **Date/Time**, Salesforce does not offer the "treat blank fields as
zeroes / as blanks" option (confirmed by opening the formula editor — no such radio group) and
defaults to **treating blank number fields as zeroes**. `Duration__c` is coerced to `0` before
`ISBLANK` sees it, `ISBLANK(0)` is false, and evaluation **always** takes the second branch:
`Print_Date__c + (0/24)` = `Print_Date__c`. The 2-hour branch has never executed since the field was
created on 12 Jan 2023.

Live dev2: **15 of 20 scheduled orders (75%) have an end time exactly equal to their start time.**
The 5 with a duration set (1, 3, 4, 4.5) compute correctly — decimals survive, that is not the bug.

**Peter owns the formula fix** (`IF( Duration__c > 0, ... , Print_Date__c + (2/24) )`). **This story
is the app half and does not wait on it** — the app should never have trusted the value unguarded.

##### ✅ D6 — DECIDED 2026-09-02 by Anthony: prefill **start + 2 hours**

When the order's end time is missing, equal to, or before the start, `openRunCreate()` seeds
Scheduled End as **Scheduled Start + 2 hours**. Chosen because `runDurationHours()` in `_priority.js`
already reserves exactly 2 hours for these orders — this makes the form and the scheduler agree
instead of one saying 0h and the other 2h.

##### What to change

1. **`index.html` → `openRunCreate()`** (and the matching path in `pre-production.html` if it has
   one). Today it pipes `printEndDateTime` straight into `endDate`/`endTime` via `splitDT()`.
   Guard it: if the end is absent, equal to, or before the start, use **start + 2h**.
2. **`functions/api/_priority.js` → `runDurationHours()`.** Its comment says 2 hours is *"the same
   default `Print_End_Date_Time__c` already uses when `Duration__c` is blank."* **That is false** —
   the formula yields a 0-hour span. Correct the comment; the 2-hour behaviour itself is right and
   is now what D6 aligns the form to.

##### Notes

- **Do not compensate in the app for the formula bug.** Once Peter ships the formula fix these orders
  start returning a real +2h end, and this guard should quietly stop firing. It is a floor, not a
  correction — if you find yourself adding 2 hours to a value that already has them, the guard is
  in the wrong place.
- Equal start and end currently **passes** server validation — `production-runs/index.js` rejects
  only `end < start`, and equal is not less-than. So this is not caught downstream today.
- Verify against a real zero-gap order: `801ca00000T4m0aAAB` (order `00013478`, Print Date
  2026-08-19 12:15 UTC, `Duration__c` blank).

---

#### B1 · Adopt pasted mockups into Salesforce, once, on first use

**✅ DONE 2026-09-02**, branch `feat/b1-adopt-mockups`, unpushed. Both halves built and verified against a fake Salesforce (all ten cases in *Verifying it* below). **Still needs Anthony:** the FLS grant flagged under *Salesforce write path* is NOT done — until it is, adoption no-ops safely and every mockup keeps rendering through branch B. Also note the header change: with `ALLOWED_MOCKUP_HOSTS` gone this endpoint is an open image proxy for public hosts, and E6.4 is the control that matters.

**Spec written 2026-09-02. Decision D8 made; ready to build. No ops step — no bucket, no binding.**

##### Background, verified

`Order → Design__c.Mockup_URL__c` is documented as a Vault link but in practice holds whatever
someone pasted. Measured across both sandboxes: **zero orders have ever used the Vault flow.** In
dev2, 38 of 54 mockups are blocked; in staging the five most recent orders returned one
`gstatic.com` thumbnail, one `freepngimg.com` link and **three blank**.

`mockup-proxy/index.js` has two branches. **A** takes a ContentVersion Id (`ID_RE` requires the
`068` prefix) and fetches it through `sfFetch` with our own OAuth session — no allowlist, always
works. **B** direct-fetches an external URL and is guarded by `ALLOWED_MOCKUP_HOSTS`.

##### ✅ D8 — adopt into Salesforce, lazily

**On the first request for an uncached external mockup:** fetch it once, save it as a file on the
Design record, rewrite `Mockup_URL__c` to the Salesforce servlet URL, and serve the bytes. Every
subsequent request takes **branch A** and needs no allowlist.

This does not build a cache alongside the problem — **it converts the data into the shape the
system already documents.** After it runs, `Mockup_URL__c` holds what `_mockup.js` always said it
held, and the fix is permanent per order rather than per host.

##### 🔒 Security — read before writing code

**Caching does not remove the SSRF risk, it relocates it.** E6.2 closed a hole where the server
would fetch any caller-supplied URL. This story still fetches arbitrary URLs server-side.

- **Keep every branch-B protection except the host allowlist:** literal IPs and
  loopback/private/link-local/CGNAT ranges refused; `.local`/`.internal`/`localhost` refused;
  redirects followed **manually**, capped, and **every hop re-validated**; GET only; no credentials
  or caller headers forwarded.
- **Only the host allowlist comes off, and only on the adopt path.** If a URL still fails the IP and
  scheme checks, it fails — no adoption, no fetch.
- **Add a size cap and a timeout.** Neither exists today because the allowlist made them less
  urgent. A mockup is a few hundred KB; refuse anything absurd rather than streaming it into
  Salesforce.
- The URL is not attacker-supplied in the usual sense — it comes from a Salesforce record written by
  authenticated staff — but that is a reason for care, not a reason to skip it.

##### ⚠️ A GET that writes

This makes a read endpoint mutate, which brings the usual hazards: retries, prefetch, two tablets
opening the same board at once.

- **Make adoption idempotent.** Re-check `Mockup_URL__c` immediately before the write; if it already
  holds a `068` Id, another request won already — serve and stop.
- **Never overwrite an existing Vault URL.** Adopt only when the value is an external branch-B link.
- **A failed fetch must not touch the field.** Leave the pasted link exactly as it is, serve the
  existing failure shape, and log the reason. A half-adopted record is worse than an unadopted one.
- Consider a short in-flight guard so two simultaneous first-views don't both upload.

##### Salesforce write path

`POST /sobjects/ContentVersion` with `Title`, `PathOnClient`, base64 `VersionData`, and
`FirstPublishLocationId` = the Design record Id, then `PATCH` `Design__c.Mockup_URL__c` to
`<instance_url>/sfc/servlet.shepherd/version/download/<ContentVersionId>`.

📌 **FLS is the trap here** (trap 1). The integration user needs **create** on `ContentVersion` and
**update** on `Design__c.Mockup_URL__c`, **in every org**. Verify before shipping — and note this
endpoint currently only reads, so it has never needed write permission on anything. Expect to add it.
Follow the house rule: **allow-list the field being written**, never a caller-supplied name.

##### Also in this story — "no mockup" ≠ "mockup we could not fetch"

3 of 5 recent staging orders have **no** `Mockup_URL__c`. That is normal and should look calm. A
mockup that exists but failed to load is a **fault** and should look different. They render
identically today. E4.5 did this for boards; the card thumbnail needs the same treatment.

##### Verifying it

- First view of an order with a pasted link: image renders, and `Mockup_URL__c` in Salesforce now
  holds a `068…` servlet URL.
- Second view: `/api/mockup-proxy` takes branch A — confirm no outbound request to the original host.
- An order whose pasted link is dead: image fails, **`Mockup_URL__c` is unchanged**, reason logged.
- An order already on a Vault URL: untouched.
- A URL resolving to a private IP: refused, nothing written.
- Re-run the dev2 census afterwards — the blocked count should fall as orders get viewed, and never
  rise.

---

#### B4a · Show what the other placements on this method already found — ✅ DONE 2026-09-03

**Branch `feat/b4-placement-siblings`, commit `d58daa9` — and now ✅ ON `origin/main`**, re-applied through the GitHub UI as `d7a6c81` (`counting.html`) and `8a98d12` (`run-results/index.js`). Two files:
`counting.html` (+84) and `functions/api/run-results/index.js` (+28/−3).

**Why it existed.** The Salesforce skeleton Flow became placement-aware in dev2 on 2026-09-03 (see
**B4** in `ROADMAP.md`), so a Front+Back method now has one run per placement, each with its own
line items and its own misprint/damaged counts. `counting.html`'s B3 sibling panel built its set as

```js
.filter(x => x.orderId===openRun.orderId && x.methodId && x.methodId!==openRun.methodId)
```

— same-method runs excluded by construction. So counting the Back run said nothing about what Front
had already recorded, on the one screen where that matters.

**What shipped.** The existing `sibs` set is untouched: the make-up banner and the "Also on this
order · <method>" label are about OTHER methods and their wording depends on it. A second, separate
set covers other runs on the SAME method, and renders a read-only line per placement plus the
order's running total.

📌 **DISPLAYED, NEVER WRITTEN — D5 still holds, and placement-awareness made it sharper.** Before
this change the second placement's run had no line items to write onto; now it has a full set, so
copying one placement's misprints onto another's rows would be live double-counting. Front's 6 plus
Back's 3 is **9** blanks, not 12: `_rework.js` already sums damaged + misprint per Order Product
across every line item on the order, and its header was written about precisely this — *"a shirt
damaged during back-printing on a two-method order would be counted once per method and you would
order two blanks to replace one garment."* Nothing added here feeds `this.totals()` or the submit
payload.

⚠️ **The endpoint change is the risky half.** The run's placement was not in `/api/run-results`, and
it is fetched through **`runQueryOptionalField`**, NOT by adding `Print_Location__c` to
`RUN_RESULT_FIELDS`. That group is deliberately all-or-nothing — the header comment on
`run-results/index.js` names `Print_Location__c` as the one field that should degrade instead —
and trap 1 says an FLS-hidden field inside a plain SELECT fails the whole query and empties the
board rather than losing one column.

⛔ **Not yet measured:** the summed reprint. Run `GET /api/rework-check?orderNumber=…` against a
Front+Back job with misprints on both passes and compare the figure to what was recorded. Until
then "6 + 3 = 9" is a reading of the code, not a result.

---

#### B5 · Route straight to the make-up run after a submit with incomplete — ✅ DONE 2026-09-03

**On `origin/main`.** `counting.html` +63/−4 (`fe9555f`), `ca-api.js` +43/−1 (`bd20808`),
`production-runs/index.js` +84/−2 (`0d3a1ea`), plus `index.html` (`ce630ae`),
`pre-production.html` (`b1a398f`) and `calendar.html` (`fc20c2d`).

**Destination deliberately unchanged.** The existing `index.html?card=<methodId>&makeup=<qty>` deep
link, which `applyDeepLink()` already resolves to the right method and pre-fills with the shortfall
quantity. **Not `calendar.html`** — that was this destination until 2026-08-27 and was replaced
because it *"dropped the manager on a cold week grid with nothing selected and no way to act."* The
reasoning is in the comment above `applyDeepLink()`; read it before anyone proposes the calendar
again.

**The endpoint was the substantive half** (+84 lines): a make-up run is booked against a method that
has already finished, which the run-create path did not previously expect.

⚠️ **It shipped with a dead end — see B6b.** The navigation was verified; the screen it navigates
*to* was not, and on a Post-Production method that drawer had no run form in it.

---

#### B6 · Reprints into the Management inbox — ✅ DONE 2026-09-03

**On `origin/main`.** `inbox/index.js` +123/−2 (`3132b1b`), `pre-production.html` +59/−6
(`8836556`), `ca-api.js` +12/−1 (`bcd117a`). Full write-up in `ROADMAP.md` under **B6**.

Three things worth carrying forward from how it was built:

1. **The reprint lookup is a separate query, kept out of the main one.** The inbox's single query is
   what the whole screen depends on; an edge case does not get to put it at risk.
2. **`Misprint__c` is selected unconditionally, and that was *checked*, not assumed** — the field is
   already read as `Order__r.Misprint__c` elsewhere and by `pre-production.html`'s `isReprint`. Trap
   1 says an FLS-hidden field is a parse error returning zero rows, which here would read as "no
   reprints to route today", so the bar for skipping `runQueryOptionalField` is evidence.
3. **A reprint appears in BOTH the inbox and the pre-production board on purpose.** It still needs
   blanks and prep, which is the board's job; scheduling is the inbox's. It leaves the inbox once a
   run exists.

---

#### B6b · Post-Production can book a make-up run — ✅ DONE 2026-09-03, UNPUSHED

**Branch `fix/b6b-postprod-new-run`, commit `ee19fc6`, `index.html` +21/−1.**

The drawer's collapse used to end after Production Runs, correct while Post-Production meant the
printing was finished for good. B5 and B6 changed that, and `stopTimer()` puts a method into
Post-Production the moment its last run ends — so the status a make-up run is most likely to be
booked from was the only status with no button to book it, and B5's deep link opened a drawer with
no form. Only the runs section comes out of the collapse.

📌 **The transferable lesson:** B5 was verified by exercising the navigation, not the destination.
Follow the link to where it lands.

---

#### B7 stage 1 · Setup / production time on the method cards — READY TO BUILD

**Blocked half is stage 2 only.** Stage 1 has no blocker. Full story in `ROADMAP.md` under **B7**.

**Files:** `index.html`, `pre-production.html`.

**What to show.** On the method card: **Ready for Print → `Print_Setup_Timer__c`**, **In Production
→ `Production_Timer__c`**. One figure, chosen by status.

📌 **No run-selection logic.** The clocks are per METHOD, not per run — `index.html`'s own comment
above `runsInOrder()` says switching runs "does not switch clocks", it re-points which run's actual
start/end the next Start/Stop stamps. `selectedRunId()` is irrelevant to this story; do not wire it in.

📌 **No new SOQL and no new fields.** Both figures already come back in `production-orders`' SELECT
and are already on the client — E2.5 established exactly this when it built the Actual vs Scheduled
panel. Adding a field to that SELECT is trap 1 territory; there is no need to go near it.

⚠️ **THE WHOLE RISK IS THAT THIS LOOKS LIVE WHEN IT IS NOT.** The server holds elapsed seconds as of
the last Pause or Stop, and nothing about whether a clock is running right now — `startedAt` lives
on the tablet (B2 step 1, `localStorage`). So a card showing `Setup 00:42:15` that has not moved in
an hour is the same defect as a board full of demo data: plausible, wrong, and acted on. The figure
must read as **stored**, not live — label it, or carry when it was saved. Get this wrong and the
feature is worse than not having it.

**Also handle:** a method with no time recorded yet (blank is not zero — the codebase's rule is that
blank means nobody decided), and demo mode.

**Stage 2, do NOT attempt:** making it tick needs `Timer_Started_At__c` / `Timer_Running__c` on
`Production_Method__c`, which exist in no org — that is **E2.3**. Stage 2 is a second hand on this
same display, not a redesign, so leave room for it and change nothing else.

**Verify in a browser:** a method in Ready for Print shows setup and not production; one In
Production shows production; a method with no recorded time shows the blank state rather than
`00:00`; demo mode renders without pretending. Check the network tab, not the screen.

⚠️ **BEFORE SWITCHING OR CREATING A BRANCH:** `ROADMAP.md` and `CLAUDE-CODE-QUEUE.md` exist only as
uncommitted working-tree files on top of `origin/main`. A branch cut from `origin/main` silently
replaces them with stale committed copies — this has already cost work twice. Copy both outside the
repo first and restore after.

One commit with the Asana id, do not push. Run `node tools/smoke.mjs` before finishing.

---

## 8. Validation
**Written, not yet run.** Writing them was the artifact; running them is the validation. Both carry their own run logs — fill them in with date, org and result.
### E8.1 · Integration validation checklist

**Written 2026-09-02.** Run this in full against an environment before trusting it. Companion to
`VALIDATION-SCENARIOS.md` (E8.2): this file checks that each *seam* works; that one walks a real
order through the whole system.

Read `CLAUDE.md` first. Several checks below exist because a trap in it has already fired.

##### How to run it

**One rule governs every item: an item passes only when the named Salesforce record holds the named
value.** "The board looked right" is not a pass and never has been. Every board in this app falls
back to demo data with an amber chip when its fetch fails, so a broken query renders as a working
page full of plausible fake numbers. **Check the network tab, not the screen** — and where an item
names a record, open the record.

Record every run in the log. A checklist with no dated result is a checklist nobody ran.

| Date | Org | Run by | Result | Notes |
|---|---|---|---|---|
| | | | | |

Mark each item **PASS**, **FAIL**, or **N/A** with a reason. A skipped item is a FAIL until someone
writes down why it was skipped.

---

##### The surfaces

The roadmap says seven. Walking the code, there are **eight** — access and identity is the one that
tends not to get counted, because E6.4 owns the perimeter question. It belongs here too: it is a
seam between this app and something it does not control, and it is the seam that is currently open.

| # | Surface | Depends on |
|---|---|---|
| 1 | Salesforce auth and query layer | OAuth Client Credentials, the run-as user's FLS |
| 2 | Org switching | KV `sf_env:active`, three `SF_ENV_*` credential sets |
| 3 | Zenkraft shipping | Zenkraft, `SF_ZK_ORDER_FIELD_ID_<ENV>` |
| 4 | Shop calendar Event publishing | Apex `ProductionEventPublisher`, `Production_Calendar_Setting__c` |
| 5 | Auto-scheduler coexistence | Apex `ProductionAutoSchedulerService` / `Selector` |
| 6 | Line-item skeleton | Flow `Production_Run_Generate_Line_Item_Skeleton` |
| 7 | Mockup delivery | Salesforce ContentVersion, external image hosts |
| 8 | Access and identity | Cloudflare Access, `WORKER_PINS`, `ca_sess`, `requireCap` |

---

##### 1 · Salesforce auth and query layer

The foundation. When this is wrong, everything above it shows demo data and looks fine.

- [ ] **1.1 — The deployment points at the intended org.** `GET /api/admin/sf-env` returns
      `active` equal to the org under test. *Expected: the `active` key matches, and its entry has
      `configured: true`.*
- [ ] **1.2 — No board is on demo data.** Load all nine pages. *Expected: no amber "Demo data" chip
      anywhere, and in the network tab every `/api/*` response is `content-type: application/json`.*
      ⚠️ A missing route returns **HTTP 200 with the SPA's HTML**, not a 404 — so a JSON content-type
      is the check, never the status code.
- [ ] **1.3 — Every SELECT's fields are visible to the integration profile.** *Expected: no response
      body contains `No such column`.* Trap 1: an FLS-hidden field fails the **entire** SELECT with
      wording identical to a genuinely missing field, and empties the whole board rather than losing
      one value. Only the field named after the `^` is the offender.
- [ ] **1.4 — Pagination is followed past 2000 rows.** On the largest list in the org, compare the
      app's count with a `SELECT COUNT()` in the Developer Console. *Expected: identical.* Reading
      `data.records` off the first response silently truncates at 2000.
- [ ] **1.5 — Formula fields render as text, not markup.** Look at any order number on any board.
      *Expected: `18171-15`, never `<a href="/801…">18171-15</a>`.* Trap 6 — this has shipped twice.
- [ ] **1.6 — Nested subqueries are not truncated.** On an order with more than 200 OrderItems,
      compare the size breakdown with the order in Salesforce. *Expected: identical totals.* The
      nested locator is separate from the top-level one (E3.4).

##### 2 · Org switching

One deployment, three orgs, switched at runtime from KV. **The switch is global** — it changes the
org for every user and every tablet at once. Never exercise this during a shift.

- [ ] **2.1 — The switch takes effect.** Switch org, reload. *Expected: `/api/admin/sf-env` reports
      the new `active` key, and the boards show that org's orders.*
- [ ] **2.2 — The switch back works.** Switch back to the previous org. *Expected: the original data
      returns intact.* **This is the rollback path — an untested rollback is not a rollback.**
- [ ] **2.3 — Every configured env has credentials.** *Expected: each entry the switcher offers
      reports `configured: true`.* Production is deliberately unconfigured until E7.5.
- [ ] **2.4 — The switcher is unreachable for non-admins**, including by direct URL (E9.5). Verify
      only after `ACCESS_ENFORCE=1`; until then this is report-only and will pass misleadingly.

##### 3 · Zenkraft shipping

Least-exercised board. No manual retry; it polls every 6s for up to four minutes.

- [ ] **3.1 — The wizard URL resolves.** *Expected: the Zenkraft wizard opens on the right order.*
      `SF_ZK_ORDER_FIELD_ID_<ENV>` is a **per-org metadata Id and does not migrate with a change
      set** — it must be set per environment.
- [ ] **3.2 — A real shipment marks the label.** Print a label through the wizard. *Expected: the
      Order's `Shipping_Label_Printed__c` = **true**, and a Shipment record exists.*
- [ ] **3.3 — Ship Now on an order that already has shipments does NOT mark the label.** Open such
      an order and tap Ship Now, then close the wizard without printing. *Expected:
      `Shipping_Label_Printed__c` is **unchanged**.* This is the E5.6 regression — it only bites on
      re-ships, second boxes and splits.
- [ ] **3.4 — A failed poll does not read as success.** *Expected: an explicit error state, never a
      silent "no shipments".*

##### 4 · Shop calendar Event publishing

- [ ] **4.1 — `Production_Calendar_Setting__c` has a record.** *Expected: at least one, with
      `Calendar_Owner_Id__c` set.* It had **zero records** in dev2 before 2026-08-31; staging still
      needs checking (E7.1).
- [ ] **4.2 — Creating a run publishes an Event.** *Expected: an Event on the calendar owned by
      `Calendar_Owner_Id__c`, and the run's `Auto_Scheduling_Status__c` = **`Confirmed`**.*
- [ ] **4.3 — A run never ends at `Planned`.** *Expected: after any write, `Confirmed`.* Trap 9:
      runs are inserted `Planned` and PATCHed to `Confirmed`, because `ProductionEventPublisher`
      keys off `Trigger.oldMap`, which is null on insert. A run left `Planned` is a **publish
      failure**, and `calendar.html` labels it as one.
- [ ] **4.4 — No duplicate Events.** *Expected: one Event per run.* `OrderScheduling`'s
      `CreateCalendarEvent` is an older path that bypasses the confirm gate (E7.8).

##### 5 · Auto-scheduler coexistence

`ProductionAutoSchedulerService` silently overwrites `Scheduled_Start__c` / `Scheduled_End__c` on
any run it considers unpinned, in fixed 9-hour blocks ordered by `Priority_Score__c`.

- [ ] **5.1 — A typed time survives.** Create a run with a hand-typed slot. *Expected: after the
      scheduler runs, `Scheduled_Start__c` and `Scheduled_End__c` are **exactly as typed**.*
      Evidenced once on PR-0085; E8.3 finishes this.
- [ ] **5.2 — A `Proposal` run is still moved**, as intended.
- [ ] **5.3 — Press occupancy counts `Planned` runs**, so the scheduler does not double-book a press.

##### 6 · Line-item skeleton Flow

Active in dev2 and staging. Fires on create **or update**, and its only guard is *"does this run
have any rows"*.

- [ ] **6.1 — Rows are generated on run create.** *Expected: one `Production_Run_Line_Items__c` per
      order size, `Planned_Qty__c` matching the Flow's arithmetic (order size qty − earlier runs on
      the method − `Incomplete_Qty__c`).*
- [ ] **6.2 — The app displays the Flow's numbers**, and does not compute a second opinion.
- [ ] **6.3 — Clearing a size writes 0 and never deletes.** *Expected: the row still exists with
      `Planned_Qty__c` = **0**.* ⚠️ If the app ever empties a run, the Flow regenerates the entire
      skeleton from its own arithmetic on the next save, **silently overwriting whatever a manager
      just did**. A row holding 0 keeps the guard satisfied.
- [ ] **6.4 — `Total_Planned_Qty__c` follows.** *Expected: it equals the SUM of the rows* — it is a
      roll-up summary, and the run's Total Garments is read-only and derived from it (D3).
- [ ] **6.5 — A variance is explainable.** After editing an allocation, `Planned_Qty_Variance__c`
      goes non-zero because `Scheduled_Qty__c` and `Total_Planned_Qty__c` are allowed to disagree.
      *Expected: whatever the board shows, a manager can tell a real shortfall from an edited
      allocation.* Still an open design question.

##### 7 · Mockup delivery

Two branches. **A** fetches a Salesforce ContentVersion by Id — the documented Vault flow, no
allowlist involved. **B** direct-fetches an external URL and is guarded by `ALLOWED_MOCKUP_HOSTS`.

- [ ] **7.1 — A Vault-uploaded mockup renders.** *Expected: the image loads and `/api/mockup-proxy`
      returns `content-type: image/*`.*
- [ ] **7.2 — Count how many mockups take each branch.** *Expected in a healthy org: most take
      branch A.* **Measured in dev2 on 2026-09-01: 54 orders carry a mockup, 38 are blocked (70%),
      16 pass, and ZERO use branch A.** If that holds in staging, the allowlist is the wrong shape
      for how mockups actually arrive — see B1.
- [ ] **7.3 — A blocked host fails visibly.** *Expected: `{"error":"blocked_host"}` and a placeholder
      on the card, not a silent blank.*

##### 8 · Access and identity

- [ ] **8.1 — An unauthenticated request from outside the policy is blocked.** Open the site on a
      phone with Wi-Fi off. *Expected: a Cloudflare Access login screen.* 🔴 **Currently FAILS.**
      Verified 2026-09-01: the account has exactly two Access applications and neither covers
      `culture-apparel-preprod.pages.dev`; the board and every `/api/*` endpoint return live
      Salesforce data with no cookie at all. This is E6.4 and it gates the pilot.
- [ ] **8.2 — `SESSION_SECRET` and `SF_ENV_SWITCH_PIN` are set** in the environment under test.
- [ ] **8.3 — A PIN login issues the session.** *Expected: `POST /api/worker-login` returns
      `{name, role}` and sets an HttpOnly `ca_sess` cookie.*
- [ ] **8.4 — Roles resolve correctly.** *Expected: Anthony admin; Gian and Parker managers.*
- [ ] **8.5 — Before `ACCESS_ENFORCE=1`:** run report-only for **at least five working days** and
      read every `[access] would deny` line. ⚠️ `results.submit` appears in exactly one place in the
      codebase — the check itself. It is not in `DEFAULT_MANAGER_CAPS` and workers derive no
      capabilities, so enforcing without granting it **leaves only Anthony able to record production
      results**. Grant it first.
- [ ] **8.6 — Manager confirmation does not hijack the tablet's session.** `confirmManager()`
      confirms via `POST /api/worker-login`, which also issues `ca_sess` — so a successful
      confirmation currently leaves that tablet's server session as that manager. Inert while
      report-only. *Expected before enforcement: a decision, recorded.*

---

##### Appendix · Stored values, verified

Picklist **values are not their labels**, and these picklists are restricted — a drifted copy does
not fail politely, it 400s with `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST`. Everything below was read
from live dev2 data or dev2 Setup on 2026-09-02.

| Field | Stored values |
|---|---|
| `Order.Order_Substatus__c` | `Pre-Production`, `Ready for Print`, **`Production`** (shown as "In Production"), `Post-Production`, `Completed` |
| `Order.Shipping_Delivery__c` | `Shipping`, **`Delivery`** (shown as "Local Dropoff"), `Pickup`, `Split Ship`, `Order Fulfillment` |
| `Production_Method__c.Status__c` | `Completed` — **with the "d"** |
| `Production_Run__c.Result_Status__c` | `Draft`, `Submitted` |
| `Production_Run__c.Auto_Scheduling_Status__c` | `Proposal`, `Confirmed`, `Unable to auto-schedule`, `Planned` — restricted, all four present in dev2 |
| `Production_Run__c.Print_Location__c` | Front, Back, Left Sleeve, Right Sleeve, Left Chest, Right Chest, Full Front, Full Back, Tag, Hood, Pocket — matches `_placements.js` exactly |
| `Production_Method__c.Type__c` | `Screen Print`, `Heat Press`, `Embroidery` |

📌 `Order.Status` is a **separate, Zenkraft-facing** field. Live dev2 holds `Draft`,
`Enter Tracking` and `Sent Tracking` — not the production substatuses. Do not confuse the two.

📌 `Quantity_Planned_c__c` is the real API name of Scheduled Qty. The double `_c__c` is correct and
must not be "fixed" — `Quantity_Planned__c` does not exist and the write 400s.


---

### E8.2 · End-to-end scenarios

**Written 2026-09-02.** Eight scripted walks through the system with real test orders. Run against
staging before any promotion; re-run against production after. **These are the pre-deploy regression
pass** — when something breaks later, this is the file that catches it.

Companion to `VALIDATION-INTEGRATIONS.md` (E8.1), which checks each seam in isolation. This one
proves they work *together*, which is where this system has actually failed.

##### How to run it

Each scenario names the **Salesforce record state** expected at every checkpoint. Open the record.
A green board is not a pass: every board falls back to demo data with an amber chip, so a broken
query renders as a working page full of plausible fake numbers. **Check the network tab, not the
screen.**

Each scenario also names its **false pass** — the specific way it can look right while being wrong.
Those are the lines worth reading twice; each one is a bug that has already shipped here.

Use fresh test orders. Record order numbers in the log so a failure can be re-opened later.

| Date | Org | Run by | Scenarios passed | Failures |
|---|---|---|---|---|
| | | | | |

---

##### S1 · Single-method order, straight through

The baseline. If this fails, stop; nothing below will mean anything.

1. Take an order into pre-production, complete Begin Set-up, assign one method.
2. Schedule one run. Count results with **every box empty**. Submit. Ship.

**Expected at each checkpoint**

| After | Record state |
|---|---|
| Method assigned | `Production_Method__c` exists, `Status__c` progresses off its initial value; `Order.Order_Substatus__c` = `Ready for Print` |
| Run created | `Production_Run__c` with `Auto_Scheduling_Status__c` = **`Confirmed`** (never left `Planned`), an Event on the shop calendar, and one `Production_Run_Line_Items__c` per order size |
| Results submitted | `Result_Status__c` = **`Submitted`**; all four quantity fields **still blank/zero** |
| Method finished | `Production_Method__c.Status__c` = **`Completed`** (with the "d") |
| Shipped | `Shipping_Label_Printed__c` = true; `Order_Substatus__c` = `Completed` |

> ⚠️ **False pass:** submit with every box empty **must stay enabled**. A perfect run and an
> untouched run are byte-identical by design (D1) — `Result_Status__c` is the *only* evidence a
> human counted. If the submit button disables on an empty form, that invariant is broken.

##### S2 · Front and back — two placements, one method

Proves placements are multi-select on the method and single-select on the run.

1. One method, `Placements__c` = Front **and** Back. Schedule a run for each placement.

**Expected:** `Production_Method__c.Placements__c` holds a `;`-joined multi-select; each
`Production_Run__c.Print_Location__c` holds **one** value drawn from that set. Both appear on the
order sheet.

> ⚠️ **False pass:** the order sheet printing a Method chip that says *Heat Press* for a screen-print
> press. `methodOf()` used to match a bare `press`, so `Press 1`, `Press 2`, `10 Head Press` and
> `6 Head Press` were all classified Heat Press — and that is what printed for the floor. Fixed in
> E3.3; **check the chip against the press name every time**, because this one reaches the shop.

##### S3 · Multi-method order

The scenario B3 is about. Screen print **and** heat press on one order.

1. Assign two methods. Schedule and complete the first. Then the second.

**Expected:** each method carries its **own** `Print_Setup_Timer__c` / `Production_Timer__c`; the
Order-level timer fields are the server-computed **sum** across siblings. Each method's runs are
independent. The order only reaches `Completed` when **every** non-Cancelled method is `Completed`.

> ⚠️ **False pass:** misprint and damaged counts appearing pre-filled on the second method and being
> **written** on submit. Per **D5 they are reference-only** — displayed, never written. If the
> second method's submit writes the first method's counts onto its own line items, the order
> double-counts and the reprint is built from inflated numbers. Verify by opening the second
> method's line items: its `Misprint_Qty__c` and `Damaged_Qty__c` must reflect **only** what was
> counted there.
>
> ⚠️ Also: dragging a multi-method order on the calendar. `commitDrop` and `durationOf` read only
> `ProductionRuns[0]` / `ProductionMethods[0]`, so it silently moves the first one.

##### S4 · Multiple pre-production tasks

1. An order with several `Pre_Production_Item__c` rows. Work them at the station, including a
   **partial** check-in with missing items recorded.

**Expected:** `Partial_Check_in_Missing_Items__c` holds the note (max 255 chars, `Text Area(255)`).
The note survives taps through **all four** statuses.

> ⚠️ **False pass:** expecting a status change to clear the note. **Nothing auto-clears it** — the
> presence of the `missing` key is the only write gate, and status decides nothing. That is a
> product decision (D2), not an oversight. Do not "fix" it without asking.

##### S5 · Multiple runs on one method

1. One method, three runs across different days. Allocate sizes differently on each.

**Expected:** each run's `Total_Planned_Qty__c` equals the SUM of its own line items. Across runs,
allocations do not double-count: the Flow computes each size as *order qty − what earlier runs on
the method already planned − `Incomplete_Qty__c`*. Clearing a size writes **0**, never deletes.

> ⚠️ **False pass:** the "which cycle am I on" pointer is **derived from run actuals, not stored** —
> elegant, and untested against a real three-run method (E2.6). Check it explicitly on run 2 and 3.
>
> ⚠️ Also: if the app ever empties a run of rows, the skeleton Flow regenerates the whole thing from
> its own arithmetic on the next save, **silently overwriting a manager's edit**.

##### S6 · Misprint and reprint — the loop, all the way round

**The most important scenario in this file.** The roadmap requires it proven end to end:
error → reprint → back to pre-production → prepared → scheduled → produced.

1. Count a run with misprints and damaged > 0. Submit.
2. Complete every run and every non-Cancelled method on the order.
3. Watch the reprint order appear. Take it through pre-production, schedule it, produce it.

**Expected:** a child reprint Order linked to the parent, created by `createReworkIfNeeded` in
`_rework.js` — **application code, not a Flow or trigger. Do not go looking for one.** Its four
gates, in order: (1) no existing reprint for this order, (2) every run `Submitted`, (3) every
non-Cancelled method `Completed`, (4) some line carrying misprint or damaged > 0.

Use `GET /api/rework-check?orderNumber=…` — it re-runs every gate **read-only** and names the one
that stopped it. Run it *before* debugging by hand.

> ⚠️ **False pass, and this one cost an afternoon:** a failure that returns the "nothing to do"
> shape. `_rework.js` must return a named `reason` and a `detail` carrying Salesforce's own
> errorCode. "No reprint needed" and "the reprint failed" must never look the same.
>
> ⚠️ **Incomplete is not a reprint.** Misprinted and damaged garments are spent and need new blanks —
> that is the reprint. **Incomplete garments are intact on a shelf and need press time on the same
> method** — that is a make-up run. Never merge them; never derive one from the other. Prove both
> paths separately.
>
> 🔴 **Known open (B3):** scheduling the make-up run currently fails with
> *"Could not create run — check press / schedule"*. That message is a catch-all that discards the
> real error, and dev2's org config has been cleared of blame (picklist present, no validation
> rules, placements match). **Expect this step to fail until the error-surfacing fix lands.**

##### S7 · Split and combined shipment

1. Split one order into two shipments. Separately, combine several orders into one.

**Expected:** `Shipping_Delivery__c` = **`Split Ship`** where applicable; a Shipment record per box;
tracking written back to each order.

> ⚠️ **False pass:** `combine.js` builds **one** composite with `allOrNone: true` and emits 2N+2
> sub-requests, so **twelve orders is 26 and Salesforce rejects the whole thing**. The hard cap is
> 25. Test with **at least twelve orders**, not two — with two it will always pass.
>
> ⚠️ `/composite` returns **HTTP 200 even when every sub-request failed**. Inspect `compositeResponse`
> entry by entry; innocent sub-requests report `PROCESSING_HALTED`, so the first failure in array
> order names a bystander.

##### S8 · Full lifecycle

One order, intake to shipped, touching every board: `pre-production` → `index` → `station` →
`counting` → `shipping` → `order-sheet`.

**Expected:** the order's `Order_Substatus__c` walks `Pre-Production` → `Ready for Print` →
**`Production`** (stored value; shown as "In Production") → `Post-Production` → `Completed`, and
each board reflects the same state at the same time.

> ⚠️ **False pass:** any board showing a stale stage. Boards poll every 15–20s; `CAApi.shouldPoll`
> gates it, and a demo board retries every 5th tick. If two boards disagree, one of them is on demo
> data — check the network tab.

---

##### What this file does not cover

- **E8.3** — auto-scheduler coexistence, in `VALIDATION-INTEGRATIONS.md` §5 and its own story.
- **E8.4** — Zenkraft depth, §3 there.
- **Tablets, touch, lighting and connectivity** — E9.1–E9.4, which need real hardware on the floor.
- **Load.** Nothing here runs for eight hours; that is E9.6, and memory growth, timer drift and
  session expiry only surface there.

##### Entry criteria for the pilot (E9.8)

Every P0 closed, **S1–S8 passing on the target org**, and the rollback path — the org switch *back*
— exercised at least once. Not "mostly passing". The reprint loop in S6 is the one that matters
most, because it is the only path that creates records on its own.

---

## 9. Org parity and change management
What each org actually has, how that was measured, and what moving metadata between them does and does not carry.

### Org parity — measured 2026-09-03/04

**Method: read both orgs' Object Manager directly and diff, then check each difference against the
codebase to see whether the app actually uses it.** Not taken from documentation — an earlier note
in the old roadmap named the staging-only leftovers as being on the wrong object, and the Setup UI
returned three confident false negatives during this sweep because its field lists lazy-load. ⚠️ **If
you repeat this, scroll until the item count stops rising before you trust a "missing" result.**

**Objects the app depends on: all present in staging, all app-used fields present.** `Order` (29
fields the app SELECTs), `Pre_Production_Item__c`, `Production_Run__c`, `Production_Method__c` all
clear.

| Difference | Where | Used by the app? | Action |
|---|---|---|---|
| `Run_Print_Location__c` | dev2 + staging | Flow only | ✅ shipped to staging 2026-09-04 |
| `Operator__c` | dev2 only, `Production_Run__c` | **No** — zero references | Leave |
| `Priority_Notes__c`, `Priority_Rating__c` | dev2 only, `Production_Method__c` | **No** — the app reads these off **Order** via `Order__r.` | Leave |
| `Production_Priority__c` | dev2 only, `Production_Method__c` | **No** — only by the dead `_priority-rollup.js` | Leave, per **D9** |
| `Actual_Good_Qty__c` | staging only, line item | No | 🔴 **Delete** — see below |
| `Reprint_Qty_Needed__c` | staging only, line item | No | Delete |
| `Quantity_Completed_c__c`, `Reprint_Quantity_c__c` | staging only, `Production_Run__c` | No | Delete |

🚩 **`Actual_Good_Qty__c` in staging is a "good quantity" field on the object whose entire model is
that ONLY PROBLEMS ARE RECORDED.** That is D1, and this is the field D1 says must not exist. Nothing
writes it today, so it is inert — but any report or Flow built against it returns an authoritative-
looking number that is always empty. Delete it before someone finds it.

**Picklists.** `Print_Location__c` value sets were compared across both orgs and match exactly — all
eleven, same order: Front, Back, Left Sleeve, Right Sleeve, Left Chest, Right Chest, Full Front, Full
Back, Tag, Hood, Pocket. That matters because these are **restricted** picklists (trap 5) and a
drifted copy 400s with `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` rather than degrading.

**Timers.** `Print_Setup_Timer__c` and `Production_Timer__c` exist in **both** orgs.
`Timer_Started_At__c` and `Timer_Running__c` exist in **neither** — E2.3 is outstanding equally
everywhere, which is not drift, and it is what blocks B2 step 2 and B7 stage 2.

**Production has none of this metadata at all** and picks it all up with **E7.4**.

**Screen labels, 2026-09-04.** The Schedule Runs repeater on `Order and Order Items Subflow Design`
— the "Close and Create Order" subflow that writes `Proposed_Run__c` rows — labelled its placement
picklist **"Machine"**. It now reads **"Method"** in both orgs, which is what the field actually
holds: `Machine_Group__c` groups presses by print method (Screen Print / Heat Press / Embroidery).

📌 **Label only.** The component's API name is still `RunMachineGroup` and its choice set is still
`[Machine_Group__c values from Proposed_Run__c]`. Nothing in the app is affected —
`functions/api/proposed-runs/index.js` selects `Machine_Group__c` and maps it to `machineGroup`, and
a screen component's display label is not reachable from SOQL. **Do not "finish the job" by renaming
the field or the component API name**: the component name is referenced by the repeater's row
variables, and the field name is in `FIELDS` in that endpoint.

| Org | Was | Now | Rollback |
|---|---|---|---|
| dev2 | V42 active | **V43 active** | V42, intact |
| staging | V43 active | **V44 active** | V43, intact |

Verified by loading each version fresh from the server: the superseded version now offers
**Activate** and the new one offers **Deactivate**. ⛔ **Not re-read after a cold reload** — Flow
Builder threw a "Sorry to interrupt · CSS Error" modal on every attempt to reopen the screen editor
from a fresh page load, in both orgs. The label was confirmed as "Method" in the editor and in the
canvas preview at the time of the edit, and the save produced a new version number, but the
belt-and-braces re-read is outstanding. **Cheapest confirmation is the real one: run Close and
Create Order and look at the Schedule Runs screen.**

### Receiving status — the value set, and three traps in it

**Measured 2026-09-04.** `Order.Receiving_Status__c` is a **restricted** picklist with no
dependencies and no validation rules. Active values, after this change:

| Org | Active values | Inactive |
|---|---|---|
| dev2 | Not Received · **Received** · Partial · Counted In · Staged | Complete |
| staging | Not Received · **Received** · Partial · Counted In · Staged | Complete |
| production | **unknown — not checked, and it does not have `Received`** | — |

📌 **Setup's display order is not the pipeline order and never was.** dev2 lists them
Not Received / Partial / Staged / Counted In. The delivery sequence the boards render —
`Not Received → Received → Partial → Counted In → Staged` — is defined once in
`_station.js` (`garment.statuses`) and mirrored in `ca-api.js` (`RECV_ORDER`). Do not
"fix" Setup to match; nothing reads Setup's order.

**Why `Received` exists.** The blanks are physically here and nobody has counted them.
Before it, the only moves off `Not Received` were `Partial` and `Counted In`, and **both
assert a count that has not happened** — so taking a delivery meant overstating it or
understating it. Anthony's call, 2026-09-04.

##### 🚩 Trap A — there are TWO fields labelled "Receiving Status"

`Receiving_Status__c` (the picklist the app reads and writes) and **`ReceivingStatus__c`**
(a Text formula, no underscore before Status). Identical label in the Object Manager list.
The formula is an emoji indicator over the picklist:

```
CASE( TEXT(Receiving_Status__c),
  "Not Received", "🚫",  "Received", "📦",
  "Counted In", "📥",    "Partial", "🌓",
  "Staged", "✅",        "N/A" )
```

**A new picklist value that is not added here renders as "N/A" in Salesforce** — no error,
just a wrong indicator. The app never reads this field, so nothing in the dashboard would
have caught it.

⚠️ **Staging's copy was a whole generation behind.** It still mapped the pre-2026-05-28 set
(`Received` → 📥, `Complete` → ✅) and had **no branch for `Counted In` or `Staged`** — so
since May, staging has been showing "N/A" for the two most common statuses in the shop.
Both orgs now carry the formula above, verified from the saved field detail page
(compiled size 364 in each). 📌 `Complete` is an inactive value that old records may still
hold; neither org has a branch for it, so those render "N/A". Left as-is deliberately.

##### 🚩 Trap B — reactivating a picklist value does NOT restore its record types

Staging already had `Received`, **deactivated 2026-05-28** two minutes before `Counted In`
and `Staged` were added. Reactivating it put it back in the value set and **nowhere else**:
on every record type it sat in *Available*, not *Selected*, so no one could pick it on an
order. It had to be moved across by hand on all six (Ecommerce, EMB Production, Heat Press
Production, Print Shop Production, ShipStation, Vendor Order).

📌 **dev2 did not have this problem** because the value was created fresh there, and the
Add-Picklist-Values screen offers record-type checkboxes at creation time. **Same value,
same day, two different procedures.** Check *Selected*, not the value set, after either.

##### 🚩 Trap C — restricted means the write fails, not that the field degrades

This is trap 5 one level up. A value the active org lacks is not ignored — it rejects the
**entire PATCH** with `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST`. With one deployment
serving three orgs, that is a live hazard the moment the orgs disagree, which they do right
now: **production has no `Received`.**

What the code does about it:

| Piece | Job |
|---|---|
| `functions/api/_picklist.js` | Cached describe of the active org's **active** values. Returns `null` for *could not tell* — **never an empty list**, or a transient describe failure would take the garment station down. Same rule E5.6 settled for shipment counts. |
| `_station.js` → `garment.optionalStatuses` | Names what may be absent. **Delete `Received` from it once all three orgs match** — empty is the goal state, not a fixture. |
| `update-order-receiving` | Refuses an optional value the org lacks with a named `status_not_in_org`. An *unknown* answer still writes, so genuine errors surface through E4.2's paths. |
| `GET /api/receiving-statuses` | What the boards may offer right now. Separate endpoint on purpose — rule #1 is the board never goes blank, and a describe failure must not take the order list with it. |
| `station.html`, `pre-production.html` | Render the supported subset, starting **pessimistic**: optional chips are withheld until the org confirms, so the worst case is a chip arriving a beat late rather than one that fails when tapped. The four long-standing statuses are never withheld. |

⛔ **Not verified.** There is no `.dev.vars` on this machine, so `/api/receiving-statuses`
has **not** been exercised against a live org and neither board has been rendered against
dev2. The org half was verified directly (value set and record-type *Selected* lists read
back in both orgs); the app half rests on unit checks of `supportedFrom()` and a contrast
measurement of the new chip (9.70:1 on its own background). **Run the garment station
against dev2 and check the network tab before trusting it.**

📌 **E7.4 gains an item:** `Received` must be added to production's `Receiving_Status__c`
*and* to its record types, and production's `ReceivingStatus__c` formula must carry the
branch. Until then the guard is what keeps the chip off that org.

🚩 **Production does not have this flow's change either** — it travels with **E7.4**, and per the
trap directly below, a flow in a change set arrives **inactive**.

⚠️ **The flow's Description field is a shared running changelog, and it is easy to corrupt.** The
"Save As New Version" dialog pre-fills it with the whole existing history and the cursor does not
land at the end — so a note typed there gets spliced into the middle of an earlier entry. dev2's
copy already carried two such splices before 2026-09-04 (the 8/24 run-hours note splits "screen"
into "scr" / "een"; the MockupLink note is appended mid-line to the 10/30 entry), and this session
added a third. It is cosmetic — no behaviour depends on it — but tidying it costs a further flow
version, so it has deliberately been left alone. **If you write a note there, click to the very end
of the field first.**

### Moving metadata between orgs — what change sets do not do

📌 **Learned the hard way, 2026-09-04, deploying B4 to staging.** Add each of these to the
post-deploy checklist; none of them shows up as a failure.

1. 🚩 **A FLOW IN A CHANGE SET ARRIVES INACTIVE.** The B4 change set deployed cleanly, the new field
   was present, and staging carried on running the **old** allocation logic — the flow landed as
   **V2 · Draft** with **V1 still Active**. Nothing was wrong; change sets deploy flows inactive
   unless **Process Automation Settings → "Deploy processes and flows as active"** is switched on.
   **After any change set carrying a flow, check the ACTIVE VERSION NUMBER in Flow Trigger Explorer
   — not the deployment status page.**
2. **Fields arrive with FLS off.** Grant it by hand. Note the trap within the trap: a record-triggered
   flow reads fields in system context, so placement logic works whether or not FLS is granted, which
   makes this easy to leave undone until something else tries to read the field.
3. **Permission-set assignments never travel.**
4. **Records never travel.** E7.1's staging half is a `Production_Calendar_Setting__c` *record*, not
   metadata.
5. **Deletions never travel.** The four staging-only fields above are hand deletions.

📌 **A clean "Deployment succeeded" is evidence that components were written, and nothing else.**
E7.4 already said this about FLS and permission sets; flows now belong on the same list.

### Adding the `Planned` state — the selector change

Do these two **before** deploying the JavaScript, or newly created runs will
carry a status Salesforce rejects and every save will fail.

---

##### 1. Add the picklist value (2 minutes)

`Setup → Object Manager → Production Run → Fields & Relationships → Auto Scheduling Status → Values → New`

Add exactly one value: **`Planned`**

Leave it unchecked as a default. Don't reorder or touch the existing values.

*(This is the object you kept getting "Insufficient Privileges" on — that was
the old Setup URL, not a permission. Lightning Object Manager opens it fine.)*

---

##### 2. `ProductionAutoSchedulerSelector` — two lines

Setup → Apex Classes → **ProductionAutoSchedulerSelector** → Edit. It's a
44-line class; both queries are in it.

###### `getSchedulableByPress` — line 15

The runs the auto-scheduler is allowed to move. `Planned` must be excluded
alongside `Confirmed`.

```apex
// BEFORE
AND Auto_Scheduling_Status__c != 'Confirmed'

// AFTER
AND (Auto_Scheduling_Status__c = null
     OR Auto_Scheduling_Status__c NOT IN ('Confirmed', 'Planned'))
```

⚠️ **The `= null` branch is not optional, and this is the whole reason this file
exists rather than a one-line instruction.** In SOQL, `NOT IN` does **not**
match null — unlike `!=`, which does. Writing the obvious
`NOT IN ('Confirmed','Planned')` on its own would silently drop every run with
a blank status out of the auto-scheduler's sight. Those runs would never be
scheduled again, and nothing would error: the query just quietly returns fewer
rows. Spelling out `= null OR NOT IN (...)` preserves exactly today's behaviour
for blank-status runs while adding Planned to the exclusion.

###### `getConfirmedByPress` — line 25

The runs the auto-scheduler treats as **booked time** when looking for a free
slot. Planned must count here too.

```apex
// BEFORE
AND Auto_Scheduling_Status__c = 'Confirmed'

// AFTER
AND Auto_Scheduling_Status__c IN ('Confirmed', 'Planned')
```

No null branch needed on this one, and adding one would be wrong: a run with no
status isn't pinned by anyone, so it shouldn't reserve press time.

**Both halves or neither.** With only the first change, Planned runs keep their
times but their press reads as free — the auto-scheduler would cheerfully book
another job on top. A press that looks empty while a human has booked it is
worse than the problem we started with. The method name `getConfirmedByPress` is
now slightly off, since it returns Planned runs too; leave it. Renaming touches
more lines than the fix and gains nothing.

---

##### What this buys

| Status | Auto-scheduler moves it? | Press held? | On the calendar? |
|---|---|---|---|
| `Proposal` | yes | no | no |
| `Unable to auto-schedule` | yes | no | no |
| **`Planned`** | **no** | **yes** | **no** |
| `Confirmed` | no | yes | **yes** |

Before this, the only way to stop the auto-scheduler rewriting a manager's
typed times was `Confirmed` — and as of this week `Confirmed` also publishes to
the shop calendar and Google. Scheduling something and announcing it were the
same keystroke. `Planned` splits them, so a manager can lay out a whole week
privately and publish it when it's actually settled.

---

##### How to tell it worked

1. Create a run from the dashboard with a specific time. Reload — **the time
   should still be what you typed** (Planned pinned it), and **nothing appears
   on the Event calendar**.
2. Hit Confirm. The event appears.
3. Hit Unconfirm. The event disappears, and the time still doesn't move.

Step 1 is the one to watch. Before today's change the time stuck but the job
went public immediately; before July it went public *and* the time got
overwritten. Both halves have to hold at once.

---

## 10. Deployment and file layout
⚠️ Parts of this were written for the original drop-in delivery and describe the app as it was first shipped. Where it disagrees with §3, §3 wins.
Static pages that replace/augment the HTML in your `culture-apparel-prepod`
Cloudflare Pages repo. They call your **existing** `functions/api/*` proxy over
same-origin `fetch` — no backend changes.

#### This build removes the loading splash
Earlier files were single self-contained bundles that showed a brief unpack
splash (the "CA" box) on every navigation. These are **plain pages** instead:
each HTML loads a shared `support.js` runtime — no unpack, no splash. That means
two small shared files ship alongside the HTML.

#### Files → all at repo root, next to `functions/`

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

##### Shipping/Receiving Dashboard (`shipping.html`)
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

#### Live link / troubleshooting
On load each page calls `GET /api/orders`; the header badge shows
**Live · Salesforce** (green) when it responds, or **Demo data** (amber) with
sample orders if it can't reach the API. If you still see Demo data after
deploy, open DevTools → Network → reload → check `/api/orders`:
- **200 + records** → live (hard-refresh).
- **401 / 500** → Function can't reach Salesforce; check `SF_LOGIN_URL`,
  `SF_CLIENT_ID`, `SF_CLIENT_SECRET` and the Client-Credentials "Run As" user.
- **404** → `functions/` isn't deployed at the project root.

#### Notes on this update
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

#### Scheduling: Print Date/Duration → Production Run prefill
**Added 2026-08-14.** Salesforce's "Close and Create Order" quick action
(Opportunity → `OrderScheduling` flow, now V31+) collects a Print Date &
Time and a Duration (hours) on its scheduling screen. The flow's
`UpdateOrder` step now writes `Duration__c` onto the Order in addition to
`Print_Date__c` (which it already wrote); Order's pre-existing
`Print_End_Date_Time__c` formula field (`Print_Date__c + Duration__c/24`,
falling back to `Print_Date__c + 2h` if Duration__c is blank) then
auto-computes the scheduled end time — no new Salesforce fields were needed,
just the missing mapping.

`/api/orders`, `/api/production-orders`, and `/api/inbox` all now select
`Duration__c`/`Print_End_Date_Time__c` alongside `Print_Date__c`. Both
dashboards' "Create Production Run" / "New Run" forms prefill Scheduled
Start from `Print_Date__c` and Scheduled End from `Print_End_Date_Time__c`
when present (still editable, still blank if the order never went through
that flow) — a manager no longer has to retype what was already set when
the order was created.

#### Order tracking / stage placement
The Production Dashboard reads your existing **`/api/production-orders`**
endpoint (filters by `Order_Substatus__c`), not `/api/orders`. That's the one
your repo already built for exactly this, so **no backend change is needed** —
an order whose standard `Status` has advanced (e.g. to "Enter Tracking") still
shows in the right column. The Pre-Production board and the Garment station keep
using `/api/orders` (Status = 'Pre-Production'), unchanged.

#### Auth & offline
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
layered on top of) `confirmManager()`'s destructive-action PIN re-check,
which still treats admin + manager as equally "elevated" for that one
purpose. As of 2026-08-28 that re-check is **server-side**: there is no PIN
in the browser any more, the typed PIN is a PERSONAL one checked against
`WORKER_PINS` via `POST /api/worker-login`, and an already-elevated stored
role no longer skips the prompt (it used to return early, so a tablet left
signed in as a manager — the case the re-check exists for — was never asked
for anything). Any manager's own PIN authorises the action regardless of who
is signed in on that tablet. `confirmManager()` therefore returns a
**Promise**: every call site must `await` it, because `!somePromise` is
always false and an un-awaited guard silently confirms nothing.

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

---

## 11. Change log

Newest first. One line per change; link to the story that carries the detail.

| Date | What | Where |
|---|---|---|
| 2026-09-04 | **`Received` added to `Order.Receiving_Status__c`** — dev2 + staging, all 6 record types. New chip on the pre-production board and the garment station, guarded so an org without the value never offers it. Branch `feat/received-status`, commit `0f98aca`, unpushed. **Production does not have the value** (E7.4) | §9 |
| 2026-09-04 | 🚩 **`Order.ReceivingStatus__c` is a SECOND field with the SAME label** — an emoji formula over the picklist. Staging's copy was a generation stale and rendered `Counted In` and `Staged` as "N/A". Both orgs now match | §9 |
| 2026-09-04 | **Proposed-runs screen relabelled** — `RunMachineGroup` picklist on the Schedule Runs screen of `Order and Order Items Subflow Design` now reads **Method**, not "Machine". Label only; API name and the `Machine_Group__c` choice set untouched. dev2 V43, staging V44, both activated | §9 |
| 2026-09-04 | **Staging IS reachable from browser automation** — the standing note in §1 and §6 was stale | §9 |
| 2026-09-04 | All project docs combined into this file | §12 |
| 2026-09-04 | **B4 shipped to staging and verified** — field + flow. ⚠️ Flow arrived as a Draft with V1 still active; needed activating by hand | §4 B4, §9 |
| 2026-09-04 | Change set **"Placement-Aware Line Item Skeleton (B4)"** created in dev2 | §9 |
| 2026-09-04 | Org parity sweep dev2 ↔ staging, measured field by field | §9 |
| 2026-09-04 | **B7 logged** — setup/production time on the method cards, two stages, stage 2 blocked on E2.3 | §4 B7 |
| 2026-09-04 | 24 E-stories moved to the closed list after a branch audit | §4 |
| 2026-09-03 | **B6b** — Post-Production can book a make-up run (unpushed) | §7 |
| 2026-09-03 | **B6** — reprints reach the Management inbox | §7 |
| 2026-09-03 | **B5** — submitting incomplete results routes to the make-up run | §7 |
| 2026-09-03 | **B4a** — sibling placements shown on the counting screen | §7 |
| 2026-09-03 | **B4 / D11** — line-item allocation became placement-aware in dev2 | §4 B4, §5 D11 |
| 2026-09-02 | B1, B2 step 1, B3, E6.4, E7.6 closed | §4 |

🚩 **Two documentation losses on 2026-09-03, same cause.** These files are tracked, but everything
written since 2026-09-02 existed only as **uncommitted working-tree changes on top of `origin/main`**
— so a branch cut from `origin/main` silently replaced them with the stale committed copies. The
roadmap and the queue were recovered from an incidental backup taken minutes earlier;
`VALIDATION-INTEGRATIONS.md` was **not**, and roughly 600 bytes of the E8.1 checklist edited that
afternoon exist on no branch and are gone. 📌 **Until the docs branch is merged, copy this file
outside the repo before any branch switch.**

---

## 12. Retired documents

**Folded into this document, and safe to delete from the repo:**

| Old file | Now in |
|---|---|
| `ROADMAP.md` | §3, §4, §5, §6 |
| `CLAUDE-CODE-QUEUE.md` | §7 |
| `CLAUDE.md` | §2 |
| `HANDOFF.md` | §1 |
| `VALIDATION-INTEGRATIONS.md` | §8 |
| `VALIDATION-SCENARIOS.md` | §8 |
| `SELECTOR-CHANGE.md` | §9 |
| `README.md` | §10 |

⚠️ **`CLAUDE.md` is the one exception worth thinking about before you delete it.** Claude Code reads
a file of that name automatically as project instructions; every other file has to be asked for. If
you delete it outright, the trap list in §2 stops being loaded by default and a session can start
work without it. **Recommended: replace `CLAUDE.md` with a three-line pointer** to this file and §2,
rather than removing it. Same for `README.md`, which is what GitHub shows on the repo's front page.

**Deliberately NOT carried over — delete these, do not merge them:**

| Old file | Why |
|---|---|
| `NEXT-STEPS.md` | Spent and superseded. Everything open in it was closed or carried forward under the same Asana id. The old roadmap's own words: *"it will mislead you."* |
| `culture-apparel-handoff.md` | 517 lines, same generation as three analysis docs deleted on 2026-08-31, and never verified since. |
| `mockup-url-staging-fix-summary.md` | 2026-08-05, superseded entirely by B1 and D8. |

📌 **Merging those three would have defeated the point.** The reason the old set of documents was
hard to trust was that dead material sat alongside live material with nothing marking which was
which. They are recorded here so nobody goes looking for them, and their content is deliberately not
reproduced.

---
