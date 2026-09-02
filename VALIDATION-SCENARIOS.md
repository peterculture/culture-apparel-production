# E8.2 · End-to-end scenarios

**Written 2026-09-02.** Eight scripted walks through the system with real test orders. Run against
staging before any promotion; re-run against production after. **These are the pre-deploy regression
pass** — when something breaks later, this is the file that catches it.

Companion to `VALIDATION-INTEGRATIONS.md` (E8.1), which checks each seam in isolation. This one
proves they work *together*, which is where this system has actually failed.

## How to run it

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

## S1 · Single-method order, straight through

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

## S2 · Front and back — two placements, one method

Proves placements are multi-select on the method and single-select on the run.

1. One method, `Placements__c` = Front **and** Back. Schedule a run for each placement.

**Expected:** `Production_Method__c.Placements__c` holds a `;`-joined multi-select; each
`Production_Run__c.Print_Location__c` holds **one** value drawn from that set. Both appear on the
order sheet.

> ⚠️ **False pass:** the order sheet printing a Method chip that says *Heat Press* for a screen-print
> press. `methodOf()` used to match a bare `press`, so `Press 1`, `Press 2`, `10 Head Press` and
> `6 Head Press` were all classified Heat Press — and that is what printed for the floor. Fixed in
> E3.3; **check the chip against the press name every time**, because this one reaches the shop.

## S3 · Multi-method order

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

## S4 · Multiple pre-production tasks

1. An order with several `Pre_Production_Item__c` rows. Work them at the station, including a
   **partial** check-in with missing items recorded.

**Expected:** `Partial_Check_in_Missing_Items__c` holds the note (max 255 chars, `Text Area(255)`).
The note survives taps through **all four** statuses.

> ⚠️ **False pass:** expecting a status change to clear the note. **Nothing auto-clears it** — the
> presence of the `missing` key is the only write gate, and status decides nothing. That is a
> product decision (D2), not an oversight. Do not "fix" it without asking.

## S5 · Multiple runs on one method

1. One method, three runs across different days. Allocate sizes differently on each.

**Expected:** each run's `Total_Planned_Qty__c` equals the SUM of its own line items. Across runs,
allocations do not double-count: the Flow computes each size as *order qty − what earlier runs on
the method already planned − `Incomplete_Qty__c`*. Clearing a size writes **0**, never deletes.

> ⚠️ **False pass:** the "which cycle am I on" pointer is **derived from run actuals, not stored** —
> elegant, and untested against a real three-run method (E2.6). Check it explicitly on run 2 and 3.
>
> ⚠️ Also: if the app ever empties a run of rows, the skeleton Flow regenerates the whole thing from
> its own arithmetic on the next save, **silently overwriting a manager's edit**.

## S6 · Misprint and reprint — the loop, all the way round

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

## S7 · Split and combined shipment

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

## S8 · Full lifecycle

One order, intake to shipped, touching every board: `pre-production` → `index` → `station` →
`counting` → `shipping` → `order-sheet`.

**Expected:** the order's `Order_Substatus__c` walks `Pre-Production` → `Ready for Print` →
**`Production`** (stored value; shown as "In Production") → `Post-Production` → `Completed`, and
each board reflects the same state at the same time.

> ⚠️ **False pass:** any board showing a stale stage. Boards poll every 15–20s; `CAApi.shouldPoll`
> gates it, and a demo board retries every 5th tick. If two boards disagree, one of them is on demo
> data — check the network tab.

---

## What this file does not cover

- **E8.3** — auto-scheduler coexistence, in `VALIDATION-INTEGRATIONS.md` §5 and its own story.
- **E8.4** — Zenkraft depth, §3 there.
- **Tablets, touch, lighting and connectivity** — E9.1–E9.4, which need real hardware on the floor.
- **Load.** Nothing here runs for eight hours; that is E9.6, and memory growth, timer drift and
  session expiry only surface there.

## Entry criteria for the pilot (E9.8)

Every P0 closed, **S1–S8 passing on the target org**, and the rollback path — the org switch *back*
— exercised at least once. Not "mostly passing". The reprint loop in S6 is the one that matters
most, because it is the only path that creates records on its own.
