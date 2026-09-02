# E8.1 · Integration validation checklist

**Written 2026-09-02.** Run this in full against an environment before trusting it. Companion to
`VALIDATION-SCENARIOS.md` (E8.2): this file checks that each *seam* works; that one walks a real
order through the whole system.

Read `CLAUDE.md` first. Several checks below exist because a trap in it has already fired.

## How to run it

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

## The surfaces

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

## 1 · Salesforce auth and query layer

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

## 2 · Org switching

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

## 3 · Zenkraft shipping

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

## 4 · Shop calendar Event publishing

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

## 5 · Auto-scheduler coexistence

`ProductionAutoSchedulerService` silently overwrites `Scheduled_Start__c` / `Scheduled_End__c` on
any run it considers unpinned, in fixed 9-hour blocks ordered by `Priority_Score__c`.

- [ ] **5.1 — A typed time survives.** Create a run with a hand-typed slot. *Expected: after the
      scheduler runs, `Scheduled_Start__c` and `Scheduled_End__c` are **exactly as typed**.*
      Evidenced once on PR-0085; E8.3 finishes this.
- [ ] **5.2 — A `Proposal` run is still moved**, as intended.
- [ ] **5.3 — Press occupancy counts `Planned` runs**, so the scheduler does not double-book a press.

## 6 · Line-item skeleton Flow

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

## 7 · Mockup delivery

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

## 8 · Access and identity

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

## Appendix · Stored values, verified

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
