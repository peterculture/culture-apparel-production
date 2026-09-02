# NEXT-STEPS.md — the current work queue

Companion to `CLAUDE.md` (read that first — it has the traps). This is the ordered queue and the
context needed to work it without the Path-to-Pilot PDF in hand.

**Originally written 2026-08-28** from a full repo read plus the Path to Pilot plan (prepared
26 Aug). **Rewritten 2026-08-31: week 1 (Q1–Q9) and week 2 (W1–W5) are both complete.**
What is left is in "Still owed" and "Not in this queue" below — decisions, live checks, ops
and Salesforce, plus E1.3/E1.4 from the plan. Line numbers are hints — **search by symbol name**, this repo changes daily.

---

## Status: where the plan and the repo disagree

The plan's E1 ("Production Run Line Items") says *"Nothing exists today — no object, no endpoint,
no UI."* That was true at its 26 Aug repo read and stopped being true the next day. These files
were all written on **27 Aug**, after the plan was prepared:

```
functions/api/run-results/index.js     counting.html
functions/api/shortfalls/index.js      functions/api/_rework.js
functions/api/rework-check.js
```

Anthony has confirmed the Salesforce side of E1 is done. So treat E1 as **built differently than
specified**, not as unbuilt:

| Plan says (E1.1) | What actually exists |
|---|---|
| `Production_Run_Line_Item__c` | `Production_Run_Line_Items__c` (plural) |
| `Quantity_Planned`, `Quantity_Produced`, `Quantity_Misprint` | `Planned_Qty__c`, `Incomplete_Qty__c`, `Misprint_Qty__c`, `Damaged_Qty__c` |
| A new `/api/production-run-items` route | `/api/run-results` (GET list, GET one, POST submit) |

E1.1 and E1.2 are effectively done. **E1.3** (the allocation grid — choosing which sizes a run
covers) genuinely does not exist and is still open. **E1.4 must not be built as written** — see the
decisions section.

---

---

## Decisions

**D1 — DECIDED 2026-08-31: no produced/good/complete field, ever. E1.4 as written is REJECTED — IMPLEMENTED.**

The Path to Pilot's E1.4 ("produced quantities, pre-filled with planned") is rejected and should be
treated as closed, not deferred. The deployed model deliberately has **no produced/good/complete
field**: only problems are recorded, and what went right is whatever is left over. That invariant
stands — `Result_Status__c` (`Draft` → `Submitted`) remains the ONLY evidence a human counted,
which is what keeps a perfect run distinguishable from an untouched one.

What ships instead: the counting screen displays an **implied produced figure as read-only text**,
per run —

    planned − (incomplete + misprint + damaged)

computed at render time. It is **never stored, never written to Salesforce, never editable**, and
**no field is added** to `Production_Run_Line_Items__c` or `Production_Run__c` for it. If a future
story asks to persist this number, it is re-opening D1 and needs the product owner again.

**Shipped 2026-08-31** in `counting.html` as a "Good · implied" tile leading the tally strip,
computed from what is in the boxes so it moves as the operator types. Negative is shown as-is (in
red) — more losses than planned is real and the row warning already flags it. Also shipped with it:
zero-planned rows are hidden from the counting grid behind a "Show all sizes" toggle (default off,
count always visible), because a press operator must not be offered a countable box for a size this
run is not printing — and the over-allocation warning cannot fire on such a row anyway.

**D2 — `Partial_Check_in_Missing_Items__c`. DECIDED 2026-08-28, IMPLEMENTED (Q4).**
Anthony's call: give the tablet a field. Workers must be able to record *what* is short at
count-in, not just that an order is partial. See Q4 below for the rule that came out of it.

**D3 — DECIDED 2026-08-31: build E1.3, the allocation grid, keyed to `OrderItem` rows
(size/colour).**

A run must show **both** a total garment count and the per-size breakdown. The total is **DERIVED
from the line items and never independently typed** — one source of truth, so the two cannot drift.
The grid pre-fills each size from the order's remaining unallocated quantity; the manager edits
down from there.

⚠️ **A Salesforce Flow already owns line-item creation.** See "E1.3 · the Flow collision" below
before writing any of this — the app must not become a second writer of the same rows.

---

## E1.3 · the Flow collision — investigated 2026-08-31, NOT yet built

`Production_Run_Generate_Line_Item_Skeleton` (active in dev2 + staging) creates
`Production_Run_Line_Items__c` on run create, computing each size's planned quantity as
*order size qty − what earlier runs on the method already planned − `Incomplete_Qty__c`*.

**The repo already knows about this Flow and already defers to it.** Two comments say so:

- `run-results/index.js` — "`Planned_Qty__c` is deliberately NOT writable here: it is generated
  with the skeleton when the run is confirmed, and it is the yardstick the counts are measured
  against."
- `ca-api.js` — "Note what is NOT here: a setter for `Planned_Qty__c` … Correcting a wrong Planned
  Qty is a Salesforce job, on purpose."

**There is no line-item write endpoint in the app at all today**, and nothing creates these rows.
So the collision is not yet real — it becomes real the moment E1.3 is built.

### What this changes about E1.3

1. **The Flow already computes D3's pre-fill.** "Remaining unallocated for this size" is exactly
   what it subtracts. The app must DISPLAY what the Flow produced, not compute a second opinion
   from the same inputs.
2. **`Total_Planned_Qty__c` already exists on `Production_Run__c`** and is already returned by
   `/api/run-results` as `totalPlanned`, sitting alongside `Total_Incomplete/Misprint/Damaged_Qty__c`.
   If it is a roll-up summary (unconfirmed — see below), then **D3's "total derived from the line
   items" is already true server-side** and the app only has to stop showing the other total.
3. **There are TWO totals on a run and they can drift** — which is the thing D3 forbids:
   `Quantity_Planned_c__c` (writable, typed by the manager at create, and PATCHed again by the
   drawer's Total Garments field) versus `Total_Planned_Qty__c` (the line-item total).
4. **D3 reverses a documented decision.** The app will now write `Planned_Qty__c` from the
   allocation grid. That is a manager allocating at run setup — a different actor and moment from
   the counter reporting a loss. The `run-results` prohibition must STAY: separate the two writers
   by FIELD, not just by endpoint.

### Unknowns — must be answered before building (Anthony / Peter Larson)

1. **Trigger point.** The brief says "on create"; both code comments say "when a run is
   confirmed". The app INSERTS `Planned` then PATCHES to `Confirmed` a moment later (see
   `publishRun()` and CLAUDE.md rule 9), so those are two different trigger types about a second
   apart. Which is it?
2. **Does it re-fire on update?** The drawer's Total Garments PATCHes `Quantity_Planned_c__c`
   today (`production-runs/[id].js`). If the Flow runs on update, that PATCH could regenerate or
   duplicate rows.
3. **Does it delete/replace existing rows, or only insert?**
4. **Does it populate `Order_Product__c`?** `_rework.js` filters on it — a line item without it is
   silently dropped from the reprint, so a row the app creates MUST set it.
5. **Is `Total_Planned_Qty__c` a roll-up summary** (read-only), a formula, or a number the Flow
   writes?
6. **Which field does its "earlier runs already planned" read** — `Quantity_Planned_c__c`, or the
   sum of those runs' line items? If the former, changing line items without updating it breaks
   the Flow's arithmetic for the NEXT run.

### Proposed approach (pending the answers above)

**Let the Flow create; the app PATCHes quantities onto what it made.** The app does not become a
second creator in the normal path.

- New `/api/run-line-items`: GET by runId, PATCH quantities. Allow-list of exactly
  `Planned_Qty__c` — it must never be able to write the three count fields, which belong to
  `/api/run-results`. Chunked at the 25 sub-request composite ceiling.
- Show `Total_Planned_Qty__c` as the run total; make the drawer's Total Garments read-only
  whenever line items exist.
- The grid renders the Flow's own numbers. `/api/order-sizes` already returns `Id`, `Size__c`,
  `Color__c` and `Quantity` — no SELECT change, so CLAUDE.md rule 1 is not in play.
- **Insert is the one exception**: a size the Flow made no row for (fully allocated by earlier
  runs) needs one if the manager allocates to it. That row must carry `Order_Product__c`.
- **Clearing a quantity: recommend setting `Planned_Qty__c = 0` rather than DELETING.** A zero row
  is not a loss (`_rework.js` filters `qty > 0`), it keeps the skeleton the Flow owns intact, and
  it is reversible. Deleting a Flow-created row is the app reaching into another system's output.
  Trade-off: zero rows still render on the counting screen. **Anthony's call.**
- **Timing.** The Flow's rows are created asynchronously relative to the app's create response, so
  the grid cannot assume they exist the instant Create Run returns. Poll for the skeleton (the
  pattern `index.html`'s Zenkraft poll already uses) rather than racing it.

## Week 1 — COMPLETE (Q1–Q9)

All nine landed 2026-08-28 to 08-31, each verified locally. Details below are what is worth
remembering, not a changelog — the code and its comments are the record.

| # | Story | Landed |
|---|---|---|
| Q1 | `E6.1` SOQL injection in production-methods GET | `SF_ID` guard on the GET **and** the POST |
| Q2 | `E5.1` method edit / order stage | `orderId` now sent from both boards |
| Q3 | `E5.2` 'Local Dropoff' delivery picklist | one option per stored value, server rejects the label |
| Q4 | `E5.5` garment-station missing items | key-presence write + tablet input |
| Q5 | `E5.3` cancelled calendar drag | `endDrag()` on all four exits |
| Q6 | `E5.4` demo fixtures in live mode | fixtures only when `connection === 'demo'` |
| Q7 | `E4.7` order sheet printed sample data | unresolvable order renders no `doc-page` at all |
| Q8 | `E6.3` cleartext manager PIN | server-checked; `confirmManager()` is now **async** |
| Q9 | `E6.2` mockup-proxy open proxy | host allow-list + per-hop redirect validation |

**Four things from that work that are still load-bearing:**

1. **`confirmManager()` returns a Promise.** Every call site must `await` it — `!somePromise` is
   always false, so an un-awaited guard silently confirms nothing while looking healthy. All 11
   sites are converted. If you add one, grep the identifier and check it.
2. **Q4's write rule:** presence of the `missing` key is the *only* gate on
   `Partial_Check_in_Missing_Items__c`. Status decides nothing, and **nothing auto-clears the
   note**. `missingAtStage` in `_station.js` is a UI hint only. Do not "restore" the status-based
   clear without asking — it is a product decision.
3. **Q2's original premise was wrong.** `production-methods/[id].js` already falls back to
   `orderIdForMethod()` when `Status__c` changes without an `orderId`, so the rollup fired either
   way. It was never "actively corrupting live data" and no correction pass is owed.
4. **Q3 needed no Salesforce work.** It was parked for a day as blocked on the org; the picklist
   was already correct and already confirmed live in Setup 2026-08-10, recorded in
   `functions/api/shipping-orders/index.js`'s header. **Before deferring anything as blocked on
   Salesforce, grep the Functions headers — several record live Setup findings.**
   No data cleanup is expected either: the picklist is restricted, so the literal `Local Dropoff`
   was rejected by Salesforce rather than stored. Confirm with
   `SELECT Id FROM Order WHERE Shipping_Delivery__c = 'Local Dropoff'` (expect zero) if it matters.

### Still owed on week 1 — needs a live org, not code

- **One Partial tap in dev2** with a missing-items note. Settles write-side FLS on
  `Partial_Check_in_Missing_Items__c` (read access is already proven — it is in two SELECT lists).
- **That field's real length.** The endpoint truncates at `MISSING_MAX = 255`. If it is a Long
  Text Area, that is silently lossy — check Setup and correct the constant.
- **`ACCESS_ENFORCE` decision.** `confirmManager()` confirms via `POST /api/worker-login`, which
  also issues the signed `ca_sess` cookie — so a successful confirmation leaves the tablet's
  *server* session as that manager. Inert while `requireCap` is report-only; needs an answer
  before enforcement is switched on. (Reusing that endpoint was the story's own instruction.)
- **`results.submit` capability** must be granted before `ACCESS_ENFORCE=1` regardless — see
  CLAUDE.md's warning. It is in exactly one place in the codebase: the check itself.

---

## Week 2 — the active queue

Theme: **the app must stop silently lying about whether a tap saved.** Every claim below was
re-verified against the code on 2026-08-31.

### W1 · Recovery from demo mode  `E4.1` — DONE 2026-08-31

Every board's auto-refresh is gated on being live, so the refresh that would restore a board is
itself unreachable once that board has fallen back. Confirmed on all six:

```
index.html          connection==='live' && !openId && !dragId
pre-production.html connection==='live' && !openId && view!=='mgr'
calendar.html       conn==='live'       && !openId && !dragging
shipping.html       connection==='live' && !modalId
station.html        connection==='live' && !modalId
counting.html       connection==='live' && !runId
```

A board that drops to demo once stays there — showing plausible fake numbers behind an amber chip
— until someone reloads the page. On a wall-mounted tablet nobody reloads.

**Landed:** `CAApi.shouldPoll(connection, key)` is the single gate. Live boards poll every tick
as before; a demo board retries every 5th tick. Per-key tick counters. All six boards wired
(`stats.html` was already ungated). Verified by killing and restoring the API mid-session: the
board went demo → live with no reload.

**Beware when testing this:** the Browser pane reports `document.hidden`, so Chrome throttles a
page's `setInterval` to ~once a minute and a polling test looks broken when it is not. Check
`document.visibilityState` before believing a timing result.

### W2 · Real error reasons out of `jget` / `jdel`  `E4.2` — DONE 2026-08-31

`jsend` was fixed 2026-07-28 to parse the failure body and attach `err.status` + `err.data`
(`ca-api.js`, around the `jsend` definition). **`jget` and `jdel` were not** — both still throw a
bare `Error('GET ' + url + ' -> ' + r.status)` with no status and no body, so every endpoint's
`{error, detail}` is discarded on read and delete paths.

**Landed:** extracted `httpError()` and routed all three helpers through it, so each attaches
`status`, `data` and a new `detail` (the server's own message). A non-JSON body degrades to no
detail rather than throwing a parse error on top of the failure.

### W3 · No phantom saves  `E4.3` — DONE 2026-08-31

~20 write paths run their optimistic local update and then return early when not live, so the UI
shows the change and Salesforce never hears about it. Roughly: index 10, pre-production 10,
calendar 4, station 4, shipping 3, counting 2 guarded sites (that count includes refresh gates,
so audit rather than trusting the number).

Q4's missing-items save is the pattern to copy — in-flight, saved, or failed with the text still
in the box, and the control disabled with a stated reason in demo mode.

**Landed:** `CAApi.toast()` gives the app the notification surface it never had — that absence is
why every board swallowed. `canWrite()` / `reportBlockedWrite()` / `reportFailedWrite()` are the
standard reporters, and each board has a `canWriteNow()` / `writeFailed()` pair. Every write path
on all six boards now reports both halves. Destructive ones (packaging, production items,
shipments) roll the optimistic change BACK on failure. The toast is `pointer-events:none` except
its dismiss button, so it cannot swallow a tap meant for the drawer footer underneath it.

**Not done, deliberately:** controls are not *disabled* in demo mode, except the missing-items box
from Q4. Demo mode is also how the boards get demonstrated, and disabling ~40 controls would break
that while the toast already removes the lie. Worth a decision if you disagree.

### W4 · The unpkg single point of failure  `E4.4` — DONE 2026-08-31

React, ReactDOM and Babel all load from `unpkg.com` (`support.js`, `src/cdn.ts` section). unpkg is
down and every board is a white page. Tabler icons come from `cdn.jsdelivr.net` and fonts from
Google Fonts in every page's `<helmet>`.

**`support.js` is GENERATED and must not be hand-edited, and `dc-runtime/` is NOT in this repo** —
so the obvious fix is unavailable. But it does not need editing: `cdnScriptFor()` reads
`window.__resources[url]` and uses that value instead when it is a non-empty string. Setting
`window.__resources` in an inline script *before* `support.js` loads redirects all three to
self-hosted copies with no change to the generated file.

**Landed:** React and ReactDOM are self-hosted in `vendor/` and mapped through
`window.__resources` in an inline block before `support.js` on all nine pages. `support.js` itself
is untouched. Both files were verified byte-identical to what unpkg served, against the SRI hashes
`support.js` already pins.

Two notes. The override path drops the `integrity` attribute (`cdnScriptFor` returns `{src}` only)
— acceptable now that the files are same-origin behind the same TLS and Cloudflare Access
boundary. And **Babel is deliberately not self-hosted**: `support.js` only fetches it for `jsx`
script blocks and no page has one (every block is `type="text/x-dc"`), so its 2.9 MB is never
requested. Add it to the map if a JSX page is ever introduced.

### W5 · Extract the shared run-row module  `E10.1` — DONE 2026-08-31

The Production Runs row is duplicated between `index.html` and `pre-production.html` and has
already drifted once this month (`pre-production.html` was missing `orderId` on the method save —
Q2). Same story for `saveMethodEdit`.

**Landed:** `ca-api.js` now owns `runRecordFromApi`, `runEditFieldsFromRecord`, `splitDT`,
`buildRunDateTime` and `runScheduleStatus`. Both boards keep their own setState handlers — what
they no longer keep is their own idea of the shape. The boards' `splitDT` / `buildRunDateTime` /
`runEditFieldsFromRecord` are now one-line delegations, so every existing call site still works.

**It had already drifted, in a way that mattered.** `schedStatus` was mapped on pre-production and
NOT on index, so the production dashboard could not tell a published run from one whose calendar
publish had failed — while `production-runs/index.js`'s own comment claimed "every board reads it
… to warn when a run never made it onto the calendar". It didn't. index.html now shows the status
line and the publish-failed warning, same wording as the other two surfaces. The wording itself had
three copies (two inside pre-production.html alone); now it has one.

---

## Follow-ups worth a story

- **On-Time % needs a schema change.** The KPI was removed from `index.html` on 2026-08-31 rather
  than faked (see CLAUDE.md's rough-edges entry). It needs a real Shipped/Completed date on Order;
  `LastModifiedDate` is not good enough for a headline percentage.
- **`q()` in `_rework.js` / `rework-check.js` / `run-results/index.js` / `shortfalls/index.js`**
  strips quotes but passes backslashes through. No leak — you cannot reopen a literal with no
  quotes — but a trailing `\` can corrupt a query into a parse error. Small hardening story.
- **`culture-apparel-handoff.md`** (517 lines) is the same generation as the three stale analysis
  docs deleted 2026-08-31 and is probably as stale.

## Not in this queue

Week-1 items that are **not code** — Anthony or Peter Larson, not here:

- **E6.4** — Cloudflare Access on the Pages project; `SESSION_SECRET` and `SF_ENV_SWITCH_PIN` set. Ops.
- **E7.1** — `Production_Calendar_Setting__c.Calendar_Owner_Id__c` in dev2 and staging. Salesforce.
- **E7.2** — Apex test classes to clear the 75% gate. Salesforce, and the long pole; it gates the
  production deployment entirely.

Also open, from the plan rather than the audit: **E1.3** (the run allocation grid) is genuinely
unbuilt and blocked on D3. **E1.4 must not be built as written** — blocked on D1.

---

## Rules of engagement

- **Don't push.** Anthony commits and pushes to `main` himself and runs his own tests after yours.
- **One story per commit**, with the story id (`E6.1`, `E5.1`) in the message.
- **A green board is not a passing test.** Every board falls back to demo data with an amber chip
  when a query fails, so a broken SOQL change renders as a working page full of plausible fake
  numbers. Check the network tab.
- **Read the comments before changing behaviour**, and update them when you do. Most of the
  non-obvious code here has its reasoning written above it, often at length, and several of those
  comments record a bug that has already been fixed twice.
- **Before touching a SELECT list**, re-read rule 1 in `CLAUDE.md`. An FLS-hidden field empties a
  whole board rather than losing one value, and it returns HTTP 200 while doing it.
- **Before deferring work as blocked on Salesforce**, grep the Functions headers first. Several
  record live Setup findings with dates; Q3 sat parked for a day against evidence already in the
  repo.
