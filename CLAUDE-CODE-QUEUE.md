# Claude Code work queue — App track

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

## Branch audit — 2026-09-02 (supersedes the earlier merge warning)

**An earlier note here warned that 21 unpushed branches would collide badly. That warning was
wrong, and this replaces it.** It measured `git merge-tree` conflicts without checking whether the
work was *already on `main`* — and almost all of it is. Anthony re-applies each branch's changes to
`main` through the GitHub UI, so the branches are mostly stale copies of shipped work, not pending
work. A branch cut from an older `main` "conflicts" on every file `main` has changed since, which is
what produced those 50-hunk numbers.

**Method used here instead:** for each branch, take the lines its own commits *added*, and check
whether each one is present in `origin/main`'s copy of that file. That is robust to how the work
landed.

### Safe to delete — 20 branches

**Fully landed (17):** `feat/e1.5`, `feat/e2.5`, `feat/e3.2`, `feat/e3.3`, `feat/e6.6`,
`feat/e6.8`, `feat/e7.6-run-end-floor`, `fix/e2.2`, `fix/e4.5`, `fix/e4.6`, `fix/e5.11`,
`fix/e5.12`, `fix/e5.6`, `fix/e5.7`, `fix/e6.7`, `fix/e9.4`, `fix/s1` — 95–100% of added lines
present on `main`.

**Nothing to land (3):** `docs/e3.1`, `fix/e5.13`, `fix/e8.5` — no content changes remain.

### Keep — 4 branches, and 2 carry real gaps

| Branch | Landed | Verdict |
|---|---|---|
| `fix/e10.2-design-tokens` | 88% | **Stale, safe to delete.** The "missing" lines are the pre-token inline hex (`#9C978C`, `#1A1409`) that later work replaced with `var(--…)`. `main` has evolved *past* it. |
| `fix/e3.4-nested-orderitems` | 64% | ✅ **False alarm — retracted 2026-09-02. Nothing to cherry-pick; delete it.** `main` chunks too, but through a **shared `runChunkedIdQuery()` helper** in `_sf.js` used by `inbox` (1 call) and `calendar` (4 calls) — strictly better than the branch's inline `ID_CHUNK` loop. The 64% was an artifact of comparing literal added lines: a refactor into a shared helper legitimately changes them. **Lesson for this audit method — a low percentage means "look at it", never "it is missing".** |
| `feat/e2.4-timer-guardrails` | 96% | ✅ **CONFIRMED REAL, and FIXED 2026-09-02** (edit sits uncommitted in the working tree — see below). **A route lost its access gate.** `functions/api/update-order-receiving/index.js` on the branch imports `requireCap` and calls `requireCap(request, env, "orders.receive")`; **`main` has neither.** 4 lines in `_session.js` are missing too, likely the matching capability. E6.5 gated the mutating routes — this one is ungated on `main`. **Re-apply before `ACCESS_ENFORCE=1`,** or it is a hole on the day enforcement goes on. |
| `docs/decisions-and-e13-groundwork` | **0%** | **The docs branch, entirely unpushed.** `CLAUDE.md`, `.gitignore` and `NEXT-STEPS.md` do not exist on `main` at all, and `README.md` is 11 lines behind. This is the "docs live only on Anthony's disk" problem, now precisely located. |

**Net: the merge backlog was not real, and only ONE of the two suspected gaps was.**

### Done 2026-09-02

- **20 branches deleted.** Every SHA is recorded in `DELETED-BRANCHES-2026-09-02.txt` at the repo
  root — restore any with `git branch <name> <sha>`, the commits are still there.
- **The `orders.receive` gate is applied** to `functions/api/update-order-receiving/index.js`:
  the `requireCap` import plus a two-line gate after the body parse, matching the placement
  `run-results/index.js` uses. Verified — the module parses and imports cleanly, and
  `node tools/smoke.mjs` passes all 7 checks. **It is an uncommitted working-tree change**, because
  git writes on this mount are unreliable (`checkout` refused over a `.DS_Store`, `git diff` hit a
  bus error, ref deletion needed stale `.lock` files cleared by hand). Commit and push it the way
  you normally do.

### Still to do — three branches left

| Branch | Action |
|---|---|
| `docs/decisions-and-e13-groundwork` | **Merge it.** `CLAUDE.md`, `.gitignore`, `NEXT-STEPS.md` are on no other branch and not on `main`. Add `ROADMAP.md`, `CLAUDE-CODE-QUEUE.md`, `VALIDATION-INTEGRATIONS.md` and `VALIDATION-SCENARIOS.md` in the same commit. |
| `fix/e3.4-nested-orderitems` | Delete — retracted above. |
| `feat/e7.6-run-end-floor` | Delete once you are off it (it is the checked-out branch, so it was left alone). Its work is fully on `main`. |


---

## Tier 0 — ~~Ship this first~~ DONE 2026-08-31

### S1 · Shipment routes are committed without a file extension — ✅ FIXED, awaiting push
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

## Tier 1 — Self-contained, no blockers, small blast radius

### E4.8 · `stats.html` Switch Account never clears identity — ✅ DONE 2026-09-01
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

### E6.7 · `text()` strips HTML by assigning `innerHTML` — ✅ DONE 2026-09-01
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

### E5.11 · A run's scheduled time cannot be cleared — ✅ DONE 2026-09-01
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

### E5.13 · Three stale doc comments — ✅ DONE 2026-09-01
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

## Tier 2 — Real work, no external blockers

### E2.2 · Never swallow a failed timer write — ✅ DONE 2026-09-01
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

### E5.7 · Shop hours computed in UTC — ✅ DONE 2026-09-01
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

### E5.10 · Composite requests exceed the 25-subrequest ceiling — ✅ DONE 2026-09-01
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

### E4.6 · Sweep unresolved `{{ }}` bindings — ✅ DONE 2026-09-01
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

### E4.5 · Distinct loading / empty / error states on every board — ✅ DONE 2026-09-01
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

### E9.4 + E10.2 · Contrast tokens — ✅ BOTH DONE 2026-09-01
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

### E3.4 · Size breakdown wrong on large orders — ✅ DONE 2026-09-01
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

### E5.12 · Unbounded IN lists on the calendar endpoint — ✅ DONE 2026-09-01
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

### E8.5 · Pre-deploy smoke script — ✅ DONE 2026-09-01
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

## Tier 3 — Code is ready, but answer the question first

| Id | Blocked on | Question |
|---|---|---|
| **E2.1** | **E2.3** | Timer persistence needs `Timer_Started_At__c` / `Timer_Running__c` on `Production_Method__c`. The fields do not exist in any org yet. Do not write code against them until they do. |
| **E1.4** | Anthony | The story as written asks for produced quantities pre-filled with planned — decision **D1** removed the produced field on purpose. Rewrite as "timer stop routes the operator to the counting screen for that run", or cancel it and let `counting.html` be the answer. |
| **E5.8** | Anthony | `Production_Priority__c` is never written. `_priority-rollup.js` exports two functions no route imports, despite its own header saying otherwise. Wire it, or delete it and remove the field from every sort. Either way, record the decision. |
| **E6.5 / E6.6 / E6.8** | **E6.4** | Access control. E6.4 — is Cloudflare Access actually switched on? — is unanswered, and until it is, every access control in the app is attribution, not authorization. See the two traps below before touching enforcement. |

### Two traps that must be cleared before `ACCESS_ENFORCE=1`

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

## Not Claude Code's

Listed so nothing is picked up twice.

- **Anthony / ops:** E6.4 (Cloudflare Access), E7.5 (production env config), and every product
  decision — including the open one on cleared allocation rows.
- **Peter Larson:** E7.2 (Apex test classes — the long pole on the whole project, start now),
  E7.4 (metadata promotion).
- **This Claude project, via Salesforce in Chrome:** E7.1 staging half, E7.3, E7.6, E7.7, E7.8,
  E2.3 field + FLS verification, and running the E8 checklists against a real org.
- **Anthony + shop floor:** E9.1, E9.2, E9.3, E9.6, E9.7, E9.8 — tablets, connectivity, soak,
  guides, pilot.

Staging is currently unreachable from browser automation. The Chrome extension needs permission on
`cultureapparel--staging.sandbox.lightning.force.com`, `...my.salesforce-setup.com` and
`...my.salesforce.com` before the staging pass can run.


---

## E7.6 (app half) · Never prefill a Scheduled End that is not after the Scheduled Start

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

### ✅ D6 — DECIDED 2026-09-02 by Anthony: prefill **start + 2 hours**

When the order's end time is missing, equal to, or before the start, `openRunCreate()` seeds
Scheduled End as **Scheduled Start + 2 hours**. Chosen because `runDurationHours()` in `_priority.js`
already reserves exactly 2 hours for these orders — this makes the form and the scheduler agree
instead of one saying 0h and the other 2h.

### What to change

1. **`index.html` → `openRunCreate()`** (and the matching path in `pre-production.html` if it has
   one). Today it pipes `printEndDateTime` straight into `endDate`/`endTime` via `splitDT()`.
   Guard it: if the end is absent, equal to, or before the start, use **start + 2h**.
2. **`functions/api/_priority.js` → `runDurationHours()`.** Its comment says 2 hours is *"the same
   default `Print_End_Date_Time__c` already uses when `Duration__c` is blank."* **That is false** —
   the formula yields a 0-hour span. Correct the comment; the 2-hour behaviour itself is right and
   is now what D6 aligns the form to.

### Notes

- **Do not compensate in the app for the formula bug.** Once Peter ships the formula fix these orders
  start returning a real +2h end, and this guard should quietly stop firing. It is a floor, not a
  correction — if you find yourself adding 2 hours to a value that already has them, the guard is
  in the wrong place.
- Equal start and end currently **passes** server validation — `production-runs/index.js` rejects
  only `end < start`, and equal is not less-than. So this is not caught downstream today.
- Verify against a real zero-gap order: `801ca00000T4m0aAAB` (order `00013478`, Print Date
  2026-08-19 12:15 UTC, `Duration__c` blank).
