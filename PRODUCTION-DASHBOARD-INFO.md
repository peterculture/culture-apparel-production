# Production Dashboard Info

**The single source of truth for the Culture Apparel production dashboard.** Handoff material,
system reference, trap list, task tracking, validation checklists and change history — one file, so
there is one place to look and one place to update.

**Last updated: 2026-09-16** (target object model adopted, §4). Replaces `ROADMAP.md`, `CLAUDE-CODE-QUEUE.md`, `CLAUDE.md`,
`HANDOFF.md`, `VALIDATION-INTEGRATIONS.md`, `VALIDATION-SCENARIOS.md`, `SELECTOR-CHANGE.md` and
`README.md`. See §12 for what happened to each of the old files and which ones were deliberately not
carried over.

---

## 0. Cold start — read this first if you are a new project or session

**This file is the entire handoff. There is no other document, no wiki, and no one to ask.** It was
written to be picked up by a Claude project that has never seen this work. If something is not in
here, it was not carried over on purpose — see §12.

**Who you are working with.** Anthony runs Culture Apparel Print Shop and is the *entire* dev team
on this project. There is no separate Salesforce admin, no ops person, and no one to escalate to.
📌 Where older notes name "Peter" and "Anthony" as if they were two people, **they are one person.**

**What the thing is.** A production dashboard for a screen-printing shop: nine static HTML pages
plus ~50 Cloudflare Pages Functions that proxy Salesforce. No build step, no bundler, no test suite,
no `package.json`. It is backed by Salesforce, where a large amount of the actual logic lives in
Flows and Apex — which is why roughly half of §4 is Salesforce work, not code.

**The five standing rules. These are not suggestions and every one of them has already cost real work.**

1. **Do not push.** Work on a branch off `origin/main` and leave it committed there. Anthony pushes
   to `main` himself and runs his own tests after yours.
2. **One story per commit, with the Asana id in the message.**
3. **Do not create new `.md` files.** Everything goes in this document. The previous set of
   documents went stale in exactly the way a second file always does — see §12.
4. **Back this file up outside the repo. It exists in exactly one place.** ⚠️ **CORRECTED
   2026-09-09:** this rule used to say the file was tracked-but-uncommitted, and it is not — it is
   **untracked** (`??`) and `git log --all -- PRODUCTION-DASHBOARD-INFO.md` returns **nothing**, so
   it is in no commit on any branch or remote. That *inverts* the original risk: git leaves untracked
   files alone on checkout, so **a branch switch will not clobber this file.** What it means instead
   is that 368KB of the only record of this project lives on one iCloud-synced disk with no copy
   anywhere. The clobbering incident was real, but it happened to `ROADMAP.md` and
   `CLAUDE-CODE-QUEUE.md`, which *were* tracked. **Commit this file.**
5. **A green board is not a passing test.** Every board falls back to demo data with an amber chip
   when its fetch fails, so a broken change renders as a working page full of plausible fake
   numbers. Check the network tab, not the screen; open the record, not the card.

**Two facts that change how you reason about everything else.**

- 🚩 **One deployment serves three orgs.** dev2, staging and production are selected at runtime from
  a KV value (`sf_env:active` in the `INVENTORY` namespace). A code change goes live for **all
  three at once** — there is no "ship to staging only." Write code that degrades safely when a field
  does not exist in the active org.
- 🚩 **Salesforce work is verified in a browser, by hand, and it is slow and trap-laden.** There is
  no CLI or API path available. Read the browser recipes in §2 before your first Salesforce click;
  they will save you an afternoon.

**Salesforce reference — ids that keep coming up:**

| Thing | dev2 | staging |
|---|---|---|
| `OrderScheduling` flow (active) | **V23** · `301ca00000TpfrdAAB` | **V36** · `301ca00000TpeArAAJ` |
| `ProductionRunTriggerHelper` (Apex class) | `01pca000002mKEfAAM` | `01pca000002n7vJAAQ` |
| `ProductionRunTrigger` (Apex trigger) | `01qca000004l6Z8AAI` | `01qca000004nFhyAAE` |
| `OrderScheduling` durable id | — | `3005e000001R0ziAAC` |

⚠️ **The orgs are diverged and always have been** — `OrderScheduling` sat at V22 in dev2 while
staging was at V35. Version numbers do not line up between orgs; do not use them to infer parity.
§9 is the parity record.

📌 **Sandboxes inherit production's User ids on refresh**, so an 18-character User id that resolves
in dev2 resolves in staging and production too. That is why the hardcoded `0055e000005tFYfAAM` in
`CreateCalendarEvent` is not a promotion blocker — it has been checked in both.

### 🛑 LIVE BREAKAGE — 2026-09-18: the dashboard's decoration endpoint has no route. Fix is written, NOT PUSHED.

`ca-api.js` calls `/api/production-methods`; the folder is `functions/api/decorations/`, and under
`functions/` **the folder name IS the url**. On the live site `POST` there answers **405 with an empty
body** and `GET` answers **200 with the SPA's own HTML**, so from the dashboard every decoration
create / status move / checklist toggle / edit / remove fails, mostly in silence. **Trap 20** has the
measurements, the fix (client repointed, `production-methods/` kept as a re-export alias, endpoint
headers corrected, **smoke check 8** added) and why every previous test missed it.
⛔ **It is uncommitted on Anthony's Mac. Nothing works from the UI until he pushes.**

### 🧭 NEWEST — 2026-09-16: the target object model was adopted. Read §4 "Target model build" first.

Anthony's boss handed over a new Salesforce object design (OBJECT-GUIDE). Its decisions are
**D14–D22** in §5. Its plan, build rules and **test protocol (T1–T8)** are at the top of §4, as stages
S0–S8. S0 (measurement and decisions) is done. **S1 (Work Center parity) is done** in both sandboxes. It turned
up three findings that change how tests are read; see S1. **S2 (the approval gate) is built and tested,
and switched OFF** (blank start date) until Anthony confirms the date at the end of S7. **S3 (the art layer)
is done in both sandboxes** (2026-09-17); its findings became D23–D26. **S4 (the catalog layer) is done in both
sandboxes** (2026-09-17): catalog objects, in-org dual-write Apex, backfill. **S5 (Decoration and
Pre-Production Item → Art Spec) is done in both sandboxes and live** (2026-09-17). **S6 (Run Result, "add a count")
is done in both sandboxes and live** (2026-09-17, D28): change set deployed, code pushed, migration run in both,
the live screen walked on dev2, and scenarios (c)(d)(e) walked — (c) and (e) pass; (d) found that the skeleton
flow's give-back had been dead in BOTH orgs since the 2026-09-15 repair, for a reason that has nothing to do
with S6 (**trap 18** — a repaired object reference silently blanks the filter values). ✅ **Anthony fixed both
flows the same day** (dev2 v6, staging v4); the values read back correctly and the give-back was re-proved in
dev2 — a run planned at 80 now creates XL:40 + 2XL:40. **All three scenarios pass.** **S7 (the shop
floor) is now BUILT IN DEV2** (2026-09-18, **D29**): measuring it first showed the shop floor is already
tracked on Pre-Production Item, so **Screen became the physical frame** and the new objects describe
frames and ink batches, not jobs. `Screen_Prep__c`, `Screen_Reclaim__c`, `Ink_Mix__c` and the
`Screen__c` / PPI additions **now exist and read back in BOTH orgs** — staging deployed 2026-09-18 and
diffed field-by-field against dev2 with zero differences. Left: seeding the frames (needs Anthony's counts
by mesh) and the `station.html` pickers.
D17 **supersedes D1**: the counting model is being replaced, but not until S6. The 2026-09-15 handoff
below is still accurate for everything it covers.

### ⏭️ RESUME HERE — HANDOFF, written 2026-09-15

**Everything below was verified in dev2, in staging, or on disk on 2026-09-15.** This supersedes the
2026-09-14 handoff that follows it — but that one's **open items 1–6 are all still open**, so read
both. Then §2 The traps, then §4 wave 0c, then §9.

---

#### ✅ WAVE 0c IS DONE IN BOTH SANDBOXES — `Production_Method__c` is now `Decoration__c`

**The object was renamed for real, in dev2 and in staging.** Not the label this time — the API name.
🚩 **This inverts trap 12, which said for a week that `Decoration__c` does not exist.** It exists. It
is the most-used object in the system. Every SOQL query, Apex class, flow and file under `functions/`
now reads `Decoration__c`.

⛔ **The field `Pre_Production_Item__c.Production_Method__c` was NOT renamed and never will be.**
Object and field API names are separate namespaces. That field still reads `Production_Method__c`,
still labels as "Production Method", and now types as `Lookup(Decoration)`. **48 `Production_Method__r`
traversals across the repo are therefore still correct.** A find-and-replace on the old name breaks
every one of them — see §4 wave 0c for the two guard lines and the full change list.

**The cost of this wave was four Apex classes.** Salesforce refuses to rename an object any Apex
references, so the referencing classes were emptied to stubs first — and the originals were never
downloaded. `OrderPrintDateRollup`, `ProductionAutoSchedulerSelector`, `ProductionEventPublisher` and
`ProductionAutoSchedulerService` were **rebuilt from measurement, not restored from source.** What was
measured and what was assumed is now in §4 wave 0c, in full. Read it before you trust any scheduling
behaviour.

---

#### ✅ WHAT ELSE LANDED TODAY

| | dev2 | staging |
|---|---|---|
| `Decoration__c` object rename | ✅ | ✅ |
| 7 Apex artifacts deployed | ✅ | ✅ **7/7 byte-identical to dev2** |
| `ProductionAutoSchedulerServiceTest` | ✅ **5 of 6 pass** | ✅ same |
| `ProductionEventPublisher` coverage | **20.5% → 89.3%** | same class, same test |
| Org-wide Apex coverage | **82%** | **85%** |
| Local (deploy-blocking) test failures | **2** | **14** |
| `shippingBuffer()` real numbers | ✅ | ✅ |
| BFF 21 object edits + 5 line-item edits | ✅ committed by Anthony | — (one deployment, three orgs) |
| Press `MALFORMED_ID` flow fault | ✅ fixed | ⛔ **not yet — in the change set** |
| Line-item skeleton flow fault | ✅ fixed | ⛔ **not yet — in the change set** |

📌 **Two production bugs were reported today and turned out to be ONE cause.** Runs stopped reaching
the shop calendar *and* stopped getting Run Line Items. Both were the skeleton flow faulting on a
stale object reference and **rolling back the whole `Planned → Confirmed` PATCH**. §4 wave 0c has the
diagnosis; the lesson is in trap 17.

---

#### ⛔ OPEN — in the order the next session should take them, and the order matters

**1. ✅ CLOSED 2026-09-16 — staging's run line item object ALREADY reads
`Production_Run_Line_Item__c`.** ❌ **This item said the opposite on 2026-09-15 and it was wrong.**
Read live in staging on 09-16: API name `Production_Run_Line_Item__c`, label "Run Line Item",
**14 live records in it** — so it is the real object carrying its data, not an empty duplicate. It
matches dev2 exactly.

⚠️ **Whether Anthony renamed it overnight or the 09-15 reading was simply wrong is not knowable from
here, and it is not worth chasing.** What matters is the method: the 09-15 claim was read once, late
in a long session, and written up as 🔴 blocking. **One re-query closed it.** This is §0's own rule
paying for itself — a ⛔ line is a snapshot of the moment it was written, and the org is the only
source of truth.

📌 **Consequence: steps 2 and 3 below are NO LONGER GATED ON ANYTHING.** The BFF's 5 line-item edits
are correct for both sandboxes, and production has none of these objects at all, so nothing there can
break.

**2. 🔴 Upload the change set `0c Flow Fixes 2026-09-15` to staging — NOW UNBLOCKED.** It is already
built in dev2 and holds both repaired flows. 📌 **Flows arrive INACTIVE.** Activate both by hand after
deployment; a Flow Quick Action cannot reference an inactive flow.

**3. Deploy the BFF — gated only on step 2 now.** ✅ The repo is committed and correct for **both**
sandboxes: the 5 line-item edits match staging as well as dev2 (item 1), and production has none of
these objects. Deploy after the flows are live in staging, and verify in the network tab.

**4. Housekeeping in dev2's `Order and Order Items Subflow Design`: delete V47 and V48.** Both are junk
produced by the failed Flow Builder edits described in trap 16. **V47 is ACTIVE and behaviourally
identical to V46**; V48 is a draft. Neither contains the real fix, which Anthony made a different way.

**5. Orphan records left by the two faults.** Order **00013516** was created and rolled back mid-flow.
Runs **PR-0115, PR-0116, PR-0117** are stuck on `Auto_Scheduling_Status__c = 'Planned'` — 🚩 and per
trap 9 **a run left on `Planned` IS the failed-publish signal**, so these three are the fingerprints of
the bug, not new breakage. Clean them up once step 2 is verified.

**6. Recover `SELECTOR-CHANGE.md` before committing the markdown deletions.** It is deleted from disk
but still in history: `git show HEAD:SELECTOR-CHANGE.md`. 🚩 **It is the document
`ProductionAutoSchedulerSelector`'s two WHERE clauses were reproduced from verbatim** — the provenance
for a rebuilt class goes with it. (§9 holds a copy of the selector change itself; the original file is
the evidence.)

**7. Five iCloud-evicted files still block git's view of the tree** (trap 14): `tokens.css`,
`wrangler.toml`, `tools/smoke.mjs`, `tools/contrast.mjs`, `tools/check-dc-templates.mjs`.

**8. Close the try/catch gap in `ProductionAutoSchedulerService.scheduleFromOrders()`.** It swallows its
own exceptions, which is why the two flow faults today surfaced as "nothing happened" rather than an
error. Best-effort is the right design for a calendar publish; **silent** is not.

**9. Still unchecked in staging:** `Production_Calendar_Setting__c.Calendar_Owner_Id__c` (E7.1) and the
`Run_Print_Location__c` formula field. dev2 has both.

**10. Two flows are diverged and were NOT part of today's work — do not "fix" them by reflex.**
`OrderScheduling` is **dev2 V24 vs staging V37**. `Create_Multi_Orders_with_Design_Name` is **V21 in
both, modified ten months apart**. §0 already warns that version numbers do not imply parity.

---

#### 📌 WHAT THIS SESSION LEARNED THAT CHANGES HOW THE NEXT ONE SHOULD WORK

**1. 🚩 An object rename destroys every Apex class that references it, and the Download button is the
only backup.** There is no version history for Apex in the UI. The four classes lost today were
emptied on the strength of a runbook step that said "back them up first" — and the backups were never
taken. **They were rebuilt from live data, and they are reimplementations.** See §4 wave 0c for the
measured-vs-assumed table, which is the honest label on every line of scheduling behaviour in the org
right now.

**2. 🎯 A rebuilt class is only as good as the evidence it was rebuilt from, and the evidence expires.**
The 11 surviving `Proposal` runs were the *only* surviving output of the original scheduler — and
restoring a working scheduler re-slots them, destroying the evidence. They were exported first. **That
CSV is now embedded in §4 wave 0c**, because it is the sole record of the lead-time rule.

**3. 🎯 Ask for the real numbers instead of inventing plausible ones.** `shippingBuffer()` shipped as a
rebuilt guess — Pickup 0, Delivery 1, Split Ship 5, Shipping 2/4/3. **Every number was wrong.** Anthony
supplied the real table in about ninety seconds when asked directly. **The lesson is not "the guess was
bad"; it is that a guess dressed as code reads as fact to the next session.** Assumptions belong behind
an `// ASSUMPTION:` comment naming who has to confirm them.

**4. 🎯 Two symptoms with one cause is the common case, not the rare one.** "Runs won't hit the
calendar" and "no Run Line Items are created" were reported as two bugs and investigated as two bugs.
They were one faulting flow rolling back one transaction. **Check whether the symptoms share a
transaction before you split the investigation.**

**5. A frightening failure count is usually managed packages.** dev2's Run All Tests shows **264
failures** and staging's **306**. Split by `ApexClass.NamespacePrefix`, only **2** and **14** are local.
Managed-package tests are excluded from deploy runs and cannot block anything. 📌 **Always split by
namespace before reacting to a test count** — the recipe is in §8.

**6. 🪤 Flow Builder can accept an edit, display it correctly, and discard it on commit.** Setting the
`PressChoices` record-choice-set **Choice Value to `Id`** failed three times — mouse, keyboard, and
save-without-reopening — each time showing the right value and each time writing `valueField: null` to
metadata. **Three attempts is the limit; after that the answer is a different mechanism, not a fourth
click.** Trap 16.

**7. The Developer Console can be driven reliably, and the recipe is now written down** — including the
two things that silently do not work (`textarea.value`, the first click after load) and the SOQL rule
that cost a query today (**field aliases are legal only on aggregate expressions**). §2, browser
recipes.

---

### PREVIOUS HANDOFF — 2026-09-14 (superseded by the one above; its open items 1–6 are STILL OPEN)

**This is a clean handoff at the end of a working session. Everything below was verified in the org
or on disk on 2026-09-14, not carried forward from an earlier note.** Read this, then §2 The traps,
then §4.

---

#### ✅ WHAT IS DONE AND VERIFIED

**B9 is functionally complete in both sandboxes — both halves, for the first time.**

| | dev2 | staging |
|---|---|---|
| **Item 1 — the enriched email** `B9 Order Complete With Damage - Awaiting AM` | ✅ **V2 Active** (9/11 4:27 PM) | ✅ **V3 Active** (9/14 7:30 AM, by change set) |
| **Item 2 — the outcome screen** `B9 Record Misprint Outcome` | ✅ **Active** | ✅ **Active, V1** (9/14, by change set) |
| Quick Action `Record_Misprint_Outcome` | ✅ | ✅ deployed |
| Button on the 3 Order page layouts | ✅ all three | ⛔ **NONE — see open item 1** |
| `Production_Method__c` priority fields | ✅ | ⚠️ deployed 9/14 but **no FLS — see open item 2** |

📌 **The email satisfies the original ask in full.** Anthony asked for *"what order, what method, how
many misprints, what sizes, and who the primary contact is."* All five ship, plus a link to the order.
Confirmed against real debug output and an end-to-end test he ran himself. Two structural nits in the
body (the `Totals:` line sits with the methods rather than heading the size block; no blank line above
`Account contact:`) were raised and **deliberately shipped as-is**.

📌 **Repo:** a "Back to Production" button was added to the post-submit confirmation screen in
`counting.html` (the `showResult` block) via Claude Code, linking to `index.html`. **Reported done and
logged by Anthony; not independently verified in this session.**

---

#### ⛔ OPEN — in the order a new session should take them

**1. The outcome button is on NO staging page layout.** Staging has an active outcome flow that
**nothing can launch** — there is no button on any record page. Three hand edits, between
`Production Error` and `Edit`, on **Order Layout**, **Order Layout - EMB**, **Order Layout - Heat
Press**. ⛔ **By hand, not by change set** — a layout in a change set replaces the *whole* layout and
staging's may have diverged. (Those three are the layouts the press record types actually use; the
assignment grid is 7 record types over 2 pages and `Print Shop Production`, the one that matters most,
uses the plainly-named `Order Layout`.)

**2. 🚩 The priority fields deployed to staging with NO field-level security.** Change set
`0A2ca000000IzWT` landed `Production_Priority__c`, `Priority_Rating__c` and `Priority_Notes__c` on
`Production_Method__c` — but **0 of 27 profiles have `Production_Priority__c` visible in staging**,
against **26 of 26 visible-and-editable in dev2**. **A change set carries field permissions only for
profiles included in the set, and none were.** So `_priority-rollup.js:83` still fails there — except
it now fails for exactly the reason its error message names, which is a far more convincing wrong
answer than the field simply being absent. **Fix: Set Field-Level Security on the field, Visible (not
Read-Only).** The load-bearing profiles are the integration ones — **`Salesforce API Only System
Integrations`** and **`Minimum Access - API Only Integrations`**. Do the other two fields too for
parity; nothing reads them.

**3. `Update Order` in the outcome flow has NEVER EXECUTED, in either org.** Readback-verified only
(§2 trap 11). The dev2 debug was stopped at the screen on purpose, because finishing it writes a real
order and fires `Printshop Misprint Process` to the print shop and Slack. **The first real press of
that button is that flow's first real test — watch that the print shop is notified once and only once.**

**4. Housekeeping:** staging still holds the superseded **V2 draft** of the email flow (the abandoned
two-thirds hand-build). V3 is active. **Delete V2** so nobody opens the wrong one.

**5. 🚩 One deliberate test the day `b47c233` ships.** `_rework.js` says the app writes `Awaiting AM`
and that this is *"what the Flow watches for in order to email the AM."* **It is not** — the flow's
entry condition is `Misprint Outcome **Is Null**`, so the app writing `Awaiting AM` is the one thing
that makes it false. It *should* be fine (a record-triggered flow evaluates entry against the save that
set Completed, not a later write) **but if that reasoning is wrong the failure is silent and total: the
AM simply stops being emailed.** Do not discover this from an AM who never heard about an order.

**6. Nothing makes a pending decision visible.** An AM who never presses the button leaves an order at
`Awaiting AM` forever — no queue, no badge, no ageing indicator. §4's own "nothing must rot silently"
warning, still entirely unaddressed.

---

#### ⛔ THE MERGE GUARDRAIL — unchanged, and it still gates everything

**Do not let anything reach `main`.** `feat/proposed-run-press` and the unpushed stack name
`Proposed_Run__c.Press__c` in `proposed-runs/index.js` and `calendar/index.js`; **production does not
have that field**, and a missing field fails the WHOLE SELECT (trap 1) — calendar and proposals list
both go dark. **The whole queue is gated on one thing: creating `Proposed_Run__c.Press__c` in
production.** `b47c233` (B9's app half) sits *below* the press commits on the same stack, so it cannot
ship separately through the GitHub web UI.

⚠️ **Known and accepted:** because that merge is parked, the deployed app still creates the reprint
automatically while both sandboxes' flows email the AM asking whether to create one. Testing B9 today
means a reprint already exists before you answer — and answering **Credit or Refund leaves that
auto-created reprint orphaned in pre-production**, to be deleted by hand.

**Scope, set by Anthony 2026-09-11 and still in force: dev2 and staging ONLY. Nothing in production.**

---

#### 📌 WHAT THIS SESSION LEARNED THAT CHANGES HOW THE NEXT ONE SHOULD WORK

**1. 🎯 CHANGE SETS WORK dev2 ⟷ staging, and this document said for days that they did not.**
Setup → Deployment Settings shows a **double-headed arrow** on the `dev2 ⟷ Staging` row: authorised
both directions, and always was. Salesforce creates deployment connections between **every org in a
production org's family, sandbox-to-sandbox included.** Three deploys this session proved it.
**The staging mirror was never a hand-rebuild. Hours were spent on a claim one Setup page disproves in
ten seconds.** ⛔ **Before hand-building anything in staging again, check whether it can just be
deployed.**

**2. Three stale ⛔ lines were corrected in four days** — "B9 does not exist", "change sets can't go
dev2 → staging", "dev2's V2 is still Inactive". The pattern is consistent enough to be a rule:
**a ⛔ line is a snapshot of the moment it was written, and the ORG is the only source of truth.**
Re-check before repeating one.

**3. What a change set does NOT carry, learned the hard way:** **field-level security** (open item 2
above), and a Flow arrives **INACTIVE** — and a Flow Quick Action cannot reference an inactive flow,
so the order is always **deploy → activate → then the action**. Component type names in this org:
a flow is **`Flow Definition`** (there is no "Flow" entry), a Quick Action is **`Action`**.

**4. Dependency lists vary wildly and only one kind is readable.** The screen flow reported **4**
dependencies; the email flow and the field set reported **423** and **416**, dragging in unrelated
components and a managed-package warning from that noise. **Do not try to read a list that size — let
staging's Validate be the proof.** It is non-mutating and definitive.

**5. `device_commit_files` reports "written" without writing, in this iCloud folder.** It took two or
three forced attempts every time today. **Always verify a doc write by reading the real file back
afterwards** (`wc -c` + a grep for the new text via `device_bash`), not by trusting the tool result or
a staged copy — the staging layer also serves stale content, which cost a wrong "the file was
reverted" conclusion this session. Same family as the git-write flakiness in CLAUDE.md.

**6. The Salesforce CLI is half-installed and was abandoned.** `@salesforce/cli` 2.150.6 is installed
in the desktop workspace VM at `~/.npm-global/bin/sf` (global installs need
`npm config set prefix "$HOME/.npm-global"` — no root, no Homebrew there). **It has no authenticated
org and cannot easily get one:** this version has no device-code flow, `sf org login web` redirects to
`localhost:1717`, and **that port is not shared between the VM and the Mac** (confirmed:
`ERR_CONNECTION_REFUSED`). The remaining route is a connected app with JWT. ⛔ **Not worth doing unless
change sets stop being enough** — they turned out to cover the real case.

**7. Org parity was re-swept 2026-09-14, code-first. Full result in §9** — including the scraping
recipe that works on both orgs and the `Order_Substatus__c` label-vs-API-name trap that exists in
**both** orgs (so no diff could ever catch it).

---

🪤 **Flow Builder UI behaviour, measured — this is what makes hand-building slow:** a combobox closes
itself after ~2 seconds, so a 3-second screenshot looks like a failed click (screenshot within ~1s);
click the dropdown's **arrow**, not its text; a click straight after typing elsewhere is swallowed as a
blur; a screen component's **API Name autofills from its Label and APPENDS** what you type; a screen's
API name will collide with a Decision **outcome's** name (they share one namespace); the renderer
freezes and recovery is a **fresh tab**, not a reload; the classic page-layout editor sits in an iframe
that ignores scrolling. **`find` + click-by-ref is the escape hatch after two failed clicks, not ten.**

---

**Where to go next:** §2 The traps → §4 Where things stand → §9 for org parity. §7 holds work that can
be handed to Claude Code today.

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

0. **Cold start** — read first if you are new to this project
1. **Start here** — how to work on this repo, and what a session can and cannot do
2. **The traps** — the hard rules, each of which has cost a real afternoon
3. **What the system is** — shape, boards, orgs, auth, the data model
4. **Where things stand** — blocking work, phases, closed items, progress to deployment
5. **Decisions** — D1 through D22, and the open ones
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
- ~~**Reach staging from browser automation.**~~ **CORRECTED 2026-09-11 — it can.** The Chrome
  extension has permission on all three staging hosts
  (`cultureapparel--staging.sandbox.lightning.force.com`, `...my.salesforce-setup.com` and
  `...my.salesforce.com`), and classic Setup on `...my.salesforce.com` is as scriptable there as in
  dev2 — two fields and a flow version were built and verified in staging that day. Two quirks:
  Lightning record pages are forced, so classic edit forms need `/<id>/e?nooverride=1&isdtp=vw`;
  and `my.salesforce-setup.com` allows screenshots but not JavaScript, so the Lightning Flows list
  is click-and-scroll only. This no longer blocks E8.1/E8.2.
- **Test from outside the shop network.** Access now has a Bypass on the shop's public IP, so a
  browser there proves the bypass, not the block. The decisive external test is a phone with Wi-Fi
  off — that is why E6.4 says *prove a request from outside the policy is blocked*.

#### Working with Anthony

Explain in plain language, not jargon — "branch", "merge" and "checked out" have all needed
unpacking, and unpacking them was never wasted. Lead with what you actually verified and what you
did not. He would rather hear "I was wrong about that" early than have it stand in a document.

📌 **dev2 and staging hold TEST data. It does not need to be perfect, and records in them are not
precious** (Anthony, 2026-09-09). Deleting a run, breaking an order, leaving a field stale to preserve
a reproduction — all fine, and none of it needs asking about first. **What still needs care is
BEHAVIOUR, not records:** an org-level change (a flow version, a picklist value, FLS, a field) travels
to production with E7.4 and is a different thing entirely from a scratched-up test order.

⚠️ **The cost of getting this backwards is real and it has now been paid once.** The E7.7 execute test
was deferred for days as "that means destroying real data", then run with a deliberately chosen
throwaway and a recycle-bin note — and it took one delete to find B19, a P0 that had been invisible.
**When a test needs a record destroyed in a sandbox, destroy it.**

🪤 **The reverse trap, and it is the one that would actually cost something.** A sweep of this file on
2026-09-09 looking for "stale sandbox data we can drop" found that **almost every item that reads like
housekeeping is metadata, and metadata travels to production with E7.4.** Do not bin these:

| Reads like tidying | Actually |
|---|---|
| "the four staging-only fields… hand deletions" (§4 B4, §9) | **Custom fields.** `Actual_Good_Qty__c` is a *good quantity* field on the object whose whole model is *only problems are recorded* — the field **D1 says must not exist** |
| "`Quantity_Completed__c` / `Reprint_Quantity__c` should be deleted" (§6) | Custom fields, same |
| "`Credit/Refund` … a picklist cleanup" (§4 B9) | A **restricted picklist value**. Three of five overlap, and an AM will be choosing from that list |
| "FLS on `Run_Print_Location__c`" (§4 B4) | Field-level security — **arrives off on every change set** |
| "`Production_Calendar_Setting__c` has zero records" (E7.1) | A **config record the calendar cannot run without**, not throwaway data. Records never travel in a change set |
| the rogue `IsSyncing` quote (§2) | The *quote* is disposable; the **diagnosis is a permanent recipe** — §2 says outright it will recur |
| B9's orphaned template + Email Alert (§7) | Metadata, but genuinely inert — already marked *"delete them or leave them"* |

📌 **The rule that separates them: does it exist in Setup, or in a record?** Setup travels and matters.
Records in dev2 and staging do not.

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

**10. Nothing in this app ever deletes a run line item row.** To un-allocate a size, set
`Planned_Qty__c` to **0** — never delete, and never null.

✅ **BOTH ORGS AGREE, RE-VERIFIED 2026-09-16.**

| Org | API name | Label | Records |
|---|---|---|---|
| dev2 | `Production_Run_Line_Item__c` | Run Line Item | — |
| staging | `Production_Run_Line_Item__c` | Run Line Item | 14 |

❌ **This rule carried a 🚩 "the orgs disagree" table on 2026-09-15 naming staging as
`Run_Line_Items__c`. That was wrong**, and one re-query closed it. The repo's 5 edits (§4 wave 0c) are
correct for both sandboxes; production has none of these objects.

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

**11. Three Flow-authoring traps, all found by reading a debug run's resolved values, none visible on the canvas.** Full story and the fixes in §4 B9; the rules are:

- **`CONTAINS()` against an empty text variable returns null, not false** — and `NOT(null)` is null, so a Decision testing `Equals true` never fires. On the first pass of any accumulate-and-dedupe loop the accumulator IS empty, so **the feature is silently dead on every record**. `BLANKVALUE(x, '')` does NOT fix it; an empty substitute is still blank. Concatenate a non-empty sentinel: `CONTAINS('#' & {!vAccum}, …)`.
- **Flow's `Add` treats null as zero; `Equals` copies the null through.** Seeding a counter with `Equals <nullable field>` leaves it null, which renders as a **blank** in an email while the `Add`-built totals look correct. Coalesce at the seed — a `BLANKVALUE(<field>, 0)` formula resource — not at the display.
- **Flow strips leading AND trailing whitespace from a text template when it saves.** This undoes the usual "formulas can't make a newline, use a text template" advice: a template whose separator is a newline at either boundary loses it silently and reopens looking like one line, so every appended item runs together. Interior newlines survive. Anchor a boundary newline with a **zero-width space (U+200B)** on its own line — invisible in the output, and not whitespace to the trimmer. **A text template's blank-looking first line may be load-bearing; check before tidying it.**

📌 And the rule behind all three: **a flow that completes is not a flow that works.** Every one of these ran green, on a complete canvas, producing a wrong email. Open the action's **resolved input values** in the debug log — that is the only place the real output exists.

**12. "Decoration" IS `Decoration__c` — the object really was renamed on 2026-09-15.**
❌ **CORRECTION.** This rule said for a week that the API name "was not, and is not going to be"
changed, and that `Decoration__c` does not exist. **Both halves were wrong by the end of 2026-09-15.**
The label changed on 09-14; the **API name changed on 09-15, in dev2 and staging**, at the cost of four
Apex classes (§4 wave 0c).

So Setup, every page layout, every related list, report type, list view, board, SOQL query, Apex class,
flow and file under `functions/` now agree: it is **`Decoration__c`**.

⛔ **What did NOT change, and is the live trap now:**

- **`Pre_Production_Item__c.Production_Method__c` — the FIELD.** Still that name, still labelled
  "Production Method", now typed `Lookup(Decoration)`. Object and field API names are separate
  namespaces and the field was never in scope.
- **`Production_Method__r` — 48 traversals across the repo.** A relationship name derives from the
  **field**, not the object. Because the field kept its name, every one of these is still correct.
  Rewriting them to `Decoration__r` breaks all 48 — and at **runtime against a live org**, not at
  build time.
- **`Order.Decoration_Method__c`** is still an unrelated field, live in `_rework.js`'s
  `CLONED_ORDER_FIELDS`. It is not this object and never was.

🪤 **`functions/api/production-methods/index.js` holds the object and the field 27 lines apart** —
`:64` was renamed, `:91` must not be. A find-and-replace on that file breaks it silently. The two
guard lines are listed in full in §4 wave 0c.

📌 **The rule this replaces is still worth keeping in mind:** label and API name were deliberately made
to disagree for a day, and the code read one while the shop read the other. That is survivable. What is
not survivable is assuming the disagreement is still there after somebody closed it.

**13. The custom-field EDIT page wedges the browser renderer — and it is NOT only Order.** Recorded
2026-09-08 for the Order custom-field edit page (4 incidents, Lightning Object Manager AND Classic).
🚩 **Confirmed 2026-09-14 on a CUSTOM OBJECT field too** — `Production_Run__c.PrintMethod__c` at
`/<fieldId>/e`, trying to change nothing but the Field Label. The page loads and reads fine; the moment
you try to save it, the renderer stops responding.

⛔ **There is no browser-side workaround.** Both a synthetic mouse click (CDP `Input.dispatchMouseEvent`)
and a direct in-page `Runtime.evaluate` timed out on the same page — so it is not the input path, it is
the renderer. Scripting around it does not help.

📌 **The OBJECT edit page is fine.** Four object label changes went through cleanly the same day
(Decoration ×2 orgs, Run Line Item ×2 orgs). The trap is specific to the **field** edit page.

**So: field label and field API-name changes are hand work, or a Metadata API deploy.** Changing a
field's `<label>` in metadata is an ordinary supported deploy — unlike an object API rename (§11) —
so once the Salesforce CLI exists, a batch of label changes is one small deploy per org instead of N
hand edits. Read the field list back afterwards to confirm; do not trust the edit page.

**14. "Resource deadlock avoided" / `errno -35` means iCloud EVICTED the file — nothing is corrupt.**
This repo lives in an iCloud-synced Desktop folder. macOS evicts file *contents* and leaves a
placeholder behind; a process reading the placeholder gets `EDEADLK`, which surfaces as
*"Resource deadlock avoided"* from `sed`/`grep`/`cat`/`python`, as `errno: -35, syscall: 'read'` from
Node, and as a **bus error** from git.

✅ **Confirmed 2026-09-15:** every single file under `functions/api/` reported `cloudOnly: true`.
Reads failed for all of them, `node tools/smoke.mjs` could not load its own source, and this very
document was evicted mid-edit.

📌 **It masquerades as corruption, and that is the danger.** It is very likely the real explanation
for git appearing to be a "shallow clone with a missing HEAD commit object" — the pack files were
evicted, not absent. Do not conclude the repo is broken until the files are known to be local.

**Fix: force macOS to download them** (opening them, or staging them through the Claude device
bridge, both do it), then everything works normally. A directory listing that reports `cloudOnly`
is the fastest diagnosis — check before concluding anything else.

**15. 🚩 RENAMING AN OBJECT DESTROYS EVERY APEX CLASS THAT REFERENCES IT, AND APEX HAS NO VERSION
HISTORY.** Salesforce refuses the rename outright while any Apex names the object, so the only route
is to **empty the referencing classes to stubs first**. ⛔ **Those stubs overwrite the originals, and
the UI keeps no prior version.** On 2026-09-15 four classes were emptied on the strength of a runbook
step that said "download them first" — and the downloads were never taken.
`OrderPrintDateRollup`, `ProductionAutoSchedulerSelector`, `ProductionEventPublisher` and
`ProductionAutoSchedulerService` had to be **rebuilt from live data**. They work, they are tested, and
they are **reimplementations, not restorations** (§4 wave 0c).

**The backup is four clicks and it is not optional:**

> Setup → Apex Classes → click the class → **Download**

That writes a byte-perfect `.cls`. ⛔ **Do not "back up" a class by copying its text through a browser
tool** — the bridge strips quotes and `=` out of what it reads back, so the backup is corrupt in
exactly the places that matter, and there is nothing to compare it against.

**The working sequence, proven twice (0b and 0c):**

```
1  create the new trigger + helper against the NEW name    (they will not compile yet — that is fine)
2  DOWNLOAD every referencing class
3  empty them to stubs (keep the class declaration and every public signature)
4  rename the object
5  paste the downloaded classes back, rewritten against the new name
6  deploy all artifacts in ONE transaction — intermediate states do not compile
7  run the test class
8  repeat 1-7 in the other org
9  only then change the BFF
```

🪤 **Step 6 is load-bearing.** Saved one at a time these classes do not compile, because the helper
calls a `scheduleFromMethods` that does not exist until the service is also updated. Use a validate-only
deploy to prove the whole set compiles before writing anything.

**16. 🪤 FLOW BUILDER CAN ACCEPT AN EDIT, DISPLAY IT CORRECTLY, AND DISCARD IT ON COMMIT.** Setting the
`PressChoices` **record choice set**'s *Choice Value* to `Id` was attempted three times in dev2 — by
mouse click, by keyboard Enter, and by saving without reopening the panel. **All three displayed the
right value. All three wrote `valueField: null` to metadata**, confirmed by reading the flow metadata
back. The symptom downstream was a `MALFORMED_ID` fault, because the choice was handing the whole
record where an Id was expected.

⛔ **Two junk versions came out of this — dev2 V47 (activated, behaviourally identical to V46) and V48
(draft). Delete them.** ✅ **The real fix was a different mechanism entirely: a Get Records inside the
loop.**

📌 **The rule: three failed commits of the same edit means the mechanism is wrong, not your aim.** Stop
and change approach rather than producing a fourth version. Flow versions are cheap to create and
expensive to explain later.

**17. 🚩 A FAULTING FLOW ROLLS BACK THE WHOLE TRANSACTION, SO ONE FAULT LOOKS LIKE SEVERAL UNRELATED
BUGS.** On 2026-09-15 two defects were reported separately — *"runs won't hit the calendar"* and
*"no Run Line Items are created"* — and investigated as two. They were **one cause**:
`Production_Run_Generate_Line_Item_Skeleton` held a stale reference to the renamed run line item object,
faulted, and rolled back the `Planned → Confirmed` PATCH that the app had just issued. No Confirmed
status meant no calendar Event (trap 9); no successful flow meant no line items.

📌 **Diagnose by transaction, not by symptom.** Before splitting an investigation in two, ask whether
both symptoms ride the same save. Here the tell was already documented: **trap 9 says a run left on
`Planned` IS the failed-publish signal**, and three runs were sitting on `Planned`.

⚠️ **This is made harder by `ProductionAutoSchedulerService.scheduleFromOrders()` swallowing its own
exceptions.** Best-effort is right for a calendar publish; silent is not. Closing that gap is an open
item in §0.

**18. 🪤 REPAIRING A FLOW'S OBJECT REFERENCE CLEARS ITS FILTER VALUES, AND THE FLOW STILL RUNS GREEN.**
✅ **FIXED IN BOTH ORGS 2026-09-17 (Anthony)** — dev2 is now **v6 `301ca00000U5OEwAAN`**, staging **v4
`301ca00000U5HQvAAN`**, and both read back
`Method__c EqualTo $Record.PrintMethod__c AND Run_Print_Location__c EqualTo $Record.Print_Location__c`.
Behaviour re-proved in dev2 with the same rolled-back Apex that caught it: a run planned at 80 on method
`a3Vca000000LJCXEA4` now creates **XL:40 + 2XL:40, total 80** — the two sizes actually left incomplete —
where before the fix it produced 5 blank rows, and a run planned at 500 produced the full 200.
**The trap itself still stands: read the values back after any object-reference repair.**

Found 2026-09-17, in the very flow trap 17 is about. The 09-15 repair of
`Production_Run_Generate_Line_Item_Skeleton` was done exactly as prescribed — re-select the object on each
Get Records element so the stale reference recompiles, re-pick the filter fields, save a new version,
activate. It fixed the fault. But re-selecting the object **blanks the value side of every filter**, and
re-picking the *field* does not put it back. `Get Existing Rows On This Run` was re-entered
(`ProductionRun__c Equals {!$Record.Id}` is intact); **`Get Rows Across This Method` was not, in either
org**:

| Org | Flow | `Get Rows Across This Method` filters |
|---|---|---|
| dev2 | v5 `301ca00000U1SxAAAV` | `Method__c Equals` ⟵ blank · `Run_Print_Location__c Equals` ⟵ blank |
| staging | v3 `301ca00000U1paIAAR` | `Method__c Equals` ⟵ blank · `Run_Print_Location__c Equals` ⟵ blank |

A blank right-hand side is not an error. It compiles, activates, and at run time means *equals nothing*,
which matches **zero rows org-wide** (checked: `WHERE Method__c = null AND Run_Print_Location__c = null`
returns 0). The loop over those rows never runs, `varAlreadyPlanned` stays 0, and the flow happily builds a
skeleton for the **whole order quantity every time**.

📌 **The tell is never in the flow.** It ran green on every make-up run since 09-15 and sent no fault email.
It shows up one layer out, as *"this make-up run is planning more than is actually left"* — and the
blank-row branch (`Does This Run Cover The Remainder`) turns the same fault into *"my make-up run came out
empty"*, which looks like a different bug entirely.

📌 **So: after repairing an object reference, read the filter VALUES back out of the metadata** — not the
canvas, which renders a blank filter as a tidy, finished-looking row. Tooling API:
`SELECT Metadata FROM Flow WHERE Id = '…'`, then check each `recordLookups[].filters[].value` is non-null.
The recipe for driving the Developer Console (trap 7) reaches this in two calls.

**19. 🪤 A CUSTOM OBJECT IN A CHANGE SET DOES NOT CARRY ITS OWN FIELDS — AND THE ERROR NAMES SHARING,
NOT FIELDS.** S7's first change set (2026-09-18) held the four objects plus only the two fields that sat
on an already-deployed object. It failed validation in staging with, on two of them:

```
Screen_Prep__c    Custom Object  Cannot set sharingModel to ControlledByParent
Screen_Reclaim__c Custom Object  on a CustomObject without a MasterDetail relationship field
```

Nothing is wrong with the sharing model. Adding a master-detail field to an object flips that object's
`sharingModel` to `ControlledByParent` automatically, so the object's own definition now *requires* an
MD field to exist — and the MD field **was not in the package**, because a custom object added to a
change set brings the object, not its fields. The other objects deployed "fine", which is worse: they
would have landed in staging as **empty shells**, and the first read-back would have looked like trap 1
all over again.

📌 **So list every field explicitly, including the master-detail ones**, and for an object the target
org does not have at all, list its **pre-existing** fields too — nobody carries them for you. S7's set
went from 6 components to 37.

🪤 **An uploaded change set is locked** — its buttons drop to Delete / Upload / Clone, with no Add. The
fix is **Clone**, add the missing components to the clone, and upload that. The clone keeps the
components *and* the attached profiles.

🪤 **Both pickers paginate, and so does the change set's own component list.** The field picker is
lettered (`lsc` A=0…T=19) *and* each letter can run to a second page (`lsr=160`) — `Status` on `Screen__c`
was on page 2 of "S", which is exactly how a field goes missing without anyone noticing. The detail page
itself shows 25 rows and hides the rest behind **Next**. **Verify a change set by walking every page and
ticking off a written checklist**, not by glancing at the first screen.

**20. 🪤 A FOLDER UNDER `functions/` IS A URL. RENAMING IT RENAMES THE ROUTE — AND A ROUTE THAT NO
LONGER EXISTS ANSWERS 200 ON GET AND 405-WITH-NOTHING ON POST.** The Decoration rename moved
`functions/api/production-methods/` to `functions/api/decorations/`. Cloudflare Pages builds each URL
from the path under `functions/`, so the endpoint's address moved with the folder — and `ca-api.js`
kept calling the old one from **six** places (`createMethod`, `patchMethodStatus`,
`patchMethodChecklist`, `patchMethodFields`, `getMethodsForOrder`, `deleteMethod`). Measured live
2026-09-18 on `culture-apparel-preprod.pages.dev`:

```
GET  /api/production-methods   ->  200, 280,477 bytes of the SPA's own HTML   (JSON.parse then throws)
POST /api/production-methods   ->  405, 0 bytes, no content-type, no body
GET  /api/decorations          ->  400 {"error":"missing_orderId"}            (the real endpoint, alive)
```

A Pages request with no matching function is **not** a 404 you can read — it falls through to the
static assets. So the GET looks like a success and poisons the parse (board → demo data + amber chip,
silently), and the write looks like nothing at all. **This is byte-identical to the extensionless-route
incident** that smoke check 2 exists for (`shipments/combine` and `split`, 405 with an empty body).

🚩 **What it cost.** Every decoration write from the UI failed for as long as this was live: Create
Production Plan & Send, status moves, the 7 checklist toggles, the drawer's edit form and Remove. None
of them said so — `loadMethodsForOrder`'s catch is a bare `setState`, so the drawer's decoration list
just sat empty, and Remove's catch blames child records. What Anthony saw was
**"Create failed — check the plan and try again"** and, in DevTools, a red row with an **empty**
Response.

📌 **Why it survived every test.** S2, S4 and S5's T5 walks all called `/api/decorations` **by hand** and
all passed, because the server was never the problem. **Calling an endpoint directly does not test the
route the app uses.** The only thing that would have caught it is the network tab on the real button —
which is what CLAUDE.md already says, and is the whole reason this trap is here.

✅ **Fixed 2026-09-18:** `ca-api.js` repointed to `/api/decorations`;
`functions/api/production-methods/{index,[id]}.js` kept as **re-export aliases** (no logic, ever) so a
tablet holding a cached `ca-api.js` survives the rollout; both endpoint files' header comments now name
the route they actually serve. **Smoke check 8** now fails on any `/api/…` path the client calls with no
function behind it (uncommitted counts as missing), and it was verified the project's way — the
incident was reconstructed in a throwaway copy and the check failed on it.

📌 **So: after moving anything under `functions/`, grep the client for the old path before pushing**, and
remember that the check only sees the *literal* prefix of a url — `'/api/orders/' + id` is checked as
far as `orders/`.

**20b. 🪤 THE SECOND FAULT, AND THE REASON THE FIRST ONE WAS INVISIBLE: the create handler's error
message required a shape the endpoint never returns.** `pre-production.html` read:

```
var detail = e && e.data && (e.data.detail || e.data.all);
var sfMsg  = Array.isArray(detail) && detail[0] && detail[0].message;
```

`/api/decorations` returns a **validation** rejection as `{error, detail}` with `detail` a bare string
(`bad_mesh`, `missing_placements`, `bad_method_type`, `bad_item_status`…) or no detail at all, and a
**composite** failure with `detail` already formatted as the string `"referenceId: ERROR_CODE: message"`
by `_composite.js`. `Array.isArray` was false in both cases, so every real cause — including the 405
above, which carries no body at all — rendered as the same generic sentence. There is a comment above
that block, dated 2026-07-28, claiming to fix exactly this. It did not.

📌 An error path has no happy-path symptom: the page renders, the request fails as designed, and the only
thing wrong is a sentence nobody diffs. **Assert against the endpoint's literal error shapes, or call the
shared helper** — `errText(e)` in `ca-api.js`, which the page's other three catch blocks already used. It
is now used here too; a fourth private copy is how the shapes drift apart.

🪤 **Debugging one of these without a deploy:** DevTools → Network → retry → read the response body.
**And read the request's URL while you are there** — that is where this one was hiding in plain sight.

**21. 🪤 SALESFORCE'S "PUBLIC LINK" IS A WEB PAGE, NOT A PICTURE — AND THE FIELD THAT HOLDS IT IS
`Design__c.Mockup_URL__c`, NOT THE FILES TAB.** Two separate things bite here, and 2026-09-18 hit
both in one sitting.

**(a) Dropping files on the Design's Files tab does nothing.** Every mockup on every board is read
from `Design__c.Mockup_URL__c` — `_mockup.js` queries it by `Opportunity__c`, and the Files/Vault
flow its own header describes has never been used by anybody in either sandbox. A file attached and
no link pasted is a file the dashboard cannot see.

**(b) The link the share button gives you is not the image.** Anthony pasted the file's **public
link**:

```
https://cultureapparel--dev2.sandbox.my.salesforce.com/sfc/p/ca000004mabZ/a/ca000000jrbF/XWjd29...
```

It has no `068` in it, so `/api/mockup-proxy`'s ID_RE found nothing and the direct-fetch branch asked
Salesforce for it as if it were an ordinary image url. **Salesforce answered 200 with 1,359 bytes of
HTML.** An `<img>` pointed at HTML draws nothing and reports nothing — no broken-image icon, no
console error, no failed request — so the card falls back to its shirt outline and the field reads as
ignored. (The record was at least not corrupted: `adoptMockup` refuses a non-image content type.)

📌 **The ids are in the path with their key prefixes stripped.** `/sfc/p/<org>/a/<dist>/<token>` —
`ca000000jrbF` is `05Dca000000jrbF`, a **ContentDistribution**. One query turns it into a
ContentVersion id, and from there the proxy's authenticated branch fetches the file with no outbound
request at all. ✅ `/api/mockup-proxy` now resolves all three shapes a person actually copies: the
public link, `ContentDownloadUrl` (its `068` sits in a query parameter, not at the end), and a
ContentDocument `069` link. Verified end to end on the real file — 1.34 MB, JPEG, renders at
3300×2700.

🪤 **A public link is a 30-day loan** (`ContentDistribution.ExpiryDate`; this one expires
2026-10-18). Another reason the proxy resolves it to a ContentVersion and fetches with our own token
rather than following the link.

⛔ **Tightened at the same time, and this is the part to not undo:** the id lookups run ONLY when the
host is Salesforce's. ID_RE used to accept a trailing `068`-shaped run on *any* host, which is the
same wrong-branch mistake the `068` prefix was added to stop, one step further along.

**22. 🪤 A CHANGE THAT SPANS TWO FILES ONLY WORKS IF BOTH LAND — AND A FAILED BUILD KEEPS THE WHOLE
SITE ON THE PREVIOUS VERSION, NOT JUST THAT ENDPOINT.** 2026-09-18, the same day as trap 20: the
press fix had `proposed-runs/index.js` import a failure-matching helper newly exported from
`_placements.js`. Only one of the two reached the commit, and Cloudflare answered:

```
✘ [ERROR] No matching export in "api/_placements.js" for import "failureMentionsField"
    api/proposed-runs/index.js:25:32
```

Both files parse perfectly on their own, so `node --check` (smoke check 4) sees nothing — it is a
fact about the **pair**. And the price is not one broken endpoint: the build fails, so nothing
deploys at all, including whatever else was in that push.

📌 **In this repo, half-landed pairs are normal weather** — iCloud eviction, a partial `git add`, a
commit that only touched an mtime (see the working notes at the end of §1). So the endpoint was
rewritten to need nothing new from anywhere: it asks with the press field and, if that fails, asks
again without it, which answers "was press the problem?" by trying rather than by importing a
predicate. One extra query in the rare failure case, no cross-file dependency.

✅ **Smoke check 9** now reads every `import { … } from "./sibling.js"` and fails if the target file
exports no such name. Verified the project's way: the incident was reconstructed in a throwaway copy
and the check failed on it. A full `npx wrangler pages functions build` is still the only thing that
proves a deploy compiles — worth running before a push that moves anything between files.

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

📌 **Re-measured 2026-09-09 against `origin/main`: 22 of 23, and only `worker-logout` is ungated.**
`worker-login`'s single `requireCap` hit is a comment, so it is ungated too — deliberately, per the
rule above. ⚠️ **`station-login` no longer exists** (no `functions/api/station-login/` on
`origin/main`), so listing it as one of the three is stale: `_station.js`'s own header records that
the whole per-station auth system was removed because no page ever called it. Two deliberately-open
routes now, not three.

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

⚠️ **D17 (2026-09-16) SUPERSEDES D1: this model is being replaced by Run Result (§4 target-model plan, S6).** Until S6 lands, what follows is still how the code behaves. Do not change it piecemeal.

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
- ~~`README.md` is stale above the fold.~~ ✅ **NO LONGER TRUE — measured 2026-09-09.** None of
  `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `/api/vendors` or `culture-apparel-prepod`
  appear in `README.md` any more; it has been rewritten and its opening now matches §3 verbatim.
  📌 The rough-edge note was itself the stale thing, which is the failure mode this file's §11 update
  rule exists to prevent — a *correction* has to be written down as promptly as a change.

#### Driving Salesforce from a browser session — what works, and what silently does not

Much of §4's Salesforce work was done by a Claude session steering a real browser, because there is
no CLI or API path available from here. Everything below was learned the expensive way. **A new
session should read this before its first Salesforce click**, not after.

🚩 **The REST API is not reachable from browser cookies. Do not try.** `/services/data/vXX/query`
returns **401 `INVALID_SESSION_ID`** using the page's cookies, and equally using the `sid` read off
the Lightning domain — a Lightning session id is not API-valid. Several attempts were burned on
this. **Use the Developer Console Query Editor instead**; it is the only reliable read path.

📌 **The Developer Console query recipe** (works; used for every count in §4):

1. Navigate to `https://<myDomain>/_ui/common/apex/debug/ApexCSIPage` and wait ~8s.
2. Set the query by script, not by typing — the editor swallows keystrokes:
   `document.getElementById('queryEditorText-inputEl').value = "SELECT …"`, then dispatch
   `input` and `change` events on it (both, bubbling).
3. Click **Execute** at approximately **(35, 879)**. The **Use Tooling API** checkbox is at
   approximately **(75, 880)**.
4. Results render in the grid above; read them off a screenshot.

🚩 **`FlowDefinitionView` has two limits that produce misleading results, not errors you'll notice.**
It does **not support `OR`** — a disjunction fails with *"Disjunctions not supported"* — and it is
**not available under the Tooling API** (uncheck that box). Both failures land in the small error
strip under the editor, while the results grid keeps showing the *previous* query's rows. That is
exactly how a session once concluded "there is no flow named Close" when the query had simply
errored. **Read the error strip before believing an empty result.** Use a single `LIKE` instead.

📌 **Getting a flow's id without hunting the Setup list.** The Flows list is alphabetical, lazy-loads
50 at a time, exposes no href on the row (`javascript:void(0)`), and opening a flow triggers a
popup-blocker prompt. Skip all of it — one query gives the id directly:

```
SELECT DurableId, ApiName, ActiveVersionId, LatestVersionId, VersionNumber
FROM FlowDefinitionView WHERE ApiName = 'OrderScheduling'
```

`ActiveVersionId` is the `301…` id that `flowBuilder.app?flowId=` wants.

🚩 **The Apex editor is EditArea, and setting the textarea does nothing.** Setup's Apex class editor
runs EditArea inside an iframe and keeps its own model, so writing to the hidden `<textarea>` looks
like it worked and saves the *old* text. Use `editAreaLoader.getValue(id)` and
`editAreaLoader.setValue(id, value)`.

🚩 **`ctrl+a` / `cmd+a` does not select-all in Flow Builder or Salesforce inputs — it appends.**
To replace a field's contents: `End`, then `shift+Home`, then `Delete`.

🚩 **Flow Builder renders a saved merge reference as raw text** in multi-value inputs on first load,
which reads as "the value was lost." It was not. **The reliable test for "no unsaved diff" is the
greyed-out Save button**, not what the input looks like.

🚩 **The Order object's custom-field EDIT page wedges the Lightning renderer.** It happened four
times across a single session, in **both** Lightning and Classic, the fourth time with **no
interaction at all** — so it is the edit page failing to reach idle, not anything typed into it.
There is no known workaround from a browser session. **Renaming or re-describing an Order custom
field is a task to hand to Anthony by hand**; do not burn a session retrying it.

🚩 **Apostrophes break `javascript_tool`.** Single-quoted script strings fail with
`SyntaxError: Unexpected identifier 's'`. Write comments and strings without apostrophes.
Some page extractions also return `[BLOCKED: Cookie/query string data]` — narrow the regex so the
script returns only booleans or short signatures rather than page text.

🚩 **"YOUR FLOW FINISHED" on the Close and Create Order quick action — it is an empty quote, not the flow.**
Diagnosed 2026-09-09. The quick action ends with the bare message *"YOUR FLOW FINISHED"* and no
order. The flow is fine. **Cause: a second, empty Quote had taken over syncing.** In the case
examined, quote `0Q0ca000002GfHNCA0` had been created four minutes earlier with **`IsSyncing = true`
and zero line items**, which left the Opportunity showing 0 products — so the flow had nothing to
build an order from and exited down its empty path. **Check for a rogue syncing quote before
touching the flow:** query the Opportunity's quotes for `IsSyncing = true` and count their line
items. This is a data condition users create by accident, and it will recur.

📌 **Always read a Salesforce change back off a *fresh page load*, never off the post-save screen.**
The post-save view can show what you typed rather than what was stored. Every ✅ in §4 that says
"verified" means: reload the page, reopen the element, confirm the values, confirm Save is greyed.

---

##### 🎯 Driving the DEVELOPER CONSOLE's Query Editor — the recipe that works

Worked out 2026-09-15 across dozens of queries in both orgs. This is the fastest read path into an org
that exists here; the alternatives are worse.

⛔ **The REST API refuses cookie auth.** Calling `/services/data/...` from a page's JS with the session
cookie returns `INVALID_SESSION_ID`. There is no session-id-from-the-page shortcut. Use the Query
Editor.

**The two things that silently do not work:**

1. ⛔ **Setting `textarea.value` directly does not take.** The console is ExtJS; the component keeps its
   own model and the DOM write is ignored on Execute. **Use the component:**
   ```js
   Ext.getCmp('queryEditorText').setValue("SELECT Id FROM Account LIMIT 1");
   ```
   Read it straight back with `.getValue()` to confirm before executing.
2. ⛔ **The first click after a page load is swallowed.** Budget one throwaway click, or take a
   screenshot first — the screenshot round-trip is usually enough to settle it.

**Reading results back.** Each query opens **its own console tab**, so a DOM query for "the grid" can
land on a stale one — match grids by **content**, not by position. The reliable extraction is the page
text, filtered:

```js
document.body.innerText.split('\n').filter(l => l.indexOf('Exception') > -1).join('\n\n')
```

Grid-row selectors (`.x-grid3-row`) return empty often enough to not be worth relying on.

🪤 **SOQL: field aliases are legal ONLY on aggregate expressions.**
`SELECT ApexClass.Name cls, MethodName mn FROM ApexTestResult` fails with *"only aggregate expressions
use field aliasing"*. Drop the aliases; `COUNT(Id) n` is fine.

⛔ **Do not encode or transform output to get it past the browser extension's content filter.** Base64
was tried and blocked, and working around a content filter is not something to do. Slice the output in
plain text and take more passes.

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

⚠️ **D17 (2026-09-16) supersedes D1.** The redesign is now deliberate and staged: see §4 target-model plan, S6. Until then, the rules below describe the live code.

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
| **B1** | ✅ DONE | CC | **Shipped and verified live 2026-09-02.** `adoptMockup()` in `_mockup-adopt.js`, called from `mockup-proxy`. Measured on the dev2 board before and after: **adopted (branch A, `068…`) went 0 → 39, blocked went 38 → 16**, and `ALLOWED_MOCKUP_HOSTS` is still in place for the paths that need it. The remaining 16 are orders nobody has opened yet plus any whose original link is now dead — the latter can never adopt and are the permanent floor. ✅ ~~**Re-check the census in a few days: it should keep falling and must never rise.**~~ **RUN 2026-09-09, and it closed this out — see B16.** dev2 now holds 10 designs with a mockup URL, 9 adopted and 1 not, and the hold-out is explained: its URL redirects, so adoption looks it up by the wrong string. 📌 **The "permanent floor" needed a third category this row did not have** — not just "nobody opened it" and "the link is dead", but **"the host redirects"**. Nothing further to count; B1 stays closed and B16 carries it. Journey worth remembering: called a P0 defect, closed as not-a-defect on how the process was *documented* (D7), reopened when staging showed the same pasted links and zero Vault uploads in either sandbox, then fixed by adopting the data into the documented shape rather than widening an allowlist (D8). |
| **B2** | ✅ step 1 | CC (+SF) | **Step 1 DONE 2026-09-02**, branch `feat/b2-timer-persistence` (committed on `fix/b3-run-create-error`). ✅ **On `origin/main` and LIVE** — verified 2026-09-02 in the deployed `index.html`. localStorage keyed by method id; survives reload AND the 15s poll with the drawer closed (that second half was a live in-session bug, not just a reload one). Failed saves persist too, with their warning. Demo ids excluded. E2.4's ceiling verified against a rehydrated 14h timer — capped at 12h. **Step 2 still blocked on E2.3.** |
| **B3** | ✅ | SF + CC | **DONE 2026-09-02**, branch `feat/b3-results-by-order`. ✅ **On `origin/main` and LIVE** — verified 2026-09-02: the deployed `counting.html` carries the sibling make-up panel, and the deployed `index.html` surfaces the real run-create reason via `errText(e)` instead of the old fixed sentence. Grouped by order (no endpoint change — orderId/goaNumber were already in the payload); headers describe the whole ORDER not the filtered tab, so a two-method job reads "1 of 2 runs · Screen Print · Heat Press" instead of "1 run". Sibling panel shows the make-up quantity ("20 screen print garments still to be made up") and the sibling's misprint/damaged **for reference only** — verified all six inputs still render empty, D5 intact. The swallowed `catch(_)` on run creation was fixed separately and first. |
| **B4** | ✅ dev2 + staging | SF | **A second run on a method is created with NO line items, so there is nothing to count.** Verified live in dev2 2026-09-03 on order 00013503 (Walkthrough MPM), and the pattern holds across the org. The skeleton Flow allocates **per method**, so the first run takes the whole order quantity and every later run on that method gets zero rows. ✅ **DECIDED (D11): allocation becomes placement-aware.** ✅ **SHIPPED IN DEV2 2026-09-03** — new formula field `Run_Print_Location__c` plus one filter row in the Flow; both placements now get full rows. ✅ **Staging done and verified 2026-09-04** — the flow arrived as a DRAFT and needed activating by hand; production still has none of it (E7.4). The summed reprint is still unmeasured and same-placement second runs are still empty. Full detail below. |
| **B5** | ✅ | CC | **DONE 2026-09-03 and ON `origin/main`.** Submitting results that record incomplete garments now routes straight to booking the make-up run, instead of offering a button that can be ignored — D10's argument, one step later. `counting.html` +63/−4, `ca-api.js` +43/−1, `production-runs/index.js` +84/−2, plus `index.html`, `pre-production.html` and `calendar.html`. ⚠️ Shipped with a dead end that **B6b** then fixed. Full detail below. |
| **B6** | ✅ | CC | **DONE 2026-09-03 and ON `origin/main`.** A reprint is created with its method already mirrored, so the Management inbox — defined as Pre-Production orders with **no** method — excluded it by construction and its runs could not be scheduled. The inbox now also carries reprints that have a method but no runs. `inbox/index.js` +123/−2, `pre-production.html` +59/−6, `ca-api.js` +12/−1. Full detail below. |
| **B6b** | ⚠️ unpushed | CC | **DONE 2026-09-03**, branch `fix/b6b-postprod-new-run`, commit `ee19fc6`, `index.html` +21/−1. **A hole B5 opened and only showed up once something used it:** Post-Production collapsed the Production Runs section, so the status a make-up run is most likely to be booked from was the one status with no button to book it — and B5's deep link opened a drawer with no form in it. Full detail below. |
| **B7** | ✅ stage 1 | CC (+SF) | **Setup / production time on the method cards** — Ready for Print shows the setup clock, In Production shows the production clock. The clocks are **per method, not per run**, so the run picker is not involved and the card needs no selection logic. **Stage 1 (no blocker):** show the stored figure, presented as *saved* rather than live. **Stage 2 (blocked on E2.3):** make it tick. ✅ **STAGE 1 IS BUILT — recorded 2026-09-09, and it had shipped without being written down.** Three commits, all reachable from `fix/e2.6-run-order`: `feat/b7-stage1-method-timers`, then `fix/b7-stage1-idle-state` (`320dbe2`) and `feat/b7-live-on-this-device` (`eec061a`). `index.html:157-181` (markup) and `:2681-2760` (the chip's view model). ⚠️ **Two things shipped that this row did not ask for, and both are defensible but must not be mistaken for stage 2.** (1) **The idle fix:** the first version hid the chip entirely at zero seconds, so on a shop that had not started using timers EVERY card rendered nothing — indistinguishable from the feature never having shipped, which is how it was reported. It now shows the chip with an em dash and the words "not started". "Blank is not zero" was right that `00:00` must never be printed as though measured; it was wrong taken as far as printing nothing. (2) **The live tick:** the card now ticks *on the tablet running the clock*, using B2 step 1's `localStorage` `{running, startedAt, elapsed}` and the same `liveElapsed()` the drawer tiles use — no new field, no new SOQL. 🚩 **This is NOT stage 2 and the wording is what keeps it honest:** a timer running on ANOTHER tablet is invisible here, so that card falls back to the saved figure and says "saved". Stage 2 is the SERVER knowing a clock runs (`Timer_Started_At__c` / `Timer_Running__c`, E2.3), which is what makes two tablets agree. ⛔ **Not verified against dev2** — that pass is still owed. Full detail below. |
| **B8** | ⚠️ unpushed | CC | **DONE 2026-09-04**, branch `feat/b8-runs-left`, `index.html` + `production-orders/index.js`. **Runs left to print, on the method card** — a manager sees it without opening the drawer. The board had no run data at all: runs arrive per-method through `loadRunsForCard()` when a drawer opens, so `state.runsByMethod` held opened cards only. Added a **separate fail-open follow-up query** in the same handler — flat `SELECT Id, PrintMethod__c, Actual_End__c FROM Production_Run__c WHERE PrintMethod__c IN (…)`, chunked through `runChunkedIdQuery`, aggregated per method. **Kept out of the main SELECT deliberately** (trap 1: one FLS-hidden field empties the whole board; a badge is not worth that). Not a nested subquery (E3.4 — silent truncation at 200), not a rollup field (D9 — a stored derived number nothing refreshes). **"Left to print" reuses `index.html`'s own rule** — a run with no `Actual_End__c` — which is the same test that advances a method to Post-Production, so the badge and the status machine cannot disagree. Counts every placement (B4 made allocation placement-aware; a Front and a Back run both go through the press). **Unknown ≠ zero:** a failed count query leaves the fields absent and the card shows nothing, never "0 left". Shown on Ready for Print and In Production only, beside B7's clock; "all runs printed" at zero, "no runs scheduled" when the method has none (Anthony, 2026-09-04). ⚠️ **Verified against a fake-Salesforce harness and a stubbed board, NOT against dev2** — that pass is still owed. |
| **B9** | ⚠️ BUILT · app half BLOCKED on production `Press__c` | SF + CC | **The reprint becomes opt-in: the account manager confirms it before it exists.** Today a reprint is created automatically the moment the last method completes. Anthony, 2026-09-04: the AM should be emailed, click through to say whether the customer actually wants the reprint, and only then does it get built — landing in the Management inbox with its methods already mirrored, ready to schedule. ⛔ **NOT READY TO BUILD.** Four decisions are open and two prerequisites do not exist in this system at all: there is **no email capability anywhere in the app** (Salesforce must send it — Anthony, 2026-09-04). The recipient, however, is **already on the Order**: `Opportunity_Owner_Email__c`. Full detail below. |
| **B10** | ⚠️ unpushed | CC | **DONE 2026-09-08**, branch `feat/method-colours`, `tokens.css` + `ca-api.js` + six pages. **One colour per print method, on every board** — Anthony, 2026-09-08: screen print green, embroidery purple, heat press orange, “a subtle indicator that clearly visually marks them”. The hexes had been copy-pasted into **five** separate places, so they now come from four `tokens.css` variables (`--method-sp` / `-em` / `-hp` / `-promo`) that every page already links, the printed order sheet included. ⚠️ **Deliberately NOT `--ok` / `--warn`**, which are already a green and an orange: those two carry meaning on these boards (“fine” and “watch this one”), and a method chip in the exact status green reads as a verdict on the job rather than a label for the press. Neighbouring hues instead — `--method-sp #4E9A6A` vs `--ok #7FA644`, `--method-hp #D2762F` vs `--warn #C9923A` — all four clearing 4.5:1 on `--surface-card` and 3:1 on the order sheet's white. **Where it shows:** `index.html` board chip and drawer chip (the LABEL is tinted, not just the 8px dot) plus a 3px method stripe on the drawer's method card; `pre-production.html` the same two, plus the column headers, which were already method-keyed; `counting.html` a dot + tinted label on the run cards and the run header; `order-sheet.html` the Method chip and the per-method rows; `calendar.html` the press-group tabs; `stats.html` the per-method timing rows. **Left alone on purpose:** `shipping.html` — its `methodColor` is the **delivery** method (Ship / Pickup / Local Dropoff), a different axis that happens to share the name — and the calendar GRID blocks, which already carry four colour axes (outstanding prep, Confirmed vs Planned, priority score, grey for finished) on a 30px target. **Fixed in passing:** the order sheet's Method chip was `api.methodOf(rec)`, a guess off the press name that falls back to Screen Print whenever it cannot tell; it now reads the order's real `Production_Method__c` records and only guesses when there are none. Colour is why it got fixed — a green “Screen Print” dot on an embroidery sheet is a wrong colour on paper, not just a wrong word. Verified in a wrangler rig on all six pages by reading computed styles, not by looking at the screen. |
| **B11** | ✅ DONE | CC | **The counting screen can mark a run Submitted when Salesforce rejected every count.** `run-results/index.js:566` — its private `composite()` inspects each sub-response but **never reads `resp.ok`**. When `/composite` itself answers 4xx/5xx the body is a top-level error array, so `data.compositeResponse` is `undefined`, `subs` is `[]`, `failures` is `[]`, and it returns `{ok:true}`. The caller (`:449-461`) treats that as a successful write and falls through to `:464-476`, which PATCHes `Result_Status__c = 'Submitted'`. 🚩 **This is the one defect that D1's model cannot survive:** a perfect run and an untouched run are byte-identical on purpose, so `Result_Status__c` is *the only evidence a human counted* — and this produces a run asserting "counted, all fine" over rejected counts. Gate 2 of `createReworkIfNeeded` then passes, gate 4 sees blanks, and a damaged order silently gets no reprint. ⚠️ **This is not one of the three deliberately-left-alone composite copies behaving consistently — it is one that DRIFTED.** `_composite.js:126` checks `!resp.ok \|\| real` under the comment *"Trap 2: resp.ok alone proves nothing"*, and `run-line-items/index.js:452` checks it too. ✅ **FIXED 2026-09-09**, branch `fix/b11-composite-status`, commit `81b67ec`, `run-results/index.js` +30/−3 — **unpushed.** Reproduced against a fake Salesforce BEFORE fixing, then re-run after; both controls unchanged. Full detail below. |
| **B12** | 🔴 P0 | CC | **The production board builds an unbounded `IN` list out of the one query the file itself calls unbounded.** `production-orders/index.js:221-225` does `orderIds.map(oid => "'"+oid+"'").join(",")` with no chunking, over the result of the query at `:126-128` whose own comment at `:129-133` says it is *"the one query in the whole app with no date bound (it deliberately pulls in every Completed order ever)"*. An over-long IN list is an **HTTP-level rejection, not a SOQL error** — E5.12 exactly — and it **fails open** (`:236-240` only `console.error`s), so every card loses its size/quantity breakdown behind a 200 and a green chip. ⛔ **CHECK THIS BEFORE ANYTHING ELSE: it may already be live on staging.** dev2 has 81 orders and is nowhere near; staging has **2,164** orders at `Order_Substatus__c = 'Completed'` (§4's own B9 populate check), which at ~21 bytes per quoted Id is a ~45KB query URL. E7.5 made staging a switchable destination, so this is not a future risk there. 📌 The fix is already in the file: `runChunkedIdQuery` is imported at `:36` and used 60 lines below at `:284`. Same unchunked shape at `orders/index.js:209`, `shipping-orders/index.js:117`, `_mockup.js:34`, `shortfalls/index.js:90,106,116`, `shipments/split.js:131`. Full detail below. |
| **B13** | 🔴 P0 | CC | **A failed run query makes the calendar report the whole shop as unscheduled — and offer slots for all of it.** `calendar/index.js:360-435`: on failure `runsOk` goes false, the else-branch at `:430-432` logs, and **execution continues**. Every order then carries `ProductionRuns: []`, so `o.needsScheduling = o.ProductionRuns.length === 0` (`:456`) is true for everything, `busyByPress` is empty so a `suggestion` is computed for every order against **zero press occupancy**, and the response says `unscheduled: orders.length`. There is **no `runsUnavailable` flag anywhere in the response shape** (`:700-724`). 🚩 **This is not demo mode.** The board is live, the chip is green, and the data is fabricated by omission — a manager dragging those suggestions into place creates duplicate runs on top of work that already exists. The press fetch at `:315-333` has the same shape (`presses = []`, every order gets `noPresses:true`). 📌 **The convention already exists three times over** — `inbox/index.js:322` (`reprintsUnavailable`), `inbox/index.js:87` (`OrderItemsError`), `production-runs/index.js` (`locationAvailable`), and `production-orders/index.js:277-280` deliberately omits run counts rather than defaulting them to 0 *and says so*. The board with the highest stakes has the weakest convention. Full detail below. |
| **B14** | 🔵 P1 | CC | **The counting screen's "could not load this run" message is structurally unreachable.** `counting.html:483` sets `err` and leaves `detail` null; `runReady` is `!!d && !st.runLoading && !st.result` (`:983`); and the `{{err}}` banner (`:293`) sits **inside** `<sc-if value="{{runReady}}">`, which opens at `:178` and closes at `:298` — verified by counting `sc-if` nesting, the banner is at depth 2 within it. So with `d` null, `runReady` is false, `runLoading` is false, `showResult` is false, and the press operator gets an "All Runs" back button over an **empty page**. ⚠️ The banner is fine for the other two `err` setters (submit failure `:604`, demo mode `:525`) because both have `detail` loaded — it is dead **only** for the load failure, which is the `?runId=` deep-link path, i.e. what a tablet does when it wakes up mid-count and what B5/E1.4 send people down. The catch also discards `e` entirely: no status, no `errText`, no `console.error`. Full detail below. |
| **B15** | 🔵 P1 | CC | **Shipping's Complete is a phantom write in demo mode.** `shipping.html:820-828`: `if(!this._api \|\| this.state.connection!=='live'){ finish(); return; }` where `finish()` clears the poll and filters the order out of local state — so the manager confirms, the card disappears **exactly as it would on a successful write**, nothing reaches Salesforce and nothing is said. 📌 `canWriteNow()` / `reportBlockedWrite()` are defined in this very file at `:668-677` and used by `setLabelPrinted` nine lines below; the board's most consequential action does not use them. ⚠️ **Severity, stated honestly:** the orders in demo mode are demo orders, so no real order is harmed. The harm is that a board which has *silently fallen into demo mode* — the entire reason the amber chip exists — accepts Completes all afternoon that go nowhere. This is the E4.3 phantom-save pattern on the one path E4.3 did not sweep. `deleteShipmentEntry` (`:709-713`) has the same shape but touches only `_demoShipments`. Full detail below. |
| **B16** | 🔴 CONFIRMED | CC | **Mockup adoption matches on the post-redirect URL, so a redirecting host can never adopt.** `mockup-proxy/index.js:220` sets `current = new URL(raw)` and `:246` reassigns it on every redirect hop; `:277` then passes `current.toString()` into `adoptMockup`, which finds the record by exact match — `WHERE Mockup_URL__c = '<final url>'` (`_mockup-adopt.js:113-116`). But `Design__c.Mockup_URL__c` holds **`raw`**, the URL a human pasted. Any host that 301s therefore returns `no_adoptable_design` forever and the proxy takes branch B on every single load — **the treadmill D8 was written to end.** Even with no redirect, `new URL(raw).toString()` normalizes (lowercased host, percent-encoding, trailing slash), so an exact match can still miss. `raw` is in scope at `:277`; passing it is the whole fix. ✅ **This does not contradict B1's measurement** (adopted 0 → 39) — most direct image URLs do not redirect. What it does is add a **third category to what B1 calls "the permanent floor"**: hosts that redirect. ✅ **PROVEN AGAINST DEV2 2026-09-09 — this is no longer a reading.** dev2 now holds **10** `Design__c` records with a mockup URL: **9 adopted** (`/sfc/servlet.shepherd/version/download/068…`) and **1 not**, and the hold-out is `https://freepngimg.com/save/10811-calendar-png-picture/1024x1024` — a host on B1's own blocked list. **That URL redirects**, measured: it lands on `https://freepngimg.com/download/calendar/7-2-calendar-png-picture.png` (HTTP 200, `image/png` — the image is alive and fine). **End-to-end proof:** `GET /api/mockup-proxy?url=…` was called with it, the proxy served the bytes correctly, and eight seconds later the record was **unchanged** with `LastModifiedDate` **2026-08-19** — three weeks old and predating D8 adoption shipping on 09-02. So adoption ran, searched for the post-redirect URL, found no record, and gave up silently. Normalization was ruled out separately (`new URL(raw).toString()` is byte-identical for this URL), which isolates the redirect as the cause. Full detail below. |
| **B17** | 🔵 P1 | CC | **The prep checklist rollup turns a failed query into "nothing to do", silently.** All four `runQuery` calls in `_ppi-checklist.js` destructure `{ records }` and **discard `ok`** (`:109`, `:144`, `:160`, `:177`), while `runQuery` (`_sf.js:282-312`) returns `{ok:false, records:<partial>}` on failure. At `:109` a failed lookup becomes `items.length === 0` → `continue`, **with no log at all** — the forward cascade is skipped and nothing anywhere records it. At `:144` a failed lookup is indistinguishable from "item not found". ⚠️ **Severity, stated honestly rather than inflated:** at `:160`/`:177` the concern is `every()` evaluated over a truncated page and written to `Production_Method__c` — but a method's `Pre_Production_Item__c` count will never approach 2000, so that half is **theoretical**. The **silent skip is the real one**, it is routine, and it lands on the fields that decide whether a job goes to the press (`Screens_Completed__c`, `Inks_Mixed__c`). This is the "failures must not look like success" rule, broken in the quietest possible way. Full detail below. |
| **B18** | 🔵 P2 | CC | **`run-line-items` compares Salesforce Ids on the full string, so a 15-char Id breaks the endpoint.** `SF_ID` accepts 15 **or** 18 characters and SOQL `WHERE Id = '<15-char>'` matches happily, so a 15-char `runId` reaches `run-line-items/index.js:253` (`l.ProductionRun__c === runId`), `:344-346` and `:376` and fails every one. GET then returns `lines: []` while `allocatedElsewhere` **double-counts this run's own rows** — an allocation grid reading "nothing allocated here, everything allocated elsewhere". PATCH returns `line_not_found` for every row. 📌 **The convention exists and its sibling follows it:** `run-results/index.js:436` compares on the first 15 chars under the comment *"Salesforce returns 18-char Ids; a caller may hold the 15-char form."* Low priority only because every caller in this repo passes the 18-char form today; it is a trap for the next one. Full detail below. |
| **B19** | 🔴 P0 | SF | **`Order.Print_Date__c` writes are silently reverted on most orders — and it defeats BOTH rollups.** Found 2026-09-09 while diagnosing E7.7. A plain `Database.update` setting the field returns **`isSuccess() = true`** and the field reads back as its **original value** in the same transaction. Not a rejected write — a rejected write returns `false` with an error. Something in the Order's own update path rewrites it before commit, and because the DML reports success **nothing anywhere logs a thing.** ⚠️ **Not universal, and that is the useful clue:** a self-restoring probe across the 4 most recently modified orders with a print date found **3 reverted, 1 accepted** — 00013467 ✗, 00013493 ✓, 00013511 ✗, 00013508 ✗. So it is conditional automation, not a locked field, and there is a discriminating condition to find. 🚩 **This is why E7.7 looks broken when its code is correct**, and it is bigger than E7.7: `functions/api/_print-date-rollup.js` writes the same field the same way from every run create/edit/delete on the dashboards, so **the app's own rollup has presumably been overwritten on those orders all along, silently.** Full detail below. |
| **B20** | ⚠️ unpushed | CC | **DONE 2026-09-09**, branch `feat/b20-order-qty`, `calendar.html` + `counting.html` + `calendar/index.js` + `run-results/index.js`, +128/−6. **The ORDER's garment count on every method and run card.** **Most of this already existed and the audit is the deliverable:** `index.html:150` and `pre-production.html:136` already render `{{o.qty}} pcs` from `pivotItems()` over the order's own OrderItems — per ORDER, not per method, so both cards of a two-method job already agreed — and `runQtyHint()` in `ca-api.js` (2026-08-20) already puts *"50 of 300 garments on this order"* on the run rows of all three of those boards. Neither was touched. 🚩 **The real finding: there were TWO definitions of the order's garment count, and they disagreed.** `pivotItems()` and `sizeGrid()` skip any OrderItem with a blank `Size__c` — those are **non-garment lines** (setup fees, digitising), which `order-sizes/index.js` and `sizeGrid`'s own comment both state outright. `calendar/index.js`'s roll-up summed **every** OrderItem, so any job carrying a setup fee showed a higher count on the calendar than on the production board — and higher in the calendar drawer's Production Runs header (`TotalQuantity`) than in the Garments panel three inches below it (`sizeGrid.grand`). Fixed by adding `AND Size__c != null` to that one roll-up. **That, not the new rendering, is what makes B20's "one number, the same number" true.** **Added:** `counting.html` — the only board with no order count at all — now shows it on the run cards and the open run's header, from a **new fail-open chunked follow-up** in `run-results/index.js` (`garmentCountByOrder`), B8's pattern exactly: kept out of the SELECT the screen depends on (trap 1), chunked through `runChunkedIdQuery` (trap 2 / B12), **absent rather than 0** when it cannot be established. Wording comes from the existing `runQtyHint` with a null run figure — *"300 garments on this order"* — so no fifth copy of the vocabulary (B10's lesson). `calendar.html` grid blocks show it at the `roomy` tier and in the hover title at **every** tier, because those blocks are 30px tall and already ration three tiers of detail; the order number must always survive. ⚠️ **No reconciliation, by design.** A run's figure and the order's routinely differ — a job split across runs, and under D11 a Front+Back method's runs legitimately sum to TWICE the order. The two are labelled distinctly (*"300 scheduled"* vs *"300 garments on this order"*) and there is deliberately **no badge, colour or warning** on a mismatch. **Verified** in a wrangler rig: a Front+Back order whose two runs each read 300 against a 300-garment order, rendering with no error treatment; a second order whose count could not be established rendering **no line at all** rather than "0 garments"; and the calendar block/tooltip doing the same. ⚠️ **Not verified against dev2** — that pass is still owed, and it is the one that proves the counts match Salesforce. |
| **B21** | ⚠️ unpushed | CC | **DONE 2026-09-09**, branch `feat/b21-sibling-methods`, `ca-api.js` + `index.html` + `pre-production.html`, +169/−8. **Inside a method card, how many methods the ORDER has and which one you are looking at.** **Audit first:** both drawers ALREADY listed every method on the order — same markup on both boards, fed by the per-order `/api/production-methods?orderId=` fetch — with type, placements, status and colour. What neither had was a **count**, a **self-marker**, or any reconciliation of count against visible cards. No new endpoint and no new field: the network tab shows the same requests before and after. 🚩 **The story's suggested data source would have been wrong.** It proposed counting `rec.ProductionMethods` via `methodsList()`, but this board's own query is rooted on `Production_Method__c` filtered to BOARD_STATUSES (`production-orders/index.js`), so that array **cannot contain a Pre-Production, On Hold or Cancelled sibling at all** — a two-method job whose second method is still in prep would have reported "1 method", which is the exact question this story exists to answer. Counted off the per-order fetch instead, which is unfiltered. **New shared helper `methodSiblings()` in `ca-api.js`** (plus `sameMethodId()`): excludes Cancelled from the count (the house convention — gate 3 of `createReworkIfNeeded`), returns `shown:false` for 0 or 1 so a **single-method order gets nothing at all — no count, no note, and no "This card" badge on the one row it was never ambiguous about**, and composes a note that reconciles BOTH discrepancies a manager can see: methods counted but with no card on this board, and cancelled methods visible in the list but left out of the count. ⚠️ **`onBoard` is a caller-supplied predicate, not `stageOfMethod()`.** Which statuses get a card is a property of the BOARD: index.html passes `stageOfMethod()` plus its `Order.Status = 'Complete'` override; pre-production.html shows exactly Pre-Production, so a sibling In Production is off ITS board while being perfectly visible on the other. The default would have made every pre-production card report itself as off-board. **Matched by Id (first 15 chars), never by `Type__c`** — under D11/B4 an order can carry two Screen Print methods on different placements and a type match would badge both. **Verified in a browser across all four cases from the story, reading the network tab for which method each drawer actually loaded:** single-method → nothing new; two-method → both cards say "2 methods on this order" and each marks itself; a 3-method order with one Pre-Production and one Cancelled → "2 methods on this order · One has no card on this board (Pre-Production) · one more is cancelled and not counted" against 1 visible card; and a Front+Back pair of Screen Print methods → told apart by placement, each marking the right one (confirmed by `methodId=mD1` vs `mD2` in the network tab, not by the screen). ⚠️ **Not verified against dev2** — that pass is still owed; 00013504 is the two-method order to use. 📌 Caught in the browser and not by smoke: the first cut referenced a local `api` in index.html's `renderVals`, which has none — the drawer died with a red `Root.renderVals(): api is not defined` overlay while the board itself looked perfect.  🚩 **Found while landing this: `pre-production.html` is CRLF on `origin/main` and LF on the entire unpushed stack** (`b47c233`, `25a2a15`, `0c96dda`, `81b67ec` all read 0 CRLF / 2935 LF). Some earlier commit rewrote the whole file's line endings, which is invisible in a normal diff but makes **any cherry-pick between the two lineages a whole-file conflict** — `<<<<<<<` at line 1, `>>>>>>>` at the last line. It did exactly that here. ⚠️ **And resolving it by taking the origin/main-based side silently reverted B10 in that file** (the tinted drawer chip, the 3px method stripe, and the `var(--method-*)` tokens) — caught by grepping for B10's own markers after the merge, not by smoke, which passed throughout. Anthony will hit the same conflict when he merges; the fix is to normalise `pre-production.html` back to CRLF on one side before merging, and to check B10's markers survive.|
| **B22** | ⚠️ unpushed | CC | **DONE 2026-09-11**, branch `fix/b22-formula-html-in-name`, commit **`19b21e1`** (on top of `fix/b11-composite-status`), `functions/api/_sf.js` + `shipments/combine.js` + `shipments/split.js`. **Unpushed.** 🔴 **A HYPERLINK() formula field was being written straight into a Salesforce text field, and it broke COMBINE outright in every org.** Found by actually running §8 surface 3 item **3.6** against dev2 (2026-09-11), not by reading code. `combine.js` built `Name__c = "Combined w/ ${primaryLabel} - ${label}"` where both labels came from `GOA_Order_Number__c` — which is a **HYPERLINK() formula** and arrives as `<a href="/801ca00000PzawG" target="_self">20460-4</a>`: **53 characters carrying 7 characters of meaning**. The value sent was **121 characters** into a field that holds **80**, and Salesforce refused `leg0` with **`STRING_TOO_LONG`**. 📌 **Three things make this worse than a formatting slip.** **(1) It failed at TWO orders**, not at the 25 the composite ceiling talks about — so combine had never worked at any size, and **E5.10's raised 12→25 ceiling had therefore never been exercised against an org at all**, which is precisely what 3.6 existed to test. **(2) It travels.** A formula's definition ships with the metadata, so this is not dev2 data. Confirmed **read-only against staging** the same day: same anchor, 51–53 characters, same 121-character result. It would have broken combine in **production** on day one (E7.4). **(3) The codebase already knew.** `ca-api.js`'s `text()` has flattened these for the BOARDS since trap 6 was first written down — the client has been careful about this for months. The **server** simply never got an equivalent, and these were the only two places a formula value was written back rather than passed through (audited: `Customer_Order_Name__c`, the other HYPERLINK formula, is read-only everywhere server-side). **The fix:** new **`plainText()`** in `_sf.js` — tag-strip + entity decode + the same whitespace collapse `text()` does, so a written name reads like the board label. **Not DOMParser** (Workers have no DOM), and `&amp;` decodes **last** so `&amp;lt;` stays literal. Plus **`SF_NAME_MAX = 80`**, established empirically rather than guessed: a **61**-character split leg name was accepted by dev2 and a **121**-character combine one was not. Both call sites now budget against it — combine's template contributes 15 fixed characters so each label is clamped to 32, split's longest suffix is `" - Leg 25"` so its label is clamped to 71. Real GOA numbers are 5–8 characters, so **the clamp never bites on live data**; it is there so no order number can ever take a leg down again. 🚩 **`split.js` had the same bug and it was silent.** Its name is only 61 characters, so it FIT — split never failed, it just wrote an `<a href=…>` tag into every leg's `Name__c`, which is what a human reads in Salesforce. Fixed in the same commit; **this is the half nobody would have found by watching for errors.** **Verified** by `~/tmpwork/namefix.mjs`, which drives the real `onRequestPost` of both endpoints against a stubbed Salesforce and asserts on the `Name__c` in the actual `/composite` body: `Combined w/ 20460-4 - 20461-2` = **29 chars** (was 121), `20460-4 - Leg 1` = **15** (was 61), the `OrderNumber` fallback still fires when GOA is null or empty, and a **300-character** GOA clamps to **79**. 🚩 **Negative control run, per B11's lesson** — the labels were reverted to the pre-fix expressions and the harness was re-run: it reported **121 characters, html=YES**, the exact value dev2 rejected. The test can fail, so its passing means something. The harness also hard-exits if `/composite` was never called. ⚠️ **Not yet verified against an org** — that needs a deploy. **The moment it is live, re-run 3.6 and then 3.9**, both of which have been blocked on this. |
| **B23** | ⚠️ unpushed | CC | **DONE 2026-09-11**, branch `fix/b19-verify-print-date-write`, commit **`11b457e`** (on top of B22), `functions/api/_print-date-rollup.js` + `production-runs/[id].js` + `production-runs/index.js`. **Unpushed.** **The print-date rollup now verifies its own write instead of trusting the 204.** This is the *visibility* half of **B19** — it does **not** fix the revert, and is worth having even if B19 is never solved, because the silence is what let 52% of dev2 drift with nothing logged anywhere. `rollupPrintDateToOrder` PATCHed, got a 204 and returned `changed: true` **without ever checking the value was still there** — so end to end the endpoint returned 200, the helper reported success, and the board re-read the same stale date. **Same class as B11: a failure reported as a success.** **Now:** it reads the field back, and on a mismatch logs loudly naming B19 and returns `{changed:false, reverted:true, attempted:<what it wrote>}` so a caller can tell *wrote it* from *thought it wrote it*; a read-back that cannot be performed returns **`verified:false`** rather than claiming success. The three run endpoints (create/update/delete) pass an **additive `printDateReverted`** flag into their JSON — **nothing renders it yet**, it is there so the information reaches the client at all. 📌 **Cost is one query, and only on the path that actually PATCHed** — the existing read-before-write returns early for the common no-op case, which the harness asserts (2 queries, not 3). ⛔ **Deliberately NOT done: no retry** (the write is reverted upstream; retrying just loses the same race more loudly) and **no change to `OrderPrintDateRollup` or `ProductionRunTrigger`** — both read in full, both correct, see E7.7. **Verified** by `~/tmpwork/b19verify.mjs` driving the real rollup *and* the real `PATCH /api/production-runs/:id` against a Salesforce stub that accepts the write then serves the old value back: reverting org → flag + log + `printDateReverted` in the JSON; honest org → `changed:true, verified:true`, no flag, no log; unverifiable → `verified:false`; no-op → no PATCH at all. 🚩 **Negative control:** with the read-back removed, **9 assertions fail** and the reverting-org response is a bare `{"ok":true,…}` with no warning — **exactly the silence this defect has been hiding behind.** |

📌 **B11–B19 added 2026-09-09, and how they were found is part of the record.** They came out of a
full read of the API layer and all nine boards, not from a test pass on the floor, so **every one is
a reading of the code and none was reproduced against a live org.** Rule 1 says record what was
measured — this is the honest label for all eight. Two of them (B11, B18) are settled by the
codebase contradicting itself: a sibling file does the same job the other way and explains why in a
comment, which is about as close to measured as a static read gets. The rest name the exact check to
run, and **B12 in particular is answerable with one query against staging** rather than an argument.


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

### 🧭 Target model build — OBJECT-GUIDE adoption, plan and test protocol (written 2026-09-16)

**Why this exists.** On 2026-09-16 Anthony's boss handed over a new Salesforce object design
(`OBJECT-GUIDE.md`, produced in another Claude project). The point of it is to make **each order's
process definitive and its record-keeping clearer**: one reusable record for the art, one "recipe" for
how that art prints with each method, real catalog objects instead of copied picklists, and a counting
log in place of a single end-of-run total. This section is how that design gets built **without
breaking the dashboard**. Read it with §2 open. Every rule below comes from a trap in that section.

📌 **The mental model: the dashboard is the outfit, Salesforce is the body.** Workers only see the
boards. Salesforce holds the data, the flows and the Apex. They ship on different schedules: org
changes go by hand or change set, org by org, while code goes live **in all three orgs at once** on
push. So every stage below is built **body first, outfit second**, and the outfit must still fit if
the body in the active org is one step behind.

**Measured basis.** Counts, field lists and the decision record are in the Claude project
*UI/Salesforce Fixes v12*: `claude/target-model-gap-analysis.md` and
`claude/step0-dev2-measurements-2026-09-16.md`. They were read live from dev2 and staging on 2026-09-16
through the Developer Console. Headline numbers:

| | dev2 | staging |
|---|---|---|
| Orders | 88 | 6,697 |
| `Pre_Production_Item__c` | 326 | 211 |
| `Print_Process_Details__c` | 0 | **5** |
| Artwork Master / Design / Artwork Asset | 1 / 28 / 0 | 0 / 18 / 1 |
| `Screen__c` | 6 (all on an Order) | **object absent** |
| `Order.Design__c` set | 69 | **4,846** |
| `Order.Artwork_Approved__c` ticked | 0 | **236** (~3.5%) |
| Decoration methods in use | 3 of 4 | 3 of 4 |
| Placements in use | 6 of 11 | 4 of 11 |
| `Production_Station__c` | ~~empty shell, no run lookup~~ **same 9 fields + run lookup, all FLS-hidden (corrected in S1)** | **9 fields, 2 rows, run lookup set on 6 of 35** |

**Decisions this plan rests on:** D14–D19 in §5, all dated 2026-09-16.

#### What already exists vs what the design asks for

| Target object | Today | Stage |
|---|---|---|
| Order, Order Product, Production Requirement, Production Plan, Decoration, Production Run, Run Line Item, Artwork Master, Artwork Asset | ✅ exist; wave 0a–0c renames done in both sandboxes | — |
| Artwork Version | `Design__c`. **Keeps its API name (D14)**, but the Opportunity master-detail must change | S3 |
| Work Center | `Production_Station__c` (**D19**); ✅ both sandboxes aligned in S1 | S1 ✅ |
| Approval gate | `Order.Artwork_Approved__c` exists; nothing enforces it (**D15, D16**) | S2 |
| **Art Spec** | ❌ does not exist | S3 |
| **Decoration Method**, **Placement** | ❌ picklists on `Decoration__c` and both run objects | S4 |
| Decoration → Art Spec, Pre-Production Item → Art Spec | ❌ | S5 |
| **Run Result** | ❌ (**D17**, supersedes D1) | S6 |
| **Screen Prep**, **Ink Mix**, **Screen Reclaim**; Screen → Art Spec | ❌ (`Screen__c` exists in dev2 only) | S7 |
| Production | ❌ **none of the production objects exist there** (§9) | S8 |

#### The build rules — apply to every stage

1. **Additive only. No renames.** An object rename cost four Apex classes (trap 15). Nothing in this
   plan renames an object or a field. New names are new components. Old ones are frozen and retired
   later, never repurposed.
2. **Body first.** A new field or object is created in **dev2 → FLS → staging (change set) → FLS**, and
   read back in **both** orgs, **before** any file under `functions/` names it. Change sets drop FLS,
   arrive flows **Inactive**, and never carry records, permission-set assignments or deletions (§9).
   The profile that matters is **System Administrator**, which the dashboard signs in as (S1
   finding 2). Grant `Salesforce API Only System Integrations` and `Minimum Access - API Only
   Integrations` as well.
3. **The outfit must fit a body one step behind.** Production has none of this, so for as long as it
   can be the active org, **every new field the app reads goes through `runQueryOptionalField`
   (`_placements.js`) or sits on its own endpoint that can answer `available:false`** (trap 1). A new
   object is never added to an existing board's main SELECT. It gets a follow-up query.
4. **Writes stay allow-listed** (§2 conventions). Every new picklist or catalog value lives in **one**
   shared module. Today the placement list has at least four copies: `_placements.js`, a private
   `ALLOWED_PLACEMENTS` in `decorations/[id].js`, `ca-api.js` `PLACEMENTS`, and the org value sets.
   Converge them **before** S4.
5. **Apex: Download before you edit** (trap 15). Any stage that touches a class starts with
   Setup → Apex Classes → Download.
6. **Flows: verify the active version number, then read resolved values in a debug run** (traps 11,
   16, 17). A flow that completes is not a flow that works. A faulting flow rolls back the whole save.
7. **One stage per branch, one story per commit, Asana id in the message, no push** (§0).
   **Update this file at the moment a piece lands**: the stage row below, §9 for parity, §11 for the
   change log.
8. **Sandbox records are disposable; Setup is not** (§1). Break test orders freely. Treat every field,
   value, flow version and validation rule as something that ships to production.

#### The test protocol — every stage passes all of these before the next one starts

| # | Check | How | What it catches |
|---|---|---|---|
| T1 | Repo is well-formed | `node tools/smoke.mjs` (7 checks, baseline green 2026-09-16) | missing files, parse errors, `<sc-for>` in `<table>` |
| T2 | Body matches in both orgs | Dev Console: `SELECT QualifiedApiName, DataType FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '<obj>'` in dev2 **and** staging, diffed. ⚠️ **It omits fields the querying user cannot see** (S1 finding 1), so confirm any "missing" field on the classic object page | a field missing or typed differently in one org |
| T3 | FLS granted | Setup → field → Set Field-Level Security, both orgs. **The load-bearing profile is System Administrator**, the dashboard's run-as user (S1 finding 2); also grant the two integration profiles for safety. Confirm with `SELECT Parent.Profile.Name, Field FROM FieldPermissions WHERE SobjectType = '<obj>'` | trap 1, the whole-board blank behind HTTP 200 |
| T4 | Flows active and correct | Flow Trigger Explorer active version, plus a debug run's **resolved inputs** | inactive change-set flows; green-but-wrong flows |
| T5 | Outfit fits every org | `GET /api/admin/sf-env`, then walk the affected boards on **dev2, then staging**. **Network tab, not the screen.** No amber "Demo data" chip, no 4xx/5xx | demo-data fallback masking a broken query |
| T6 | Outfit survives a missing body | Temporarily remove FLS on the new field in dev2 and reload. The board must still load and simply omit the feature. Restore FLS | trap 1 for the production case |
| T7 | Scenario walk | The stage's scenarios below, on a throwaway order in each sandbox | the behaviour actually changed |
| T8 | Nothing else moved | Re-run the §8 checks for the boards the stage touched; `GET /api/rework-check` on a reprint order | regressions in reprint and rollups |

The Developer Console recipe is in §2 (`Ext.getCmp('queryEditorText').setValue(...)`). For batches,
hook `Ext.Ajax` `requestcomplete` and key each response on its `q=` URL parameter. Responses arrive
late, so keying on order mislabels them. Use `COUNT(Id) n` rather than `COUNT()`. Keep each script
call short, because a backgrounded console tab throttles timers and a long awaited loop hits the 45 s
timeout.

---

#### S0 · Measure and decide — ✅ DONE 2026-09-16, five small items left

✅ Counts taken in both sandboxes. ✅ D14–D19 decided.

**Still open, none of them blocking S1:**
- 📌 **Approval-gate start date (D16):** the day the whole design is built in Salesforce. When S7 is done, **ask Anthony to confirm it.** Nothing to pick before then.
- ✅ **`Order.Design__c` is attached by a person (D20).** In S3, still check that no flow or Apex overwrites it.
- ✅ **`Print_Process_Details__c` is retired whenever convenient (D21).** No row review is needed in the sandboxes; count production's rows before deleting there.
- 🔵 **Settle `Design_Family__c` (dev2) vs `Design_Artwork__c` (staging)** (§11, 2026-09-16). Still open after S3.
- ✅ **What writes `Order.Design__c`:** found in S3 — flow *Order and Order Items Subflow Design* sets it at order creation.
- ✅ **Production waits for the finished model (D22).** E7.4's old-model build is superseded.

#### S1 · Work Center parity (D19) — ✅ DONE IN BOTH SANDBOXES 2026-09-16

**What was planned** was building staging's nine fields and the run lookup in dev2. **What was found
changed the job:** dev2 **already had all of them.** Peter Larson created them on 2026-05-22, and
`Production_Run__c.ProductionStation__c` exists too. The morning's measurement said *"empty shell, no
fields, no lookup"* because **none of the fields were visible to any profile, including the admin
running the query.** See the 🚩 below. So S1 became a **visibility-and-cleanup** stage, not a build.

**Done and verified (read back from both orgs through the Developer Console after the change):**

| | dev2 | staging |
|---|---|---|
| The 9 station fields + `Production_Run__c.ProductionStation__c` exist | ✅ (already did) | ✅ (already did) |
| FLS, Visible + editable | ✅ **newly granted** on all 10 to System Administrator, System Admin GOA, System Admin Modified, Salesforce API Only System Integrations, Minimum Access - API Only Integrations | ✅ System Administrator already had all 10; the run lookup is visible to every profile. The other four profiles were **not** added on the 9 station fields (cosmetic; nobody signs in on them) |
| `Station_Type__c` values | ✅ **fixed**: was one junk value, literally `Type of production equipment` (a description typed as a value). Renamed to `Screen Print`; added `Embroidery`, `Heat Press` | ✅ same fix |
| `Active__c` | ✅ **Text(255) → Checkbox**, default Checked | ✅ same |
| Station records | ✅ **5 created**: Press 1, Press 2 (Screen Print) · Embroidery Machine (Embroidery) · Hat Press, Shirt Press (Heat Press). All Active; `Station_Name__c` = Name | ✅ Press 1 and Press 2 **updated in place** (6 runs still point at them); the other 3 created. Same 5, same values |

The five stations mirror the five `Account Type='Press'` records by name, and their types mirror
`Account.Print_Method__c`. **Capacity, setup minutes, run minutes, location and code are still blank
in both orgs.** They need real shop numbers from Anthony before S4 can use them.

**Dashboard:** no change, as planned. **Not done / follow-ups:**
- **Page layout.** dev2's Production Station layout shows only Name, so a record created from the UI
  cannot set the new fields. Add them to the layout in both orgs (metadata, hand work).
- **Real numbers** for capacity and setup/run minutes (Anthony).

🚩 **THREE FINDINGS FROM S1 THAT CHANGE HOW EVERY LATER STAGE IS TESTED.**

1. **`FieldDefinition` hides fields the querying user cannot see.** A FLS-hidden field does not show up
   as "hidden"; it is **simply absent** from `SELECT … FROM FieldDefinition`, exactly as if it did not
   exist. That is how 2026-09-16's measurement reported dev2's station object as empty, and it makes
   test **T2 unreliable on its own.** Cross-check any "missing field" against the classic object page
   (`/<01I id>?setupid=CustomObjects` → *Custom Fields & Relationships*), which lists every field
   regardless of FLS. The same effect shows on `Production_Run__c` in dev2: **Setup lists about 40
   custom fields, while the admin's `FieldDefinition` returns 22**, and *Deleted Fields* shows only 3.
   ⚠️ **So §4 wave 0c's "20 fields … are deleted" is probably wrong.** They look FLS-hidden, not
   deleted. Re-check before trusting either reading.
2. **The dashboard does not sign in as the "integration" profiles.** `_sf.js` uses OAuth
   `client_credentials` through the connected app **PreProd Dashboard**. Login history shows its
   run-as user in **both** sandboxes is an **"Anthony Martinez" user on the System Administrator
   profile** (dev2 `005ca00000BhcA9`, staging `005ca00000B0aWt`), with one permission set, **Proposed
   Runs Access**. In dev2, **no user at all** is on `Salesforce API Only System Integrations` or
   `Minimum Access - API Only Integrations`. ➡️ **The FLS that actually decides trap 1 is System
   Administrator's** (plus that permission set). §9's advice to grant the two integration profiles is
   harmless but not load-bearing. Production's run-as user is unknown until E7.5 configures it.
3. **Change-field-type is scriptable if you do not mouse-click it.** In staging, a mouse click on the
   *Checkbox* radio of `CustomFieldStageManager?change=1` froze the renderer (trap 13's family).
   Setting the radio with a form-input call, then pressing Next and Save from a separate script step,
   worked in **both** orgs. The same goes for *Set Field-Level Security*
   (`StandardFieldAttributes/e`): its Save ignores mouse clicks about half the time but always
   responds to a scripted click. Get the page's token URL by fetching the field detail page and
   reading the button's `navigateToUrl(...)`.

📌 Also seen in login history: **Salesforce CLI** sessions (`Remote Access 2.0 · Salesforce CLI`)
exist in both sandboxes. A CLI is authenticated on some machine, which matters for the "no CLI path"
assumption in §0.

#### S2 · The approval gate (D15, D16) — ✅ BUILT IN BOTH SANDBOXES 2026-09-16, GATE OFF (date blank)

**What exists now.**
- `Production_Gate__mdt` (Custom Metadata), field `Approval_Gate_Start__c` (Date), record **`Default`**
  with the date **blank** in both orgs. dev2 type `01Ica000000Wqpt`, record `m0Xca000001vmaU`; staging
  type `01Ica000000Wr1B`, record `m0Xca000001vmk5`.
- Validation rule **`Decoration__c.Artwork_Approval_Gate`**, active, Top of Page. dev2 `03dca000000IWCj`,
  staging `03dca000000IWEL`. Formula:
  ```
  AND(
    OR(ISNEW(), ISCHANGED(Status__c)),
    OR(ISPICKVAL(Status__c, "Ready for Print"), ISPICKVAL(Status__c, "In Production")),
    NOT(ISBLANK($CustomMetadata.Production_Gate__mdt.Default.Approval_Gate_Start__c)),
    NOT(Order__r.Artwork_Approved__c),
    DATEVALUE(Order__r.CreatedDate) >= $CustomMetadata.Production_Gate__mdt.Default.Approval_Gate_Start__c
  )
  ```
  Message: *"Artwork is not approved on this order yet. Tick Artwork Approved on the Order, then move the
  decoration again."* (A validation-rule message cannot easily name the order number; the dashboard's
  own message does.)
- **Code (uncommitted on Anthony's Mac, for review):** new `functions/api/_approval-gate.js`
  (`loadGateStart`, `checkApprovalGate`, `gateResponse` → **409 `artwork_not_approved`** with a
  sentence naming the order, `isApprovalRuleFailure`); the check is called before the write in
  `decorations/[id].js` (PATCH to a gated status, and the org rule's refusal is turned into the same
  409), `decorations/index.js` (create at a gated status) and `production-runs/index.js` (**before the
  insert**; nothing on the Planned → Confirmed PATCH). `calendar.html` `commitDrop` now alerts
  `errText(e)` so the sentence reaches the worker instead of `POST … -> 409`. The start date is cached
  60 s per org. **Degrades open:** no metadata type, no record, blank date, `Artwork_Approved__c`
  unreadable, or any failed lookup → allowed and logged.

**How it was tested.**
- dev2 Execute Anonymous (every script ends in `System.assert(false)`, so nothing was kept): date blank →
  moves allowed. **Date set temporarily to 1/1/2026 with Anthony's OK** → unapproved order moved to
  Ready for Print and to In Production is refused with the message; tick Artwork Approved → allowed.
  Date then **cleared** and re-read blank on the record page. dev2 has no order created before 2026, so
  scenario (a) could only be tested in code. staging: date blank → allowed; staging's date was never set.
- Local harness (mocked Salesforce), 14 checks pass: off for blank / no record / no type / unreadable
  field / failed read / no ids / bad id; blocked for an unapproved order on or after the start (also via
  a decoration id); allowed when approved or created before the start; the 409 shape. A mutation
  control (flipping the approved test) failed 5 checks, so the harness bites. `node tools/smoke.mjs` green.

**Still open for S2.**
- **Before the date is ever set:** check `OrderScheduling` and the Order flows for any system-context path
  that moves a Decoration to Ready for Print / In Production (a flow hitting the rule faults and rolls
  back, trap 17). Harmless while the date is blank, because the rule cannot fire.
- **Board chip "Needs art approval"** (`index.html`, `pre-production.html`, `calendar.html`) deferred on
  purpose: with the gate off it would mark ~96% of staging orders for no reason. Build it together with
  the date, showing only when the gate is on for that order.
- Scenarios (b)–(e) through the real dashboard (not just the org) once the code is deployed to a
  preview, and T6 with FLS removed from `Artwork_Approved__c`.
- At the end of S7: **ask Anthony for the start date**, set it in both orgs' `Default` record (records
  also travel in the change set to production, D22).

**The original plan, kept for reference.**

**Salesforce.**
- **A Custom Metadata Type**, e.g. `Production_Gate__mdt` with `Approval_Gate_Start__c` (Date).
  📌 Use Custom Metadata, **not a custom setting or a record**: its records **do** travel in a change
  set, so the start date reaches staging and production with the rule instead of being re-typed per
  org (E7.1's `Production_Calendar_Setting__c` is the counter-example).
- **A validation rule on `Decoration__c`.** It blocks `Status__c` changing to `Ready for Print` or
  `In Production` when `Order__r.Artwork_Approved__c` is false **and** the Order was created on or
  after the start date. **A blank start date means the rule never fires**, so S2 can ship early and stay dark until Anthony confirms the date at the end of S7. Its message says exactly what to do: *"Artwork is not approved on order
  #####. Tick Artwork Approved on the Order, then try again."*
- ⛔ **Do not put the same rule on `Production_Run__c`'s `Planned → Confirmed` PATCH.** A rule failing
  there leaves the run **stranded on `Planned`** with no calendar Event (trap 9). That is the exact
  signature of trap 17's rolled-back-flow incident and would be misdiagnosed the same way. The run
  side is enforced in the app **before insert**.
- Check `OrderScheduling` and the Order flows for any path that moves a Decoration's status in system
  context. A validation rule applies there too, and a flow that hits it faults and rolls back
  (trap 17).

**Dashboard.**
- **`functions/api/decorations/[id].js`:** before PATCHing `Status__c` to `Ready for Print` or
  `In Production`, read `Order__r.Artwork_Approved__c` and the gate start date. Refuse with a named
  reason (`artwork_not_approved`) and a human message, never the generic failure shape (§2
  conventions).
- **`functions/api/production-runs/index.js` (create) and `calendar.html` (`commitDrop`):** the same
  check **before the insert**, so a run is never created for an unapproved order.
- Boards: a "Needs art approval" chip on cards in `index.html`, `pre-production.html` and
  `calendar.html`, so the block is visible before anyone tries to move the card.
- **Read `Artwork_Approved__c` and the metadata through an optional path** (build rule 3). If the
  active org lacks either, the gate is **off**. Log it, but do not block the shop in an org where the
  rule does not exist.

**Test.** T1–T8, plus these scenarios:
(a) an order created **before** the start date, unapproved → moves freely;
(b) created **after**, unapproved → the card will not move to Ready for Print, the run form refuses,
and the message names the order;
(c) tick the box → both work;
(d) no run is ever left on `Planned` by the gate (query `Auto_Scheduling_Status__c = 'Planned'`
before and after);
(e) T6 with FLS removed from `Artwork_Approved__c` → boards load and the gate is off.

#### S3 · The art layer: Art Spec, and Design Version reparented (D14) — ✅ DONE IN BOTH SANDBOXES 2026-09-17

**Decided with Anthony before building (2026-09-17):** delete `Opportunity.Design_Count__c` (a COUNT
roll-up over `Design__c`, the only thing blocking the type change; no metadata referenced it; 15 staging
Opportunities had a value); when an Opportunity is deleted, **keep the design** (lookup = clear value);
`Design__c` sharing becomes **Public Read/Write** (Salesforce sets it on conversion; matches
`Artwork_Master__c`); Art Spec gets the **full recipe** field list.

**What exists now (same in both orgs).**
- **`Art_Spec__c`** (label Art Spec, name `AS-{00000}`, reports + history on). dev2 object `01Ica000000Wryr`.
  Fields: `Artwork_Version__c` (Lookup → `Design__c`, optional, clear on delete, child rel `Art_Specs`),
  `Decoration_Method__c` (restricted picklist: Screen Print / Embroidery / Heat Press / Promotional Items,
  mirrors `Decoration__c.Type__c` until S4), copied from `Design__c`: `Ink_Colors__c`,
  `Print_Color_Order__c`, `Print_Specifications__c` (Text Area), `Size_Location__c`, `Dryer_Settings__c`;
  screen print: `Mesh_Counts__c`, `Ink_Type__c` (Text 100), `Flash_Notes__c`; embroidery:
  `Stitch_Count__c` (Number 8,0), `Thread_Colors__c`; heat press: `Transfer_Type__c` (restricted picklist
  DTF / HTV / Sublimation / Screened Transfer / Other, **= `Decoration__c.Transfer_Type__c`**),
  `Press_Temperature_F__c` (3,0), `Press_Time_Seconds__c` (3,0), `Press_Pressure__c` (Text 50);
  `Notes__c` (Long Text). **Copied, not moved:** the `Design__c` fields are untouched.
- **`Decoration__c.Art_Spec__c`** (child rel `Decorations`) and **`Pre_Production_Item__c.Art_Spec__c`**
  (child rel `Pre_Production_Items`), both optional lookups, clear on delete.
- **`Design__c.Opportunity__c` is now Lookup(Opportunity)**, optional, clear on delete, child rel still
  `Designs`. Records kept their links: **dev2 28/28, staging 18/18**. `Design__c` now has a standard
  Owner (dev2: Anthony 13, Peter 13, Uros 2) and sharing `ReadWrite`. **`Opportunity.Design_Count__c` is
  deleted and erased in both orgs** (Salesforce hides "Change Field Type" while a deleted roll-up is
  still in the Deleted Fields bin; Anthony erased it by hand).
- **staging `Design__c.DesignMaster__c` already existed** (Lookup → Artwork_Master__c, label "Design"),
  FLS-hidden, which is why S0 reported it missing. FLS granted 2026-09-17 (System Administrator + the two
  integration profiles). 0 records set.
- **How it moved:** built by hand in dev2 (field wizard; FLS defaults gave every profile edit), then
  outbound change set **"S3 Art Spec 2026-09-17"** (object, 17 fields, layout, both lookups, **plus profile
  settings for System Administrator and the two integration profiles, so FLS travelled**), deployed in
  staging by Anthony. The reparent, the roll-up deletion and the staging FLS grant were done by hand in
  each org.
- **4 sample Art Specs in dev2** (AS-00001…04), from real Pre-Production Items: Franklin Classical
  (00013513) screen print + heat press, Schedule Master Merch (00013474) embroidery, Apex Orders
  (00013518) screen print. Each is linked to its decoration and that decoration's PPIs (12 PPIs).

**Tested.** T2: field lists match in both orgs (17 on Art Spec). T3: System Administrator + both
integration profiles can edit all 19 new fields in both orgs (`FieldPermissions`). dev2 Execute
Anonymous (rolled back): a `Design__c` with no Opportunity inserts, and an Art Spec hangs off it. T5 on
dev2 after the reparent: `/api/production-orders` 200 with 66 mockup URLs, `/api/calendar` 10, `/api/inbox`
3, a `mockup-proxy` fetch 200 — the Opportunity → Design mockup path still works. T8: `/api/rework-check`
all six queries OK on 00013513 / 00013517 / 00013474. No code changed, so T1/T6 do not apply.
**Not done:** T5 on staging (switching the active org is global and PIN-gated; do it on the next planned
switch).

**🚩 What the samples say about the shape — answered 2026-09-17 as D23–D26 (§5).**
1. **One recipe per decoration is not enough for multi-placement decorations.** 00013513's screen-print
   decoration is Back;Front with two inks and four screens. If front and back are different art, each
   placement needs its own Art Spec, which makes Art Spec per design + method + **placement** (S4).
2. **The same design + method is not always the same recipe.** "Calendar King Orders 20487" has three
   embroidery decorations with different threads and stitch counts. Real or test noise? If real, Art Spec
   is less reusable than OBJECT-GUIDE assumes.
3. **Two transfer-type lists:** `Pre_Production_Item__c.Transfer_Type__c` = Screen Transfer / Digital
   Transfer / Sublimation / Vinyl; `Decoration__c.Transfer_Type__c` = DTF / HTV / Sublimation / Screened
   Transfer / Other. Art Spec uses the Decoration list. Converge in S4 (build rule 4).
4. **`Order.Design__c` has an automated writer:** flow *Order and Order Items Subflow Design* (active v48)
   sets it on the Order it creates from its `DesignID` input. D20 says a person attaches it; that holds for
   manual orders only. The reorder screen flow copies `Design__r.Id` onto new Opportunity products.

**The original plan, kept for reference.**

**Salesforce.**
- `Art_Spec__c`: Lookup → `Design__c` (Artwork Version), Lookup → decoration method (a picklist
  mirroring `Decoration__c.Type__c` until S4 creates the object), plus the per-method print facts that
  today sit on `Design__c` (`Ink_Colors__c`, `Print_Color_Order__c`, `Dryer_Settings__c`,
  `Print_Specifications__c`, `Size_Location__c`, `Method__c`). **Copy, do not move.** The old fields
  stay readable until nothing reads them.
- **`Design__c.Opportunity__c`: Master-Detail → Lookup.** This is a type change, not a rename, so Apex
  still compiles. Before changing it, check for Opportunity roll-up summaries over `Design__c`, for
  sharing that depends on the master-detail, and for the Opportunity-side flows (36 Apex references,
  §11). **Keep the field populated.** The dashboard's mockup path runs `Order.OpportunityId` →
  `Design__c.Mockup_URL__c` (`_mockup.js`, `mockup-proxy`, D8 adoption) and must keep working.
- Staging needs `Design__c.DesignMaster__c` (Lookup → Artwork Master). Only dev2 has it.
- Populate a handful of Art Specs **by hand from real Pre-Production Items** and check the shape
  against real jobs before anything reads it.

**Dashboard.** Nothing reads Art Spec yet. D8's lazy mockup adoption writes to `Design__c`. Re-test it
after the parent change.

**Test.** T2, T3, T5 (mockups on `index.html`, `pre-production.html`, `order-sheet.html`), T8.
`Design__c` record counts unchanged in both orgs.

#### S4 · The catalog layer: Decoration Method, Placement, Work Center cutover — ✅ DONE IN BOTH SANDBOXES 2026-09-17

**Decided with Anthony (2026-09-17):** build the per-placement junction (D23); the D25 transfer mapping as
proposed; stations filled from the press **by name**, non-press accounts ("CA Press 1", "Culture Apparel")
left blank; `Run_Minutes_Per_Unit__c` takes decimals.

**What exists now (both orgs).**
- **`Decoration_Method__c`** (Name = the `Type__c` value; `Active__c` default on, `Sort_Order__c`) — 4 records:
  Screen Print, Embroidery, Heat Press, Promotional Items. dev2 object `01Ica000000Ws6v`.
- **`Placement__c`** (Name = the picklist value; `Active__c`, `Sort_Order__c`) — all 11 values, Front…Pocket.
  dev2 `01Ica000000Ws8X`.
- **`Decoration_Placement__c`** (`DP-{00000}`; dev2 `01Ica000000WsA9`): `Decoration__c` (**required
  Lookup**, not master-detail — Salesforce does not offer `Decoration__c` as a master because it is already
  the detail of two master-detail relationships, Order and `Production_Plan__c`), `Placement__c`,
  `Art_Spec__c` (D23, set by a person; S5 wires it). One row per decoration per placement.
- **New lookups:** `Decoration__c.Decoration_Method__c`, `Production_Run__c.Placement__c`,
  `Proposed_Run__c.Placement__c`, `Art_Spec__c.Placement__c`, `Art_Spec__c.Method__c`.
- `Pre_Production_Item__c.Transfer_Type__c` gained DTF / HTV / Screened Transfer / Other; **the old four stay
  active** (the pages still send them and production only has them). `Production_Station__c.Run_Minutes_Per_Unit__c`
  is now `Number(14,2)`.
- **Apex (source in `New Apex Classes/`):** `CatalogSync` + `CatalogSyncTest` (8/8 pass in dev2; class 90%
  covered) and five triggers — `CatalogSyncDecoration` (before insert/update/delete, after insert/update),
  `CatalogSyncProductionRun`, `CatalogSyncProposedRun`, `CatalogSyncArtSpec`, `CatalogSyncPreProductionItem`
  (all before insert/update). **Dual-write happens in the org:** the app keeps writing `Type__c`,
  `Placements__c`, `Print_Location__c`, `Press__c`, and the triggers fill the lookups by name and keep the
  junction rows in step. They never throw (bookkeeping must not roll back a save, trap 17) — except the
  before-delete, which removes a decoration's junction rows first: **a required lookup forces "don't allow
  deletion of the parent", so without it every decoration with placement rows would become undeletable.**
  Station rule: set from the press on create or press change; a station typed on a run whose press did not
  change is kept; no same-named station → blank. PPI transfer types: legacy → canonical on save (D25).
- **Code (uncommitted on the Mac):** `_placements.js` now owns `DECORATION_METHODS`/`ALLOWED_METHOD_TYPES` and
  `ALLOWED_TRANSFER_TYPE` (legacy + canonical); `decorations/[id].js`, `decorations/index.js` and
  `pre-production-items/index.js` import them instead of private copies (build rule 4). Smoke green. Reads
  do not use the lookups yet; writes still send picklist values.
- **Moved to staging** by change set **"S4 Catalog 2026-09-17"** (27 components + System Administrator and the
  two integration profiles, so FLS travelled), deployed by Anthony. Catalog records were seeded by script in
  each org (records do not travel).

**Backfill (by anonymous Apex, per org).**
| | dev2 | staging |
|---|---|---|
| Decorations with a method | 101 / 101 | 51 / 51 |
| `Decoration_Placement__c` rows | 108 | 74 |
| Runs with `Placement__c` (= runs with a print location) | 52 / 52 | 4 / 4 |
| Runs with a station | 88 | 28 (23 from press; 5 had a station and no press) |
| Proposed runs with `Placement__c` | 46 / 46 | 7 / 7 |
| PPI transfer types remapped | 27 → Screened Transfer | 3 → Screened Transfer |
| Runs whose schedule changed | **8** (see below) | **0 of 35** (snapshot compared) |

🪤 **Saving a run or a decoration re-runs the auto-scheduler for that press** (`ProductionRunTrigger` /
`ProductionMethodTrigger` → `ProductionAutoSchedulerService`), which re-slots every run not Confirmed/Planned.
The dev2 backfill therefore touched 8 stale, past-dated suggestions: 7 became "Unable to auto-schedule" and
PR-0029 moved from 6/8 to 9/20. Confirmed/Planned runs never move. Staging had no such runs. **Before any
production backfill, count `Press__c != null AND PrintMethod__c != null AND status not in
(Confirmed, Planned)` first.** The skeleton flow is safe (entry requires the change to Confirmed).

**Tested.** T1 smoke green. T2/T3: fields and System Administrator edit access read back in both orgs. T4:
triggers Active in both. T5 on dev2: a real dashboard PATCH (`/api/decorations/{id}`, Front → Front+Back →
Front) added and removed the junction row; production-orders, calendar, inbox, orders, presses, shortfalls
all 200; rework-check all six queries OK. staging (rolled back): insert → 1 row, edit to three placements →
3 rows and method follows `Type__c`, delete → 0 rows, Vinyl → HTV. **T5 on staging (2026-09-17, after Anthony
switched the dashboard):** `/api/admin/sf-env` → `staging`; production-orders (19), calendar, inbox (104), orders
(5), presses (5), shortfalls (`available:true`) all 200; decorations and pre-production-items 200 for an order;
rework-check all six queries OK; index, calendar, pre-production and order-sheet render live ("LIVE ·
SALESFORCE", no demo chip) with mockups showing.

**Still open.**
- ~~`CatalogSyncPreProductionItem` trigger has 0% coverage~~ — **closed by S5**: `ArtSpecLinkTest` inserts
  items, so the trigger is 1/1 covered in dev2.
- `Decoration__c.Transfer_Type__c` exists in dev2 but is FLS-hidden (another hidden field; staging's is visible).
- `Decoration__c.Placement__c` (single) exists beside `Placements__c` (multi); CatalogSync uses the multi-select
  and falls back to the single only when the multi is blank.
- Freeze the picklists only after production has the objects (S8). Deactivate the legacy PPI transfer values then.

**The original plan, kept for reference.**

**From S3 (D23–D25), in scope for S4:** add `Art_Spec__c.Placement__c` (lookup → `Placement__c`) and split
sample AS-00001 into front and back; the `Decoration_Placement__c` junction decision below must also carry
the Art Spec per placement (S5 wires it); converge `Pre_Production_Item__c.Transfer_Type__c` onto the
Decoration list (D25 mapping, confirm first); no uniqueness rule on Art Spec (D24).

**Converge the code copies first (pure code, can start now).** Replace the private
`ALLOWED_PLACEMENTS` / `ALLOWED_METHOD_TYPES` in `decorations/[id].js` (and any other copy) with
imports from `_placements.js`. Keep `ca-api.js` `PLACEMENTS` as the one client copy.

**Salesforce.**
- `Decoration_Method__c` (seed: Screen Print, Embroidery, Heat Press, Promotional Items) and
  `Placement__c` (seed all 11 values; only 6 are in use across both orgs, but existing records carry
  the others' names).
- New **lookups beside the picklists** on `Decoration__c`, `Production_Run__c` and
  `Proposed_Run__c`. A record-triggered flow or Apex **fills each lookup from its picklist on save**, so
  nothing the app writes today has to change (dual-write in the org, not the app).
- Backfill the existing records once.
- 🪤 `Placements__c` is **multi-select** and `Print_Location__c` is single. A multi-select cannot
  become one lookup, so a Decoration with two placements needs a child junction
  (`Decoration_Placement__c`) or stays per-placement as D11 already treats runs. Decide this before
  building.
- Work Center cutover: fill `ProductionStation__c` from `Press__c` on save, the same way.
- 📌 **Blank station numbers must mean "unknown, keep today's behaviour"** (Anthony, 2026-09-16: the
  real capacity and setup/run minutes are not available yet). Anything that starts reading
  `Capacity_Per_Hour__c`, `Setup_Minutes_Default__c` or `Run_Minutes_Per_Unit__c` falls back, when the
  field is blank, to what runs today: `Order.Duration__c`, then `runDurationHours()`'s 2-hour default
  (`_priority.js`), and the Apex scheduler's fixed blocks. It never treats blank as 0. Verified
  2026-09-16: **nothing in `functions/`, the pages or the four rebuilt Apex classes reads any
  `Production_Station__c` field today**, so blank values change nothing until S4.
- 🪤 `Run_Minutes_Per_Unit__c` is `Number(18,0)`, so whole minutes only. A press doing a shirt in
  under a minute cannot be expressed. Change it to allow decimals (e.g. `Number(16,2)`) in both orgs
  before anything relies on it, or derive per-unit time from `Capacity_Per_Hour__c`.

**Dashboard.** Reads switch to the lookups through optional fields. **Writes keep sending picklist
values** until production has the objects. Only then do the picklists freeze.

**Test.** T1–T8. Specifically: create, edit and move a decoration with each method and each placement
in both orgs; confirm no `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST`; confirm lookups filled;
`calendar.html` press lanes unchanged.

#### S5 · Wiring: Decoration → Art Spec, Pre-Production Item → Art Spec (D18) — ✅ DONE IN BOTH SANDBOXES 2026-09-17

**Decided with Anthony (2026-09-17), D27:** the pages show the recipe facts **for that decoration's method**;
a location is linked automatically **only when exactly one spec fits**; the same rule keeps running for new
records (not just a one-time backfill).

**What exists now (dev2).**
- **No new fields.** The three lookups already existed: `Decoration_Placement__c.Art_Spec__c` (the real link,
  one per location, D23), `Decoration__c.Art_Spec__c` and `Pre_Production_Item__c.Art_Spec__c` (both from S3).
- **Apex (source in `New Apex Classes/`):** `ArtSpecLink` + `ArtSpecLinkTest` (**7/7 pass; class 112/115 = 97%**)
  and three triggers, all Active: `ArtSpecLinkPlacement` (`Decoration_Placement__c` after insert/update),
  `ArtSpecLinkArtSpec` (`Art_Spec__c` after insert/update), `ArtSpecLinkItem` (`Pre_Production_Item__c` before
  insert/update).
- **The one-clear-match rule.** A location row gets a spec when exactly one spec has the same Opportunity (spec →
  `Artwork_Version__c` → `Opportunity__c` = decoration → Order → `OpportunityId`), the same method
  (`Method__c` = `Decoration_Method__c`) and the same `Placement__c`. A spec with **no** placement counts only
  when the decoration has a single location (D23: front art is not back art). If someone set
  `Decoration__c.Art_Spec__c` by hand, that spec is the **only** candidate (same rules). A Pre-Production Item
  gets a spec only when **every** location on its decoration is linked, and all to the same spec. **Only blank
  links are ever filled** — a hand-set link is never changed or cleared. Errors are logged, never thrown.
- 🪤 **`Decoration__c.Art_Spec__c` is deliberately never written by the Apex.** Saving a decoration re-runs the
  auto-scheduler for its press (S4 finding). Location rows and items have no such trigger, so linking them moves
  no runs. The page falls back to the decoration-level link when no location on it has one.
- **Backfill (dev2):** 108 blank rows checked (dry run first, rolled back) → **3 linked** (PM-00130/Tag → AS-00002,
  PM-00083/Front → AS-00003, PM-00135/Front → AS-00004), **0 new item links** (the 12 hand-set in S3 were already
  there). PM-00129 (Front + Back, with the placement-less AS-00001 set on the decoration) **stays blank on
  purpose** — one recipe cannot be both sides; give AS-00001 a placement, or add the back recipe, and the
  trigger links it.
- **Validation rule to know about:** `Opportunity.BillToContactRequired` needs `BillToContact__c` on any
  non-converted Opportunity, so tests that insert one must create a Contact first.

**Dashboard (uncommitted on the Mac).**
- **New `functions/api/art-specs/index.js`** — `GET /api/art-specs?orderId=` → `{available, specs, byDecoration,
  byItem, itemsAvailable}`. A follow-up endpoint (build rule 3): no board's main SELECT names `Art_Spec__c`, and
  any failed query (production, FLS) answers **200 `available:false`**. `Production_Method__r` traversal kept (trap 12).
- **`ca-api.js`:** `getArtSpecs()` (a failed call also resolves to `available:false`), `artSpecLines(spec, method)`
  (the per-method field list: Screen Print → ink colors, color order, mesh, ink type, flash, dryer; Embroidery →
  thread colors, stitch count; Heat Press → transfer, temp, time, pressure; every method → size/location, print
  specs, notes; blanks dropped) and `artSpecsForDecoration()`.
- **`order-sheet.html`:** each decoration card prints "Print recipe · <location> · AS-…" lines; the Ink Colors row
  uses the specs' colours when any spec has them, else the items' Pantones as before. CRLF kept. Divs only.
- **`pre-production.html`:** drawer gains a **Print Recipe** section (hidden when empty) and a "Recipe AS-… ·
  Front" note on each linked item. Also fixed an S4 leftover: the three transfer-type pickers still offered
  the legacy four values, which the org now rewrites on save; they now offer the D25 list (an item still holding
  a legacy value keeps it in its own list), via one `transferOptions()` helper.

**Tested.** T1 smoke 7/7. T2/T3: no new fields; the lookups were read back in S3/S4. T4: three triggers Active in
dev2; `CatalogSyncTest` still 8/8. T7: the seven test scenarios (per-location specs; placement-less spec on one
vs two locations; wrong method / two candidates stay blank; spec created later links rows and items, and a new
item picks it up; hand-set links kept; decoration-level spec is the only candidate). Endpoint unit-tested with a
stubbed Salesforce (full shape, bad id → 400, missing object → `available:false`, missing item link → rest still
served). Both pages rendered headless against fixtures: the order sheet printed the three recipes and the size
grid still drew its 20 cells; with `available:false` and with a 500 the sheet printed exactly as before; the
drawer showed the recipe and the item note. **Not yet:** T5/T6 against a live org — needs the code pushed.

**Staging and live pages (2026-09-17, after Anthony deployed the change set and pushed).**
- Change set deployed; `ArtSpecLinkTest` **7/7** and `CatalogSyncTest` **8/8** pass in staging.
- **Backfill: nothing to link.** Staging has **0 Art Specs** (the S3 samples were only made in dev2), so all 74
  location rows stay blank until someone creates recipes; the triggers will link them as they are made.
- **Live T7 on staging with two throwaway recipes, then deleted:** a Screen Print/Back recipe on order 00009480
  linked PM-00009/Back and both its items within seconds; an Embroidery/Front recipe on 00009515 linked
  PM-00071/Front and both its items, touching nothing else on the same job (dry run first). On the live
  dashboard, the **Pre-Production drawer for "Walkthrough Embroidery" showed the Print Recipe** (thread colors,
  stitch count, size/location, notes) and "Recipe AS-00002 · Front" on its items. Deleting the recipes cleared
  every link (lookup delete = clear value); staging is back to 0 specs, 0 links.
- T5/T8 on staging: `/api/art-specs` 200 (400 on a bad id); production-orders, calendar, inbox, orders, presses,
  shortfalls, decorations, pre-production-items all 200; rework-check all OK.
- 🚩 **`order-sheet.html` did not deploy.** The live file is the pre-S5 version (no `getArtSpecs`), while
  `pre-production.html`, `ca-api.js` and `/api/art-specs` are live. The Mac copy is correct (30,292 bytes). It
  was most likely left out of the commit — re-commit and push it, then re-check the sheet.
- Staging's Art Spec auto-number started at AS-00000 (cosmetic).

**Closed out (2026-09-17, dashboard on dev2).** `order-sheet.html` re-pushed and live. dev2: `/api/art-specs` finds
recipes on orders 00013474, 00013513 and 00013518; the live order sheet for 00013513 prints both recipes
(AS-00001 from the decoration-level link, AS-00002 · Tag) and the size grid draws (14 cells). **T6:** System
Administrator's visibility of `Decoration_Placement__c.Art_Spec__c` switched off → `/api/art-specs` 200
`available:false`; production-orders, orders, decorations, pre-production-items, calendar, inbox all 200; the order
sheet printed without recipes and Ink Colors fell back to the items' Pantones; Pre-Production live, no demo chip.
Visibility restored (visible, not read-only) and recipes came back (2 specs, 7 item links).

**The original plan, kept for reference.**

**Salesforce.** `Decoration__c.Art_Spec__c` and `Pre_Production_Item__c.Art_Spec__c` (both Lookups).
Pre-Production Item **points at** the spec and does not copy its method, placement or colours.
Backfill where the match is unambiguous; leave the rest blank.

**Dashboard.** `pre-production.html` and `order-sheet.html` show the spec (ink colours, colour order,
dryer settings) via a follow-up query. ⛔ The field `Pre_Production_Item__c.Production_Method__c` and
its 48 `Production_Method__r` traversals stay exactly as they are (trap 12).

**Test.** T1–T8. The order sheet prints the spec, and the size grid still renders (the `<table>` rule).

#### S6 · Run Result (D17) — the counting screen is rebuilt — ✅ DONE 2026-09-17 (all scenarios walked)

**Decided with Anthony (2026-09-17), D28:** Salesforce keeps the old per-size boxes as auto-totals of the Run
Results (nothing downstream changes); a manager can reopen a submitted run to fix counts; migrated counts get
good = planned − problems (flagged as estimated); good is optional on a count.

**What exists now (dev2).**
- **`Run_Result__c`** (RR-{00000}; dev2 object `01Ica000000WtEH`): `Line_Item__c` (Master-Detail → Run Line Item,
  child relationship `Run_Results`), `Good_Qty__c`, `Misprint_Qty__c`, `Damaged_Qty__c`, `Incomplete_Qty__c`
  (Number 18,0), `Counted_At__c` (Date/Time, default `NOW()`), `Counted_By__c` (Text 80), `Note__c` (Text 255),
  `Good_Qty_Estimated__c` (Checkbox; set only by the migration). System Administrator has full access.
- **`Production_Run_Line_Item__c.Good_Qty__c`** (Number, written by Apex) and **`Production_Run__c.Total_Good_Qty__c`**
  (roll-up SUM of it). The four old `Total_*_Qty__c` roll-ups were **not touched** — they keep summing the line
  fields, which now hold the Run Result totals. (So the "can a roll-up summarise a roll-up" question never came up.)
- **Apex (source in `New Apex Classes/`):** `RunResultRollup` + `RunResultRollupTest` (**5/5 pass**) and
  `RunResultTrigger` (all seven events). After any Run Result change it sets the line item's Good / Misprint /
  Damaged / Incomplete to the SUM of its Run Results (blank when there are none). Before any change it **refuses**
  (on purpose, unlike the S4/S5 classes) a Run Result on a run whose `Result_Status__c` is Submitted, and
  negative numbers. `bypassLock` exists only for the migration.
- 🪤 **Every Run Result save updates the line item → the run roll-ups → the run's triggers**, including
  `ProductionRunTrigger` → the auto-scheduler for that press. The old counting POST did exactly the same, so
  nothing new — and the migration moved **0** runs. The skeleton flow is safe (Confirmed-only entry).
- **Migration (dev2, 2026-09-17):** one Run Result per line item that had any count (62) **or** sat on a
  Submitted run with a planned quantity (70 "clean" lines — a submitted run with blanks meant "all good"):
  **132 Run Results**. Good = planned − misprint − damaged − incomplete (floor 0), `Good_Qty_Estimated__c` ticked
  (1 line had no planned qty → good blank). `Counted_At__c` = the run's `Result_Recorded_At__c` (else the line's
  LastModifiedDate), `Counted_By__c` = `Result_Recorded_By__c`. Dry run first (rolled back): old values
  unchanged on every line, 0 runs rescheduled. After: line sums = Run Result sums exactly
  (good 5,606 · misprint 70 · damaged 23 · incomplete 590). Script: see "Migration script" below.
- **Change set "S6 Run Result 2026-09-17"** (dev2 → staging): the object, its 9 fields, the two good fields, the 3
  Apex parts, and System Administrator + the two integration profiles. **Not yet uploaded.**

**Dashboard (uncommitted on the Mac).**
- **`functions/api/run-results/index.js`:** GET one run now also returns `resultsAvailable`, `results[]` (every
  count, oldest first) and `lines[].goodQty` (summed from the results — `Good_Qty__c` is deliberately not in the
  main SELECT). The list adds `totalGood` via a separate fail-open query. POST gains `action`:
  `add` (sObject Collections insert, all-or-none, ownership-checked, stamps who/when), `remove`, `submit` (the old
  stamp + totals + reprint tail, moved into `submitRun()` unchanged, now also reporting `totals.good`) and
  `reopen` (manager: `runs.schedule`; answers `reprintExists` when a reprint was already built from the old
  counts). In an org without `Run_Result__c` every S6 read answers `resultsAvailable:false` and the legacy POST
  still works; in an org **with** it, the legacy POST refuses typed numbers (409 `counting_screen_updated`) so a
  stale tab cannot write around the Run Results.
- **`ca-api.js`:** `addRunCounts`, `removeRunCount`, `finalizeRunCounts`, `reopenRunCounts`.
- **`counting.html`:** in results mode the grid gains a **Good** column; the boxes are the *next* count and start
  empty; each size shows "So far: … (x% of plan)"; a **Progress** bar (good ÷ planned); **Add Count** logs the typed
  rows and clears them; a **Counts logged** list (newest first, time · who, remove button while open); Submit
  becomes "Submit — Counts Are Final" (typed numbers are added first). A submitted run shows a lock banner and
  **Reopen (manager)** (manager PIN). Without the layer the page is the old four-box form, unchanged (T6 path).

**Tested (before push).** T1 smoke 7/7. Apex 5/5 plus S4/S5 suites still 15/15. **Endpoint against a stateful
fake Salesforce that enforces the lock and the sums: 24/24** (add/sum, who/when, blanks skipped, negative/decimal/
foreign-line refused, 15-char ids, remove, legacy refused, submit totals + reprint call, add/remove after submit
409, reopen + reprint warning + manager cap, list `totalGood`, and the no-layer org: `resultsAvailable:false`,
add 409, legacy submit still writes). **Counting screen, headless, stateful mock:** add → so-far/progress/log,
second add, remove, type + Submit (add then final), locked view (no inputs, no remove), Reopen → editable; legacy
mode posts the old payload. No page errors.

**Deployed and checked (2026-09-17, after Anthony deployed the change set and pushed).**
- **staging:** change set deployed; `RunResultRollupTest` **5/5** (and S4/S5 suites still green).
- **staging migration: 2 Run Results** from 12 eligible lines (good 4,470 · misprint 30 · no damaged/incomplete),
  0 runs rescheduled, old line values unchanged. Dry run first, as in dev2.
- 🪤 **STAGING HAS TWO LINE ITEMS THAT CANNOT BE WRITTEN AT ALL.** `PRLI-0001` and `PRLI-0002` hang off legacy run
  **PR-0001, which has no `PrintMethod__c`** — and in staging that field is **required**, so ANY update to those
  line items fails with `REQUIRED_FIELD_MISSING: [PrintMethod__c]` as the parent is re-saved. This is not new (the
  old counting POST would fail the same way) and it is not caused by S6; the first migration attempt simply hit it
  first. The migration now selects only lines whose run HAS a decoration (`WHERE ProductionRun__r.PrintMethod__c
  != null`) and leaves those two alone. **They still carry `Misprint_Qty__c = 3000` on PRLI-0001**, which is why
  staging's line-item misprint total (3,030) is larger than its Run Result total (30). Give PR-0001 a decoration —
  or delete it — before that run can ever be counted.
- **Live on dev2 (T5 / T7 a):** the counting screen is in "add a count" mode. On throwaway run **PR-0091**: typed
  40 good + 2 misprint → Add Count → the size line read "So far: 40 good · 2 misprint", progress moved, the count
  appeared in the log with time and name; a second count summed to 80 good · 4 misprint (two partial counts on one
  line = scenario (a)); Remove took one back off the totals; Submit recorded "80 good · 4 misprinted" and ran the
  reprint check (answer: another run on the order still needs counting). Re-opening the run showed the **locked**
  view (no boxes, no remove, Reopen button); the org then **refused** an add and a remove with 409 `run_submitted`,
  and `action:"reopen"` put it back to Draft. **Every test count was then deleted; PR-0091 is Draft with no counts
  and blank totals again.**
- **T6 (dev2):** `Run_Result__c.Good_Qty__c` hidden from System Administrator → the screen fell back to the old
  four-box form, every board stayed 200, and `totalGood` came back null. FLS restored, results came back.
  🚩 **That test found a real defect, now fixed:** the "does this org have Run Results" probe was `SELECT Id`,
  which still succeeded while the *read* failed, so the page offered the old boxes and the legacy save refused
  them (409) — a dead end. The probe now selects the same fields the read does. **This fix is a one-line change in
  `functions/api/run-results/index.js` and needs another push.**
- **T8:** `rework-check` on 00013513 answers `already_reworked` (reprint 00013514) with all queries OK;
  production-orders, calendar, inbox, orders, presses, shortfalls, run-results and run-line-items all 200.

**Scenarios (c), (d) and (e) — walked in dev2 2026-09-17. Two pass. The third is fine on our side and
exposed a fault that predates S6.**

- **(c) The reprint built from misprint counts, end to end — ✅ PASS.** Order **00013518**, run **PR-0118**:
  reopened it, added 7 good / 2 misprint / 1 damaged through the new screen, submitted. Reprint **00013519**
  was created for **7 garments — S=4, L=3**, which is misprint + damaged exactly. `rework-check` agrees
  (`totalReworkQty` 7, every query OK).
- **(e) B9's damaged-lines email, per size — ✅ PASS.** `B9 Order Complete With Damage - Awaiting AM` v2
  (dev2 `301ca00000TvbBtAAJ`) reads `Misprint_Qty__c` and `Damaged_Qty__c` **straight off the line item** —
  the two boxes the Run Result totals now fill — filtering `Order_Id__c` = the order `AND (Misprint > 0 OR
  Damaged > 0)`, sorted by `Size_Sort__c`, then grouping consecutive rows by size. Replaying that query and
  that grouping on 00013518 gives **S — 3 misprint, 1 damaged; L — 3 misprint, 0 damaged; totals 6 and 1**,
  which is exactly what the Run Results underneath say, in size order, with the untouched sizes absent.
  Checked at query level; **no email was sent.**
- **(d) The skeleton flow's give-back on a make-up run — ✅ PASS as of 2026-09-17, after Anthony's flow fix.**
  Re-run after the fix: a run planned at 80 on method `a3Vca000000LJCXEA4` creates **XL:40 + 2XL:40,
  total 80** — exactly the outstanding quantity, exactly the two sizes left incomplete. Both orgs' flows
  read back correctly (trap 18). **What follows is the original finding, kept because the diagnosis is the
  reusable part.**
  The give-back arithmetic lives in `Production_Run_Generate_Line_Item_Skeleton` and is correct: for each
  existing row on the method it does `varAlreadyPlanned += Planned_Qty__c` then `-= Incomplete_Qty__c`, so
  what was planned but never finished comes back. `Incomplete_Qty__c` is one of the boxes S6 now keeps as a
  sum of Run Results, and it is landing correctly (method `a3Vca000000LJCXEA4`: 200 planned, 80 incomplete;
  `run-line-items` reports `methodCommitted 120`).
  **But the flow never executes that loop**, because `Get Rows Across This Method` lost both filter values in
  the 2026-09-15 repair — **trap 18**. Proved with two rolled-back anonymous-Apex runs on that method:
  a run planned at 80 got **5 blank rows**, and one planned at 500 got **S/M/L/XL/2XL 40 each, total 200** —
  the full order again, not the 80 that is actually outstanding.
  🚩 **This is not caused by S6 and S6 cannot fix it.** The loop body never runs, so it would read 0 whether
  the incomplete numbers came from Run Results or from the old four-box form. **Both orgs need the flow fix in
  trap 18 before a make-up run can be trusted** — and the earlier guess that PR-0119's blank rows were a
  dashboard write-ordering problem is **wrong and withdrawn**: clean Apex reproduces them exactly.

**Still to do on S6.**
- ✅ The probe fix is pushed (Anthony, 2026-09-17), and legacy **PR-0001 now has a decoration**, so staging's
  two stranded line items can be migrated whenever that is wanted.
- 🟡 **Frames are seeded with PLACEHOLDER data so the build can carry on** (2026-09-18, Anthony's call:
  fake numbers now, real count before production). **35 frames in each sandbox**, identical spread:
  110×4 · 125×2 · 156×10 · 180×4 · 196×3 · 230×10 · 305×2, all `In Rack`, `Label_Printed__c` false.
  Plus **4 placeholder ink batches** (PMS 186 C, PMS 286 C, Black, White) so the batch picker has
  something to show. dev2 is now 41 screens (35 seeded + its 6 originals), staging 35.
  **Every placeholder is marked and one query removes them:**
  - frames — `Screen__c` where `Location__c = 'SEED-PLACEHOLDER'`
  - ink — `Ink_Mix__c` where `Mixed_By__c = 'SEED-PLACEHOLDER'`
  Each row also says so in its own Notes field, so nobody meets one in the UI and mistakes it for real.
  ⛔ **See the production gate below — this data must not reach production.**
  📌 The seeded spread is also what the picker was designed against: 35 frames is enough that "offer
  every frame" is visibly the wrong answer, which is why the list narrows to the job's mesh.
- ✅ **`station.html` pickers are BUILT** (2026-09-18, uncommitted on the Mac; Anthony pushes).
  **New endpoint `functions/api/shop-floor/index.js`** — `GET ?station=screen|ink` returns the usable
  frames or batches plus a `byItem` map of what is already recorded; `POST { station, itemId, valueId }`
  writes the link, and `valueId: null` clears it.
  ⛔ **It is a FOLLOW-UP endpoint and must stay one.** `_station.js`'s `selectFields` still does not
  name `Pre_Production_Item__c.Screen__c` or `.Ink_Mix__c`, because an org that lacks them turns the
  whole station SELECT into a parse error and takes the ink and screen boards to **zero rows behind an
  HTTP 200** (trap 1). The endpoint answers `200 { available:false }` instead and the picker simply does
  not render. There is a comment saying so at the top of the file — do not "tidy" those two fields into
  the station config.
  - **`ca-api.js`:** `getShopFloor(station)` (fails soft to `available:false`, same shape as
    `getArtSpecs`) and `setShopFloorLink(station, itemId, valueId)`.
  - **`station.html`:** the ink and screen stations gained `kit` / `kitLabel` / `kitHint` / `kitNone` in
    `STATIONS`, a `sf` slice of state loaded next to inventory, `setKit()` (optimistic, rolled back on
    failure, gated by `canWriteNow` like every other write there), and a picker in the job modal.
  - 📌 **The options are narrowed to what fits the job** — a 156 mesh job offers 156 frames, a PMS 186
    job offers PMS 186 batches — because handing a worker all 35 frames and trusting them to read the
    mesh off a list is how the wrong screen gets pulled. If nothing matches, everything usable is
    offered with a warning rather than an empty list, since a blank picker reads as broken.
  - 📌 **Retired and Damaged frames are never offered**; they stay in the org for their history. An ink
    batch with `Amount_Remaining__c` at 0 is dropped, but a **blank** remaining is kept — blank means
    nobody has said, which is not the same as empty.
  - 📌 **An unlabelled frame is still pickable but flagged** ("no label yet"), because most frames are
    unlabelled until the production gate above is worked through.

**How S7's front end was tested (2026-09-18).**
- **Endpoint rig, 30/30** (`/tmp` fake-Salesforce rig, same approach as S6's): both stations' GET shape,
  the retired/empty exclusions actually reaching the SOQL, `byItem`, **an org with no object → 200
  `available:false`**, an org with the object but no lookup → same, POST writing the right field on the
  right object, clearing to null, Id and station validation rejecting before any write, the capability
  gate, `INVALID_FIELD` surfacing as a clean 409, and a real failure still reporting 500.
- **Headless page walk (Playwright, tablet viewport), both ways.** With the layer: the card opens, the
  picker renders, **the 230 mesh frame is correctly absent** from a 156 job, the unlabelled frame is
  flagged, tapping posts exactly
  `{station:"screen", itemId:"…", valueId:"…"}`, the chip flips to "Saved." and the current selection
  updates. With `available:false`: **the picker does not render at all** and the board is what it was
  before S7.
- `node tools/smoke.mjs` all 7 green; `check-dc-templates.mjs` green.
- 🪤 The walk needed `vendor/react-*.js`, which are **iCloud-evicted** and were not in the container's
  working copy (trap 14). Stage them before running a page walk; nothing is wrong with the repo.

**Still to do on S7.**
⛔ **PRODUCTION GATE — S7's frame data is fake and must not be promoted.** The 35 frames and 4 ink
batches in each sandbox are invented. Before S8 puts the shop floor into production:
1. **Anthony counts the real frames per mesh** (the picklist offers 110 · 125 · 156 · 180 · 196 · 230 ·
   305). This is a physical stock-take, not a Salesforce task, and nothing else in S7 depends on it.
2. **Delete the placeholders in dev2 and staging** with the two queries above, so no sandbox is ever
   used as the source of a real count.
3. **Create the real frames in production**, print labels from `Name`, and tick `Label_Printed__c` as
   each frame physically gets its label.
🚩 **S8 must not go ahead on placeholder frames.** A frame record is meant to stand for a real object in
a rack; a seeded one that survives into production is a frame the shop will look for and never find.

- ✅ **The trap 18 flow fix is done in both orgs** (dev2 v6, staging v4), read back from the metadata and
  re-proved behaviourally in dev2. Staging is verified at the metadata level only — it has little data to
  walk.
- 📌 **Checked and clear: no governor-limit problem in the make-up path.** Creating the run and confirming
  it are two separate HTTP calls, so they are two separate Salesforce transactions. Measured in dev2: the
  insert leg costs **33** SOQL queries, the confirm leg **36** when the flow writes blank rows and **66**
  when it writes rows with quantities — and 66 is a *fixed* cost of that branch, not per row (two populated
  rows and five populated rows both measured 66). A single anonymous-Apex block doing insert + confirm +
  one read hits 101 and fails, but **the app never does that** — that failure was the test's shape, not the
  product's.
- Production (S8): the change set, then this migration **after counting the runs the scheduler could touch** —
  and check first for runs without a decoration, as staging's PR-0001 shows.

**Migration script** (anonymous Apex; replace the last line with `System.assert(false, msg);` for a dry run):
```
RunResultRollup.bypassLock = true;
List<Production_Run_Line_Item__c> lines = [SELECT Id, Planned_Qty__c, Misprint_Qty__c, Damaged_Qty__c, Incomplete_Qty__c,
  LastModifiedDate, ProductionRun__r.Result_Status__c, ProductionRun__r.Result_Recorded_At__c,
  ProductionRun__r.Result_Recorded_By__c, (SELECT Id FROM Run_Results__r LIMIT 1) FROM Production_Run_Line_Item__c];
List<Run_Result__c> ins = new List<Run_Result__c>();
for (Production_Run_Line_Item__c l : lines) {
  if (!l.Run_Results__r.isEmpty()) continue;
  Boolean has = l.Misprint_Qty__c != null || l.Damaged_Qty__c != null || l.Incomplete_Qty__c != null;
  Boolean sub = l.ProductionRun__r.Result_Status__c == 'Submitted';
  if (!has && !(sub && l.Planned_Qty__c != null && l.Planned_Qty__c > 0)) continue;
  Decimal good = null;
  if (l.Planned_Qty__c != null) good = Math.max(0, l.Planned_Qty__c
    - (l.Misprint_Qty__c == null ? 0 : l.Misprint_Qty__c) - (l.Damaged_Qty__c == null ? 0 : l.Damaged_Qty__c)
    - (l.Incomplete_Qty__c == null ? 0 : l.Incomplete_Qty__c));
  ins.add(new Run_Result__c(Line_Item__c = l.Id, Good_Qty__c = good, Good_Qty_Estimated__c = good != null,
    Misprint_Qty__c = l.Misprint_Qty__c, Damaged_Qty__c = l.Damaged_Qty__c, Incomplete_Qty__c = l.Incomplete_Qty__c,
    Counted_At__c = l.ProductionRun__r.Result_Recorded_At__c != null ? l.ProductionRun__r.Result_Recorded_At__c : l.LastModifiedDate,
    Counted_By__c = l.ProductionRun__r.Result_Recorded_By__c,
    Note__c = 'Migrated from the old counting model (S6, 2026-09-17)'));
}
insert ins;
System.debug(LoggingLevel.ERROR, 'S6MIG inserted ' + ins.size());
```
⚠️ Add `WHERE ProductionRun__r.PrintMethod__c != null` to that `lines` query (staging's PR-0001, above). The dev2
and staging runs also snapshotted every run's schedule before/after and compared the old line values (both clean).

**The original plan, kept for reference.**

**Salesforce.**
- `Run_Result__c`, Master-Detail → `Production_Run_Line_Item__c`: `Good_Qty__c`, `Misprint_Qty__c`,
  `Damaged_Qty__c`, `Incomplete_Qty__c`, `Counted_At__c` (default NOW), `Counted_By__c` (optional
  text; *who* is not required, D17), `Note__c`.
- 🪤 **A Number field cannot be converted into a roll-up summary in place.** The line item's
  `Misprint_Qty__c` etc. stay Number fields. New roll-ups (e.g. `Results_Good_Qty__c`,
  `Results_Misprint_Qty__c`, …) are created beside them. **Verify in Setup that the run-level
  `Total_*_Qty__c` roll-ups can be re-pointed at the new fields before designing further.** Roll-up
  summary restrictions on summarising other roll-ups are the unknown here.
- **Everything that reads the old line-item quantities must move with it:**
  - the skeleton flow's give-back loop (`Incomplete_Qty__c`);
  - B9's `Get Damaged Line Items` and its email body;
  - `_rework.js` gate 4;
  - `rework-check.js`, `shortfalls/index.js`, `run-results/index.js`, `run-line-items/index.js`;
  - `counting.html`, `ca-api.js`.
- **Migration:** one Run Result per line item that holds any quantity, stamped from the run's
  `Result_Recorded_At__c` / `Result_Recorded_By__c`. Do this **before** any reader switches, or
  history is lost.
- 🪤 Staging carries `Actual_Good_Qty__c` and `Reprint_Qty_Needed__c` on the line item (§1). **Do not
  reuse them.** They predate this design and D17 creates its own.

**Dashboard.**
- `counting.html` becomes **"add a count"**: each entry appends a Run Result.
- The card shows progress (Σ good ÷ planned) and the list of counts with times.
- `Submit` keeps its meaning of **"counts are final"** (`Result_Status__c`), which is what reprint
  gate 2 still keys on.
- D5 still holds: sibling carry-over is display-only. Incomplete still means make-up run, not reprint.
- D10 (timer stop → counting) is unchanged.

**Test.** T1–T8, plus:
(a) two partial counts on one line → the rollups sum;
(b) submit with no counts → still allowed;
(c) a misprint count → the reprint builds at gate 4 and `rework-check` agrees;
(d) the skeleton flow on a make-up run subtracts the new incomplete total;
(e) the B9 email shows the right per-size numbers (debug resolved values);
(f) T6 on `Run_Result__c` → the counting screen degrades to the old four-box form.

#### S7 · Shop floor: Screen, Screen Prep, Ink Mix, Screen Reclaim — ✅ IN BOTH SANDBOXES 2026-09-18 (D29)

🚩 **The measurement that changed this stage's shape.** Read before touching it. The shop floor is
**already tracked**, on `Pre_Production_Item__c`, and has been all along:

| | dev2 | staging |
|---|---|---|
| PPI **Screen** jobs | **186** | **138** |
| PPI **Ink** jobs | **96** | **68** |
| `Screen__c` | exists, **6 rows** | **absent** |
| `Screen_Prep__c` / `Ink_Mix__c` / `Screen_Reclaim__c` | absent | absent |

`station.html` runs those jobs today through `_station.js`: screens go **Needs Emulsion → Ready for
Exposure → Needs Tape → Ready for Print**, ink goes **Needs Label → Needs Mixing → Mixed**, each with a
`statusMap` roll-up to `Status__c` and an order roll-up to `Order.Screens_Completed__c` /
`Order.Mix_Inks__c`. **D18 already decided Pre-Production Item stays.** And the 6 `Screen__c` rows use
*the same four status values as the screen pipeline* — so `Screen__c` was a hand-made second copy of
work the PPI rows already track.

Building the guide's objects as a second job-tracker would therefore have made a **third** home for
"make a screen". 📌 **D29 settles it: Screen is the physical frame, not the job.** Jobs stay on
Pre-Production Item; the new objects describe the *things* — frames and ink batches — and their history.

⚠️ **Anthony's frames are not labelled today.** So the org issues the number (`Screen__c.Name` already
auto-numbers `S-####`), Anthony prints labels from it, and `Label_Printed__c` tracks which frames
physically carry theirs. Every link from a job to a frame is **optional and blank by default**, so the
station board works unchanged from day one and gets better as frames get numbered. Nothing waits on the
labelling project.

**What was built in dev2 (2026-09-18), all read back by query:**

- **`Screen__c` — one row per physical frame.** Kept: `Mesh_Count__c` (a **picklist**, not a number),
  `Quantity__c`, `Screen_Notes__c`. Added `Art_Spec__c` (lookup — what is burned on it now; blank means
  clean), `Location__c`, `Label_Printed__c`, `Frame_Status__c` (restricted: In Rack · Coated · Exposed ·
  On Press · Needs Reclaim · Damaged · Retired, default In Rack) and three roll-ups: `Times_Prepped__c`,
  `Times_Reclaimed__c`, `Last_Reclaimed_On__c`.
  🪤 **`Status__c` is NOT reused.** It holds the old per-order job values and is frozen per build rule 1
  ("old ones are frozen and retired later, never repurposed"). The frame's life is `Frame_Status__c`.
- **`Screen_Prep__c`** (`SP-{00000}`) — one coat-and-burn event. **Master-Detail → `Screen__c`**
  (`Screen_Preps__r`), plus `Art_Spec__c`, `Prepped_On__c` (default `NOW()`), `Prepped_By__c` (Text 80,
  optional — same rule as D28's counted-by), `Emulsion__c`, `Exposure_Seconds__c`, `Notes__c`.
- **`Screen_Reclaim__c`** (`SR-{00000}`) — one strip event. **Master-Detail → `Screen__c`**
  (`Screen_Reclaims__r`), plus `Reclaimed_On__c`, `Reclaimed_By__c`, `Outcome__c` (restricted: Clean ·
  Ghosted · Damaged · Retired), `Notes__c`.
- **`Ink_Mix__c`** (`IM-{00000}`) — one batch of mixed ink. `Pantone__c` (matches
  `Pre_Production_Item__c.Pantone_Color__c`), `Amount_Mixed__c`, `Amount_Remaining__c`, `Mixed_On__c`,
  `Mixed_By__c`, `Art_Spec__c`, `Notes__c`.
- **Two optional lookups on `Pre_Production_Item__c`:** `Screen__c` (which frame this screen job used)
  and `Ink_Mix__c` (which batch this ink job drew from). ⛔ **Neither may enter a SELECT — including
  `_station.js`'s `selectFields` — until both orgs have them (trap 1, build rule 3).**

**Master-detail was chosen on purpose:** prep and reclaim are events *owned by* the frame, so the three
roll-ups come free and no Apex maintains them. There is no Apex in S7 at all.

🪤 **Two required fields blocked the frame idea and were loosened** (`updateMetadata`, whole field read
back and re-sent so nothing else changed): `Screen__c.Status__c` and `Screen__c.AssignedOrder__c` were
both **required**. A frame sitting in the rack has neither an order nor a job status. `Mesh_Count__c`
stays required, which is correct — every frame has a mesh. Loosening a constraint is not a rename and
destroys nothing; it is the one existing-field change in S7.

**Proved end to end in dev2, then removed** (2026-09-18): created frame `S-0006` with **no order**,
two preps and one reclaim under it → `Times_Prepped__c` 2, `Times_Reclaimed__c` 1,
`Last_Reclaimed_On__c` set; an `IM-00000` batch with `Amount_Remaining__c` 320 of 500; linked a real
Screen job and a real Ink job to them, read `Screen__r.Name` / `Screen__r.Mesh_Count__c` back through
the lookup, then unlinked both live rows and deleted every test record. dev2 is back to **6 screens**.

**The staging check (2026-09-18) — what was actually verified, not just "it deployed".**

1. **All 37 fields read back by query** in staging: the 12 on `Screen__c`, 7 on `Screen_Prep__c`, 5 on
   `Screen_Reclaim__c`, 7 on `Ink_Mix__c`, the 2 on `Pre_Production_Item__c`, and the child
   relationships `Screen_Preps__r` / `Screen_Reclaims__r` (which is what proves the master-detail landed).
2. **Field-by-field diff against dev2 — zero differences.** A describe fingerprint of all four objects
   (type · required · reference target and relationship · picklist values and default · calculated ·
   auto-number) was taken in both orgs and compared: **0 diffs, 0 missing, 0 extra.** That confirms in
   one shot that the loosened `Screen__c.Status__c` and `AssignedOrder__c` travelled as **optional**
   (the frame idea depends on it), that `Mesh_Count__c` is still the required picklist
   (110/125/156/180/196/230/305), that both `Screen__c` master-details are `/MD` not `/LK`, that the
   three roll-ups arrived `calc`, and that `Frame_Status__c` kept its seven values with **In Rack** as
   the default.
3. **Proved end to end in staging, then removed.** Frame `S-0000` created with **no order attached**
   (which is the whole point of D29), two preps and one reclaim under it → `Times_Prepped__c` 2,
   `Times_Reclaimed__c` 1, `Last_Reclaimed_On__c` set. `SP-00000` and `IM-00000` both took their
   `NOW()` defaults without being given one. A real Screen job and a real Ink job were linked, read back
   through `Screen__r.Name` / `Screen__r.Mesh_Count__c`, then unlinked. Everything deleted: all four
   objects back to **0 rows**, and **0 Pre-Production Items left holding a link**.
4. **FLS travelled — 30 of 31 fields on each of the three profiles.** 🪤 The one "missing" is
   `Screen__c.Mesh_Count__c`, and that is **correct, not a gap**: a universally required field has no
   `FieldPermissions` row because it is always visible. The read-back in step 1 included it and
   succeeded, which is the proof. 📌 Counting FLS rows is the cheap way to catch a change set that
   silently dropped profiles (§9) — but expect required fields to be absent from the count.

📌 **Nothing in the app reads any of this yet**, so there was no board to break: the two
`Pre_Production_Item__c` lookups are still out of every SELECT, `_station.js`'s `selectFields` included.

**Still to do on S7.**
- ✅ **DEPLOYED TO STAGING 2026-09-18** via change set **"S7 Shop Floor 2026-09-18 v2"**
  (`0A2ca000000JDJJ`), **37 components + 3 profiles**, each verified against a checklist across both
  pages of the component list before upload. **Read back and checked in staging — see below.**
  - 4 Custom Objects: `Screen__c`, `Screen_Prep__c`, `Screen_Reclaim__c`, `Ink_Mix__c`.
  - **Every field, listed one by one** — 7 on Screen Prep (including the master-detail `Screen`), 5 on
    Screen Reclaim (ditto), 7 on Ink Mix, **12 on Screen** (the 7 new ones *and* the 5 that already
    existed in dev2, because staging has no `Screen__c` at all), and the 2 on Pre-Production Item.
  - 3 profiles so FLS travels (§9): System Administrator, Salesforce API Only System Integrations,
    Minimum Access - API Only Integrations.
  - 🚩 **v1 (`0A2ca000000JDET`) FAILED VALIDATION and is the reason v2 exists.** See trap 19.
- Seed the frames: Anthony says how many frames of each mesh exist, they are created in a batch, labels
  are printed from `Name`, and `Label_Printed__c` is ticked as they go on.
- Re-point the 6 dev2 screens by hand onto `Frame_Status__c`, then deactivate `Status__c`'s job values.
- **Dashboard:** `station.html` gains a frame picker on a screen job and a batch picker on an ink job,
  through a new endpoint answering `available:false` where the objects are missing. Not started.
**T1–T8 run 2026-09-18, after the push. Seven pass; T5 is half done and needs Anthony.**

| | Result |
|---|---|
| **T1** repo well-formed | ✅ `smoke.mjs` 7/7, `check-dc-templates` green |
| **T2** body matches in both orgs | ✅ `FieldDefinition` for all four objects + the 2 PPI lookups, dev2 vs staging, **diffed in-page: 0 differences**. Roll-ups read back as `Roll-Up Summary (COUNT Screen Prep)` etc. and both `Screen__c` links as `Master-Detail(Screen)` in *both* orgs |
| **T3** FLS granted | ✅ **30 of 31 fields on each of the 3 profiles, in both orgs.** The absentee is `Screen__c.Mesh_Count__c` and that is correct — a universally required field has no `FieldPermissions` row |
| **T4** flows active and correct | ✅ N/A by design: **S7 ships no flow and no Apex.** Verified anyway — 0 Apex classes and 0 triggers on the four new objects; the only triggers on `Pre_Production_Item__c` are S4's `CatalogSyncPreProductionItem` and S5's `ArtSpecLinkItem`, both still Active; the skeleton flow is still **v6** (the trap-18 fix) |
| **T5** outfit fits every org | ✅ **Both orgs.** dev2: header **DEV2 · Live**, `/api/shop-floor` 200 `available:true`, 41 frames, 4 batches. staging (Anthony switched the org): header **STAGING · Live**, no demo banner, 35 frames, 4 batches, and **95 real screen jobs + 50 real ink jobs** — a far better test than dev2's empty board |
| **T6** outfit survives a missing body | ✅ **The one that matters.** `Screen__c.Frame_Status__c` FLS removed in dev2 → `/api/shop-floor` answered **200 `available:false`**, the picker vanished from the modal, and **the screen and ink boards kept returning their jobs** with the pipeline intact. Restored and re-verified at 41 options |
| **T7** scenario walk | ✅ Both stations on a throwaway, then deleted |
| **T8** nothing else moved | ✅ station-items (screen/ink/transfer), orders, production-orders, inbox, presses, shortfalls, calendar all 200; `pre-production-items`, `proposed-runs` and `run-line-items` answer 400 **only without their required parameter** and 200 with it; `run-line-items` still reports `methodCommitted 120`, S6's give-back value, unchanged; `rework-check` 200 |

**What T7 actually walked (dev2, live board).** All three station boards were empty — every Pre-Production
Item in dev2 is already at its done status — so a throwaway Screen job (156 mesh) and Ink job (PMS 186 C)
were created on `PM-00136`, walked, and deleted.
- **Narrowing works on real data:** the screen job offered **12 frames of 41**, every one 156 mesh, and
  **none of the other six mesh counts**. The ink job offered **1 batch of 4**, the matching pantone.
- Unlabelled frames rendered with their "no label yet" flag, as intended while the labelling is pending.
- Tapping `S-0002` wrote `Screen__c` onto the item, the chip read Saved, and Salesforce confirmed the
  link with the frame's mesh matching the job's. 📌 **`Screen_Sub_Status__c` and `Status__c` were
  untouched** — recording a frame does not disturb the pipeline, which is the whole reason it is a
  separate write.
- Tapping the same frame again cleared it, on screen and in the org. Same set-then-clear on the ink job.
- Afterwards: **0 jobs linked, 0 throwaways left**, 41 screens and 4 ink batches as before.

🪤 **T6 leaves a mess if you restore it the obvious way.** Setting `PermissionsRead` false does not
update a `FieldPermissions` row, it **deletes** it — so the Ids saved beforehand are invalid and the
restore fails with `invalid record id`. Rebuild by **inserting** fresh rows, copying `ParentId` /
`PermissionsRead` / `PermissionsEdit` from a sibling field granted in the same batch (`Location__c` was
used here). Restored to the same 4 rows.

🪤 `Pre_Production_Item__c.Notes__c` is a **Long Text Area**, so `WHERE Notes__c LIKE '%…%'` throws —
the same trap S6 hit on `Art_Spec__c.Notes__c`. Find throwaway rows by Id, not by their note.

📌 Known and already logged: dev2's **6 original screens have a blank `Frame_Status__c`** (they still
carry the old job values in `Status__c`), which is why 35 of 41 options report a frame status. That is
the "re-point the 6 dev2 screens" item above, not a T-failure.

**T5 on staging (2026-09-18) — walked on REAL jobs, and it found two things dev2 could not.**

The staging boards are busy, so the walk used live records and restored them rather than creating
throwaways. Both jobs were read back afterwards: `Status__c`, the sub-status and both lookups are
exactly as they were, and **0 Pre-Production Items are left holding a link** in either org.

- **Screen job (156 mesh):** the picker offered **10 frames of 35** — every 156, none of the other six
  mesh counts, no warning. Set `S-0007`, chip read Saved, cleared again; org confirms blank.
- **Ink job (`130C`):** 🚩 **the no-match branch fired, and it was right to.** Staging's real pantones
  are `5038C`, `130C`, `4567C`, `122C`, `574C`, `6542C` — the placeholder batches are `PMS 186 C`,
  `PMS 286 C`, `Black`, `White`, so **nothing matched**. All 4 batches were offered with the warning
  *"Nothing in stock matches this job, so everything usable is listed. Check before you pick."* Set and
  cleared cleanly. This is the fallback path dev2 never reached, exercised on real data.

📌 **A real finding for the frame/ink seeding, and it belongs with the production gate.** The shop
writes pantones as **`130C`** — no "PMS", no space. The placeholder batches used `PMS 186 C`, which is
why every real ink job fell through to "showing all". **When the real ink batches are created, their
`Pantone__c` must be written the way `Pre_Production_Item__c.Pantone_Color__c` already writes it**, or
the narrowing silently never matches and workers get the full list every time. Nothing is broken — the
fallback is doing its job — but the matching is only as good as the two fields agreeing.
📌 The same caution does **not** apply to frames: staging's screen jobs use only `156` (92), `125` (2)
and `196` (1), and every one of those meshes has frames, so mesh matching worked on every job.

- **Test.** T1–T8 on `station.html` at tablet width. ✅ **All eight pass, run 2026-09-18** — see the
  table above.

📌 **Technique, and it is a big one: the Metadata API works straight from the Developer Console tab** —
much faster than the Setup UI and it never touches the custom-field EDIT page that wedges the renderer
(trap 13). The whole S7 org build was ~6 calls. Take the `Authorization` header the console already
sends (hook `Ext.Ajax` `beforerequest`), strip `Bearer `, and POST a SOAP envelope to
`/services/Soap/m/67.0` with `createMetadata` / `readMetadata` / `updateMetadata`. To change an existing
field safely, `readMetadata` it, patch the one tag in the returned XML and send that whole body back —
never hand-write the field definition, because `updateMetadata` replaces it entirely.
🪤 **A field created this way is FLS-hidden from every profile**, which reads as
`No such column 'X' on entity 'Y'` — trap 1 wearing a "you typo'd the field name" mask. Grant FLS by
inserting `FieldPermissions` rows against each profile's own `PermissionSet`
(`IsOwnedByProfile = true`) via `/composite/sobjects`; roll-ups and formulas take `PermissionsRead`
only, and master-detail fields take none. S7 needed 78 rows across the three profiles in §4's build
rule 2.

#### S8 · Production (E7.4) — waits until S1–S7 are done (D22)

Production has **none** of the production objects (§9, 2026-09-14). Build it **once**, on the new
model, in the order S1 → S7, using the same change sets.

⛔ **S7 carries a data gate into this stage: the sandbox frames and ink batches are PLACEHOLDERS.**
Anthony must take a real per-mesh frame count before production gets any `Screen__c` rows, and the
seeded rows (`Location__c = 'SEED-PLACEHOLDER'`, `Mixed_By__c = 'SEED-PLACEHOLDER'`) must be deleted from
both sandboxes first. See the production gate in S7. Everything in §9's "what change sets do not
do" list applies, and **`Artwork_Approved__c`'s gate turns on in production only when its start date
is set there**.


### Wave 0c · `Production_Method__c` → `Decoration__c` — DONE IN BOTH SANDBOXES 2026-09-15

**This subsection absorbs the whole `Claude outputs/` folder. That folder can be deleted.** What was
in it — the rebuild brief and its assumptions, the four rebuilt classes, the restore snippets, the
stub runbook, the change list and the two evidence CSVs — is either reproduced below, or lives in
Salesforce/git and is named here with the place to find it. §12 has the file-by-file disposition.

**Why 0c was different from 0a and 0b.** Those renamed objects almost nothing referenced. This one
renamed **the most-used object in the system**, and Salesforce refuses to rename an object any Apex
references. The referencing classes had to be emptied first — which destroyed them (trap 15).

---

#### 🚩 The four classes were REBUILT, not restored. Read this before trusting scheduling behaviour.

Nobody has the original source. `OrderPrintDateRollup`, `ProductionAutoSchedulerSelector`,
`ProductionEventPublisher` and `ProductionAutoSchedulerService` were emptied to stubs on 2026-09-15
without being downloaded first, and then **reimplemented from live org data** by Claude Code.

They compile, they deploy, they pass their tests, and they are byte-identical across dev2 and staging.
**None of that makes them the original.** Everything below separates what came out of the org from
what was inferred.

##### ✅ MEASURED — read out of dev2, and the backbone of the rebuild

**The proposal slot shape.** All 11 surviving `Proposal` runs read `Scheduled_Start__c 13:00:00Z` /
`Scheduled_End__c 22:00:00Z` — **08:00→17:00 America/Chicago, a fixed 9-hour block** covering the whole
shop day, one run per press per day.

🚩 **But a CONFIRMED run does not carry that shape.** The 79 live run Events run 15 minutes to 3½
hours, all over the clock — `14:00→15:00Z` (8 of them), `15:15→16:15Z` (4), `13:00→13:30Z` (3). So the
9-hour block is **what the scheduler proposes**, and a confirmed run carries **a window a human
edited**. That distinction is load-bearing: anything that "normalises" run times to the 9-hour block
would overwrite every schedule the shop actually made.

**The 3-day lead time.** `CreatedDate` vs `Scheduled_Start__c`, 8 of 8 forward-scheduled runs:

```
created Tue 06-16  ->  Fri 06-19, Sat 06-20, Sun 06-21, Mon 06-22
created Wed 07-22  ->  Sat 07-25, Sun 07-26
created Wed 08-12  ->  Sat 08-15, Sun 08-16
```

First usable day is **today + 3**, then it packs forward one day at a time.
📌 **Note the Saturdays and Sundays — weekends are NOT skipped.** Calendar days, not business days.

**The sort.** `Order.Priority_Score__c` is a formula and **lower = more urgent** (class 1 → 100000,
class 3 → 300000, plus an in-hands term and order age). The run reads it through the formula field
`Order_Priority_Score__c`, so the comparator is a plain **ascending** sort, nulls last.

**The Event subject and owner.** Read off all 79 live run Events: **`press name · decoration type ·
order label`**, joined with `" · "` (U+00B7). 78 of 79 carry all three parts; one (`Shirt Press`) is
bare, which is the degenerate case `buildEventSubject()` has to tolerate. **All 79 are owned by
`005ca00000BhcA9AAJ`** — exactly `Production_Calendar_Setting__c.Calendar_Owner_Id__c` in dev2. That
same setting carries `Disable_Event_Publishing__c`, which is what `isEnabled()` reads.

🪤 **The order label is the anchor text of a `HYPERLINK()` formula.** `Order.GOA_Order_Number__c` comes
back as `<a href="/801ca00000TR5N9" target="_self">20488-1</a>`. `orderLabel()` strips it, mirroring
`plainText()` in `functions/api/_sf.js`. This is the B22 trap — 121 characters of markup around a
7-character number.

**The selector's two WHERE clauses** are verbatim from `SELECTOR-CHANGE.md`, including the
`= null OR NOT IN (...)` branch. Not guesses. ⛔ **That file is deleted from disk — recover it with
`git show HEAD:SELECTOR-CHANGE.md` before committing the deletions** (§0 open item 6).

##### 📌 Metadata corrections the rebuild forced — the old brief was substantially wrong

- **`Production_Run__c` has 31 fields, not 50.** Verified three ways (`sf sobject describe`, Apex
  `fields.getMap()` which ignores FLS, and a SOQL probe returning `No such column`).
- **20 named fields are gone** — deleted-not-yet-erased, so they still appear in `FieldDefinition` and
  are recoverable from Setup → Object Manager → Deleted Fields for ~15 days from 2026-09-15:
  `Status__c` · `Estimated_Run_Minutes__c` · `Setup_Minutes_c__c` · `Setup_Family_c__c` ·
  `Priority_Score_c__c` · `Queue_Position_c__c` · `Ready_for_Scheduling_c__c` · `Blocked_c__c` ·
  `Block_Reason__c` · `Rush_c__c` · `Order__c` · `Order_Name__c` · `ScheduledStartDateTime__c` ·
  `ScheduledEndDateTime__c` · `Actual_Run_Minutes__c` · `Spoilage_Quantity_c__c` ·
  `Completion_Notes_c__c` · `Mockup_URL__c` · `Status_Indicator__c` · `ProductionStation__c`
- 🪤 **The "both `X__c` and `X_c__c` spellings exist" trap does NOT apply here.** For every one of
  those fields only the **`_c__c`** spelling ever existed. There was nothing to choose between.
- **`Production_Run__c.Status__c` does not exist.** The lifecycle lives entirely on
  **`Auto_Scheduling_Status__c`**, which has **four active values: `Proposal`, `Confirmed`, `Planned`,
  `Unable to auto-schedule`.** (An earlier note claimed the field was restricted to Proposal /
  Unable to auto-schedule. That was incomplete — `Planned` is real and settable.)
- **Live distribution at rebuild time:** Confirmed **79**, Proposal **11**, blank **1**, Planned **0**.
  🚩 Zero runs had ever held `Planned`, so the new test below is the first thing in the org ever to
  exercise that status.

##### ⚠️ ASSUMED — every inference, and who has to confirm it

Each is marked `// ASSUMPTION:` in the deployed source.

| Where | Assumption | If it is wrong |
|---|---|---|
| `…Service` lead time | Counted from **`Date.today()`**, not the run's `CreatedDate` | At first scheduling the two are identical, so the data cannot distinguish them. A run re-slotted next month would otherwise still measure from its creation day. |
| `…Service` `computeEarliestStart(run)` | Ignores its `run` argument | Signature kept because it was read out of the org. Any per-run floor belongs exactly there. |
| `…Service` unschedulable runs | Existing `Scheduled_Start__c`/`End__c` are **left alone**; only the status changes | No run in dev2 carries `Unable to auto-schedule`, so there is no evidence either way. Chose the reading that cannot destroy a time somebody typed. One line to flip. |
| `…Service` `buildEventSubject()` | Rebuilds only *press · type* and **keeps the Event's existing Subject** when it has nothing better | Deliberate. This class does not query `GOA_Order_Number__c`, and re-deriving would **strip the order number off an existing calendar entry**. |
| `…Service` `MAX_SEARCH_DAYS = 365` | Original limit unknown | Far enough for any real job, short enough to stay inside CPU limits. |
| `…Service` `priorityScore()` | Null score sorts **last** | `Priority_Score_c__c` does not exist, so there is nothing else it could read. Null sorts last so an unknown does not jump ahead of a job the shop rated urgent. |
| `…Publisher` unconfirm | Un-confirming a run **deletes** its Event | The documented acceptance test is *"Hit Unconfirm. The event disappears"*, which only a delete satisfies. ✅ **Now asserted by a test — see below.** |
| `…Publisher` no window | A `Confirmed` run with **no** scheduled window retracts its Event instead of throwing | Salesforce rejects an Event with no start/end. E5.11 explicitly left this unverified. |
| `…Publisher` duplicates | If a run somehow has **more than one** Event, the first is kept and extras are left alone | This class has never created a duplicate, so a second Event came from somewhere else and is not ours to delete. |
| `…Rollup` `disabled` | A plain `private static Boolean = false` | Inferred from one log line in the E7.7 notes. Nothing in the org reads it, so flipping it is a code edit. |

📌 **Deliberately NOT done in the rollup**, per B23 and the E7.7 diagnosis: no read-back verification
and no monotonic guard. The class is correct and merely **inert**, because **B19** — Order-side
automation rewriting `Print_Date__c` while reporting success — is the real defect. It was not "fixed"
here.

📌 **`ProductionAutoSchedulerSelector` has no assumptions at all.** Both filtering clauses are verbatim
from `SELECTOR-CHANGE.md`; the rest is field lists.

#### ✅ `shippingBuffer()` — the rebuilt guess was replaced with the shop's real numbers

🚩 **This is the single most important correction in the wave.** The rebuild shipped an invented
table — Pickup 0 · Delivery 1 · Order Fulfillment / Split Ship 5 · Shipping 2 in-TN, 4 out-of-state,
3 blank — flagged in its own notes as *"the weakest thing here… no surviving evidence at all."*
**Every number was wrong.** Anthony supplied the real ones on 2026-09-15 and they were deployed to
both orgs:

| Delivery method | Buffer days | Note |
|---|---|---|
| `Pickup` | **0** | |
| `Delivery` | **0** | This is **local dropoff**, not carrier delivery |
| `Split Ship` | **3** | ⚠️ Anthony: *"keep the split, my boss will deal with that later"* |
| `Order Fulfillment` | **3** | ⚠️ **Placeholder — not yet in use.** Will be used eventually; still in testing |
| Shipping, in-state (`TN` / `TENNESSEE`) | **3** | `SHIP_DAYS_IN_STATE` — boss to confirm |
| Shipping, out-of-state | **3** | `SHIP_DAYS_OUT_OF_STATE` — boss to confirm |
| State blank / not set | **3** | `SHIP_DAYS_STATE_UNKNOWN` |

```apex
private static final Integer SHIP_DAYS_IN_STATE     = 3;   // boss to confirm
private static final Integer SHIP_DAYS_OUT_OF_STATE = 3;   // boss to confirm
private static final Integer SHIP_DAYS_STATE_UNKNOWN = 3;
```

📌 **All three shipping constants are 3 today, and they are kept as three separate constants on
purpose** — the in-state and out-of-state numbers are the two Anthony's boss still has to rule on, and
collapsing them now would lose the question. 📌 **No test depends on this table**; the 3-day lead time
alone is what makes `testNoSlotNarrowWindow` fail correctly.

---

#### ✅ The seven artifacts — deployed and verified byte-identical in dev2 AND staging

| # | Artifact | Type | Origin |
|---|---|---|---|
| 1 | `OrderPrintDateRollup` | class | rebuilt |
| 2 | `ProductionAutoSchedulerSelector` | class | rebuilt |
| 3 | `ProductionEventPublisher` | class | rebuilt |
| 4 | `ProductionAutoSchedulerService` | class | rebuilt (+ `scheduleFromMethods` folded in) |
| 5 | `ProductionMethodTriggerHelper` | class | **new** |
| 6 | `ProductionMethodTrigger` | trigger on `Decoration__c` | **new** |
| 7 | `ProductionAutoSchedulerServiceTest` | test class | restored + one new method |

**Salesforce is the system of record for all seven.** The rebuilt sources are not in git — read them
from Setup → Apex Classes, or take a Download before touching anything (trap 15).

🪤 **Artifacts 5 and 6 must be created in this order: helper first, then trigger.** The trigger will
not compile against a class that does not exist. Both are small enough to reproduce here, and these
are the only two artifacts of the seven with no other written record:

```apex
public without sharing class ProductionMethodTriggerHelper {
    public static void afterInsert(List<Decoration__c> newMethods) {
        ProductionAutoSchedulerService.scheduleFromMethods(newMethods);
    }
    public static void afterUpdate(List<Decoration__c> newMethods, Map<Id, Decoration__c> oldMap) {
        ProductionAutoSchedulerService.scheduleFromMethods(newMethods);
    }
}
```

```apex
trigger ProductionMethodTrigger on Decoration__c (after insert, after update) {
    if (Trigger.isAfter) {
        if (Trigger.isInsert) { ProductionMethodTriggerHelper.afterInsert(Trigger.new); }
        if (Trigger.isUpdate) { ProductionMethodTriggerHelper.afterUpdate(Trigger.new, Trigger.oldMap); }
    }
}
```

And the method folded into `ProductionAutoSchedulerService` alongside `scheduleFromRuns`:

```apex
public static void scheduleFromMethods(List<Decoration__c> methods) {
    if (isRunning || methods == null || methods.isEmpty()) { return; }
    Set<Id> orderIds = new Set<Id>();
    for (Decoration__c pm : methods) {
        if (pm.Order__c != null) { orderIds.add(pm.Order__c); }
    }
    if (!orderIds.isEmpty()) { scheduleFromOrders(orderIds); }
}
```

🪤 **`OrderPrintDateRollup.syncFromRuns` already contains its `Decoration__c` SOQL loop.** An earlier
runbook (`STEP8-RESTORE-ORDER.md` v1, step 6) said to paste that loop back in. **Doing so inserts a
SECOND copy of the same query into the same method.** It compiles. It runs the query twice on every
run save. That step was withdrawn in v2 and is recorded here so nobody reinstates it.

---

#### ✅ Tests — 4 of 5 became 5 of 6, and four rebuild assumptions became verified behaviour

**One test method was added: `testConfirmPublishesEventAndUnconfirmRetractsIt`.** It exists because
`ProductionEventPublisher` sat at **20.5%** coverage — nothing in the surviving suite ever reached
`Confirmed`, which is the only status that makes it publish.

It walks a run **`Planned` → `Confirmed` → (window moves) → `Planned`** and asserts, in order:

1. the scheduler does **not** touch a `Planned` run, and a human-set time survives the save
2. 🚩 **insert publishes NOTHING**, even for a run born with a window — *the `oldMap` trap, asserted
   rather than assumed* (trap 9)
3. confirming publishes **exactly one** Event, with the run's start/end, owned by the running user
   (the `Production_Calendar_Setting__c` fallback), subject carrying press name **and** decoration type
4. moving the window **updates** that same Event rather than duplicating it
5. un-confirming **deletes** the Event — *"Hit Unconfirm. The event disappears"*
6. the run keeps its times; only the calendar entry goes

**Result: `ProductionEventPublisher` 20.5% → 89.3%.** Four lines that were `// ASSUMPTION:` in the
rebuild are now asserted behaviour.

⚠️ **`ProductionEventPublisher` swallows its own exceptions.** If an assertion in that test fails on a
**count**, the real cause is in the debug log, not in the assertion message. Check the log before
concluding the test is wrong.

**The one remaining failure is the known pre-loss baseline.** `testHappyPath` fails at the Event
assertion — *"One Event should be created: Expected: 1, Actual: 0"* — and the three assertions before
it pass. **The test is wrong, and this is measured, not argued:** 79 Events sit on runs and every one
is on a `Confirmed` run; the 11 `Proposal` runs have **zero** Events between them. Two documents say
the same independently (`_run-schedule-status.js`: *"Proposal … NOT on the calendar"*, and
`SELECTOR-CHANGE.md`'s table).

⛔ **Do not "fix" it by making the assertion pass.** That means publishing the machine's unreviewed
guess to the shop's Salesforce calendar, which in production syncs to everyone's Google calendar. It
is a change to what the whole shop sees, so it is **Anthony's decision, not a tidy-up.** If he wants
it: one branch in `ProductionEventPublisher.isCalendarRelevant` (treat a null `old` as "was not
Confirmed") plus dropping the `Confirmed` gate.

📌 **`testMethodUpdateInvokesScheduler` now passes.** It previously failed with
`CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY` on `Decoration__c (Order__c)` — a test-fixture problem, not
FLS: it failed with the stubs too, live records updated fine, and it only affected `@testSetup`-created
records.

#### ✅ The BFF change — 21 object edits, and the two lines that had to survive them

**Applied and committed 2026-09-15.** The old name appeared **~245 times** in the repo. **Only 21 of
them were the OBJECT.** Every edit was asserted against its exact expected content at its exact line
before being written, and files were read and written with `newline=""` so line endings are untouched.

**15 inline references**

| File | Lines |
|---|---|
| `functions/api/_ppi-checklist.js` | 193 (`/sobjects/` URL) |
| `functions/api/_rework.js` | 286 (semi-join), 319 |
| `functions/api/rework-check.js` | 202, 271 (semi-join) |
| `functions/api/calendar/index.js` | 215 |
| `functions/api/inbox/index.js` | 167, 274 (anti-join) |
| `functions/api/run-results/index.js` | 259, 279, 372 |
| `functions/api/run-line-items/index.js` | 198 |
| `functions/api/shortfalls/index.js` | 105 |
| `functions/api/production-orders/index.js` | 127 |
| `functions/api/orders/index.js` | 108 |

**6 constant declarations** — `_pm-rollup.js:20`, `_print-date-rollup.js:39`, `_priority-rollup.js:31`,
`production-runs/index.js:195`, `production-methods/[id].js:84`, `production-methods/index.js:64`
(all `const PM_OBJECT = "Production_Method__c"` → `"Decoration__c"`).

##### ⛔ The two lines that are byte-identical and must NOT change

Both are the **field** `Production_Method__c` on `Pre_Production_Item__c`, which was never renamed:

```
functions/api/production-methods/index.js:91
  const ITEM_PM_FIELD     = "Production_Method__c";      // lookup -> Method

functions/api/pre-production-items/index.js:61
  "Production_Method__c",
```

🪤 **`production-methods/index.js` contains both cases 27 lines apart.** Line 64 changed; line 91 did
not. Both were asserted present before the run and asserted intact after it.

##### ⛔ 48 `Production_Method__r` traversals also stay

A relationship name derives from the **field**, not the object, so all 48 are still correct — across
`station.html`, `_priority-rollup.js` and others. Rewriting them to `Decoration__r` breaks every one,
and **at runtime against a live org rather than at build time**.

##### Verification after the run

| Check | Expected | Actual |
|---|---|---|
| `FROM Production_Method__c` / `sobjects/Production_Method__c` remaining | 0 | **0** |
| `PM_OBJECT = "Production_Method__c"` remaining | 0 | **0** |
| Guard lines intact | 2 | **2** |
| `Production_Method__r` traversals | 48 | **48** |
| New `Decoration__c` object references | 21 | **21** |

No whole-file diffs — changed-line count matched edit count, so no line-ending churn.

##### ⚠️ A second pass, 5 more edits — and these are the ones that are WRONG FOR STAGING

`Production_Run_Line_Items__c` → `Production_Run_Line_Item__c` at `run-results/index.js:43`,
`run-line-items/index.js:86`, `rework-check.js:295`, `rework-check.js:327`, `_rework.js:341`.
Three **prose** references deliberately remain, at `run-line-items/index.js:17`, `rework-check.js:28`
and `ca-api.js:1430`.

🔴 **staging's object is still `Run_Line_Items__c`, so these 5 lines break staging the moment the BFF
deploys.** See trap 10 and §0 open item 1. **Rename staging by hand first.**

---

#### ✅ The two flow faults — reported as two bugs, fixed as one cause

Both were found on 2026-09-15 after the rename, and both are in the change set
**`0c Flow Fixes 2026-09-15`** (built in dev2, ⛔ **not yet uploaded to staging**).

**Fault 1 — `MALFORMED_ID` on order creation**, in `Order and Order Items Subflow Design`. The
`PressChoices` **record choice set** had no `valueField`, so it handed the whole record where an Id was
expected. ⛔ **Three attempts to set Choice Value to `Id` in Flow Builder were silently discarded**
(trap 16), leaving junk versions **V47 (active, identical to V46)** and **V48 (draft)** to be deleted.
✅ **Anthony fixed it with a Get Records inside the loop instead** — a different mechanism, which is
the right response to an editor that will not commit.

📌 **Two earlier theories were wrong and are recorded so nobody re-runs them:** test-run saturation,
and an unguarded `try/catch` in `scheduleFromOrders`. The fault email disproved both.

**Fault 2 — no calendar Event AND no Run Line Items, from one stale reference.**
`Production_Run_Generate_Line_Item_Skeleton` still named the old run line item object, faulted, and
**rolled back the entire `Planned → Confirmed` PATCH**. No Confirmed status meant no Event (trap 9);
no completed flow meant no line items. One cause, two symptoms, two separate bug reports — the full
lesson is trap 17.

**Left behind by the faults:** Order **00013516**, and runs **PR-0115 / PR-0116 / PR-0117** stuck on
`Planned`. Clean these up once staging is verified (§0 open item 5).

---

#### 📎 EVIDENCE — the 11 Proposal runs, preserved here because restoring the scheduler destroys them

🚩 **These eleven rows were the only surviving output of the original scheduler.** Every measured fact
above — the 9-hour block, the 08:00 local start, the 3-day lead time, weekends-not-skipped — was read
off them. The moment the rebuilt scheduler fires on one of their presses it re-slots them from
`today + 3` and overwrites all three fields. There is no second copy anywhere. **This is that copy.**

```csv
Id,Name,Press__c,Press__r.Name,PrintMethod__c,Scheduled_Start__c,Scheduled_End__c,Auto_Scheduling_Status__c,Order_Priority_Score__c,Order_In_Hands_Date__c,CreatedDate
a3Xca000000GHEbEAO,PR-0023,001ca00000PzbqpAAB,Culture Apparel,a3Vca000000KhtdEAC,2026-06-19T13:00:00.000+0000,2026-06-19T22:00:00.000+0000,Proposal,91991,2026-06-26,2026-06-16T09:06:22.000+0000
a3Xca000000GHEcEAO,PR-0024,001ca00000PzbqpAAB,Culture Apparel,a3Vca000000KhteEAC,2026-06-20T13:00:00.000+0000,2026-06-20T22:00:00.000+0000,Proposal,91991,2026-06-26,2026-06-16T09:06:22.000+0000
a3Xca000000GHEdEAO,PR-0025,001ca00000PzbqpAAB,Culture Apparel,a3Vca000000KhtfEAC,2026-06-21T13:00:00.000+0000,2026-06-21T22:00:00.000+0000,Proposal,292391,2026-06-30,2026-06-16T09:06:53.000+0000
a3Xca000000GHEeEAO,PR-0026,001ca00000PzbqpAAB,Culture Apparel,a3Vca000000KhtgEAC,2026-06-22T13:00:00.000+0000,2026-06-22T22:00:00.000+0000,Proposal,292391,2026-06-30,2026-06-16T09:06:53.000+0000
a3Xca000000GnPlEAK,PR-0027,001ca00000Qm1SgAAJ,CA Press 1,a3Vca000000Kp6PEAS,2026-06-04T13:00:00.000+0000,2026-06-04T22:00:00.000+0000,Proposal,192406,2026-06-30,2026-07-21T14:40:02.000+0000
a3Xca000000GoqTEAS,PR-0029,001ca00000SAbqzAAD,Press 1,a3Vca000000KgZNEA0,2026-06-08T13:00:00.000+0000,2026-06-08T22:00:00.000+0000,Proposal,350095,,2026-07-22T18:02:20.000+0000
a3Xca000000GothEAC,PR-0030,001ca00000SAbvpAAD,Press 2,a3Vca000000L06fEAC,2026-07-25T13:00:00.000+0000,2026-07-25T22:00:00.000+0000,Proposal,195455,2026-07-31,2026-07-22T18:42:23.000+0000
a3Xca000000GoyXEAS,PR-0031,001ca00000SAc2HAAT,Embroidery Machine,a3Vca000000L0LBEA0,2026-07-25T13:00:00.000+0000,2026-07-25T22:00:00.000+0000,Proposal,195455,2026-07-31,2026-07-22T19:19:24.000+0000
a3Xca000000Gp09EAC,PR-0032,001ca00000SAc2HAAT,Embroidery Machine,a3Vca000000L0LBEA0,2026-07-26T13:00:00.000+0000,2026-07-26T22:00:00.000+0000,Proposal,195455,2026-07-31,2026-07-22T19:20:08.000+0000
a3Xca000000H7wLEAS,PR-0041,001ca00000SAbqzAAD,Press 1,a3Vca000000L6f7EAC,2026-08-15T13:00:00.000+0000,2026-08-15T22:00:00.000+0000,Proposal,298234,2026-08-28,2026-08-12T20:11:26.000+0000
a3Xca000000H7zZEAS,PR-0043,001ca00000SAbqzAAD,Press 1,a3Vca000000L6dWEAS,2026-08-16T13:00:00.000+0000,2026-08-16T22:00:00.000+0000,Proposal,298234,2026-08-28,2026-08-12T20:46:04.000+0000
```

📌 **PR-0027 and PR-0029 sit in the past, on press Accounts that no longer exist.** They were treated as
stale outliers and excluded from the lead-time measurement — which is why it reads "8 of 8", not
"11 of 11".

**The companion Events export** (79 rows, `Id, WhatId, Subject, StartDateTime, EndDateTime, OwnerId`)
is **not reproduced** — its load-bearing content is the subject format, the single owner id and the
window distribution, all recorded under MEASURED above. The rows themselves are still queryable in
dev2 while those Events exist:

```sql
SELECT Id, WhatId, Subject, StartDateTime, EndDateTime, OwnerId FROM Event WHERE WhatId != null
```

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

##### ✅ BOTH OPEN CHECKS ANSWERED AGAINST DEV2 — 2026-09-09

**1. The summed reprint: ✅ CONFIRMED, and the arithmetic is right.** Order **00013504**
(`801ca00000TebvdAAB`), Screen Print method PM-00117 with `Placements__c` = `Back;Front`, misprints
recorded on **both** passes. `GET /api/rework-check?orderNumber=00013504` returns
**`totalReworkQty: 12`**, and the per-line detail it prints adds up by hand: Front (PR-0093) 2+3+1,
Back (PR-0094) 2+1 damaged+2, Heat Press 1. 🔑 **The point of the test is the per-order-product
column:** order product `802ca000009zpurAAA` carries **2 on Front and 2 on Back and is counted as
4** — placements really are summed, not double-counted per method and not taken from one pass only.
✅ **And incomplete is correctly excluded** — PRLI-0086 carries `incomplete: 150` and contributes
`reworkQty: 0`, which is D1's "incomplete is not a loss" holding in live data.
⚠️ **One honest caveat:** `rework-check.js` imports only `_sf.js` and `_placements.js` — it does
**not** share `_rework.js`'s summing code, it re-implements it. So this measures the diagnostic's
arithmetic, and the diagnostic exists to mirror the builder. A reprint was **not** actually built
here, because the verdict was `runs_not_submitted -- PR-0096=Draft` (gate 2, working exactly as
designed and naming the run). **To close this completely, submit PR-0096 and confirm the built
reprint carries 12.**

**2. A run with a blank `Print_Location__c`: ✅ NOT the original defect — and the answer is neither
option this story predicted.** The question was whether blank runs share a bucket or match every
placement. **Measured: they do neither.** Three post-fix blank runs (PR-0102, PR-0103, PR-0104,
created 2026-09-04, each on a method that already had a placed run holding the full quantity) each
received a **full set of 5 rows, one per size** — so the original defect (no rows, nothing
countable, misprints unrecordable) does **not** return for blank runs.

⚠️ **But the rows carry `Planned_Qty__c` = NULL, not 0.** Read directly off PR-0102's five rows:
`Planned_Qty__c`, `Incomplete_Qty__c` and `Misprint_Qty__c` all blank, `Run_Print_Location__c` blank
as the formula should give, `Method__c` populated. That is the `Blank Each Quantity` → `Create Blank
Rows` fallback firing — 🚩 **which means this story's claim that the fallback "is dead code in the
only situation it was written for" is WRONG, or at least not true for the blank-placement path.** It
demonstrably produces rows there. 📌 It also means the Flow writes **null** where this story says
"rows at 0 are free… and they keep the Flow's own guard satisfied". Null satisfies the guard and
sums to nothing just as well, so nothing is broken — but the codebase's **"0, not null"** rule says
blank means *nobody touched this* and a number means *someone decided*, and these rows say nobody
decided. Which, for a run covering none of the remainder, is arguably the honest answer. **Decide
whether to leave it; do not "fix" it to 0 without deciding.**

📌 **Also measured in passing:** four methods created after the fix — PM `LLKnEAO`, `LLO1EAO`,
`LLhNEAW`, `LLmDEAW` — each show Front and Back runs **both** carrying the order's full quantity
(1000/1000, 100/100, 11/11, 100/100). **D11 is working in live data**, not just on the one order it
was tested on.

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


---

##### B9 · The reprint becomes opt-in — the account manager confirms it first

**Asked for by Anthony, 2026-09-04. This is a SPEC, not a queued story.** Written down now
because the shape is agreed and the open questions are worth arguing before anyone codes.

**What he wants.** When an order with misprints or damaged garments finishes, email the
account manager for that order's account. The email carries a link. The AM opens it and
says either *the customer wants the reprint* or *the customer is satisfied, no reprint*.
**The reprint order does not exist until they confirm.** Once confirmed, its methods land
in the Pre-Production Management tab to have runs scheduled, with all the method
information already carried over.

📌 **Half of this is already built, and it is the second half.** B6 shipped the landing:
`_rework.js` mirrors type, placements and vendor onto the reprint's methods, and
`fetchReprintsAwaitingRuns()` puts a Pre-Production reprint that has methods but no runs
into the Management inbox. So "falls back into pre-production management with all method
info already saved" is **the behaviour that exists today** — this story does not rebuild
it, it puts a gate in front of it.

**What changes is the trigger.** Right now the reprint is created automatically:
`rollupOrderSubstatus()` lands on `Completed`, and `createReworkIfNeeded()` runs
immediately from **two** call sites — `production-methods/[id].js:290` and
`run-results/index.js:525`. Both would have to stop creating and start *notifying*.

##### ⛔ Two prerequisites that do not exist. Check these before anything else.

1. 🚩 **THIS APP CANNOT SEND EMAIL, AT ALL.** Swept the whole `functions/` tree on
   2026-09-04: no mail library, no provider, no SMTP, nothing. Cloudflare Workers cannot
   open an SMTP connection either, so "just send an email" means **either** an outbound
   email API (a vendor, a secret, an egress allowance, a deliverability story, a bounce
   story) **or** letting Salesforce send it — an Email Alert from a record-triggered Flow,
   or Apex. 📌 **Salesforce sending it is almost certainly right**: the recipient lookup,
   the record and the template all already live there, and it keeps a whole new outbound
   dependency out of a system whose one deployment serves three orgs.
2. ✅ **THE ACCOUNT MANAGER IS ALREADY ON THE ORDER — CORRECTED 2026-09-04.** An earlier
   version of this entry said no Account Manager field existed. **That was wrong, and it
   was wrong because the search was too narrow** — it filtered Account's fields for the
   label "Manager" and stopped. Anthony pushed back, said to look at Account *and*
   Opportunity, and he was right. What is actually there, read from dev2's Object Manager:

   | Object | Field | Type | Notes |
   |---|---|---|---|
   | Order | `Opportunity_Owner_Email__c` | Formula (Text) | **`Opportunity.Owner.Email`** — the recipient. Live, always current, nothing to maintain. Created by Peter Larson 2025-05-09. |
   | Order | `Opportunity_Owner__c` | Lookup(User) | The AM as a user record. |
   | Order | `Opportunity_Owner_Name__c` | Formula (Text) | For the greeting. |
   | Order | `Opp_Owner_Email__c` | **Email** | ⚠️ See the trap below. |
   | Order | `OwnerId` | Lookup(User,Group) | "Order Owner" — NOT the AM. |
   | Account | `OwnerId` | Lookup(User) | "Account Owner". No custom AM field on Account; its full 45-field list was read, not just a label filter. |
   | Opportunity | `OwnerId`, `Opportunity_Owner_Email__c`, `Opportunity_Owner_Name__c` | | The source the Order's copies derive from. |

   📌 **No new field is needed for the recipient.** The Order already carries the AM's
   address as a live formula, so a Flow on Order can address the email with no lookup,
   no traversal and no backfill.

   🚩 **TRAP — TWO FIELDS ON ORDER SHARE THE LABEL "Opportunity Owner Email".**
   `Opportunity_Owner_Email__c` is the **formula** (`Opportunity.Owner.Email`, always
   current). `Opp_Owner_Email__c` is a **writable Email field** — a snapshot, which means
   it can be stale or blank and nothing recomputes it. **Use the formula.** This is the
   same duplicate-label shape as `Receiving_Status__c` / `ReceivingStatus__c` documented
   above, and it is the second one found in this org in a single day: **when a field's
   label is ambiguous here, check the API name before you bind anything to it.**

   ⛔ **Still to confirm with Anthony:** that Opportunity Owner is who he means by "the
   account manager" in every case, and that it is populated on real orders. The formula
   returns blank if the Order has no Opportunity — and `OpportunityId` is in
   `CLONED_ORDER_FIELDS`, so a reprint inherits it, but an order created outside the
   "Close and Create Order" path may not have one at all. **A blank recipient must fail
   loudly, not silently skip the email.**

##### 🔒 The link in the email is the hard part, and it collides with E6.4

**A link that mutates data, sent to somebody's inbox, is a capability URL.** Two problems
meet here and neither is optional:

- **Cloudflare Access fronts the entire deployment, `/api/*` included** (E6.4). Its Allow
  policy is a manager email list; its Bypass is the shop's public IP. An AM clicking from
  a phone at home is **neither** — they will hit a login screen, or, if someone "fixes"
  that by widening the policy, the perimeter this project just finished proving gets a
  hole in it for the sake of one link. **Do not widen Access to make the link work.**
- **The token has to be its own authorisation.** Single-purpose, bound to one order, one
  decision, expiring, single-use, and useless for anything else. It must not reuse
  `ca_sess`, must not grant any capability from `_session.js`, and a leaked or forwarded
  link must at worst let someone answer one reprint question — never reach a board.

📌 **The obvious alternative deserves a real hearing: put the decision in Salesforce, not
in this app.** The AM is a Salesforce user, the email would come from Salesforce, and a
link to a record with two buttons needs no token, no new endpoint and no Access exception
at all. That trades a nicer UI for a dramatically smaller attack surface, and it is the
option this document would pick unless Anthony wants the AM never to touch Salesforce.

##### ⚠️ What this breaks if it is built carelessly

- **Gate 1 changes meaning.** `createReworkIfNeeded`'s first gate is *no existing reprint
  for this order*, which is what makes it safe to call repeatedly. Once a reprint can be
  *pending*, "already exists" and "already decided" stop being the same question, and a
  half-answered order must not be able to produce a second reprint.
- **THERE ARE NOW THREE OUTCOMES, NOT TWO.** S6's false-pass note already says *"no
  reprint needed" and "the reprint failed" must never look the same*. Add a third:
  **"the AM said the customer does not want one."** A declined reprint is a real business
  outcome and must be recorded as such — with who declined it and when — not left as an
  absence that is indistinguishable from a failure or from silence.
- **Nothing must rot silently.** If the AM never answers, misprints sit forever with no
  owner and no reprint. **This is exactly B5's argument about incomplete garments**: the
  one thing coming out of counting that has no owner until a human acts is the thing that
  gets lost. A pending decision needs to be *visible* somewhere — a queue, a badge, an
  ageing indicator — or this new gate becomes a new silent failure mode.
- **`rework-check` must learn the new states.** `GET /api/rework-check?orderNumber=…` is
  the read-only trace of the gates and is the first thing anyone runs when a reprint does
  not appear. If it cannot say "waiting on the AM since Tuesday" or "declined by X on
  Friday", every one of those becomes an afternoon of guessing.

##### 📍 WHERE THIS STANDS — 2026-09-08

✅ **CODE HALF BUILT 2026-09-08**, branch `feat/b9-optin-reprint`, unpushed. `_rework.js`,
`inbox/index.js`, `rework-check.js`.

**The gate is inside `createReworkIfNeeded`, not at the call sites.** There are two callers —
`production-methods/[id].js:290` and `run-results/index.js:525` — because printing finishing and
counting finishing are different moments and either can be last. A gate at one would simply let the
reprint fire from the other, so **neither file changed**. A third caller added later inherits it.

**Placed after the damage gate, not before it.** Only then is a reprint warranted at all, so a
clean order never claims the AM. Verified: a completed order with zero damage returns
`nothing_to_rework` and writes nothing.

**Org detection is field presence, not config.** `Misprint_Outcome_By__c` exists only where B9 was
built, probed through `runQueryOptionalField`. An env flag cannot distinguish orgs (one deployment,
KV-switched), and a per-org allow-list is something somebody forgets the day B9 reaches production —
failing *silently* toward never building a reprint again. **Any probe failure falls back to the
legacy path**, deliberately: that re-creates today's behaviour, which is loud. Deferring on failure
would mean no reprint ever and nobody finds out until a customer asks.

**Gate 1 split in two.** "A reprint child already exists" still guards duplicates. A second,
independent gate answers "has this been decided" — needed because a *declined* order has no child,
so gate 1 alone would happily build one on the next call.

**How the approval gets back here: a bounded sweep on `/api/inbox`.** There is no inbound-auth
pattern in `functions/`, no webhook, no cron, and Access fronts `/api/*` — a Flow callout would need
a hole in the perimeter E6.4 just proved, for one link. So nothing is pushed. The sweep runs after
the response via `waitUntil`, takes the 3 oldest approved-but-unbuilt orders per load, and builds
them where the manager already goes to schedule their runs (B6 put reprints in that list). An
approved reprint appears on the next poll, seconds later.

⚠️ **BEFORE ACTIVATING THE FLOW — its entry criteria is wrong for this design.** It currently fires
on `Order_Substatus__c = 'Completed' AND Misprint_Outcome__c is null`, which has **no damage
condition**, so as built it emails the AM about every completed order including perfectly clean
ones. The app now sets `Awaiting AM` itself — it is the only thing that knows every gate passed and
damage > 0 — so **re-point the Flow to trigger on `Misprint_Outcome__c` becoming `Awaiting AM`** and
let it do nothing but send the email.

📌 **All three declined values are treated as declines** — `Credit`, `Refund` and `Credit/Refund`.
The 2023 combined value was superseded and never deactivated. If that distinction ever has to
matter here it is a picklist cleanup first, not a branch in `_rework.js`.

**`rework-check` reports five outcomes**, in the same order the code checks them: *not built here*
(no B9 in this org) · *decision not yet requested* (blank) · *awaiting_am since <date>* ·
*approved, not yet built* · *declined_by_am by <name> on <date>* · plus *unknown_outcome* if a
picklist value is added without teaching `_rework.js`.

⚠️ **Verified against fake-Salesforce harnesses driving the real functions, NOT against dev2.**
Every decision path and every verdict was exercised, including probe failure and the clean-order
case. The dev2 pass is still owed — `GET /api/rework-check?orderNumber=…` on a real damaged order is
the tool for it.


**Anthony's answers (2026-09-04/08):** Salesforce sends the email · the decision is made on
a Salesforce record, not behind a token in this app · the recipient is the Opportunity
Owner, already on the Order as `Opportunity_Owner_Email__c` · **the field stays BLANK as the
resting state** (no `Not Needed` value) · **the email stays OFF until the code half ships**.

✅ **FOUR FIELDS BUILT IN BOTH ORGS 2026-09-08**, by hand in each rather than by change set
(so there was no deploy-inactive step to miss). Verified by reading each field's detail page
back, not from the save dialogs.

| Field | Type | dev2 | staging |
|---|---|---|---|
| ~~`Reprint_Decision__c`~~ | Picklist, restricted | ⛔ **DELETED 2026-09-08** | ⛔ **DELETED 2026-09-08** |
| `Misprint_Outcome_By__c` | Lookup(User) | ✅ | ✅ |
| `Misprint_Outcome_At__c` | Date/Time | ✅ | ✅ |
| `Misprint_Outcome_Notes__c` | Text Area(255) | ✅ | ✅ |

⚠️ **The three audit fields were created as `Reprint_Decision_By/At/Notes__c` and renamed
to `Misprint_Outcome_By/At/Notes__c` on 2026-09-08.** Anything written before that date —
older notes, screenshots, exported metadata — uses the old names.

`Reprint_Decision__c` **lived for five hours**. It was collapsed into `Misprint_Outcome__c`
the same day on Anthony's call — see the section below. The three By/At/Notes fields SURVIVE
as `Misprint_Outcome__c`'s audit trail, and were renamed to match it on 2026-09-08.

FLS on the surviving three: Visible to all 27 profiles in both orgs, none read-only —
deliberate, because trap 1 means a field the integration user cannot read fails the WHOLE
SELECT and empties the board. Tighten later if it matters, but never by guessing which
profile the integration user has.

📌 **Staging was a clean slate here** (0 pre-existing `Reprint*` fields) — the opposite of
`Receiving_Status__c`, where staging held a value deactivated in May that needed
reactivating AND re-assigning to record types. **Two org changes in two days, two different
starting states. Do not generalise; check.**

---

##### 🚩 STOP — `Misprint_Outcome__c` ALREADY MODELS THIS DECISION, and predates it by 2.5 years

Found 2026-09-08, on Order, created by Brad Oliver **2023-02-04**. Restricted picklist,
four active values: **`Credit/Refund` · `Reprint` · `Refund` · `Credit`**. Its help text:

> *"Select whether the customer will accept a refund/credit or needs the garments reprinted.
> Notification will go to Print Shop of the outcome."*

**That is this story's process, already modelled — including the notification.** And it is
RICHER than `Reprint_Decision__c`: the customer's answer is not reprint-or-nothing, they may
take a credit or a refund. Approved/Declined collapses three real business outcomes into one.

⚠️ **The two fields are arguably different things** — `Misprint_Outcome__c` is *what the
customer chose*, `Reprint_Decision__c` was *whether the AM has answered yet*. But that is two
overlapping fields covering one conversation, which is precisely the drift this project keeps
paying for.

✅ **DECIDED AND DONE 2026-09-08 — Anthony: "Yes collapse onto Misprint Outcome."**

| Step | dev2 | staging |
|---|---|---|
| `Awaiting AM` added to `Misprint_Outcome__c`, assigned to all 6 record types | ✅ | ✅ |
| `Reprint_Decision__c` deleted (now `Reprint_Decision_del__c`, Undelete only) | ✅ | ✅ |

`Misprint_Outcome__c` now reads, in both orgs:
**`Credit/Refund` · `Reprint` · `Refund` · `Credit` · `Awaiting AM`**

📌 dev2 and staging **share the field id `00N5e00000cnxhi`** for `Misprint_Outcome__c` — the
two `Reprint_Decision__c` fields did not (dev2 `00Nca00000B3j6F`, staging `00Nca00000B3ZTa`).
Never assume ids match across orgs; never assume they differ either.

📌 **Still open:** `Credit/Refund` (2023) was superseded by separate `Refund` and `Credit`
(2024) but never deactivated, so three of the five values overlap. ✅ The audit-trio rename
is **done** — see the field table above.

---

##### 🪤 TRAP — a custom field cannot be deleted while any Lightning page references it, and the UI hides this three ways

Deleting `Reprint_Decision__c` took **six attempts** because every failure looked like a
different problem. What actually happens:

1. **The field detail page has no Delete button at all** — only `Edit`, `Set Field-Level
   Security`, `View Field Accessibility`, `Where is this used?`. True in Lightning Object
   Manager AND in the Classic detail page. Delete lives **only** on the row in the field
   list (`/p/setup/layout/LayoutFieldList?type=Order&setupid=OrderFields`).
2. **That row's `Del` link fires a JS `confirm()`**, which the browser-automation extension
   auto-dismisses, so the click silently does nothing. **Cmd/Ctrl-click the `Del` link** to
   open its href in a new tab — that bypasses the onclick and lands on the real
   `CustomFieldConfirmDeletePage`. (`/setup/ui/deletefield.jsp` does **not** exist; don't
   guess URLs.)
3. **On that confirm page the "Yes, I want to delete" checkbox must be verified checked
   before clicking Delete.** The first click on a background tab only focuses it. Pressing
   Delete unchecked re-renders the same page with no message — indistinguishable from a
   failed delete.
4. Only once it actually submits do you get the real answer, on `deleteredirect.jsp`:
   **"Unable to Complete the Requested Change — The <field> custom field is used in a
   component on the <page> Lightning page."** Remove the field from every page listed
   (Lightning App Builder → select the field in the Field Section → trash icon → Save),
   then delete succeeds.

🚩 **The blocking pages were DIFFERENT in each org** — and neither list matched the other:

| Org | Lightning pages that had to be edited first |
|---|---|
| dev2 | `Shipping Receiving`, `PrintShopOrderMobile` |
| staging | `Ecommerce`, `Order Record Page` (`Order_Record_Page1`), `Production Order Page` |

That is org drift in the **page layer**, invisible from the field list, and it means "I
removed it from the pages" is never transferable between orgs. **Read the error, don't
assume the same pages.** Where `Misprint Outcome` was not already on a page it was dropped
into the slot `Reprint Decision` vacated, so the surviving By/At/Notes fields still sit next
to the field they now audit.

📌 Deleted custom fields are recoverable for **15 days** (Undelete on the detail page), after
which they are erased permanently.

---

##### ⛔ THE FLOW IS BLOCKED — two separate problems

**1. There is no Order-level damage rollup. At all.** Order's fields filtered for "Damage"
return **0 items**. Misprint has six; damage has none. The truth lives where `_rework.js`
reads it — `Production_Run_Line_Items__c.Misprint_Qty__c` / `Damaged_Qty__c`.

⚠️ **`Misprint__c` is NOT "this order had misprints."** `_rework.js` sets it TRUE on the
**reprint child order** — it means *this order IS a reprint*. It reads like the trigger
condition and is close to its opposite. Do not use it.

**2. A Flow cannot reach those line items, and the fix is itself blocked.** The line item's
only link toward the Order is `Order_Product__c` (Lookup), and Flow's Get Records cannot
filter on `Order_Product__r.OrderId`. This is the wall B4 hit; its answer was a formula field
(`Run_Print_Location__c`, and `Method__c` before it). The equivalent here is:

```
Order_Id__c  =  CASESAFEID(Order_Product__r.OrderId)
```

🚩 **IT COULD NOT BE CREATED — `Production_Run_Line_Items__c` REFUSES FIELD CREATION WITH
"Insufficient Privileges", THROUGH THE OBJECT MANAGER UI AS WELL AS THE DIRECT URL.**

📌 **This contradicts the workaround recorded under B4**, which says the direct URL was the
problem and the UI "worked first time". It does not now. **Controlled 2026-09-08:** in the
same session, the same minute, `Order`'s New Field wizard loads normally while this object's
returns Insufficient Privileges. So it is **object-specific — not the session, not the URL.**
The object itself looks ordinary: Custom, Deployment Status Deployed, no managed package, no
namespace, 15 fields. **Either something changed since B4 on 2026-09-03, or B4's field was
created by a route not yet identified. Needs Anthony.**

##### ✅ `Order_Id__c` EXISTS — created by Anthony 2026-09-08, verified in both orgs

| | dev2 | staging |
|---|---|---|
| Field id | `00Nca00000B3hKp` | `00Nca00000B3vSJ` |
| Object id | `01Ica000000So1w` | `01Ica000000Otsz` |
| Object **label** | Production Run Line Item | Production Run Line Item**s** |

Both: `Order_Id__c`, Formula (Text), `CASESAFEID(Order_Product__r.OrderId)`. Read back off
each field's detail page, not from a save dialog. Flow's Get Records can now filter line
items by Order. **The "Insufficient Privileges" wall recorded above was never diagnosed** —
Anthony created the field through a route that worked for him. If it recurs, that is still
an open question.

---

##### 🚩🚩 STOP — `Misprint_Outcome__c` IS NOT AN INERT FIELD. WRITING TO IT FIRES LIVE AUTOMATION.

Found 2026-09-08, **before** building the B9 flow, by clicking *Where is this used?* on the
field. This is the single most important fact about B9 and it invalidates the plan as
written.

**`Printshop Misprint Process` is an ACTIVE record-triggered flow on Order** (a record is
updated, 5 entry conditions, 2 scheduled paths). It runs in **two** places at once — as
after-save *Actions and Related Records* **and** as *Run Asynchronously*. Both of its
relevant decision outcomes have **exactly one condition**:

```
{!$Record.Misprint_Outcome__c}   Is Null   =   False
```

…with **"If the condition requirements are met"** selected — *not* "only if the record is
updated to meet the requirements". So it fires on **any** non-blank value, on **every**
qualifying update, not just on the transition.

**What fires the moment `Misprint_Outcome__c` becomes non-blank:**

| Branch | Element | Effect |
|---|---|---|
| Run Immediately → `MisprintOutcomeAdded` | `MisprintOrderNotifyPrintShop` (Action) | notifies the **Print Shop** that the customer has decided |
| Run Immediately → `MisprintOutcomeAdded` | `UpdateOrderStatus` (Update Records) | **changes the Order's status** |
| Run Asynchronously → `Copy 2 of MisprintOutcomeAdded` | `Slack: Post Message Action 1` (Apex Action) | posts to **Slack** |

⛔ **Therefore: a B9 flow that sets `Misprint_Outcome__c = 'Awaiting AM'` would tell the print
shop and Slack that the customer has answered, and move the order's status — at the exact
moment the truth is "nobody has answered yet."** It is the sequencing hazard again, in a new
place, and this one reaches real people through Slack and email rather than just a board.

📌 The 2023 help text — *"Notification will go to Print Shop of the outcome"* — was the
warning. It was read as documentation of intent; it is documentation of **live behaviour**.
**Read a field's help text as a claim about running automation, and verify it with "Where is
this used?" before writing to any field you did not create.**

🚩 **Version drift on the one flow that governs this process:**

| | dev2 | staging |
|---|---|---|
| `Printshop Misprint Process` | **V28**, Active (last saved 2025-10-22) | **V14**, Active |
| Flows on Order update, total | 19 | 20 |

Fourteen versions apart, in the flow B9 has to work alongside. Anything done to it must be
done **by hand in each org** — change sets deploy flows inactive (§9) — and production is a
third unknown, picked up at **E7.4**.

##### ⛔ THE DECISION THIS NEEDS — Anthony's call

**Option A — guard the existing flow.** ✅ **CHOSEN BY ANTHONY AND DONE 2026-09-08.**

**Option B — never let automation write `Awaiting AM`.** Leave `Misprint_Outcome__c` meaning
only "what the customer chose", drive the waiting state off something the existing flow does
not watch, and **remove `Awaiting AM` from the picklist again**. Cost: reintroduces a second
field for one conversation — the drift the collapse just removed — but touches no live flow.

**Option C — treat blank as "awaiting".** No new value at all; the gate is "order complete +
damage > 0 + outcome still blank". Cheapest and touches nothing, but there is then no record
that the AM was ever asked, and no way to distinguish "asked, no reply" from "never asked".

❌ ~~**The B9 flow itself is still NOT created.** Only the guard below exists.~~ **STALE — CORRECTED 2026-09-11. The flow WAS created, later the same day (9/08, 2:49 PM).** `B9 Order Complete With Damage - Awaiting AM` is **Active, V1, in BOTH dev2 (`301ca00000To7lgAAB`) and staging** — record-triggered on Order, 2 entry conditions, Run Immediately: `Get Damaged Line Items` → `Has Misprint Or Damage` → (Damage Found) `Set Awaiting AM` → `AM Email On Order` → `Send Reprint Email To AM`. Confirmed by *Where is this used?* on `Misprint_Outcome__c` in both orgs. The line above was written hours before the build and never updated — **when a row says something does not exist, re-check the org before repeating it.**

---


##### B9 email enrichment — BUILT AND VERIFIED IN dev2 V2 — **ACTIVE since 2026-09-11 4:27 PM**

**State at 2026-09-11 14:02.** dev2 flow `B9 Order Complete With Damage - Awaiting AM` **V2, Inactive**
(`301ca00000TvbBtAAJ`; the flowId changes on every save — find it from the Flows list, not this number).
**V1 is still the Active flow, so dev2 behaviour is unchanged.** The whole element-by-element build below
is now **in, saved, reloaded fresh from the server, and debugged against a real damaged order**
(00013504, Screen Print + Heat Press, 7 damaged line items across 4 sizes). Activation is deliberately
**not** done — the app half (`b47c233`) is still unpushed, and staging has not been mirrored.

**Built and verified in V2:**

| Element / resource | State |
|---|---|
| `Get Damaged Line Items` | All records (was first-match); sorted **Ascending by `Size_Sort__c`** — the single load-bearing precondition for the grouping loop |
| `Get Order Methods` | Production Method where `Order__c` = Triggering Order > Order ID, all records |
| `Get Primary Contact` | Contact where Id = Triggering Order > Account ID > Primary Contact |
| `Init Email Build` | `vMisTotal = 0`, `vDamTotal = 0` |
| `Loop Damaged Rows` | over `Production Run Line Items from Get Damaged Line Items`, first-to-last |
| `Same Size As Previous` | Decision, outcome **Same Size**: `Loop Damaged Rows > Size` **Equals** `vPrevSize` |
| `Accumulate Into Group` | Assignment on **Same Size**: `vSizeMis`/`vMisTotal` Add `fRowMis`, `vSizeDam`/`vDamTotal` Add `fRowDam` |
| `Group Pending` | Decision on **Default Outcome**, outcome `Pending` = `vPrevSize` **Is Null** = **False** |
| `Flush And Start Group` | Assignment on `Pending`. **Row order is load-bearing:** 1 `vSizeLines` Add `tGroupLine` · 2 `vPrevSize` Equals Size · 3 `vSizeMis` Equals `fRowMis` · 4 `vSizeDam` Equals `fRowDam` · 5 `vMisTotal` Add `fRowMis` · 6 `vDamTotal` Add `fRowDam` |
| `Start First Group` | Assignment on `Group Pending`'s Default: rows 2-6 of the above, no append |
| `Flush Last Group` | Assignment on the loop's **After Last** path, **outside the loop rectangle** — see the trap below |
| `Loop Methods` | over `Production Methods from Get Order Methods`, between `Flush Last Group` and `AM Email On Order` |
| `Method Not Listed` | Decision inside Loop Methods, outcome `Not Listed` = `fMethodNotListed` **Equals True** |
| `Append Method` | Assignment on `Not Listed`: `vMethods` Add `tMethodItem` |
| `Send Reprint Email To AM` | Subject `Reprint decision needed - order {!$Record.OrderNumber}`; Body `{!tEmailBody}` in Plain Text; Rich-Text-Formatted Body **empty**; **Use Line Breaks = True** |
| Formulas | `fRecordLink` (Text), `fMethodNotListed` (Boolean), `fRowMis`, `fRowDam` (Number, 0 dp) |
| Text templates | `tEmailBody`, `tGroupLine`, `tMethodItem` — all **Plain Text** |
| Variables | `vSizeLines`, `vMethods`, `vPrevSize` (Text); `vMisTotal`, `vDamTotal`, `vSizeMis`, `vSizeDam` (Number, 0 dp) |
| Dead, delete when convenient | `vSizeLadder`, `vOtherLines` — left over from the abandoned ladder design |

**The email the debug run actually produced** (read out of the Send Email action's resolved inputs,
not off the canvas):

```
Hi Anthony Martinez,

Order 00013504 has finished production and some garments came off the press misprinted or
damaged. Before we build a reprint, please check with the customer what they would like to
do, then record the outcome on the order.

Print methods on this order:
Screen Print
Heat Press
Totals: 11 misprinted, 1 damaged

By size:
S — 4 misprint, 0 damaged
M — 3 misprint, 1 damaged
L — 2 misprint, 0 damaged
XL — 2 misprint, 0 damaged
Account contact:
Some X Person
somexperson@gmail.com

Open the order to record the outcome:
https://cultureapparel--dev2.sandbox.my.salesforce.com/801ca00000TebvdAAB
```

Recipient resolved to `anthony@cultureapparel.com` from `$Record.Opportunity_Owner_Email__c`.

---

###### 🪤 THREE DEFECTS THE DEBUG RUN CAUGHT THAT THE CANVAS DID NOT

**The flow was green, complete, and saved — and the email was wrong three different ways.** All three
were only visible by opening the Send Email action's resolved input values in the debug log. This is the
"a green board is not a passing test" rule in a new place: *a flow that completes is not a flow that works.*

**1. `CONTAINS()` on an empty variable returns null, not false — the whole print-methods list was blank.**
The spec's formula was `NOT(CONTAINS({!vMethods}, {!Loop_Methods.Type__c}))`. On the first iteration
`vMethods` is empty, `CONTAINS` null-propagates, `NOT(null)` is null, and the Decision's
`fMethodNotListed Equals true` never matched — so **no method was ever appended, on any iteration**, and
`Print methods on this order:` came out empty. The debug log said it plainly: `{!fMethodNotListed} (null) Equals true`.
**`BLANKVALUE({!vMethods}, '')` does NOT fix this** — an empty substitute is still blank. The fix is to make
the haystack genuinely non-empty:

```
NOT(CONTAINS('#' & {!vMethods}, TEXT({!Loop_Methods.Type__c})))
```

`TEXT()` is separately required because `Type__c` is a picklist (trap 5, same as B4's `Run_Print_Location__c`).

**2. A null quantity seeded a group counter as null, and rendered as a blank in the email.**
`Damaged_Qty__c` is nullable. `vSizeDam Equals {!Loop_Damaged_Rows.Damaged_Qty__c}` on a null field leaves
the counter **null**, which prints as nothing: the L line read `L — 2 misprint,  damaged`. Flow's **Add**
is null-tolerant (it treats null as zero, which is why the totals were right) but **Equals is not** — it
copies the null through. Fixed with two Number formula resources used everywhere a quantity is read:

```
fRowMis = BLANKVALUE({!Loop_Damaged_Rows.Misprint_Qty__c}, 0)
fRowDam = BLANKVALUE({!Loop_Damaged_Rows.Damaged_Qty__c}, 0)
```

📌 The general rule: **in Flow, `Add` forgives nulls and `Equals` does not.** Any counter seeded from a
nullable field needs coalescing at the seed, not at the display.

**3. Flow strips leading AND trailing whitespace from a text template on save — every line ran together.**
This is the one that undoes the "use a text template, formulas cannot make a newline" advice above. A text
template whose separator is a bare trailing newline loses it silently on save; the editor reopens showing a
single line, and the email reads `Screen PrintHeat Press` and
`S — 4 misprint, 0 damagedM — 3 misprint, 1 damaged`. **Moving the newline to the front does not help —
leading whitespace is trimmed too.** Interior newlines survive; only the boundaries are trimmed.

🔑 **The fix: anchor the newline with a zero-width space (U+200B).** `tGroupLine` and `tMethodItem` each
begin with a line containing a single U+200B, then the content line:

```
<U+200B>
{!vPrevSize} — {!vSizeMis} misprint, {!vSizeDam} damaged
```

The zero-width space is not whitespace to the trimmer, so the newline after it survives; it is invisible in
the delivered email. **That first line looks empty in Flow Builder and is not — do not "clean it up".** Both
templates' descriptions say so in the org. Because the separator is now *leading*, `tEmailBody` has **no**
newline after `Print methods on this order:` or after `By size:` — the items supply their own.

⚠️ This trap applies to **every** text template used as a repeated list item, not just B9's two.

---

###### Other things worth knowing about this build

- **`Flush Last Group` landed inside the loop on the first attempt.** The connector label in the element
  list said "after the loop closes"; the element was in fact on the For-Each path and would have flushed
  a line every iteration. Fixed with ⋮ → **Cut Element** and pasting at the `+` below the loop rectangle.
  **Verify loop membership by zooming the canvas and looking at the rectangle, not by reading a label.**
- **A Decision cannot take a formula inline** — there is no "Formula Evaluates to True" operator, only
  AND / OR / Custom Condition Logic. That is why `fMethodNotListed` exists as its own resource.
- **`tMethodItem` separates with a newline, not a comma**, so there is no trailing separator to strip.
- **`Use Line Breaks = True` on the Send Email action was added and is not optional** — it is what turns
  the plain-text newlines into line breaks in the delivered mail. It was not in the original spec.
- **`Send Reprint Email To AM` still has the API name `Send_Reprint_Email_Fallback`.** Cosmetic, left alone
  deliberately; renaming an element in Flow Builder is a rebuild.
- **Debug with "Skip start condition requirements" checked**, or the run stops at the entry conditions —
  00013504's Production Status is not `Completed`. Rollback mode is forced on and no email is actually sent,
  which is why the resolved input values in the log are the only way to read the message.
- **Reading the debug log:** the panel is virtualised, so `get_page_text` and `innerText` return only what is
  scrolled into view, and `innerText` collapses the newlines you are trying to check. Filter with the panel's
  own search box and read `textContent`, which preserves them.
- The contact block prints a blank line when `Phone` is empty. Cosmetic; left as is.

**Still open:**

1. **Activate V2 in dev2** — not done. V1 is live. Do this only alongside the app half.
2. **Mirror the whole build in staging by hand** — nothing has been done there; staging is still V1.
3. **Create `Size_Sort__c` in production** before `feat/proposed-run-press` or anything else B9-related
   ships. Without it the sort silently does nothing and the by-size list comes out in arbitrary order.
4. Delete the dead `vSizeLadder` / `vOtherLines` resources.

**UI facts that cost time — read before touching Flow Builder:**
- **This is a Mac: select-all is `cmd+a`.** `ctrl+a` goes to line start and silently PREPENDS.
- **Comboboxes open on click-then-`Down`, and commit on blur.** A second click on an already-open
  dropdown CLOSES it — verify the open state with a zoom before clicking an option, or you will
  select nothing and not notice. **Never chain the typing and the option-click into one batch**; screenshot
  between them. A value left as uncommitted literal text shows "We couldn't find any matching resources,
  but you can enter a value" and saves as a string.
- **To replace a committed value pill, click its `X` first**, then click the field and type.
- **The canvas does not scroll on the wheel; drag the background to pan.**
- **Save often.** `Save` updates the inactive V2 in place; `Save As New Version` makes a new one.
- **The Tooling/REST API is not reachable from the browser session cookie** (`INVALID_SESSION_ID`), so
  there is no shortcut around the UI for reading a flow back.

---

##### ❌ B9 in STAGING — ~~V2 part-built, NOT finished~~ **SUPERSEDED 2026-09-14: deployed by change set as V3 and ACTIVE. The hand-build below was never completed and never needed to be — kept only for the traps it recorded.**

**State at 2026-09-11 15:05.** staging flow `B9 Order Complete With Damage - Awaiting AM`,
DefinitionId **`300ca00000H8ayz`**. **V1 is Active** (`301ca00000To95rAAB`, activated 9/8 2:49 PM) and
untouched. **V2 exists, is INACTIVE, and is roughly two-thirds built** (latest flowId
`301ca00000TvWqVAAV` — it changes on every save, so find it from the Flows list, never from this number).
Everything listed as built below is saved. Nothing is half-written: the build stopped between elements,
not inside one.

⚠️ **Anthony's call, 2026-09-11: finish the build but do NOT run the debug and do NOT touch staging's
data.** So staging V2 has been read back off the screen only. **It has never been exercised, not once.**
Treat its first real run as unproven — in dev2 the debug was the only thing that found all three defects,
and a readback cannot find them.

**Built and saved in staging V2:**

| Element / resource | State |
|---|---|
| Variables (7) | `vSizeLines`, `vMethods`, `vPrevSize` (Text); `vMisTotal`, `vDamTotal`, `vSizeMis`, `vSizeDam` (Number, 0 dp) |
| `fRecordLink` | Text formula, same body as dev2 |
| `fRowMis` / `fRowDam` | Number (0 dp), `BLANKVALUE({!Loop_Damaged_Rows.<qty>__c}, 0)` |
| `tGroupLine` | Plain Text, **line 1 is a zero-width space (U+200B)**, line 2 is the size line — the anchor trap, see above |
| `Get Damaged Line Items` | changed from first-match to **All records**, **Ascending by `Size_Sort__c`**; conditions unchanged (`1 AND (2 OR 3)`) |
| `Get Order Methods` | Production Method where **Order Equals Triggering Order > Order ID**, All records |
| `Get Primary Contact` | Contact where **Contact ID Equals Triggering Order > Account ID > Primary Contact**, first record |
| `Init Email Build` | `vMisTotal` Equals 0 · `vDamTotal` Equals 0 |
| `Loop Damaged Rows` | over `Production_Run_Line_Items from Get Damaged Line Items`, first-to-last |
| `Same Size As Previous` | Decision, outcome **Same Size**: `Loop Damaged Rows > Size` **Equals** `vPrevSize` |
| `Accumulate Into Group` | Assignment on **Same Size**: `vSizeMis` Add `fRowMis` · `vSizeDam` Add `fRowDam` · `vMisTotal` Add `fRowMis` · `vDamTotal` Add `fRowDam` |
| `Group Pending` | Decision on **Default Outcome**, outcome **Pending**: `vPrevSize` **Is Null** = **False** |

**Still to build in staging — pick up here.** Every value below is what dev2 actually has, after its
three defects were fixed; build from this table, not from the original V1-era spec.

1. **`Flush And Start Group`** — Assignment on the **Pending** branch. **Row order is load-bearing**,
   because row 1 must read the OLD group before rows 2-4 overwrite it:
   1 `vSizeLines` **Add** `tGroupLine` · 2 `vPrevSize` **Equals** `Loop Damaged Rows > Size` ·
   3 `vSizeMis` **Equals** `fRowMis` · 4 `vSizeDam` **Equals** `fRowDam` ·
   5 `vMisTotal` **Add** `fRowMis` · 6 `vDamTotal` **Add** `fRowDam`.
2. **`Start First Group`** — Assignment on `Group Pending`'s **Default Outcome**: rows 2-6 of the above,
   no append.
3. **`Flush Last Group`** — Assignment on the loop's **After Last** path: `vSizeLines` **Add** `tGroupLine`.
   🚩 In dev2 this landed **inside** the loop on the first attempt and would have flushed every iteration.
   **Verify by zooming the canvas and looking at the loop rectangle, not by reading a connector label.**
4. **`Loop Methods`** — Loop over `Production Methods from Get Order Methods`, first-to-last, placed
   between `Flush Last Group` and `AM Email On Order`.
5. **`tMethodItem`** — Text Template, **Plain Text**, **line 1 a zero-width space (U+200B)**, line 2
   `{!Loop_Methods.Type__c}`. Create it after the loop exists or the merge field will not resolve.
6. **`fMethodNotListed`** — Boolean formula:
   `NOT(CONTAINS('#' & {!vMethods}, TEXT({!Loop_Methods.Type__c})))`.
   The `'#'` and the `TEXT()` are both load-bearing — see the three-defects section above.
7. **`Method Not Listed`** — Decision inside Loop Methods, outcome **Not Listed**:
   `fMethodNotListed` **Equals** **True**. (A Decision cannot take a formula inline; that is why the
   formula resource exists.)
8. **`Append Method`** — Assignment on **Not Listed**: `vMethods` **Add** `tMethodItem`.
9. **`tEmailBody`** — Text Template, **Plain Text**, body exactly as dev2's (reproduced in the dev2
   section above). Note it has **no** newline after `Print methods on this order:` or after `By size:` —
   the item templates supply their own leading newline.
10. **Wire `Send Reprint Email To AM`**: Subject → `Reprint decision needed - order {!$Record.OrderNumber}`;
    Body → `{!tEmailBody}` in **Plain Text**; **Rich-Text-Formatted Body left empty**; **Use Line Breaks → True**.
11. **Save, reload V2 fresh from the server, re-open every element.** Leave it **INACTIVE**.

⛔ **STAGING HAS NO DATA THAT CAN EXERCISE B9 — this is the reason the debug was skipped, and it does not
go away on its own.** Staging holds **14** Production Run Line Items in total. The three with a misprint
quantity (PRLI-0001, PRLI-0003, PRLI-0004) have **no Order Product**, so their `Order_Id__c` formula is
blank and `Get Damaged Line Items` can never match them. The ten that **do** carry an `Order_Id__c` — all
on order **00009525** (`801ca00000TSkqPAAT`, Production Status already `Completed`, "Multiple Methods,
Custom Tags on Heat Press", sizes S/M/L/XL/2XL) — have **no misprint or damaged quantity at all**. So the
query matches nothing, on every order in the org.

📌 **To debug it later, the fixture is:** temporarily set Misprint/Damaged Qty on a few of 00009525's line
items, Debug with **Skip start condition requirements** checked (rollback mode is forced on, so no email
is actually sent and the Order is not written), read the Send Email action's **resolved input values**,
then clear the quantities back to blank. Editing line items is inert with respect to the live automation:
B9 V1 and `Printshop Misprint Process` both fire on **Order** update, and 00009525 already satisfies B9
V1's entry conditions, so there is no new transition to trip.

**Deviations from dev2, deliberate and recorded:**
- `Get Order Methods` in staging uses **Automatically store all fields**; dev2 stores only `Type__c, Id`.
  A superset — no behavioural difference for this flow, one fewer UI step.
- Staging's V1 never had `Get Order Methods`, `Get Primary Contact` or `Init Email Build`, so staging V2
  is being built from a smaller starting point than dev2's V2 was. It is not a like-for-like delta.

🪤 **Staging-specific facts that cost time:**
- **Object key prefixes are NOT the same across the two sandboxes.** Production Run Line Items is `a3V…`
  in staging and `a3W…` in dev2. **Never carry a record id, or a prefix, from one org's notes to the other.**
- **The staging Lightning Setup shell (`my.salesforce-setup.com`) blocks BOTH screenshots and page reads**
  — worse than dev2, where screenshots worked. The way in is the **classic Flows list at `/300` on
  `cultureapparel--staging.sandbox.my.salesforce.com`**, which is fully scriptable; from there the flow's
  detail page gives the DefinitionId and every version's flowId. Flow Builder itself
  (`lightning.force.com/builder_platform_interaction/flowBuilder.app`) is fine.
- **A flowId copied from this document will not open** — `301ca00000TnvhGAAR`, recorded on 9/08, now
  returns "We can't open this flow right now." The doc's own rule, demonstrated.
- ❌ ~~**There is no metadata shortcut.** Change sets only move between a production org and its own
  sandboxes, so dev2 → staging is not a valid pair.~~ **WRONG — CORRECTED 2026-09-11, and only because
  Anthony asked "can I not just use a change set?" and I went and looked.** dev2 → Setup → **Deployment
  Settings** lists three connections and the **`dev2 ⟷ Staging`** row carries a **double-headed arrow**:
  upload is **already authorised in BOTH directions**. Salesforce creates deployment connections between
  *every* org in a production org's family, **sandbox-to-sandbox included** — not just production-to-sandbox.
  (For contrast, `dev2 ⟵ Production` and `dev2 ⟵ Dev` are single arrows pointing at dev2.) 🎯 **So the
  staging mirror never had to be a hand-rebuild.** Two hours of hand-building were spent on a claim that
  one Setup page disproves in ten seconds. **Same lesson as the "B9 does not exist" correction above: the
  ⛔ lines are the ones most likely to be wrong, and a capability claim gets checked against the ORG.**

🪤 **Flow Builder dropdown behaviour, measured this session — this is the thing that makes the UI slow:**
- **A combobox closes itself after about two seconds.** A screenshot taken 3 seconds after the click shows
  it closed and looks like the click failed. **Screenshot within ~1 second.**
- **Click the dropdown's ARROW, not the field text.** Clicking the text usually only focuses it.
- **A click that follows typing in another field is usually swallowed as a blur** — the next click opens.
- When coordinates keep failing, `find` returns a `ref` and clicking by ref works first time. Cheapest
  escape hatch in the whole toolkit; reach for it after two failed clicks, not ten.
- **`Get Records` → Sort By shows a stale "Enter a value." even after the field is set.** Press Enter to
  commit, then click elsewhere; the error clears on blur. Do not retype it.

---

##### ✅ THE GUARD — `Awaiting AM` is now treated as "still blank" by `Printshop Misprint Process`

Anthony's call: keep one field for one conversation, and teach the existing flow to ignore
the waiting state. **Three outcome edits per org, both orgs done and read back off a fresh
page load of the ACTIVE version.**

| Outcome | Was | Now |
|---|---|---|
| `MisprintDetailsOutcome` → `MisprintDetailsAdded` | Misprint Outcome **Is Null = True** | **Any (OR):** Is Null = True **OR** Equals `Awaiting AM` |
| `MisprintDetailsOutcome` → `MisprintOutcomeAdded` | Misprint Outcome **Is Null = False** | **All (AND):** Is Null = False **AND** Does Not Equal `Awaiting AM` |
| `Misprint Outcome Slack` → `Copy 2 of MisprintOutcomeAdded` | Misprint Outcome **Is Null = False** | **All (AND):** Is Null = False **AND** Does Not Equal `Awaiting AM` |

| Org | New active version | Old version |
|---|---|---|
| dev2 | **V29** Active (`301ca00000TnkHEAAZ`) | V28 superseded |
| staging | **V16** Active (`301ca00000Tnq3CAAR`) | V14 superseded, V15 superseded — see below |

📌 **The third edit was not in the original plan and is the one that matters most.**
`MisprintDetailsAdded` fires the *manager* notification and its only condition was "outcome
is blank". Guarding just the other two outcomes would have left `Awaiting AM` silently
**suppressing the manager notification** on any later edit to Misprint Details — a
regression invisible until someone noticed the emails had stopped. The rule the guard
implements is one sentence: **inside this flow, `Awaiting AM` means the same thing as blank.**

🪤 **A staging version was saved wrong and had to be fixed — read your edits back off a
fresh page load, not off the editor you just typed into.** Staging **V15** saved
`MisprintDetailsAdded` as **AND** instead of **OR** — "Misprint Outcome is blank AND equals
Awaiting AM" is unsatisfiable, so that branch could never fire and the manager notification
was dead for as long as V15 was active (a few minutes). Caught on the verification pass and
corrected in **V16**. The same click sequence produced the right result in dev2 and the wrong
one in staging: the option click landed but did not commit before the next click moved on.
**Every condition in a flow you edit through the UI gets read back after activation.**

📌 The guard is a **no-op against existing data** — nothing writes `Awaiting AM` yet, so no
order in either org matches the new clause. That is why it was safe to activate immediately.

⚠️ **Production still has the unguarded flow** and picks this up at **E7.4**. A change set
deploys flows INACTIVE (§9), so the guard must be activated by hand there, and it must land
**before** anything that writes `Awaiting AM`.

##### ✅ B9 item 2 IS BUILT IN dev2 — `B9 Record Misprint Outcome` (the AM's answer)

**State at 2026-09-11 15:58.** The email half of B9 tells the AM an order came off the press
damaged. **This is the thing the email points at** — where the AM records what the customer
decided. Built by hand in dev2, **Active**, reachable from a button on the Order.

✅ **NOW IN STAGING TOO — deployed by change set 2026-09-14 and Active there (V1, `300ca00000HHtPk`).**
The flow and the Quick Action both moved; **the three page layouts did not** — see "Deployed to staging"
at the end of this section. ⛔ **Production still has none of it** (Anthony's scope call, 2026-09-11).

| | Value |
|---|---|
| Flow label / API name | `B9 Record Misprint Outcome` / `B9_Record_Misprint_Outcome` |
| Type | **Screen Flow** |
| Version / state | **V1, ACTIVE** |
| flowId at time of writing | `301ca00000TvdTuAAJ` |
| Launched from | Quick Action `Record_Misprint_Outcome` on Order (Action Id `09Dca000000BAQf`) |

🪤 **The flowId changed on every single save** (`…TvaB5AAJ` → `…TvY4OAAV` → `…TvRfYAAV` →
`…TvdTuAAJ`). Same rule as everywhere else in this document: **a recorded flowId is a
receipt, not an address.** Open it from Setup → Flows by name.

**The three decisions Anthony made, 2026-09-11:**

| Question | Chosen | Why it matters |
|---|---|---|
| Where does the AM answer? | **A screen flow launched from an Action on the Order** | The "put the decision in Salesforce, not in this app" option this document argued for above. No token, no new endpoint, **no Cloudflare Access exception** — the E6.4 collision simply does not happen. |
| Which outcomes are offered? | **Three: `Reprint` · `Credit` · `Refund`** | `Misprint_Outcome__c` has five restricted values and three of them overlap. `Credit/Refund` stays **active on the field** so historical records still read correctly, but **the AM is never shown it.** |
| Are notes required? | **Required for everything but `Reprint`** | A reprint explains itself. A credit or refund is money leaving, and six months later nobody remembers why. |

**Shape (read back off a fresh page load of the saved version):**

```
Start   Screen Flow
        recordId   Text, Available for input      <- how the Action passes the Order
  |
Get Order                 Order · Order ID Equals {!recordId} · first record · all fields
  |
Outcome Already Recorded  Decision
        Already Recorded (AND):  Misprint Outcome Is Null = False
                                 AND Does Not Equal "Awaiting AM"
        Default Outcome:         everything else
  |
  +-- Already Recorded --> Already Recorded (Screen, dead end) --> End
  |         txtAlready: names the recorded outcome and says to edit the field directly
  |
  +-- Default Outcome ----> Record Outcome (Screen)
                              txtPrompt      Display Text
                              outcomeChoice  Radio Buttons, REQUIRED, Text
                                             Choice_Reprint / Choice_Credit / Choice_Refund
                              outcomeNotes   Long Text Area, REQUIRED,
                                             visible only when ANY (OR):
                                               {!outcomeChoice} = {!Choice_Credit}
                                               {!outcomeChoice} = {!Choice_Refund}
                            |
                            Update Order (Update Records, Order, Order ID = {!recordId})
                              Misprint_Outcome__c        = {!outcomeChoice}
                              Misprint_Outcome_By__c     = {!$User.Id}
                              Misprint_Outcome_At__c     = {!$Flow.CurrentDateTime}
                              Misprint_Outcome_Notes__c  = {!outcomeNotes}
                            |
                            End
```

📌 **The three choice resources store the picklist's API values verbatim** — `Reprint`,
`Credit`, `Refund` — so `{!outcomeChoice}` drops straight into the restricted picklist with
no translation. Label and stored value are identical on all three. **If anyone renames a
picklist value, these three Choice resources are what breaks, silently, at save time.**

📌 **Component visibility is what makes Notes conditionally required.** The component is
marked Required unconditionally; a *hidden* required component does not block Finish. So
`Reprint` → Notes is not on the screen at all → Finish works. `Credit`/`Refund` → Notes
appears with its red asterisk → Finish is blocked until it is filled. **Do not "fix" this by
removing Required — that is the mechanism, not a bug.**

📌 **The visibility conditions compare against the Choice resources (`{!Choice_Credit}`),
not against literal text.** Both work; the resource reference survives a later edit to a
choice's stored value, a literal does not.

##### ⛔ WHY THE GUARD EXISTS — it is not politeness, it re-notifies the print shop

`Printshop Misprint Process` and `Misprint Outcome Slack` test **"Misprint Outcome is not
null AND does not equal `Awaiting AM`"** — see the guard section immediately above. Those are
**state tests on every qualifying update, not transition tests.** Re-setting an outcome that
is already recorded therefore fires the print-shop notification and the Slack post **again**,
with nothing on screen to suggest it happened.

⛔ **Therefore an already-answered order must never reach `Update Order`.** That is the whole
job of the `Outcome Already Recorded` decision, and it is why the Already Recorded branch is
a **dead-end screen and not a second chance to edit.** If a recorded outcome is genuinely
wrong, it gets changed on the field itself by someone who knows they are re-triggering.

🪤 **`Is Null = False` AND `Does Not Equal 'Awaiting AM'` — both clauses are load-bearing.**
`Awaiting AM` is what B9's *email* flow writes, so it is the normal state of an order arriving
at this screen. Guarding on "is not null" alone would send every single one of them to the
dead end. This is the same "**inside this context, `Awaiting AM` means the same thing as
blank**" rule the guard section states.

##### The button — Quick Action and page layouts

| | Value |
|---|---|
| Action label / API name | **Record Misprint Outcome** / `Record_Misprint_Outcome` |
| Type | Flow (Quick Action) → `B9 Record Misprint Outcome` |
| Object | Order |

⛔ **A Flow Quick Action can only reference an ACTIVE flow.** The flow does not appear in the
action's Flow picklist while it is Inactive — this is why `B9 Record Misprint Outcome` was
activated before the action could be created, and it is the order of operations to repeat in
staging and production. (Activating *this* flow is harmless on its own: a screen flow does
nothing until somebody presses the button. It is **not** the B9 *email* flow, which is still
deliberately Inactive in dev2 pending `b47c233`.)

Added to the **Salesforce Mobile and Lightning Experience Actions** section, positioned
between `Production Error` and `Edit`, on the three layouts that serve press orders:

| Order record type | Page layout | Action added |
|---|---|---|
| **Print Shop Production** | Order Layout (`00h5e000003cR2fAAE`) | ✅ 15:53 |
| **EMB Production** | Order Layout - EMB (`00hca000001Yf1lAAC`) | ✅ 15:54 |
| **Heat Press Production** | Order Layout - Heat Press (`00hca000001YRrdAAG`) | ✅ 15:58 |
| Master · Vendor Order | Order Layout | ✅ (same layout) |
| Ecommerce · ShipStation | Ecommerce | ❌ **deliberately not added** — these are not press orders |
| — | Inventory Works Order Layout | ❌ not assigned to any Order record type in the assignment grid |

📌 **Read the Page Layout Assignment grid before deciding which layouts to touch** — it is
7 record types across 2 pages of that table, and the mapping is not guessable from the layout
names. `Print Shop Production`, the one that matters most, uses the plainly-named
**`Order Layout`**, not one of the two obviously-production-sounding ones.

📌 **`Production Error` already exists as an action on all three layouts.** Not touched, not
investigated. Worth knowing it is there before adding anything else misprint-shaped.

##### ✅ WHAT WAS ACTUALLY VERIFIED — and the one thing that was not

Debug run, dev2, 2026-09-11 15:49, `recordId = 801ca00000ThktNAAR` (Order **00013509**,
`Misprint_Outcome__c` blank):

| Checked | Result |
|---|---|
| `Get Order` retrieves by `recordId` | ✅ "One or more Order records were retrieved" |
| Decision routes a blank outcome | ✅ "The **default** outcome was executed" |
| Prompt merge field resolves | ✅ rendered *"Order **00013509** came off the press with misprinted or damaged garments…"* — not `{!Get_Order.OrderNumber}` |
| Three choices, correct labels | ✅ Reprint · Credit · Refund |
| Notes hidden on load | ✅ |
| Notes appears on **Credit** | ✅ with the required asterisk |
| Notes disappears on **Reprint** | ✅ |

⛔ **THE WRITE PATH WAS NOT EXERCISED. `Update Order` has never run.** The debug was stopped
at the screen, deliberately, **before** pressing Next — because finishing it would have
written `Misprint_Outcome__c` on a real dev2 order and, per the section above, fired
`Printshop Misprint Process` and the Slack post. Flow Builder offers **no rollback option for
screen flows** (only "Run the latest version of each flow called by subflow elements" and
"Run automation as another user" — there is no "roll back changes" checkbox the way a
record-triggered debug has one), so there was no safe way to complete it.

📌 **So four field bindings are verified by readback only, not by execution:**
`Misprint_Outcome__c`, `Misprint_Outcome_By__c`, `Misprint_Outcome_At__c`,
`Misprint_Outcome_Notes__c`. Every one was read back off the saved element and all four
resolved to the right resource. **That is exactly the level of assurance this document says
is not enough** — §2 trap 11, *"a flow that completes is not a flow that works"*. The first
real click of this button is therefore also its first real test, and **the thing to check
immediately after it is whether the print shop got notified once and only once.**

📌 The safe way to close this gap when someone wants to: pick a **dev2 order that is not
plausibly real**, press the button once, then read `Misprint_Outcome_At__c`/`_By__c` and the
Slack channel. One order, once, watched.

##### 🪤 Traps this build hit (UI-driving, all cost real time)

1. **A screen component's API Name auto-fills from its Label and APPENDS what you type.**
   Label `Outcome` + typing `outcomeChoice` produced **`OutcomeoutcomeChoice`**. Select-all
   before typing into any auto-filled API Name field, then zoom in and read it back.
2. **A screen's API Name will silently collide with a Decision outcome's API name.**
   `Already Recorded` as a screen label auto-generated `Already_Recorded`, which the
   `Outcome Already Recorded` decision's outcome already owned — *"This API name is already
   used for another element or resource in this flow."* Renamed to `Already_Recorded_Screen`.
   **Outcome names share the flow's namespace with element names.**
3. **Flow Builder's renderer froze twice** — screenshots timed out for minutes while
   JavaScript still answered. Recovery is a **fresh tab**, not a reload; the frozen tab stays
   frozen. Everything saved up to that point survived.
4. **The classic page-layout editor lives in an iframe that ignores normal scrolling.**
   The Actions section is below the fold and cannot be reached by scrolling the page.
5. **The `New Action` form's Action Type is a native `<select>`** — click it and *type*
   `Flow`; a click that lands a few pixels off hits the neighbouring info icon and does
   nothing visible.

##### ✅ DEPLOYED TO STAGING — 2026-09-14, by change set

| | Value |
|---|---|
| Change set | **`B9 Record Misprint Outcome`**, dev2 `0A2ca000000Iyyb` |
| Components | `Flow Definition: B9_Record_Misprint_Outcome` · `Action: Record_Misprint_Outcome` |
| Result | **Validate: Succeeded · Deploy: Succeeded, 2/2**, 9/14 7:12 AM |
| Staging flow | **Active Version 1**, `300ca00000HHtPk`, Screen Flow, API 67.0, activated 7:13 AM |

📌 **Both pre-flight checks are worth repeating for the production run:**

1. **Dependencies** — exactly four reported (`Misprint_Outcome__c`, `_At__c`, `_By__c`, `_Notes__c`),
   **all four already present in staging**, so none were added. Deploying a custom field over an
   existing one replaces the whole field definition — same risk class as a layout.
2. **The picklist** — `Misprint_Outcome__c` is **restricted**. Its values were read in staging *before*
   upload: all five active, including `Reprint`, `Credit`, `Refund`. **A missing value would not have
   failed the deploy — it would have failed the flow, at runtime, in front of an AM.**

🪤 **Change-set component-type names in this org:** a flow is **`Flow Definition`** (there is no "Flow"
entry in the Component Type list); a Quick Action is **`Action`**.

⛔ **The button is on NO staging page layout.** The three Order layouts were deliberately excluded, so
staging currently has an **active flow that nothing can launch**. Add `Record Misprint Outcome` by hand
to **Order Layout**, **Order Layout - EMB** and **Order Layout - Heat Press**, between `Production Error`
and `Edit`.

⛔ **A successful deploy is not a passing test.** Staging inherits dev2's unexercised `Update Order`
exactly as-is. Nothing about this deployment reduces the need for the first real button press to be
watched.

##### 📍 WHAT REMAINS BEFORE THIS IS LIVE ANYWHERE

1. ⛔ **The write path has never executed.** See above.
2. ⛔ **Staging has none of this** — not the flow, not the action, not the layouts. It is a
   full hand-rebuild today, the same way the email flow was. (See the CLI note in §0.)
3. ⛔ **Production has none of it either**, and per §9 a change set deploys flows
   **INACTIVE** — so there the order is: deploy → activate the flow → *then* create the
   Quick Action, because the action cannot reference an inactive flow.
4. ⛔ **The app half still does not know this screen exists.** `rework-check` and
   `createReworkIfNeeded` read `Misprint_Outcome__c` and `Misprint_Outcome_By__c`
   (branch `feat/b9-optin-reprint`, unpushed) — now something finally writes them, but that
   branch has never been run against an order this screen has touched.
5. 📌 **Nothing yet makes a pending decision visible.** The "nothing must rot silently"
   warning above is still entirely unaddressed: an AM who never presses the button leaves an
   order at `Awaiting AM` forever, with no queue, no badge and no ageing indicator.

##### ✅ THE RECORD-TRIGGERED FLOW IS BUILT — `B9 Order Complete With Damage - Awaiting AM`

Built by hand in both orgs 2026-09-08, **saved INACTIVE in both, read back off a fresh page
load of the saved version.**

| | dev2 | staging |
|---|---|---|
| Flow API name | `B9_Order_Complete_With_Damage_Awaiting_AM` | same |
| Version / state | **V1, Inactive** | **V1, Inactive** |
| flowId | `301ca00000TnpLgAAJ` | `301ca00000TnvhGAAR` |

**Shape:**

```
Start   Order · A record is updated · Optimize for: Actions and Related Records
        Entry (AND):  Production Status Equals "Completed"   <- Order_Substatus__c, trap 5
                      Misprint Outcome Is Null = True
        When to run:  ONLY when a record is updated to meet the condition requirements

Get Records  "Get Damaged Line Items"  on Production_Run_Line_Items__c
        Custom condition logic:  1 AND (2 OR 3)
          1  Order Id     Equals        {!$Record.Id}      <- the new Order_Id__c formula
          2  Misprint Qty Greater Than  0
          3  Damaged Qty  Greater Than  0
        Store: only the first record, automatically store all fields  (existence check)

Decision  "Has Misprint Or Damage"
        Outcome "Damage Found":  {!Get_Damaged_Line_Items} Is Null = False
        Default Outcome -> End

Update Records  "Set Awaiting AM"
        Use the order record that triggered the flow
        Misprint Outcome = Awaiting AM

Decision  "AM Email On Order"                         <- the email half, added 2026-09-08
        Outcome "Has AM Email":  {!$Record.Opp_Owner_Email__c} Is Null = False
          -> Action "Send Reprint Email To AM"  (Email Alert)
                emailAlert-Order.B9_Reprint_Confirmation_to_AM
                Record ID = {!$Record.Id}
        Default Outcome                                <- the copied field is blank
          -> Action "Send Reprint Email Fallback"  (core Send Email)
                Recipient Addresses = {!$Record.Opportunity_Owner_Email__c}   <- the formula
                Compose Email Content, subject + body typed inline
```

##### THE EMAIL HALF — template, alert, and the two constraints that shaped it

| | dev2 | staging |
|---|---|---|
| Classic email template `B9_Reprint_Confirmation_Request` | `00Xca000001vOIg` | `00Xca000001vPYz` |
| Email Alert `B9_Reprint_Confirmation_to_AM` | `01Wca000000RTIr` | `01Wca000000RTKT` |

Template is **Text** (not HTML) — no Classic Letterhead dependency and nothing that can
mangle merge fields. Body merge fields were taken from the Classic picker's own
`value=` attributes, not guessed: `{!Order.OrderNumber}`, `{!Order.Account_Name__c}`,
`{!Order.Customer_Order_Name__c}`, `{!Order.Misprint_Details__c}`,
`{!Order.Opportunity_Owner_Name__c}`, and **`{!Order.Link}`** (label "Detail Link") for the
record link. Alert recipient type is **Email Field -> Opportunity Owner Email**; the picker
offers only the two Email-type fields, so the Formula(Text) one cannot be chosen there at all.

🪤 **The same-label collision is invisible in Flow Builder's resource picker — the chips and
the list show only the LABEL, so "Opportunity Owner Email" appears twice, identically.**
Two ways to tell them apart, both used here:
1. **Hover the ⓘ on the option.** The popover shows **API Name** — that is the only place
   in the picker where the two are distinguishable.
2. After selecting, reopen the combobox: the input shows the resolved
   `{!$Record.Opp_Owner_Email__c}`.
In both orgs the FIRST entry is `Opp_Owner_Email__c` (Email) and the SECOND is
`Opportunity_Owner_Email__c` (Formula) — verified by tooltip in each org separately, not
assumed from ordering. **Never pick one of these by position; check the tooltip.**

🪤 **A Send Email action that uses an email TEMPLATE cannot send to an arbitrary address.**
Setting `Email Template Name` makes `Recipient ID` required, and that wants a Contact/Lead/User
Id — which would drag a copied lookup field back into the fallback, defeating its whole
purpose. So the fallback uses **Compose Email Content** with the subject and body typed
inline. Cost: the wording now lives in two places (template + fallback action). Benefit: the
fallback can reach `Opportunity_Owner_Email__c`, which reads straight through the Opportunity
and cannot go stale. **If the copy changes, change it in both.**

📌 The alert's From is **"Current User's email address"** — the email appears to come from
whoever's action completed the last production method, not from a shared address. Fine for a
sandbox; decide before production whether it should be an Org-Wide Address.

🚩 **The first build of this flow used the WRONG trigger, and the doc recorded it.** It was
`Status Equals "Complete"` — the standard `Order.Status`, which is set by the **Shipping /
Receiving** dashboard (`functions/api/orders/[id]/complete.js`) when the order physically
ships. That is a *later, different* moment than production finishing. The reprint moment is
`Order.Order_Substatus__c` (label **"Production Status"**) rolling up to `Completed`, which
is the exact line that fires `createReworkIfNeeded` (`production-methods/[id].js:290`). Both
orgs corrected 2026-09-08 and read back off a fresh page load; **dev2 and staging flowIds
both changed on save** (see the table above — a Flow save can mint a new flowId even when the
version number does not move).

**Two field labels, two different completions, one letter apart — this is trap 5 wearing a
different hat:**

| Label in Flow Builder | API name | Stored value | Set by | Means |
|---|---|---|---|---|
| Status | `Status` | `Complete` (no "d") | Shipping/Receiving dashboard | order shipped/received |
| Production Status | `Order_Substatus__c` | `Completed` (with "d") | `rollupOrderSubstatus`, when every method is done | **production finished — the reprint moment** |

📌 The Flow picklist picker shows **labels**, not stored values. `Order_Substatus__c`'s
"In Production" is stored as `Production`; picking "Completed" in the picker does store
`Completed`, but never assume that from the picker alone.

📌 **Why each choice, so nobody "simplifies" it later:**

- **`Misprint Outcome Is Null` is an ENTRY condition, not just a decision.** It stops the flow
  re-firing on later updates and stops it ever overwriting a real customer decision.
- **"Only when a record is updated to meet the condition requirements"** — the other setting
  re-evaluates on every qualifying update, which is exactly the mistake `Printshop Misprint
  Process` makes and the reason the guard was needed.
- **Only the first record.** The flow needs to know *whether* there is damage, not how much;
  storing one record keeps it cheap and needs no loop.
- **No recursion.** The Update sets `Misprint_Outcome__c`, which re-triggers `Printshop
  Misprint Process` — guarded, so it falls to Default Outcome — and cannot re-trigger this
  flow, because its entry condition now fails.

⛔ **BOTH COPIES ARE DELIBERATELY INACTIVE.** `createReworkIfNeeded` still creates the reprint
the moment the last method completes (`production-methods/[id].js:290`, `run-results/index.js:525`).
Activate this flow only alongside the code change that stops that — otherwise the AM is asked
to approve a reprint that already exists, which is the sequencing hazard, not a fix for it.

##### ⛔ STILL TO BUILD — what is actually left, as of 2026-09-08

##### 🚩 POPULATE CHECK — run 2026-09-08, and it kills the primary email branch

Counted with SOQL `COUNT(field)` (counts non-null) in the Developer Console, both orgs.

| Population | Orders | `Opp_Owner_Email__c` (Email Alert recipient) | `Opportunity_Owner_Email__c` (formula fallback) |
|---|---|---|---|
| **dev2** — all orders | 81 | **0** (0%) | 80 (99%) |
| **dev2** — `Misprint__c = true` | 24 | **0** (0%) | 24 (100%) |
| **staging** — all orders | 6,695 | 123 (1.8%) | 6,467 (96.6%) |
| **staging** — `Misprint__c = true` | 74 | **0** (0%) | 60 (81%) |
| **staging** — `Order_Substatus__c = 'Completed'` ← **the B9 trigger population** | 2,164 | 101 (4.7%) | **2,163 (99.95%)** |

**What this means for the flow as built.** The Decision routes to the Email Alert when
`Opp_Owner_Email__c` Is Null = False. That is true for **no order in dev2 and 4.7% of
staging's completed orders**. So in practice every order takes the *Default* outcome and the
Classic template + Email Alert we built in both orgs is dead code. The email would still go
out — via the fallback's inline copy — but through the branch that was meant to be the
exception.

📌 **The two fields are not a primary and a backup, they are a live field and an abandoned
one.** `Opp_Owner_Email__c` is a writable copy that something stopped populating; the formula
is derived from `Opportunity.Owner.Email` and cannot go stale. The design had them backwards.

✅ **Coverage on the population that matters is excellent** — 2,163 of 2,164 completed orders
carry an address. The 14 blank misprint orders in staging are almost all stuck in
Pre-Production (13 of 14, all `Honey Bee Entertainment`) and never reach the trigger. **All 14
have a blank `OpportunityId`** — no Opportunity means no owner means no email. Exactly one
completed order (`00009272`, One North Coast) has no address, and it is the one row in 2,164.

✅ **CONFIRMED 2026-09-08 — the formula IS the field Anthony asked for.** Read off the field
detail page in staging, not inferred:

```
Opportunity_Owner_Email__c   Data Type: Formula
    Opportunity.Owner.Email
    created Peter Larson, 2025-05-09
```

That is exactly the chain from the Opportunity's Details tab: **Opportunity → Owner (the name
shown) → that User → their Email.** No copy, no intermediate custom lookup, nothing to go
stale. `Opportunity_Owner__c` (Lookup(User), `00NRi000003fPQX` in staging) is a *different*
route to nominally the same person and is NOT used.

---

##### 🪤 TRAP — sandbox email scrambling makes `.invalid` addresses, and the STALE field is the dangerous one

Found while sampling the formula's actual values in staging:

| Order | `Opportunity_Owner_Email__c` (formula, live) | `Opp_Owner_Email__c` (copy, stale) |
|---|---|---|
| 00007092 | `vitaliy@cultureapparel.com.invalid` | `vitaliy@cultureapparel.com` |
| 00006512 | `abby@cultureapparel.com.invalid` | `abby@cultureapparel.com` |
| 00006497 | `ben@cultureapparel.com.invalid` | `ben@cultureapparel.com` |

**Salesforce appends `.invalid` to every `User.Email` when a sandbox is created or refreshed**,
so nothing in a sandbox can accidentally email a real person. **2,050 of the 2,163 completed
staging orders (94.8%) carry a `.invalid` address.** The 113 clean ones are users whose email
was de-scrambled by hand afterwards (Anthony, Tom Cibic).

Two consequences, and the second is a hazard:

1. ✅ **Expect ZERO delivered emails when testing B9 in staging.** That is the sandbox working
   as designed, NOT a broken flow. To test delivery end-to-end, de-scramble ONE test user's
   email in Setup → Users and use an order owned by them. Do not de-scramble in bulk.
   🚩 **BUT BE PRECISE ABOUT WHY, because the safety net is narrower than it sounds.** Checked
   2026-09-14: **Deliverability → Access to Send Email is `All email` in BOTH dev2 and staging** —
   neither sandbox is set to "System email only", so **nothing at the org level is stopping mail
   from leaving.** The only reason B9's emails do not land is that sandbox refresh scrambles User
   emails to `.invalid`, and `Opportunity_Owner_Email__c` is a formula off that. **That is a
   per-address property, not an org-wide block** — and this document already records one address
   it does not apply to: **Anthony's own user is un-scrambled in both orgs**, so a qualifying order
   whose Opportunity Owner is Anthony sends him a real email from a sandbox, today. Treat "sandboxes
   can't send" as false; the accurate statement is "most sandbox addresses are invalid."
2. 🚩 **`Opp_Owner_Email__c` holds UN-scrambled, real, live addresses inside the sandbox** —
   it is a pre-refresh copy of production data, and a custom field's data is not scrambled.
   **A flow that sends to it from staging emails real staff from a sandbox.** This is a second,
   independent reason to abandon that field, on top of it being empty 95% of the time.

📌 In **production** the formula returns the real live address, which is the point. The
`.invalid` behaviour exists only in sandboxes.

✅ **TEST USER: nothing to de-scramble — Anthony's user is already clean in BOTH orgs.**
Checked 2026-09-08:

| Org | User | Username | Email | Active |
|---|---|---|---|---|
| dev2 | Anthony Martinez `005ca00000BhcA9AAJ` | `anthony@cultureapparel.com.dev2` | `anthony@cultureapparel.com` | ✅ |
| staging | Anthony Martinez `005ca00000B0aWtAAJ` | `anthony@cultureapparel.com` | `anthony@cultureapparel.com` | ✅ |

📌 Note staging's **username has no sandbox suffix** while dev2's does. Username and Email are
separate fields; only Email matters for delivery, and only Email gets the `.invalid` treatment.

✅ **Email Deliverability is `All email` in BOTH orgs** (Setup -> Email -> Deliverability),
checked the same day. A refreshed sandbox normally reverts to **System email only**, which
silently swallows every flow email regardless of address. **Check this first after any
refresh** — it looks exactly like a broken flow.

**Orders that will actually route to Anthony** (`Opportunity_Owner_Email__c` = his address):
dev2 **80 of 81**; staging **26**, none of which have `Misprint_Outcome__c` set yet, so all 26
are eligible test candidates. Any order whose Opportunity is owned by someone else still
resolves to a `.invalid` address and will deliver nothing — pick the test order by its
**Opportunity owner**, not by convenience.

---

✅ **DONE 2026-09-08 in dev2 AND staging — flows still INACTIVE.** The Decision was inverted
rather than rebuilt, which was the smallest safe change:

```
Decision  "AM Email On Order"
        Outcome "No AM Email"  (API: No_AM_Email)
              {!$Record.Opportunity_Owner_Email__c}  Is Null = True
          -> Create Records "Task No AM Email On Order"
                 Object   Task
                 Subject  "Misprint decision needed - no AM email on this order"
                 WhatId   {!$Record.Id}          (picker label "Related To ID")
                 OwnerId  {!$Record.OwnerId}     (picker label "Assigned To ID")
        Default Outcome   <- every order that HAS an address
          -> Action "Send Reprint Email To AM"   (core Send Email, inline subject/body)
                 Recipient Addresses = {!$Record.Opportunity_Owner_Email__c}
```

- The **Email Alert element was deleted** from both flows. The Classic template and the
  `B9_Reprint_Confirmation_to_AM` alert still EXIST in both orgs but are now **orphaned** —
  nothing references them. Delete them or leave them; they are inert either way.
- The email body now lives in **one place** (the inline Send Email), so the
  duplicated-copy problem is retired.
- Both flows saved clean, both still **Inactive**, both flowIds changed on save:
  dev2 `301ca00000To7lgAAB`, staging `301ca00000To95rAAB`.
- Verified off **fresh loads of both orgs**: outcome label/API name, the resource resolving to
  `Opportunity_Owner_Email__c`, `Is Null` / `True`, and the recipient.

⚠️ **Three things deliberately left as they are:**
1. The Send Email element's **API name is still `Send_Reprint_Email_Fallback`** — only its
   label was changed to "Send Reprint Email To AM". Renaming the API name risks the connector;
   the label is what the canvas shows. Cosmetic mismatch, recorded so it does not confuse.
2. The Task's **`WhatId` assumes Order supports activities.** Not proven — if Orders do not
   have activities enabled, this element faults at runtime. Confirm on the first debug run.
3. The condition is **`Is Null`**, not `Is Blank`. The SOQL evidence says the empty case is a
   true null (COUNT gave 2163 of 2164), so this is right for the data as it stands, but a
   formula returning `''` rather than null would slip through to the email branch.

📌 dev2's numbers are directionally right but not representative — every Opportunity in it is
owned by Anthony, so its 100% is one user, not a healthy distribution. **Staging is the org to
judge coverage from.** Production has not been counted; do that before the production rollout.

---

**Salesforce, in order:**

1. ~~Pick the recipient field~~ ⚠️ **PICKED, THEN DISPROVED.** Built as `Opp_Owner_Email__c`
   via Email Alert with the `Opportunity_Owner_Email__c` formula as fallback — the populate
   check showed the two are backwards. The formula is the field with the data. See item 5.
2. **Approve / Decline mechanism** on the Order, stamping outcome + by + at + notes. **Shape
   not decided** (screen flow from the record page vs. two Quick Actions vs. a link that runs
   a flow). This is the piece the email's link points at, so it comes before the email.
3. ~~Rename the audit trio~~ ✅ **DONE 2026-09-08 in dev2 AND staging**, verified off fresh
   loads of each org's Order field list. Labels and API names both moved; data types survived
   (Lookup(User) / Date/Time / Text Area(255)).
   - ⚠️ **Still owed: the field Descriptions.** All three still cite the deleted
     `Reprint_Decision__c` / `Reprint_Decision_By__c`. Harmless to the runtime, misleading to
     the next reader. Fix when something next edits these fields.
4. ~~Email alert + template + Action element~~ ✅ **DONE in dev2 and staging, flows still
   INACTIVE.** What is left on the email is verification, not building:
   - ~~Populate check~~ ✅ **DONE 2026-09-08 — and it says the primary branch is dead.**
     See "🚩 POPULATE CHECK" below. The Email Alert's recipient field is empty on 0/81 dev2
     orders and 101/2164 staging completed orders; the formula fallback covers 2163/2164.
     **The Decision should be inverted before activation.**
   - **The template's copy is duplicated in the fallback action.** Edit both or they drift.
   - **Decide the From address** — currently the running user, not an Org-Wide Address.
5. ~~Invert the email Decision before activating~~ ✅ **DONE 2026-09-08 in both sandboxes**,
   flows still INACTIVE. See the populate-check section for the shape as built and the three
   caveats (Send Email API name, Task WhatId, Is Null vs Is Blank).
6. **Decide `Credit/Refund`.** The 2023 value was superseded by separate `Refund` and `Credit`
   (2024) and never deactivated — three of the five values now overlap. Cosmetic until an AM
   is choosing from that list; then it is a real confusion.

**Then the code half** (Claude Code): stop `createReworkIfNeeded` creating the reprint on
completion, and instead create it only when the outcome becomes `Reprint`. Nothing above goes
live until this ships.

**Then production, at E7.4** — it has **none** of B9, and critically **not the guard either**.
The guard must land and be activated there BEFORE anything that writes `Awaiting AM`.

##### 🚩 CORRECTION — B9's recipient field is the wrong half of a same-label collision

This story has said throughout that the AM is "already on the Order as
`Opportunity_Owner_Email__c`". **That field cannot be an email alert recipient.** Order has
three candidates, and the two named "Opportunity Owner Email" are a textbook instance of the
same-label collision rule below:

| Label | API name | Type | Usable as an Email Alert recipient? |
|---|---|---|---|
| Opportunity Owner Email | `Opportunity_Owner_Email__c` | **Formula (Text)** | ❌ no — alerts need a real Email field |
| Opportunity Owner Email | `Opp_Owner_Email__c` | **Email** | ✅ yes |
| Opportunity Owner | `Opportunity_Owner__c` | **Lookup(User)** | ✅ yes, as a related user — and it also yields the User Id |

**The formula reads (dev2 `00NRi000003hbQn`):**

```
Opportunity.Owner.Email
```

Two consequences, both important:

- **It is clean.** A plain cross-object formula, no `HYPERLINK()`. Trap 6 does **not** bite
  here — it returns a bare address, so it is fine as *text* even though an Email Alert will
  not take it.
- **It bypasses the lookup.** It reads `Opportunity.Owner`, **not** `Opportunity_Owner__r`.
  So `Opportunity_Owner__c` and `Opp_Owner_Email__c` are both **stored copies** that something
  must keep in sync, and the formula does not depend on either. The formula is the only one of
  the three that cannot go stale.

✅ **DECIDED 2026-09-08 — Anthony chose the Email Alert to `Opportunity_Owner__c` (Lookup(User),
recipient type "related user").** Reasons: it matches how the org already notifies
(`MisprintOrderNotifyManager` / `MisprintOrderNotifyPrintShop` are alert-style actions), it
follows the person's User record so their address is current even if the lookup row is old,
and it yields a User Id to stamp into the decided-by field.

⚠️ **THE RISK THAT COMES WITH THAT CHOICE, AND HOW IT FAILS.** `Opportunity_Owner__c` is a
copy, and nothing in the schema guarantees it is populated on every order — the formula
certainly does not read it. **If the lookup is blank, the alert simply does not send: no
error, no retry, and the order sits in `Awaiting AM` forever with nobody asked.** Two
consequences to build in:

1. **Verify population before activating**, in both orgs and again in production: how many
   Orders have `Opportunity_Owner__c` blank, and does it agree with `Opportunity.Owner`?
2. **Consider a fallback.** The cheapest is a second recipient on the alert, or a Decision in
   the flow that routes to a Send Email on `{!$Record.Opportunity_Owner_Email__c}` (the
   never-stale formula) when the lookup is empty. Not built; flagged.

🚩 **THE SEQUENCING HAZARD — still live.** The app creates the reprint automatically the
moment the last method completes (`createReworkIfNeeded`, from `production-methods/[id].js:290`
and `run-results/index.js:525`). Until the code half stops that, **the AM would be asked to
approve a reprint that already exists** — the gate is theatre, and a decline leaves a real
order on the books. Everything built so far is inert, which is why it was safe to build first.
**The email is the switch, and it stays off.**

##### 🚩 A THIRD same-label collision, and a standing rule

| API name | Type | |
|---|---|---|
| `TotalQtyMisprints__c` | Number(5,0), writable | **the one the app SELECTs** |
| `Total_Quantity_Misprints__c` | Formula (Number) | a second, derived one |

Three duplicate/near-duplicate pairs found in this org in two days —
`Receiving_Status__c`/`ReceivingStatus__c`, `Opportunity_Owner_Email__c`/`Opp_Owner_Email__c`,
and this. 📌 **Standing rule: an ambiguous field label in this org is a warning sign. Check
the API name before binding anything — a flow, a formula, or a SELECT — to it.**

##### 🪤 TRAP — `origin/main` is a LOCAL ref, and on this machine it is stale by days

**Cost a wrong answer on 2026-09-09.** `git cat-file -p origin/main:<file>` works fine on this repo
even while `git diff` bus-errors, so it is tempting as a way to ask "is this story deployed?" **It
answers a different question.** `origin/main` is a remote-TRACKING ref: it says what `main` looked
like at the last successful `git fetch`. `.git/FETCH_HEAD` here is dated **2026-09-03**, and Anthony
pushes through the GitHub web UI from a browser — which never updates this clone. So the local
`origin/main` sat days behind the real branch.

🚩 **What that produced:** a session reported B10, E2.6 and the B9 reporting half as "not on main",
and B8 as "half-landed — board half deployed, server half not, so the badge silently renders
nothing." **All of it was wrong. Every one of those was live.** Measured against the deployed site
minutes later: `tokens.css` serves `--method-sp`, `index.html` serves 10 `runsInOrder` call sites
(the E2.6 fix), and `/api/production-orders` returns `RunsTotal`/`RunsRemaining` on **90** methods.

📌 **This is §1's own rule — *verify against the deployed artifact, not the repo* — failing in a new
disguise, because the repo answer LOOKED like a measurement.** `git cat-file` gave real bytes off a
real object; they were simply the wrong week's bytes.

**The reliable checks, in order of preference:**

1. **Fetch the deployed asset.** `fetch('https://culture-apparel-preprod.pages.dev/<file>?cb=' + Date.now())`
   and count a marker string. Cache-bust, and remember `ca-api.js` and `tokens.css` are served
   straight from the repo root.
2. **Hit the endpoint** and look at the shape of what comes back — that is the only way to check
   server-side code at all.
3. `git fetch` **first** if you are going to trust `origin/main`. On this mount that may bus-error,
   in which case fall back to 1 and 2 rather than trusting the stale ref.

⚠️ **`git cat-file -p origin/main:<path>` is still the best tool for reading a file's committed
history when the network is unavailable — just never as evidence of what is DEPLOYED.**

##### 📌 iCloud eviction, and how to get out of it

On 2026-09-08 this file became unreadable to every shell tool for ~30 minutes:
`Resource deadlock avoided` on plain `head`/`cat`. **Cause: iCloud had evicted it** — a
directory listing showed `cloudOnly: true`, i.e. the file is dataless on disk. It is not a
lock and waiting does not fix it. **Fix: stage the file** (which forces iCloud to hydrate it);
the shell can read it immediately after.

⚠️ **It hits `node tools/smoke.mjs` too.** With the repo evicted, node fails reading its own
source with `Unknown system error -35` (EDEADLK) before a single check runs — so a smoke
failure in this state says nothing about the code. **Hydrate the repo before trusting or
debugging a smoke run**, and do not "fix" a check that is only failing because its file is
dataless. Worth knowing because §2 already warns that git
writes on this mount are unreliable — this is the same mount pathology reaching plain reads.

🚩 **MEASURED 2026-09-09: 688 files inside `.git` are evicted, and that is the whole explanation for
"git writes are unreliable".** Counted by attempting a 1-byte read of every file under `.git` and
collecting the failures. Two things follow, and the second one is the useful one:

- **Zero working-tree source files were evicted.** Reading, grepping and editing the code is
  unaffected. It is only *history* operations that break — `git rev-list`, `git merge-base`,
  `git log <range>` and anything else that walks the object graph, all with **Bus error** rather
  than a message that names a file.
- 🪤 **An evicted ref file reports as a CORRUPT ref, and it is not one.**
  `warning: ignoring broken ref refs/heads/<name>` is what git says about a 41-byte ref file it
  cannot read. `feat/b9-optin-reprint` and `feat/method-colours` were listed in §7 as "two broken
  git refs, both unresolved" on that basis. They were fine — hydrating the two files brought both
  branches straight back, pointing at commits that were already in the current branch's history.
  📌 **On this mount, read `ignoring broken ref` as *evicted*, not *lost*. Hydrate before concluding
  anything about it.**

🎯 **2026-09-11 — THE ORDER TO HYDRATE IN. Stage `.git/objects/pack/*` FIRST; it is worth more than
every other file combined.** Committing B22 hit the bus errors above, and this time the cause was
pinned down rather than worked around. **Git mmaps every pack `.idx` on essentially any object
lookup, so ONE dataless pack file makes almost every git command SIGBUS** — including commands that
have nothing to do with the packed objects. `git hash-object -w` on a single working-tree file
crashed. After staging the **six** files in `.git/objects/pack/` it worked immediately, and so did
`git add`, `git write-tree`, `git commit-tree` and `git update-ref`. **Six files, not 688.**

Working order, cheapest first — stop as soon as the command you need works:

1. `.git/objects/pack/*` — **all of them** (.idx, .pack, .rev). This is the big one.
2. `.git/HEAD`, `.git/config`, `.git/index`, `.git/packed-refs`, `.git/info/exclude`.
   🚩 A dataless `.git/info/exclude` fails with a *different* message —
   `fatal: cannot use .git/info/exclude as an exclude file` — which reads like a config problem and
   is not one.
3. The one ref in `.git/HEAD`, e.g. `.git/refs/heads/<branch>`, plus `.git/logs/HEAD` if you want
   reflog writes to stop erroring.
4. The specific commit object you are parenting onto (`.git/objects/<2>/<38>`). `commit-tree` reads
   its parent, so this is the last thing that blocks a commit.

⚠️ **`git status`, `git diff` and `git ls-tree -r` may STILL crash after all that, and it does not
matter.** They walk into old blobs and trees that are still evicted. **Do not read a crash in those
as the commit having failed** — verify instead with the cheap check that only touches new objects:
`git rev-parse HEAD:<path>` against `git hash-object <path>` for each file you changed. All three
matched for B22 and the commit was sound.

🚩 **This mount also forbids `unlink`, which git does not expect.** Every `git add` /
`write-tree` leaves a `.git/objects/**/tmp_obj_*` behind (`warning: unable to unlink … Operation not
permitted`), and a crashed git leaves an `index.lock` that **cannot be removed** — the next git
command then refuses with *"Another git process seems to be running"*. **`mv` works where `rm` does
not**, so rename the lock aside (`mv .git/index.lock .git/index.lock.stale-$(date +%s)`) rather than
hunting for a process that does not exist. The session that committed B22 left **4** stale locks and
**25** `tmp_obj_*` files this way; they are inert, and `git gc --prune=now` clears them.

📌 **The hydration trick is the same one that works on a document: get the file staged/copied through
macOS rather than read through the shell.** And the permanent fix is still the one §1 names — move
the repo out of the iCloud-synced Desktop folder. Every symptom in this subsection stops at that
point; none of them stop before it.

##### ⛔ Decisions Anthony has to make before this is buildable

1. **Is "account manager" `Account.OwnerId`?** If not, name the field — it does not exist
   yet.
2. **Where does the decision get made** — a page in this app behind a one-time token, or a
   record in Salesforce with two buttons? This decides whether there is any app work at all.
3. **Where does the pending decision live before it is answered?** Either the reprint Order
   is created immediately in a pending state and confirmation activates it, or nothing is
   created and the intent is held somewhere else. The first keeps `_rework.js` almost
   unchanged but puts an order on the books the customer has not agreed to; the second
   keeps the books clean but needs a new place to hold the intent and the token.
4. **What happens on decline, and on silence?** Does a declined reprint close the loop for
   good, can it be reopened, and does anything chase an AM who has not answered?

📌 **Sequencing.** None of this is urgent relative to Phase A — E7.2 is still the long pole
and this adds a second org-side dependency (email) on top of it. It is written here so the
design argument happens once, in writing, rather than three times in a row.

##### B11 · A submit whose counts Salesforce rejected still marks the run Submitted

**✅ FIXED 2026-09-09**, branch `fix/b11-composite-status`, commit `81b67ec`,
`functions/api/run-results/index.js` +30/−3. ⚠️ **Unpushed.** `node tools/smoke.mjs` passes all 7.

**It was found by reading the code, then REPRODUCED before it was fixed** — the order this project
asks for. The reading is below; the measurement is at the end of this section.

`run-results/index.js:566-602` is a private `composite()`. It parses the body, walks
`compositeResponse` entry by entry, prefers the first non-`PROCESSING_HALTED` failure — all of trap
3, correctly. **What it never does is read `resp.ok`.**

```js
const resp = await sfFetch(env, `/services/data/${v}/composite`, {...});
let data = null;
try { data = await resp.json(); } catch { return { ok:false, detail:`unparseable response (${resp.status})` }; }
const subs = Array.isArray(data.compositeResponse) ? data.compositeResponse : [];
```

When `/composite` **itself** answers 4xx or 5xx — a malformed request, a refused token, a governor
limit, a 500 — the body is a top-level *array of errors*, not an object with `compositeResponse`. So
`subs` is `[]`, the failure loop never runs, `failures.length` is 0, and the function returns
`{ ok: true }`.

**Where that lands.** `:449-461` chunks the line-item PATCHes at 25 and checks `res.ok` on each; a
false `ok:true` sails through. `:464-476` then PATCHes the run:

```js
const runPayload = { Result_Status__c: RESULT_SUBMITTED, Result_Recorded_At__c: ... };
```

🚩 **Why this is worse here than the same bug would be anywhere else in the app.** D1 makes a perfect
run and an untouched run byte-identical on purpose — there is no produced field, only problems are
recorded. That design has exactly one load-bearing consequence, stated in D1 and in this file's §3:
**`Result_Status__c` is the only evidence a human counted.** This defect manufactures that evidence
over counts that were rejected. Downstream, gate 2 of `createReworkIfNeeded` ("every run Submitted")
passes, gate 4 ("some line carrying misprint or damaged > 0") sees blanks, and the order returns
`nothing_to_rework`. **A damaged order silently produces no reprint, and the board says it was
counted.** There is no screen anywhere that can tell you otherwise.

📌 **This is drift, not a deliberate difference.** §2 records that `_rework.js`, `run-results` and
`run-line-items` carry their own older composite copies, that they work, and that they are
deliberately left alone. That is true of the other two:

- `_composite.js:126` — `if (!resp.ok || real)`, directly under `// Trap 2: resp.ok alone proves nothing.`
- `run-line-items/index.js:452` — `if (!resp.ok || realFailure)`, and it logs `resp.status` too.

So "leave the old copies alone" was sound advice about copies that were correct. This one is not,
and the trap it misses is the trap §2 opens with.

**The fix.** One line, matching `run-line-items`:

```js
if (!resp.ok || failures.length) { ... }
```

…and log `resp.status` with the body, because today a rejected composite leaves nothing at all in
the Pages log.

⚠️ **Also worth knowing while you are in there:** if the body is literally `null`,
`data.compositeResponse` throws at `:581` and the outer handler returns 500. That one fails loudly
and is fine — do not "fix" it into silence.

##### ✅ How it was measured — 2026-09-09

A harness outside the repo stubs `globalThis.fetch` and imports **the real
`functions/api/run-results/index.js`**, so the shipped handler runs against a fake Salesforce. No
copy of the function was tested — trap: `_sf.js`'s `sfFetch` and `getSalesforceToken` both go through
global `fetch`, which is what makes the whole endpoint drivable without wrangler, KV or credentials.

| Scenario | Before the fix | After |
|---|---|---|
| `/composite` **refuses the batch** — HTTP 400, body a top-level error array, no `compositeResponse` | **HTTP 200, run PATCHed to `Submitted`** 🔴 | HTTP 502 `line_write_failed`, run left `Draft`, status + body logged ✅ |
| control — happy path, 200 with every sub-request 204 | 200, stamped | 200, stamped — **unchanged** ✅ |
| control — 200 with one sub-request failing 400 | 502, not stamped, names the real error | identical, and now also logged ✅ |

🪤 **THE FIRST VERSION OF THIS HARNESS PRODUCED A GREEN "REPRODUCED" THAT MEANT NOTHING, and it is
worth recording because it is this project's own rule biting the person applying it.** The payload
sent `misprint` where `COUNT_FIELDS` expects **`misprintQty`**, so no field updates were built,
`parsed` was empty, the chunk loop ran zero times and **`/composite` was never called at all.** All
three scenarios then returned 200 and looked consistent, and the verdict line cheerfully said
"B11 REPRODUCED". 📌 **The fix was to assert the thing the test depends on, not just the outcome:**
the harness now fails hard if `/composite` was not called. **"A green board is not a passing test"
applies to test harnesses too — assert that the code under test actually ran.**

⛔ **Still owed: the dev2 pass.** Everything above is a fake Salesforce. Nothing here proves what the
real org does with a refused composite, only what this endpoint does when it gets one.

---

##### B12 · The production board's OrderItem fetch is an unbounded IN list on an unbounded query

**Found 2026-09-09 by reading the code. ⚠️ NOT reproduced — but the arithmetic below uses this
file's own measured order counts, so the "is it already firing" question is answerable with one
query rather than a guess.**

Two facts, ninety lines apart in the same file.

`production-orders/index.js:126-133`:

```
WHERE (Status__c IN (...) OR Order__r.Status = 'Complete') AND Order__c != null
```

> *"this is the one query in the whole app with no date bound (it deliberately pulls in every
> Completed order ever, see the comment above), so it's the most likely of the bunch to eventually
> exceed one query batch as history accumulates."*

`production-orders/index.js:221-225`:

```js
const quoted = orderIds.map((oid) => `'${oid}'`).join(",");
const soqlItems = `SELECT OrderId, ... FROM OrderItem WHERE OrderId IN (${quoted})`;
```

The comment worried about the wrong ceiling. `runQuery` follows `nextRecordsUrl`, so the batch limit
is handled — but the **IN list built from that result set is not chunked at all**, and an over-long
IN list is an HTTP-level rejection of a request that never became a query. E5.12 is the precedent and
its lesson was exactly this: *"an over-long URL is an HTTP rejection, not a SOQL error, so the whole
block fell into its `catch` and the calendar rendered with no runs and no explanation."*

**Then it fails open.** `:236-240` catches and `console.error`s. The response is a 200, the chip
stays green, and every card on the Production board silently loses its size and quantity breakdown —
the numbers a manager reads to decide what to schedule.

⛔ **This is probably not a future problem. Check staging first.**

| Org | Orders in the `IN` list, order of magnitude | Approx query URL |
|---|---|---|
| dev2 | 81 orders total | ~2KB — nowhere near |
| **staging** | **2,164** at `Order_Substatus__c = 'Completed'` alone (§4, B9 populate check) | **~45KB** |

`SOQL_IN_CHUNK` is 200 for a reason `_sf.js` spells out: *"200 x 18 chars plus quoting and commas is
about 4KB of query, comfortably inside the limit."* Staging is an order of magnitude past that.
🚩 **E7.5 put production's credentials in place ahead of E7.4, so staging and production are both
switchable destinations today** — this is not a sandbox curiosity.

📌 **The fix is already imported into this file.** `runChunkedIdQuery` comes in at `:36` and is used
60 lines below at `:284` for B8's run counts, with a comment saying why. The OrderItem block just
predates it.

**The same shape, elsewhere, in rough order of exposure:**

| File | Line | Bound by |
|---|---|---|
| `_mockup.js` | 34-38 | whichever caller's list is largest — and **this endpoint is one of its callers**, so it inherits the problem above |
| `orders/index.js` | 209-213 | Pre-Production orders (small, but unbounded in principle) |
| `shipping-orders/index.js` | 117-118 | Post-Production orders; fails open |
| `shortfalls/index.js` | 90, 106, 116 | fails closed with a 502 — louder, still wrong |
| `shipments/split.js` | 131-132 | `allItemIds` uncapped; the *groups* are capped at 25 but items per group are not |
| `run-results/index.js` | 227, 239 | capped at 200 by `LIST_LIMIT`, i.e. exactly `SOQL_IN_CHUNK` — **safe today, breaks silently the day `LIST_LIMIT` is raised** |

**Verifying it.** Point the deployment at staging and load the production board with the network tab
open. If the OrderItem query is already failing you will see it in the Pages log as an HTTP error
from `_sf.js`, and every card will show a piece count with no size breakdown. Then compare one card's
sizes against the order in Salesforce. **Do not check whether the board renders** — it renders either
way, which is the defect.

---

##### B13 · A failed run query makes the calendar say the shop is empty, then offer to fill it

**Found 2026-09-09 by reading the code. ⚠️ NOT reproduced against dev2.**

`calendar/index.js:360-385` fetches runs in two halves — a date-range query and a chunked
by-method query — and tracks `runsOk` across both. On failure of either:

```js
} else {
  console.error("Calendar run fetch failed", runsResult.status);
}
```

…and execution continues into the scheduling loop. Three things follow, in the same HTTP 200:

1. Every order carries `ProductionRuns: []`.
2. `o.needsScheduling = o.ProductionRuns.length === 0` (`:456`) — **true for every order in the shop.**
3. `busyByPress` is empty, so `suggestSlot()` (`:459-500`) hands every order a suggested window
   computed against **zero press occupancy**, and reserves them against each other so they even look
   internally consistent.

The response (`:700-724`) reports `unscheduled: orders.length` and carries **no flag anywhere saying
runs are unknown**.

🚩 **What a manager sees, and why the amber chip does not save them.** This is not demo mode. The
fetch succeeded, the board is live, the chip is green. The screen says the whole week is unscheduled
and proposes a slot for every job. Dragging those suggestions into place is one click each and it
**creates duplicate runs on top of runs that already exist** — on the one screen used to fix
scheduling. §1's rule is "a green board is not a passing test"; this is the same failure one layer
down, where the board is not even in demo mode to warn you.

The press fetch at `:315-333` has the identical shape: on failure `presses = []` and every order gets
`{noPresses: true}` rather than an error.

📌 **The convention this file is missing exists in three sibling endpoints already:**

| Endpoint | Flag | What it says |
|---|---|---|
| `inbox/index.js:322` | `reprintsUnavailable` | the reprint sweep could not run |
| `inbox/index.js:87` | `OrderItemsError` | an empty breakdown is not an order with no garments |
| `production-runs/index.js` | `locationAvailable` | this org may not have `Print_Location__c` |
| `production-orders/index.js:277-280` | *(omits the field)* | run counts are absent, never `0` — B8's "unknown ≠ zero", and it says so |

B8 already established the rule for exactly this data: **"Unknown ≠ zero: a failed count query leaves
the fields absent and the card shows nothing, never '0 left'."** The calendar needs the same rule one
level up: unknown runs must not render as *no* runs.

**The fix.** Carry `runsUnavailable: true` in the response when `runsOk` is false, and when it is set:
suppress `needsScheduling`, emit no `suggestion`, and let `calendar.html` say *"Could not load runs —
this view is incomplete"* instead of "Everything in this window has a run scheduled." ⚠️ **The client
half is required, not optional** — a flag nothing reads changes nothing.

📌 **While you are in `calendar.html`, two related things:** the unscheduled queue already asserts
emptiness before its first fetch returns (`:2192`, `queueEmpty: queue.length===0`, where `visible()`
returns `[]` while `state.data` is null) — E4.5 fixed the label two lines above it at `:2184` and
stopped short of the panel. And `calendar.html` is the only board that never calls
`listState()`/`listNotice()` at all.

---

##### B14 · The counting screen cannot show its own load-failure message

**Found 2026-09-09 by reading the code, and the nesting was verified by counting `sc-if` depth
rather than by eye.**

`counting.html:482-484`:

```js
}catch(e){
  this.setState({ runLoading:false, err:'Could not load this run — check the connection and try again.' });
}
```

`detail` stays null. Then `:983`:

```js
runReady: !!d && !st.runLoading && !st.result,
```

And the banner that renders `{{err}}` is at `:293` — **inside** `<sc-if value="{{runReady}}">`, which
opens at `:178` and closes at `:298`. Measured: at line 293 the nesting depth inside that block is 2.

So on a failed load: `d` is null → `runReady` false; `runLoading` false; `showResult` false. The
`showRun` wrapper still renders, so the operator gets the **"All Runs" back button over an empty
page** and no indication that anything went wrong.

⚠️ **The banner is not dead in general** — and that is why this survived. It renders correctly for the
other two `err` setters, the submit failure at `:604` and the demo-mode refusal at `:525`, because
both happen with `detail` already loaded. It is dead **only** for the load failure. That is the
`?runId=` deep-link path: the one E1.4 sends every operator down on every timer stop (D10), and what a
shop tablet does when it wakes from sleep mid-count.

The catch also throws `e` away entirely — no status, no `errText()`, not even a `console.error`, so
there is nothing in the network tab's neighbourhood to find either.

**The fix.** Move the error banner out of the `runReady` block to sit beside the `runLoading` block
as a sibling, gated on `hasErr` alone. Keep `e`: `err: 'Could not load this run — ' + api.errText(e)`,
and `console.error` it. 📌 `errText()` exists precisely for this and is already used at `:602` in the
same file, twelve lines from the submit path that does it right.

**Verifying it.** Open `counting.html?runId=<a real run>` with `/api/run-results` forced to 500.
Before: a back button and blank space. After: the red banner, naming what Salesforce said.

---

##### B15 · Marking an order Complete in demo mode looks exactly like marking it complete

**Found 2026-09-09 by reading the code.**

`shipping.html:820-828`:

```js
completeOrder(order){
  if(!window.confirm('Mark ' + ... + ' complete? It will drop off this board.')) return;
  ...
  const finish=()=>{ this.clearPoll(); this.setState(st=>({ orders: st.orders.filter(o=>o.Id!==order.Id), modalId:null })); };
  if(!this._api || this.state.connection!=='live'){ finish(); return; }
```

The manager confirms. The card leaves the board. The modal closes. Nothing is written and nothing is
said — and the visible result is **identical** to the successful path, which calls the same `finish()`.

📌 `canWriteNow()` and `writeFailed()` are defined in this same file at `:668-677`, and
`setLabelPrinted` — nine lines below — uses them properly. The board's most consequential action does
not.

⚠️ **Severity, stated straight.** In demo mode the orders are demo orders, so nothing real is lost the
moment it happens. The exposure is the case demo mode exists to warn about: a board that has **quietly
dropped to demo** because a query started failing. The shipping desk then marks orders complete for an
afternoon, every one of them lands nowhere, and the only signal was an amber chip in the header that
the same person has been ignoring all day precisely because the board kept working. E4.1 is about
recovering from demo mode; E4.3 was about never showing a save that did not happen. This is the one
path E4.3 did not sweep.

**The fix.** `if(!this.canWriteNow('Marking the order complete')) return;` before `finish()`, and do
not mutate local state when the write was refused. `deleteShipmentEntry` (`:709-713`) has the same
shape and should follow — it only touches `_demoShipments`, so it is cosmetic by comparison, but it is
the same two lines.

📌 **Two neighbours worth fixing in the same pass, both cheap:**
- `shipping.html:846` — the board's search builds its haystack from **raw** `GOA_Order_Number__c` and
  `Customer_Order_Name__c`, while `mk()` twenty lines below correctly puts both through `api.text()`
  and carries a comment explaining why. That is trap 6: typing `href`, `_self` or `801` matches every
  card on the board. `counting.html:661-666` does it right.
- `shipping.html:183` / `:936-939` — the drawer warns *"this order ships together with Order X. Print
  the label from that order instead"*, but Ship Now's only `disabled` binding is `modal.shipBusy`. A
  banner is not a guard. ⚠️ Whether the server refuses it is **unchecked** — worth confirming in
  `shipments/combine.js` before deciding how hard to gate the button.

---

##### B16 · Mockup adoption looks the record up by the wrong URL

**Found 2026-09-09 by reading the code. ⚠️ NOT measured against dev2 — and B1's census is the
measurement that settles it, see below.**

`mockup-proxy/index.js` follows redirects manually, at most `MAX_REDIRECTS` hops, re-validating each
one — which is right and is why `redirect: "follow"` was rejected. The variable it walks with is
`current`:

```js
let current = parsed;          // :220, where parsed = new URL(raw)
...
current = next;                // :246, on every hop
...
const adopting = adoptMockup(env, current.toString(), bytes, contentType)   // :277
```

And `adoptMockup` finds the record by **exact match on that string** (`_mockup-adopt.js:113-116`):

```sql
SELECT Id, Mockup_URL__c FROM Design__c WHERE Mockup_URL__c = <the url> LIMIT 5
```

But `Design__c.Mockup_URL__c` holds **`raw`** — the URL somebody pasted. After even one redirect hop
the two are different strings, the query returns nothing, `targets` is empty, and adoption returns
`no_adoptable_design`. **Forever.** The next request takes branch B again, fetches the image again,
and tries to adopt against the same wrong key again.

Two ways to miss, not one:

1. **Any redirect.** A pasted CDN or image-host link 301ing to its canonical form is ordinary.
2. **Normalization, with no redirect at all.** `new URL(raw).toString()` lowercases the host,
   percent-encodes, and can add a trailing slash. A pasted URL with an uppercase host or a stray
   space does not survive the round trip byte-identical.

📌 **Nothing surfaces any of this.** `reason` is logged, not returned; the image renders correctly
every time; the only symptom is a number that stops moving.

✅ **This does not contradict B1, and B1 is not wrong.** Adopted really did go 0 → 39 — most direct
image URLs do not redirect, so most of dev2's mockups adopted on first view. What this adds is a
**third category to what B1 calls "the permanent floor"**, alongside "nobody has opened it" and "the
original link is dead": **hosts that redirect**, which will never adopt no matter how many times
someone opens the card.

🔧 **The check is already written into B1** — *"Re-check the census in a few days: it should keep
falling and must never rise."* If it has stalled somewhere above 16, this is why. Run the census, then
compare the still-blocked orders' `Mockup_URL__c` against what the proxy actually fetched.

**The fix.** Pass `raw` — it is in scope at `:277`, declared at `:179`. Keep `current` for the fetch,
the size checks and the logs, which are all about what was really retrieved. ⚠️ **Do not "fix" this by
storing the redirect target instead**; the pasted URL is the key the record is found by, and rewriting
`Mockup_URL__c` to a redirect target would break the idempotency rule `_mockup-adopt.js` is built on.

---

##### B17 · A failed checklist query is indistinguishable from "there was nothing to roll up"

**Found 2026-09-09 by reading the code.**

`_ppi-checklist.js` calls `runQuery` four times and destructures `{ records }` every time, dropping
`ok`:

| Line | Call | What a failure becomes |
|---|---|---|
| `:109` | items of a type on a method (forward cascade) | `items.length === 0` → `continue`. **No log at all.** |
| `:144` | the item's own type + parent method | `rec1` undefined → `return null`, same as "item not found" |
| `:160` | sibling items, sub-status pipeline | `every()` over whatever came back |
| `:177` | sibling items, Status-only types | `every()` over whatever came back |

`runQuery` (`_sf.js:282-312`) is explicit that a mid-pagination failure returns
`{ok:false, records:<what was collected>}` — it keeps page 1 deliberately, so a caller *can* serve
partial data, and the contract is that the caller reads `ok` to decide.

⚠️ **Two halves, and only one of them is real. Saying which is the point.**

- **The `every()`-over-a-partial-page half is theoretical.** It needs more than 2000
  `Pre_Production_Item__c` rows of one type on one method. That will not happen. Recording it anyway
  because the pattern is wrong and will be copied.
- **The silent-skip half is real and routine.** Any transient failure on the query at `:109` or `:160`
  means the rollup does not happen, and at `:109` there is not even a `console.error` to find
  afterwards. The fields it writes are `Screens_Completed__c` / `Inks_Mixed__c` and their siblings —
  the prerequisite ticks that say a job is ready for the press. A tick that silently fails to update
  leaves the board asserting the previous state as fact.

📌 This is the "failures must not look like success" convention, broken in the quietest available way.
`_rework.js` is the model the file cites for it: a named `reason` and a `detail` carrying Salesforce's
own errorCode.

**The fix.** Read `ok` at all four sites. On `!ok`: `console.error` with the status, and return `null`
rather than writing a computed boolean. ⚠️ **Do not make it throw** — these are rollups, and §2's rule
is that a rollup must never fail the caller's own write. The difference between "did not run" and
"ran and found nothing" needs to reach the log, not the response.

**Verifying it.** Unit-level: stub `runQuery` to return `{ok:false, records:[]}` and assert that
`rollupItemToMethod` writes nothing and logs. There is no browser step here — the visible symptom is
the absence of a change, which is exactly why it needs a log rather than a screen.

---

##### B18 · `run-line-items` compares Salesforce Ids on 18 characters

**Found 2026-09-09 by reading the code. Low priority, and the reason is stated below rather than
implied.**

`SF_ID` is `^[a-zA-Z0-9]{15,18}$` — 15 **or** 18 — and Salesforce matches `WHERE Id = '<15-char>'`
happily while always *returning* the 18-char form. So a 15-char `runId` passes validation, matches in
SOQL, and then fails every in-memory comparison in the file:

- `:253` — `lines.filter((l) => l.ProductionRun__c === runId)` → `mine` is empty
- `:344-346` — `byId` is keyed on 18-char Ids → every row is `line_not_found`
- `:376` — `line.ProductionRun__c !== runId` → `line_on_other_run` 409

The GET failure is the nastier one: `mine` empty **and** `allocationByOrderProduct(lines, runId)`
excluding nothing, so this run's own rows get counted as allocated *elsewhere*. The grid then reads
"nothing allocated on this run, all of it allocated on other runs" — a coherent, plausible, entirely
false picture of the allocation, on the screen a manager edits allocations from.

📌 **The convention exists and the sibling file follows it.** `run-results/index.js:434-436`:

```js
// Salesforce returns 18-char Ids; a caller may hold the 15-char form.
const owns = (id) => ownIds.has(id) || [...ownIds].some((o) => o.slice(0,15) === id.slice(0,15));
```

**Why P2 and not higher:** every caller in this repo passes the 18-char form today, so nothing is
broken right now. It is a trap for the next caller, and for anyone testing by pasting an Id out of a
Salesforce URL — which is the 15-char form. **The fix is to compare on `.slice(0,15)` at all three
sites**, matching `run-results`.

---

##### B19 · `Order.Print_Date__c` writes are silently reverted, and it defeats both rollups

**Found 2026-09-09**, while diagnosing why E7.7 failed its execute test. E7.7 was the symptom; this is
the cause, and it is the larger story of the two.

**What was measured.** A plain `Database.update` — no trigger, no rollup class involved:

```apex
Database.SaveResult sr = Database.update(
    new Order(Id='801ca00000SJ1xyAAD',
              Print_Date__c=Datetime.newInstanceGmt(2026,7,31,18,15,0)), false);
// sr.isSuccess()                        -> true
// [SELECT Print_Date__c ...] same txn   -> 2026-07-31 17:30:00   (the ORIGINAL)
```

🔑 **`isSuccess()` is TRUE and the stored value is the old one.** A write the platform rejects comes
back `false` with a `Database.Error`. This one committed and was then rewritten. **That is why nothing
is logged anywhere** — there is no error to log, so `Database.update(…, false)` has nothing to report
and neither does the rollup class.

⚠️ **NOT universal — corrected in the same session, before it was written up.** The first read of this
was "the field cannot be written at all." A self-restoring probe over the 4 most recently modified
orders carrying a print date (nudge +1h, read back, put the original back only if the nudge stuck)
says otherwise:

| Order | wrote | read back | stuck? |
|---|---|---|---|
| 00013467 | 18:30 | **17:30** | ❌ reverted |
| **00013493** | 14:15 | **14:15** | ✅ **accepted** |
| 00013511 | 18:00 | **17:00** | ❌ reverted |
| 00013508 | 13:30 | **12:30** | ❌ reverted |

**3 of 4 reverted, all reporting success.** So it is **conditional automation, not a locked field**,
and 00013493 is the control that makes the condition findable. 📌 It is also **not specific to the
E7.7 order** — three different orders behave the same way, which is what makes this a real defect
rather than one bad record.

##### 🚩 Why this is bigger than E7.7

`functions/api/_print-date-rollup.js` writes **this same field, the same way**, and it is called from
every run create, edit and delete on the dashboards. Its own header explains at length why the rollup
belongs server-side. **If those writes are being reverted on the same orders, the app's print-date
rollup has been quietly not working — and nothing would ever have surfaced it**, because the endpoint
gets a 204, the helper reports `changed: true`, and the board re-reads the same stale value it had.

⛔ **UNVERIFIED and the first thing to check:** whether the app's writes are reverted too. The Apex and
the JS write the same field with the same shape, so the expectation is yes — but that is a reading,
not a measurement. **The test is cheap:** edit a run's scheduled start from `index.html` on one of the
three reverting orders, then read `Order.Print_Date__c` off the record. **Check the record, not the
board.**

##### ✅ MEASURED 2026-09-11 — the app's rollup IS defeated, it is NOT a permission, and the
##### replacement value is the field's own PRIOR value

The "UNVERIFIED and the first thing to check" above is now checked. All reads below were
**cache-busted** (`cache: 'no-store'` + a buster), because the same day established that a plain GET
through the proxy can be served stale and imitate exactly this symptom.

**1. The app's own write is reverted, on the same orders.** On `00013467`, `PATCH
/api/production-runs/a3Xca000000HNoDEAW` (a scheduled-start move, the calendar-drag path) returned
**200 `{ok:true}`**, and `rollupPrintDateFromRun` ran inside it. The rollup's own arithmetic over that
order's four runs gives **2026-07-31T18:15** (PR-0034's actual start); the order stored
**17:30**; they differ, so `rollupPrintDateToOrder`'s read-before-write **did** reach its PATCH.
Afterwards the order still read **17:30**. The run move itself landed (PR-0075 14:00 → 15:00), so the
endpoint and the auto-scheduler pin both worked — only the Order write vanished.

**2. It is NOT FLS and NOT a permission — positive control.** The obvious rival explanation is the one
`_print-date-rollup.js:104` warns about ("check the integration user has Edit on
Order.Print_Date__c"), because a rejected PATCH is logged and swallowed and looks identical from
outside. Ruled out: on **`00013493`** the *same code path* moved `Print_Date__c` **13:15 → 14:15 and
it stuck**, then **back to 13:15** when the run was restored. The integration user can write the
field, in both directions. **So the app and the Apex probe agree on which orders are affected** — this
is one conditional defect, not two.

**3. 🔑 NEW — the value it comes back as is the field's OWN PRIOR VALUE, not a recomputation.** This is
the most useful thing found today, and it changes what to hunt for.

| Order | | stored `Print_Date__c` | earliest **scheduled** | earliest **actual-or-scheduled** (what the rollup computes) |
|---|---|---|---|---|
| 00013467 | ❌ reverts | 07-31 **17:30** | 07-31 18:30 | 07-31 18:15 |
| **00013493** | ✅ **works** | 09-04 **13:15** | 09-28 13:45 | 09-04 **13:15** ✅ |
| 00013508 | ❌ reverts | 09-10 **12:30** | 09-04 19:00 | 09-04 15:15 |
| 00013511 | ❌ reverts | 09-21 **17:00** | 09-21 **17:00** | 09-08 20:00 |

**No single formula reproduces the three stored values.** "Earliest scheduled" fits 00013511 and
neither of the others; 00013508 holds PR-0105's scheduled start, which is not even its earliest; and
00013467 holds 17:30, which matches **no current run at all** — it is the start of a run that was
deleted. What all three DO have in common is that each is a perfectly plausible value the field
**used to hold**. ➡️ **Read the B19 signature literally: "reads back as its ORIGINAL value" means the
prior value is being restored, not that a rival scheduler is computing a different one.** That points
at a **before-save flow using `PRIORVALUE()`** or an `ISCHANGED`-guarded revert — not at a competing
rollup, and not at `OrderPrintDateRollup`, which recomputes and could not produce these.

**4. ❌ `Proposed_Run__c` is ruled out** as the source of the replacement value — one of the two
candidates named above. **All four orders have zero proposed-run rows**, including the three that
revert.

**5. 🔑 The drift is a fingerprint, and it costs nothing to scan for.** Every reverting order has
`Print_Date__c` out of step with what its own runs say; the control is **exactly** in step. So the
full blast radius can be measured **without writing to a single record**: compare `Order.Print_Date__c`
against `MIN(Actual_Start__c || Scheduled_Start__c)` over that order's runs, org-wide. Do that before
anything else — it turns "3 of 4 sampled" into a real number.

**6. ❌ The discriminating condition is still not found, but six candidates are eliminated.** Across
the works/reverts split these are all mixed and none of them separates 00013493 from the other three:
`Order_Substatus__c` (Completed appears on both sides), `Status`, method count (1 appears on both
sides), `Account`, `Receiving_Status__c`, and whether the order has an Opportunity (all four do).
➡️ **The remaining work is in Setup, not in the app**, and the app's API has nothing further to say.

⚠️ **Blast radius, now that (1) is confirmed.** `Print_Date__c` drives card order on **both** boards,
`prepBufferStats()`'s Prep Time KPI, and the urgency term of the priority score. So on an affected
order, a manager dragging a job to a new slot on the calendar changes nothing that anyone downstream
can see — the endpoint returns 200, the helper reports `changed: true`, and every board keeps ranking
the job by the old date. **That is a live, daily, user-facing feature silently doing nothing**, and it
is the reason to treat B19 as the top of the list rather than an E7.7 footnote.

📌 **dev2 was left as found:** both probe writes were restored (PR-0075 back to 14:00, PR-0100's actual
back to 13:15) and re-read to confirm.

##### 📊 SCANNED 2026-09-11 — dev2 **52%** drifted, staging **64%**, production not yet run

The drift scan proposed above was built and run. It is **read-only** — a SELECT-only Execute
Anonymous script, no DML, no org switch — so it can be run against any org at any time, including
production during a shift.

```apex
Map<Id,Order> os = new Map<Id,Order>([SELECT Id, OrderNumber, Print_Date__c FROM Order WHERE Print_Date__c != null]);
Map<Id,Datetime> e = new Map<Id,Datetime>();
for (Production_Run__c r : [SELECT PrintMethod__r.Order__c, Scheduled_Start__c, Actual_Start__c
                            FROM Production_Run__c WHERE PrintMethod__r.Order__c IN :os.keySet()]) {
    Datetime d = r.Actual_Start__c != null ? r.Actual_Start__c : r.Scheduled_Start__c;
    if (d == null) continue;
    Id o = r.PrintMethod__r.Order__c;
    if (!e.containsKey(o) || d < e.get(o)) e.put(o, d);
}
Integer sync=0, later=0, earlier=0, norun=0;
for (Id k : os.keySet()) {
    if (!e.containsKey(k)) { norun++; continue; }
    Long diff = os.get(k).Print_Date__c.getTime() - e.get(k).getTime();
    if (diff == 0) sync++; else if (diff > 0) later++; else earlier++;
}
System.debug(LoggingLevel.ERROR, 'B19SCAN ordersWithPrintDate=' + os.size() + ' inSync=' + sync
    + ' driftStoredLATER=' + later + ' driftStoredEARLIER=' + earlier + ' noRuns=' + norun);
```

📌 *Paste as ONE LINE into Execute Anonymous — the console's editor auto-indents and will mangle
a multi-line paste. Tick **Open Log**, run, then filter the log for `B19SCAN`.*

| Org | orders w/ print date | **have runs** | in sync | **drift, stored LATER** | drift, stored EARLIER | no runs |
|---|---|---|---|---|---|---|
| **dev2** | 64 | **42** | 20 | **14** | 8 | 22 |
| **staging** | 3,249 | **11** | 4 | **5** | 2 | 3,238 |
| production | — | — | — | — | — | **NOT RUN** |

**dev2: 22 of the 42 orders that have both a print date and runs — 52% — disagree with their own
runs.** Median drift **~5 days**, max **~13 days**; this is not rounding. **staging: 7 of 11, 64%.**

✅ **Cross-validated with two independent instruments.** The Apex above and a separate scan driven
through the app's own REST endpoints (`/api/production-orders` + `/api/production-runs`) agree
**exactly** on dev2's split — **14 later, 8 earlier** from both. They differ only on totals, because
the app's board query is rooted on `Production_Method__c` and cannot see the five orders that carry a
print date with no method at all. Two instruments, same answer.

🔑 **The DIRECTION of the drift separates B19 from E7.7, and this is the useful column.**
E7.7's missing `after delete` can only ever leave an order holding an **earlier** date — you delete
the earliest run, the new earliest is later, the stale stored value is therefore *before* what the
runs now say. **It cannot produce `stored LATER`.** So the **14 dev2 and 5 staging orders in that
column cannot be the delete gap**: on each, a run moved *earlier* (or an actual start was logged
earlier), the rollup should have pulled the print date back with it, and it did not. That is the B19
signature, at scale, on records nobody probed by hand.

⚠️ **State this carefully: drift is a CANDIDATE SET, not per-order proof.** The mechanism is confirmed
only on the orders actually probed (00013467 by app write, and the four Apex probes). A drifted order
could in principle have another explanation. **The `stored LATER` column is the defensible number**;
the `stored EARLIER` column is genuinely ambiguous between B19 and E7.7.

🚩 **staging's shape is worth noting on its own: 3,238 orders carry a print date and have no runs
at all.** That is not a defect — `rollupPrintDateToOrder` deliberately leaves the AM's committed date
alone when an order has no runs — but it means **staging can never be the org that proves anything
about this rollup**, the same way §8 item 3.10 found it cannot be the org that proves anything about
board size. Only 11 orders there exercise the code path.

⛔ **PRODUCTION IS THE NUMBER THAT MATTERS AND IT IS STILL MISSING.** Two blockers, both trivial:
this Chrome profile is **not logged in to production**, and the browser extension has **no site
permission** for `cultureapparel.lightning.force.com` (the sandbox domains do have it). Log in and
grant the domain, or paste the script above into production's Developer Console by hand. Until that
number exists, B19's priority is an inference from two sandboxes, not a measurement of the shop.

##### 🔎 HUNT NARROWED 2026-09-11 — it is NOT a before-save flow. Look at the after-save eleven.

Step 2 of the list below was started in dev2 while production access was blocked. `FlowDefinitionView`
gives the candidate set in one query (Developer Console, no Tooling API needed):

```sql
SELECT Label, ApiName, ProcessType, TriggerType, TriggerOrder FROM FlowDefinitionView
WHERE TriggerObjectOrEventLabel = 'Order' AND IsActive = true ORDER BY TriggerType
```

**14 active flows on Order in dev2, and only three are before-save.** (§4 elsewhere says "19 flows on
Order update" — that count includes inactive definitions and Process Builder; **14 active is the
number that matters**, and only 2 of those could possibly revert a field on update.)

| Flow | Trigger | Verdict |
|---|---|---|
| `Order_Count` | **RecordBeforeSave**, *"A record is created"* only | ❌ **RULED OUT** — never runs on update |
| `Order_Hold_Automation` | **RecordBeforeSave**, created or updated, Fast Field Updates | ❌ **RULED OUT for B19** — its two Assignments write `Hold_Placed_Date__c` / `Hold_Placed_By__c` and nothing else. It does not touch `Print_Date__c`. |
| `Inventory_Log_from_Deleted_Order_Header` | RecordBeforeDelete | ❌ not an update path |
| 11 others | **RecordAfterSave** | 🔎 **the remaining candidates** |

🔑 **So the working hypothesis in this section — a before-save flow using `PRIORVALUE()` — is wrong,
and an AFTER-save flow fits the evidence just as well.** Worth spelling out, because it is not
obvious: an after-save flow that re-sets `Print_Date__c` runs **inside the same transaction** as the
`Database.update`. So the DML still returns `isSuccess() = true`, and a SOQL re-read *after* that DML
— which is exactly how B19 was measured — sees the value the after-save flow put back. **Identical
symptom, different half of the save.** The REST PATCH path behaves the same way: 204, then the old
value on the next read.

📌 **Next, and it is now a short list.** Of the eleven after-save flows, two are print-date-shaped
by name — **`ORDER_Scheduled_Update`** (the only one carrying a `TriggerOrder`, 200) and
**`OrderStatusDateStamps`** — with `AUTOLAUNCH_OrderUpdate`, `OrderAnyUPDATE` and
`RECORDTRIGGER_ORDER_Production_Status` behind them. Open those five and look for an assignment to
`Print_Date__c`. Still worth doing first, and cheaper than any of it: **Setup → Object Manager →
Order → Fields → `Print_Date__c` → *Where is this used?*** — that lists every reference outright and
would settle this in one page. It also covers what a flow list cannot: **Apex triggers, workflow
field updates, and managed-package automation**, none of which have been ruled out.

🚩 **Side finding, unrelated to B19 but real: `Order_Hold_Automation` (Active, V2) references two
fields that do not exist on Order.** Both Assignments show *"The `Hold_Placed_Date__c` field doesn't
exist on the Order object, or you don't have access to the field"* — same for `Hold_Placed_By__c`.
An active before-save flow assigning to a missing field is a failed save waiting to happen on
whichever branch of its `Route Hold Change` decision fires. Either the fields were deleted out from
under it or the integration/admin profile cannot see them (the error message cannot tell the two
apart — **trap 1 territory**). **Worth its own look;** nothing in this session touched it.

##### What to look at, in order

1. **Setup → Object Manager → Order → Fields → `Print_Date__c` → *Where is this used?*** Cheapest, and
   it is the move that caught the `Misprint_Outcome__c` hazard in B9.
2. **The Order-update automation.** §4 counts **19 flows on Order update in dev2** (20 in staging).
   A **before-save** flow produces exactly this signature: DML succeeds, stored value is not what was
   written, nothing logged.
3. **Compare 00013493 against the other three.** It accepted the write. Whatever differs — record
   type, `Order_Substatus__c`, whether it has `Proposed_Run__c` rows, whether it came through *Close
   and Create Order* — is the entry condition of the thing doing the rewriting.
4. **Where does the replacement value come from?** On 00013467 the field reverts to **17:30, the start
   of the run that was deleted**. So the writer is reading a stored copy of the schedule that the
   delete never touched — a `Proposed_Run__c` row and the Opportunity's committed date are the obvious
   candidates.

📌 **Do not "fix" this by editing `OrderPrintDateRollup` or `ProductionRunTrigger`.** Both were read
in full and both are correct — see E7.7. Adding retries or a second write there would just lose the
same race more loudly.

⚠️ **Whatever is found, weigh it against D13 before changing anything.** D13 fixed the *policy* for
this field (never blank it when the last run goes). If the reverting automation is itself an
intentional rollup written by someone else, then this org has **two** writers for one field and the
answer is which one wins — a product decision, not a bug fix.

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

✅ **E5.8 — the work is COMPLETE. Re-verified 2026-09-09.** Branch
`chore/e5.8-delete-priority-rollup`, commit `41f2a4c` *"E5.8: delete the priority rollup nobody ever
called"* — the branch and the commit both exist and were read directly. Nothing about this story is
outstanding except Anthony's own push, which is true of every story in this project.

⚠️ **It is NOT in the closed list above, and that is deliberate:** that list means *landed on
`origin/main`*, and this has not. `functions/api/_priority-rollup.js` is still present at
`origin/main`'s tip (`79d82ef`, 2026-09-08 15:27), 5,261 bytes — confirmed three times with
`git cat-file`. Because the whole story IS a deletion, "is it done?" and "is the file gone from
main?" look like the same question and are not. **Merge that one branch and E5.8 closes outright**;
move it into the Weeks 3–4 list at that point, not before.

🪤 **While it sits there it is a live trap, not just dead weight — noted 2026-09-09.**
`_priority-rollup.js`'s own header still argues confidently that the score is mirrored onto
`Production_Method__c.Production_Priority__c` and that the stations sort by it. Both `_priority.js`
(`:29-39`) and `calendar/index.js` (`:22-27`) state the opposite — that the module and the field were
deleted under D9. So the file most likely to be read *first* by someone wondering what it does is the
one that is wrong, and its advice is to wire it up. ⚠️ **If the merge is going to wait, put a one-line
"DELETED under D9, see `_priority.js`" at the very top of the file** so the header cannot mislead
anyone in the meantime. The field itself is untouched in dev2 either way — deleting code does not
delete a field.

⚠️ **Three ✅ stories are deliberately NOT in the closed list, and must not be added without a fresh
check:**

- ~~**E4.8** and **E6.5** — unverified.~~ ✅ **BOTH RE-CHECKED AND CONFIRMED 2026-09-09.** The
  2026-09-03 empty reads were indeed the folder erroring: `stats.html` on `origin/main` is 49,201
  bytes and carries the fix at `:688` — `onSwitchAccount:()=>{ if(api.clearIdentity)
  api.clearIdentity(); window.location.href='login.html'; }` — and `run-results/index.js:393` carries
  `requireCap(request, env, "results.submit")`. E4.8 was also **re-verified end to end in a browser**,
  not just read; see its story entry for the evidence table.
- **E5.10** — landed, but its own entry says the Salesforce-touching paths are untested and need a
  real split and combine on staging. Code done, validation not.

~~📌 **Still to confirm alongside E6.5:** the `orders.receive` gate on
`functions/api/update-order-receiving/index.js`.~~ ✅ **CONFIRMED COMMITTED 2026-09-09** — it is on
`origin/main`: `import { requireCap }` at `:38` and `await requireCap(request, env, "orders.receive")`
at `:70`. The 2026-09-02 worry that the fix lived only in the working tree does not apply; that route
is gated for the day `ACCESS_ENFORCE=1` goes on.

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

##### Traps re-verified clean in the code — 2026-09-09

Recorded because a defect list with no denominator is misleading, and because "is trap N still
observed everywhere?" is a question that otherwise gets re-answered from scratch every few weeks.
This is a **static sweep of the whole `functions/` tree and all nine boards**, not a live-org test —
it proves the code says the right thing, not that Salesforce agreed with it.

| Trap / rule | Result |
|---|---|
| **1** — FLS-hidden field empties the SELECT | `runQueryOptionalField` used for `Print_Location__c` in `calendar` (3 sites), `production-runs`, `run-results`, `proposed-runs`; for `Multiple_Production_Methods__c` in `inbox` and `orders`. `Reject_Reason__c` / `Notes__c` absent from both `LINE_FIELDS` lists and from the `run-results` write body. ✅ |
| **2** — `__r` names are not guessable | No `PrintMethod__r` anywhere. Every run → method → order walk is an explicit query or semi-join. ✅ |
| **4** — `Quantity_Planned_c__c` | Spelled correctly in all four places. ✅ |
| **5** — stored values, not labels | `Production` at `orders/[id].js:92` and `_pm-rollup.js:41`; `Delivery` at `orders/[id].js:110`; `'Complete'` (Order) vs `'Completed'` (method) used correctly **and distinguished in comments** at `calendar/index.js:216` and `production-orders/index.js:116`. ✅ |
| **9** — every write ends at `Confirmed` | `production-runs/index.js:341` inserts `Planned`, `:243-254` PATCHes to `Confirmed`; `production-runs/[id].js:251` returns `RUN_CONFIRMED` unconditionally. The only path leaving a run on `Planned` is a genuinely failed second write, which is logged and reported as `published:false`. ✅ |
| **10** — never DELETE a line item | No DELETE against `Production_Run_Line_Items__c` exists anywhere; `run-line-items` writes only `Planned_Qty__c`. ✅ |
| Allow-listed writes | No caller-supplied field name reaches any write body. Every PATCH builds its payload from a fixed key set. ✅ |
| Shape validation before a WHERE | Every `searchParams` value and `params.id` reaching a SOQL literal is `SF_ID`-tested or `soqlQuote`d first — all call sites checked, including the interpolated `'${itemId}'` in `_ppi-checklist.js`, which is guarded by `isSfId` / `SF_ID` in **both** callers. ✅ |
| `<sc-for>` / `<sc-if>` inside `<table>` | Zero occurrences on any of the nine pages; `tools/check-dc-templates.mjs` passes. ✅ |

⚠️ **Three conventions did NOT come through clean, and they are B11–B18:** composite responses
(`run-results` alone ignores `resp.ok` — B11), IN-list chunking (six unchunked sites — B12), and
"failures must not look like success" (B13, B17). 📌 So the pattern is worth naming: **the rules with
a shared helper behind them held; the rules that live only as prose in this file drifted.** Trap 1
has `runQueryOptionalField`, trap 10 has no API to violate, escaping has `soqlEscape` — all clean.
Chunking has `runChunkedIdQuery` and *still* drifted, because nothing forces a caller to use it.

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
| **E5.8** | ✅ | **DONE 2026-09-02** · **work re-verified 2026-09-09** (branch and commit `41f2a4c` both read directly; the file is still at `origin/main` tip `79d82ef`, so the deletion is complete but unmerged — push to close outright). Branch `chore/e5.8-delete-priority-rollup`, unpushed. **Deleted, per Anthony (D9).** `_priority-rollup.js` was 130 lines with **zero importers** — both exported functions never called, `Production_Priority__c` written by nothing and read by nothing. **Two things in the story and the file were wrong:** the story said to "remove the field from every sort" — nothing sorted by it, there was no sort to remove; and the file's own headline justification claimed that with the score on the method "all four stations sort by priority", when every station query sorts by `Print_Date__c` and always had. The app computes priority live via `scoreOrder()` on every calendar request, so nothing on any screen changed. The Salesforce field itself is untouched — deleting code does not delete a field. Comments in `_priority.js` and `calendar/index.js` now record why it went and on what condition it could come back. |
| **E5.10** | ✅ | **DONE 2026-09-01**, branch `fix/s1-shipment-route-extensions`, unpushed. Three endpoints were unguarded, not four — `run-results` and `run-line-items` already chunk at 25, and `_rework.js` already had head/tail + rollback. Fixed `shipments/split.js`, `shipments/combine.js` and `production-methods/index.js` onto a new shared `_composite.js`. **Split was the worse bug and is not in the original note:** it emits 1 leg + N items + 1 shipment (+1 package) *per box*, so a 20-line order in two boxes already hits 26 — an ordinary order, not a large one. Combine's real ceiling moved from 12 orders to 25. Error reporting needed no work: all five copies already preferred the non-`PROCESSING_HALTED` failure. 16 unit tests on the chunker pass; **the Salesforce-touching paths are untested** (no org credentials locally) and need a real split and combine on staging. |
| **E5.11** | ✅ | **DONE 2026-09-01**, branch `fix/e5.11-clear-scheduled-time`, unpushed. `""` / `null` now writes null, matching `actualStart` — **but the server was only half the bug.** The run-row drawers hard-required both halves, so blanking the schedule failed client-side with "Set the scheduled start date & time" and never sent a request; fixing the API alone would have changed nothing a manager could see. `index.html` and `pre-production.html` `saveRunRow` now accept a fully blank window. Create paths (`submitRunCreate`, and `calendar.html`'s combined create/edit form) deliberately still require it — `production-runs/index.js` rejects a create with no schedule. Clearing is **pair-only**: a half-clear returns `scheduled_window_must_clear_together`, because a run with an end and no start reads as "Not scheduled yet" everywhere and would be invisible and stuck. **Decision (Anthony, 2026-09-01): a clear still lands on `Confirmed`**, so nothing re-books a slot a manager just cleared — the cost is that the run still reads as "On the shop calendar" with no time, and `ProductionEventPublisher` gets an Event with null start/end. **That Apex behaviour is UNVERIFIED** and must be checked under E8.3 before production. |
| **E6.7** | ✅ | **DONE 2026-09-01**, branch `fix/e6.7-text-sanitise`, unpushed. **The vulnerability was reproduced before it was fixed** — the payload's `onerror` executed against the real function in Chrome, from a detached element, exactly as the story said. Now parses with `DOMParser` into an inert document. Trap 6 was the risk: `text()` processes every formula field on every board, so the replacement had to return byte-identical strings. Verified across 14 input shapes — both `HYPERLINK()` formulas, nested tags, entities, `<br>`, multi-paragraph rich text, numbers, null, whitespace collapsing — **all identical, zero mismatches**, then re-confirmed against the shipped `CAApi.text()` rather than a copy. Swept the other two `innerHTML` sites in `ca-api.js`: both take literal icon names and static copy, no Salesforce data. |

##### Phase D — Access control, for real

| Id | P | What |
|---|---|---|
| **E6.5** | ✅ | **DONE 2026-09-01**, branch `feat/e6.5-gate-mutating-routes`, unpushed. **21 of 24** files with a mutating handler now call `requireCap`, up from 4. The three left open are `worker-login`, `worker-logout` and `station-login` — requiring a session to create one is circular. **The blocker was never the wiring, it was that workers had no capabilities at all:** `capsFor()` returned `[]` for anyone not admin or manager, so flipping the flag would have locked every worker out of count-in, item sub-status, inventory and the counting screen. The roadmap flagged `results.submit`; it was the entire shop-floor surface. New `DEFAULT_WORKER_CAPS` grants exactly four endpoints and nothing else. Verified end-to-end with `ACCESS_ENFORCE=1`: worker reaches every station endpoint (400s from their own validation), is **403** on the manager surface, manager works everywhere, anonymous **403** everywhere. Report-only confirmed to change nothing today. ⚠️ Still run five days of `[access] would deny` before enforcing — that log, not this list, is what proves the worker set is right. |
| **E6.6** | ✅ | **DONE 2026-09-01**, branch `feat/e6.6-remove-station-tokens`, unpushed. **Deleted, per Anthony's decision.** The whole per-station auth system — HMAC signing, verify, 12h cookie, station PINs, `/api/station-login` — was complete, correct, and had never been plugged in: `verifyStationToken()` had zero callers, no page called `CAApi.stationLogin()`, no endpoint checked anything. It read like protection, which is worse than nothing because people trust it. **`STATION_CONFIG` stays** — six live endpoints import it, and the file was two unrelated things sharing a name. **`safeEqual()` stays too**, and that mattered: `admin/sf-env.js` imports it to compare `SF_ENV_SWITCH_PIN`, which is a *real* gate today (unlike `requireCap`, still report-only), so removing it would have weakened the env switcher. What protects these endpoints instead: personal PINs plus E6.5's `requireCap` (`items.status`, `orders.receive`, `inventory.edit`). Verified with `ACCESS_ENFORCE=1` that a worker still reaches every station write, and that `/api/station-login` is gone. −129 lines. |
| **E6.8** | ✅ | **DONE 2026-09-02**, branch `feat/e6.8-roster-from-config` (stacked on E6.6), unpushed. All three claims were real and the middle one was worse than written. **(1) Roles from config:** an entry may now carry `"role"` (`{"Parker":{"pin":"3391","role":"admin"}}`); `ADMIN_NAMES`/`MANAGER_NAMES` remain the fallback. `rosterRole()` is shared with `capsFor` so a role change moves the UI *and* the API together — deriving them separately would have meant promoted-in-the-buttons, refused-by-every-endpoint. An unrecognised role string logs and falls back; it never grants. **(2) Revocation:** `capsFor` fell back to role-derived defaults for a name it could not find, so removing someone from `WORKER_PINS` changed *nothing* until their cookie expired — and a removed manager kept manager caps, because the fallback read the hardcoded arrays rather than the secret. Absence from a roster that parsed is now `[]`. Gated on the JSON having actually parsed, so a stray comma can't read as "everyone revoked". Also closed a prototype leak: `capsFor(env, 'constructor')` used to return worker caps. **(3) Shared PIN:** last-match-wins is now a refusal (`pin_ambiguous`, 500, no cookie). Measured before/after: with Titus and Parker sharing a PIN, Titus typing it signed in **as Parker, role manager, with a manager session cookie**. ⚠️ Revocation only *blocks* once `ACCESS_ENFORCE=1`; today it still correctly blocks new logins. **Decided, not built** (Anthony, 2026-09-02): `confirmManager()` leaves the tablet's server session as the manager for 12h. Accepted — the manager logs out when they walk away, and `worker-logout` does clear the cookie. Recorded in `ca-api.js` above `confirmManager()`, including the one caveat if it is ever revisited: nothing on screen says the session changed, so the habit it relies on has no cue in the UI. |

> ✅ ~~**Before anyone sets `ACCESS_ENFORCE=1`:** the counting screen's submit gates on
> `results.submit` … enforcement would leave only Anthony able to record production results.~~
> **CLEARED — verified in the code 2026-09-09.** `results.submit` is in **both** capability sets:
> `_session.js:78` (inside `DEFAULT_MANAGER_CAPS`, in the shop-floor group appended to it) and
> `_session.js:107` (`DEFAULT_WORKER_CAPS`). E6.5 granted it; this warning was written before that
> and outlived it. **Trap 2 below is still open.**
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
| **E2.6** | ✅ | **DONE 2026-09-09**, branch `fix/e2.6-run-order`, `index.html` +12/−1. **Verified: the derivation is sound, and the one thing it depends on has been made explicit.** Driven in a wrangler rig against a stateful fake Salesforce — one Screen Print method, four runs, every write recorded and asserted on the server, not read off the screen. **All three cycles walked end to end:** setup Start/Stop advanced Ready for Print → In Production; production Start/Stop stamped **only** the pointed-at run's `Actual_Start__c`/`Actual_End__c`, accumulated the per-method seconds, rewound the method to Ready for Print while runs remained, and moved it to Post-Production only after the last one. The pointer landed on **run 2 after run 1 and run 3 after run 2**, each time re-derived from run actuals across a full page reload (E1.4 navigates to `counting.html` on every Stop, so each cycle starts from a cold board). **Out-of-order also holds:** picking run 3 first stamped run 3 alone and the pointer fell back to run 1 — and `caTimerRunByMethod` was written back as `{}` **before** the navigation, so the released pick does not survive as a stale pointer. **Pause is correctly not Stop:** it committed the seconds and stamped no actual end, moved no status and moved no pointer. **A mid-run board refresh** lost neither the running elapsed nor the pointer. **The one real finding, and it is fixed:** the drawer shows the same runs TWICE — the "Working on" picker (sorted by `runsInOrder()`) and the Production Runs rows below (which took `st.runsByMethod` raw, in whatever order the endpoint returned). They agreed only because `/api/production-runs` happens to `ORDER BY Scheduled_Start__c ASC NULLS LAST`, which is the same rule — **except on two runs booked for the same time**, where SOQL has no secondary sort and the client tie-breaks on `Name`, and except for a locally created run, which was appended and then re-ordered itself on the next load. Both lists now go through `runsInOrder()`, so "the second run" means the same run wherever you read it. ⚠️ Verified against a fake Salesforce, **not against dev2** — that pass is still owed, and S5 in §8 is the script for it. |
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
| **E7.3** | P1 | Salesforce | Consolidate Print Location onto a Global Value Set. Four independent local copies today, six once production exists, plus two code copies. Cheapest it will ever be is before production. ✅ **INVENTORIED 2026-09-09 — the four copies are now named.** `Print_Location__c` exists on exactly **two objects per org**, confirmed by Tooling API `CustomField` in both: **`Production_Run__c`** (dev2 `00Nca000009mp6HEAQ` · staging `00Nca000009mYjFEAU`) and **`Proposed_Run__c`** (dev2 `00Nca000009mEMSEA2` · staging `00Nca000009mjHwEAI`). That is the arithmetic in the story: 2 fields x 2 orgs = **4 today**, production adds 2 = **6**. Plus the two code copies, `_placements.js` and `ca-api.js`. 📌 Field ids differ per org, as always — do not match them across orgs. **Values: all 11 identical everywhere** — Front, Back, Left Sleeve, Right Sleeve, Left Chest, Right Chest, Full Front, Full Back, Tag, Hood, Pocket. Confirmed by Anthony 2026-09-09 for both orgs, matching the independent audit in §3. **No drift has happened yet — this is preventive, not a fix.** 🚩 **No Print Location Global Value Set exists.** Staging holds 5 GVSs (`Screen_Size`, `Shipping_Type`, `Terms`, `UoM`, `Country_Two_Letter_Code`) and none is this one, so E7.3 creates a new one — but the pattern is already established in the org, so it is an idiom to follow rather than introduce. ✅ **GLOBAL VALUE SETS BUILT 2026-09-09, dev2 AND staging.** Label **Print Location**, name **`Print_Location`**, 11 values in the deliberate (non-alphabetical) order, *Display alphabetically* and *Use first value as default* both left OFF so the order matches `PLACEMENTS`. dev2 `0Ntca0000001gbV` · staging `0Ntca0000001gd7`. Both read back off their saved detail pages: Values [11], **Fields Where Used [0]**. 🚩 **THE REPOINT IS BLOCKED AND THE STORY IS NOT DONE.** Salesforce offers **no way to convert an existing local picklist to a Global Value Set in the UI** — read directly off `Production_Run__c.Print_Location__c` in dev2, whose only Values buttons are New · Reorder · Replace · Printable View · Chart Colors. There is no "Promote to Global Value Set". A GVS can only be chosen **when a field is created**. So the four existing fields cannot adopt these sets without being recreated, and `Production_Run__c.Print_Location__c` holds real data — recreating it is a data migration, not a settings change. (Whether the Metadata API can convert in place is **untested here** — do not assume it can.) 📌 **What this means: the value is now front-loaded onto E7.4.** The sets exist, so when production's fields are created they can be based on **Print Location** and production never gets local copies 5 and 6. The four existing sandbox fields stay local until someone decides the migration is worth it. That is a smaller, safer story than the original, and it captures most of the benefit. ⚠️ **One behaviour change to weigh before any repoint:** a GVS is **restricted by definition** ("users can't add unapproved values through the API"), while both fields today have *Restrict picklist to the values defined in the value set* **unchecked**. Repointing would start rejecting any placement not in the 11 — safe while `_placements.js` matches exactly, but it is a real change to what the API accepts, not a like-for-like swap. ⚠️ **Sequencing is the whole story.** Do this BEFORE **E7.4** (promote metadata to production, P0, Peter Larson). Production has no `Print_Location__c` at all yet; going first means production inherits the shared set and copies 5 and 6 never exist. Going second means creating them and then migrating six instead of four. |
| **E7.6** | ✅ CLOSED | Salesforce + App | **INVESTIGATED 2026-09-02. The original premise is wrong, and what is actually happening is worse.** The formula in dev2 reads, verbatim: `IF( ISBLANK(Duration__c), Print_Date__c +(2/24), Print_Date__c +(Duration__c/24))` — so a 2-hour fallback **does** exist, and `Duration__c` **does** reach the formula: of 20 scheduled orders, the 5 with a duration set (1, 3, 4, **4.5**) have `Print_End_Date_Time__c − Print_Date__c` **exactly equal** to it. 4.5 surviving also settles the decimal-places worry — **not the problem here.** ⚠️ **But the other 15 orders (75%) have `Duration__c` null and an end time EXACTLY equal to their start time — a zero-hour gap, where the formula says +2h.** Both boards prefill run Scheduled End from this field, so for three orders in four the New Run form opens with **Scheduled End == Scheduled Start**. Worse, `runDurationHours()` in `_priority.js` assumes **2 hours** in exactly this case (its comment claims that is "the same default `Print_End_Date_Time__c` already uses" — **that comment is wrong**), so the scheduling suggestion reserves 2h while the form prefills 0h, for 75% of orders. ✅ **ROOT CAUSE FOUND.** The SOQL was run against order `801ca00000T4m0aAAB`: `Duration__c` is **blank** and `Print_End_Date_Time__c` returns `2026-08-19T12:15:00Z` — **identical to `Print_Date__c`**, not +2h. The mechanism is Salesforce's **blank-field handling**: the "treat blank fields as zeroes / as blanks" option is only offered for formulas returning Number, Currency or Percent. This formula returns **Date/Time**, so the option is not shown — confirmed by opening the formula editor, where no such radio group exists — and Salesforce defaults to **treating blank number fields as zeroes**. `Duration__c` is therefore coerced to `0` *before* `ISBLANK` sees it, `ISBLANK(0)` is **false**, and evaluation always takes the second branch: `Print_Date__c + (0/24)` = `Print_Date__c`. 🚩 **The 2-hour fallback is dead code. It has never once executed since the field was created on 12 Jan 2023.** ✅ **FIXED IN DEV2 2026-09-02 by Anthony**, and independently verified. The formula is now `IF( Duration__c > 0, Print_Date__c + (Duration__c/24), Print_Date__c + (2/24) )` — testing the value rather than asking `ISBLANK` about one that has already been coerced, so blank and zero both fall to the 2-hour branch and a real duration still wins. **Verified twice over two different connections:** Anthony's Query Editor as himself, and the app's own read as the integration user over OAuth. Across the 20 orders on the calendar, **zero-hour gaps went 15 → 0**; the distribution is now 2h×15, 1h×2, 3h×1, 4h×1, 4.5h×1. Control checks: order `00013478` (blank duration) moved 12:15 → **14:15**, while `00013499` (4.5h) and `00013501` (4h) are **byte-identical to before** — the orders that already worked were not disturbed. All eight read endpoints still return JSON with real rows. **Staging: the same edit was applied by Anthony 2026-09-02.** ⚠️ Recorded on his word — staging is not reachable from browser automation, so unlike dev2 it has **not** been independently verified. E7.1 is the precedent for why that matters (dev2 done, staging assumed, story sat half-finished). **To make it airtight:** run the same two queries in staging — one blank-duration order should now show a 2-hour gap, one order with a real duration should be unchanged — and log the date and result in `VALIDATION-INTEGRATIONS.md`. **App half also DONE and LIVE.** `runFormWindow()` in `ca-api.js` floors the end at start + `RUN_FALLBACK_HOURS` (= 2, per D6) whenever `Print_End_Date_Time__c` is missing, unparseable, or not strictly after the start; `index.html` uses it in place of two bare `splitDT()` calls, and the false comment in `_priority.js` is gone. Verified on `origin/main` **and on the deployed site** — `runFormWindow` is present in the live `ca-api.js` and referenced by the live `index.html`. **Production is the only org left, and it belongs to E7.4** — it has none of this metadata yet, so the formula travels with that promotion rather than as a change of its own. ✅ **FORMULA FIXED BY ANTHONY 2026-09-02.** ✅ **APP HALF DONE 2026-09-02**, branch `feat/e7.6-run-end-floor`, unpushed — `runFormWindow()` in `ca-api.js` floors the New Run end at start + 2h whenever `Print_End_Date_Time__c` is missing, equal to or before the start; used by `openRunCreate()` (index) and `defaultRunForm()` (pre-production), and `runDurationHours()`'s false comment is corrected. Verified in a browser on both pages: the zero-gap order prefills 07:15→09:15, a healthy 4.5h order passes through 07:15→11:45 untouched, and feeding the guard's own output back in changes nothing. **Original note, kept for the record — an app-side story for Claude Code:** `openRunCreate()` prefills Scheduled End straight from this field, so it must never seed an end equal to or before the start; and `runDurationHours()` in `_priority.js` carries a comment claiming 2 hours is "the same default `Print_End_Date_Time__c` already uses", which is **false** and should be corrected whichever way the formula lands. |
| **E7.4** | P0 | Peter Larson | Promote the full metadata set to production. Production has **none** of it — no Apex, no `Proposed_Run__c`, no calendar setting, no priority fields, no `Print_Location__c`, no flows. Promote from staging. **After deployment, by hand:** FLS for every new field (change sets deploy fields with FLS off) and permission-set assignments (assignments never travel). A clean "Deployment succeeded" is **not** evidence of either. The `Planned` value must exist in the restricted `Auto_Scheduling_Status__c` picklist before the app is pointed at production. 📌 **Carry E7.6's corrected formula with this promotion.** `Order.Print_End_Date_Time__c` must read `IF( Duration__c > 0, Print_Date__c + (Duration__c/24), Print_Date__c + (2/24) )` — **not** the original `ISBLANK` version, whose 2-hour branch can never execute because a Date/Time formula gets no blank-field-handling option and Salesforce coerces blank numbers to zero. If production is built from an old change set, this regresses silently and every order without a duration gets a zero-length print window again. |
| **E7.5** | ⚠️ partly done | Ops | **The three `SF_ENV_PRODUCTION_*` secrets now EXIST** — verified 2026-09-02 in Pages → Settings → Variables and secrets (CLIENT_ID, CLIENT_SECRET, LOGIN_URL, all encrypted), and `/api/admin/sf-env` now reports production as `configured: true`. **Anthony did not set them.** The Cloudflare account is Peter's, so ask him to confirm before assuming. 🚨 **This is now ahead of E7.4, which is the dangerous order:** production has none of the metadata — no Apex, no `Proposed_Run__c`, no `Print_Location__c`, no calendar setting, no flows — yet the env switcher will offer it as a destination and the switch is global and instant. The only thing standing in the way is `SF_ENV_SWITCH_PIN`, which `admin/sf-env.js` checks with `safeEqual` and enforces **regardless of `ACCESS_ENFORCE`** (`requireCap` there is still report-only, so the PIN is the real gate). **Until E7.4 lands, treat production as configured-but-not-ready** and keep that PIN closely held. | Configure the production environment in Cloudflare. `SF_ENV_PRODUCTION_LOGIN_URL` / `_CLIENT_ID` / `_CLIENT_SECRET` from a production Connected App, with the Client Credentials run-as user chosen deliberately and its FLS reviewed. `SF_ZK_ORDER_FIELD_ID_PRODUCTION` is a per-org metadata Id that does **not** migrate with a change set. Verify the switch *back* to staging too — that is the rollback. |
| **E7.7** | ⛔ BLOCKED on B19 | Salesforce | `ProductionRunTrigger` is after insert/update only, so deleting a run inside Salesforce skips `OrderPrintDateRollup` and leaves `Print_Date__c` stale. The app's delete path handles it; the Salesforce UI path does not. ✅ **INVESTIGATED 2026-09-09 — the premise is confirmed, and there is a SECOND gap the story does not mention.** **Confirmed in dev2 AND staging, identical:** `ProductionRunTrigger` is `Active`, `UsageAfterInsert` **true**, `UsageAfterUpdate` **true**, `UsageBeforeInsert` / `UsageBeforeUpdate` / `UsageBeforeDelete` / `UsageAfterDelete` / `UsageAfterUndelete` all **false**. Body: `trigger ProductionRunTrigger on Production_Run__c (after insert, after update)` -> `ProductionRunTriggerHelper.afterInsert/afterUpdate`, each of which calls `ProductionAutoSchedulerService.scheduleFromRuns` -> `ProductionEventPublisher.sync` -> `OrderPrintDateRollup.syncFromRuns`, in that order (the helper's own header explains why the order matters). ✅ **The fix is small, because the entry point already exists.** `OrderPrintDateRollup` exposes **two** public methods: `syncFromRuns(List<Production_Run__c>)` and **`syncOrders(Set<Id> orderIds)`**. Its three queries are `SELECT Order__c FROM Production_Method__c WHERE Id IN :methodIds`, then `SELECT Scheduled_Start__c, Actual_Start__c, PrintMethod__r.Order__c FROM Production_Run__c WHERE PrintMethod__r.Order__c IN :orderIds`, then `SELECT Id, Print_Date__c FROM Order WHERE Id IN :earliest.keySet()`. It **recomputes from scratch**, so `after delete` is the correct timing — the deleted rows are already gone from query 2, and `Trigger.old` still carries `PrintMethod__c` to resolve the order. Adding `after delete` to the trigger and an `afterDelete(Trigger.old)` to the helper is the whole change. ✅ **BUILT AND READ BACK 2026-09-09 in dev2 AND staging.** Two edits per org, helper first (the trigger will not compile against a method that does not exist yet):

- `ProductionRunTriggerHelper` — new `public static void afterDelete(List<Production_Run__c> oldRuns)` calling `OrderPrintDateRollup.syncFromRuns(oldRuns)`, with a header explaining why AFTER delete, why only the rollup, and the D13 empty-order behaviour. dev2 class `01pca000002mKEfAAM` · staging `01pca000002n7vJAAQ`.
- `ProductionRunTrigger` — signature now `(after insert, after update, after delete)` plus an `if (Trigger.isDelete) { ProductionRunTriggerHelper.afterDelete(Trigger.old); }` branch inside the existing `Trigger.isAfter` block. dev2 trigger `01qca000004l6Z8AAI` · staging `01qca000004nFhyAAE`.

**Read back through the Tooling API, not off the page that saved it:** both orgs now report `Status Active`, `UsageAfterInsert true`, `UsageAfterUpdate true`, **`UsageAfterDelete true`**, `UsageBeforeDelete false`, and `LengthWithoutComments` **467 in both** — byte-identical, which is the parity check.

🔴 **EXECUTED 2026-09-09 IN DEV2 — AND IT DOES NOT WORK. E7.7 IS NOT DONE.**

This entry used to say "it compiles and it is active, it has not been executed… a green save is not
a passing test." **The test has now been run, and the green save was indeed not a passing test.**

| Step | Result |
|---|---|
| Order **00013467** (`801ca00000SJ1xyAAD`), 5 runs, `Print_Date__c` = **2026-07-31T17:30** — exactly PR-0033's start, so the rollup was correct going in | baseline ✅ |
| Deleted **PR-0033** (`a3Xca000000GtjhEAC`) — the earliest run, sched 17:30 / actual 17:30, 0 line items, 1 calendar Event | deleted ✅, confirmed by `SELECT COUNT(Id)` going **5 → 4** |
| Expected `Print_Date__c` to move to PR-0034 (actual 18:15, scheduled 18:30) | 🔴 **STILL 2026-07-31T17:30** — pointing at a run that no longer exists |
| Trigger read back through the Tooling API **after** the delete | `Active`, `UsageAfterInsert` true, `UsageAfterUpdate` true, **`UsageAfterDelete` true**, `UsageBeforeDelete` false, `LengthWithoutComments` **467** — identical to what this story recorded when it was built |
| Called the rollup **directly**: `OrderPrintDateRollup.syncOrders(new Set<Id>{'801ca00000SJ1xyAAD'})` | 🔴 **also failed to move it.** The Order's `LastModifiedDate` advanced (19:15:52 → 19:23:20), so the class ran and wrote — the value simply did not change |

🔑 **What that last row rules out, and it is the useful part.** The deployment is not the problem: the
trigger is active with `after delete` exactly as documented. And the trigger's delete path is not the
only problem either, because **calling `syncOrders` by hand on a known-stale order also fails to
correct it.** So the defect is inside `OrderPrintDateRollup`'s own recompute, on the path where the
correct answer is *later* than the stored one.

⛔ **NOT diagnosed — read the class, do not guess.** The obvious hypothesis is that it only ever moves
`Print_Date__c` **earlier** (a monotonic guard), which would make this story's premise — deleting the
earliest run pushes the date forward — unreachable without changing that rule. ⚠️ **That is a
hypothesis and it was NOT confirmed:** the experiment written to test it (set the date far in the
future, re-run `syncOrders`, see whether it pulls back to 18:15) never executed — `LastModifiedDate`
did not move, which is how that was caught rather than assumed. **Next step: read
`OrderPrintDateRollup`'s body**, specifically whether the final update is conditional on direction and
whether `earliest.keySet()` is populated at all when the recomputed value is later than the stored one.

📌 **The app side does not have this defect.** `_print-date-rollup.js` recomputes unconditionally —
*"`Actual_Start__c` if it exists, else `Scheduled_Start__c`"*, earliest wins — and writes whenever the
value differs. **So Apex and the app do NOT agree**, which is an assumption D13 leans on. D13's
*decision* (never blank when the last run goes) is unaffected and still stands; what is now in
question is the broader claim that the two implementations behave identically on every other path.

📌 **A standing reproduction case, deliberately left in place.** Order **00013467** carries
`Print_Date__c = 2026-07-31T17:30` pointing at a **deleted** run, while its earliest real run is at
18:15. **Use it** — it is the defect, on demand, with no setup. Do not "tidy" it back; the point of it
is that it is wrong. (It also cannot be tidied — that is B19.) ⚠️ **This is dev2 test data and it does
not need repairing** — see §1, *Working with Anthony*.


##### ✅ DIAGNOSED 2026-09-09 — it is NOT the trigger, and it is NOT `OrderPrintDateRollup`

**Something in the Order's own update automation overwrites `Print_Date__c` inside the same
transaction, and reports success while doing it. E7.7's code is correct and is simply inert.**
📌 **The cause is now its own story — see B19**, which measures how widespread this is (3 of 4 sampled
orders revert; one accepts) and carries the investigation. ⚠️ An earlier draft of this section said the
field "cannot be written at all" — that was measured on **one** order and was too strong.

**The proof, in one Execute Anonymous block** — no rollup, no trigger, just a plain DML:

```apex
Database.SaveResult sr = Database.update(
    new Order(Id='801ca00000SJ1xyAAD',
              Print_Date__c=Datetime.newInstanceGmt(2026,7,31,18,15,0)), false);
System.debug(sr.isSuccess());                                   // -> true
System.debug([SELECT Print_Date__c FROM Order WHERE Id=:oid]);  // -> 2026-07-31 17:30:00
```

```
SET success=true
SET readback=2026-07-31 17:30:00
```

🔑 **`isSuccess()` is TRUE and the value is the OLD one.** That is not a rejected write — a rejected
write returns `isSuccess() = false` with an error. This is a write that committed and was then
rewritten by something else before the transaction ended.

**Everything else was ruled out first, in this order:**

| Ruled out | Evidence |
|---|---|
| The trigger is not deployed | Tooling API: `Active`, `UsageAfterDelete` **true**, `LengthWithoutComments` **467** |
| The class is disabled | Log: `OrderPrintDateRollup.disabled = false` |
| The class computes the wrong answer | Its computation replicated line-for-line: `earliest = {801ca00000SJ1xyAAD=2026-07-31 18:15:00}` |
| The class decides not to write | Same probe: `stored=17:30 want=18:15 differs=true` — so `toUpdate` is non-empty and line 112 runs |
| A **monotonic guard** (only ever moves the date earlier) | ⚠️ **This was the leading hypothesis and it is WRONG.** Line 104 is a bare `if (o.Print_Date__c != want)` with no direction test |
| The class's DML failed and was swallowed by `allOrNone=false` | No `OrderPrintDateRollup: Order … update failed` line anywhere in the log |
| `ProductionAutoSchedulerService` re-packed the runs into the old slot | All four surviving runs still carry `LastModifiedDate` **2026-08-27** — untouched |

📌 **The class is well-written and is not at fault.** Its recompute matches
`functions/api/_print-date-rollup.js` exactly — *effective start = `Actual_Start__c` if present, else
`Scheduled_Start__c`; earliest wins* — verified by reading the source, lines 79-94.

🚩 **A stale claim inside the class's own header, worth fixing while you are there.** Lines 32-34
still read: *"KNOWN GAP: run DELETE. ProductionRunTrigger is after insert/update only, so deleting a
run directly in Salesforce does not recompute… Closing that needs a change to Uros's trigger itself
-- deliberately not done here."* E7.7 made that change; the header was never updated. Anyone reading
this class first will conclude the gap is still open by design.

⛔ **WHAT IS STILL UNKNOWN — the next question, and it is a different investigation.** *Which* Order
automation rewrites `Print_Date__c`, and where it gets **17:30** from. Note what that value is: the
start time of the run that was **deleted**. So the writer is reading a stored copy of it from
somewhere that the delete did not touch — a `Proposed_Run__c` row, an Opportunity field, or a
scheduling screen's saved value are the obvious candidates.

**Where to look, in order:**

1. **Setup → Object Manager → Order → Fields → `Print_Date__c` → *Where is this used?*** This is the
   same move that caught the `Misprint_Outcome__c` hazard in B9, and it is the cheapest.
2. **The Order-update flows.** §4 already counts **19 flows on Order update in dev2** (20 in
   staging). One of them is the writer. A before-save flow would produce exactly this symptom —
   success reported, old value stored.
3. **Re-entrancy is visible in the log and is a clue:** during a single `syncOrders` call,
   `syncFromRuns` was re-entered **twice** (log lines `[33]` / `[63]`). Something in the Order's
   update path reaches back into `Production_Run__c`, which re-fires `ProductionRunTrigger`. Whatever
   does that is likely the same automation.

📌 **What this means for the story.** E7.7's code change is **correct and can stay**. It is simply
inert, because nothing can move this field while that other automation is in place. **Do not "fix"
E7.7 by editing the trigger or the rollup again** — both were checked and both are right. And note
the app has the same exposure: `_print-date-rollup.js` writes the same field the same way, so the
dashboards' own rollup is presumably being overwritten too, silently, and has been all along.

📌 **Two smaller findings from the same session, both worth keeping:**

1. 🪤 **Delete is not on the Production Run Lightning page layout.** The record page's action menu
   offers only *Submit for Approval*. So the "somebody deletes a run in the Salesforce UI" scenario
   this story guards may not be reachable from the record page at all — it took Execute Anonymous.
   Worth checking the list view and the method's related list before deciding how urgent this is.
2. 🪤 **The Developer Console Query Grid's "Delete Row" silently does nothing.** Selecting the row,
   clicking *Delete Row* and confirming *"Delete 1 rows from Production_Run__c?"* removed the row
   from the grid and **left the record intact**, with no error anywhere — SOQL still returned it
   afterwards. `delete [SELECT …]` in Execute Anonymous worked first time. **Never trust the grid's
   delete as evidence that anything was deleted.**

🚩 **Code coverage is 0% on both the trigger (0/7) and the helper (0/10) in both orgs.** That is pre-existing, not caused by this change, but it is now **E7.4's problem**: production deployment needs 75% org-wide, and this change adds uncovered lines to both. Do not discover that during the promotion.

✅ **DECIDED — see D13 (2026-09-09, Anthony): leave it, never blank.** The scope of E7.7 is therefore exactly `after delete` + `afterDelete(Trigger.old)`, nothing more.

⚠️ **CORRECTION 2026-09-09 — I first called the empty case a second bug. It is not.** The final query is scoped to `earliest.keySet()` and `Print_Date__c = null` appears nowhere in the class, so deleting an order's **last** run leaves `Print_Date__c` untouched. That is **deliberate, and it already matches the app.** `functions/api/_print-date-rollup.js` makes the same choice explicitly: *"No runs, or none with a date: leave the AM's original date alone. This is the case that makes deleting the last run safe -- the order falls back to what the Account Manager committed to rather than being blanked."* The Apex behaves identically **by construction**, so no extra code is needed for it. 📌 **One honest caveat on that rationale:** the comment says the order falls back to *the AM's* date, but the rollup overwrites `Print_Date__c` as soon as a run exists — so after a run has lived and been deleted, the field holds the **deleted run's** start, not the AM's original. The *choice* (never blank) is sound and deliberate; the stated reason is rosier than the mechanism. There is no stored copy of the AM's date to fall back to. 🚩 **Why blanking would be worse, not better:** `calendar/index.js` windows its query on `Order__r.Print_Date__c >= from AND <= to`, so a null date makes the order **vanish from the calendar entirely** — including the Unassigned lane — which is the one screen used to reschedule it. (`dueInfo()` in `ca-api.js` handles null fine, returning `{label:'No date', urg:'ok', days:null}`, so the boards themselves would degrade gracefully — it is the calendar's window that is the problem.) Blanking would also make the same delete behave differently in Salesforce than in the dashboard, which is exactly the drift this project keeps paying for. ⚠️ **Also in scope, deliberately not assumed:** `ProductionEventPublisher` gets no delete call either, so a deleted run's calendar event is presumably orphaned — that overlaps **E7.8** and was not verified here. And the auto-scheduler does not re-run on delete, so surviving runs are not re-packed. 📌 **Cost note:** this is Apex, so it needs test coverage and a deploy, not a Setup click — and it must travel with **E7.4** to reach production. |
| **E7.8** | P2 | Salesforce | Decide the fate of `OrderScheduling`'s `CreateCalendarEvent` — keep it and document the duplicate-event behaviour, or remove it and let `ProductionEventPublisher` own the calendar end to end. ✅ **INVESTIGATED 2026-09-09. The two writers do NOT collide, and the duplication is real but rare.** 📌 **`OrderScheduling` is a FLOW, not Apex** — screen flow, **Active, V22**, dev2 flowId `301ca00000TKM8ZAAX`. (`SELECT ... FROM ApexClass WHERE Name LIKE 'OrderSched%'` returns 0 rows; do not go looking for a class.) Shape: Start -> GetOrderId -> GetOrderItems -> Get Proposed Run -> `ShippingMethodSchedule` (Screen) -> `ComplexityandDate` (Screen) -> **`CreateCalendarEvent`** -> `UpdateOrder` -> End. **`CreateCalendarEvent` is a Create Records on `Event`:** Subject <- AccountNameCustomerOrderName · Start/Due Date Time <- ComplexityandDate > Print Date & Time · End Date Time <- CalculateEndDateTime · Duration <- DurationinMinutes · Description <- SpecialNotesPrintSpecs · Location <- Location · **Related To ID (WhatId) <- `recordId`, i.e. the ORDER** · **Assigned To ID <- hardcoded `0055e000005tFYfAAM`**. **Check for Matching Records: DISABLED** — it always INSERTs. **`ProductionEventPublisher` (Apex, Active) writes Events at a different grain:** `sync(List<Production_Run__c>, Map<Id,Production_Run__c>)`, and its only query is `SELECT Id, WhatId, OwnerId FROM Event WHERE WhatId IN :runIds` — **WhatId = the Production_Run__c**, so it reads existing events and is idempotent per run. It also has `calendarOwnerId()` (computed, not hardcoded) and `isEnabled()` (a kill switch). 🔑 **So the story's premise needs restating: these are not two writers fighting over one record.** The flow writes ONE Event per **Order**; the publisher writes one per **Run**. They never touch the same `WhatId`, so nothing overwrites anything. The overlap is on the SHOP CALENDAR — an order scheduled through the flow shows as one block, and each of its runs shows as another. ✅ **Measured in staging:** 292 Events across 224 distinct WhatIds. Only **4** WhatIds carry more than one Event: `a3Mca000000DlM5EAK` (59), `a3Mca000000DkufEAC` (8), `a1Gca000001iAHeEAM` (3), and **`801ca00000J0oQ9AAJ` (2) — the only Order**. `Production_Run__c` ids start **`a3T`** (checked), so **no run has a duplicate event at all** — the publisher's dedupe demonstrably works. The 59-event record is a different object entirely and has nothing to do with this story. ⚠️ **The real defect is narrower than 'duplicate events':** because matching is disabled, **re-running `OrderScheduling` on the same order inserts another Order-level Event every time.** One order in staging has already done this. The publisher cannot have this bug by construction. ✅ **The hardcoded Assigned To ID is NOT an E7.4 blocker — checked, and this surprised me.** `0055e000005tFYfAAM` resolves to **Culture Operations** in **both** dev2 (`printshop@cultureapparel.com.dev2`) and staging (`printshop@cultureapparel.com.staging`), Active in both. Same id in two orgs because **sandboxes inherit production's User ids on refresh** — so `0055e0...` is the *production* id and will resolve there too. It is still a hardcoded id in a flow (it breaks silently if that user is ever deactivated) but it will not fail the promotion. **Do not raise this as a blocker; it has been checked.** ✅ **BUILT + VERIFIED IN BOTH SANDBOXES 2026-09-09 (part 1 of 2).** Anthony chose option 1 — enable matching, leave everything else alone — after confirming two things that make it safe: *"Yes people still look at both the salesforce and google calender. Yes an order does legitamatleu need more than one calender block for all of it's runs."* **The edit:** on `CreateCalendarEvent`, **Check for Matching Records** flipped from Disabled to **Enabled**, with one condition — **Related To ID Equals `recordId`** (Condition Requirements: All Conditions Are Met (AND)) — and the two defaults kept: *If a single matching record exists* -> **Update the matching record**; *If multiple matching records exist* -> **Update the most recently modified matching record**. **dev2:** was Active **V22** (`301ca00000TKM8ZAAX`) -> saved as new version and activated as **V23**, flowId **`301ca00000TpfrdAAB`**. **staging:** was Active **V35** (`301ca00000TICF3AAP`) -> **V36**, flowId **`301ca00000TpeArAAJ`**. Both read back off a **fresh page load** (not the post-save screen): toggle reads Enabled, the condition row reads Related To ID / Equals / recordId, both radio choices as above, and **Save greyed out** (no unsaved diff). Both versions carry a dated note at the top of the flow Description. 🔑 **Why matching on WhatId alone is safe:** this flow only ever writes the **order-level** Event. The multiple blocks an order legitimately needs come from **run-level** Events (WhatId = `Production_Run__c`, prefix `a3T`, written by `ProductionEventPublisher`), which this element never touches and this condition can never match. So re-running `OrderScheduling` now **updates** the one order block instead of inserting another, and the per-run blocks are unaffected. ⚠️ **The orgs were already diverged on this flow** — dev2 at V22, staging at V35 — so the version numbers do not line up and never did. Only the `CreateCalendarEvent` element was touched in either. 📌 **PART 2 IS STILL OPEN and deliberately deferred:** whether the order-level block should *disappear* once runs exist, matching the app calendar's "runs take over from the order block" semantic in `functions/api/calendar/index.js`. That is a judgement about what the shop wants to see, not a bug — **Anthony to decide after watching a real week on the Google calendar.** Do not implement it unprompted. 📌 **For E7.4:** production must inherit the **fixed** element. Build production's `CreateCalendarEvent` with matching already enabled rather than promoting the old shape and patching after. |

##### Phase H — Validation *(no code, and it is the actual gate)*

| Id | P | What |
|---|---|---|
| **E8.1** | 📝 | **CHECKLIST WRITTEN 2026-09-02 — `VALIDATION-INTEGRATIONS.md`. Not yet run: writing it is the artifact, running it is the validation.** 40 items over **eight** surfaces, not seven — access and identity is the one that tends not to get counted, and it is the seam that is currently open. Every item names the expected Salesforce record state, and the stored picklist values in its appendix were read from live dev2 data and dev2 Setup rather than copied from the code, so no item asserts a value that does not exist. Carries the run log. **Next: run it in full against staging, with date, org and result recorded.** |
| **E8.2** | 📝 | **SCENARIOS WRITTEN 2026-09-02 — `VALIDATION-SCENARIOS.md`. Not yet run.** All eight scripted, each naming the record state expected at every checkpoint **and its false pass** — the specific way it can look right while being wrong, drawn from bugs that have already shipped here (the Heat Press mis-classification reaching the order sheet; `combine.js` breaking only past twelve orders; a reprint failure wearing the "nothing to do" shape). S6 proves the reprint loop all the way round and records D5's reference-only rule as a check. ⚠️ **S6 is expected to FAIL at the make-up run step until B3's error-surfacing fix lands** — that is known, not a surprise. **Next: run S1–S8 against staging.** |
| **E8.3** | P1 | Prove coexistence with the auto-scheduler. A `Planned` run's times survive a scheduler run; a Confirmed run publishes and un-confirming deletes; a Proposal-status run is still moved, as intended; press occupancy accounts for `Planned` runs so it doesn't double-book. Partially evidenced by the PR-0085 test — finish it. |
| **E8.4** | 🔴 **P1 → treat as P0** | Shipping and Zenkraft validation. Least-exercised board, no manual retry, polls every 6s for up to four minutes, carries E5.6 and E5.10. ⚠️ **RE-RATED AND EXPANDED 2026-09-09 — it was thinner than the board deserves.** Its checklist (§8 surface 3) had **four** items, all about the label flow, and **tested neither split nor combine** despite this row claiming to carry E5.10 — the one story whose own entry says *"the Salesforce-touching paths are untested and need a real split and combine on staging."* **Six items added (3.5–3.10)**, each carrying the false pass that would otherwise make it green for nothing: split sized past the 25-subrequest ceiling (a 20-line order in two boxes is already **26** — an ordinary order, not a large one); combine past twelve orders; **Complete actually reaching Salesforce — B15, a CONFIRMED defect**, since `shipping.html:823` drops the card and writes nothing whenever the board is not live, and looks identical to success; `Complete` vs `Completed` read off the record (trap 5 — the confusion that sent B9's flow to the wrong trigger); Ship Now refused on a secondary order in a combined shipment (a banner is not a guard, and the server side is **unchecked**); and the board's own unbounded `IN` list tested against **staging**, not dev2 (B12 — dev2's ~73 board orders can never reach the limit, so testing there proves nothing). 📌 **Why the re-rate:** every other board has been driven hard in a rig this week; this one has not been touched, and it now carries one confirmed defect, an untested composite path that breaks on an ordinary order, and a live unbounded query. |
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

**D13 — an order's `Print_Date__c` is never blanked when its last run is deleted. DECIDED 2026-09-09 (Anthony).** Deleting the last run leaves the field at its last known value rather than nulling it. This was already the app's documented behaviour in `functions/api/_print-date-rollup.js` (*"leave the AM's original date alone... makes deleting the last run safe"*), and the Apex `OrderPrintDateRollup` does the same by construction — its final update is scoped to `earliest.keySet()`, so an order with no runs is never revisited. **Both sides now agree deliberately rather than by accident.** The alternative, blanking, was rejected because `calendar/index.js` windows its query on `Order__r.Print_Date__c`, so a null date removes the order from the calendar entirely — the one screen used to reschedule it — and because it would make the same delete behave differently in Salesforce than in the dashboard. 📌 **Known caveat, recorded rather than hidden:** the app's comment says the order falls back to *the AM's* date, but the rollup overwrites `Print_Date__c` as soon as a run exists, so what actually survives is the **deleted run's** start. Preserving the AM's committed date would need its own field and is a separate story if it ever matters. See **E7.7**.

**D12 — the reprint becomes opt-in, gated on the account manager. PROPOSED 2026-09-04, NOT
YET DECIDED.** Today `createReworkIfNeeded` builds the reprint automatically the moment the
last method on an order completes. Anthony wants the account manager emailed first, to
confirm the customer actually wants it; the reprint is created only on confirmation, and
then lands in the Management inbox exactly as B6 already delivers it. **This overturns the
central assumption of `_rework.js` — that damage becomes a reprint automatically "at the
moment the numbers become final"** — and replaces it with damage becoming a *question*.
What it rules out: any design where a reprint appears without a human having agreed to it,
and equally any design where declining one is indistinguishable from the reprint having
failed. ⛔ **Decisions 1, 2 and 4 answered by Anthony 2026-09-04** (Salesforce sends the email; the
decision is made on a Salesforce record, not in this app; the recipient is the Opportunity
Owner, already on the Order). **Still open: where the pending decision lives — see B9.** Do not
build against this until it carries a decision date.

**D14 — `Design__c` keeps its API name and is reparented, not renamed. DECIDED 2026-09-16 (Anthony, for his boss).** "Leave `Design__c` as is" means the **API name only**. The object becomes OBJECT-GUIDE's *Artwork Version* by changing `Opportunity__c` from Master-Detail to Lookup and hanging it under `Artwork_Master__c`. It already reads "Design Version" in Setup. **Rules out:** any rename of `Design__c` (36 Apex references, trap 15), and treating the Opportunity parent as frozen. See **S3** in §4's target-model plan.

**D15 — proof approval lives on the job, not on the art. DECIDED 2026-09-16 (Anthony).** Measured: no field on `Design__c` holds approval; it is already `Order.Artwork_Approved__c` (the flag) and `Opportunity.Artwork_Approval_URL__c` (the proof link). Those stay the home. **Rules out:** an approval field on Artwork Version or Art Spec, and any per-art approval that a reused design would carry into a new order.

**D16 — an order cannot be printed until its artwork is approved, from a start date forward. DECIDED 2026-09-16 (Anthony).** Enforced in the org (a validation rule on `Decoration__c` status) **and** in the app (before a run is created, never on the `Planned → Confirmed` PATCH, trap 9). It applies only to orders created on or after a start date held in Custom Metadata; older orders are not backfilled. **The start date is the day the whole new design is finished in Salesforce** (Anthony, 2026-09-16): when S7 is done, **ask Anthony to confirm the date**, and only the date he confirms goes into the metadata record. Until then the record's date stays blank, and a blank date means the gate is off. Only ~3.5% of staging orders are ticked today, which is why it is not retroactive. **Rules out:** an app-only gate, a backfill, and a gate that can strand a run on `Planned`. See **S2**.

**D17 — Run Result replaces "only problems are recorded". DECIDED 2026-09-16 (Anthony). SUPERSEDES D1.** The shop needs to see how far a run has got before it finishes, and needs every count logged. Each count becomes a `Run_Result__c` row under its line item: good, misprint, damaged, incomplete and a time. **Who** counted is optional and not a design concern for now; someone counting and it being logged is what matters. `Result_Status__c = Submitted` keeps its meaning of *counts are final* (reprint gate 2). D5 and the incomplete-is-not-a-loss rule both still hold. ⚠️ **Until S6 lands, D1's behaviour is still what the code does.** Do not start storing a good quantity piecemeal. **Rules out:** a single end-of-run total as the only record, and reusing staging's leftover `Actual_Good_Qty__c`. See **S6**.

**D18 — Pre-Production Item stays and keeps being created. DECIDED 2026-09-16 (Anthony).** It remains the per-line pre-press checklist and runs **alongside** Art Spec. It gains a lookup to its Art Spec and does not copy the spec's method, placement or colours. **Rules out:** retiring Pre-Production Item as OBJECT-GUIDE proposed, and two records each owning the same print facts. See **S5**.

**D19 — Work Center is `Production_Station__c`, in staging's shape. DECIDED 2026-09-16 (Anthony).** dev2 is brought up to staging's nine fields and the `Production_Run__c.ProductionStation__c` lookup, and `Active__c` becomes a Checkbox in both orgs. Account `Type='Press'` stays live until the S4 cutover. **Rules out:** designing a new Work Center object, and switching the press picker before the scheduler reads the station. See **S1**.

**D20 — a person attaches the design to the order. DECIDED 2026-09-16 (Anthony).** `Order.Design__c` (Lookup → Design Version) is set by hand, by a person, and is the order's canonical link to its art. It is populated on 4,846 of 6,697 staging orders, and nothing under `functions/` writes it. **Still check whether any flow or Apex also writes it** (S3). If one does, it must stop overwriting what a person chose. **Rules out:** automation deciding an order's artwork, and the dashboard inferring the art from the "most recently modified `Design__c` on the Opportunity" as the long-term source (today's `_mockup.js` path stays only until S3 switches it).

**D21 — `Print_Process_Details__c` is retired, whenever convenient. DECIDED 2026-09-16 (Anthony).** No review of the 5 staging rows is required. No code reads it (0 references under `functions/`). ⚠️ **Deletion is a Setup action and does not travel in a change set** (§9), so it is done by hand per org. **Production also has this object (35 fields, §9 sweep 2026-09-14) and its data was never queried.** Count its rows there before deleting it in production. **Rules out:** migrating its fields into the new model.

**D22 — production waits and gets the new model in one go. DECIDED 2026-09-16 (Anthony).** Nothing is promoted to production until S1–S7 are finished and verified in both sandboxes. Then S8 builds the whole design there once. **E7.4 as scoped (the old ~10-object build) is superseded** and is not to be built separately. **Rules out:** building the old model in production and rebuilding it later. 📌 The merge guardrail (§4 B9: `feat/proposed-run-press` needs `Proposed_Run__c.Press__c` in production) is unchanged in substance. Production stays an unconfigured org in the switcher (`SF_ENV_PRODUCTION_*` unset) until S8, and must not be pointed at before then.

**D23 — one Art Spec per design + method + placement. DECIDED 2026-09-17 (Anthony).** Front art is almost always different from back art, so a front-and-back decoration needs two recipes. Art Spec gets a placement in S4 (a lookup to the new `Placement__c`, beside nothing: Art Spec has no placement picklist to dual-write). Consequence for S5: `Decoration__c.Art_Spec__c` (one lookup) cannot describe a multi-placement decoration, so the Decoration → Art Spec join has to be per placement (the same `Decoration_Placement__c` junction S4 must decide for `Placements__c`, carrying the Art Spec). The S3 sample AS-00001 ("Front + Back") is the counter-example and should be split when S4 adds placement. **Rules out:** one recipe per design + method.

**D24 — Art Specs are not unique per design + method + placement. DECIDED 2026-09-17 (Anthony).** The three different embroidery recipes on "Calendar King Orders 20487" are test data, but they mirror real orders: the same art can be run differently from job to job. So no uniqueness rule, no duplicate check. A new job reuses a recipe by picking an existing Art Spec or copying one and editing it. **Rules out:** a unique key on (design, method, placement), and treating an Art Spec as never-changing once used.

**D25 — the Decoration transfer-type list is the right one. DECIDED 2026-09-17 (Anthony).** DTF / HTV / Sublimation / Screened Transfer / Other (`Decoration__c.Transfer_Type__c`, also `Art_Spec__c.Transfer_Type__c`). `Pre_Production_Item__c.Transfer_Type__c` (Screen Transfer / Digital Transfer / Sublimation / Vinyl) converges to it in S4, with existing PPI values remapped. 📌 **Proposed mapping, confirm with Anthony before running it:** Screen Transfer → Screened Transfer, Digital Transfer → DTF, Vinyl → HTV, Sublimation → Sublimation. **Rules out:** keeping two lists.

**D27 — how Art Specs are linked and shown. DECIDED 2026-09-17 (Anthony).** (1) The order sheet and the Pre-Production drawer show the recipe facts that belong to the decoration's method (screen print: ink colors, color order, mesh, ink type, flash, dryer; embroidery: thread colors, stitch count; heat press: transfer, temperature, time, pressure; plus size/location, print specs and notes for all). (2) A location is linked to a spec automatically **only when exactly one spec fits** — same job, method and location; a spec with no location only for a single-location decoration. (3) That rule keeps running on new and edited records, not just once. Hand-set links are never overwritten. **Rules out:** guessing between two candidate recipes, and copying recipe facts onto the item (D18). See **S5**.

**D29 — a Screen is a physical frame, not a job. DECIDED 2026-09-18 (Anthony).** `Screen__c` is one row per aluminium frame the shop owns, reused job after job: mesh, where it lives, what Art Spec is burned on it now, and whether its label has been printed. `Screen_Prep__c` and `Screen_Reclaim__c` are its **history** — one row per coat-and-burn and per strip — and `Ink_Mix__c` is **a batch of mixed ink** (pantone, mixed, remaining). The per-order "make a screen" and "mix the ink" **jobs stay on `Pre_Production_Item__c`**, where `station.html` already runs them (186 + 96 rows in dev2, 138 + 68 in staging) — consistent with **D18**. A job may point at the frame and the batch it used, and that link is **optional**, because the shop's frames are not labelled yet: the org issues the number, Anthony prints the label. **Rules out:** rebuilding the screen and ink pipelines on the new objects (a third home for the same work, and a rewrite of the one surface workers touch daily), making the frame link required before frames are numbered, and repurposing `Screen__c.Status__c`, which is frozen per build rule 1. See **S7**.

**D28 — how counting works under Run Result. DECIDED 2026-09-17 (Anthony).** (1) Salesforce totals the Run Results into the line item's existing Misprint / Damaged / Incomplete fields (plus a new Good_Qty__c), so the reprint builder, shortfalls, the skeleton flow and the damage email keep reading what they read today. (2) Submit still means "counts are final"; the org refuses count changes on a submitted run, and a **manager can reopen** it (manager PIN). (3) Migrated counts get **good = planned − problems**, ticked as estimated. (4) **Good is optional** on a count. **Rules out:** rewiring every reader onto new roll-ups, deleting counts after submit without a reopen, and forcing a good number on every count. See **S6**.

**D26 — the order-creation flow keeps writing `Order.Design__c`. DECIDED 2026-09-17 (Anthony); amends D20.** Flow *Order and Order Items Subflow Design* (active v48) sets `Order.Design__c` from its `DesignID` input when it creates an Order. It stays, unless it would cause a critical failure. Checked 2026-09-17: it writes only on **create** (a `recordCreates` element; no update of an existing Order), so it never overwrites a design a person later chose, and after S3 a design no longer disappears with its Opportunity (lookup, clear on delete), so the link it writes stays valid. No critical failure found. A person still attaches the design on orders made by hand. **Rules out:** removing that assignment from the flow.

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

✅ **RE-VERIFIED 2026-09-09, and this time the flag in §4 can come off.** The 2026-09-03 read that
came back empty was the folder erroring; `stats.html` on `origin/main` is 49,201 bytes and the fix is
at `:688`. Re-run in a browser against a `wrangler pages dev` rig whose stub **records every request
server-side**, because the one claim a code read cannot settle is whether a `keepalive:true` fetch
fired during a navigation actually arrives:

| | Result |
|---|---|
| Reproduced the trap first | with an identity seeded, `login.html` showed *"Welcome, Gian · MANAGER"* and the board list — **no PIN pad** |
| `localStorage` after tapping Switch Account | `caShopWorkerName`, `caStationWorkerName`, `caShopRole` all **`null`** |
| `POST /api/worker-logout` | **received by the server, once** — confirmed in the stub's own log, not in the network panel |
| `login.html` on arrival | **"Enter your PIN to continue"** |

Sweep re-run across all seven boards that have a Switch Account: every one reaches
`clearIdentity()` — five via their own `switchUser()`, `calendar.html` via `onSwitchUser()` (`:1223`),
`stats.html` inline (`:695`). `order-sheet.html` and `login.html` have no switch, correctly.
📌 Worth knowing: **`stats.html` is the only board that navigates to `login.html`** to switch; the
other six clear and re-open their own PIN gate in place (`nameOk:false`). Both end at a PIN prompt,
so this is a difference in feel, not in safety.

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

1. ✅ ~~**`results.submit` appears in exactly one place in the codebase — the check itself.**~~
   **CLEARED 2026-09-09.** It is in `DEFAULT_MANAGER_CAPS` (`_session.js:78`) *and*
   `DEFAULT_WORKER_CAPS` (`_session.js:107`). E6.5 fixed this; §4 records the fix and this section
   did not. One trap left, not two.
2. **`confirmManager()` confirms via `POST /api/worker-login`, which also issues the signed
   `ca_sess` cookie.** A successful manager confirmation therefore leaves that tablet's server
   session as that manager. Inert while `requireCap` is report-only. Needs an answer before
   enforcement.

⚠️ ~~Current state, confirmed by grep: **4** route files call `requireCap`, against **24** files
with POST/PATCH/DELETE handlers. `verifyStationToken` has zero callers.~~ **RE-MEASURED 2026-09-09,
and both halves were out of date.** Today: **23** files carry a mutating handler and **21** of them
call `requireCap`. The two that do not are `worker-login` and `worker-logout` — requiring a session
to create one is circular, and they are deliberately open. `verifyStationToken` is **gone** (E6.6
deleted the whole station-token system); only its post-mortem comment survives in `_station.js`.
📌 The 4-of-24 figure predates E6.5 by a day. It is left visible rather than deleted because a
stale *measurement* is the specific thing this file's rule 1 warns about, and it sat here for a
week reading as current.

Run report-only for at least five working days and read every `[access] would deny` line before
flipping the flag.

---

#### Not Claude Code's

Listed so nothing is picked up twice.

- **Anthony / ops:** E6.4 (Cloudflare Access), E7.5 (production env config), and every product
  decision — including the open one on cleared allocation rows.
- **Peter Larson:** E7.2 (Apex test classes — the long pole on the whole project, start now),
  E7.4 (metadata promotion).
- **This Claude project, via Salesforce in Chrome:** E7.1 staging half, E7.3, E7.6, E7.8,
  E2.3 field + FLS verification, and running the E8 checklists against a real org.
  🔴 **B19 (new, 2026-09-09) belongs here and is P0** — find which Order automation reverts
  `Print_Date__c`. Start with *Where is this used?* on the field, then the 19 Order-update flows,
  then diff order **00013493** (which accepts the write) against **00013467 / 00013511 / 00013508**
  (which revert it). ⛔ **E7.7 is blocked on it** — E7.7's code is correct and already deployed; it
  cannot work until B19 is answered, so do not re-open the trigger or the rollup class.
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

#### B7 stage 1 · Setup / production time on the method cards — ✅ BUILT, do NOT rebuild it

⚠️ **Correction, 2026-09-09.** This entry said READY TO BUILD and carried a full build brief. **It
had already been built** — three commits, all reachable from `fix/e2.6-run-order`
(`feat/b7-stage1-method-timers`, `fix/b7-stage1-idle-state` `320dbe2`,
`feat/b7-live-on-this-device` `eec061a`), and §4's table still marked it `🔵 P1` while the code was
on disk. This is the second time in two days that a *completed* story read as untouched here; the
first was the B9 code half. 📌 **The brief below is left in place because it is still the right
spec** — and because the shipped version deviates from it in two named ways (see the B7 row in §4),
so the two are worth reading together. **What is actually left: the dev2 verification pass.**

**Blocked half is stage 2 only.** Stage 1 has no blocker. Full story in §4 under **B7**.

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

#### B9 (code half) · ✅ ALREADY BUILT 2026-09-08 — do NOT rebuild it

⚠️ **Correction, 2026-09-09.** An earlier draft of this entry said the B9 code half had not started
and carried a prompt to build it. **That was wrong** — it was written from stale session memory and
contradicted this file's own change log. The code half was **built on 2026-09-08**. Rule 1 of this
document applies to me as much as anyone: record what was measured. What follows is the measured
state.

✅ **BUILT, branch `feat/b9-optin-reprint`, UNPUSHED.** Files: `functions/api/_rework.js`,
`functions/api/inbox/index.js`, `functions/api/rework-check.js`.

🔑 **The gate is inside `createReworkIfNeeded`, not at the call sites — and that is deliberate.**
There are two callers (`production-methods/[id].js:290` and `run-results/index.js:525`) because
printing finishing and counting finishing are different moments and either can be last. A gate at
one would simply let the reprint fire from the other. **So neither caller changed, and a third
caller added later inherits the gate for free.** Do not "fix" this by moving the gate outward.

📌 Other properties worth not rediscovering: the gate sits **after** the damage gate, so a clean
order never claims the AM (verified — zero-damage completed order returns `nothing_to_rework` and
writes nothing). **Org detection is field presence, not config** — `Misprint_Outcome_By__c` is
probed via `runQueryOptionalField`, because one KV-switched deployment serves three orgs and an env
flag cannot tell them apart. **Any probe failure falls back to the legacy path on purpose**: that
reproduces today's loud behaviour rather than failing silently toward never building a reprint.
Approved reprints are built by a bounded sweep on the Management inbox — no callout, no cron.
`rework-check` learned the four new states.

⛔ **What is actually left, and why B9 is still on hold:**

1. **The flow entry criteria must change before activation.** The flow currently triggers on
   `Order_Substatus__c = 'Completed' AND Misprint_Outcome__c is null`, which has **no damage
   condition** — see §4 B9. It must be re-pointed to trigger on `Misprint_Outcome__c` becoming
   `Awaiting AM`.
2. **Both B9 flows remain saved INACTIVE in both sandboxes and the email stays OFF** until the
   branch is pushed. Activating first means AMs get asked to confirm reprints that the code then
   creates anyway.
3. **`refs/heads/feat/b9-optin-reprint` is one of the two broken git refs** listed below (dated
   2026-09-08 20:25). **Establish whether the branch and its commit are still intact before
   planning anything else on B9** — that is the first question, not a footnote.

📌 **If the branch turns out to be lost**, the story in §4 B9 carries enough detail to rebuild it:
the gate's location and rationale, the two call sites, the field-presence probe, and the fallback
behaviour are all recorded above and there. 🚩 And if you do rebuild: **`grep` silently skips files
it cannot read** — iCloud eviction makes a file answer `Resource deadlock avoided` and grep just
omits it, with no error and no exit code. That is how the second call site was missed on the first
pass. Verify a call-site list with explicit per-file reads and confirm you found **two**.

---

#### B11–B18 · The 2026-09-09 code read — all eight are Claude Code's, all eight are unblocked

**Added 2026-09-09.** Full write-ups in §4; this is the hand-over view. Nothing here waits on
Salesforce, ops, or a decision from Anthony. ⚠️ **All eight were found by reading the code and none
was reproduced against a live org** — so each entry below names the check that turns a reading into a
measurement, and that check is part of the story, not optional afterwork.

| Id | P | Files | The change |
|---|---|---|---|
| ~~**B11**~~ | ✅ DONE | `functions/api/run-results/index.js:566` | ✅ **Shipped 2026-09-09**, branch `fix/b11-composite-status`, commit `81b67ec`, unpushed. Reproduced first, both controls unchanged. See §4 for the harness and the false-pass it started with. |
| **B12** | 🔴 P0 | `functions/api/production-orders/index.js:221` | Route the OrderItem fetch through `runChunkedIdQuery` (already imported at `:36`). Then the five siblings listed in §4. |
| **B13** | 🔴 P0 | `functions/api/calendar/index.js:430` + `calendar.html` | Carry `runsUnavailable`; suppress `needsScheduling` and `suggestion` when runs are unknown; make the board say so. **Both halves, or it changes nothing.** |
| **B14** | 🔵 P1 | `counting.html:293` | Move the `{{err}}` banner out of the `runReady` block; keep `e` and put it through `errText()`. |
| **B15** | 🔵 P1 | `shipping.html:823` | Route Complete through `canWriteNow()`. Same file: the `text()`-less search haystack at `:846`. |
| **B16** | 🔵 P1 | `functions/api/mockup-proxy/index.js:277` | Pass `raw`, not `current.toString()`. |
| **B17** | 🔵 P1 | `functions/api/_ppi-checklist.js:109,144,160,177` | Read `ok`; log and return `null` on failure. **Do not make it throw** — rollups never fail their caller. |
| **B18** | 🔵 P2 | `functions/api/run-line-items/index.js:253,344,376` | Compare on `.slice(0,15)`, matching `run-results/index.js:436`. |

**Sequencing, and it is not the table's order.** **B12 first** — not because it is the worst, but
because the check is one query and the answer changes how urgent it is (staging has ~2,164 completed
orders against dev2's 81; if it is already failing there, it stops being a code story and starts
being a live incident). **Then B11**, which is the highest-consequence single line in the list.
Everything else can go in any order.

📌 **B11, B17 and B13 are the same defect wearing three hats** — a failure that reaches the caller as
success, as silence, and as emptiness. If only one gets done, do B11: it is the one where the app
manufactures the evidence that a human did something.

⚠️ **Do not batch these into one commit.** One story per commit with the Asana id, as always — and
these in particular will want to be reverted independently, because three of them change what an
endpoint returns on a failure path and that is exactly the kind of change that surprises a board.

⚠️ **B12 and B13 both change behaviour under failure, which is the hardest thing here to test.** The
tool that fits is the one E2.6 and B8 already used: a `wrangler pages dev` rig against a fake
Salesforce that can be told to fail one specific query. **Assert on what the endpoint returned, not
on what the board rendered** — every one of these bugs renders as a working page.

📌 **Before switching or creating a branch:** `PRODUCTION-DASHBOARD-INFO.md` is **untracked** and in
no commit anywhere (corrected 2026-09-09 — see §0 rule 4). A checkout will not touch it, but there is
also no copy to fall back on. Back it up outside the repo, and commit it.

---

#### Open loops carried into the next project — 2026-09-09

Nothing here is broken. These are threads that were deliberately left mid-air, listed so a new
session does not have to reconstruct them from the change log. Each says who it is waiting on.

**Waiting on Anthony (do not start these unprompted):**

| Thread | State | What is needed |
|---|---|---|
| **B9 code half** | ✅ **already built** on `feat/b9-optin-reprint`, unpushed; both flows saved **INACTIVE**; email OFF | ✅ **Ref confirmed intact 2026-09-09** — it holds `b47c233`, which is already in `fix/e2.6-run-order`’s history; the “broken ref” was iCloud eviction (see the debt list below). So: change the flow entry criteria to `Misprint_Outcome__c` = `Awaiting AM`, push, and only then activate |
| **E5.8** | Branch `chore/e5.8-delete-priority-rollup` is done and unpushed | Anthony pushes; the story then closes outright |
| **E7.8 part 2** | Part 1 shipped (V23 dev2 / V36 staging) | Anthony to watch a real week on the Google calendar and decide whether the order-level block should disappear once runs exist |
| **`feat/received-status`** (`0f98aca`) and **`feat/b8-runs-left`** | Built, unpushed | dev2 verification, then push |
| **B7 stage 1** (3 branches), **B10** (`feat/method-colours`), **E2.6** (`fix/e2.6-run-order`) | Built, unpushed. All three verified in a rig, **none against dev2** | The same dev2 pass the two rows above are waiting on. Worth doing as one sitting on one order rather than three |
| **Misprint_Outcome trio Descriptions** | Renamed fields still carry Descriptions citing the deleted `Reprint_Decision__c` | A hand edit by Anthony — see §2, the Order custom-field edit page wedges the renderer |

**Carried technical debt (safe to leave, expensive to forget):**

- **E7.3** — both Global Value Sets are built, but **there is no UI path to repoint an existing local
  picklist to a Global Value Set** (no "Promote to Global Value Set" button exists). The four
  existing `Print_Location__c` fields therefore cannot adopt them. The value now sits entirely with
  **E7.4**: create production's two fields **from the shared set** at build time. Do not re-litigate
  the repoint; it was checked.
- **E7.7** — built and verified in both sandboxes, but the **execute-test was never run** (delete a
  run from a multi-run order in dev2 and confirm `Print_Date__c` rolls back correctly). Coverage on
  `ProductionRunTrigger` and `ProductionRunTriggerHelper` is **0%**, and **E7.4 needs 75% org-wide**
  to deploy. That test debt is E7.4's blocker, not E7.7's.
- **B9 leftovers** — the email template and Email Alert are now **orphaned in both orgs** after the
  flow was repointed at the formula field. The Send Email element's API name is still
  `Send_Reprint_Email_Fallback`, which no longer describes what it does. Two unverified assumptions
  remain in that flow: that the Task's `WhatId` works on Orders (i.e. that Orders have activities
  enabled), and whether the null check should be `Is Null` or `Is Blank`.
- ✅ ~~**Two broken git refs** — `refs/heads/feat/b9-optin-reprint` and `feat/method-colours`.~~
  **NOT BROKEN — diagnosed and recovered 2026-09-09.** Both refs were intact all along and hold
  `b47c233` (B9) and `25a2a15` (B10) — **commits that are already in `fix/e2.6-run-order`'s own
  history**, so no work was ever at risk. 🚩 **The cause was iCloud eviction, not git corruption:**
  the two 41-byte ref *files* were dataless on disk, so `cat` gave `Resource deadlock avoided` and
  git reported `warning: ignoring broken ref`. Forcing macOS to hydrate the two files restored them,
  and `git branch` lists both again. 📌 **Read `warning: ignoring broken ref` on this mount as
  "evicted", not "lost" — hydrate before you conclude anything.** Same pathology as the
  30-minute unreadable-file incident recorded above, reaching the ref layer instead of the worktree.

**Test identity:** the address to test either org's email path with is
**`anthony@cultureapparel.com`**. 🚩 Remember the sandbox scrambling trap in §4 — Salesforce appends
`.invalid` to every `User.Email` on refresh, but **custom field data is not scrambled**, so
`Opp_Owner_Email__c` holds *real, un-scrambled* addresses inside the sandboxes. That is a live
hazard, not a curiosity: an alert pointed at that field can reach a real customer from a sandbox.

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

⚠️ **Items 3.5–3.10 added 2026-09-09.** Everything above this line was written 2026-09-02 and covers
the label flow only. **E8.4's row in §4 says it carries E5.6 and E5.10 — and until now this surface
tested neither split nor combine at all.** These close that, plus the three shipping-board defects
found in the 2026-09-09 code read.

- [ ] **3.5 — SPLIT a shipment on an order big enough to cross the composite ceiling.** This is the
      E5.10 path and it has **never run against an org** — its own entry says so. ⚠️ **Size the test
      deliberately:** split emits **1 leg + N items + 1 shipment + 1 package PER BOX**, so a
      20-line order in two boxes is already **26** sub-requests, past the hard cap of 25. That is an
      ordinary order, not a large one. *Expected: every leg, `zkmulti__MCShipment__c` and
      `zkmulti__MCPackage__c` row present, the OrderItems PATCHed, and the chunking in
      `_composite.js` carrying `@{ref.id}` references across the chunk boundary correctly.*
      > 🛑 **False pass:** a split that "worked" on a 6-line order. Under the ceiling it never
      > chunks, so it proves nothing about the code this item exists to test. **Count the
      > sub-requests before you trust the result.**
- [ ] **3.6 — COMBINE, past twelve orders.** Combine's real ceiling moved from 12 to 25 with E5.10
      and has not been exercised since. *Expected: one shipment, the `Order` master flags set on
      every member, and no half-built state.*
      > 🛑 **False pass:** the shape §8's own S-scenarios warn about — `combine.js` breaking only
      > past twelve orders means a ten-order test is green and meaningless.
- [ ] **3.7 — Complete actually reaches Salesforce.** Mark an order Complete from the board, then
      **open the record**. *Expected: `Order.Status` = **`Complete`**.* 🚩 **This is B15 and it is a
      confirmed defect, not a hypothetical:** `shipping.html:823` calls `finish()` — clears the
      poll, drops the card off the board, closes the modal — **without writing anything** whenever
      the board is not live. The visible result is identical to success. `canWriteNow()` /
      `reportBlockedWrite()` are defined in that same file at `:668` and used by `setLabelPrinted`
      nine lines below; Complete does not use them.
      > 🛑 **False pass:** doing this while the board is live. **Test it on a board in demo mode** —
      > that is the state this defect exists in, and a shipping desk on a board that quietly
      > dropped to demo would mark orders complete all afternoon with nothing landing.
- [ ] **3.8 — `Complete`, not `Completed`.** Read the stored value back off the record, not the
      board. *Expected: the string **`Complete`**, no "d".* Trap 5. `Order.Status` and
      `Production_Method__c.Status__c` differ by one letter, and that exact confusion is what sent
      B9's flow to the wrong trigger — it fired on the shipping completion instead of production
      finishing. Nothing else on this surface asserts it.
- [ ] **3.9 — Ship Now is refused on a secondary order in a combined shipment.** Open an order whose
      drawer shows *"this order ships together with Order X — print the label from that order
      instead"* and tap Ship Now. *Expected: the action is refused, and `Shipping_Label_Printed__c`
      on the secondary order is **unchanged**.* ⚠️ **A banner is not a guard** — the button's only
      `disabled` binding is `modal.shipBusy` (`shipping.html:183`), so the wizard opens and, if a
      shipment lands, the poll marks the flag on the wrong order. **Whether `shipments/combine.js`
      refuses it server-side is UNCHECKED** — that is the thing this item is really asking.
- [ ] **3.10 — The board's own query survives a large org.** Load the shipping board against
      **staging**, not dev2, with the network tab open. *Expected: JSON, and every card carrying its
      shipment count.* `shipping-orders/index.js:117` builds an **unbounded `IN` list** from every
      Post-Production order — one of B12's six. An over-long IN list is an **HTTP-level rejection,
      not a SOQL error**, and this one fails open, so the board renders fine with the counts missing.
      > 🛑 **False pass:** running it on dev2. **Corrected 2026-09-09:** the "~73 orders on
      > the board" written here on 2026-09-09 was wrong — those 73 are the **production** board
      > (`/api/production-orders`). dev2's **shipping** board returned `totalSize: 0`. Either way the
      > conclusion stands and gets stronger: dev2 cannot reach the limit.
      > **This item is only meaningful against staging.**

###### Surface 3 run log

| Item | Date | Org | Result | Evidence |
|---|---|---|---|---|
| 3.1 | 2026-09-11 | dev2 | 🟢 **PASS** | `GET /api/orders/:id/zk-wizard-url` → **200**, URL is `/apex/Wizard` on **`cultureapparel--dev2--zkmulti.sandbox.vf.force.com`** with `CF00NRi000001mOHB_lkid` = the order's 15-char Id. So `SF_ZK_ORDER_FIELD_ID_DEV2` **is** set and points at the right order. Confirmed again through the UI: Ship Now called `window.open` with that same host. ⚠️ **Scope:** this proves the URL is built correctly and targets the right order; it does **not** prove the wizard page renders — that needs 3.2. |
| 3.2 | 2026-09-11 | dev2 | 🟢 **PASS — both stated expectations met** | Order `00013399` / GOA **20460-4**, clean fixture (0 shipments, flag `false`). Ship Now captured baseline **0** and started the poll; a real `zkmulti__MCShipment__c` row was then created (UPS · `1ZLABELTEST0911` · 6 lbs); within ~3 ticks the poll saw `1 > 0` and fired `setLabelPrinted(id, true, true)`. **Read back off the record: `Shipping_Label_Printed__c` = `true`, `ShipmentCount` = 1.** Drawer shows the green **"Shipping Label Printed"** banner and the toggle flips to *"Not shipped yet — undo"*. ⚠️ **Scope — read this before calling the whole path green:** see below. |
| 3.3 | 2026-09-11 | dev2 | 🟢 **PASS** | Run against order `00013417` / GOA **20461-2**, which 3.5 had just given **3 shipments** — a stronger fixture than the 1-shipment order planned. Ship Now (the button correctly reads **"Ship Another Package"**), wizard not completed. `Shipping_Label_Printed__c` read back off the record: **still `false`**. The E5.6 regression does not bite. |
| 3.4 | 2026-09-11 | dev2 | ⚠️ **PARTIAL — half of what the item asks for is missing** | **Never reads as success:** ✅ 4 consecutive failed poll ticks, flag stayed `false`. **Baseline read fails:** ✅ explicit amber toast, *"Couldn't check this order's existing shipments, so it won't be marked shipped automatically. Use Mark Shipped once the label is printed."* — poll never starts. **Poll ticks fail after a good baseline:** 🔴 **nothing at all.** See below. |
| 3.5 | 2026-09-11 | dev2 | ⚠️ **PARTIAL — split WORKS, but the ceiling was not crossed and cannot be on dev2** | 5-line order `00013417` split into **3 boxes** → **HTTP 200**, 3 legs, 3 `zkmulti__MCShipment__c` (trackings `1ZSPLITBOX1/2/3`) and 3 `zkmulti__MCPackage__c` (10/12/8 lbs) all read back off the records. Sub-requests: HEAD1 **3**, HEAD2 **3**, TAIL **8** — nothing chunked. 🚩 **Both this item's sizing formula and my own 2026-09-09 correction of it were wrong; see below.** |
| 3.6 | 2026-09-11 | dev2 | 🔴 **FAIL — and not for the reason this item expected** | 13 orders selected in the real modal (12 + primary), carrier UPS, weight 42. `POST /api/shipments/combine` → **502 `create_failed`**, `failedRef: "leg0"`, Salesforce code **`STRING_TOO_LONG`**. **Re-run with 2 orders: identical failure.** Combine is non-functional at every size. See the analysis below. |
| 3.7 | 2026-09-11 | dev2 | 🟢 **PASS (live)** + 🔴 **B15 confirmed (demo)** | **Live:** order `00013498` (GOA 20487-10, Pick-Up) marked complete from the drawer → `POST /api/orders/801ca00000TPYLGAA5/complete` → **200**, record reads `Status = "Complete"`. **Demo:** board forced to demo by failing the board fetch; the confirm fired, the card dropped, the drawer closed, **zero network calls were made** (the complete-call counter stayed at 1, the live one) and **no message was shown**. B15's mechanism is exactly as described. |
| 3.8 | 2026-09-11 | dev2 | 🟢 **PASS** | Read off the record, not the board: the stored string is exactly `Complete`. **No "d".** Trap 5 does not bite here. |
| 3.9 | 2026-09-09 | dev2 | 🔴 **FAIL** (by code read, nothing touched) | Three files, no guard anywhere: `orders/[id]/zk-wizard-url.js` has **no `Master_Shipment_Order__c` check**; `orders/[id].js:71` allows `Shipping_Label_Printed__c` **unconditionally**; `shipping.html:183`'s only `disabled` binding is `modal.shipBusy`; the `combinedNote` banner at `:938` is **presentational**. The item asked "is it refused server-side" — **it is not, on any of the three layers.** Live confirmation wants a real master/secondary pair. 🛑 **Now hard-BLOCKED:** the only way to create one is combine, and 3.6 proved combine is non-functional in dev2 at any size. **3.9's live half waits on the `Name__c` fix.** |
| 3.10 | 2026-09-11 | **staging** | 🟡 **N/A — the item's premise is wrong, but the defect is confirmed by construction** | Anthony switched the active org to staging. Board loaded **Live**, **HTTP 200**, valid JSON, 11 orders, ~455 ms. 🚩 **Staging's shipping board is 11 orders — SMALLER than dev2's.** The IN list is ~340 characters against a ~16 KB ceiling. **"This item is only meaningful against staging" is false**; no org the shop has can reach the limit. Analysis below. |

✅ **3.7's blast radius as written IS overstated — settled by running it 2026-09-11.** The item says a
desk "would mark orders complete all afternoon with nothing landing". Two things stop that, both
observed on screen:

1. **Demo mode never shows real orders.** `load()` (`shipping.html:477-485`) sets
   `orders: this._demoOrders` on the same failure that sets `connection:'demo'` — the two always move
   together. The board dropped from 16 real cards to the **3 demo orders** the instant the fetch
   failed. A real order cannot be silently completed, because a real order is not on screen.
2. **It is not quiet.** The header dot went amber and read **Demo**, and the board drew an explicit
   banner: *"Could not reach Salesforce — showing demo data. Do not work from these numbers."*

**B15 is still real, and still worth fixing** — it is a consistency defect, not a data-loss one.
`completeOrder` (`:823`) is the **only write path in the file that reports nothing**:
`setLabelPrinted` uses `canWriteNow()`/`reportBlockedWrite()`, `submitSplit` (`:759`) and
`submitCombine` (`:803`) both surface *"Not connected to Salesforce (demo mode)"*. Complete calls
`finish()` silently. **Re-rate B15 from "silently loses completions" to "the one write that doesn't
say it was blocked".**

🚩 **NEW, and the sharper half of this — the DRAWER carries no demo warning.** The
"do not work from these numbers" banner is drawn on the **board list**. The Complete button lives in
a **full-screen drawer**, and that drawer is pixel-identical in demo and live — same title, same
contact block, same green button. On a shop tablet the operator is *in the drawer*, not looking at
the list behind it. So the honest statement of the risk is: **the warning exists, but not where the
decision is made.** Both states screenshotted 2026-09-11. Worth its own story: carry the demo state
into the drawer (a strip above the action button), which also fixes B15 for free.

🚩🚩 **NEW TRAP — a read-back through the proxy can be SERVED FROM BROWSER CACHE.** Immediately
after the successful Complete, re-reading the record through `GET /api/production-orders` returned the
**pre-write value** (`Status: "Enter Tracking"`) while the board query already reflected the change.
Re-reading with `cache: 'no-store'` and a cache-busting param returned `"Complete"`. **A stale read is
indistinguishable from a write being accepted and then reverted.** `complete.js:56` sets
`Cache-Control: no-store` on its own response, but the GET endpoints used to verify writes do not.
➡️ **Any browser-side verification of a write must use `cache: 'no-store'` plus a cache-buster.**

❌ **CORRECTION 2026-09-11 (same day): I wrote here that this "may invalidate B19's evidence." It does
not, and that claim was wrong.** I extended a browser finding to a measurement that never touched a
browser. **B19 was measured in Apex, in the Developer Console, reading back inside the same
transaction as the `Database.update`** — see the code block in B19's own section. There is no HTTP
layer, no proxy and no browser cache anywhere in that path. **B19 stands exactly as written: P0,
`isSuccess() = true` with the stored value unchanged, 3 of 4 orders.** The lesson is mine, not B19's:
*check which instrument produced a finding before deciding a new trap undermines it.*

⚠️ **3.2's scope: the poll→flag mechanism is proved; the carrier wizard's Print button was NOT
pressed.** The `zkmulti__MCShipment__c` row was created through the app's own
`POST /api/shipments`, and `window.open` was intercepted so the Zenkraft wizard never opened.
**No carrier label was bought.** What that does and does not establish:

- ✅ **Proved:** a Shipment record appearing above the baseline makes the poll set
  `Shipping_Label_Printed__c = true` on the real record, and a Shipment record exists — which is
  literally what 3.2 asserts. The whole E5.6 baseline→poll→mark chain ran for real.
- ⚠️ **Not proved:** that Zenkraft's own Print writes a row the poll's query can see.
- 🔎 **But that gap is narrow, and here is the evidence.** dev2 carries **three shipment rows this app
  did not create** — `Shipment-00002947`, `-00002950`, `-00002951`, dated **2026-07-15/20**, carriers
  `UPS` and `FedEx Ground`, auto-numbered `Name` — on orders `20460-6`, `20482-2` and `20462-3`.
  **The app's own `Order__c` query finds all three**, which is exactly the linkage the poll depends
  on. So rows created outside this app do surface to the poll. ℹ️ Their tracking numbers are 3 and 7
  characters, so they are hand-entered test data rather than real carrier labels — they demonstrate
  the linkage, not the wizard.
- ➡️ **To close it completely**, someone presses Print in the wizard once with the drawer open and
  watches the flag flip. Anthony reports 3.2 works, which is consistent with everything above.

🟡 **3.10 run against staging 2026-09-11 — the item cannot be executed as written, and the reason
is worth more than the test would have been.**

**The load half is untestable anywhere the shop has.** Board sizes measured this week:

| Org | Shipping board orders | IN-list size |
|---|---|---|
| dev2 | **0** (17 only because I built fixtures) | trivial |
| **staging** | **11** | ~340 chars |
| production | not measured | — |

Staging is the **smallest** of the three, not the largest. Both this item's false-pass note and my
2026-09-09 correction of it assumed the opposite. **Rewrite the item**: it cannot be validated by
loading a board, only by reading the code or by synthesising several hundred orders.

**The defect itself is nonetheless confirmed, by construction rather than by load:**
- `_sf.js:283` — `runQuery` sends SOQL as a **URL-encoded GET query string**
  (`/query/?q=${encodeURIComponent(soql)}`). So an over-long `IN` list really is an **HTTP-level
  rejection** (414/431), not a SOQL error — the item's central claim is correct.
- `shipping-orders/index.js:117` builds that list from **every** board order, unchunked.
- The follow-up sits in a try/catch that **fails open to `ShipmentCount: 0` for every order**.
- 🚩 **The safe helper already exists in the same file it imports from.** `_sf.js:251,269` export
  `SOQL_IN_CHUNK = 200` and `runChunkedIdQuery`. This call site is the one that does not use them.
  That makes the fix a two-line change, not a design question.
- **Threshold:** each Id costs ~27 URL-encoded characters (`%27` + 18 + `%27` + `%2C`). Against
  Salesforce's ~16 KB query-URI limit that is roughly **600 orders on the board at once** — not a
  number a shipping board reaches. ➡️ **Re-rate B12's shipping-board instance from "live unbounded
  query" to "unbounded, but the fail-open is the real defect."**

✅ **What WAS proved on staging, and it is the half that matters:** *the board gives you no way to
tell a genuine zero from a failed query.* All 11 staging cards show `ShipmentCount: 0` and no
"N shipments logged" badge. That is **exactly** what a rejected IN list would look like. It was only
possible to tell them apart by going around the board: `GET /api/shipments?orderId=` — which
**does not** fail open (`shipments/index.js:50-52` returns `query_failed`) — answered 200 with 0
records for three of them, so staging's zeros are real. **A shipping manager has no such route.**

🔴🔴 **And the bigger find, read-only, no write to staging: THE COMBINE `Name__c` BUG TRAVELS.**
`GOA_Order_Number__c` in **staging** returns the same HTML anchor — measured **51–53 characters**
across four orders (`17490-2` is 7 characters of actual content wrapped in 53). The `Name__c` a
2-order combine would build on staging is **121 characters**, identical to dev2. The defect is in the
**formula field's definition, which is the same in every org**, not in dev2's data — so **combine is
broken in staging today and will be broken in production on the day it ships.** No write was needed
to establish this. ➡️ This belongs on the **E7.4** list as a blocker, not just an E8.4 finding.

📌 **Staging inventory, for whoever runs this surface next:** 19 orders on the production board
(17 `Completed`, 1 `Pre-Production`, 1 `Post-Production`), 11 on the shipping board
(5 Local Dropoff, 3 Pick-Up, 2 Shipping, 1 blank), **0** labels printed, **0** combined shipments,
**0** `zkmulti__MCShipment__c` rows. Staging is **emptier than dev2** — so 3.5's 13-line order is not
there either. ℹ️ The board's 11 vs the production board's 1 `Post-Production` is **not** a bug: the
two endpoints are rooted differently on purpose (Order vs `Production_Method__c` — see
`shipping-orders/index.js`'s header). Staging simply has 10 Post-Production orders with no production
method on them.

🔴 **3.4's real gap: the poll dies silently when it times out.** `startPolling` (`shipping.html:638`)
has two distinct failure moments and they are handled very differently:

| Moment | Behaviour | Verdict |
|---|---|---|
| Baseline read fails before the poll starts (`before == null`, `:620-628`) | Explicit amber toast naming the problem **and the recovery** ("Use Mark Shipped once the label is printed"), poll never starts | ✅ this is the E5.6 fix, and it is good |
| A poll tick's fetch fails (`if(list == null) return;`, `:650`) | Skipped in silence — correct for one tick | ✅ |
| **Every** tick fails until `tries > POLL_MAX_TRIES` (`:643`) | `this.clearPoll(); return;` — **no message, no state change, nothing on screen** | 🔴 |

Observed 2026-09-11: baseline succeeded, then 4 ticks failed in a row, and the drawer was **pixel
identical** the whole time — no error, no "still checking", no spinner. The operator has printed a
label in the Zenkraft tab, comes back, and the order is simply not marked, with nothing to explain
why. It is not a *false* success, so the item's literal wording passes; but the item also asks for
**"an explicit error state"** and on this path there is none. ➡️ **Story: make the timeout say
something** — the `:643` branch should raise the same toast the baseline path already has. The wiring
is already there (`window.CAApi.toast`); it is one line.

🚩 **Two smaller UI findings picked up in passing, both worth stories:**
1. **A failed combine shows the operator the raw error code.** The red banner in the combine modal
   read exactly **`CREATE_FAILED`** — screenshotted. `submitCombine`'s catch (`:809`) uses
   `e.data.error` directly, while `ca-api.js` already exports `errText` / `sfErrText` for precisely
   this. A shipping manager gets an uppercase token and no idea what to do.
2. **"Mark Shipped (no Zenkraft record yet)" is shown directly beneath three Zenkraft records.**
   `:963` picks that label off `Shipping_Label_Printed__c` alone and never looks at the shipment
   list, so on any re-ship, second box or split — exactly the 3.3 case — the button contradicts the
   list above it. Screenshotted on `20461-2` with 3 shipments logged.

⚠️ **3.5's sizing arithmetic was wrong in the item, and wrong again in my 2026-09-09 note. Read
`split.js` before sizing this test.** The real shape (`split.js:157-232`) is:

| Phase | Size | Chunks? |
|---|---|---|
| HEAD 1 — legs | **G** (one per box) | no, hard-fails above 25 (`too_many_groups`) |
| HEAD 2 — shipments | **G** | no, same |
| TAIL — item PATCHes + packages | **N + G** | **yes, at 25** |

where **G = boxes** and **N = line items**. Two things follow, and both kill the published sizing:

- **Items are DISTRIBUTED across boxes, not repeated per box.** The item's "1 leg + N items + 1
  shipment + 1 package PER BOX" is not what the code does, so its headline example — *"a 20-line
  order in two boxes is already 26"* — is wrong: that is G=2, N=20 → HEAD 2, HEAD 2, TAIL **22**.
  Under the cap. It would have passed and proved nothing.
- **My 2026-09-09 correction ("a 5-line order in 4 boxes = 32") was also wrong**, and additionally
  impossible: `split.js:102` rejects any box with no items (`group_needs_items`) and forbids an item
  in two boxes (`:104`), so **G ≤ N**. A 5-line order can never exceed 5 boxes.

➡️ **Correct threshold: the tail chunks when `N + G > 25`.** With G ≤ N that needs **N ≥ 13** —
an order with at least thirteen line items. **dev2's largest order has five**, so **3.5's chunking
half is not testable on dev2 by any arrangement of boxes.** It needs a wider order (build one, or run
on staging).

🚩 **And the thing the item says to check is not what the code does.** 3.5 expects *"the chunking in
`_composite.js` carrying `@{ref.id}` references across the chunk boundary correctly."* Split's tail
carries **no `@{ref.id}` references at all** — `legIds[i]` and `shipIds[i]` are resolved to real
Salesforce Ids by the two HEAD composites first (`:179`, `:199`), which is the entire point of the
HEAD/MID/TAIL design. Only the head needs refs, and the head never chunks. **There is no cross-chunk
reference path in split or combine to test.** Reword the item to what the tail actually risks: a
chunk boundary falling in the middle of the item PATCHes, and the partial-rollback branch at
`:233-241` that has to sweep up packages an earlier chunk already created.

✅ **What 3.5 did establish:** the non-chunking split path works end to end against dev2 — legs,
shipments and packages all present, correct weights and trackings, no half-built state.
⚠️ **Not verified:** the OrderItem `Shipment_Order__c` PATCHes. The tail composite returned ok for
all 8 sub-requests, but **no app endpoint SELECTs `OrderItem.Shipment_Order__c`**, so this was not
read back off the records. Confirm in the Developer Console before calling 3.5 fully green.

📏 **Bonus datum for the `Name__c` bug:** split's leg name is `<53-char anchor> - Leg 1` = **61
characters** and it was **accepted**, while combine's **121** was rejected. So
`Shipment_Order__c.Name__c` is **80 characters** (the standard default) — consistent with both
results. Split therefore does not fail, it just writes an **`<a href=…>` tag into a record name**.

🔴 **3.6 found a P0 that makes COMBINE non-functional in dev2 at ANY size — `STRING_TOO_LONG` on the
first leg.** This is trap 4 firing on the **server**, where there is no `api.text()` to catch it.

`combine.js:194` builds the leg name as:

```js
Name__c: `Combined w/ ${primaryLabel} - ${label}`
// primaryLabel / label = o.GOA_Order_Number__c || o.OrderNumber || id   (:128, :187)
```

`GOA_Order_Number__c` is a **formula field that returns HTML**, which §2 has documented for the
client since 2026-08 — measured live 2026-09-11 it is **53 characters**:
`<a href="/801ca00000PzawG" target="_self">20460-4</a>`. So the value actually sent is

```
Combined w/ <53 chars of anchor tag> - <53 chars of anchor tag>   =  121 characters
```

and `Shipment_Order__c.Name__c` rejects it. With the plain `OrderNumber` the same string is **31
characters** (`Combined w/ 00013418 - 00013422`) and would be fine — the fallback in that `||` chain
is the value that works, and it is never reached because the formula field is never empty.

**What this does to the item as written.** 3.6's false-pass warning says a ten-order test would be
green and meaningless. The reality is the opposite: **no order count passes.** The request dies in
the HEAD, before the 12-vs-25 ceiling is ever reached, so **E5.10's raised ceiling STILL has not been
exercised by anything** — 3.6 cannot test it until this is fixed. Do not mark E5.10 validated on the
strength of this run.

✅ **What did pass, and is worth keeping:** the failure path behaved exactly as designed —
`rolledBack: 0` (nothing had been created yet), `restoreOk: true`, no half-built state, and the
error named the sub-request (`leg0`) rather than failing bare. That is the half of E5.10 this surface
can currently confirm.

🚩 **`split.js:172` has the same bug, milder.** `Name__c: \`${orderLabel} - Leg ${i + 1}\`` with the
same HTML label is **~62 characters**. It may fit where 121 did not (the field's exact length is not
yet known — it is somewhere between 62 and 121), but either way split writes an **anchor tag into a
record name**. Fix both call sites together.

🚩 **Also found reading `combine.js`: the TAIL's `runChunked` can never chunk.** Line 176 hard-fails
when `orderIds.length > COMPOSITE_LIMIT` (25), so the tail array is always ≤ 25 and
`runChunked(env, tail, …)` at `:261` always runs as a single call. Not a defect, but the chunking
there is dead code and the header comment's "chunked freely" oversells it.

📌 **Suggested fix (not yet made):** add a server-side `plainText()` helper next to `_sf.js`'s
existing helpers — strip tags, decode entities, trim — and run **every formula-field value through it
before it is written to a Salesforce field**, starting with `combine.js:128`/`:187` and
`split.js:125`. The client has had `api.text()` for exactly this since the formula-field trap was
first documented; the server never got one. Then re-run 3.6 **and** 3.5.

📌 **dev2 fixtures built 2026-09-09 (the reason the surface was unrunnable).** The dev2 shipping
board was **genuinely empty** — `GET /api/shipping-orders` returned **HTTP 200, `totalSize: 0`**, so
an empty board, not a failed fetch. Cause: **no dev2 order carried `Order_Substatus__c =
'Post-Production'` at all.** The live values across the 73 orders were `Completed` (70),
`Ready for Print` (1) and null (2); `Status` was `Enter Tracking` / `Sent Tracking` / `Draft`, so the
`Status != 'Complete'` half of the query was never the filter that emptied it.
**17 orders were PATCHed to `Order_Substatus__c = 'Post-Production'`** through the app's own
`PATCH /api/orders/:id` — 13 `Shipping`, 2 `Delivery`, 1 `Pickup`, 1 `Split Ship` — and the board now
returns 17. These are disposable test orders; reverting them is optional.
- 🚩 **Two orders refused the write: `00013435` and `00013436` returned `400 update_failed`.**
  Every other order accepted the same field with the same value. **This is the same shape as B19**
  (an Order-side write refused or reverted on a subset of orders, cause unknown) and may be the same
  root cause. Do not treat B19 as a `Print_Date__c` problem until this is checked.
- ✅ The other 15 writes **stuck** — read back off the board query, not off local state. So
  `Order_Substatus__c` is not being reverted by the rollup or by a flow, unlike B19's field.
- 🚩 **dev2 has zero combined shipments** — no order has `Is_Master_Shipment_Order__c = true` or
  `Master_Shipment_Order__c` set, and neither field is in `ALLOWED_FIELDS`, so one cannot be forged
  by PATCH. The only way to get a master/secondary pair is to **run 3.6**. That is why 3.6 must
  precede 3.9.

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

> ⚠️ **False pass:** the "which cycle am I on" pointer is **derived from run actuals, not stored**.
> Check it explicitly on run 2 and 3. ✅ Verified against a fake Salesforce 2026-09-09 (E2.6) — runs 2
> and 3 both derived correctly, out-of-order working included. **Still unverified against dev2**, which
> is what this scenario is for: the rig cannot prove Salesforce actually persists the actuals.
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
> ⚠️ **This scenario changes completely if B9 / D12 lands.** S6 currently expects the
> reprint to appear on its own once every run is Submitted and every method Completed. Under
> B9 it would appear only after the account manager confirms, and "no reprint" would have
> three possible meanings instead of two. **Rewrite S6 with that story, not after it.**
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

### `Production_Station__c` — aligned 2026-09-16 (S1)

dev2 and staging now match on the Work Center object: 9 custom fields (`Active__c` is a **Checkbox** in
both), `Station_Type__c` = Screen Print / Embroidery / Heat Press, the `Production_Run__c.ProductionStation__c`
lookup, and the same 5 station records. FLS: System Administrator can edit all 10 fields in both orgs.
dev2 also grants the two integration profiles and the GOA / Modified admin profiles; staging does not
(cosmetic). **Records and FLS were set by hand in each org**, because neither travels on a change set.
Production has none of this (D22). ⚠️ See §4 S1 for why earlier parity reads of this object were wrong.

### Run Result (S6) — aligned 2026-09-17

Both sandboxes have the object, the two good fields, the class, its test and the trigger (change set deployed to
staging; tests 5/5 there). Records do not travel: dev2 migrated 132 Run Results, staging 2. ⚠️ staging's legacy run
PR-0001 has no decoration and `PrintMethod__c` is required there, so its two line items cannot be written at all —
they were skipped and still hold the old 3,000 misprints. dev2 has `Run_Result__c` (9 fields), `Production_Run_Line_Item__c.Good_Qty__c`, `Production_Run__c.Total_Good_Qty__c`,
`RunResultRollup` + test + `RunResultTrigger`, and 132 migrated Run Results. Change set **"S6 Run Result 2026-09-17"**
(15 components + 3 profiles) is built, not uploaded. Records do not travel: staging and production each need the
migration script (§4 S6). ⚠️ staging's line item also has `Actual_Good_Qty__c` / `Reprint_Qty_Needed__c` — unused, do
not confuse with the new `Good_Qty__c`.

### Art Spec wiring (S5) — aligned 2026-09-17

Change set deployed to staging (tests 7/7 there). Staging has no Art Spec records, so no links yet. dev2 has `ArtSpecLink`, `ArtSpecLinkTest` and triggers `ArtSpecLinkPlacement`, `ArtSpecLinkArtSpec`,
`ArtSpecLinkItem` (all Active), and 3 backfilled location links. staging gets the same five components by change
set **"S5 Art Spec Link 2026-09-17"** (no fields, so no profiles needed), then its own backfill. For production:
the same components, and the backfill after S4's.

### Catalog layer (S4) — aligned 2026-09-17

Both sandboxes have `Decoration_Method__c` (4 records), `Placement__c` (11), `Decoration_Placement__c`, the five
new lookups, the `CatalogSync` class, its test and five triggers (all Active), the extra PPI transfer values and
`Run_Minutes_Per_Unit__c` as `Number(14,2)`. Catalog records were created by script in each org — **they do not
travel**, so production needs the same seed, then the backfill (see §4 S4 for the scheduler warning).

### Art layer (S3) — aligned 2026-09-17

Both sandboxes have `Art_Spec__c` with the same 17 fields, `Decoration__c.Art_Spec__c`,
`Pre_Production_Item__c.Art_Spec__c`, `Design__c.Opportunity__c` as a **Lookup** (sharing Public
Read/Write), no `Opportunity.Design_Count__c`, and a visible `Design__c.DesignMaster__c`. Only dev2 has
sample Art Spec records. For production (D22): the object and fields travel in a change set (include the
profiles so FLS goes too); **the roll-up deletion + erase and the Master-Detail → Lookup change do not, and
must be done by hand, in that order, before anything depends on them.**

### Approval gate (S2) — aligned 2026-09-16

dev2 and staging both have `Production_Gate__mdt` + `Approval_Gate_Start__c`, the `Default` record with
a **blank** date, and the active `Decoration__c.Artwork_Approval_Gate` rule with the same formula (IDs in
§4 S2). Built by hand in each org. For production (D22) the type, the record and the rule all travel in a
change set; **confirm the record's date on arrival**, since that is the switch.
What each org actually has, how that was measured, and what moving metadata between them does and does not carry.

### Wave 0c parity and the 2026-09-15 Apex measurement

#### ✅ THE ORGS AGREE ON THE RUN LINE ITEM OBJECT — re-verified 2026-09-16

Both read **`Production_Run_Line_Item__c`**, label "Run Line Item". staging holds **14 records** in
it, which is the check that matters: a Metadata-API "rename" would have produced a **second, empty**
object beside the original, so a live record count is what distinguishes a real rename from that
failure mode.

❌ **On 2026-09-15 this section said staging was still `Run_Line_Items__c` and called it 🔴 blocking.
That was wrong.** Kept rather than deleted because the correction is the lesson: the claim was read
once, late in a session, and gated three pieces of work behind itself for a day. **Re-query before
acting on any ⛔ line.**

📌 **The Metadata API still has no rename operation** — deploying a new `fullName` creates a second
object and leaves the first one holding all the data. That part of the old entry stands and is why
every rename on the map is hand work in Setup, per org.

#### 📍 THE RENAME MAP — what is left, read live in both orgs 2026-09-16

| The rename | dev2 | staging |
|---|---|---|
| `Artwork__c` → `Artwork_Asset__c` (label "Artwork Asset") | ✅ | ✅ |
| `Design_Master__c` → `Artwork_Master__c` (label "Artwork") | ✅ | ✅ |
| `ProductionPlan__c` → `Production_Plan__c` | ✅ | ✅ |
| `ProductionRequirements__c` → `Production_Requirement__c` | ✅ | ✅ |
| `Production_Method__c` → `Decoration__c` | ✅ | ✅ |
| `Production_Run_Line_Items__c` → `Production_Run_Line_Item__c` | ✅ | ✅ |
| **`Design__c` → *(new name)*** | ⛔ **not done** | ⛔ **not done** |
| **`Production_Run__c.PrintMethod__c` → *(new name)*** | ⛔ **not done** | ⛔ **not done** |

**Two renames remain. Waves 0a, 0b and 0c are complete in both sandboxes.**

🪤 **`Design__c`'s LABEL already reads "Design Version" in both orgs, so on screen it looks finished.**
The API name is untouched. Same trap as `Decoration__c` was for a week — judge a rename by the API
name, never by what Setup displays.

##### Custom objects in scope, as the orgs actually read them (2026-09-16)

| dev2 | staging |
|---|---|
| `Artwork_Asset__c` — Artwork Asset | `Artwork_Asset__c` — Artwork Asset |
| `Artwork_Master__c` — Artwork | `Artwork_Master__c` — Artwork |
| `Decoration__c` — Decoration | `Decoration__c` — Decoration |
| `Design__c` — Design Version | `Design__c` — Design Version |
| **`Design_Family__c` — Design Family** | **`Design_Artwork__c` — Design/Artwork** |
| `Pre_Production_Item__c` | `Pre_Production_Item__c` |
| `Production_Plan__c` | `Production_Plan__c` |
| `Production_Requirement__c` | `Production_Requirement__c` |
| `Production_Run__c` | `Production_Run__c` |
| `Production_Run_Line_Item__c` | `Production_Run_Line_Item__c` |
| **`Production_Station__c`** | **`production_station__c`** (lowercase p) |

🚩 **Two divergences that are NOT on the rename map and were found by this sweep:**

1. **dev2 has `Design_Family__c`; staging has `Design_Artwork__c`.** Different objects, not a rename —
   neither org has the other's. ⚠️ **Settle this before wave 0d touches anything Design-shaped**, or
   0d will be designed against a picture only one org matches.
2. **`Production_Station__c` vs `production_station__c`** — a capital letter. Harmless at runtime
   (Salesforce matches API names case-insensitively) but it will surface in every future parity diff
   and read as a real difference. Recorded so nobody investigates it twice.

#### Change set `0c Flow Fixes 2026-09-15` — built in dev2, NOT yet uploaded

Holds both repaired flows: `Order and Order Items Subflow Design` and
`Production_Run_Generate_Line_Item_Skeleton`.

📌 **Upload it only after staging's object rename**, or the skeleton flow arrives correct and the BFF
arrives wrong. 📌 **Flows deploy INACTIVE — activate both by hand afterwards.** Component type in this
org is **`Flow Definition`**; there is no "Flow" entry.

#### ✅ Apex coverage and test health, measured in both orgs 2026-09-15

**Both orgs clear the 75% production gate.**

| | dev2 | staging |
|---|---|---|
| Org-wide coverage | **82%** | **85%** |
| Run window (UTC) | 15:29:54Z | 19:29:50Z → 19:41:15Z |
| Tests enqueued / completed | — | 3,905 / 3,594 |
| Total failures | 264 | 306 |
| **Local failures (deploy-blocking)** | **2** | **14** |
| Managed-package failures (excluded from deploys) | 262 | 292 |

🚩 **The big failure numbers are almost entirely managed packages and cannot block anything.** Split
by namespace — dev2: rh2 144, MC4SF 34, aircall 32, slackv2 24, fbsync 10, report_sender 5, mone 5,
RQL 5, ATUC 4, usf3 3, Form_Builder 3, cil 3, TVA_CFB 2, smrtDev 1, Flowdometer 1. staging: rh2 175,
MC4SF 33, aircall 32, slackv2 24, fbsync 10, report_sender 6, RQL 5, ATUC 4, usf3 3, Form_Builder 3,
mone 2, TVA_CFB 2, smrtDev 1, zkmulti 1, invmgrnp 1.

**dev2's 2 local failures:**

| Class · method | Error | Reading |
|---|---|---|
| `ProductionAutoSchedulerServiceTest.testHappyPath` | *One Event should be created: Expected: 1, Actual: 0* | ✅ Known pre-loss baseline. **The test is wrong** — see §4 wave 0c. Do not "fix" it. |
| `OrderTriggerHandlerTest.testStatusChangeToNonPartialDoesNotError` | `FAILED_ACTIVATION, An order must have at least one product` | Test-data problem, unrelated to the rename — it activates an Order with no OrderItems. |

**staging's 14 local failures**, by class: `ApprovalProcessTest` 4 · `ScheduledBatchableTest` 2 ·
`BatchClassForApprovalProcessTest` 2 · `QB_WebhooksTest` 2 · `ProductionAutoSchedulerServiceTest` 1
(the same `testHappyPath`) · `OpportunityProductsControllerTest` 1 · `QuoteProductsControllerTest` 1 ·
`QuoteOppProductsControllerTest` 1.

📌 **The 12 extra staging failures are all in code nobody touched today** — approvals, QuickBooks
webhooks, quote/opportunity controllers. That is consistent with staging simply being **staler** than
dev2, not with anything wave 0c broke. **No failure in either org is attributable to the rename or the
Apex rebuild.**

⚠️ **Coverage is not the gate on its own.** A production deploy needs **75% org-wide aggregate** (not
per-class) **plus some coverage on every trigger**, and **every local test in the run must pass**.
Managed-package tests (non-null `NamespacePrefix`) are excluded from deploy runs. So those 14 staging
failures would each need fixing before a production push — none of them block the staging work queued
in §0.

**The query that produces this split**, run in the Developer Console (§2, browser recipes):

```sql
SELECT ApexClass.NamespacePrefix, COUNT(Id) n FROM ApexTestResult
WHERE Outcome = 'Fail' AND TestTimestamp >= <run start> AND TestTimestamp <= <run end>
GROUP BY ApexClass.NamespacePrefix ORDER BY COUNT(Id) DESC
```

```sql
SELECT ApexClass.Name, MethodName, Message FROM ApexTestResult
WHERE Outcome = 'Fail' AND TestTimestamp >= <run start> AND TestTimestamp <= <run end>
  AND ApexClass.NamespacePrefix = null
```

🪤 **No field aliases on the second one** — `SELECT ApexClass.Name cls` fails with *"only aggregate
expressions use field aliasing"*. `COUNT(Id) n` in the first is fine because it is an aggregate.

#### ⚠️ Two flows diverged, and they were NOT part of wave 0c

| Flow | dev2 | staging |
|---|---|---|
| `OrderScheduling` | **V24** | **V37** |
| `Create_Multi_Orders_with_Design_Name` | **V21** | **V21**, modified ten months apart |

📌 **Do not reconcile these by reflex.** §0 already warns that version numbers do not imply parity in
these orgs, and neither flow was in scope today. They are recorded so the next parity sweep does not
report them as new.

---

### Org parity — RE-MEASURED 2026-09-14 (supersedes the 2026-09-03/04 sweep below)

**Why redone:** the earlier sweep predates `Size_Sort__c`, the B9 audit fields, `Press__c`, and three
priority fields added 8/17. **Method, and it is the one to repeat:** parse every Salesforce field name
out of `functions/` first — **139 custom fields across 7 objects** — then enumerate both orgs' field
lists and diff, then check each difference back against the code. Going org-first produces a list of
differences nobody can act on; going code-first tells you which differences can actually break a board.

📌 **Scraping recipe that works on both orgs** (staging's Lightning Setup blocks reads, classic does
not): `/p/setup/layout/LayoutFieldList?type=<Order|01I id>&setupid=<OrderFields|CustomObjects>`, then
read the API-name column out of the table. Get the `01I` ids from `/p/setup/custent/CustomObjectsPage`.
⛔ **`fetch()` from the page is useless here** — Salesforce answers with a 744-byte JS redirect stub, so
navigate page by page. ⛔ **And `/<01I id>` alone redirects to Lightning in staging** — use the
`LayoutFieldList` URL above.

**HEADLINE: no field the UI reads is missing from either org. Nothing is taking a board dark today.**
`Order` (238 fields dev2 / 246 staging), `Proposed_Run__c` (11/11) and `Pre_Production_Item__c` (17/17)
are identical on everything the code touches. Four differences exist:

| Object | Field | dev2 | staging | Used by code? | Verdict |
|---|---|---|---|---|---|
| **Production_Method__c** | **`Production_Priority__c`** Number(2,2) | ✅ | ❌ | ✅ **written every refresh** | 🚩 **live silent failure — fix** |
| Production_Method__c | `Priority_Rating__c` Picklist | ✅ | ❌ | ❌ | parity only |
| Production_Method__c | `Priority_Notes__c` Text Area(255) | ✅ | ❌ | ❌ | parity only |
| Production_Run__c | `Operator__c` | ✅ | ❌ | ❌ | leave |
| Production_Run__c | `Quantity_Completed_c__c`, `Reprint_Quantity_c__c` | ❌ | ✅ | ❌ | staging leftovers, leave |
| Production_Run_Line_Item__c | `Actual_Good_Qty__c`, `Reprint_Qty_Needed__c` | ❌ | ✅ | ❌ | staging leftovers, leave |

##### 🚩 `Production_Method__c.Production_Priority__c` is missing in staging and the app writes it on every refresh

`_priority-rollup.js:83` PATCHes this field for every method on the order. **In staging every one of
those PATCHes 400s.** It fails *safely* — the call is wrapped, `failed` is logged, nothing throws, and
`rollupPriorityToMethods` returns normally — so **the UI is unaffected and this has been invisible.**
What it actually costs:

- **The priority score is never written to Production Method in staging**, so any Salesforce report,
  list view or sort built on that field is permanently blank there. The dashboard is fine because it
  computes priority itself in `_priority.js`; the calendar reads `Order__r.Priority_Rating__c`, an
  **Order** field that exists in both.
- 🪤 **The log message points at the wrong cause.** It says *"check the integration user has Edit (not
  just Read) on Production_Method__c.Production_Priority__c"* — correct guidance in an org where the
  field exists, and a guaranteed wild goose chase through profiles in staging, where it does not.
  **When adding a "most likely cause" to an error string, the cause that is most likely in the org you
  developed in is not the one most likely in the org that breaks.**

📌 **`Priority_Rating__c` and `Priority_Notes__c` on Production_Method__c are NOT the ones the code
reads** — every code reference is `Order__r.Priority_Rating__c` / `Order__r.Priority_Notes__c`, i.e. the
**Order** fields, which exist in both orgs. The Production Method copies were created alongside
`Production_Priority__c` on 8/17 and nothing in `functions/` touches them.

📌 **The code comment saying `Production_Priority__c` is `Number(4,2)` is wrong — dev2 has it as
`Number(2,2)`.** Harmless: `scoreOrder()` clamps to 1-10 (`_priority.js:265`) and rounds to 2 dp, so
10.00 fits inside Number(2,2)'s ±99.99. Worth knowing before anyone "fixes" the field to match the
comment.

##### ✅ Picklists the UI branches on — all identical across both orgs

| Field | Values | Same in both? |
|---|---|---|
| `Production_Method__c.Status__c` (drives board columns via `BOARD_STATUSES`) | Pre-Production · Ready for Print · In Production · Post-Production · Completed · Cancelled · On Hold | ✅ |
| `Production_Method__c.Type__c` | Screen Print · Embroidery · Heat Press · Promotional Items | ✅ |
| `Order.Order_Substatus__c` | Pre-Production · Ready for Print · In Production · Post-Production · Completed | ✅ |

🪤 **A TRAP THAT IS IN BOTH ORGS, SO THE DIFF WOULD NEVER HAVE CAUGHT IT — `Order.Order_Substatus__c`
has a value LABELLED "In Production" whose API NAME IS "Production".** SOQL and Apex match the **API
name**, so `WHERE Order_Substatus__c = 'In Production'` returns **zero rows, silently, in every org.**
✅ Checked: no code does this today. `BOARD_STATUSES` in `production-orders/index.js:44` uses
`'In Production'` against **`Production_Method__c.Status__c`**, where label and API name DO match.
⛔ **Before writing any filter on `Order_Substatus__c`, read the API-name column, not the value column.**
Every other value on that picklist has label == API name, which is exactly what makes this one easy to
miss.

##### Object labels — dev2 AND staging, as of 2026-09-14

| | dev2 | staging | production |
|---|---|---|---|
| `Production_Method__c` label | **Decoration / Decorations** | **Decoration / Decorations** | object absent |
| `Production_Run_Line_Items__c` label | **Run Line Item / Run Line Items** | **Run Line Item / Run Line Items** | object absent |

**Label only — the API name is unchanged in every org.** Nothing in code reads a label, so this changed
no behaviour anywhere. Applied by hand in both sandboxes the same day (labels do not travel on a change
set, so there was nothing to promote). **The two sandboxes now agree**; production has none of these
objects. See §2 rule 12 for why the API name did not move, and why it is not going to.

📌 Staging's object id is `01Ica000000IeBt`, dev2's is `01Ica000000So1v` — **object ids differ between
these orgs**, so a Setup URL copied from one will silently open a different object, or nothing, in the
other. `Misprint_Outcome__c`'s shared field id (§9) is the exception, not the rule.


---

### Org parity — measured 2026-09-03/04 (SUPERSEDED by the 2026-09-14 sweep above; kept for its method notes)

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

🚩 **ADD THIS ONE FIRST, learned 2026-09-14: a change set does NOT carry field-level security.**
Field permissions travel only for **profiles included in the set**. Deploy a custom field on its own
and it arrives **invisible to every profile** — in staging, `Production_Method__c.Production_Priority__c`
landed visible to **0 of 27**, against 26 of 26 in dev2. **The field exists, the API can see it in the
schema, and every write still fails.** Worse, if the code's error message blames permissions (as
`_priority-rollup.js` does), the deploy looks like it worked and the log looks like a profile problem.
⛔ **After deploying any field: Set Field-Level Security on it before believing the deploy.**


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
| 2026-09-18 | 🛠️ **THE PRESS FIX FAILED TO BUILD, AND THE BUILD FAILING MEANS NOTHING DEPLOYS (trap 22).** `proposed-runs/index.js` imported `failureMentionsField`, newly exported from `_placements.js`; only one file landed, so Cloudflare answered **No matching export in "api/_placements.js"** and the whole push stayed on the old version. Reproduced here on purpose, then removed the cause rather than re-pushing: the endpoint now asks **with** press and, if that fails, asks **without** it — if the second attempt works, press was the problem; if it fails too, the FIRST failure is reported because that is the one that describes what is wrong. No new import, no second copy of anything, `_placements.js` back exactly as it was. ✅ **New smoke check 9** reads every named import and fails when the target file exports no such name — `node --check` cannot see this, because each file parses fine alone. Verified by reconstructing the incident. **`npx wrangler pages functions build` → Compiled Worker successfully** against the untouched `_placements.js`; rig **17/17**; smoke **9/9** | §2 trap 22 |
| 2026-09-18 | 🔧 **MOCKUPS: THE PUBLIC LINK NOW WORKS, AND THE FILES TAB STILL DOES NOTHING (trap 21).** Anthony's mockup would not show. Measured, not guessed: his Design (`a05ca00000CQMHRAA5`, opportunity `006ca00000J4JQw`, which is the opportunity behind BOTH his test orders 00013520 and 00013521) holds a file **public link**, and `/api/mockup-proxy` fetching it gets **200 with 1,359 bytes of HTML** — an `<img>` on HTML shows nothing and says nothing. 📌 The path carries the **ContentDistribution** id with its `05D` prefix stripped; one query gives the ContentVersion, and the authenticated branch returns the real file (**1.34 MB JPEG, renders 3300×2700** — proved live). The proxy now resolves the public link, `ContentDownloadUrl` (`068` mid-string) and a `069` ContentDocument link, and — deliberately stricter — runs those lookups only for Salesforce hosts. **Rig 16/16** incl. SSRF guard, SOQL-injection attempt, both degradations. smoke 8/8 | §2 trap 21 |
| 2026-09-18 | 🔧 **PRESS NOW PREFILLS FROM A PROPOSED RUN — the client was always ready; the deployed endpoint never sent it.** Anthony: every field carries across from a suggestion except Press. Traced live: `GET /api/proposed-runs` returns **no `pressId` key at all**, while Salesforce holds `Press__c` = Press 1 on PROP-0055 and `/api/presses` lists that exact id. Both clients (`pre-production.html`, `calendar.html`) already carry press. 🚩 **So the deployed build predates the 2026-09-11 `Press__c` work even though it includes today's S7 endpoint — the Mac's copy of `proposed-runs/index.js` has never been pushed.** Hardened before pushing, per build rule 3: `Press__c`/`Press__r.Name` are now dropped the way `Print_Location__c` already is, because one deployment serves three orgs and naming a field the active org lacks kills the WHOLE query — which `getProposedRuns()` swallows into `[]`, i.e. every order silently reporting "no suggestions". `failureMentionsField` exported from `_placements.js` so the endpoint can tell which field the org objected to; response gained `pressAvailable`. dev2 FLS checked first: 26 rows, read+edit. **Rig 16/16** | §4, §9 |
| 2026-09-18 | 🛑 **THE UI'S DECORATION ENDPOINT HAD NO ROUTE — EVERY DECORATION WRITE FROM THE DASHBOARD WAS FAILING LIVE (trap 20).** Anthony's "Create failed — check the plan and try again" was real, and it was not his plan: `ca-api.js` calls `/api/production-methods` in **6** places, but the folder was renamed to `functions/api/decorations/` and **a folder under `functions/` IS the url**. Measured on the live site: `POST /api/production-methods` → **405, zero bytes** (exactly the red-X-with-empty-Response in his screenshot), `GET` → **200 with 280 KB of the SPA's own HTML**, which fails `JSON.parse` and drops the board to demo data without a word. Create, status moves, the 7 checklist toggles, drawer edits and Remove were all dead; `loadMethodsForOrder` swallows the throw, so the decoration list just looked empty. 📌 **Every T5 walk passed because they called `/api/decorations` by hand — testing an endpoint is not testing the app's route.** ✅ Fixed: client repointed to `/api/decorations`; `production-methods/` kept as a **re-export alias** for cached tablets; endpoint headers corrected; **new smoke check 8** fails on any client `/api/…` path with no function behind it, verified by reconstructing the incident in a throwaway copy. Also fixed (trap 20b, the reason it was invisible): the create catch block required an **array** `detail` this endpoint never returns, so every cause rendered as the generic sentence — now uses the shared `errText(e)`. smoke **8/8**. **Uncommitted on the Mac; Anthony pushes — the dashboard stays broken until he does.** | §2 trap 20 |
| 2026-09-18 | ✅ **S7 T5 CLOSED ON STAGING — all eight tests now pass.** Anthony switched the org; header read **STAGING · Live**, 35 frames, 4 batches, and **95 real screen jobs + 50 real ink jobs**, so the walk used live records and restored them (both read back unchanged; **0 jobs left linked** in either org). A 156 job offered **10 frames of 35**, all the right mesh. 🚩 **The ink job exercised the no-match branch on real data:** staging's pantones are written `130C` / `5038C`, the placeholder batches `PMS 186 C`, so nothing matched and all 4 were offered **with the warning**, as designed. 📌 **Finding for the production gate: real `Ink_Mix__c.Pantone__c` values must be written the way `Pantone_Color__c` already is (`130C`, no PMS, no space) or the narrowing will never match.** Mesh matching is unaffected — staging uses only 156/125/196 and all three have frames | §4 S7 |
| 2026-09-18 | ✅ **S7 T1–T8 RUN — seven pass, T5 half.** T2 diffed `FieldDefinition` across both orgs with **0 differences**; T3 **30/31 fields on 3 profiles in both orgs** (`Mesh_Count__c` correctly absent, being universally required); T4 confirmed **S7 ships no flow and no Apex** and the skeleton flow is still v6. **T6 is the one that matters:** hiding `Frame_Status__c` in dev2 made `/api/shop-floor` answer `available:false`, the picker vanished, and **the screen and ink boards kept working** — the degradation is real, not theoretical. T7 walked a throwaway screen job (offered **12 of 41 frames**, all the right mesh) and ink job (1 of 4 batches), set and cleared both, and **left the sub-status and status untouched**; everything deleted afterwards. T8 all boards 200. 🚩 **T5 on staging needs Anthony to switch the active org** (global, PIN-gated); staging's org side is already proven. 🪤 Restoring T6's FLS needs an INSERT, not an update — clearing read **deletes** the row | §4 S7 |
| 2026-09-18 | 🔧 **S7 STATION PICKERS BUILT** — a screen job can record which physical frame it used, an ink job which batch. New **follow-up** endpoint `functions/api/shop-floor/index.js` (GET options + `byItem`, POST link/clear), `getShopFloor` / `setShopFloorLink` in `ca-api.js`, and a picker in `station.html`'s job modal. ⛔ **The two PPI lookups stay OUT of `_station.js`'s selectFields** — naming them there would empty the ink and screen boards in any org one step behind (trap 1); the endpoint answers `available:false` instead and the picker vanishes. Options narrow to what fits the job (156 job → 156 frames), Retired/Damaged frames and empty batches are never offered, unlabelled frames are pickable but flagged. Tested: **endpoint rig 30/30** (including both no-object and no-lookup degradations, the capability gate, and INVALID_FIELD → 409) and a **headless tablet-width page walk both ways** — picker renders and posts correctly with the layer, renders **not at all** without it. smoke 7/7. Code uncommitted on the Mac; Anthony pushes | §4 S7 |
| 2026-09-18 | 🟡 **S7 frames seeded with PLACEHOLDER data so the build can continue** (Anthony's call: fake numbers while testing, real count before production). **35 frames per sandbox** — 110×4 · 125×2 · 156×10 · 180×4 · 196×3 · 230×10 · 305×2 — plus 4 placeholder ink batches, in **both dev2 and staging** so the boards work whichever org is active. Every row is marked (`Location__c` / `Mixed_By__c` = `SEED-PLACEHOLDER`) and says so in its own Notes, so one query removes them and nobody meets one in the UI and believes it. ⛔ **Production gate logged in §4 S7 and S8: Anthony takes a real per-mesh count, the placeholders are deleted from both sandboxes, and only then does production get any Screen__c rows.** | §4 S7, §4 S8 |
| 2026-09-18 | ✅ **S7 IS IN BOTH SANDBOXES.** Change set v2 deployed to staging and **checked, not just assumed**: all 37 fields read back by query including the `Screen_Preps__r` / `Screen_Reclaims__r` child relationships; a **describe fingerprint diffed field-by-field against dev2 came back with 0 differences** (confirming the loosened `Status__c` / `AssignedOrder__c` arrived optional, both master-details are MD not lookup, the 3 roll-ups are calculated, and `Frame_Status__c` kept its 7 values with In Rack default); and the end-to-end proof re-run in staging — frame `S-0000` with **no order**, 2 preps + 1 reclaim rolling up to 2/1/set, `NOW()` defaults taken unprompted, a real Screen job and Ink job linked, read back through `Screen__r` and unlinked — then everything deleted, all four objects back to 0 rows and 0 jobs left linked. FLS travelled: **30 of 31 fields on each of the 3 profiles**, the one absentee being `Mesh_Count__c`, which is correct because a universally required field has no FieldPermissions row. Left: seed the frames (needs Anthony's counts by mesh) and the `station.html` pickers | §4 S7 |
| 2026-09-18 | 🚩 **S7 CHANGE SET v1 FAILED VALIDATION — a custom object in a change set does NOT carry its own fields (trap 19).** Staging reported `Cannot set sharingModel to ControlledByParent on a CustomObject without a MasterDetail relationship field` for `Screen_Prep__c` and `Screen_Reclaim__c`: adding an MD field flips the object's sharing model automatically, so the object then *needs* that field present — and it was not in the package. The other objects would have landed as **empty shells**, which reads exactly like trap 1 on the first read-back. 🚫 An uploaded change set is locked (Delete / Upload / Clone only), so v1 was **cloned** into **"S7 Shop Floor 2026-09-18 v2"** (`0A2ca000000JDJJ`) with **every field listed explicitly** — both master-detail `Screen` lookups, and all 12 `Screen__c` fields including the 5 that pre-date S7, since staging has no `Screen__c` at all. **6 components → 37**, plus the 3 profiles, each verified across both pages of the component list against a checklist. ⛔ Anthony uploads and deploys v2 | §2 trap 19, §4 S7 |
| 2026-09-18 | 🔧 **S7 SHOP FLOOR BUILT IN DEV2 (D29).** Measured first, and the measurement changed the design: the shop floor is **already tracked** on `Pre_Production_Item__c` (**186 screen + 96 ink jobs in dev2, 138 + 68 in staging**), `station.html` runs both pipelines today, and the 6 `Screen__c` rows were a hand-made second copy using the same four status values. So **Screen became the physical frame, not the job** — jobs stay on Pre-Production Item (D18 holds). Built: `Screen_Prep__c` and `Screen_Reclaim__c` (master-detail children of the frame, so `Times_Prepped__c` / `Times_Reclaimed__c` / `Last_Reclaimed_On__c` roll up with **no Apex**), `Ink_Mix__c` (a batch: pantone, mixed, remaining), and on `Screen__c` `Art_Spec__c` / `Location__c` / `Label_Printed__c` / `Frame_Status__c` — `Status__c` left frozen per build rule 1. Two optional PPI lookups added and **kept out of every SELECT** until staging has them. 🚩 `Screen__c.Status__c` and `AssignedOrder__c` were **required** and had to be loosened (a frame has no order). Proved end to end then removed: frame S-0006 with no order, 2 preps + 1 reclaim rolling up correctly, an IM-00000 batch, both live PPI rows linked, read back and unlinked; dev2 back to 6 screens. ⛔ Change set to staging is Anthony's, and it must carry `Screen__c` itself | §4 S7, §5 D29 |
| 2026-09-17 | ✅ **TRAP 18 FIXED IN BOTH ORGS, AND S6 (d) NOW PASSES.** Anthony re-entered the two filter values on `Get Rows Across This Method`; **dev2 v6 `301ca00000U5OEwAAN`, staging v4 `301ca00000U5HQvAAN`**, both read back `Method__c ≡ $Record.PrintMethod__c AND Run_Print_Location__c ≡ $Record.Print_Location__c` from the metadata. Give-back re-proved in dev2 with the same rolled-back Apex that caught it: a run planned at 80 on method `a3Vca000000LJCXEA4` now creates **XL:40 + 2XL:40, total 80** (was 5 blank rows; and 200 when planned at 500). 📌 Also measured and cleared: the confirm leg costs **66** SOQL queries with populated rows, **36** with blank — fixed per branch, not per row — and insert/confirm are separate transactions, so there is no governor risk in the app | §2 trap 18, §4 S6 |
| 2026-09-17 | ✅ **S6 CLOSED — scenarios (c)(d)(e) walked in dev2.** **(c)** order 00013518 / PR-0118: 7 good, 2 misprint, 1 damaged → reprint **00013519 for 7 (S=4, L=3)**, `rework-check` agrees. **(e)** B9's damaged-lines query replayed on the same order gives **S — 3 misprint, 1 damaged; L — 3 misprint, 0 damaged**, matching the Run Results exactly, in size order (no email sent). **(d)** 🚩 **found a pre-existing fault, not ours: the skeleton flow's give-back has been dead in BOTH orgs since the 2026-09-15 repair** — `Get Rows Across This Method` lost both filter values, so it matches zero rows, `varAlreadyPlanned` stays 0 and every make-up run re-plans the WHOLE order (proved with rolled-back Apex: 80 planned → 5 blank rows; 500 planned → 200, the full order, not the 80 outstanding). S6's own half is correct and verified. ⛔ **Flow fix is Anthony's — make-up runs are wrong until it lands.** The earlier “dashboard write-ordering” guess is withdrawn. Test run PR-0119 deleted; PM-00109 restored to Completed | §2 trap 18, §4 S6, §11 |
| 2026-09-17 | ✅ **S6 LIVE in both sandboxes.** Change set deployed to staging (tests 5/5); staging migrated (2 Run Results; 12 eligible lines). Code pushed; the live counting screen walked on dev2 throwaway run PR-0091 — add, two counts summing, remove, submit (reprint check ran), locked view, org refusing add/remove on a submitted run, reopen — then every test count deleted. T6 passed and **found a defect: the Run-Result probe used `SELECT Id` while the read used the full field list, so a half-hidden layer left the old form with a save that 409'd. Probe now matches the read — one-line fix, needs a push.** 🪤 staging's legacy PR-0001 has no decoration and `PrintMethod__c` is required there, so its 2 line items cannot be written at all (pre-existing; migration skips them, 3,000 misprints still on the old field). Left: scenarios (c)(d)(e) on a throwaway order | §4 S6, §9 |
| 2026-09-17 | 🔧 **S6 RUN RESULT BUILT in dev2** (D28). New `Run_Result__c` + `Good_Qty__c` / `Total_Good_Qty__c`; Apex `RunResultRollup` keeps the old line boxes = sums of Run Results and locks submitted runs; tests 5/5. dev2 migrated: 132 Run Results, sums match, 0 runs rescheduled. **Code, uncommitted on the Mac:** `run-results` actions add/remove/submit/reopen + results in GET (fail-open), `ca-api.js` wrappers, `counting.html` "add a count" screen with progress, log and manager reopen (old form kept when the org lacks Run Result). Rig 24/24, headless screen walk clean, smoke green. Change set "S6 Run Result 2026-09-17" built, not uploaded | §0, §4 S6, §5, §9 |
| 2026-09-17 | ✅ **S5 CLOSED.** Order sheet re-pushed and live; dev2 live check passed (recipes print on 00013513); T6 passed (field hidden → `available:false`, boards unchanged; restored) | §0, §4 S5 |
| 2026-09-17 | ✅ **S5 in staging + live.** Change set deployed; tests 7/7 + 8/8 in staging. Backfill linked nothing (staging has 0 Art Specs). Live test with two throwaway recipes: triggers linked only the intended location and items; the Pre-Production drawer showed the recipe on the live dashboard; deleting them cleared all links. 🚩 `order-sheet.html` is still the pre-S5 version live — re-commit/push. Open: dev2 live check and T6 (need the dashboard on dev2) | §4 S5, §9 |
| 2026-09-17 | 🔧 **S5 ART SPEC WIRING BUILT in dev2; staging waits on change set "S5 Art Spec Link 2026-09-17".** Decision **D27** (Anthony): per-method recipe facts; auto-link only on one clear match; keeps running. Apex `ArtSpecLink` + 3 triggers fill blank `Decoration_Placement__c.Art_Spec__c` (and `Pre_Production_Item__c.Art_Spec__c` when a decoration has one spec) — never `Decoration__c`, whose save re-runs the scheduler. Tests 7/7, 97%; closes S4's 0%-coverage item. dev2 backfill: 3 of 108 rows linked, PM-00129 left blank on purpose. **Code, uncommitted on the Mac:** new `functions/api/art-specs/index.js` (follow-up endpoint, `available:false` fallback); `ca-api.js` spec helpers; recipe on `order-sheet.html` and in the `pre-production.html` drawer; transfer pickers moved to the D25 list. Smoke green; headless renders with and without specs. Also: **T5 walk on staging passed** (S4's last open test) | §0, §4 S4/S5, §5, §9 |
| 2026-09-17 | ✅ **S4 CATALOG LAYER DONE in dev2 + staging.** New `Decoration_Method__c` (4), `Placement__c` (11) and `Decoration_Placement__c` (per-placement junction with an Art Spec lookup, D23); lookups on Decoration, Production Run, Proposed Run and Art Spec; Apex `CatalogSync` + 5 triggers keep them filled from the picklists the app still writes (dual-write in the org), tests 8/8. Backfilled both orgs. PPI transfer types gained the Decoration list and legacy values map on save (D25). `Run_Minutes_Per_Unit__c` → decimals. Change set **S4 Catalog 2026-09-17** with profiles. 🪤 Required lookup ⇒ "don't allow parent delete", handled by a before-delete; the dev2 backfill re-slotted 8 stale proposal runs through the auto-scheduler (staging: 0 changed). **Code, uncommitted on the Mac:** method/placement/transfer allow-lists moved into `_placements.js`; Apex source added to `New Apex Classes/` | §0, §4 S4, §9 |
| 2026-09-17 | **Decisions D23–D26 (Anthony), answering S3's findings.** D23 one Art Spec per design + method + **placement** (front art differs from back), so S4 adds a placement to Art Spec and S5's Decoration → Art Spec join is per placement. D24 no uniqueness rule on Art Spec (the same art is run differently between jobs). D25 the Decoration transfer-type list is canonical; PPI's list converges in S4 (mapping proposed, to confirm). D26 flow *Order and Order Items Subflow Design* keeps setting `Order.Design__c` on create (amends D20); checked: create-only, no critical failure. Docs only | §4 S3/S4, §5 |
| 2026-09-17 | ✅ **S3 ART LAYER DONE in dev2 + staging.** New `Art_Spec__c` (AS-{00000}; lookup to `Design__c`, method picklist, 15 recipe fields) plus `Decoration__c.Art_Spec__c` and `Pre_Production_Item__c.Art_Spec__c`, moved to staging by change set **with profile settings so FLS came along**. `Design__c.Opportunity__c` **Master-Detail → Lookup** in both orgs (links kept 28/28 and 18/18; sharing now Public Read/Write; keep design when the deal is deleted), after deleting and erasing the only blocker, `Opportunity.Design_Count__c` (Anthony OK'd; erase done by Anthony). staging's `Design__c.DesignMaster__c` existed all along, FLS-hidden; FLS granted. 4 sample Art Specs in dev2 from real PPIs. dev2 mockups and rework-check verified after the change. 🚩 **Findings:** multi-placement decorations need more than one recipe; one design has three different embroidery recipes; two transfer-type lists; `Order.Design__c` is also written by flow *Order and Order Items Subflow Design*. No code changed | §0, §4 S0/S3, §9 |
| 2026-09-16 | ✅ **S2 APPROVAL GATE BUILT in dev2 + staging, and OFF.** `Production_Gate__mdt.Default.Approval_Gate_Start__c` (blank in both) + validation rule `Decoration__c.Artwork_Approval_Gate` (Ready for Print / In Production refused while `Order.Artwork_Approved__c` is false, for orders created on or after the date). Tested in dev2 with a **temporary 1/1/2026 date (Anthony approved), then cleared**. **Code, uncommitted on the Mac:** new `functions/api/_approval-gate.js`; checks in `decorations/[id].js`, `decorations/index.js`, `production-runs/index.js` (before insert, never on the Confirmed PATCH, trap 9); `calendar.html` drop failure now shows the server's sentence. 409 `artwork_not_approved`. Degrades open. Harness 14/14, mutation control bites, smoke green. **Open:** system-context flow check before the date is set; the board chip (deferred until the date); end-to-end scenarios on a preview | §0, §4 S2, §9 |
| 2026-09-16 | ✅ **S1 WORK CENTER PARITY DONE in dev2 + staging.** dev2 already had all 9 `Production_Station__c` fields and `Production_Run__c.ProductionStation__c` (Peter, 2026-05-22), **FLS-hidden from every profile**, which is why the morning's `FieldDefinition` read called it an empty shell. **Changed in both orgs:** FLS granted in dev2 (5 profiles × 10 fields; staging's System Administrator already had it); `Station_Type__c`'s single junk value `Type of production equipment` → `Screen Print`, plus `Embroidery`, `Heat Press`; `Active__c` Text → **Checkbox** (default checked); **5 station records** (Press 1, Press 2, Embroidery Machine, Hat Press, Shirt Press) with types and Active, staging's two existing rows updated in place. Read back live in both orgs. 🚩 **Findings:** (1) `FieldDefinition` silently omits FLS-hidden fields, so T2 needs a Setup cross-check, and §4 wave 0c's "20 deleted `Production_Run__c` fields" is probably FLS-hidden (Setup lists ~40 custom fields, admin sees 22, *Deleted Fields (3)*); (2) **the dashboard's run-as user is an "Anthony Martinez" System Administrator + Proposed Runs Access in both sandboxes**, not the integration profiles, which have no users in dev2; (3) change-field-type and Set-FLS pages work when driven by form input plus a scripted Save, and freeze or ignore clicks on a mouse click. **Open:** add the fields to the page layouts; real capacity and setup/run minutes. No code changed | §4 S1, §9 |
| 2026-09-16 | **Three more target-model decisions (Anthony): D20** a person attaches `Order.Design__c`; **D21** `Print_Process_Details__c` is retired whenever convenient (count production's rows first; deletions do not travel); **D22** production waits and gets the whole new model in one go, which supersedes E7.4's old-model build. **Approval start date (D16)** = the day the whole design is built in Salesforce; ask Anthony to confirm it then, and until then the date stays blank and the gate is off. S0 is now closed except for the still-open `Design_Family__c` (dev2) vs `Design_Artwork__c` (staging) question. Docs only | §4 plan, §5 |
| 2026-09-16 | 🧭 **TARGET OBJECT MODEL ADOPTED — decisions D14–D19, and a staged build + test plan.** Anthony's boss supplied OBJECT-GUIDE; it was measured against dev2 and staging through the Developer Console (counts in §4's plan). Decided with Anthony: **D14** `Design__c` keeps its API name and is reparented off Opportunity; **D15** proof approval stays job-level (`Order.Artwork_Approved__c` + `Opportunity.Artwork_Approval_URL__c`, since no approval field exists on `Design__c`); **D16** no printing until approved, from a start date not yet picked; **D17** Run Result, **superseding D1**; **D18** Pre-Production Item stays and points at Art Spec; **D19** Work Center = `Production_Station__c` in staging's shape. 🪤 **Two assumptions disproved by measurement:** the Work Center "head start" was an empty shell in dev2 (no fields, no records, no run lookup) and only real in staging; and `Order.Design__c`, believed unused, is set on 4,846 of 6,697 staging orders. **No org metadata and no code changed.** This entry adds §4's plan (build rules 1–8, tests T1–T8, stages S0–S8), D14–D19 in §5, supersession notes on D1 in §2/§3 and a §0 pointer. `node tools/smoke.mjs` green before the edit | §0, §2, §3, §4, §5 |
| 2026-09-16 | **Wave 0d — "Decoration" is the word on screen** — visible text only. **106 lines** on branch `feat/decoration-visible-text` (commit `bf0f577`, off `origin/main`, unpushed) and **82 lines** applied to the working tree, which already carried partial wave-0d work from another session. `Production Method` / `Print Method` → **`Decoration`** (qualifier dropped), plurals and lowercase prose to match. Untouched: all `__c`/`__r` tokens (48 `Production_Method__r` on the branch), both wave-0c guard lines, HTTP verbs, template bindings, CSS custom properties, route paths, capability keys, error CODES, report field names, `Delivery Method`, comments and `console.*` logs. 🪤 **TWO SCANNER BUGS WORTH REMEMBERING, both caught after the fact.** (1) `{{o.method}}` sits between tags and scans as a text node, but it is an object key into `renderVals` — renaming one side blanks the value at runtime and nothing fails loudly. (2) **A `<script>` body also sits between tags**, so a naive text-node walk treats ALL THE JAVASCRIPT as page copy: the first cut renamed `st.methods` → `st.decorations`, `{methods:{}}` → `{decorations:{}}` and `setForm({method:x})` → `{decoration:x}` — 37 identifier renames that rule 3 forbids. They were *internally consistent*, so every page still rendered and smoke still passed; only a diff audit for `decoration` adjacent to `{ , . [ :` found them. **Any text-only rename pass over these pages must blank `<script>` and `<style>` bodies before walking text nodes, and must run that punctuation audit before committing.** Applied with a two-pass writer (all lines asserted before any file is opened) and `newline=""`, so the diff is 106 in / 106 out with no line-ending churn. All nine pages re-rendered clean in a headless browser, zero visible "Method" left. No Asana id supplied | §2 |
| 2026-09-16 | 📍 **THE RENAME MAP IS DOWN TO TWO ITEMS — read live in both orgs.** ✅ Complete in dev2 **and** staging: `Artwork__c`→`Artwork_Asset__c`, `Design_Master__c`→`Artwork_Master__c` (0a), `ProductionPlan__c`→`Production_Plan__c`, `ProductionRequirements__c`→`Production_Requirement__c` (0b), `Production_Method__c`→`Decoration__c` (0c), and `Production_Run_Line_Items__c`→`Production_Run_Line_Item__c`. ⛔ **Left: `Design__c` (the object, wave 0d — 36 Apex classes, plus an Opportunity master-detail so it carries sales-side automation too) and `Production_Run__c.PrintMethod__c` (a FIELD — ~28 Apex refs + 48 repo refs).** 🪤 **`Design__c`'s label already reads "Design Version" in both orgs, so Setup makes it look finished** — the same trap `Decoration__c` set for a week. Judge a rename by the API name, never by the screen. 🚩 **Two divergences found that are NOT on the map: dev2 has `Design_Family__c` where staging has `Design_Artwork__c` (different objects, neither org has the other's — settle before 0d), and `Production_Station__c` vs `production_station__c` (a capital letter; harmless, but it will show up in every future diff)** | §9 |
| 2026-09-16 | ❌ **CORRECTION — staging's run line item object was NEVER the blocker. Yesterday's 🔴 open item 1 was wrong.** staging reads **`Production_Run_Line_Item__c`**, label "Run Line Item", with **14 live records** — matching dev2 exactly. The record count is the check that matters: a Metadata-API "rename" produces a *second, empty* object beside the original, so live records are what distinguish a real rename from that failure mode. 📌 **Whether Anthony renamed it overnight or the 09-15 reading was simply wrong cannot be determined from here, and chasing it is not worth the time.** The method is the lesson: a claim read **once**, late in a long session, was written up as 🔴 and gated the change set *and* the BFF deploy behind itself for a day. **One re-query closed it.** ✅ **Consequence: the change set and the BFF deploy are no longer gated on anything** | §0 item 1, §2 trap 10, §9 |
| 2026-09-15 | 📚 **`Claude outputs/` FOLDED INTO THIS DOCUMENT AND RETIRED.** All 25 files absorbed: the rebuild brief and its measured-vs-assumed tables, the four rebuilt classes, the RESTORE snippets, the STEP6 stub runbook, both STEP8 restore orders, the BFF change list and the two evidence CSVs. §4 wave 0c now carries the measured facts, every `// ASSUMPTION:` and who confirms it, the trigger/helper source verbatim, the 21+5 BFF edits with the guard lines, and **the 11 Proposal runs CSV in full** — that last one because restoring the scheduler destroys the rows it was read from and there is no second copy. §12 has the file-by-file disposition. ⚠️ **What is NOT reproduced: the four rebuilt `.cls` sources.** Salesforce is their system of record, in two orgs; take a Setup → Apex Classes → **Download** before touching them (trap 15) | §4 wave 0c, §12 |
| 2026-09-15 | ✅ **APEX HEALTH MEASURED IN BOTH ORGS — dev2 82%, staging 85%, both over the 75% production gate.** 🚩 **The frightening part is a mirage:** dev2 shows **264** failures and staging **306**, but split by `ApexClass.NamespacePrefix` only **2** and **14** are local. Managed-package tests are excluded from deploy runs and cannot block anything. dev2's two: `testHappyPath` (the known pre-loss Event assertion — the test is wrong, do not fix it) and `OrderTriggerHandlerTest.testStatusChangeToNonPartialDoesNotError` (`FAILED_ACTIVATION, An order must have at least one product` — test data, unrelated). staging's extra twelve are all in approvals / QuickBooks webhooks / quote controllers, i.e. **code nobody touched today — staging is staler, not broken.** 📌 **No failure in either org is attributable to the rename or the rebuild.** ⚠️ Coverage alone is not the gate: production needs 75% org-wide **and every local test passing** | §9 |
| 2026-09-15 | ✅ **BOTH "NEW" BUGS WERE ONE BUG — and that is the lesson worth keeping.** *"Runs won't hit the calendar"* and *"no Run Line Items are created"* were reported and investigated separately. One cause: `Production_Run_Generate_Line_Item_Skeleton` held a stale reference to the renamed run line item object, faulted, and **rolled back the entire `Planned → Confirmed` PATCH**. No Confirmed → no Event (trap 9); no completed flow → no line items. The tell was already in the trap list — three runs sitting on `Planned` IS the failed-publish signal. Fixed in dev2; ⛔ staging waits on the change set. Orphans left behind: Order **00013516**, runs **PR-0115/0116/0117** | §2 trap 17, §4 wave 0c |
| 2026-09-15 | 🪤 **FLOW BUILDER ACCEPTED AN EDIT, DISPLAYED IT, AND DISCARDED IT ON COMMIT — three times.** Setting the `PressChoices` record-choice-set *Choice Value* to `Id` (the `MALFORMED_ID` order-creation fault) failed by mouse, by keyboard, and by save-without-reopening; each attempt displayed correctly and each wrote `valueField: null`, confirmed against the metadata. ⛔ Junk versions **V47 (ACTIVE, identical to V46)** and **V48 (draft)** to delete. ✅ **Anthony fixed it a different way — a Get Records inside the loop.** 📌 Two earlier theories of mine were wrong and the fault email disproved both: test-run saturation, and an unguarded try/catch in `scheduleFromOrders` | §2 trap 16 |
| 2026-09-15 | ✅ **`shippingBuffer()` NOW HOLDS THE SHOP'S REAL NUMBERS — every rebuilt guess was wrong.** The rebuild invented Pickup 0 · Delivery 1 · Split Ship 5 · Shipping 2 in-TN / 4 out / 3 blank, and flagged it in its own notes as *"the weakest thing here."* Anthony's actual table: **Pickup 0 · Delivery (local dropoff) 0 · Split Ship 3 · Order Fulfillment 3 (placeholder, not yet in use) · Shipping 3 in-state, 3 out-of-state, 3 blank.** Deployed to both orgs. 📌 The three shipping constants are kept separate although all three are 3 — in-state vs out-of-state is the open question for Anthony's boss, and collapsing them would lose it. 📌 **The lesson is not that the guess was bad; it is that a guess dressed as code reads as fact to the next session** | §4 wave 0c |
| 2026-09-15 | ✅ **`ProductionEventPublisher` COVERAGE 20.5% → 89.3%, and four rebuild assumptions became asserted behaviour.** One new test method, `testConfirmPublishesEventAndUnconfirmRetractsIt`, walks a run `Planned → Confirmed → moved → Planned` and asserts: the scheduler leaves a `Planned` run alone; 🚩 **insert publishes NOTHING even for a run born with a window (the `oldMap` trap, asserted not assumed)**; confirming publishes exactly one Event with the right times, owner and subject; moving the window updates that Event rather than duplicating it; un-confirming **deletes** it; the run keeps its times. Test suite 4 of 5 → **5 of 6** in both orgs. 📌 `Auto_Scheduling_Status__c` has **four** active values — `Proposal`, `Confirmed`, `Planned`, `Unable to auto-schedule` — and **zero runs had ever held `Planned`**, so this test is the first thing in the org to exercise it | §4 wave 0c |
| 2026-09-15 | ✅ **WAVE 0c IS DONE IN BOTH SANDBOXES — `Production_Method__c` → `Decoration__c`, org side AND app side.** ❌ **This inverts trap 12, which said for a week that the API name would never change and `Decoration__c` does not exist.** 🚩 **It cost four Apex classes:** Salesforce refuses to rename an object any Apex references, so `OrderPrintDateRollup`, `ProductionAutoSchedulerSelector`, `ProductionEventPublisher` and `ProductionAutoSchedulerService` were emptied to stubs — **and never downloaded first, because Apex has no version history in the UI.** They were **rebuilt from live org data by Claude Code and are reimplementations, not restorations.** Seven artifacts now deployed and **verified byte-identical across dev2 and staging** (the four rebuilds + new `ProductionMethodTriggerHelper`, new `ProductionMethodTrigger` on `Decoration__c`, and the test class). ✅ **BFF: 21 object edits across 15 inline sites and 6 constants**, each asserted at its exact line before writing, `newline=""` throughout. ⛔ **Two byte-identical lines deliberately NOT touched** — `production-methods/index.js:91` and `pre-production-items/index.js:61` are the **field** `Pre_Production_Item__c.Production_Method__c`, which was never renamed — 🪤 **and `production-methods/index.js` holds the object and the field 27 lines apart, so a find-and-replace breaks it silently.** ⛔ **48 `Production_Method__r` traversals also stay**: a relationship name derives from the field, not the object, and rewriting them fails at runtime against a live org rather than at build time | §2 traps 12 & 15, §4 wave 0c |
| 2026-09-15 | 🔴 **THE ORGS DISAGREE ON THE RUN LINE ITEM OBJECT AND NO CHANGE SET CAN FIX IT** — dev2 is `Production_Run_Line_Item__c`, staging is still `Run_Line_Items__c`. The Metadata API has **no rename operation**: deploying a new `fullName` creates a **second** object and leaves the first one holding all the data. **Staging must be renamed by hand.** 5 BFF edits (`run-results/index.js:43`, `run-line-items/index.js:86`, `rework-check.js:295` and `:327`, `_rework.js:341`) are correct for dev2 and **wrong for staging** — and one deployment serves all three orgs, so the BFF cannot ship until staging is renamed. ⚠️ Read once, late in a long session: **re-verify both names in the org before acting** | §2 trap 10, §9 |
| 2026-09-15 | 📦 **Change set `0c Flow Fixes 2026-09-15` BUILT in dev2 — both repaired flows, not yet uploaded.** Upload only **after** staging's object rename, then **activate both by hand** (flows arrive Inactive) | §9 |
| 2026-09-15 | ❌ **CORRECTION — the row below (the 🚩🚩 uncommitted-rename alarm) was resolved the same day and its conclusion was inverted.** It read the working-tree `Decoration__c` sweep as a sweep against an object that does not exist, and recommended deciding whether to revert it. **The right answer was the third option: create the object.** `Production_Method__c` was renamed to `Decoration__c` in dev2 **and** staging on 2026-09-15, the BFF edits are correct, and they are now committed. 📌 **Kept rather than deleted, because the alarm was right on the facts it had** — a `FROM <object that does not exist>` sweep IS trap 1 at full blast radius, and it was found and stopped before it shipped. The failure mode it describes is real; only the resolution changed | §4 wave 0c |
| 2026-09-15 | 🚩🚩 **UNCOMMITTED IN THE WORKING TREE: a `Production_Method__c` → `Decoration__c` rename across 16 server files, 21 sites, and it reaches live SOQL** (`FROM Decoration__c` in `_rework.js`, `rework-check.js`, `inbox/index.js`, plus semi-joins). **`Decoration__c` does not exist** — "decoration" is the UI label for `Production_Method__c`. Nothing of this is in HEAD (0 occurrences), so it is working-tree only, but it is one `git add -A` away from shipping. Trap 1 at full blast radius: a missing object in a SELECT is a parse error that empties the board behind an HTTP 200, and these queries back the inbox, the calendar, the production board, run-results, rework-check and every rollup. Found while staging B24; **left untouched and uncommitted**. Decide whether the field is being created in Salesforce or the sweep should be reverted | §2 trap 1 |
| 2026-09-15 | **B24 — the AM's decoration now reaches the run form, and the form says what did not come with it** — `calendar.html`'s new-run form defaulted its decoration select to the order's FIRST `Production_Method__c`, so a Heat Press proposal on a two-decoration order booked press time against **Screen Print** with every other field correctly filled. New shared `matchProposalMethod()` in `ca-api.js` resolves `Machine_Group__c` against the order and never guesses — none / exactly one / several, and several is only resolved when the proposal's print location is offered by exactly one of them (D11/B4: two Screen Print decorations on different placements is a real order). ⚠️ **The decoration is resolved BEFORE the print-location guard** because that guard reads it; reversing the two lines fails 5 assertions in the harness's own negative control. All three guards now name what they dropped in the existing `runMsg` instead of blanking a box silently, and the AM's `notes` are displayed there — `POST /api/production-runs` writes six fields and none is a note, so there is nowhere to store it. `pre-production.html` deliberately does NOT set the decoration (the modal is fixed to one) and warns on a type mismatch only when it can positively tell. The `runMsg` chip lost its uppercase — it was built for "Run created." and now carries a human's note. **No new SOQL, no endpoint change.** 26/26 in `~/tmpwork/decorationcarry.mjs` plus two negative controls, and driven in a rig on a two-decoration order. Commit `4eb612c` on `feat/proposed-run-press`, unpushed. No Asana id supplied; B23 was taken | §4 B24 |
| 2026-09-15 | ✅ **WAVE 0b IS DONE IN BOTH SANDBOXES — `ProductionRequirements__c` → `Production_Requirement__c` and `ProductionPlan__c` → `Production_Plan__c`, org side AND app side.** Sequence used, and it is the one to repeat for 0c: deploy a STUB of the only referencing Apex class → rename → restore the class rewritten against the new names → change the BFF. Anthony did the three Apex/org steps by hand in dev2 and staging. ✅ **Rename verified by compilation, not by eye:** the restored `ProductionAutoSchedulerServiceTest` contains `Production_Plan__c` and `Production_Requirement__c` and is Active — Apex only saves if it compiles, so the objects must exist under the new names. ⚠️ **Tests: 4 of 5 pass.** `testHappyPath` fails at line 105 — *"One Event should be created: Expected: 1, Actual: 0"*. The three assertions before it pass, so the scheduler itself is fine (status `Proposal`, both scheduled times set); only the calendar Event is missing. 📌 **Probably NOT caused by the rename:** `ProductionEventPublisher` has ZERO references to either renamed object, and §2 rule 9 independently documents this exact failure (`Trigger.oldMap` is null on insert, so a run created already-Confirmed may publish no Event) — and the test inserts a run directly instead of the app's insert-then-PATCH. **Unresolved: no prior test history exists for the class, so whether it was ever green is unknown.** ✅ **BFF: 11 changed lines across 3 files** — 6 code, 5 comments. `plans/index.js` 2 (`FROM ProductionPlan__c` ×2), `production-methods/index.js` 6 (`REQ_OBJECT`, `PLAN_OBJECT`, 4 comments), `_rework.js` 3 (two composite **write** URLs + 1 comment). `node --check` clean on all three. 🪤 **THE TRAP THAT MAKES THIS A HAND EDIT: `ProductionPlan__c` is an object AND a field, four lines apart.** `production-methods/index.js:61` is `PLAN_OBJECT` (renamed); **`:65` is `PM_PLAN_FIELD` (must NOT be renamed)**. Same in `_rework.js`: `:500` is the object in a composite URL (renamed), **`:508` is the field in the body (not renamed)**. A find-and-replace breaks both files silently. Four old-name mentions deliberately remain and are all correct — they are the field | §2 r14, §9, §11 |
| 2026-09-14 | 🚩 **THE CUSTOM-FIELD EDIT PAGE WEDGE IS WIDER THAN RECORDED — it is not an Order-only problem.** Attempted the nine stale "...Method..." field labels left over from the Decoration relabel, starting with `Production_Run__c.PrintMethod__c` → *Decoration*. The classic direct edit URL `/<fieldId>/e` is a clean, compact form and loads fine; **saving wedges the renderer.** Hit twice by two different mechanisms — a synthetic mouse click on Save (CDP `Input.dispatchMouseEvent`, 30s timeout) and then setting `MasterLabel` + `input[name=save].click()` from inside the page (`Runtime.evaluate`, 45s timeout). ⛔ **It is the renderer, not the input path, so there is no scripted way around it.** Stopped after the second attempt per the standing rule (§2 rule 13, and the 2026-09-08 entry that first recorded this for Order). ✅ **NOTHING WAS SAVED** — all seven reachable field labels read back unchanged from a fresh tab: `PrintMethod__c` *Print Method*, `Pre_Production_Item__c.Production_Method__c` *Production Method*, `Print_Process_Details__c.ProductionMethod__c` *Production Method*, and Production Plan's `TotalMethods__c` / `MethodsComplete__c` / `AllMethodsComplete__c` / `BlockedProductionMethods__c`. 📌 **Useful contrast: the OBJECT edit page does NOT wedge** — four object label changes went through cleanly the same afternoon. The trap is specifically the **field** edit page. 📌 **Also learned from the form before it froze: `AggregateRelationshipName` is `Production_Runs` and `RelationshipLabel` is *Production Runs*** — first-hand confirmation of the child relationship name §2 rule 2 asserts. ➡️ **Next step is the CLI, not more clicking:** a field `<label>` change is an ordinary Metadata API deploy (unlike an object API rename), so all nine become one small deploy per org | §2 r13, §11 |
| 2026-09-14 | ✅ **`Production_Run_Line_Items__c` RELABELLED "Run Line Item" in dev2 AND staging** — the rename map's target label, taken for free. API name **unchanged** (still the plural `Production_Run_Line_Items__c`, which remains one of the three objects whose API name breaks the label→API pattern, §9). 🚩 **And it surfaced real pre-existing drift: staging's labels were already wrong.** Singular read *"Production Run Line Items"* (plural, where dev2 said singular) and the **Plural Label was literally `Production_Run_Line_Items`, underscores and all** — the API name leaked into a user-facing label at some point and nobody noticed, because nothing in code reads a label. Both orgs now read Run Line Item / Run Line Items. 🪤 **A near-miss worth recording: the object edit form can open SCROLLED.** The first Edit click was swallowed (see the previous entry), the second opened the form already scrolled past the label fields, and blind typing at the usual coordinates landed on the Optional Features / Object Classification checkbox block. **Typed label text contains spaces, and a space on a focused checkbox toggles it** — so that is a silent way to flip `Allow Sharing`, `Allow Bulk API Access` or `Track Field History` while believing you are renaming something. Cancelled without saving, verified the checkboxes were untouched, and redid it. ⛔ **Screenshot the form before typing into it; never reuse coordinates across a page load** | §9, §11 |
| 2026-09-14 | ✅ **STAGING NOW SAYS "DECORATION" TOO — label only, applied by hand, the two sandboxes agree again.** `Production_Method__c` in staging: Label → **Decoration**, Plural → **Decorations**; API name untouched, as in dev2. Done by hand because **labels do not travel on a change set**, so there was nothing to promote and nothing to deploy. 📌 **Object ids differ between the orgs** — staging's is `01Ica000000IeBt` against dev2's `01Ica000000So1v`, so a Setup URL copied from one org opens something else, or nothing, in the other. 🪤 **And the Lightning Details page swallows the first click on Edit** in both orgs — the button is in the accessibility tree and reports the click, but the form does not open until the page has fully settled. Click it twice, or verify the URL changed to `/edit?address=` before typing, or you will type into a read-only page and think it saved | §2 r12, §9, §11 |
| 2026-09-14 | ✅ **"PRODUCTION METHOD" IS NOW "DECORATION" — LABEL ONLY, dev2, and the API name deliberately did not change.** The goal was that the shop stops saying *Production Method*, not that the API name changes; those are different jobs and only one of them is cheap. ⛔ **Salesforce BLOCKS the API rename outright** — Object Manager → Edit → Object Name → Save returns *"Cannot rename custom object referenced in Apex class or trigger: `ProductionAutoSchedulerServiceTest`"*. A hard validation failure, nothing written; not a warning, not a cascade. 📌 **So an object's Apex reference count is a FEASIBILITY TEST, not a risk estimate** — zero references renames through Setup, one or more cannot be renamed through Setup at all. Proven both ways the same afternoon: `Production_Run_Line_Items__c` (0 Apex refs) renamed cleanly and was reverted; `ProductionPlan__c` (1 ref, and it is only the test class) was rejected. ⛔ **The Metadata API does not rename either** — deploying a CustomObject under a new fullName creates a SECOND object, so a deploy-based "rename" is really create + migrate 745 records + destructive-delete. The only real route is strip the Apex references → rename → restore, with the trigger **deleted and recreated** because a trigger names its object in its own signature. Not attempted; the wave is repriced accordingly. **What actually landed:** dev2 object Label `Production Method` → **`Decoration`**, Plural → **`Decorations`**, API name still `Production_Method__c`. Carries automatically to the tab, page layouts, the Order and Production Plan related lists, report types, list views and the New button — no Apex, flow, report or query affected, because nothing references an object by its label. Reversible in ~30 seconds. Plus **39 prose-only lines across 7 repo files**: `pre-production.html` 19, `index.html` 10, `order-sheet.html` 4, `calendar.html` 3, `shipping.html` 1, and one line each in `ca-api.js` and `functions/api/production-methods/index.js` — both a stale `Object Manager -> Production Method -> Fields -> Placement` Setup path that became wrong the instant the label changed. Headings, empty states, confirm/alert dialogs, one fallback label. Verified line-by-line old vs new, `node --check` clean on both .js files, all 10 inline `<script>` blocks parse. `functions/` otherwise untouched — its comments and `console.error` strings still say "Production method", which remains correct, since they describe `Production_Method__c`. 🚩 **NEW TRAP — §2 rule 12: label and API name now disagree on the busiest object in the system.** 🪤 **And `index.html` (3,458 lines) and `order-sheet.html` (399) are CRLF while every other board is LF** — a naive Python text-mode rewrite silently converts them and produces a whole-file diff instead of a 10-line one. Read and write those two with `newline=""`. Hit and corrected during this change. **Staging still says Production Method** (§9), and the field labels on `Production_Run__c.PrintMethod__c` and `Pre_Production_Item__c.Production_Method__c` were not swept | §2 r12, §9, §11 |
| 2026-09-14 | ✅ **PRIORITY FIELDS DEPLOYED dev2 → staging — and the deploy landed them with NO FIELD-LEVEL SECURITY, which is the part worth remembering.** Change set **`Production Method priority fields`** (`0A2ca000000IzWT`): `Production_Priority__c` (Number(2,2)), `Priority_Rating__c` (Picklist 1-5, local value set — checked, no global-value-set dependency), `Priority_Notes__c` (Text Area 255), all on `Production_Method__c`. Uploaded and deployed by Anthony. ✅ Verified in staging: all three present, Production Method now **94 fields, matching dev2**. 🚩 **BUT: `Production_Priority__c` is visible to 0 of 27 profiles in staging, against 26 of 26 visible-and-editable in dev2.** **A change set carries field permissions only for profiles included in the set, and none were included.** So `_priority-rollup.js:83` STILL fails in staging — except it now fails for exactly the reason its own error message names (*"check the integration user has Edit…"*), which is a far more convincing wrong answer than the field being absent. **Deploying a field is not the same as granting it.** ⛔ **Fix: Set Field-Level Security → Visible (not Read-Only); the load-bearing profiles are `Salesforce API Only System Integrations` and `Minimum Access - API Only Integrations`.** Added to the §9 list of what change sets do not carry. 📌 **§0 RESUME HERE was rewritten as a clean handoff** at the close of this session: what is done and verified in both orgs, six open items in priority order, the merge guardrail, and seven tooling lessons — including that **change sets work dev2 ⟷ staging** (three deploys this session proved it) and that **`device_commit_files` reports "written" without writing** in this iCloud folder, so every doc write needs reading back off the real file | §0, §9, §11 |
| 2026-09-14 | 🔍 **ORG PARITY RE-SWEPT dev2 vs staging, code-first — and it found one live silent failure.** Method worth repeating: parse every Salesforce field name out of `functions/` FIRST (**139 custom fields, 7 objects**), then enumerate both orgs and diff, then check each difference back against the code. Org-first gives a list nobody can act on; code-first tells you which differences can take a board dark. **HEADLINE: no field the UI reads is missing from either org — nothing is broken on screen.** `Order` (238 dev2 / 246 staging), `Proposed_Run__c` and `Pre_Production_Item__c` are identical on everything the code touches. 🚩 **THE ONE THAT MATTERS: `Production_Method__c.Production_Priority__c` does not exist in staging, and `_priority-rollup.js:83` PATCHes it on every refresh.** Every one of those 400s there. **It fails safely** — wrapped, logged, never thrown — which is exactly why it has been invisible. Cost: the priority score is **never written to Production Method in staging**, so any Salesforce report, list view or sort on that field is permanently blank; the dashboard is unaffected because it computes priority itself and the calendar reads the **Order** copy, which exists in both. 🪤 **The error string points at the wrong cause** (*"check the integration user has Edit…"*) — true in an org where the field exists, a wild goose chase in the org that actually breaks. **A 'most likely cause' written for the org you developed in is not the most likely cause in the org that fails.** 📌 Two further Production Method fields (`Priority_Rating__c` picklist, `Priority_Notes__c` Text Area 255) are dev2-only but **unused** — every code reference is `Order__r.Priority_Rating__c`/`Priority_Notes__c`, the ORDER fields, present in both. `Production_Run__c.Operator__c` dev2-only/unused; `Quantity_Completed_c__c`, `Reprint_Quantity_c__c` (Production Run) and `Actual_Good_Qty__c`, `Reprint_Qty_Needed__c` (Production Run Line Item) are staging-only leftovers, unused. **Leave all of those.** 📌 The code comment calling `Production_Priority__c` `Number(4,2)` is wrong — dev2 has `Number(2,2)`, which is fine: `scoreOrder()` clamps 1-10. ✅ **Every picklist the UI branches on is identical in both orgs** — `Production_Method__c.Status__c` (the board columns), `Type__c`, `Order.Order_Substatus__c`. 🪤 **But the sweep surfaced a trap that is in BOTH orgs, so a diff could never have caught it: `Order.Order_Substatus__c` has a value LABELLED "In Production" whose API NAME is "Production".** SOQL matches the API name, so `WHERE Order_Substatus__c = 'In Production'` returns **zero rows, silently, everywhere.** No code does this today — `BOARD_STATUSES` uses that literal against `Production_Method__c.Status__c`, where label and API name match. **Every other value on that picklist has label == API name, which is what makes this one easy to miss.** 📌 **Scraping recipe** (staging's Lightning Setup blocks page reads, classic does not): `/p/setup/layout/LayoutFieldList?type=<Order|01I id>&setupid=<OrderFields|CustomObjects>`; `01I` ids from `/p/setup/custent/CustomObjectsPage`. ⛔ `fetch()` from the page returns a 744-byte redirect stub — navigate page by page; ⛔ `/<01I id>` alone redirects to Lightning in staging | §9, §11 |
| 2026-09-14 | **"Back To Production" on counting's post-submit screen** — the confirmation panel only offered "Back To Runs", so a press operator finishing a count reached the board via the nav drawer or the browser. Added as an **anchor**, not a button with a handler: a page navigation rather than a state change, and it gets middle-click / open-in-new-tab free. Bare `index.html`, no query params — the run is submitted, so there is no card to deep-link to and `makeupHrefFor()` stays the single source of the make-up URL format. Nothing added to the props object. Placed inside `showResult` but **outside the four inner `sc-if`s**, so it renders in every variant rather than only the clean one. ⚠️ **Verified in real Chrome driven over CDP** — both in-app browser tools were unavailable this session (an MCP server name collides with a built-in), so `~/tmpwork/backbtn-verify.mjs` drives headless Chrome directly: 42 assertions across all four panel variants at 820px and 390px, and it hard-fails if the confirmation panel is never reached. Same width as the button above it (362px vs 362px on a phone), 9px below it, 46px tall; the amber make-up CTA still renders above both on `needsReschedule`. Branch `feat/counting-back-to-production` off `origin/main`, also cherry-picked onto `feat/proposed-run-press` so the working tree carries it. Unpushed. No Asana id was supplied | §4 |
| 2026-09-14 | ✅ **B9 ITEM 1 CLOSED — the enriched reprint email is live in BOTH sandboxes, and staging got it by change set rather than by hand.** Change set **`B9 Email Enrichment V2`** (`0A2ca000000Iz53`), one component `Flow Definition: B9_Order_Complete_With_Damage_Awaiting_AM`; dev2's active version was V2 so V2 is what travelled. Anthony deployed and **activated V3 in staging** at 7:30 AM, then ran an end-to-end test and confirmed the email reads correctly. Verified on staging's flow detail page: **Active Version 3**, created 7:29 AM, API 67.0; **V1 and the abandoned two-thirds hand-built V2 are both Inactive/Draft** and V2 can be deleted. **The whole "B9 in STAGING" hand-rebuild section in §4 is now superseded — it was never finished and never needed to be.** 🪤 **Dependency behaviour differs wildly by flow and the difference matters:** the screen flow reported **4** dependencies, this one **423**, because Salesforce walks transitively and drags in unrelated components plus a managed-package warning that comes from that noise. **Do not try to read a list that size.** The direct references were the expected set, and the one recently hand-built field that would genuinely break the build — **`Size_Sort__c`** — was spot-checked in staging first. **For a large dependency list, staging's Validate is the proof; it is non-mutating and definitive.** 📌 **Item 1 satisfies the original ask in full** — order, method, misprint counts, per-size breakdown, primary contact, plus a link — confirmed against real debug output rather than the canvas. Two structural nits (the `Totals:` line grouped with the methods instead of heading the size block; no blank line above `Account contact:`) were raised and Anthony chose to ship as-is; **they are now a two-org fix**. 🚩 **ONE THING TO TEST DELIBERATELY THE DAY `b47c233` SHIPS.** `_rework.js` states the app writes `Awaiting AM` and that this is *"what the Flow watches for in order to email the AM"* — **but the flow's entry condition is `Misprint Outcome Is Null`**, so the app writing `Awaiting AM` is the one thing that makes it false. It should still be fine (a record-triggered flow evaluates entry against the save that set Completed, not a later write) **but if that is wrong the failure is silent and total — the AM stops being emailed.** Do not find this out from an AM who never heard about an order. ⛔ **Still open and unrelated to item 1: the outcome BUTTON is on no staging page layout**, so staging has an active outcome flow nothing can launch; and **`Update Order` has never executed in either org** | §0, §4 B9, §11 |
| 2026-09-14 | ❌ **CORRECTION — dev2's B9 EMAIL flow V2 has been ACTIVE since 9/11 4:27 PM, and this document said "deliberately still Inactive" for three days.** Found by checking the org when Anthony asked whether the email feature's info was current — it was not. dev2's flow detail page reads **Active Version 2**, V1 now Inactive/Draft, activated by Anthony Martinez 9/11 4:27 PM. The ⛔ *"Do not activate V2 in dev2 yet"* line in §0 has been struck. **Staging is unchanged and was NOT activated: V1 still Active since 9/8, V2 still Inactive/Draft and still two-thirds built.** 📌 **Live consequence: the two sandboxes now send DIFFERENT emails for the same event** — dev2 the enriched one (order number, methods, per-size misprint/damage breakdown, primary contact), staging the original fixed paragraph with no merge fields. ⚠️ **The sequencing hazard activation was gated on is still open**, because `b47c233` is still unpushed: the deployed app still creates the reprint automatically while the flow emails the AM asking whether to create one. Activation changed only *which* email arrives, not that mismatch. 🚩 **AND A SAFETY ASSUMPTION IN THIS DOCUMENT IS WRONG IN ITS REASONING: "expect zero delivered emails from a sandbox" is not an org-level block.** Checked in both orgs 9/14: **Deliverability → Access to Send Email = `All email` in dev2 AND staging.** Neither is on "System email only". The only thing stopping B9 mail from landing is that sandbox refresh scrambles User emails to `.invalid`, which `Opportunity_Owner_Email__c` inherits — **a per-address property, not a wall.** This document already records the exception: **Anthony's own user is un-scrambled in both orgs**, so a qualifying order whose Opportunity Owner is Anthony will send a real email out of a sandbox. The accurate statement is not "sandboxes can't send" but **"most sandbox addresses are invalid, and we know of at least one that isn't."** 🎯 **Third stale-⛔ correction in four days** (after "B9 does not exist" and "change sets can't go dev2 → staging"). The pattern is consistent enough to be a rule: **a ⛔ line is a snapshot of a moment, and the org is the only source of truth** | §0, §4 B9, §11 |
| 2026-09-14 | ✅ **B9 ITEM 2 DEPLOYED dev2 → STAGING BY CHANGE SET — the first metadata that has ever moved between these sandboxes instead of being rebuilt by hand.** Change set **`B9 Record Misprint Outcome`** (`0A2ca000000Iyyb`), **two components**: `Flow Definition: B9_Record_Misprint_Outcome` and `Action: Record_Misprint_Outcome`. **Validate: Succeeded, Deploy: Succeeded 2/2**, 9/14 7:12 AM; Anthony activated the flow at 7:13 AM. Staging now reads **Active Version 1 · Screen Flow · Activated · API 67.0** (`300ca00000HHtPk`). **Verified in staging's own Deployment Status and flow detail page, not from the sending org's say-so.** 📌 **Two pre-flight checks that are the reason this landed clean, and both are worth repeating on the production run:** **(1) Dependencies** — Salesforce reported exactly four (`Misprint_Outcome__c`, `_At__c`, `_By__c`, `_Notes__c`) and **all four already existed in staging** with identical API names and types, so none were added; deploying a custom field over an existing one replaces the whole field definition, the same whole-component-replacement risk as a layout. **(2) The picklist** — `Misprint_Outcome__c` is **restricted**, so its values were read one by one in staging before uploading: all five active, including the three the flow writes verbatim (`Reprint`, `Credit`, `Refund`). Had any been missing the deploy would still have succeeded and the flow would have failed at runtime on the first real use. 🪤 **Change-set naming in this org:** a flow's component type is **`Flow Definition`** — there is no "Flow" entry in the Component Type list at all — and a Quick Action is type **`Action`**. ⛔ **NOT done and it is load-bearing: the button is on NO staging page layout.** The three Order layouts were deliberately kept out of the set (a layout in a change set replaces the whole layout and staging's may have diverged), so staging has an active flow that **nothing can launch** until `Record Misprint Outcome` is added by hand to **Order Layout**, **Order Layout - EMB** and **Order Layout - Heat Press**, between `Production Error` and `Edit`. ⛔ **AND THE WRITE PATH HAS STILL NEVER EXECUTED IN EITHER ORG.** A green deploy proves the metadata moved; it proves nothing about behaviour. `Update Order` remains readback-verified only in dev2 and staging inherits exactly that gap — **trap 11, a flow that completes is not a flow that works.** First real press in either org is the first real test; watch the print shop is notified once and only once. 🎯 **Cost of the wrong note this replaces: the staging mirror had been treated as a hand-rebuild for days on the strength of a ⛔ line that one Setup page disproved in ten seconds** | §0, §4 B9, §9, §11 |
| 2026-09-11 | ❌ **CORRECTION — dev2 → staging CHANGE SETS WORK, and this document said they did not. Anthony asked "can I not just use a change set?" and he was right.** dev2 → Setup → **Deployment Settings** shows three connections; the **`dev2 ⟷ Staging`** row has a **double-headed arrow** — upload authorised **in both directions**, and it has been all along. The claim I had recorded (*"change sets only move between a production org and its own sandboxes"*) is simply false: Salesforce creates deployment connections between **every org in a production org's family, sandbox-to-sandbox included**. `dev2 ⟵ Production` and `dev2 ⟵ Dev` are single arrows by contrast, so the double arrow is unambiguous. 🎯 **The cost of that error: the staging half of B9's email flow was being hand-rebuilt element by element, and the entire Salesforce-CLI detour was undertaken to solve a problem that did not exist.** ⚠️ **Two real caveats before anyone fires a change set, though — it is not a pure copy:** **(1) a change set deploys a Flow INACTIVE** (§9), so `B9 Record Misprint Outcome` will land in staging as an inactive version and must be **activated by hand there** — and the Quick Action cannot be created against an inactive flow, so the order is deploy → activate → then the action if it is not in the same set. **(2) A PAGE LAYOUT IN A CHANGE SET REPLACES THE WHOLE LAYOUT, not just the action you added.** If staging's `Order Layout` / `- EMB` / `- Heat Press` have diverged from dev2's in any way, deploying dev2's versions **overwrites staging's**. 📌 **Safer split: put the Flow and the QuickAction in the change set, and add the action to staging's three layouts by hand** — that is three small edits against an unknown-divergence risk that is invisible until someone notices a missing field. 📌 **Components to include:** `Flow: B9_Record_Misprint_Outcome`, `QuickAction: Order.Record_Misprint_Outcome`, and — only after checking parity — `Layout: Order-Order Layout`, `Order-Order Layout - EMB`, `Order-Order Layout - Heat Press`. **Verify the receiving end** (staging → Deployment Settings → the dev2 row must allow inbound) before uploading. 🎯 **Standing lesson, and it is the same one as the "B9 does not exist" correction: a ⛔ capability claim in this document is the most likely kind of line to be stale or wrong, because it gets written at the moment of frustration and never re-tested. Check the ORG, not the row** | §4 B9, §9, §11 |
| 2026-09-11 | ✅ **B9 ITEM 2 IS BUILT IN dev2 — `B9 Record Misprint Outcome`, the screen the reprint email points at.** Anthony: *"Let's do the Approve/Decline mechanism on the Order."* Three decisions, all his: **(1) a screen flow launched from a Quick Action on the Order** — which is the "put the decision in Salesforce, not in this app" option §4 argued for, and it makes the whole capability-URL / Cloudflare-Access collision (E6.4) simply not happen: no token, no new endpoint, no Access exception; **(2) three outcomes offered — `Reprint` · `Credit` · `Refund`** — `Misprint_Outcome__c` has five restricted values and three overlap, so `Credit/Refund` stays **active on the field** (historical records still read correctly) but is **never shown to the AM**; **(3) notes required for everything but `Reprint`** — a reprint explains itself, money leaving does not. **Shape:** `Get Order` by `recordId` → `Outcome Already Recorded` decision → *Already Recorded* to a **dead-end screen**, *Default* to the `Record Outcome` screen → `Update Order` stamping `Misprint_Outcome__c` + `_By__c` (`{!$User.Id}`) + `_At__c` (`{!$Flow.CurrentDateTime}`) + `_Notes__c` **in one DML**. ⛔ **The guard is not politeness — it prevents re-notifying the print shop.** `Printshop Misprint Process` and `Misprint Outcome Slack` test *state* ("not null AND not `Awaiting AM`"), **not transition**, so re-recording an outcome fires the print-shop notification and the Slack post **again**, invisibly. Both clauses of the guard are load-bearing: `Awaiting AM` is what B9's email flow writes, so "is not null" alone would dead-end every order that legitimately arrives. 📌 **Conditional-required is done with component visibility, not with Required:** the Notes box is Required unconditionally and *hidden* unless outcome = Credit or Refund — a hidden required component does not block Finish. **Do not "fix" that by unchecking Required.** The three Choice resources store the picklist API values **verbatim**, so `{!outcomeChoice}` drops straight into the restricted picklist; rename a picklist value and these break silently. **Button:** Quick Action **Record Misprint Outcome** / `Record_Misprint_Outcome` (`09Dca000000BAQf`), added between `Production Error` and `Edit` on **Order Layout** (`00h5e…cR2fAAE`), **Order Layout - EMB** (`00hca…Yf1lAAC`) and **Order Layout - Heat Press** (`00hca…YRrdAAG`) — the three layouts the press record types actually use; Ecommerce/ShipStation deliberately skipped. 🪤 **A Flow Quick Action can only reference an ACTIVE flow** — it does not appear in the picker while Inactive, so activate first, then create the action; that is the order to repeat in staging and production (where change sets land flows Inactive, §9). ✅ **Verified by debug** against order **00013509**: Get Order retrieves, a blank outcome takes the **default** branch, the prompt's merge field resolves to the real order number, three choices render, and Notes appears on Credit and disappears on Reprint. ⛔ **But `Update Order` has NEVER EXECUTED.** The debug was stopped at the screen on purpose — finishing it would have written a real dev2 order and fired the print-shop + Slack notifications, and **Flow Builder offers no rollback option for screen flows** (unlike a record-triggered debug). So the four field bindings are **readback-verified only**, which is exactly the assurance level trap 11 says is not enough: *a flow that completes is not a flow that works.* **The first real button press is also this flow's first real test — watch the print shop gets notified once and only once.** 🪤 **Four UI traps, all new:** a screen component's **API Name autofills from its Label and APPENDS** what you type (`Outcome` + `outcomeChoice` → `OutcomeoutcomeChoice`); **a screen's API name collides with a Decision OUTCOME's** — outcome names share the flow namespace, so `Already Recorded` had to become `Already_Recorded_Screen`; the **classic page-layout editor sits in an iframe that ignores scrolling**, so the Actions section is unreachable without scripting the scroll; and **Flow Builder's renderer froze twice** — recovery is a *fresh tab*, not a reload. ⛔ **dev2 ONLY. Nothing created in staging or production** (Anthony's scope call). **And nothing yet makes a pending decision visible** — an AM who never presses the button leaves an order at `Awaiting AM` forever, which is the "nothing must rot silently" warning §4 wrote down and still nobody has addressed | §4 B9, §11 |
| 2026-09-11 | 🔧 **STAGING MIRROR STARTED — V2 is about two-thirds built, INACTIVE, and deliberately NOT exercised.** Built and saved in staging V2: the 7 variables, `fRecordLink`, `fRowMis`/`fRowDam`, `tGroupLine` (with the U+200B anchor), `Get Damaged Line Items` switched to **All records / Ascending by `Size_Sort__c`**, `Get Order Methods`, `Get Primary Contact`, `Init Email Build`, `Loop Damaged Rows`, `Same Size As Previous`, `Accumulate Into Group`, `Group Pending`. **Remaining: `Flush And Start Group`, `Start First Group`, `Flush Last Group`, `Loop Methods`, `tMethodItem`, `fMethodNotListed`, `Method Not Listed`, `Append Method`, `tEmailBody`, and the Send Email wiring** — all ten written out with their exact post-fix values in §4 B9 → "B9 in STAGING". **Staging V1 stays Active and untouched throughout.** ⛔ **The debug was skipped on Anthony's instruction, and staging could not have been debugged anyway: no line item in the org carries both an `Order_Id__c` and a misprint/damaged quantity.** Staging has 14 line items; the three with misprints (PRLI-0001/0003/0004) have no Order Product so their `Order_Id__c` formula is blank, and the ten that do have an Order Id (order **00009525**, already `Completed`, multiple methods, S–2XL) have no quantities. The fixture to build when someone wants to debug it is recorded in §4. **So staging V2 is read-back-only and its first real run is unproven** — which matters more than usual here, because in dev2 the debug was the only thing that caught all three defects. 🪤 **Two org facts worth not rediscovering:** object key prefixes are **not** shared between the sandboxes (Production Run Line Items is `a3V…` in staging, `a3W…` in dev2), so no id or prefix travels between orgs; and staging's Lightning Setup shell blocks **both** screenshots and page reads (dev2 allowed screenshots), leaving the **classic `/300` Flows list on `my.salesforce.com`** as the way to find a flow's DefinitionId and version ids. The 9/08 staging flowId in this document no longer resolves — the doc's own rule, demonstrated. 🪤 **And the reason this is slow: a Flow Builder combobox closes itself after ~2 seconds** (so a 3-second screenshot looks like a failed click — screenshot within 1s), **you must click the dropdown's ARROW not its text**, a click straight after typing elsewhere is swallowed as a blur, and `find` + click-by-ref is the escape hatch worth reaching for after two failed clicks rather than ten. ❌ ~~**No metadata shortcut exists:** change sets only run between a production org and its own sandboxes, so dev2 → staging is not a valid pair~~ — **THIS WAS WRONG, corrected the same day; see the change-set row at the top of this log. dev2 ⟷ Staging change sets are authorised in both directions and always were** | §4 B9, §11 |
| 2026-09-11 | ✅ **B9 EMAIL ENRICHMENT IS BUILT AND VERIFIED IN dev2 V2 — and the debug run found THREE defects a complete, green, saved flow was hiding.** All ten specced items are in: `Accumulate Into Group`, `Group Pending`, `Flush And Start Group`, `Start First Group`, `Flush Last Group`, `Loop Methods` → `Method Not Listed` → `Append Method`, the three plain-text templates, `fRecordLink`, and `Send Reprint Email To AM` wired to `{!tEmailBody}` with the order number in the Subject, Rich-Text Body empty and **Use Line Breaks = True** (an addition, and not optional — it is what renders the newlines). **V2 is still INACTIVE and V1 is still live**; reloaded fresh from the server and re-debugged against order **00013504** (Screen Print + Heat Press, 7 rows, 4 sizes), reading the Send Email action's **resolved input values**, which is the only place the real message text exists. 🪤 **Defect 1 — `CONTAINS()` on an empty variable returns null, not false, so the print-methods list was silently EMPTY on every order.** `NOT(CONTAINS({!vMethods}, …))` evaluates to null on the first iteration, the Decision never matches, nothing is ever appended. **`BLANKVALUE(x,'')` does not fix it** — an empty substitute is still blank. Fixed by making the haystack non-empty: `NOT(CONTAINS('#' & {!vMethods}, TEXT({!Loop_Methods.Type__c})))`. `TEXT()` separately required — `Type__c` is a picklist (trap 5, as B4 hit). 🪤 **Defect 2 — a null quantity seeded a counter as null and printed as a blank:** `L — 2 misprint,  damaged`. **Flow's `Add` treats null as zero; `Equals` copies the null through** — which is why the totals were right and the per-size line was not. Fixed with `fRowMis`/`fRowDam` = `BLANKVALUE(<qty>, 0)`, used at every read of a quantity. 🪤 **Defect 3 — Flow strips leading AND trailing whitespace from a text template on save, so every list item ran together on one line** (`Screen PrintHeat Press`). This **undoes the "use a text template, formulas cannot make a newline" advice** — a template whose separator is at either boundary loses it, silently, and reopens looking like a single line. Interior newlines survive. Fixed by anchoring the newline with a **zero-width space (U+200B)** as the template's first line; it is invisible in the mail and not whitespace to the trimmer. **That blank-looking first line in `tGroupLine` and `tMethodItem` is load-bearing — do not clean it up**; both templates say so in their org descriptions. 📌 **The through-line: the canvas was complete and the flow completed successfully on every run. Three separate wrong emails.** *A flow that completes is not a flow that works* — read the action's resolved inputs, not the green chip. Also caught: `Flush Last Group` landed **inside** the loop (the element list's connector label lied; verify by zooming the canvas, not by reading a label), and a Decision **cannot** take a formula inline, which is why `fMethodNotListed` exists as a resource. ⏭️ **Open: activate V2 (gated on the unpushed app half `b47c233`), mirror the whole build in staging by hand, create `Size_Sort__c` in production, delete dead `vSizeLadder`/`vOtherLines`** | §4 B9, §11 |
| 2026-09-11 | 📌 **SCOPE, Anthony 2026-09-11: production is OUT for now — dev2 and staging only.** The production Setup checklist in the row below stands but is **deferred, not cancelled**. ⛔ **The merge guardrail does NOT relax with it: `feat/proposed-run-press` and the 14-commit stack still must not reach `main`** while production lacks `Proposed_Run__c.Press__c`, because `proposed-runs/index.js` and `calendar/index.js` name that field and trap 1 fails the whole SELECT — calendar and proposals list both go dark. Deferring the field means deferring the merge, which also means **B9's app half (`b47c233`) stays unshipped**, so in whichever org the app points at, the flow keeps emailing the AM about a reprint the deployed app has already created. Known and accepted for now; it is the reason not to leave this half-done indefinitely. ✅ **`Size_Sort__c` now exists in STAGING too** (`00Nca00000BHlcY`, object `01Ica000000Otsz`) — Formula (Text), Check Syntax clean, **compiled size 1,437 characters, identical to dev2's**, and the saved formula body read back off the field detail page matches dev2 character for character. Both sandboxes are now ready for the flow half of the email enrichment; nothing in staging is blocked behind field work any more | §4 B9, §11 |
| 2026-09-11 | 🚩 **SEQUENCING CORRECTED — `b47c233` CANNOT SHIP ON ITS OWN, and that collapses three open items into one.** I had been describing "push B9's app half" as a decision separate from the press feature. It is not. `b47c233` is the **10th-newest of 14 unpushed commits** on this stack; `411715e` and `d9eeb4f` (the press feature) sit **on top of** it, so merging the branch to `main` ships B9's opt-in reprint AND the press feature together. Anthony merges through the **GitHub web UI**, which has no cherry-pick, so splitting them is not practically available. ⛔ **Therefore the whole queue is gated on ONE thing: `Proposed_Run__c.Press__c` existing in PRODUCTION.** Without it, `proposed-runs/index.js` and `calendar/index.js` name a field that is not there and **trap 1 fails the entire SELECT**, taking down the calendar and the proposals list. With it, the stack merges and B9's app half ships in the same motion — which also **resolves the live mismatch** where both sandboxes' flows email the AM about a reprint the deployed app has already created automatically. 📌 **Production Setup checklist, ~20 minutes, all of it in CLASSIC Setup on `cultureapparel.my.salesforce.com` (the Lightning shell is not scriptable; classic is):** (1) **`Proposed_Run__c.Press__c`** — `/p/setup/field/NewCustomFieldStageManager?entity=<01I id of Proposed Run>`, data type **Lookup**, related to **Account**, label `Press`, name `Press`, child relationship **`Proposed_Runs`**, **Required OFF**, delete-behaviour **Clear the value** (`fkConstraint=N`), lookup filter **`Account.Type` equals `Press`** with `IsOptional=0`; get the `01I` id from the Custom Objects page. (2) **`Production_Run_Line_Item__c.Size_Sort__c`** — Formula (**Text**), body exactly as recorded in the B9 spec above, and run **Check Syntax** before saving. (3) Confirm the five press Accounts exist in production with `Type = 'Press'` — production may not carry the same five as the sandboxes, and `Account.Print_Method__c` is only needed if the press-method filtering is ever revived. 🎯 **Do NOT merge before step 1.** After it, the 14-commit stack can go in one merge | §4 B9, §11 |
| 2026-09-11 | 🔧 **B9 email enrichment IN PROGRESS in dev2 — checkpointed as V2 (Inactive); V1 is still the live flow.** Anthony asked the reprint email to name the order, the method, the misprint count, the sizes, and the account's primary contact. Today's email has **no merge fields at all** — a fixed paragraph that does not even carry the order number. 🔑 **Where the logic had to live was decided by evidence, not preference:** the flow fires on Order when `Production_Status__c = 'Completed'` AND `Misprint_Outcome__c` is null, after-save, "only when updated to meet" — and **nothing in `functions/` ever writes `Production_Status__c`**, so the app is not what trips the trigger and cannot be relied on to have written a summary field first. The aggregation therefore lives in the flow. ⚠️ **TRAP FOUND — `Production_Run_Line_Item__c.Method__c` IS NOT A METHOD NAME.** It is `CASESAFEID(ProductionRun__r.PrintMethod__c)` — an 18-character record Id. Merging it into an email would show the AM `a1Xca0000012345ABC`. The method words come from `Production_Method__c.Type__c` off the Order instead (one hop, Master-Detail). **Third formula-field trap on this project** after the `HYPERLINK()` HTML in B22 and the duplicate `Opportunity_Owner_Email__c` labels. 🎯 **DESIGN CHANGED MID-BUILD, on cost.** Grouping sizes in wearing order first meant an 11-row `vSizeLadder` seed inside the flow — and Flow's comboboxes only open on click-then-Down and only commit on blur, so that is **~10 UI interactions per row, ~100 per org, ~300 across three orgs, purely for row ordering.** Replaced with **`Production_Run_Line_Item__c.Size_Sort__c`**, a Formula (Text) created in dev2 (`00Nca00000BHgJA`): `RIGHT("0" & TEXT(CASE(UPPER(TRIM(Size__c)), "YS",1, "YM",2, "YL",3, "XS",4, "S",5, "M",6, "L",7, "XL",8, "2XL",9, "XXL",9, "3XL",10, "XXXL",10, "4XL",11, "XXXXL",11, 99)), 2) & "|" & UPPER(TRIM(Size__c))` — checked with Check Syntax, no errors. 📌 **Why rank AND the size in one key:** Get Records allows only ONE sort field, so `"01\|YS"` / `"05\|S"` / `"99\|OSFA"` makes a single ascending sort both order the sizes and keep identical sizes adjacent, which is what a single-pass grouping loop needs. Unrecognised sizes get rank 99 and fall to the end grouped by name — nothing is dropped, and the whole catch-all pass the ladder design needed disappears. ✅ **Built and read back in dev2 V2:** `Get Damaged Line Items` now returns ALL rows (was first-match-only, an existence check); `Get Order Methods` (Production Method where Order = triggering order); `Get Primary Contact` (Contact where Id = Account → Primary Contact — the two-hop resource traversal works, so this is one element, not two); eight variables. 🪤 **Two UI lessons, both cost time:** this is a **Mac**, so select-all is **cmd+a** — `ctrl+a` moves to line start and silently PREPENDS, which is what produced `RunPressPress` earlier and what kept corrupting Developer Console queries; and the Flow canvas **does not scroll on the wheel, it pans by dragging**. ⏭️ **Remaining:** sort the query by `Size_Sort__c`, drop `vSizeLadder`/`vOtherLines`, add `vPrevSize`, build the single-pass loop (loop + 3 decisions + 4 assignments), the method loop, the text templates and the body, then activate — then the same in staging, and `Size_Sort__c` in production before any of it ships | §4 B9, §11 |
| 2026-09-11 | ❌ **CORRECTION — B9 IS BUILT, and the doc said it was not. My error, found only because Anthony said so and I went and looked.** Both halves exist. **Salesforce:** `B9 Order Complete With Damage - Awaiting AM`, **Active V1 in dev2 AND staging**, saved 2026-09-08 2:49 PM — record-triggered on Order, 2 entry conditions, `Get Damaged Line Items` → `Has Misprint Or Damage` → `Set Awaiting AM` → `AM Email On Order` → `Send Reprint Email To AM`. **App:** commit **`b47c233`** — `_rework.js` carries `OUTCOME_AWAITING = 'Awaiting AM'` and writes it with `Misprint_Outcome_At__c`, `inbox/index.js` runs a **B9 sweep** that builds the reprint for orders where `Misprint_Outcome__c = 'Reprint'`, and `rework-check.js` reports the B9 states (`declined_by_am`, `awaiting_am`, decision-not-requested, `unknown_outcome`). 🚩 **THE HALVES ARE OUT OF STEP: `b47c233` IS UNPUSHED, so the deployed app does not have it** — `origin/main` still auto-creates the reprint the moment the last method completes, while both sandboxes' flows now email the AM to ask about a reprint the deployed app has already built. That is the sequencing hazard this story was written to avoid, live in whichever org the app points at. **Either push `b47c233` or expect the email to be asking about an order that already exists.** 🎯 **Lesson: the doc's ⛔ lines are the ones most likely to be stale** — they get written at the moment of blocking and never revisited. Two separate places said B9 did not exist; both were hours out of date. Re-read the ORG, not the row. | §4 B9, §11 |
| 2026-09-11 | **The AM's proposed press now reaches the run form** — `calendar.html` and `pre-production.html` both prefill `Press__c` from the proposal instead of making the manager re-pick a press the AM already chose, and both show it on the suggestion card (leading the meta line, ahead of print location) so it can be read before committing. **Two different guards, because the two pickers fail differently:** the calendar's is a `<select>`, so the press is carried only when it is actually in `presses()` — a `<select>` given a value with no matching `<option>` renders BLANK while reading as filled, and `POST /api/production-runs` requires `pressId`; pre-production's is a typeahead, where the visible box is bound to `pressQ` while the submit sends `pressId`, so id + name + query move together or not at all. Server side was already committed at `411715e`. Demo: calendar's `Proposals` fixture now carries `pressId:'p2'` (a real `_demo.presses` id, so demo exercises the carry-through, not the fallback); pre-production has no proposal fixtures at all — it fetches them live — so nothing to add there. Verified by `~/tmpwork/presscarry.mjs`, which extracts both real `useProposal()` bodies out of the shipped HTML and asserts on the patch that reached `setRunField()` — 9/9, and confirmed to FAIL 2/9 when the calendar guard is deleted — plus a browser run of both surfaces. ⛔ **DO NOT MERGE TO `main`:** production has neither `Proposed_Run__c.Press__c` nor the flow, and `proposed-runs/index.js` + `calendar/index.js` now name that field in their SELECTs — trap 1, so an org without it loses the WHOLE calendar and proposals list behind an HTTP 200. Branch `feat/proposed-run-press`, unpushed | §4, §9 |
| 2026-09-11 | ✅ **STAGING now matches dev2 — both fields and the flow, all three verified by reading them back.** **`Account.Print_Method__c`** created (restricted picklist `Screen Print` / `Heat Press` / `Embroidery`) and set on the same five press Accounts, each confirmed `Type = 'Press'` at the moment of the edit: Press 1 `001ca00000SLbkR` → Screen Print, Press 2 `001ca00000SLRWZ` → Screen Print, Embroidery Machine `001ca00000SLXNV` → Embroidery, Shirt Press `001ca00000SLfo1` → Heat Press, Hat Press `001ca00000SLRLJ` → Heat Press — **re-fetched from the server afterwards, all five correct.** **`Proposed_Run__c.Press__c`** created as Lookup(Account) (`00Nca00000BH9u4`, object `01Ica000000W5z4`) and **compared field-by-field against dev2's `00Nca00000BHBfz`: label, API name, child relationship `Proposed_Runs`, Required off, `fkConstraint=N`, filter `Account.Type equals Press`, `IsOptional=0` — identical in both orgs.** **Flow: V45 saved and ACTIVE** (`301ca00000TvKKiAAN`), carrying the same three edits as dev2's V44 — `PressChoices` record choice set, `Press`/`RunPress` picklist inside the Schedule Runs repeater, and the `Press ← Current Item from Loop Loop Run Rows > Press` mapping on Create Proposed Run — all re-verified after a fresh reload of V45 from the server. 🎯 **THE DOC WAS WRONG ABOUT STAGING AND IS NOW CORRECTED: browser automation CAN reach staging.** §"What a session like this cannot do" claimed the extension had no permission on the staging hosts; it has, and classic Setup on `cultureapparel--staging.sandbox.my.salesforce.com` is as scriptable as dev2's. Two staging-specific notes worth keeping: **Lightning record pages are forced, so the classic edit form needs `/<id>/e?nooverride=1&isdtp=vw`** (the field's `00N…` id is the `<select>`'s DOM id — find it by matching option values); and **screenshots work on `my.salesforce-setup.com` but JavaScript does not**, so the Lightning Flows list is drivable by click and scroll only, and it lazy-loads in blocks that skip letters when you scroll fast. ⚠️ **Version numbers still do not align across orgs** — dev2 went V43→V44, staging V44→V45, same change. ⚠️ **Neither org has been exercised end to end yet**, and **production still has neither field**, so `feat/proposed-run-press` must not reach `main` until production has `Proposed_Run__c.Press__c` — `proposed-runs/index.js` and `calendar/index.js` now name it in their SELECTs and trap 1 fails the WHOLE query, not just that column | §4, §11 |
| 2026-09-11 | ✅ **Press-on-proposed-run is BUILT AND LIVE IN DEV2 — flow included. `Order_and_Order_Items_SubflowDesign` V44 is saved and Active.** The Schedule Runs screen now carries a **Press** picklist (API name `RunPress`, Text, **not required**) **inside the "Schedule Runs" repeater**, so every row a manager adds gets its own press — the same screen as the Machine Group/Method picker, as asked. Its choices come from a new **Record Choice Set `PressChoices`**: object `Account`, filter `Type Equals Press`, **Choice Label = `Name`, Choice Value = `Id`**, data type Text — so the picklist shows "Press 1" and stores the 18-character Account Id the lookup needs. `Create Proposed Run` gained one mapping: **`Press` ← `Current Item from Loop Loop Run Rows > Press`**, alongside the eight that were already there (Machine Group, Notes, Order, Print Location, Proposed Hours, Proposed Start, Quantity, Status). 🔑 **Verified by reloading V44 fresh from the server and re-opening both elements**, not by trusting the save toast — the picklist is inside the repeater box (above Remove/Add, not after it), Choice reads `PressChoices`, and the field mapping is present. ⚠️ **Not yet exercised end to end.** The one thing metadata cannot prove is that a Text choice value lands in a **Lookup(Account)** field through Flow DML; the lookup filter `Account.Type equals Press` will never reject a value that came from `PressChoices`, so this is expected to pass, but **the first Close and Create Order run in dev2 is the test** — pick a press on a run row, then check `SELECT Press__c, Press__r.Name FROM Proposed_Run__c ORDER BY CreatedDate DESC LIMIT 5`. ⚠️ **The Developer Console query editor could not be driven this session** — `CodeMirror.setValue()` reports the new text but the console executes its old buffer, and `ctrl+a` prepends instead of replacing, so a half-typed query kept erroring. Not worth fighting; Setup itself stays scriptable via classic. 📌 **Staging is deliberately untouched** — Anthony reviews dev2 first, then the two fields + the same flow change get replicated there. | §11, this row |
| 2026-09-11 | 🔧 **Press-on-proposed-run: BOTH FIELDS BUILT IN DEV2 and verified.** **`Account.Print_Method__c`** — restricted picklist, values `Screen Print` / `Heat Press` / `Embroidery` matching `Production_Method__c.Type__c` exactly; populated on all five press Accounts (Press 1 → Screen Print, Press 2 → Screen Print, Embroidery Machine → Embroidery, Shirt Press → Heat Press, Hat Press → Heat Press — the same mapping `PRESS_GROUPS` infers from names, now written down where Salesforce can read it). **`Proposed_Run__c.Press__c`** — **Lookup(Account)**, optional, clear-on-delete, child relationship `Proposed_Runs`, lookup filter `Account.Type equals Press`; API name deliberately matches `Production_Run__c.Press__c` so the value copies to the real run with no name matching. Both confirmed by querying `FieldDefinition`, not by trusting the save screen. 🎯 **TOOLING LESSON, and it reverses what this row first said: Salesforce Setup IS fully scriptable from this session — via CLASSIC Setup on `my.salesforce.com`, not the Lightning shell.** The Lightning Setup shell (`my.salesforce-setup.com`) renders its content in a frame the extension's JavaScript cannot see (`iframes: 0`, `radios: 0` while the screenshot plainly shows them) and will not scroll from synthetic input — which looked like a hard wall. **The classic equivalents are ordinary pages in the same document**: `/p/setup/layout/LayoutFieldList?type=<Object>` for a standard object's fields and `/p/setup/field/NewCustomFieldStageManager?entity=<Object or 01I id>` for the new-field wizard, where every input has a plain id (`MasterLabel`, `DeveloperName`, `ptext`, `pickopts_1`, `DomainEnumOrId`, `fkConstraintN`, `critfld1`/`critop1`/`pVAL1`) and can be set and submitted with one script per step. Get a custom object's `01I` id from `SELECT DurableId FROM EntityDefinition`. ⚠️ Two gotchas: the stage manager reports **"Invalid Data"** from stale DOM even when it has advanced a step — **check `Step N of M` rather than trusting the banner** — and Execute Anonymous / Query Editor coordinates shift when the window resizes, so drive the console by JS, not clicks | §4, new story | The Setup content frame blocks the extension's JavaScript *and* page-reading (`Permission denied for reading pages on this domain`), and it does not scroll from synthetic input — so only what fits in a fixed ~849px viewport is clickable, and step 1 of the New Custom Field wizard needs a radio below the fold. **Reading the orgs works fine** (Developer Console queries, Execute Anonymous, Flow Builder inspection) — it is only *editing* metadata through the UI that is out of reach. 📌 **So the split for any Salesforce metadata story is: Claude specs and verifies, Anthony clicks.** Do not plan a story around Claude driving Setup. Spec covers `Account.Print_Method__c` (picklist, values matching `Production_Method__c.Type__c`), `Proposed_Run__c.Press__c` (Lookup(Account), optional, filtered to `Type='Press'`), the Repeater-screen change in `Order_and_Order_Items_SubflowDesign` v43→v44, and the app-side carry-through | §4, new story |
| 2026-09-11 | 🔍 **Survey for a new story — a press picker on Close and Create Order — and it turned up a structural gap.** Presses are **Account records with `Type = 'Press'`** (dev2 has exactly five: Press 1, Press 2, Embroidery Machine, Shirt Press, Hat Press) and `Production_Run__c.Press__c` is **Lookup(Account)**. `Proposed_Run__c` has **20 fields and no press field** — checked against the object, not the app's SELECT list. ✅ `Machine_Group__c` is **not** a press field: it holds print METHODS (Screen Print 34, Heat Press 13, Embroidery 3), so no duplication. 🚩🚩 **The press→method mapping exists ONLY in the dashboard's JavaScript.** `_priority.js:133` `PRESS_GROUPS` matches **regex against the press's NAME** (`/(heat|hat|shirt)\s*press|transfer/i` and friends) and **no field on Account records which method a press serves** — confirmed by listing Account's 59 custom fields. 📌 **That is why E3.3's misclassification bug was possible at all** (a bare `press` pattern put Press 1 and Press 2 under Heat Press), and it means any org-side feature that needs to know a press's method — starting with filtering the CAM's press choices by the job's method — **has no source of truth to read.** ➡️ **Proposed: a picklist on Account (Screen Print / Heat Press / Embroidery) set on the five press records**, which both enables the filter and gives the dashboard something to read *instead of* pattern-matching names. The flow to change is `Order_and_Order_Items_SubflowDesign`, **active at version 43**, whose Repeater screen already carries the `Print_Location__c` precedent from 2026-08-20 | §4, new story |
| 2026-09-11 | 🔎 **B19 root-cause hunt narrowed in dev2: it is NOT a before-save flow.** `FlowDefinitionView` shows **14 active flows on Order, only 3 before-save** — `Order_Count` fires on **create only** (ruled out), `Order_Hold_Automation` assigns `Hold_Placed_Date__c`/`Hold_Placed_By__c` and **never touches `Print_Date__c`** (ruled out), and the third is before-**delete**. 🔑 **This section's standing hypothesis (a before-save `PRIORVALUE()` flow) is therefore wrong — and an AFTER-save flow fits the same evidence:** it runs inside the same transaction, so the DML still reports `isSuccess()=true` and the re-read afterwards sees the value it put back. Same symptom, other half of the save. **11 after-save flows remain**; `ORDER_Scheduled_Update` and `OrderStatusDateStamps` are the print-date-shaped names. 🚩 Side finding: **`Order_Hold_Automation` is ACTIVE and references two fields that don't exist on Order** (`Hold_Placed_Date__c`, `Hold_Placed_By__c`) — a failed save waiting to happen, or trap 1 hiding them. Untouched, needs its own look. ⛔ Still no production scan — the login needs Anthony's boss | §4 B19 |
| 2026-09-11 | 📊 **B19 SCANNED, and 🔧 the rollup now verifies its own write (B23).** Read-only Apex drift scan (script in §4 B19, safe to run in production during a shift): **dev2 — 22 of the 42 orders with both a print date and runs, 52%, disagree with their own runs** (median ~5 days, max ~13); **staging — 7 of 11, 64%**. ✅ Cross-validated: the Apex and an independent scan through the app's own endpoints agree **exactly** on dev2's 14/8 split. 🔑 **Direction separates the two causes:** E7.7's missing `after delete` can only leave the stored date EARLIER, so the **14 dev2 / 5 staging orders storing a LATER date cannot be the delete gap** — that column is the defensible B19 number. ⛔ **Production not scanned** — this Chrome profile isn't logged in and the extension has no permission for the production domain; that is still the number that sets the priority. 🔧 **B23 shipped** (branch `fix/b19-verify-print-date-write`, `11b457e`, unpushed): the rollup reads the field back after its 204, logs loudly and reports `reverted:true` instead of `changed:true`, and the run endpoints pass a `printDateReverted` flag to the client. No retry, no Apex touched. Negative control: without the read-back, 9 assertions fail and the response is a bare `{ok:true}` | §4 B19, B23, E7.7 |
| 2026-09-11 | 🔴 **B19 measured through the APP, and it is worse than the row said: the dashboard's own print-date rollup is defeated too.** A calendar-style run move on `00013467` returned **200 `{ok:true}`**, the rollup's arithmetic (18:15) differed from the stored value (17:30) so it definitely PATCHed — and the order still read **17:30**. Cache-busted. ❌ **Not FLS:** positive control on `00013493` moved `Print_Date__c` 13:15→14:15 and back through the *same code path*, both stuck. One conditional defect, and the app and the Apex probe agree on which orders. 🔑 **NEW — the replacement value is the field's OWN PRIOR value, not a recomputation.** No formula reproduces the three stored values (00013511 = earliest scheduled, 00013508 = a NON-earliest run's scheduled start, 00013467 = a run that no longer exists); each is a plausible *historical* value. ➡️ hunt a **before-save flow using `PRIORVALUE()`**, not a rival scheduler. ❌ `Proposed_Run__c` ruled out — all four orders have zero. ❌ Six discriminators eliminated (substatus, status, method count, account, receiving status, has-Opportunity). 🔑 **Drift is a fingerprint:** affected orders are exactly those where `Print_Date__c` disagrees with `MIN(Actual||Scheduled)` over their runs — **the full blast radius is measurable org-wide without writing anything.** ⚠️ Dragging a job on the calendar has been silently doing nothing on affected orders, while `Print_Date__c` drives both boards' card order, the Prep Time KPI and the priority score. dev2 left as found | §4 B19, E7.7 |
| 2026-09-11 | ❌ **CORRECTION — the browser-cache trap does NOT invalidate B19, and saying it might was my error.** B19 was measured in **Apex, in the Developer Console, reading back inside the same transaction** as the `Database.update` — no HTTP layer, no proxy, no browser cache in that path. **B19 stands as written: P0, `isSuccess() = true` with the stored value unchanged, 3 of 4 orders.** The cache trap is real and still applies to any *browser-side* verification of a write; it just has no bearing here. 📌 Lesson recorded in place: **check which instrument produced a finding before deciding a new trap undermines it** | §4 B19, §8 surface 3 |
| 2026-09-11 | 🎯 **The git-on-iCloud bus errors have a six-file fix: hydrate `.git/objects/pack/*` FIRST.** Git mmaps every pack `.idx` on almost any object lookup, so **one dataless pack file makes nearly every git command SIGBUS** — `git hash-object -w` on a single working file crashed. Staging the six pack files fixed `add`, `write-tree`, `commit-tree` and `update-ref` immediately. **Six files, not the 688 the 2026-09-09 count implied.** Full working order recorded in §2's eviction subsection, plus two traps it cost time: a dataless `.git/info/exclude` fails with `cannot use … as an exclude file` (reads like config, isn't), and **this mount forbids `unlink`** — so a crashed git leaves an `index.lock` that cannot be removed and blocks every later command; **`mv` it aside**, `rm` will not work. ⚠️ `git status`/`diff`/`ls-tree -r` may still crash afterwards and **that does not mean the commit failed** — verify with `git rev-parse HEAD:<path>` vs `git hash-object <path>` instead | §2 iCloud eviction |
| 2026-09-11 | 🔧 **B22 FIXED — the formula-HTML-into-a-Name-field bug that broke combine.** New `plainText()` + `SF_NAME_MAX = 80` in `_sf.js`; `combine.js` and `split.js` now flatten `GOA_Order_Number__c` and budget their leg names against the field. `Combined w/ 20460-4 - 20461-2` is **29 characters, was 121**; split's leg name is **15, was 61** and no longer carries an anchor tag. Branch `fix/b22-formula-html-in-name`, **unpushed**. Verified by a harness driving the real endpoints against a stubbed Salesforce and asserting on the `Name__c` in the `/composite` body, **with a negative control** that reverts the labels and reproduces the 121-character value. ⚠️ **Not verified against an org — needs a deploy.** On deploy, re-run **3.6** then **3.9**; both have been blocked on this, and 3.6 is the only thing that can finally exercise **E5.10's 12→25 ceiling** | §4 B22, §8 surface 3, E5.10, E7.4 |
| 2026-09-11 | ✅ **E8.4 surface 3 is now 9 of 10 run — 3.2 PASSED and the surface has a verdict.** 3.2: baseline 0 → shipment created → poll fired → `Shipping_Label_Printed__c` = **true** on the record, green "Shipping Label Printed" banner on screen. The shipment was logged through the app's own endpoint rather than the carrier wizard, so **no real label was bought**; the remaining sliver (does Zenkraft's Print write a row the poll sees) is narrowed by **three July-2026 shipment rows this app did not create that the app's `Order__c` query finds**. **Surface 3 tally — PASS: 3.1, 3.2, 3.3, 3.7 (live), 3.8. PARTIAL: 3.4, 3.5. FAIL: 3.6, 3.9. N/A: 3.10.** 🔴 **The one blocker is the `Name__c` HTML bug** — it fails combine outright, dirties split's record names, blocks 3.9's live half, and **travels to every org**. Fix that and 3.6 + 3.9 both become runnable | §8 surface 3, §4 E8.4 |
| 2026-09-11 | 🔴🔴 **The combine `Name__c` bug TRAVELS — confirmed against staging, read-only.** `GOA_Order_Number__c` returns the same 51–53-character HTML anchor in **staging** as in dev2, so the `Name__c` a 2-order combine builds there is **121 characters** too. The defect is in the **formula field's definition, identical in every org** — **combine is broken in staging today and will be broken in production on the day it ships.** Add to **E7.4** as a blocker. 🟡 **3.10 itself is N/A as written:** staging's shipping board is **11 orders**, *smaller* than dev2's — the item's "only meaningful against staging" is false and no org the shop has can reach the ~600-order IN-list ceiling. But the defect is confirmed by construction: `runQuery` sends SOQL as a **GET query string** (`_sf.js:283`), `shipping-orders/index.js:117` builds the list unchunked, it **fails open to 0**, and `_sf.js` **already exports `runChunkedIdQuery` / `SOQL_IN_CHUNK = 200`** that this one call site ignores — a two-line fix. ✅ Proved the half that matters: all 11 staging cards read `ShipmentCount: 0`, **indistinguishable from a rejected query** — separable only via `/api/shipments`, which does not fail open. Re-rate B12's shipping instance to *"the fail-open is the defect, not the bound."* | §8 surface 3, §4 E8.4, B12, E7.4 |
| 2026-09-11 | 🧪 **E8.4 surface 3 run: 7 of 10 items executed against dev2. 🔴 Found a P0 that makes COMBINE non-functional at any size.** `combine.js:194` writes `Name__c = "Combined w/ ${primaryLabel} - ${label}"` from **`GOA_Order_Number__c`, a formula field that returns 53 characters of HTML** — the value is **121 chars** and Salesforce rejects it with `STRING_TOO_LONG` on `leg0`. **Fails at 2 orders as readily as at 13**, so **E5.10's raised 12→25 ceiling has still never been exercised** and 3.6 cannot exercise it until this is fixed. Trap 4 firing on the server, where there is no `api.text()`. `split.js:172` has the same bug at 61 chars — it fits (so `Name__c` is 80) but writes an anchor tag into a record name. **PASS:** 3.1 (wizard URL, dev2 field Id set), 3.3 (no auto-mark on a 3-shipment order), 3.7 live (`Status` → `Complete`), 3.8 (`Complete`, no "d"). **PARTIAL:** 3.4 (a failed poll never reads as success, but the 4-minute timeout says **nothing**), 3.5 (split works; ceiling not crossed — and **both the item's sizing formula and my 2026-09-09 correction of it were wrong**, the tail chunks at `N+G>25` so it needs a **13-line order**, which dev2 does not have). **B15 confirmed but over-rated** — demo mode swaps in demo cards and banners *"do not work from these numbers"*, so no real order is silently dropped; the defect is that Complete is the file's only write that reports nothing, and that **the drawer carries no demo warning**. 🚩🚩 **New trap that may invalidate B19: a read-back through the proxy can be served from browser cache and looks exactly like a reverted write.** **BLOCKED:** 3.9 live (needs a combined shipment), 3.2 (real label — needs Anthony), 3.10 (staging — needs Anthony) | §8 surface 3, §4 E8.4, E5.10, B15, B19 |
| 2026-09-09 | 🧪 **E8.4's checklist run STARTED — and it could not start at all: the dev2 shipping board was empty.** `GET /api/shipping-orders` returned **HTTP 200 `totalSize: 0`** — empty board, not a failed fetch — because **no dev2 order carried `Order_Substatus__c = 'Post-Production'`** (live values were `Completed` ×70, `Ready for Print` ×1, null ×2). 🚩 The "~73 orders on the board" written into 3.10 earlier the same day was **the production board, not this one** — corrected in place. **17 orders PATCHed to Post-Production** to build fixtures; **`00013435` and `00013436` refused with `400 update_failed`, the same shape as B19** and possibly the same root cause. **dev2 has zero combined shipments and no order over 5 lines**, so 3.9's live half needs 3.6 to run first and 3.5 must reach the ceiling by box count, not line count. 🔴 **3.9 FAILED by code read** — no guard in `zk-wizard-url.js`, `orders/[id].js:71` or `shipping.html:183`. ⚠️ **3.7's stated blast radius looks overstated** — `load()` swaps in demo orders on the same failure that sets demo mode, so Complete cannot silently drop a *real* order; the defect is that it is the file's only write path that reports nothing. Run log added to §8 surface 3 | §8 surface 3, §4 E8.4, B15, B19 |
| 2026-09-09 | ⚠️ **E8.4 re-rated P1 → treat as P0, and its checklist expanded from 4 items to 10.** The row claimed to carry **E5.10** while §8 surface 3 **tested neither split nor combine** — E5.10 being the one story whose own entry says its Salesforce-touching paths are untested. Added **3.5–3.10**, each with its false pass: split sized past the 25-subrequest ceiling (**a 20-line order in two boxes is already 26** — ordinary, not large, so a 6-line test proves nothing); combine past twelve orders; **Complete actually reaching Salesforce (B15, confirmed defect — must be tested on a board in DEMO mode, which is the state the defect lives in)**; `Complete` vs `Completed` read off the record (trap 5); Ship Now refused on a combined-shipment secondary (banner ≠ guard, server side unchecked); and the board's unbounded IN list against **staging, not dev2** (B12 — dev2 can never reach the limit). 📌 Every other board was driven hard in a rig this week; this one has not been touched | §4 E8.4, §8 surface 3 |
| 2026-09-09 | ✅ **E4.8 re-verified, and two flags cleared with it** — the 2026-09-03 empty reads were the folder erroring, not missing code. `stats.html`'s Switch Account fix is on `origin/main` (`:688`), re-proven end to end in a browser with a stub that logs requests server-side: identity keys null, `POST /api/worker-logout` actually received, `login.html` asks for a PIN. Also confirmed committed: the `orders.receive` gate on `update-order-receiving` and `results.submit` on `run-results`. 🪤 §2's auth line is stale — `station-login` no longer exists, so there are two deliberately-open mutating routes, not three. No code change | §2, §4 E4.8 |
| 2026-09-09 | 🚩 **`pre-production.html` line endings diverged between `origin/main` (CRLF) and the unpushed stack (LF)** — invisible in a diff, but it turns any cherry-pick across the two into a whole-file conflict, and resolving it the wrong way silently reverts B10 in that file. Found landing B21. Normalise before merging | §4 B21 |
| 2026-09-09 | **Sibling methods inside the method card (B21)** — both drawers already listed the order's methods; what was missing was the count, the "This card" marker and any explanation of why 3 methods can show 2 cards. New shared `methodSiblings()` in `ca-api.js`. 🚩 The proposed source (`rec.ProductionMethods`) could not have worked — the board's query is filtered to board statuses, so it cannot see a Pre-Production or Cancelled sibling; counted off the unfiltered per-order fetch instead. Cancelled excluded from the count, single-method orders show nothing, matched by Id not type (D11). No new query. Branch `feat/b21-sibling-methods`, unpushed. **Not yet verified against dev2** | §4 B21 |
| 2026-09-09 | **The order's garment count on every method and run card (B20)** — mostly an audit: index, pre-production and all three boards' run rows already had it via `pivotItems()` and `runQtyHint()`. 🚩 **Found two disagreeing definitions of the count** — `calendar/index.js` summed every OrderItem while `pivotItems`/`sizeGrid` skip blank-`Size__c` non-garment lines (setup fees, digitising), so a job with a setup fee read higher on the calendar than on the board. One `AND Size__c != null` fixes it. Added the count to `counting.html` (the only board without it) from a new fail-open chunked follow-up, and to the calendar grid blocks. Unknown renders nothing, never 0; no warning on a run/order mismatch, which D11 makes legitimate. Branch `feat/b20-order-qty`, unpushed. **Not yet verified against dev2** | §4 B20 |
| 2026-09-09 | 🔴 **B19 OPENED — `Order.Print_Date__c` writes are silently reverted, and it defeats BOTH rollups.** A plain `Database.update` returns **`isSuccess() = true`** and the field reads back as its **original** value in the same transaction — a committed write, rewritten before commit, with nothing logged because there is no error to log. ⚠️ **Not universal:** a self-restoring probe over the 4 most recently modified orders with a print date found **3 reverted, 1 accepted** (00013467 ✗, **00013493 ✓**, 00013511 ✗, 00013508 ✗) — so it is conditional automation, not a locked field, and 00013493 is the control that makes the condition findable. It is also **not specific to the E7.7 order**. 🚩 **Bigger than E7.7:** `_print-date-rollup.js` writes the same field the same way from every run create/edit/delete, so **the app's own rollup is presumably being overwritten on those orders too, and always has been** — the endpoint gets a 204 and the board re-reads the stale value. **That half is UNVERIFIED and is the first thing to check.** 📌 **E7.7 is reclassified ⛔ BLOCKED on B19**, not "not done" — its code is correct and deployed | §4 B19, §4 E7.7, §7 |
| 2026-09-09 | ⚠️ **CORRECTION to my own write-up an hour old:** the E7.7 diagnosis first said `Print_Date__c` "cannot be written at all". That was measured on **one** order and was too strong; the 4-order probe found one that accepts the write. Corrected in §4 before it could be relied on. 📌 Rule 1 applies to conclusions as much as to statuses — *one* measurement is a measurement of *one thing* | §4 E7.7, §4 B19 |
| 2026-09-09 | ✅ **E7.7 DIAGNOSED — and it is neither the trigger nor `OrderPrintDateRollup`. `Order.Print_Date__c` cannot be written at all.** A plain `Database.update` setting it to 18:15, with no rollup and no trigger involved, returned **`isSuccess() = true`** and read back **17:30** in the same transaction. A rejected write returns false with an error; this one committed and was rewritten by other Order-side automation. **Everything else was ruled out first:** trigger `Active` with `UsageAfterDelete` true (Tooling API); `disabled = false`; the class's computation replicated line-for-line gives `earliest = 18:15` and `differs = true`, so it does reach its DML; no `update failed` in the log; the runs were never touched (`LastModifiedDate` still 08-27). ⚠️ **The monotonic-guard hypothesis was WRONG** — line 104 is a bare `if (o.Print_Date__c != want)` with no direction test. 📌 **The class is correct and its change can stay**; it is inert. ⛔ **Open: WHICH Order automation rewrites the field, and where it gets 17:30 — the deleted run's start — from.** Start with *Where is this used?* on `Print_Date__c`, then the 19 Order-update flows. 🚩 **The app has the same exposure** — `_print-date-rollup.js` writes the same field the same way, so the dashboards' rollup is presumably being overwritten too, and always has been | §4 E7.7 |
| 2026-09-09 | 🔴 **E7.7 EXECUTED IN DEV2 AND IT FAILED — the story is NOT done.** Deleted PR-0033, the earliest of 5 runs on order 00013467 (count confirmed 5 → 4). `Order.Print_Date__c` **did not move**: still `2026-07-31T17:30`, pointing at a deleted run, while the earliest surviving run is 18:15. **Deployment ruled out** — Tooling API read back `Active`, `UsageAfterDelete` **true**, `LengthWithoutComments` **467**, identical to when it was built. **The trigger's delete path ruled out too** — calling `OrderPrintDateRollup.syncOrders()` directly also failed to correct it, though `LastModifiedDate` advanced, so the class ran and wrote without changing the value. The defect is inside the class's recompute, on the path where the right answer is *later* than the stored one. ⛔ **Not diagnosed** — the monotonic-guard hypothesis was NOT confirmed; its test never executed. **Apex and `_print-date-rollup.js` therefore do NOT agree**, which D13 assumes; D13's own decision is unaffected. 🚩 Order 00013467 is left holding the stale date — the defect, reproducible on demand | §4 E7.7 |
| 2026-09-09 | 🪤 **Two Salesforce UI traps found while running that test.** **Delete is not on the Production Run Lightning page layout** — the record page offers only *Submit for Approval*, so the "user deletes a run in the UI" scenario E7.7 guards may not be reachable there at all; it took Execute Anonymous. And **the Developer Console Query Grid's "Delete Row" silently does nothing** — row vanishes, confirm dialog accepted, record still returned by SOQL afterwards, no error anywhere. `delete [SELECT …]` in Execute Anonymous worked first time | §4 E7.7 |
| 2026-09-09 | ✅ **DEV2 PASS, part 1 — three checks run against the live org, two of them long-outstanding.** **B16 PROVEN**, not inferred: dev2 holds 10 designs with a mockup URL, 9 adopted and 1 not, and the hold-out (`freepngimg.com/save/…`) **redirects** to `/download/calendar/7-2-…png`. The proxy was called with it, served the image correctly, and the record was untouched eight seconds later — `LastModifiedDate` still **2026-08-19**, predating D8. Normalization ruled out separately. **B4's summed reprint CONFIRMED** on order 00013504: `rework-check` returns `totalReworkQty: 12`, and one order product carrying 2 on Front and 2 on Back is counted as 4 — placements really are summed — while a line with `incomplete: 150` contributes 0. **B4's blank-placement question ANSWERED, and it is neither predicted outcome**: blank runs get a full 5 rows (so the original defect does not return) but with `Planned_Qty__c` **null, not 0**, via the fallback this file calls dead code | §4 B16, §4 B4 |
| 2026-09-09 | 🪤 **NEW TRAP, and it produced four wrong claims before it was caught: `origin/main` in this clone is a STALE remote-tracking ref.** `.git/FETCH_HEAD` is dated 2026-09-03 and Anthony pushes from the GitHub web UI, which never updates this clone — so `git cat-file -p origin/main:<file>` answers "what did main look like last Thursday", in real bytes, looking exactly like a measurement. On that basis a session reported B10, E2.6 and B9's reporting half as unshipped and **B8 as half-landed and silently invisible**. All four were **live**. Corrected by fetching the deployed assets: `tokens.css` serves `--method-sp`, `index.html` serves 10 `runsInOrder` sites, `/api/production-orders` returns run counts on **90** methods. 📌 §1's *verify against the deployed artifact* rule, defeated by an artifact that looked deployed | §2 |
| 2026-09-09 | ✅ **B11 FIXED — a refused composite no longer reads as a successful submit.** `run-results`' private `composite()` now checks `!resp.ok` alongside the sub-request list, and `console.error`s the status and body (that path logged nothing at all before). Branch `fix/b11-composite-status`, commit `81b67ec`, **unpushed**. **Reproduced before fixing**, against a fake Salesforce driving the real handler: batch refused → was 200 with the run stamped `Submitted`, now 502 with the run left `Draft`; both controls (happy path, single sub-request failure) unchanged. 🪤 **The first harness was a false pass** — it sent `misprint` where `COUNT_FIELDS` wants `misprintQty`, so `/composite` was never called and all three scenarios agreed on nothing; it now asserts the batch call happened. **A green board is not a passing test, harnesses included.** ⛔ dev2 pass still owed | §4 B11, §7 |
| 2026-09-09 | 📌 **Everything from the 2026-09-09 code read now lives in THIS file and nowhere else.** The working notes it was written from have been deleted, per rule 3 — two documents on one subject is the drift this project keeps paying for, and a backup `.md` sitting in the repo is still a second `.md` in the repo. Folded in with the defects: the `.git` eviction measurement and the evicted-ref trap (§2), the `_priority-rollup.js` header trap (§4, beside E5.8), and a **traps-re-verified-clean table** (§4) so the defect list has a denominator | §2, §4, §7, §11 |
| 2026-09-09 | 🔴 **Eight defects logged as B11–B18 from a full read of the API layer and all nine boards.** Two are the same class of bug the project keeps paying for — a failure that reaches the caller looking like success. **B11:** `run-results`' private `composite()` never reads `resp.ok`, so a wholly rejected write returns `{ok:true}` and the run is stamped `Submitted` — manufacturing the one piece of evidence D1's model depends on. **B12:** the production board builds an unbounded `IN` list out of the query its own comment calls unbounded; dev2 is nowhere near it, **staging is ~10x past it**. **B13:** a failed run query makes the calendar report the whole shop unscheduled and offer slots for all of it, at HTTP 200 with a green chip. Then B14 (counting's load-failure banner is unreachable), B15 (shipping's Complete is a phantom write in demo mode), B16 (mockup adoption matches the post-redirect URL, so a redirecting host never adopts), B17 (`_ppi-checklist` reads a failed query as "nothing to do"), B18 (`run-line-items` compares Ids on 18 chars). ⚠️ **All eight are readings of the code; none was reproduced against a live org** — each entry names the check that would settle it | §4 B11–B18, §7 |
| 2026-09-09 | ⚠️ **Six drift corrections — the file had gone stale against its own disk in six places.** §4 marked **B7 as `🔵 P1` planned while stage 1 was built** (three branches, all reachable from `fix/e2.6-run-order`) and §7 still carried a build brief for it — the second completed-story-reads-as-untouched in two days, after the B9 code half. §7's `results.submit` trap was **cleared by E6.5 a week ago** and the warning outlived it in two places. §7's "4 route files call `requireCap` against 24" re-measured to **21 of 23**, and `verifyStationToken` is gone entirely (E6.6). The `README.md`-is-stale rough edge is **itself stale** — none of the strings it names are in the file. 📌 **A correction has to be written down as promptly as a change; five of these six were corrections that were never written back** | §0, §4, §7 |
| 2026-09-09 | ✅ **The "two broken git refs" were never broken — iCloud eviction, not corruption.** `feat/b9-optin-reprint` and `feat/method-colours` hold `b47c233` and `25a2a15`, **both already in `fix/e2.6-run-order`'s history**, so no work was ever at risk. The 41-byte ref *files* were dataless on disk, so git reported `warning: ignoring broken ref`. Hydrating them restored both branches. 🚩 **688 files inside `.git` are currently evicted** — that is the mechanism behind every "git writes are unreliable" note in §2: `git rev-list`, `git merge-base` and `git log <range>` die with **Bus error**. **Zero working-tree source files are evicted**, so reading and editing code is unaffected; only history operations are. 📌 Read `ignoring broken ref` on this mount as *evicted*, not *lost* | §7 open loops, §2 |
| 2026-09-09 | 🚩 **CORRECTION — this file is UNTRACKED, not tracked-but-uncommitted, and that inverts §0 rule 4.** `git log --all -- PRODUCTION-DASHBOARD-INFO.md` returns nothing: it is in no commit on any branch or remote. So **a branch switch will not clobber it** — git leaves untracked files alone — and the twice-destroyed-notes incident belonged to `ROADMAP.md` and `CLAUDE-CODE-QUEUE.md`, which *were* tracked. What it actually means is that 368KB of the only record of this project sits on one iCloud disk with no copy anywhere. **Commit it.** A dated pre-edit backup was left at `_to_delete/PRODUCTION-DASHBOARD-INFO.backup-2026-09-09.md` | §0 rule 4, §4 |
| 2026-09-09 | **E2.6 verified — the run pointer holds on a multi-run method** — three full setup/print cycles driven in a rig with every write asserted server-side, plus out-of-order working, Pause-is-not-Stop, and a mid-run refresh. One real inconsistency found and fixed: the drawer's Production Runs rows rendered in raw endpoint order while the run picker sorted, so the two lists could disagree on runs sharing a scheduled time. Branch `fix/e2.6-run-order`, unpushed. **Not yet verified against dev2** | §4 E2.6, §8 S5 |
| 2026-09-08 | **One colour per print method, everywhere (B10)** — screen print green, embroidery purple, heat press orange, promo teal, as four `tokens.css` variables replacing five copy-pasted palettes. Deliberately NOT `--ok`/`--warn`, which already mean “fine” and “watch this one”. Applied on `index.html`, `pre-production.html`, `counting.html`, `order-sheet.html`, `calendar.html` (tabs only) and `stats.html`; `shipping.html` untouched — its `methodColor` is the delivery method. Also fixed the order sheet's Method chip, which guessed from the press name and defaulted to Screen Print. Branch `feat/method-colours`, unpushed | §4 B10 |
| 2026-09-08 | **B9 code half shipped — the reprint is opt-in** — `createReworkIfNeeded` now consults `Order.Misprint_Outcome__c` before building. Gate lives in `_rework.js`, so **neither call site changed** and neither can bypass it. An org without the audit fields (production) builds automatically exactly as before. Approved reprints are built by a bounded sweep on the Management inbox — no callout, no cron, no Access exception. `rework-check` learned the four new states. Branch `feat/b9-optin-reprint`, unpushed. ⚠️ **Flow entry criteria must change before activation** — see §4 B9 | §4 B9 |
| 2026-09-09 | 📌 **Document closed out for handoff to a new Claude project.** Added **§0 Cold start** (the five standing rules, the one-deployment/three-orgs fact, and an org id reference table); added the **Salesforce-in-browser recipes** to §2 (Dev Console query editor, `FlowDefinitionView` limits, EditArea, the REST 401 dead end, the Order custom-field edit-page wedge, and the *read it back off a fresh load* rule); recorded the **"YOUR FLOW FINISHED"** diagnosis (a rogue `IsSyncing` quote with zero line items, not the flow); corrected a **false §7 entry of my own** that said the B9 code half had not started — it was **built 2026-09-08** on `feat/b9-optin-reprint`, and §7 now records the measured state plus the three things actually blocking B9; and added an explicit **open-loops list** naming what waits on Anthony versus what is carried debt. Contents updated to D13. | §0, §2, §7, §11 |
| 2026-09-09 | ✅ **E7.8 part 1 BUILT in both sandboxes — `CreateCalendarEvent` no longer duplicates the order block.** Check for Matching Records flipped **Disabled -> Enabled**, condition **Related To ID Equals `recordId`**, single match -> update, multiple -> update most recently modified. **dev2 V22 -> V23** (`301ca00000TpfrdAAB`), **staging V35 -> V36** (`301ca00000TpeArAAJ`), both Active and both read back off a fresh load with Save greyed out. Run-level Events (WhatId = `Production_Run__c`) are untouched, so an order keeps one block per run — Anthony confirmed that is wanted. **Part 2 (should the order block yield once runs exist?) remains open, deferred to Anthony after a real week on the calendar.** | §4 E7.8 |
| 2026-09-09 | ✅ **E7.8 investigated — the two calendar writers do not collide.** `OrderScheduling` is a **screen Flow** (Active V22, dev2 `301ca00000TKM8ZAAX`), not Apex; its `CreateCalendarEvent` inserts an `Event` with **WhatId = the ORDER** and matching **disabled**, so re-running it duplicates. `ProductionEventPublisher` writes Events with **WhatId = the RUN** and dedupes via `SELECT ... FROM Event WHERE WhatId IN :runIds`. Different grains — nothing overwrites anything; the overlap is on the calendar view. **Staging data:** 292 Events / 224 distinct WhatIds; only 4 WhatIds have >1, of which exactly **one Order**; **no Production_Run__c (prefix `a3T`) has a duplicate**. Hardcoded `Assigned To ID 0055e000005tFYfAAM` **checked and safe** — resolves to Culture Operations in both sandboxes because sandboxes inherit production User ids | §4 E7.8 |
| 2026-09-09 | ✅ **E7.7 BUILT in dev2 AND staging** — `ProductionRunTriggerHelper.afterDelete(Trigger.old)` -> `OrderPrintDateRollup.syncFromRuns`, and `ProductionRunTrigger` is now `(after insert, after update, after delete)`. Helper edited first so the trigger compiles. Read back via Tooling API in both: Active, **UsageAfterDelete true**, `LengthWithoutComments` 467 in both orgs (identical). ⚠️ **Compiled and active, NOT executed** — no run was deleted to prove it fires; do that in dev2 before trusting it. 🚩 Coverage is 0% on trigger and helper in both orgs (pre-existing) and this adds uncovered lines — **E7.4 needs 75% org-wide** | §4 E7.7 |
| 2026-09-09 | ✅ **D13 decided (Anthony): `Print_Date__c` is never blanked when an order's last run is deleted.** Leaves the field at its last known value, matching `_print-date-rollup.js` and what the Apex already does by construction — both sides now agree deliberately, not by accident. Blanking rejected: `calendar/index.js` windows on `Print_Date__c`, so null would remove the order from the calendar. **E7.7's scope is now just `after delete` + `afterDelete(Trigger.old)`** | §4 E7.7, D13 |
| 2026-09-09 | ⚠️ **E7.7 correction — the "second gap" was my error, there is only one.** Leaving `Print_Date__c` alone when an order's last run is deleted is **deliberate and already matches the app**: `_print-date-rollup.js` documents the same choice in as many words. The Apex does it by construction, so no extra code. Blanking would be actively worse — `calendar/index.js` windows on `Print_Date__c`, so a null date removes the order from the calendar, the very screen used to reschedule it. **E7.7 is therefore just: add `after delete` + `afterDelete(Trigger.old)`** | §4 E7.7 |
| 2026-09-09 | ✅ **E7.7 investigated — premise confirmed in both orgs, plus a second gap the story missed.** `ProductionRunTrigger` is after insert/update only (dev2 and staging identical, all delete/undelete flags false). Fix is small: `OrderPrintDateRollup` already exposes `syncOrders(Set<Id>)` and recomputes from scratch, so `after delete` + `Trigger.old` is the whole change. 🚩 **But deleting an order's LAST run still leaves `Print_Date__c` stale even then** — the final query is scoped to `earliest.keySet()` and the class never sets `Print_Date__c = null`, so an order with zero runs is never revisited. Needs a deliberate decision. Apex, so coverage + deploy, and must travel with E7.4 | §4 E7.7 |
| 2026-09-09 | ✅ **E7.3 — Print Location Global Value Sets built in dev2 AND staging** (dev2 `0Ntca0000001gbV`, staging `0Ntca0000001gd7`; 11 values, entered order preserved, both read back). 🚩 **But the repoint is blocked:** Salesforce has no UI path to convert an existing local picklist to a GVS — the field's Values buttons are New/Reorder/Replace/Printable View/Chart Colors, there is no "Promote to Global Value Set", and a GVS can only be chosen at field creation. The four sandbox fields would have to be recreated, and `Production_Run__c.Print_Location__c` holds data. **The value now sits with E7.4:** create production's two fields from the shared set so copies 5 and 6 never exist. Also noted: a GVS is restricted by definition while both fields are unrestricted today | §4 E7.3 |
| 2026-09-09 | ✅ **E7.3 inventoried — the "four local copies" are now named.** `Print_Location__c` lives on `Production_Run__c` and `Proposed_Run__c`, two per org, ids recorded for dev2 and staging; 2 fields x 2 orgs = 4, production makes 6. All 11 values identical in both orgs (Anthony, 2026-09-09) so **no drift yet — the story is preventive**. No Print Location Global Value Set exists in staging, though 5 other GVSs do. **Must land before E7.4** or production creates copies 5 and 6 | §4 E7.3 |
| 2026-09-09 | ✅ **E5.8 marked fully done.** Branch `chore/e5.8-delete-priority-rollup` and commit `41f2a4c` verified to exist; the story's work is complete and nothing is outstanding but the push. Kept OUT of the "landed on `origin/main`" list because `_priority-rollup.js` is still present at main's tip `79d82ef` (5,261 bytes, confirmed 3x). Merging that branch closes it outright | §4 E5.8 |
| 2026-09-08 | ✅ **B9 email path repointed to the formula field in dev2 AND staging** — Decision inverted to `Opportunity_Owner_Email__c Is Null = True`, Email Alert element deleted, blank case now creates a Task on the order (WhatId `{!$Record.Id}`, owner `{!$Record.OwnerId}`), every populated order takes the Default outcome into the core Send Email. Both saved **Inactive** and read back off fresh loads; new flowIds dev2 `301ca00000To7lgAAB`, staging `301ca00000To95rAAB`. Template + alert now orphaned but harmless | §4 B9 |
| 2026-09-08 | 🩤 **Flow Builder renders a saved merge reference as raw text in multi-value inputs on first load.** dev2's Recipient Addresses came back reading `$Record.Opportunity_Owner_Email__c` with no braces and no pill — it looks like a literal string and is not. Proof: re-picking the same resource left **Save greyed out** (no diff). Use the greyed Save button as the test; do not "fix" what is not broken | §4 B9 |
| 2026-09-08 | 🚩🚩 **Sandbox email scrambling found — and the stale field is the dangerous one.** `Opportunity_Owner_Email__c` is confirmed `Formula: Opportunity.Owner.Email` (read off the field detail page) = the source Anthony asked for. But **2050 of 2163** completed staging orders resolve to a `.invalid` address, because Salesforce scrambles `User.Email` on sandbox refresh. So B9 test sends in staging deliver NOTHING — by design. Meanwhile `Opp_Owner_Email__c` holds **un-scrambled real addresses**, so sending to it from a sandbox would email real staff | §4 B9 |
| 2026-09-08 | 🚩 **Populate check done — B9's primary email branch is dead code.** `Opp_Owner_Email__c`, the Email Alert's recipient, is populated on **0/81** dev2 orders and **101/2164** staging completed orders; the `Opportunity_Owner_Email__c` formula covers **2163/2164**. Every order would take the fallback branch. Recommendation recorded: drop the Decision + Email Alert, send via the formula alone, give the blank case a visible Default. Coverage risk is ~1 in 2,164 | §4 B9 |
| 2026-09-08 | ✅ **Audit trio renamed in dev2 AND staging** — `Reprint_Decision_By/At/Notes__c` → `Misprint_Outcome_By/At/Notes__c`, labels and API names, verified off fresh field-list loads in both orgs. Pre-flight was clean: no Apex, formulas, validation rules or flows — the only references (2 Lightning pages, 4 layouts, 8 report types) bind by field **id** and followed the rename automatically. Field **Descriptions** still cite the deleted `Reprint_Decision__c` | §4 B9 |
| 2026-09-08 | 🚩 **The Order custom-field EDIT page wedges the browser renderer** — 4 times, in Lightning Object Manager AND Classic, and once with no interaction at all: the page loads, reads fine, then never reaches idle and every later call times out. Not the Field Name input, not the Setup iframe. Anthony did the dev2 renames by hand; staging went through afterwards. **If a field edit page hangs, hand it to a human rather than retrying** | §4 B9 |
| 2026-09-08 | ✅ **B9's email half built in dev2 AND staging** — Classic Text template + Email Alert (recipient Email Field -> `Opp_Owner_Email__c`) + a Decision with a fallback that sends to the never-stale `Opportunity_Owner_Email__c` formula. Both flows saved clean and still **INACTIVE**. Two traps recorded: Flow's resource picker shows only labels (use the ⓘ tooltip to tell the colliding fields apart), and a templated Send Email requires a Recipient ID so the fallback had to compose inline | §4 B9 |
| 2026-09-08 | 🚩 **B9's trigger was wrong and both orgs were fixed** — the flow fired on `Status = Complete` (Shipping/Receiving, set when the order ships). The reprint moment is `Order_Substatus__c = Completed` (label "Production Status"), the line that fires `createReworkIfNeeded`. Corrected and read back in dev2 + staging; **both flowIds changed on save** — dev2 `301ca00000TnlZpAAJ`, staging `301ca00000Tnuy2AAB` | §4 B9 |
| 2026-09-08 | ✅ **B9 recipient decided: Email Alert → `Opportunity_Owner__c` (related user)**. Formula confirmed as `Opportunity.Owner.Email` — clean, no HTML, but it bypasses the lookup, so the lookup is an unverified copy. Blank lookup = silent non-send; verify population before activating | §4 B9 |
| 2026-09-08 | 🚩 **B9's email recipient was pointed at a formula field** — `Opportunity_Owner_Email__c` is Formula(Text) and cannot be an Email Alert recipient. The Email-type field is `Opp_Owner_Email__c`; `Opportunity_Owner__c` Lookup(User) is likely the better target. Same-label collision, caught before the email was built | §4 B9 |
| 2026-09-08 | ✅ **B9 record-triggered flow built in dev2 AND staging** — `B9 Order Complete With Damage - Awaiting AM`, V1 **Inactive** in both, verified off fresh loads. Entry: Status = Complete AND Misprint Outcome is blank, only on the transition. Get Records `1 AND (2 OR 3)` via `Order_Id__c`. Stays inactive until the code half stops the auto-reprint | §4 B9 |
| 2026-09-08 | ✅ **`Awaiting AM` guard shipped in both sandboxes** — `Printshop Misprint Process` now treats it as still-blank across all three affected outcomes. dev2 **V29** Active, staging **V16** Active. Production unguarded until E7.4 | §4 B9 |
| 2026-09-08 | 🪤 **Staging V15 saved a condition as AND instead of OR** (unsatisfiable, killed the manager notification for minutes) — caught on read-back, fixed in V16. Rule: read flow edits back off a fresh load of the ACTIVE version | §4 B9 |
| 2026-09-08 | 🚩🚩 **B9 STOPPED at the pre-flight check** — `Misprint_Outcome__c` is watched by the ACTIVE flow `Printshop Misprint Process` (dev2 V28 / staging V14) on `Is Null = False`. Writing `Awaiting AM` would notify the Print Shop, change Order status and post to Slack. Three options recorded; **no flow built** | §4 B9 |
| 2026-09-08 | ✅ **`Order_Id__c` created by Anthony on `Production_Run_Line_Items__c`** in dev2 AND staging — `CASESAFEID(Order_Product__r.OrderId)`, Formula(Text), both read back. Unblocks Flow Get Records by Order | §4 B9 |
| 2026-09-08 | ✅ **B9 collapsed onto `Misprint_Outcome__c`** — `Awaiting AM` added and assigned to all 6 record types in dev2 AND staging; `Reprint_Decision__c` **deleted** in both (recoverable 15 days). By/At/Notes survive as its audit trail, rename still pending | §4 B9 |
| 2026-09-08 | 🪤 **New trap: a custom field can't be deleted while any Lightning page references it** — and the field detail page has no Delete button, the list's `Del` link is swallowed by a JS confirm, and an unchecked confirm box fails silently. **The blocking pages differed per org** (dev2 2, staging 3, no overlap) | §4 B9 |
| 2026-09-08 | 🚩 **`Misprint_Outcome__c` found — it already models the reprint/refund decision** (Feb 2023, values Credit/Refund · Reprint · Refund · Credit). Recommendation: collapse `Reprint_Decision__c` into it before anything depends on either | §4 B9 |
| 2026-09-08 | 🚩 **`Production_Run_Line_Items__c` refuses field creation** (Insufficient Privileges, UI and URL) — blocks `Order_Id__c`, which the B9 flow needs. Contradicts B4's recorded workaround; controlled against Order in the same session | §4 B9 |
| 2026-09-08 | **B9 fields built in dev2 AND staging** — `Reprint_Decision__c` (restricted, no default, blank = resting state) plus By/At/Notes, FLS granted, both orgs verified by reading them back. Still inert: no flow, no email | §4 B9 |
| 2026-09-04 | **B9 paused at the build step** — decisions answered, schema proposed, nothing created in any org. Resume at "PICK UP HERE" in the B9 entry | §4 B9 |
| 2026-09-04 | **B9 / D12 specced** — reprints become opt-in, gated on account-manager confirmation by email. Not buildable yet: the app has no email capability and Account has no Account Manager field | §4 B9, §5 D12 |
| 2026-09-04 | **Runs left to print on the method card (B8)** — bulk per-method count from a separate fail-open query, kept out of the board's own SELECT. Reuses the existing "no Actual End" rule so the badge and the status machine agree. Unknown renders nothing, never "0 left". Branch `feat/b8-runs-left`, unpushed. **Not yet verified against dev2** | §4 B8 |
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

**The `Claude outputs/` folder — folded into this document 2026-09-15, and safe to delete in full.**

25 files from the wave 0c rebuild. ⛔ **Nothing in it was a source of truth**: it was working material
produced during one wave, and every durable fact in it is now in §2, §4 wave 0c or §9.

| File(s) | Now in | Note |
|---|---|---|
| `REBUILD-BRIEF-for-Claude-Code.md` | — | The brief that commissioned the rebuild. 📌 **Substantially wrong** — it claimed `Production_Run__c` had 50 fields and named many that do not exist. The corrections are in §4 wave 0c; the brief itself is not worth keeping. |
| `REBUILD-0-ASSUMPTIONS.md` | §4 wave 0c | Measured-vs-assumed, in full, including every `// ASSUMPTION:` and the metadata corrections. |
| `REBUILD-1…4-*.cls` | **Salesforce** | The four rebuilt classes. ⚠️ **Not reproduced anywhere on disk or in git.** Two orgs hold them; take a Setup → Apex Classes → **Download** before touching them (trap 15). |
| `ProductionAutoSchedulerService.cls`, `ProductionAutoSchedulerServiceTest.cls` | **Salesforce** | The assembled, deployed versions of 4 and 7. Same caveat. |
| `RESTORE-1-snippets.apex` | §4 wave 0c | `scheduleFromMethods` reproduced verbatim. 🪤 Its part 2 (the rollup SOQL loop) must **not** be applied — it duplicates a loop already in the class. |
| `RESTORE-2-…Helper.cls`, `RESTORE-3-…Trigger.trigger` | §4 wave 0c | Both reproduced **verbatim** — they are small, and this was their only written record. |
| `RESTORE-4-…Test.cls`, `1-STRIP-…`, `2-RESTORE-…` | **Salesforce** | Superseded by the deployed test class, which has the sixth method. |
| `TEST-ADD-testConfirmPublishesEvent.cls` | §4 wave 0c + Salesforce | What it asserts and why, and the 20.5% → 89.3% result. |
| `STEP6-0-READ-ME-FIRST.md`, `STEP6-1…4-*-EMPTIED.cls` | §2 trap 15 | The stub-then-rename procedure, generalised into the reusable sequence. The stub files themselves are spent. |
| `STEP8-RESTORE-ORDER.md`, `STEP8-RESTORE-ORDER-v2.md` | §2 trap 15, §4 wave 0c | 🪤 v1's step 6 was **actively wrong** and v2 withdrew it; that trap is recorded in §4 so nobody reinstates it. |
| `BFF-0c-CHANGE-LIST.md` | §4 wave 0c + **git** | All 21 edits, both guard lines and the verification table. The change itself is committed. |
| `dev2-proposal-runs-2026-09-15.csv` | §4 wave 0c | 🚩 **Reproduced IN FULL.** The 11 rows are the only surviving output of the original scheduler and the rebuilt one overwrites them. There is no other copy. |
| `dev2-run-events-2026-09-15.csv` | §4 wave 0c (summarised) | 79 rows. Its load-bearing content — subject format, the single owner id, the window distribution — is recorded; the SOQL to re-export it is there too. |

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
