# Culture Apparel Production Dashboard — Project Handoff & Roadmap

**Written 2026-08-31.** Supersedes `NEXT-STEPS.md`, which was the week-1/week-2 work queue and is
now spent. Everything in it that was open is either closed (listed below, do not re-open) or has
been carried into this document under the same Asana id.

Read `CLAUDE.md` in the repo root before touching any code. It carries the traps, and every one of
them has already cost a real afternoon. This document is the *plan*; that one is the *minefield map*.

---

## Part 0 — Blocking. Do these before anything else.

**Added 2026-09-01** from Anthony's test pass. These jump the queue ahead of Phase A. Each was
reproduced against live dev2 before being written down; the numbers below are measured, not
estimated. Owner column: **CC** = Claude Code (repo change), **SF** = this Salesforce/docs project
(live-org work, or a decision).

| Id | P | Owner | What |
|---|---|---|---|
| **B1** | P0 | SF → CC | Mockup thumbnails blank on most orders, every board |
| **B2** | P0 | CC (+SF) | Timers reset on refresh / tab close — this is E2.1 |
| **B3** | P0 | SF + CC | Run Results is organized by method; it needs to be organized by order |

---

### B1 · Mockup thumbnails blank on 38 of 54 orders

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

### B2 · A running timer does not survive a refresh or a closed tab

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

### B3 · Run Results is organized by method; it needs to be organized by order

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

## Part 1 — What the system is

A production dashboard for a screen-printing shop. Workers on shop-floor tablets and managers on
desktops drive an order from pre-production intake through printing to shipping. Salesforce is the
system of record; this app is a faster, purpose-built face on it.

### Shape of the thing

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

### The boards

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

### One deployment, three orgs

**This is the single most important operational fact.** The active Salesforce org is a KV value
(`sf_env:active` in the `INVENTORY` namespace), switched at runtime from the UI by an admin. There
is one deployment and it can point at dev2, staging or production.

A code change therefore goes live for all three at once — **you cannot ship a fix "to staging
only."** Write code that degrades safely when a field does not exist in the active org. And the
env switch is global: it changes the org for every user and every tablet simultaneously.

`DEFAULT_ENV = "dev2"`. Production is deliberately unconfigured today (`SF_ENV_PRODUCTION_*` unset),
which is why the switcher shows "Not configured yet" — that is E7.5.

### Auth model

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

### Editing a page

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

### The Production Results model — do not redesign this by accident

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

### The allocation grid and the skeleton Flow

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

### Salesforce automation you are sharing the org with

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

## Part 2 — Where things stand

### Closed. Do not re-open, do not re-audit.

Week 1 — **E6.1** SOQL injection in production-methods · **E5.1** method edit / order stage ·
**E5.2** 'Local Dropoff' picklist · **E5.3** cancelled calendar drag · **E5.4** demo fixtures in
live mode · **E5.5** garment-station missing-items note · **E4.7** order sheet sample data ·
**E6.2** mockup-proxy open proxy · **E6.3** cleartext manager PIN.

Week 2 — **E4.1** recovery from demo mode · **E4.2** real error reasons out of `jget`/`jdel` ·
**E4.3** no phantom saves · **E4.4** unpkg single point of failure (React is self-hosted now) ·
**E10.1** shared run-row module.

Line items — **E1.1** data model · **E1.2** endpoints · **E1.3** allocation grid.
KPIs — **E5.9** hardcoded KPI tiles.

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

### Four things from the closed work that are still load-bearing

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

### Verified live in dev2 on 2026-08-31

- E1.3 allocation grid on PR-0083 — pre-fill matched the Flow, editing a size updated the existing
  row, `Total_Planned_Qty__c` followed, clearing wrote 0.
- E5.5 missing-items note on order 20484-9 — survived taps through all four statuses. This also
  settles **write-side FLS** on `Partial_Check_in_Missing_Items__c` and confirms the endpoint's
  `MISSING_MAX = 255` matches the real `Text Area(255)`.
- `ProductionAutoSchedulerSelector` change on PR-0085 — typed time preserved, run ended `Confirmed`.
- **E7.1 in dev2 only.** `Production_Calendar_Setting__c` had *zero records*; an org-level record was
  created with `Calendar_Owner_Id__c = 005ca00000BhcA9AAJ` (Anthony Martinez).

### Two known-stale documents in the repo

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

### Open findings that are not yet stories

- **`Planned_Qty_Variance__c` goes non-zero when a manager edits an allocation.** On PR-0083,
  `Scheduled_Qty__c` stayed 5 while `Total_Planned_Qty__c` went to 3, leaving the variance at −2.
  The two numbers are allowed to disagree by design, but nothing on the board explains it, so a
  manager seeing −2 cannot tell a real shortfall from an edited allocation. Decide whether to
  surface it, reconcile it, or hide it.
- **`Quantity_Planned_c__c` vs `Total_Planned_Qty__c`.** Two totals on a run that can drift — the
  writable one typed by a manager, the derived one summed from line items. The UI now shows only the
  derived one, but the writable field is still there and still written on create.

---

## Part 3 — The remaining work

50 open stories, same Asana ids. Sequenced into phases by what blocks what, not by the original
week numbers.

### Phase A — Perimeter and org readiness *(do first, mostly not code)*

| Id | P | Owner | What |
|---|---|---|---|
| **E6.4** | 🔴 | Ops / Anthony | **ANSWERED 2026-09-01, and the answer is no. Cloudflare Access is NOT enabled on this project.** Read directly from Zero Trust → Access controls → Applications: the account holds **exactly two** Access applications — `culture-quote - Cloudflare Pages` (`*.culture-quote.pages.dev`, policy "Allow Members") and `cultureapparelexec.pages.dev` (policy "Allowed viewers"). **Neither covers `culture-apparel-preprod.pages.dev`**; a search for "preprod" returns no records. Corroborated from the live site: zero cookies on the domain, no `CF_Authorization`, and `/api/admin/sf-env` and `/api/orders` both return 200 with live Salesforce data. **So the dashboard and every `/api/*` endpoint are open to anyone with the URL** — live customer orders, quantities and schedules. The in-app PINs are attribution only, exactly as this plan warned. Two other Pages projects in the same account are correctly protected, so this is an omission, not a capability gap. **Remaining for this story:** create the Access application over `culture-apparel-preprod.pages.dev` (and `/api/*`), write down the policy and member list, confirm `SESSION_SECRET` and `SF_ENV_SWITCH_PIN` are set, then re-test unauthenticated from off-network. ⚠️ Cloudflare was showing an "Access services degradation" banner while this was read; the application list rendered completely ("Showing 1-2 of 2"), but re-confirm once that clears. |
| **E7.1** | P0 | Salesforce | **Half done.** dev2 is set. Staging still needs `Production_Calendar_Setting__c.Calendar_Owner_Id__c = 005ca00000BhcA9AAJ` — and note the object may have zero records there too, in which case create one. Then confirm a run publishes an Event on that calendar. |
| **E7.2** | P0 | Peter Larson | Apex test classes to clear the 75% gate. `ProductionEventPublisherTest` is written but has never run in an org; `OrderPrintDateRollup` has no test at all. Sandboxes do not enforce the gate — production will refuse the deployment. **This is the long pole on the whole project.** Start it now, in parallel with everything else. |
| **E2.3** | P1 | Salesforce | Timer fields (`Print_Setup_Timer__c`, `Production_Timer__c`, plus whatever E2.1 adds) exist with FLS in all three orgs and are in the permission set. |

### Phase B — Stop the app lying about writes *(the rest of week 2's theme)*

| Id | P | What |
|---|---|---|
| **E2.1** | P0 | A running timer must survive a reload. Today `startedAt` lives only in page state; a sleep, reload or demo flip loses everything since the last stop — on a shared tablet that is most of a shift. Needs a `Timer_Started_At__c` / `Timer_Running__c` on `Production_Method__c` (which is why E2.3 is Phase A). Two tablets on the same method must agree. |
| **E2.2** | ✅ | **DONE 2026-09-01**, branch `fix/e2.2-timer-write-failures`, unpushed. **The story as written was already done** — E4.3 had replaced the `.catch(()=>{})` with `canWriteNow`/`writeFailed`, so a failed timer write already raised a toast. What remained is what the story was *for*: a toast is enough for a checklist tick (re-tick it) and not for a timer, because **nobody can retype how long a job took**, and once the toast fades a tile reading 47:13 that never saved looks identical to one that did. Worse, `load()` polls every 15s and `Object.assign({},st.timers,serverTimers)` let the stale server value overwrite the unsaved local one, destroying the only copy. Now: `pushMethodFields` returns its outcome, a failed *or blocked* write sets a standing per-timer flag, the tile carries a red "Not saved to Salesforce — this time is only on this tablet" strip until a later write succeeds, and `mergeServerTimers()` stops the poll eating the unsaved seconds. Verified in a browser (demo mode blocks writes, so the path is reachable without an org) plus 11 unit tests. |
| **E4.5** | ✅ | **DONE 2026-09-01**, branch `fix/e4.5-board-states`, unpushed. Every board computed its empty state as `count === 0` and nothing else, so the **first paint of every board asserted the shop was empty** — in the same words it uses when that is true. `shipping.html` said "the shop floor is caught up" while still fetching; `calendar.html` said "everything is placed", "every counted run is accounted for", "everything has runway"; `stats.html` opened with twelve confident zeros; `counting.html` said "every printed run is accounted for". New shared `listState()` / `listNotice()` in `ca-api.js`; all seven boards now show **Loading… / a real reason on demo / a genuinely-empty message that says what would put something here**. Verified in a browser behind a deliberately slow API: at 3.2s all seven show "Connecting…", six show "Loading…", and **zero false claims**; after the API returns empty each shows its own explanatory copy. The centre overlay was already opt-in (nav + login + env switch only, per its 2026-08-20 second pass), so that half needed no work. |
| **E4.6** | ✅ | **DONE 2026-09-01**, branch `fix/e4.6-unresolved-bindings`, unpushed. **The premise was wrong in both halves, and the real bug was worse.** (1) Nothing depends on the boot-time `fetch(location.href)` — it is gated on `if (!window.__resources)` and **E4.4 set `window.__resources` on all nine pages**, so it has not run since 2026-08-31. (2) `<select>` is unaffected: measured, all 39 `<sc-for>` inside `<select>` survive the parse intact. The actual bug is `<table>`: the parser foster-parents custom elements out, the runtime adopts the mangled DOM, and **`order-sheet.html`'s size grid has been printing with no size columns and no per-size quantities** — just "Qty" and a grand total — on the sheet that tells the press how many of each size to run. Reproduced in a browser, fixed by converting that grid to `display:table` divs, re-verified rendering S/M/L/XL/2XL = 12/40/55/28/9/144. Guarded by `tools/check-dc-templates.mjs`, which fails on the pre-fix file and passes after. |
| **E4.8** | ✅ | **DONE 2026-09-01**, unpushed. Worse than written: because `login.html`'s `componentDidMount` (:125) auto-admits whenever a role + valid name are already in localStorage — setting `screen:'done'` and never showing the PIN pad — Switch Account on `stats.html` was a **complete no-op**. It handed the tapper straight back the previous person's session, unasked for a PIN, on a screen that looked like a successful switch. Now calls `clearIdentity()` first. Verified in a browser: before, `login.html` showed "Welcome, Gian / MANAGER"; after, all three localStorage keys are null, `POST /api/worker-logout` returns 200, and `login.html` shows "Enter your PIN to continue". Swept all nine pages — `stats.html` was the only one broken; `calendar.html` was a false alarm, it binds `onSwitchUser` and clears correctly at :1141. |

### Phase C — Correctness defects

| Id | P | What |
|---|---|---|
| **E5.6** | ✅ | **DONE 2026-09-01**, branch `fix/e5.6-shipnow-race`, unpushed. **Reproduced before fixing:** on the `origin/main` build, opening an order that already has shipments and tapping Ship Now within ~300ms PATCHed `Shipping_Label_Printed__c: true` to Salesforce with the wizard opened to a blank page and never touched. `openOrder()` fires `loadShipments()` without awaiting it, so `(this.state.shipments[id]||[]).length` is **0** while that fetch is in flight; the first 6s poll tick then sees the order's *existing* shipments as new. It only bites on re-ships, second boxes and splits — orders that already have shipments. Now the baseline is fetched fresh, in parallel with the wizard URL so the tab still opens promptly, and the poll only starts when the count is actually **known**. `loadShipments` returns `null` rather than `[]` on failure — "could not tell" is not "zero" — and all three consumers guard it. Verified three ways: old build writes, fixed build with nothing printed does not write, fixed build with a genuinely new shipment still auto-marks. |
| **E5.7** | ✅ | **DONE 2026-09-01**, branch `fix/e5.7-shop-timezone`, unpushed. `SHOP` gains `timeZone: "America/Chicago"`; all `setHours`/`getDay` replaced with `Intl`-based `shopInstant()` / `shopDate()` / `shopParts()`. Runtime UTC confirmed by measurement (`getTimezoneOffset()` 0, `resolvedOptions().timeZone` "UTC" in workerd), and `Intl` with an IANA zone verified working there including DST. **Scope note: `daysUntil()` had the same defect and is also fixed** — it floored both ends onto UTC days, so from 7pm Chicago onward every print date read one day closer, which feeds `urgency()` and therefore the score. **That is a behaviour change: evening scores and suggested days will shift.** Proven runtime-independent — old code gave 4 different answers under 4 runtime timezones (and the *correct* one only on a Central-time laptop, which is why it survived); new code is identical under all 4 and matches inside real workerd. 22 tests. |
| **E5.8** | P1 | `Production_Priority__c` is never written — `_priority-rollup.js` exports two functions no route imports, despite its own header saying otherwise. Either wire it or delete it and remove the field from every sort. Record the decision. |
| **E5.10** | ✅ | **DONE 2026-09-01**, branch `fix/s1-shipment-route-extensions`, unpushed. Three endpoints were unguarded, not four — `run-results` and `run-line-items` already chunk at 25, and `_rework.js` already had head/tail + rollback. Fixed `shipments/split.js`, `shipments/combine.js` and `production-methods/index.js` onto a new shared `_composite.js`. **Split was the worse bug and is not in the original note:** it emits 1 leg + N items + 1 shipment (+1 package) *per box*, so a 20-line order in two boxes already hits 26 — an ordinary order, not a large one. Combine's real ceiling moved from 12 orders to 25. Error reporting needed no work: all five copies already preferred the non-`PROCESSING_HALTED` failure. 16 unit tests on the chunker pass; **the Salesforce-touching paths are untested** (no org credentials locally) and need a real split and combine on staging. |
| **E5.11** | ✅ | **DONE 2026-09-01**, branch `fix/e5.11-clear-scheduled-time`, unpushed. `""` / `null` now writes null, matching `actualStart` — **but the server was only half the bug.** The run-row drawers hard-required both halves, so blanking the schedule failed client-side with "Set the scheduled start date & time" and never sent a request; fixing the API alone would have changed nothing a manager could see. `index.html` and `pre-production.html` `saveRunRow` now accept a fully blank window. Create paths (`submitRunCreate`, and `calendar.html`'s combined create/edit form) deliberately still require it — `production-runs/index.js` rejects a create with no schedule. Clearing is **pair-only**: a half-clear returns `scheduled_window_must_clear_together`, because a run with an end and no start reads as "Not scheduled yet" everywhere and would be invisible and stuck. **Decision (Anthony, 2026-09-01): a clear still lands on `Confirmed`**, so nothing re-books a slot a manager just cleared — the cost is that the run still reads as "On the shop calendar" with no time, and `ProductionEventPublisher` gets an Event with null start/end. **That Apex behaviour is UNVERIFIED** and must be checked under E8.3 before production. |
| **E6.7** | ✅ | **DONE 2026-09-01**, branch `fix/e6.7-text-sanitise`, unpushed. **The vulnerability was reproduced before it was fixed** — the payload's `onerror` executed against the real function in Chrome, from a detached element, exactly as the story said. Now parses with `DOMParser` into an inert document. Trap 6 was the risk: `text()` processes every formula field on every board, so the replacement had to return byte-identical strings. Verified across 14 input shapes — both `HYPERLINK()` formulas, nested tags, entities, `<br>`, multi-paragraph rich text, numbers, null, whitespace collapsing — **all identical, zero mismatches**, then re-confirmed against the shipped `CAApi.text()` rather than a copy. Swept the other two `innerHTML` sites in `ca-api.js`: both take literal icon names and static copy, no Salesforce data. |

### Phase D — Access control, for real

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

### Phase E — Closing the production loop

| Id | P | What |
|---|---|---|
| **E1.4** | P1 | **Needs rewriting before it is built.** As written it asks for produced quantities pre-filled with planned. Decision D1 removed the produced field on purpose. The misprint half already ships in `counting.html`. Rewrite this story as "timer stop routes the operator to the counting screen for that run" — or cancel it and let `counting.html` be the answer. |
| **E2.4** | ✅ | **DONE 2026-09-01**, branch `feat/e2.4-timer-guardrails`, unpushed. `TIMER_MAX_HOURS = 12` (a deploy-time constant, like `WEIGHTS`); past it a timer stops itself, records the **capped** value rather than the runaway one, and says so on the tile. **Deliberately not `stopTimer()`** — stop means "this run is finished" and stamps the run's Actual End, releases the run pick and advances the method to Post-Production. None of that is true when a tile was simply left counting, and moving a job on the board because a timer expired overnight would be a worse bug than the one being fixed. Verified: writes the ceiling once, **zero** status PATCHes, no Actual End. **The ceiling measures one continuous stretch, not accumulated total** — testing caught that against cumulative elapsed the guardrail traps itself (after an auto-stop the elapsed IS the ceiling, so Start re-trips it instantly and the worker can never resume); it also would have stopped a legitimately long job spread over two days. Also caught in testing: stale DEMO timers survive the demo→live transition, and the guardrail was PATCHing `production-methods/GOA-4809` — a demo card id. Now scoped to cards actually on the board, with a re-entrancy guard against two ticks firing before the first `setState` commits. ⚠️ The flag is UI-only — there is no Salesforce field for "this number is not trustworthy"; adding one belongs with E2.3. The **capped value** is the durable half. |
| **E2.5** | ✅ | **DONE 2026-09-02**, branch `feat/e2.5-actual-vs-scheduled` (stacked on E6.6/E6.8), unpushed. New "Actual vs Scheduled" panel on `stats.html`: jobs compared, scheduled hours (`Order.Duration__c`), actual hours (`Print_Setup_Timer__c + Production_Timer__c`), signed variance, plus a per-method table. **No new SOQL** — both figures were already in `production-orders`' SELECT and on the client, so this carries none of the FLS risk of adding a field. **Only finished orders count** (`Status === 'Complete'`); a job still on the press has banked partial hours and would report the shop as permanently ahead. **Untimed jobs are excluded, not counted as zero**, and the excluded count is displayed as prominently as the comparison — "we only timed 6 of 19" is the more useful finding, and averaging in a 0 would report a shop that finishes instantly. **Per-method rows cover single-method orders only**: `Duration__c` is one figure per order, so splitting it across a two-method job would be inventing data. A11y: the Chart.js canvas gets `role="img"` and a generated name, and both it and the new panel get real ARIA data tables (divs with explicit roles — `<table>` is unusable here, `<sc-for>` gets foster-parented out). Verified: unit-tested the arithmetic against crafted records, then drove all four states in a browser (live, all-untimed, nothing-finished, demo) with the a11y tree confirming both tables announce. Also added `--border-card` to `tokens.css` — E10.2 missed it; still a literal `#1b1b1e` in 40 places across seven pages, a mechanical follow-up. |
| **E2.6** | P1 | Verify timer-to-run derivation on multi-run methods. The "which cycle am I on" pointer is derived from run actuals, not stored — elegant, and untested against a real three-run method. |
| **E1.5** | ✅ | **DONE 2026-09-02**, branch `feat/e1.5-line-item-detail` (stacked), unpushed. Two halves in very different states. **The order sheet already had a grid — and it was silently wrong.** It grouped by COLOUR alone and labelled each row with whichever garment arrived first, so black tees and black hoodies on one order merged into a single row. Measured: 50 tees + 15 hoodies printed as "Black · Next Level 3600 Tee · S 12 / M 24 / L 29" — the hoodies appeared **nowhere on the sheet** and the press was told to run 65 of a garment only 50 of which existed. On the one document whose whole job is telling the press what to pull. **The calendar had no line detail at all**, just a piece count; its drawer now shows the same breakdown. Both go through one new `sizeGrid()` in `ca-api.js`, grouped by garment **and** colour, so the screen a run is booked from and the sheet the press works off cannot disagree. It also **sorts** the rows — `/api/order-sizes` has no `ORDER BY`, so the same order could previously print its rows differently on different days. Calendar data is fetched per-order **on drawer open**, deliberately not added to `/api/calendar`'s bulk OrderItem roll-up: a drawer is a click, the board is the thing that must never go blank (rule #1). Loading / failed / genuinely empty are three distinct messages. ARIA table roles on the new grid. Verified in a browser across all three states plus the printed sheet. Zebra striping re-keyed to colour — with colours now repeating, index striping rendered two "BLACK" tags differently. |

### Phase F — Pre-production automation *(the biggest feature still unbuilt)*

| Id | P | What |
|---|---|---|
| **E3.1** | ✅ | **DONE 2026-09-01**, `BEGIN-SETUP-INVENTORY.md`. No new queries needed — `/api/inbox` already returns everything with a source, and five fields come back unused. Of seven form inputs: 2 prefilled, 1 inferable (Print Method, via `Printer__r.Name`), 4 with **no source** and no way to get one. |
| **E3.2** | ✅ | **DONE 2026-09-01**, branch `feat/e3.2-prefill-begin-setup`, unpushed. Scoped by the E3.1 inventory: only specs and notes have a source, so the story is the prefill *mechanics*, not new prefills — the method inference belongs to E3.3. **"Reopening must not overwrite a manual edit" was a live bug, reproduced first:** `updateOrderFieldLocally()` refreshes `st.orders` but not `st.inbox`, and `pickInbox()` seeds from `st.inbox` — so editing the specs, going back to incoming and reopening the same order returned the ORIGINAL text, and `submitMethod()` would then flush that stale value back over the edit already in Salesforce. New `updateInboxFieldLocally()` keeps the cache truthful. Both prefilled fields now carry a **"From Salesforce"** marker that clears on the first keystroke. Verified in a browser: both marked on open, typing in specs left only the notes marker, and the edit survived a reopen. **"Never guessed" already held** — no method or placement is pre-selected and the items list is empty; confirmed by computed style, all four method buttons identical. |
| **E3.3** | ✅ | **DONE 2026-09-01**, branch `feat/e3.3-method-suggestion`, unpushed. **Found a live wrong guess while building it:** `methodOf()`'s heat pattern contained a bare `press`, so `Press 1`, `Press 2`, `10 Head Press` and `6 Head Press` — the shop's four SCREEN PRINT presses per `PRESS_GROUPS` — were confidently classified **Heat Press**, and that is what the Method chip printed on the order sheet that goes to the floor. Patterns are now aligned with the server's `PRESS_GROUPS` (which requires a qualifier: `(heat\|hat\|shirt)\s*press`); proven by a matrix where client and server agree on **18/18** names the server has an opinion about, 0 disagreements. New `methodGuess()` returns `{type, key, confident, from, reason}`; `methodOf()` is a wrapper over it and is **provably unchanged** — 108 records, 0 differences — so the only behaviour change anywhere is those four names, each of which was wrong. Form: pre-selects only when confident with an amber *"Suggested from press X — check it"* chip, blank otherwise with the reason spelled out (`no-match` vs `no-press-name`), and picking by hand clears the label. **Placements deliberately get no suggestion** — the E3.1 inventory established there is no source to infer one from. |
| **E3.4** | ✅ | **DONE 2026-09-01**, branch `fix/e3.4-nested-orderitems`, unpushed. The nested `(SELECT ... FROM OrderItems)` is gone; line items now come from a flat `WHERE OrderId IN (...)` follow-up, which has only top-level pagination — the kind `runQuery` already handles — so the 200 cap disappears rather than moving. This is the pattern `orders/index.js` and `production-orders/index.js` already used for the same data; **the inbox was the last nested subquery in the API.** The IN list is chunked at 200 Ids so the fix doesn't create a sibling of E5.12 (unbounded IN blowing the query-URL limit). A failed item fetch fails open — the inbox still lists its orders — but sets `OrderItemsError` so an empty breakdown isn't mistaken for an order with no garments. 18 tests, including a simulated 400-line order returning all 400. |

### Phase G — Production promotion *(gated on E7.2)*

| Id | P | Owner | What |
|---|---|---|---|
| **E7.3** | P1 | Salesforce | Consolidate Print Location onto a Global Value Set. Four independent local copies today, six once production exists, plus two code copies. Cheapest it will ever be is before production. |
| **E7.6** | ✅ CLOSED | Salesforce + App | **INVESTIGATED 2026-09-02. The original premise is wrong, and what is actually happening is worse.** The formula in dev2 reads, verbatim: `IF( ISBLANK(Duration__c), Print_Date__c +(2/24), Print_Date__c +(Duration__c/24))` — so a 2-hour fallback **does** exist, and `Duration__c` **does** reach the formula: of 20 scheduled orders, the 5 with a duration set (1, 3, 4, **4.5**) have `Print_End_Date_Time__c − Print_Date__c` **exactly equal** to it. 4.5 surviving also settles the decimal-places worry — **not the problem here.** ⚠️ **But the other 15 orders (75%) have `Duration__c` null and an end time EXACTLY equal to their start time — a zero-hour gap, where the formula says +2h.** Both boards prefill run Scheduled End from this field, so for three orders in four the New Run form opens with **Scheduled End == Scheduled Start**. Worse, `runDurationHours()` in `_priority.js` assumes **2 hours** in exactly this case (its comment claims that is "the same default `Print_End_Date_Time__c` already uses" — **that comment is wrong**), so the scheduling suggestion reserves 2h while the form prefills 0h, for 75% of orders. ✅ **ROOT CAUSE FOUND.** The SOQL was run against order `801ca00000T4m0aAAB`: `Duration__c` is **blank** and `Print_End_Date_Time__c` returns `2026-08-19T12:15:00Z` — **identical to `Print_Date__c`**, not +2h. The mechanism is Salesforce's **blank-field handling**: the "treat blank fields as zeroes / as blanks" option is only offered for formulas returning Number, Currency or Percent. This formula returns **Date/Time**, so the option is not shown — confirmed by opening the formula editor, where no such radio group exists — and Salesforce defaults to **treating blank number fields as zeroes**. `Duration__c` is therefore coerced to `0` *before* `ISBLANK` sees it, `ISBLANK(0)` is **false**, and evaluation always takes the second branch: `Print_Date__c + (0/24)` = `Print_Date__c`. 🚩 **The 2-hour fallback is dead code. It has never once executed since the field was created on 12 Jan 2023.** ✅ **FIXED IN DEV2 2026-09-02 by Anthony**, and independently verified. The formula is now `IF( Duration__c > 0, Print_Date__c + (Duration__c/24), Print_Date__c + (2/24) )` — testing the value rather than asking `ISBLANK` about one that has already been coerced, so blank and zero both fall to the 2-hour branch and a real duration still wins. **Verified twice over two different connections:** Anthony's Query Editor as himself, and the app's own read as the integration user over OAuth. Across the 20 orders on the calendar, **zero-hour gaps went 15 → 0**; the distribution is now 2h×15, 1h×2, 3h×1, 4h×1, 4.5h×1. Control checks: order `00013478` (blank duration) moved 12:15 → **14:15**, while `00013499` (4.5h) and `00013501` (4h) are **byte-identical to before** — the orders that already worked were not disturbed. All eight read endpoints still return JSON with real rows. **Staging: the same edit was applied by Anthony 2026-09-02.** ⚠️ Recorded on his word — staging is not reachable from browser automation, so unlike dev2 it has **not** been independently verified. E7.1 is the precedent for why that matters (dev2 done, staging assumed, story sat half-finished). **To make it airtight:** run the same two queries in staging — one blank-duration order should now show a 2-hour gap, one order with a real duration should be unchanged — and log the date and result in `VALIDATION-INTEGRATIONS.md`. **App half also DONE and LIVE.** `runFormWindow()` in `ca-api.js` floors the end at start + `RUN_FALLBACK_HOURS` (= 2, per D6) whenever `Print_End_Date_Time__c` is missing, unparseable, or not strictly after the start; `index.html` uses it in place of two bare `splitDT()` calls, and the false comment in `_priority.js` is gone. Verified on `origin/main` **and on the deployed site** — `runFormWindow` is present in the live `ca-api.js` and referenced by the live `index.html`. **Production is the only org left, and it belongs to E7.4** — it has none of this metadata yet, so the formula travels with that promotion rather than as a change of its own. ✅ **FORMULA FIXED BY ANTHONY 2026-09-02.** ✅ **APP HALF DONE 2026-09-02**, branch `feat/e7.6-run-end-floor`, unpushed — `runFormWindow()` in `ca-api.js` floors the New Run end at start + 2h whenever `Print_End_Date_Time__c` is missing, equal to or before the start; used by `openRunCreate()` (index) and `defaultRunForm()` (pre-production), and `runDurationHours()`'s false comment is corrected. Verified in a browser on both pages: the zero-gap order prefills 07:15→09:15, a healthy 4.5h order passes through 07:15→11:45 untouched, and feeding the guard's own output back in changes nothing. **Original note, kept for the record — an app-side story for Claude Code:** `openRunCreate()` prefills Scheduled End straight from this field, so it must never seed an end equal to or before the start; and `runDurationHours()` in `_priority.js` carries a comment claiming 2 hours is "the same default `Print_End_Date_Time__c` already uses", which is **false** and should be corrected whichever way the formula lands. |
| **E7.4** | P0 | Peter Larson | Promote the full metadata set to production. Production has **none** of it — no Apex, no `Proposed_Run__c`, no calendar setting, no priority fields, no `Print_Location__c`, no flows. Promote from staging. **After deployment, by hand:** FLS for every new field (change sets deploy fields with FLS off) and permission-set assignments (assignments never travel). A clean "Deployment succeeded" is **not** evidence of either. The `Planned` value must exist in the restricted `Auto_Scheduling_Status__c` picklist before the app is pointed at production. 📌 **Carry E7.6's corrected formula with this promotion.** `Order.Print_End_Date_Time__c` must read `IF( Duration__c > 0, Print_Date__c + (Duration__c/24), Print_Date__c + (2/24) )` — **not** the original `ISBLANK` version, whose 2-hour branch can never execute because a Date/Time formula gets no blank-field-handling option and Salesforce coerces blank numbers to zero. If production is built from an old change set, this regresses silently and every order without a duration gets a zero-length print window again. |
| **E7.5** | P0 | Ops | Configure the production environment in Cloudflare. `SF_ENV_PRODUCTION_LOGIN_URL` / `_CLIENT_ID` / `_CLIENT_SECRET` from a production Connected App, with the Client Credentials run-as user chosen deliberately and its FLS reviewed. `SF_ZK_ORDER_FIELD_ID_PRODUCTION` is a per-org metadata Id that does **not** migrate with a change set. Verify the switch *back* to staging too — that is the rollback. |
| **E7.7** | P2 | Salesforce | `ProductionRunTrigger` is after insert/update only, so deleting a run inside Salesforce skips `OrderPrintDateRollup` and leaves `Print_Date__c` stale. The app's delete path handles it; the Salesforce UI path does not. |
| **E7.8** | P2 | Salesforce | Decide the fate of `OrderScheduling`'s `CreateCalendarEvent` — keep it and document the duplicate-event behaviour, or remove it and let `ProductionEventPublisher` own the calendar end to end. |

### Phase H — Validation *(no code, and it is the actual gate)*

| Id | P | What |
|---|---|---|
| **E8.1** | 📝 | **CHECKLIST WRITTEN 2026-09-02 — `VALIDATION-INTEGRATIONS.md`. Not yet run: writing it is the artifact, running it is the validation.** 40 items over **eight** surfaces, not seven — access and identity is the one that tends not to get counted, and it is the seam that is currently open. Every item names the expected Salesforce record state, and the stored picklist values in its appendix were read from live dev2 data and dev2 Setup rather than copied from the code, so no item asserts a value that does not exist. Carries the run log. **Next: run it in full against staging, with date, org and result recorded.** |
| **E8.2** | 📝 | **SCENARIOS WRITTEN 2026-09-02 — `VALIDATION-SCENARIOS.md`. Not yet run.** All eight scripted, each naming the record state expected at every checkpoint **and its false pass** — the specific way it can look right while being wrong, drawn from bugs that have already shipped here (the Heat Press mis-classification reaching the order sheet; `combine.js` breaking only past twelve orders; a reprint failure wearing the "nothing to do" shape). S6 proves the reprint loop all the way round and records D5's reference-only rule as a check. ⚠️ **S6 is expected to FAIL at the make-up run step until B3's error-surfacing fix lands** — that is known, not a surprise. **Next: run S1–S8 against staging.** |
| **E8.3** | P1 | Prove coexistence with the auto-scheduler. A `Planned` run's times survive a scheduler run; a Confirmed run publishes and un-confirming deletes; a Proposal-status run is still moved, as intended; press occupancy accounts for `Planned` runs so it doesn't double-book. Partially evidenced by the PR-0085 test — finish it. |
| **E8.4** | P1 | Shipping and Zenkraft validation. Least-exercised board, no manual retry, polls every 6s for up to four minutes, carries E5.6 and E5.10. |
| **E8.5** | ✅ | **DONE 2026-09-01**, branch `fix/e8.5-smoke-script`, unpushed. `node tools/smoke.mjs` — **2.4 seconds**, no network. Seven checks, every one an incident that really happened: an asset referenced but not committed (`tokens.css`, twice), an extensionless route file (S1), an import that does not resolve or is untracked (`_placements.js`'s near-miss), server modules that do not parse, board logic that does not parse (caught a real break during E4.5), plus `check-dc-templates.mjs` and `contrast.mjs` folded in. **Verified by replaying all eight failure modes in a throwaway worktree — 8 caught, 0 missed, and the clean tree passes.** Untracked files with broken imports warn rather than fail, which surfaces the `_to_delete` import that silently breaks `wrangler pages dev` without blocking a push. Install as a pre-push hook; hooks are not tracked, so each clone opts in. |
| **E5.12** | ✅ | **DONE 2026-09-01**, branch `fix/e5.12-calendar-in-lists`, unpushed. Both halves done. **Four** unbounded IN lists, not one — runs by method, OrderItem, `Proposed_Run__c` and `Pre_Production_Item__c` — all now go through a new shared `runChunkedIdQuery` in `_sf.js` (200 Ids/chunk). The runs one needed *splitting* rather than chunking: it was `(date range) OR PrintMethod__c IN (...)`, and chunking that in place re-runs the range half per chunk, so it is now one range query plus chunked method queries merged through a Map keyed on run Id. **And it would have failed invisibly** — an over-long URL is an HTTP rejection, not a SOQL error, so the whole block fell into its `catch` and the calendar rendered with no runs and no explanation. Window span capped at `MAX_RANGE_DAYS = 366` (clamped, reported in `window.clamped`; the client never asks for more than 6 days), and `to` before `from` now returns `to_before_from` instead of reading as an empty shop. `inbox/index.js` converted off its own E3.4 chunk loop onto the shared helper — its 18 tests re-run green. 13 calendar + 10 helper tests. |
| **E5.13** | ✅ | **DONE 2026-09-01**, branch `fix/e5.13-stale-comments`. Only one of the three cited comments was actually stale (`production-runs/index.js`); `orders/[id].js` was accurate and left alone, and `calendar/index.js:327` was the wrong location. `SELECTOR-CHANGE.md` rewritten — its Apex steps are still needed for staging and production, but its verification pressed buttons removed on 2026-08-21. |

### Phase I — Shop-floor readiness and the pilot

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

## Part 4 — Decisions already made, and one still open

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

**Still open — cleared allocation rows.** Today a cleared size is set to `Planned_Qty__c = 0` and the
row is never deleted, so zero rows still render on the counting screen. The alternative is deleting
non-last rows and zeroing only the final one. Setting to zero is reversible and does not reach into
the Flow's output; deleting is tidier on screen. **Anthony's call, and nobody is blocked on it.**

---

## Part 5 — Who owns what

- **Anthony** — pushes to `main` himself and runs his own tests. Owns E6.4 and E7.5 (ops), the env
  switch, and every product decision.
- **Peter Larson** — Salesforce flows and Apex. Owns E7.2 (the long pole) and E7.4.
- **Claude Code** — everything in the App track: Phases B, C, D, E, F, and the code half of H.
- **A Claude project with Salesforce browser access** — the live org work: E7.1's staging half,
  E7.3, E7.6, and running the E8 checklists against a real org.

**Staging is currently unreachable from browser automation.** The Chrome extension needs permission
on `cultureapparel--staging.sandbox.lightning.force.com`, `...my.salesforce-setup.com` and
`...my.salesforce.com`. Grant those three before the staging pass. Staging also still has
`Quantity_Completed__c` and `Reprint_Quantity__c`, which should be deleted.

---

## Part 6 — The traps (short version — full text in `CLAUDE.md`)

1. **An FLS-hidden field is a parse error, not a blank column.** Naming a field the integration user
   can't see makes the *entire* SELECT fail with `No such column 'X' on entity 'Y'` — identical
   wording to a genuinely missing field. The whole board empties. This has bitten the project four
   times. Only the field named after the `^` is the offender. Use `runQueryOptionalField` from
   `_placements.js`, or put the feature on its own endpoint that can answer `available:false`.
2. **`__r` relationship names are not guessable.** `PrintMethod__r` has never existed in any org —
   the relationship is `Production_Runs`. Use a semi-join or an explicit follow-up query. A wrong
   guess surfaces as zero rows, which reads as "nothing to do today."
3. **`/composite` returns HTTP 200 even when every sub-request failed.** Inspect
   `compositeResponse` entry by entry. With `allOrNone:true`, innocent sub-requests report
   `PROCESSING_HALTED` — reporting the first failure in array order names a bystander. Hard cap 25.
4. **`Quantity_Planned_c__c` is the real API name.** The double `_c__c` is correct. Do not "fix" it.
5. **Picklist values are not their labels.** `Order_Substatus__c` "In Production" stores as
   `Production`. `Shipping_Delivery__c` "Local Dropoff" stores as `Delivery`. `Order.Status` is
   `'Complete'`; `Production_Method__c.Status__c` is `'Completed'` — with the "d". These picklists
   are **restricted**, so a drifted copy 400s with `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST`.
6. **Formula fields return HTML.** `GOA_Order_Number__c` and `Customer_Order_Name__c` come back as
   `HYPERLINK()` markup. Everything from a formula field goes through `api.text()` first. No
   exceptions — this has shipped as a visible bug twice.
7. **Deliberately excluded fields — leave them out.** `Reject_Reason__c` and `Notes__c` on
   `Production_Run_Line_Items__c`; `Pre_Production_Item__c.Notes__c`.
8. **Never add `Last_Updated_By__c` to `Production_Method__c` or `Pre_Production_Item__c`.** It
   exists on `Order` only. Adding it made `_rework.js`'s head composite fail — and only when a worker
   name was present, so the first test passed. Attribution for a method is `CreatedBy`.
9. **Runs are inserted `Planned`, then PATCHed to `Confirmed`.** Never born Confirmed. Every write
   must end at `Confirmed`.

---

## Part 7 — Verifying a change

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

## Part 8 — Rules of engagement

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
