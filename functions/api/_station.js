/**
 * Station CONFIG for the shop-worker dashboard: what each station is, which
 * Pre_Production_Item__c type it handles, which sub-status field it writes, and
 * what its schedule query selects. Imported by station-items,
 * update-item-status, update-order-receiving, pre-production-items and
 * _ppi-checklist.
 *
 * THE STATION LOGIN WAS REMOVED HERE (E6.6, 2026-09-01), and it is worth
 * knowing what used to be in this file, because it read like protection.
 *
 * There was a complete per-station auth system: POST a station PIN to
 * /api/station-login, get back an HMAC-signed token in an HttpOnly cookie with
 * a 12-hour TTL, and every station endpoint would verify it and resolve which
 * station the caller was. Signing, verifying, constant-time compare, cookie
 * issue and clear -- all written, all correct.
 *
 * None of it was ever plugged in. verifyStationToken() had ZERO callers, no
 * page ever called CAApi.stationLogin(), and no station endpoint checked
 * anything. Anyone reading this file reasonably concluded the stations were
 * locked down. They were not, and a security mechanism that is switched off is
 * worse than one that was never written, because people trust it.
 *
 * WHAT PROTECTS THESE ENDPOINTS INSTEAD. Personal PINs: station.html signs in
 * through POST /api/worker-login like every other board, and since E6.5 the
 * station writes call requireCap() -- items.status for sub-status,
 * orders.receive for garment count-in, inventory.edit for stock. That answers
 * "may this person write?", which is the question that was actually worth
 * asking. Cloudflare Access answers "may this device reach us at all?" and is
 * E6.4's job -- as of 2026-09-01 it is NOT yet enabled on this project.
 *
 * The station PIN would only ever have answered a third question -- "is this
 * the ink tablet?" -- and that guards against tapping the wrong tab, which is a
 * mistake rather than a risk. Decision: Anthony, 2026-09-01. If a worker ever
 * needs to be pinned to one station for a whole shift, that is a real
 * requirement and this is the file it would come back to.
 */

/**
 * Constant-time string compare (avoids leaking via early mismatch).
 *
 * The one survivor of the removed token code, and it is not dead: admin/sf-env.js
 * imports it to check SF_ENV_SWITCH_PIN. That PIN is a REAL gate today -- unlike
 * requireCap, which is report-only until ACCESS_ENFORCE=1 -- so this comparison
 * is the thing standing between a guessed PIN and switching which Salesforce org
 * the whole shop is pointed at. Leave it constant-time.
 */
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * PER-STATION CONFIG
 *
 * Only INK is filled in -- every field below was verified in Object Manager
 * or the Dev Console (2026-07-07), not guessed. Screen / Garment / Film each
 * need the same treatment before they're added: their own field names verified,
 * AND the station->Type__c mapping settled (the named stations are Ink / Screen
 * / Garment / Film, but Type__c is Ink / Screen / Thread / Digitization /
 * Transfer -- those don't line up one-to-one).
 * ------------------------------------------------------------------ */
export const STATION_CONFIG = {
  ink: {
    type: "Ink", // Pre_Production_Item__c.Type__c value
    subStatusField: "Ink_Sub_Status__c",
    statusViaFlow: false, // no SF flow — the endpoint derives + writes Status__c

    // Fields the schedule SELECTs. Order details come up the verified two-hop
    // path: Production_Method__r (lookup) -> Order__r (master-detail, STANDARD
    // Order -- the same 801... records the dashboard renders).
    selectFields: [
      "Id",
      "Pantone_Color__c",
      "Ink_Sub_Status__c",
      "Status__c",
      "Notes__c",
      "Production_Method__r.Order__r.Id",
      "Production_Method__r.Order__r.GOA_Order_Number__c",
      "Production_Method__r.Order__r.Customer_Order_Name__c",
      "Production_Method__r.Order__r.Name",
      "Production_Method__r.Order__r.Print_Date__c",
      "Production_Method__r.Order__r.OpportunityId", // <-- for the Design__c mockup lookup
      "Production_Method__r.Placement__c", // <-- which decoration location this ink job is for
    ],
    orderBy: "Production_Method__r.Order__r.Print_Date__c NULLS LAST, Production_Method__r.Order__r.Name",

    // The steps a worker taps through. A blank Ink_Sub_Status__c is treated as
    // the start (== "Needs Label") -- several live rows have it empty.
    //
    // ── 2026-08-14: ink flow went from four stages to three ──
    // Ink_Sub_Status__c's active values were changed in BOTH sandboxes
    // (staging + dev2, verified in Setup) to:
    //     Needs Label | Needs Mixing | Mixed
    // Label AND API name match on all three, so unlike Order_Substatus__c
    // ("In Production" stores as "Production") and Shipping_Delivery__c
    // ("Local Dropoff" stores as "Delivery"), what a worker reads on the
    // tablet is exactly what this file writes. No alias table needed here --
    // do not add one.
    //
    // The old set was: Not Started | Pantone Label Printed | Mixing | Mixed.
    // "Pantone Label Printed" and "Mixing" collapsed into the single
    // "Needs Mixing" stage; "Mixing" was migrated via Salesforce's picklist
    // Replace and then DEACTIVATED (not deleted), so it still exists as an
    // inactive value. See LEGACY_SUBSTATUS below for why that matters on read.
    subStatusFlow: ["Needs Label", "Needs Mixing", "Mixed"],

    // sub-status -> Status__c roll-up. No Salesforce flow maintains Status__c
    // (confirmed 2026-07-07), so the write derives it. This mapping is the
    // one specified with the 2026-08-14 rename: Needs Label => Not Started,
    // Needs Mixing => In Progress, Mixed => Ready.
    statusMap: {
      "Needs Label": "Not Started",
      "Needs Mixing": "In Progress",
      "Mixed": "Ready",
    },

    // Terminal Status__c; the schedule excludes items at this value.
    doneStatus: "Ready",

    // AUTO ROLL-UP: when all Ink items on an order reach "Mixed", the Order's
    // Mix_Inks__c checkbox is set true automatically (same pattern as Transfer).
    orderRollup: [
      { field: "Mix_Inks__c", atOrAfter: "Mixed" },
    ],
  },

  // ── SCREEN STATION ("The Blue Lagoon") ──
  // Field names + sub-status values come from the existing worker board
  // (PP_SCREEN_SUB, Screen_Sub_Status__c, Mesh_Count__c in pre-production.html), so
  // they're verified-by-existing-use. TWO THINGS STILL NEED YOUR SIGN-OFF
  // before workers use this (same care as ink):
  //   1. the sub-status ORDER below (taken from the pre-production.html dropdown order)
  //   2. the statusMap roll-up (inferred from the names, NOT yet seen in data)
  // Run the GROUP BY probe from chat to confirm 2 against live records.
  screen: {
    type: "Screen",
    subStatusField: "Screen_Sub_Status__c",
    // Was `true` (assuming a Salesforce flow rolled up Status__c from the
    // sub-status). That assumption was never actually confirmed live, and in
    // practice Status__c was going stale on this path -- screens would sit on
    // the station board forever even after reaching "Ready for Print", since
    // the board's query filters on Status__c, not the sub-status. The app now
    // owns this roll-up directly (statusMap below), same as ink, so it can't
    // depend on a flow that may not exist.
    statusViaFlow: false,

    selectFields: [
      "Id",
      "Mesh_Count__c",
      "Screen_Sub_Status__c",
      "Status__c",
      "Notes__c",
      "Production_Method__r.Order__r.Id",
      "Production_Method__r.Order__r.GOA_Order_Number__c",
      "Production_Method__r.Order__r.Customer_Order_Name__c",
      "Production_Method__r.Order__r.Name",
      "Production_Method__r.Order__r.Print_Date__c",
      "Production_Method__r.Order__r.OpportunityId", // <-- for the Design__c mockup lookup
      "Production_Method__r.Placement__c", // <-- which decoration location this screen is for
    ],
    orderBy: "Production_Method__r.Order__r.Print_Date__c NULLS LAST, Production_Method__r.Order__r.Name",

    // Screen-making flow starts at Needs Emulsion; "Not Clean" (cleaning) is a
    // separate process handled elsewhere, so it's out of this pipeline. A blank
    // Screen_Sub_Status__c is treated as the start (Needs Emulsion).
    subStatusFlow: ["Needs Emulsion", "Ready for Exposure", "Needs Tape", "Ready for Print"],

    // Roll-up the app writes itself (statusViaFlow: false, see above): Needs
    // Emulsion => Not Started, the two middle stages => In Progress, Ready for
    // Print => Ready (drops the screen off the board). Updated 2026-07-07.
    statusMap: {
      "Needs Emulsion": "Not Started",
      "Ready for Exposure": "In Progress",
      "Needs Tape": "In Progress",
      "Ready for Print": "Ready",
    },

    doneStatus: "Ready",

    // AUTO ROLL-UP: when all Screen items on an order reach "Ready for Print",
    // the Order's Screens_Completed__c checkbox is set true automatically.
    orderRollup: [
      { field: "Screens_Completed__c", atOrAfter: "Ready for Print" },
    ],
  },

  // ── TRANSFER STATION (heat-press transfers) ──
  // Field names + sub-status values come from the existing worker board
  // (PP_TRANSFER_SUB, Transfers_Sub_Status__c, Transfer_Type__c in pre-production.html),
  // so they're verified-by-existing-use. STILL NEEDS YOUR SIGN-OFF (same as ink
  // and screen did):
  //   1. the sub-status ORDER below
  //   2. the statusMap roll-up (inferred from the names, not yet seen in data)
  //   3. whether a Salesforce flow owns Status__c for transfers -> set
  //      statusViaFlow accordingly (see below).
  transfer: {
    type: "Transfer",
    subStatusField: "Transfers_Sub_Status__c",

    // Was `true` (assumed a Salesforce flow rolled up Status__c from the
    // sub-status). Same problem as screen: unconfirmed live, and Status__c
    // could go stale. The app now derives + writes it directly, every time,
    // regardless of which board made the edit.
    statusViaFlow: false,

    selectFields: [
      "Id",
      "Transfer_Type__c",
      "Transfers_Sub_Status__c",
      "Status__c",
      "Notes__c",
      "Production_Method__r.Order__r.Id",
      "Production_Method__r.Order__r.GOA_Order_Number__c",
      "Production_Method__r.Order__r.Customer_Order_Name__c",
      "Production_Method__r.Order__r.Name",
      "Production_Method__r.Order__r.Print_Date__c",
      "Production_Method__r.Placement__c", // <-- which decoration location this transfer is for
    ],
    orderBy: "Production_Method__r.Order__r.Print_Date__c NULLS LAST, Production_Method__r.Order__r.Name",

    // Pipeline order confirmed 2026-07-07. Blank Transfers_Sub_Status__c is
    // treated as the start (Not Received).
    subStatusFlow: ["Not Received", "Transfers Received", "Transfers Cut/Ready"],

    // Roll-up CONFIRMED 2026-07-07; the app writes it directly (statusViaFlow:
    // false, see above): Not Received => Not Started, Transfers Received =>
    // In Progress, Transfers Cut/Ready => Ready (drops off the board).
    statusMap: {
      "Not Received": "Not Started",
      "Transfers Received": "In Progress",
      "Transfers Cut/Ready": "Ready",
    },

    doneStatus: "Ready",

    // ROLL-UP TO THE STANDARD ORDER: after a transfer item's sub-status changes,
    // the endpoint recomputes these Order checkboxes (the ones the MAIN dashboard
    // heat-press checklist shows). Each is true iff EVERY transfer item on that
    // order has reached the given stage or later; recomputed both ways, so a
    // "Transfer Error" reset unchecks it again. Fields verified via pre-production.html.
    orderRollup: [
      { field: "Transfers_Received__c", atOrAfter: "Transfers Received" },
      { field: "Transfers_Ready__c",    atOrAfter: "Transfers Cut/Ready" },
    ],
  },

  // ── GARMENT COUNT-IN STATION ──
  // Different from the other three: NO pre-prod item and NO production method.
  // It works off the standard Order directly — the board reuses /api/orders and
  // the write goes to /api/update-order-receiving (which targets the Order).
  // `source: "order"` tells the client to use that path. This config is what
  // the receiving-write endpoint validates against. (It also used to be what
  // /api/station-login checked, so the garment PIN was accepted -- that
  // endpoint is gone as of E6.6; see this file's header.)
  garment: {
    source: "order",
    field: "Receiving_Status__c",
    // Allowed picklist values (same set the main dashboard uses). Garment is
    // NOT a strict pipeline -- unlike ink/screen/transfer, the client lets a
    // worker jump directly to any of these four (e.g. undo "Staged" back to
    // "Partial" without stepping through every stage in between).
    statuses: ["Not Received", "Partial", "Counted In", "Staged"],
    doneStatus: "Staged", // board hides orders at this value
    /* Free-text "missing count-in" note -- what was short in the delivery.
       missingAtStage is a UI hint ONLY as of 2026-08-28: it tells station.html
       which stage should offer the input box. It does NOT gate the write, and
       the note is no longer cleared when an order leaves that stage -- see
       update-order-receiving/index.js. */
    missingField: "Partial_Check_in_Missing_Items__c",
    missingAtStage: "Partial",
  },
};

/**
 * Given a sub-status FIELD NAME (e.g. "Screen_Sub_Status__c") and the value
 * just written to it, returns the Status__c value that field's owning station
 * config says it should roll up to -- or null if the field/value isn't part
 * of a tracked pipeline (e.g. Screen's "Not Clean", which sits outside this
 * flow). A blank/undefined value is treated as that pipeline's first stage,
 * same convention used everywhere else in this file.
 *
 * Single source of truth for the sub-status -> Status__c roll-up, used by
 * BOTH write paths that can set one of these fields: the station-tablet
 * endpoint (update-item-status) and the pre-production worker/management
 * board's item editor (pre-production-items/[id].js). Before this existed,
 * only the tablet path derived Status__c (and only for ink) -- editing a
 * screen/ink/transfer item's sub-status from the pre-production board left
 * Status__c stale, which then broke anything keyed off Status__c (the
 * station board's "still open" filter, the order-level checklist rollup).
 */
export function statusForSubStatus(subStatusField, value) {
  for (const key of Object.keys(STATION_CONFIG)) {
    const cfg = STATION_CONFIG[key];
    if (cfg.subStatusField !== subStatusField || !cfg.statusMap) continue;
    const v = normalizeSubStatus(subStatusField, value) || (cfg.subStatusFlow && cfg.subStatusFlow[0]);
    return cfg.statusMap[v] || null;
  }
  return null;
}

/* ── legacy sub-status values, READ side only (2026-08-14) ──
 * The ink rename above collapsed four values into three. Salesforce migrates
 * records when a picklist value's API name changes, and "Mixing" rows were
 * moved with a Replace job before that value was deactivated -- so in theory
 * no Pre_Production_Item__c still holds an old value.
 *
 * "In theory" is doing real work in that sentence. A row could have been
 * written between the Replace job queueing and the rename, restored from a
 * backup, or created by something outside this app. If one is, the station
 * board would match it against no stage at all and render a card sitting at
 * a status the worker can't see or act on -- a silently stuck job.
 *
 * So: map the old values onto their new equivalents when READING. This is
 * deliberately NOT symmetric. Writes still validate against subStatusFlow
 * (see update-item-status), so the old values can never be written back --
 * they're inactive on a restricted picklist and Salesforce would reject them
 * anyway. This only stops a stale row from disappearing from the board.
 *
 * Safe to delete once you've confirmed no ink item holds an old value. */
export const LEGACY_SUBSTATUS = {
  Ink_Sub_Status__c: {
    "Not Started": "Needs Label",
    "Pantone Label Printed": "Needs Mixing",
    "Mixing": "Needs Mixing",
  },
};

/** Old sub-status value -> current one. Returns `value` unchanged if it isn't legacy. */
export function normalizeSubStatus(subStatusField, value) {
  const map = LEGACY_SUBSTATUS[subStatusField];
  if (map && value && Object.prototype.hasOwnProperty.call(map, value)) return map[value];
  return value;
}
