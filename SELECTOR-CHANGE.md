# Adding the `Planned` state — two small changes in Salesforce

Do these two **before** deploying the JavaScript, or newly created runs will
carry a status Salesforce rejects and every save will fail.

---

## 1. Add the picklist value (2 minutes)

`Setup → Object Manager → Production Run → Fields & Relationships → Auto Scheduling Status → Values → New`

Add exactly one value: **`Planned`**

Leave it unchecked as a default. Don't reorder or touch the existing values.

*(This is the object you kept getting "Insufficient Privileges" on — that was
the old Setup URL, not a permission. Lightning Object Manager opens it fine.)*

---

## 2. `ProductionAutoSchedulerSelector` — two lines

Setup → Apex Classes → **ProductionAutoSchedulerSelector** → Edit. It's a
44-line class; both queries are in it.

### `getSchedulableByPress` — line 15

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

### `getConfirmedByPress` — line 25

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

## What this buys

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

## How to tell it worked

1. Create a run from the dashboard with a specific time. Reload — **the time
   should still be what you typed** (Planned pinned it), and **nothing appears
   on the Event calendar**.
2. Hit Confirm. The event appears.
3. Hit Unconfirm. The event disappears, and the time still doesn't move.

Step 1 is the one to watch. Before today's change the time stuck but the job
went public immediately; before July it went public *and* the time got
overwritten. Both halves have to hold at once.
