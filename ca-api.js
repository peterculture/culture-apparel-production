/**
 * ca-api.js — Culture Apparel same-origin API client for the Cloudflare
 * Pages Functions proxy (functions/api/*).
 *
 * Loaded as a CLASSIC script (not an ES module) so it can be inlined straight
 * into each page and exposed as window.CAApi — no runtime import(), no separate
 * file to deploy, no module-resolution surprises. All calls are same-origin
 * (no CORS); the Pages Function owns Salesforce auth.
 *
 * Field/route names verified against functions/api/*. When a page can't reach
 * the API it falls back to its built-in demo data (each board's load() catches
 * the throw and flips the badge to "Demo data").
 */
(function () {
  /* ── worker roster: single source of truth ──
     Previously this array was copy-pasted into login.html, index.html,
     pre-production.html, and station.html separately, so adding/removing a
     worker meant editing four files and hoping they stayed in sync (this is
     exactly how "Beau" lingered / "Alex" had to be added by hand everywhere).
     Every page (including login.html, which now loads ca-api.js purely for
     this) reads window.CAApi.VALID_NAMES via a one-line local const that
     just points at this array, instead of keeping its own literal copy.
     Change the roster ONCE, here, and it takes effect everywhere. */
  var VALID_NAMES = ['Anthony', 'Asher', 'Alex', 'Parker', 'Titus', 'Gian', 'Isaac', 'Bronson', 'Zach', 'Logan', 'Avery', 'Jeff'];

  /* ── identity (shared with the originals via localStorage) ── */
  var ROLE_KEY = 'caShopRole';
  var NAME_KEY = 'caShopWorkerName';
  function role(){ try { return localStorage.getItem(ROLE_KEY) || ''; } catch (_) { return ''; } }
  function workerName(){ try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; } }
  function setRole(r){ try { localStorage.setItem(ROLE_KEY, r); } catch (_) {} }
  function setWorkerName(n){ try { localStorage.setItem(NAME_KEY, (n || '').slice(0, 80)); } catch (_) {} }

  /* ── one identity across all five boards (2026-08-14) ──
     station.html and shipping.html have always stored the signed-in worker
     under their OWN key, STATION_NAME_KEY, while login.html/index.html/
     pre-production.html used NAME_KEY. Same person, same tablet, same PIN --
     two unrelated localStorage entries. The visible symptom was that signing
     in anywhere in one group and then opening a board from the other group
     re-prompted for a PIN that had just been entered, most obviously when
     tapping "Station Board" in the sidebar right after logging in.

     anyWorkerName() is the read side: whichever key is populated wins, with
     NAME_KEY preferred since login.html writes it. setIdentity() is the
     write side: every successful PIN verification now writes BOTH name keys
     plus the shared role, so the next board -- in either group -- already
     knows who is here.

     This deliberately does NOT weaken any gate. A PIN is still required to
     ESTABLISH an identity (login.html, or any board's switch-account pad)
     and still required to CHANGE one. All that changed is that an identity
     already verified by one of those gates now counts on every board instead
     of only on the half of the app that happened to write that key. Switch
     Account still clears identity and re-prompts; logout() still clears both
     keys (it already knew about both -- see below). */
  var STATION_NAME_KEY = 'caStationWorkerName';
  function anyWorkerName(){
    try { return localStorage.getItem(NAME_KEY) || localStorage.getItem(STATION_NAME_KEY) || ''; } catch (_) { return ''; }
  }
  function setIdentity(n, r){
    var nm = (n || '').slice(0, 80);
    try {
      localStorage.setItem(NAME_KEY, nm);
      localStorage.setItem(STATION_NAME_KEY, nm);
      if (r) localStorage.setItem(ROLE_KEY, r);
    } catch (_) {}
  }
  /* Clears the signed-in worker from BOTH name keys AND the role -- what
     "Switch Account" wants on every board. Two reasons the role has to go:
     (1) clearing only one name key left the other populated and
     anyWorkerName() would instantly re-admit the person just switched away
     from; (2) leaving ROLE_KEY set meant a tablet with NO signed-in worker
     still satisfied the role-only isAdmin()/canAccessManagement() checks, so
     the env switcher and Pre-Production Management stayed reachable behind
     the gate. Role is re-established by the next setIdentity(). */
  function clearIdentity(){
    try { localStorage.removeItem(NAME_KEY); localStorage.removeItem(STATION_NAME_KEY); localStorage.removeItem(ROLE_KEY); } catch (_) {}
    endServerSession();
  }
  /* Drops the server's signed session cookie too (2026-08-18). Clearing
     localStorage alone is no longer enough: the server now holds its own
     identity, and a cookie that outlives the person who earned it hands the
     next person to pick up the tablet their capabilities on every API call --
     invisibly, because the UI would show the new person as themselves.
     Fire-and-forget on purpose: switching user must never hang or fail on a
     network hiccup, and the cookie expires on its own regardless. */
  function endServerSession(){
    try { fetch('/api/worker-logout', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(function(){}); } catch (_) {}
  }

  /* ── refresh returns you to the view you were on (2026-08-14) ──
     Every board keeps its "which view am I looking at" state (station.html's
     selected station and tab, shipping.html's filter tab, pre-production's
     board-vs-Management) in component state only. A refresh rebuilt that
     state from its hardcoded default, so reloading the Ink station landed on
     Ink only by coincidence -- reloading the Transfer station also landed on
     Ink, and reloading the Management view dropped back to the board. From
     the floor that reads as "refresh sends me to a random dashboard."

     These two helpers move that state into the query string. replaceState is
     used rather than pushState on purpose: switching stations is not a
     navigation, and pushing history would turn the tablet's Back button into
     a station-by-station undo of the whole shift.

     readParam validates against an allow-list and falls back to the same
     default the page used before, so a hand-edited or stale URL can never
     put a board into a state it has no rendering path for. */
  function readParam(key, allowed, fallback){
    try {
      var v = new URLSearchParams(window.location.search).get(key);
      if (v && (!allowed || allowed.indexOf(v) !== -1)) return v;
    } catch (_) {}
    return fallback;
  }
  function writeParams(patch){
    try {
      var url = new URL(window.location.href);
      Object.keys(patch).forEach(function (k) {
        var v = patch[k];
        if (v == null || v === '') url.searchParams.delete(k);
        else url.searchParams.set(k, v);
      });
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    } catch (_) {}
  }
  // Clears both this shared identity (used by index.html/pre-production.html)
  // AND station.html/shipping.html's separate 'caStationWorkerName' key --
  // those two pages never adopted ROLE_KEY/NAME_KEY (see their own header
  // comments), so a real "log everyone off this tablet" action has to know
  // about both systems to actually work regardless of which board you're on.
  function logout(){ try { localStorage.removeItem(ROLE_KEY); localStorage.removeItem(NAME_KEY); localStorage.removeItem('caStationWorkerName'); } catch (_) {} endServerSession(); }
  /* ── manager-only action gate ──
     role() reflects whichever PIN was entered at login.html and is easy to
     go stale on a shared tablet: tapping "Switch user" (the repeat icon on
     index.html/pre-production.html) only changes the attributed NAME, not
     the stored role -- so if a manager unlocks a tablet once, every worker
     who "switches user" after them is still, silently, holding manager
     role. Actions gated behind role therefore re-check the PIN live instead
     of trusting the stored role, so a stale session can't carry manager
     privileges to whoever picks up the tablet next.

     MANAGER_PIN below is a leftover from before 2026-08-13: login.html
     itself no longer uses a shared PIN (see functions/api/_worker-auth.js --
     it now checks one real, personal PIN per person server-side), but this
     confirmManager() live re-check is a SEPARATE feature -- a manager typing
     a PIN into a plain window.prompt() to re-confirm mid-session on a shared
     tablet -- and it wasn't part of that change, so it's still comparing
     against this one shared, hardcoded value. Manager status is scoped to a
     specific named roster (MANAGER_NAMES) on top of that: only the person
     currently attributed as Gian, Anthony, or Parker can hold or re-confirm
     manager, regardless of what PIN was typed here.
     NOT real security (same caveat as the rest of this file's PIN model --
     it's a plain string compared in the browser, and unlike login.html's own
     PIN it's still shared/hardcoded, not personal). Cloudflare Access is the
     actual perimeter; this is just making the existing worker/manager
     distinction mean something in the UI. Worth moving onto real per-person
     PINs too if that gap needs closing -- see README's "Known gap". */
  var MANAGER_PIN = '6767';
  // Destructive-action roster: unchanged by the 2026-08-13 three-tier role
  // split below (admin/manager/worker) -- confirmManager() only cares about
  // "elevated or not," so isManager() now accepts EITHER the 'admin' role
  // (Anthony) or the 'manager' role (Gian, Parker) as long as the attributed
  // name is still on this roster. See functions/api/_worker-auth.js's
  // ADMIN_NAMES/MANAGER_NAMES for the server-side source of truth that
  // actually decides role() in the first place.
  var MANAGER_NAMES = ['Gian', 'Anthony', 'Parker'];
  function isManager(){ var r = role(); return (r === 'manager' || r === 'admin') && MANAGER_NAMES.indexOf(workerName()) !== -1; }
  // Systems Operator only -- Anthony. Gates the Salesforce environment
  // switcher button itself (not just the PIN-protected switch action, which
  // was already gated server-side by SF_ENV_SWITCH_PIN regardless of role --
  // see functions/api/admin/sf-env.js). Gian/Parker hold 'manager', not
  // 'admin', so this deliberately excludes them.
  function isAdmin(){ return role() === 'admin'; }
  // Pre-Production Management dashboard: visible to admin (Anthony) and
  // manager (Gian, Parker) alike -- everyone else gets every OTHER
  // dashboard. See buildNavBoards() below, which is what actually hides the
  // sidebar link; this is exposed too in case a page wants to gate an
  // in-page entry point (a button, a deep link) the same way.
  function canAccessManagement(){ var r = role(); return r === 'admin' || r === 'manager'; }
  function confirmManager(actionLabel){
    if (isManager()) return true;
    if (MANAGER_NAMES.indexOf(workerName()) === -1) {
      window.alert('Only Gian, Anthony, or Parker can do this. Switch user if one of them is here.');
      return false;
    }
    var entered = window.prompt((actionLabel || 'This action') + ' requires the manager PIN:');
    if (entered == null) return false;
    if (entered !== MANAGER_PIN) { window.alert('Incorrect manager PIN.'); return false; }
    return true;
  }

  /* ── real per-worker PIN login (2026-08-13) ──
     Verifies a PERSONAL PIN server-side against functions/api/_worker-auth.js's
     WORKER_PINS map and returns who it belongs to, instead of login.html
     comparing against the two shared, on-screen PINs itself. Login is the
     only caller (see login.html's submit()) -- everything downstream still
     just reads role()/workerName() from localStorage as before, so this is
     a drop-in replacement for the OLD client-side check, not a new auth
     model the rest of the app needs to know about.
     Throws (via jsend) on a non-2xx response -- login.html distinguishes
     err.status 401 ("wrong PIN") from 500 ("WORKER_PINS not configured")
     to show the right message. */
  // Overlay on: one of the three moments that earn it. Covers login.html AND
  // the in-page PIN gate on every board, since both route through here.
  function workerLogin(pin){
    return foregroundLoad(function () {
      return jsend('/api/worker-login', 'POST', { pin: pin });
    });
  }

  /* ── Order_Substatus__c: the "In Production" label is stored as "Production" ── */
  var SUBSTATUS_VALUE = { 'Pre-Production':'Pre-Production', 'Ready for Print':'Ready for Print', 'In Production':'Production', 'Post-Production':'Post-Production', 'Completed':'Completed' };
  var SUBSTATUS_LABEL = {}; Object.keys(SUBSTATUS_VALUE).forEach(function (label) { SUBSTATUS_LABEL[SUBSTATUS_VALUE[label]] = label; });

  /* ── Shipping_Delivery__c ("Delivery Method"): same label/value trap as
     above, confirmed live in Setup 2026-08-10 -- the picklist entry shown
     on screen as "Local Dropoff" is stored under the API value "Delivery".
     DELIVERY_LABEL maps the real stored value -> what to show a human;
     DELIVERY_METHODS is the fixed tab order the Shipping/Receiving
     Dashboard (shipping.html) uses, stored-value keyed. */
  /* ── all-boards sidebar (added 2026-08-11) ──
     Single source of truth for the "jump to any board" sidebar every page
     now shares, so the list/order/icons/colors can't drift board to board
     the way the old per-page inline nav pills had (each page had its own
     copy, in a different order, mixed in with page-specific controls).
     Keep in sync with the board list login.html's post-login screen shows
     if that one ever changes -- login.html doesn't load this because it
     already needs its own duplicate list before a role/name exists. */
  var NAV_BOARDS = [
    { key:'pre-production', label:'Pre-Production', sub:'Design · screens · receiving', href:'pre-production.html', color:'#C9923A', icon:'ti-clipboard-check' },
    { key:'management', label:'Pre-Production Management', sub:'Order intake · methods · production runs', href:'pre-production.html?view=mgr', color:'#6C7686', icon:'ti-settings' },
    { key:'index', label:'Production Dashboard', sub:'Kanban · print → ship', href:'index.html', color:'#C6372B', icon:'ti-layout-kanban' },
    // Production Calendar (2026-08-17). Added HERE, in the shared list, rather
    // than as a one-off pill on each board -- that is what makes the same entry
    // appear in the sidebar AND on every other dashboard from a single change,
    // which is the whole reason NAV_BOARDS exists. Deliberately NOT filtered by
    // canAccessManagement(): everyone can SEE the schedule (the shop floor needs
    // to know what is running when), and calendar.html gates the drag itself
    // behind confirmManager() instead of hiding the board.
    { key:'calendar', label:'Production Calendar', sub:'Priority · press schedule · print dates', href:'calendar.html', color:'#9878C0', icon:'ti-calendar-time' },
    { key:'station', label:'Station Board', sub:'Ink · screens · transfers', href:'station.html', color:'#5E9B9A', icon:'ti-device-tablet' },
    // Run Counts (2026-08-27). The press-side tablet board -- the first surface
    // in this app that lives at the press rather than before or after it. Not
    // folded into station.html because that board is pre-production only (ink,
    // screens, transfers, receiving) and counting is the opposite end of the
    // job. Deliberately visible to everyone: the press operator who ran the job
    // is the person who should be counting it, and gating this behind a manager
    // role is exactly how the numbers end up being typed second-hand off a run
    // sheet the next morning, which is what the whole model exists to stop.
    { key:'counting', label:'Run Counts', sub:'Record results · misprints · shortfalls', href:'counting.html', color:'#C9923A', icon:'ti-clipboard-list' },
    { key:'shipping', label:'Shipping/Receiving', sub:'Post-production · ship · complete', href:'shipping.html', color:'#3E7CB1', icon:'ti-truck-delivery' },
    { key:'stats', label:'Stats', sub:'Prep-time buffer · team status · board totals', href:'stats.html', color:'#7FA644', icon:'ti-chart-bar' },
  ];
  // Pre-Production Management (NAV_BOARDS entry key:'management') is hidden
  // from the sidebar for anyone who isn't admin or manager (2026-08-13) --
  // see canAccessManagement() above. Reads role() itself rather than taking
  // a parameter so every existing buildNavBoards(currentKey) call site
  // (index.html/pre-production.html/station.html/shipping.html) picks this
  // up with no changes needed there.
  function buildNavBoards(currentKey){
    var boards = canAccessManagement() ? NAV_BOARDS : NAV_BOARDS.filter(function (b) { return b.key !== 'management'; });
    return boards.map(function (b) {
      var active = b.key === currentKey;
      return Object.assign({}, b, {
        isActive: active,
        bg: active ? 'rgba(255,255,255,.05)' : '#141417',
        border: active ? '#3a3a40' : '#232327',
      });
    });
  }
  var DELIVERY_LABEL = { 'Shipping':'Shipping', 'Delivery':'Delivery', 'Pickup':'Pick-up', 'Split Ship':'Split Ship', 'Order Fulfillment':'Order Fulfillment' };
  var DELIVERY_METHODS = ['Shipping', 'Delivery', 'Pickup', 'Split Ship', 'Order Fulfillment'];
  var STAGE_KEY = { 'Ready for Print':'rfp', 'In Production':'ip', 'Post-Production':'pp', 'Completed':'done' };
  var STAGE_SUBSTATUS = { rfp:'Ready for Print', ip:'In Production', pp:'Post-Production', done:'Completed' };
  function stageOf(rec){ return STAGE_KEY[SUBSTATUS_LABEL[rec.Order_Substatus__c] || rec.Order_Substatus__c] || null; }
  // Same rfp/ip/pp/done bucketing, but for a Production_Method__c's own
  // Status__c instead of the Order's Order_Substatus__c -- no label/value
  // quirk here, Production_Method__c.Status__c stores "In Production"
  // literally (see production-methods/index.js ALLOWED_STATUSES), so
  // STAGE_KEY can be looked up directly. Returns null for "Pre-Production",
  // "Cancelled", and "On Hold" -- those methods haven't reached the
  // production floor board (or have left it) and shouldn't show a card there.
  function stageOfMethod(status){ return STAGE_KEY[status] || null; }

  /* pre-production checklist label -> Order boolean field */
  // 'Design received' (Films_Printed__c, renamed to Design_Received__c
  // 2026-08-10) was DROPPED as a checklist item 2026-08-13: Salesforce
  // removed the field from the Order page layouts, the Production Status
  // flow's Screen Print Checklist outcome, the PrintShop Production path's
  // Key Fields, and the ReadyforPrintStatus validation rule (dev2 +
  // staging). No label maps to it here anymore -- see
  // pre-production.html's M.sp.prereq, which no longer lists it either.
  var CHECK_FIELD = {
    'Screens completed':'Screens_Completed__c', 'Inks mixed':'Mix_Inks__c',
    'File digitized':'Digitize_File__c', 'Thread & materials':'Thread_Color_Materials__c',
    'Transfers received':'Transfers_Received__c', 'Transfers ready':'Transfers_Ready__c'
  };
  /* Receiving_Status__c picklist <-> board key */
  var RECV_FROM_SF = { 'Not Received':'none', 'Partial':'partial', 'Counted In':'countedin', 'Staged':'staged' };
  var RECV_TO_SF = { none:'Not Received', partial:'Partial', countedin:'Counted In', staged:'Staged' };

  // Time-of-day options for the Production Run schedule/actual pickers
  // (Scheduled Start/End, Actual Start/End) -- 15-minute increments only
  // (00:00, 00:15, 00:30 ... 23:45), matching how Salesforce's own time
  // picker for these fields is configured there. Added 2026-08-13: an
  // <input type=time step=900> was tried first, but the step attribute only
  // nudges a native spinner/arrow-key increment -- typing or scrolling in
  // most browsers still freely lands on any minute, which isn't a real
  // match for "only these options exist." A <select> of exactly these 96
  // values is the only way to actually remove the other minutes as choices.
  // value is 24-hour "HH:MM" -- the exact format buildRunDateTime()/
  // splitDT() in index.html and pre-production.html already read and write,
  // so no other code needs to change. label is a 12-hour clock string for
  // display.
  /**
   * Round a time to the nearest 15 minutes and return it as an ISO string.
   *
   * The 15-minute grid is not cosmetic -- it is the only granularity the rest
   * of this system deals in. TIME_OPTIONS below is a <select> of exactly the
   * 96 legal quarter-hours, Salesforce's own time picker for Actual_Start__c /
   * Scheduled_Start__c is configured the same way, and the calendar packs runs
   * onto that grid. A timer stamping 10:37 would put a value on the record
   * that no picker in the app can display or re-select, so the moment a press
   * operator opened the row to check it, saving would silently move it.
   *
   * Rounds to NEAREST, not down: 10:37 -> 10:30, 10:38 -> 10:45. Seconds and
   * milliseconds are cleared. Accepts a Date, an epoch number, an ISO string,
   * or nothing (meaning now).
   */
  var QUARTER_MS = 15 * 60 * 1000;
  function roundToQuarterHour(when) {
    var ms;
    if (when == null) ms = Date.now();
    else if (when instanceof Date) ms = when.getTime();
    else if (typeof when === 'number') ms = when;
    else ms = Date.parse(when);
    if (!isFinite(ms)) return null;
    // Round on the LOCAL clock, not UTC. Some timezones sit at :30 or :45
    // offsets (India, Nepal, Chatham), where rounding the UTC value lands on
    // :07/:22/:37 locally -- off the grid every picker in the app uses.
    var d = new Date(ms);
    var mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    var snapped = Math.round(mins / 15) * 15;
    d.setHours(0, 0, 0, 0);
    return new Date(d.getTime() + snapped * 60 * 1000).toISOString();
  }

  var TIME_OPTIONS = (function () {
    var out = [];
    for (var m = 0; m < 24 * 60; m += 15) {
      var h = Math.floor(m / 60), mins = m % 60;
      var hh = String(h).padStart(2, '0'), mm = String(mins).padStart(2, '0');
      var h12 = (h % 12 === 0) ? 12 : (h % 12);
      var ampm = h < 12 ? 'AM' : 'PM';
      out.push({ value: hh + ':' + mm, label: h12 + ':' + mm + ' ' + ampm });
    }
    return out;
  })();

  /* ── Production_Method__c.Status__c: what each stage actually means ──
   *
   * Added 2026-08-20. The five pipeline statuses are shop jargon that every
   * board displays but none of them explained, so a new hire reading
   * "Post-Production" had no way to know it means folding and bagging rather
   * than "finished". This is the one place that copy lives -- the kanban
   * column headers, the drawer's status stepper and every Status dropdown all
   * read from here, so the wording can't drift between boards.
   *
   * Written to answer "is this job mine right now?", not to restate the label.
   * Keep them one short sentence: they render at 10px in the faintest text
   * colour the palette has, under a heading, on a shop tablet.
   *
   * Cancelled and On Hold aren't part of the five, but both appear in every
   * Status dropdown (see statusOptions in index.html/pre-production.html), and
   * both are stages that make a card VANISH from the boards -- stageOfMethod()
   * returns null for them. That is exactly the case where a manager needs a
   * warning before picking, so they get help text too.
   */
  /* ── Print location on runs ──────────────────────────────────────────
   * Production_Run__c.Print_Location__c and Proposed_Run__c.Print_Location__c
   * are single-select restricted picklists over the same eleven values as
   * Production_Method__c.Placements__c (PLACEMENTS below).
   *
   * Optimistic by design: true until an endpoint tells us otherwise, so the
   * picker is present on a healthy org from the very first render instead of
   * popping in after the first run list loads. GET /api/production-runs sets
   * it from its own SELECT fallback. */
  var _locationAvailable = true;
  function locationAvailable(){ return _locationAvailable !== false; }

  /**
   * Which locations a run under this method may use.
   * Scoped to the parent method's Placements__c so a manager can't schedule a
   * location the job doesn't have -- but falls back to all eleven when the
   * method has none recorded, because an empty picker would be a dead end on
   * the many older methods whose placements were never filled in.
   * `placements` may be the raw ";"-joined string or an array.
   */
  function locationsForMethod(placements){
    var list = placements;
    if (typeof list === 'string') list = list.split(';');
    if (!list || !list.length) return PLACEMENTS.slice();
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = String(list[i] || '').trim();
      if (v && out.indexOf(v) === -1) out.push(v);
    }
    return out.length ? out : PLACEMENTS.slice();
  }

  var STATUS_HELP = {
    'Pre-Production': 'Screens, inks, thread and transfers are being prepped and garments counted in. Nothing is on a press yet.',
    'Ready for Print': 'Prep is finished and garments are staged. The job can be scheduled onto a press.',
    'In Production': 'On the press now — printing or stitching is underway.',
    'Post-Production': 'Off the press. Folding, bagging, counting and quality check before it ships.',
    'Completed': 'Shipped or picked up. Nothing left to do on this job.',
    'Cancelled': 'Called off. The job disappears from every board — cancelled work never happened.',
    'On Hold': 'Paused. Prep may be done, but the job leaves the boards until someone moves it on.'
  };
  /** Help copy for a status LABEL, or '' if there isn't any. Never throws on
   *  an unknown value -- a board should lose the hint, not the render. */
  function statusHelp(label){
    return (label && STATUS_HELP[label]) || '';
  }

  /* ══ Centre-screen loading overlay ═════════════════════════════════════
   *
   * Added 2026-08-20. The boards already had a connection dot in the header,
   * but on a shop-floor tablet at arm's length nobody notices an 8px dot --
   * a tap that takes two seconds just looks like the tap didn't register, so
   * workers tap again. This is the same signal, centre screen and unmissable.
   *
   * It lives HERE rather than in each page's template on purpose:
   *   - It hooks jget/jsend/jdel below, so every existing CAApi call gets it
   *     with no per-page wiring and no chance of a board being forgotten.
   *   - The node is appended to <body>, OUTSIDE support.js's #dc-root, so it
   *     is never part of the React tree, never re-rendered, and can't be
   *     clobbered when a board re-renders mid-request.
   *
   * OPT-IN, NOT OPT-OUT (changed 2026-08-20, second pass)
   * ------------------------------------------------------
   * The first cut showed the overlay for EVERY call that wasn't explicitly
   * marked background. In the shop that read as a full-screen flash after
   * nearly every tap -- saving a run, opening a drawer, editing a time. The
   * feedback stopped meaning anything.
   *
   * It is now the other way round: **a request is silent unless something
   * deliberately asks for the overlay.** Exactly three things do, because
   * these are the moments where the whole screen is genuinely about to
   * change and a blank pause needs explaining:
   *
   *   1. Switching dashboards  -- the document-level nav listener below
   *   2. Logging in            -- workerLogin()
   *   3. Switching environments -- setSfEnv()
   *
   * Plus each board's FIRST load() on mount, which is the far half of (1):
   * the destination board fetching what it needs. Boards opt in with their
   * own fg() helper.
   *
   * Everything else -- saves, drawer opens, per-row edits, searches, polls,
   * auto-refresh -- stays silent and always will. If you find yourself
   * wanting the overlay for one of those, the honest fix is almost always
   * an inline spinner on the control that was clicked, not a screen-wide
   * curtain.
   *
   * TWO RULES THAT STILL MATTER -- do not remove casually:
   *
   * 1. DELAY, for request-driven shows. Nothing paints for the first
   *    LOADER_DELAY_MS. Most calls against a warm Salesforce token return
   *    well inside that, and a full-screen panel that flashes for 90ms reads
   *    as a glitch, not as feedback. Navigation skips the delay -- there the
   *    page really is going away and immediate feedback is the point.
   *
   * 2. IT ALWAYS LETS GO. jget/jsend/jdel pass no AbortSignal and no timeout
   *    (see the note on connection state at the top of this file), so a hung
   *    request never settles and would otherwise leave the shop staring at a
   *    permanently blocked screen. LOADER_MAX_MS force-hides it. The request
   *    itself is left alone -- if it eventually lands, the board updates as
   *    usual; this only stops the overlay from outliving its usefulness.
   */
  var LOADER_DELAY_MS = 320;    // rule 1 -- quick calls never paint
  var LOADER_MAX_MS = 15000;    // rule 2 -- hard ceiling, never block forever
  var _fgInFlight = 0;          // foreground requests currently outstanding
  var _fgDepth = 0;             // >0 while a LOADER-WORTHY call is being started
  var _showTimer = null, _maxTimer = null, _loaderEl = null, _loaderShown = false;

  // The mark is the header logo: seven horizontal bars whose widths taper to
  // a circle. "Filling in the lines" is a top-to-bottom sweep of those same
  // bars -- so the thing that spins is recognisably the Culture Apparel logo
  // rather than a generic ring. Widths/positions are copied verbatim from the
  // <svg> in each page's header; if that mark ever changes, change it here too.
  var LOADER_BARS = [
    { x:12, y:9,  w:24 }, { x:8, y:14, w:32 }, { x:5, y:19, w:38 },
    { x:5,  y:24, w:38 }, { x:6, y:29, w:36 }, { x:9, y:34, w:30 },
    { x:13, y:39, w:22 }
  ];

  function loaderCss(){
    var rules = [
      '@keyframes ca-loader-bar{0%,100%{opacity:.13}18%{opacity:1}45%{opacity:.13}}',
      '@keyframes ca-loader-in{from{opacity:0}to{opacity:1}}',
      '@keyframes ca-loader-breathe{0%,100%{opacity:.35}50%{opacity:1}}',
      '.ca-loader{position:fixed;inset:0;z-index:2000;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;gap:18px;background:rgba(6,6,7,.78);' +
        '-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:ca-loader-in .16s ease-out}',
      '.ca-loader-label{font:600 11px/1 Oswald,Arial,sans-serif;letter-spacing:.28em;' +
        'text-transform:uppercase;color:#9C978C}',
      '.ca-loader-bar{animation:ca-loader-bar 1.45s ease-in-out infinite}'
    ];
    for (var i = 0; i < LOADER_BARS.length; i++) {
      rules.push('.ca-loader-bar-' + i + '{animation-delay:' + (i * 0.11).toFixed(2) + 's}');
    }
    // Respect the OS setting: a sweeping stagger is exactly the kind of
    // repeating motion prefers-reduced-motion exists to suppress. Fall back
    // to one slow breath of the whole mark -- still obviously "working",
    // without seven independently blinking elements.
    rules.push('@media (prefers-reduced-motion:reduce){' +
      '.ca-loader{animation:none}' +
      '.ca-loader-bar{animation:ca-loader-breathe 1.8s ease-in-out infinite;animation-delay:0s!important}}');
    return rules.join('');
  }

  function loaderNode(){
    if (_loaderEl) return _loaderEl;
    if (typeof document === 'undefined' || !document.body) return null;
    if (!document.getElementById('ca-loader-style')) {
      var st = document.createElement('style');
      st.id = 'ca-loader-style';
      st.textContent = loaderCss();
      document.head.appendChild(st);
    }
    var el = document.createElement('div');
    el.className = 'ca-loader';
    // role=status + aria-live announces it without stealing focus; aria-busy
    // marks the blocked region. Built with createElementNS because SVG in a
    // plain innerHTML string on a div lands in the wrong namespace and
    // renders as nothing.
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-busy', 'true');
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '84'); svg.setAttribute('height', '84');
    svg.setAttribute('viewBox', '0 0 48 48'); svg.setAttribute('aria-hidden', 'true');
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('fill', '#C6372B');
    for (var i = 0; i < LOADER_BARS.length; i++) {
      var b = LOADER_BARS[i];
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', b.x); r.setAttribute('y', b.y);
      r.setAttribute('width', b.w); r.setAttribute('height', '3.1');
      r.setAttribute('rx', '1.5');
      r.setAttribute('class', 'ca-loader-bar ca-loader-bar-' + i);
      g.appendChild(r);
    }
    svg.appendChild(g);
    el.appendChild(svg);
    var label = document.createElement('div');
    label.className = 'ca-loader-label';
    label.textContent = 'Loading';
    el.appendChild(label);
    _loaderEl = el;
    return el;
  }

  function paintLoader(on){
    if (on === _loaderShown) return;
    var el = loaderNode();
    if (!el) return;
    if (on) { document.body.appendChild(el); _loaderShown = true; }
    else if (el.parentNode) { el.parentNode.removeChild(el); _loaderShown = false; }
    else { _loaderShown = false; }
  }

  function clearLoaderTimers(){
    if (_showTimer) { clearTimeout(_showTimer); _showTimer = null; }
    if (_maxTimer) { clearTimeout(_maxTimer); _maxTimer = null; }
  }

  function loaderBegin(){
    // Silent unless this call was STARTED inside foregroundLoad(). The check
    // happens here, at call time, not when the promise settles -- so a call
    // fired synchronously inside fn() counts, and anything it kicks off later
    // (after an await) does not. That is deliberate: it keeps the overlay tied
    // to the one request the user is actually waiting on, not to whatever
    // follow-up work the board does once it has the data.
    var silent = _fgDepth === 0;
    if (silent) return true;
    _fgInFlight++;
    if (_fgInFlight === 1 && !_showTimer && !_loaderShown) {
      _showTimer = setTimeout(function () {
        _showTimer = null;
        paintLoader(true);
        _maxTimer = setTimeout(function () {
          _maxTimer = null;
          console.warn('[ca-loader] still waiting after ' + LOADER_MAX_MS +
            'ms -- hiding the overlay so the board stays usable. ' +
            _fgInFlight + ' request(s) never settled.');
          paintLoader(false);
        }, LOADER_MAX_MS);
      }, LOADER_DELAY_MS);
    }
    return false;
  }

  function loaderEnd(silent){
    if (silent) return;
    _fgInFlight = _fgInFlight > 0 ? _fgInFlight - 1 : 0;
    if (_fgInFlight === 0) { clearLoaderTimers(); paintLoader(false); }
  }

  /**
   * Run fn() and DO show the overlay for any request it starts.
   *
   * Use only for the three moments listed in the header comment plus a board's
   * first load(). fn is called synchronously, and only requests kicked off
   * before its first await are covered -- which is exactly the shape of every
   * load() in this app (the fetch is started, then awaited).
   */
  function foregroundLoad(fn){
    _fgDepth++;
    try { return fn(); } finally { _fgDepth--; }
  }

  /**
   * Legacy marker, kept deliberately.
   *
   * Silent is now the DEFAULT, so this is a plain passthrough and calling it
   * changes nothing. It stays because all six boards wrap their auto-refresh
   * and poll callbacks in it, and because those call sites still say something
   * true and useful -- "this is background work" -- that would be lost if they
   * were stripped out. If the policy ever flips back, they are already marked.
   */
  function backgroundLoad(fn){
    return fn();
  }

  /**
   * Count a promise from a fetch this module didn't make. calendar.html talks
   * to /api/calendar directly (that endpoint has no CAApi wrapper), so it
   * would otherwise be the one board with no overlay.
   */
  function trackRequest(promise){
    var silent = loaderBegin();
    var done = function () { loaderEnd(silent); };
    if (!promise || typeof promise.then !== 'function') { done(); return promise; }
    return promise.then(
      function (v) { done(); return v; },
      function (e) { done(); throw e; }
    );
  }

  /** Escape hatch: force the overlay down (e.g. before window.print()). */
  function hideLoader(){ _fgInFlight = 0; clearLoaderTimers(); paintLoader(false); }

  /**
   * Show the overlay immediately, with no request behind it and no delay.
   *
   * For navigation: the browser is about to tear this document down and the
   * gap before the next one paints is dead air. Skipping LOADER_DELAY_MS is
   * right here -- unlike a request that might come back in 90ms, a page load
   * is never that fast, so there is no flash to avoid.
   *
   * Still bounded by LOADER_MAX_MS, so a navigation that never happens (the
   * user hits Escape, the target 404s and the browser stays put) can't leave
   * the curtain down forever.
   */
  function showLoaderNow(){
    if (_loaderShown || _showTimer) return;
    paintLoader(true);
    clearLoaderTimers();
    _maxTimer = setTimeout(function () {
      _maxTimer = null;
      paintLoader(false);
    }, LOADER_MAX_MS);
  }

  /**
   * "Switching dashboards" -- one document-level listener instead of a handler
   * on every nav link.
   *
   * The sidebar in every board renders plain <a href> links (see
   * buildNavBoards), and so do the calendar's per-prep-item station links, the
   * Order Sheet links and index's "add another method" deep link. All of them
   * are a dashboard switch from the worker's point of view, so catching the
   * click at the document level covers every one without touching a template.
   *
   * Deliberately NOT shown for: modified clicks (cmd/ctrl/shift -- those open
   * a new tab and this one stays put), target=_blank, downloads, non-http
   * schemes, and same-page anchors or querystring-only changes, which is what
   * writeParams() does when a drawer opens.
   */
  function sameDocument(a){
    return a.pathname === location.pathname && a.host === location.host;
  }
  function installNavLoader(){
    if (typeof document === 'undefined' || document.__caNavLoader) return;
    document.__caNavLoader = true;
    document.addEventListener('click', function (e) {
      try {
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        if (a.target && a.target !== '_self') return;
        if (a.hasAttribute('download')) return;
        var href = a.getAttribute('href') || '';
        if (!href || href[0] === '#') return;
        if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
        if (a.protocol !== 'http:' && a.protocol !== 'https:') return;
        if (a.host !== location.host) return;   // leaving the app entirely
        if (sameDocument(a)) return;            // ?tab=/?card= only -- no page change
        showLoaderNow();
      } catch (_) { /* never let the overlay break a navigation */ }
    }, true);
    // If the page is restored from bfcache (back button), the overlay would
    // still be in the DOM from the click that left. Clear it on show.
    window.addEventListener('pageshow', function () { hideLoader(); });
  }
  try { installNavLoader(); } catch (_) {}

  /* ── low-level fetch ── */
  function jget(url){
    return trackRequest(fetch(url, { headers: { Accept:'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('GET ' + url + ' -> ' + r.status);
      return r.json();
    }));
  }
  function jsend(url, method, body){
    return trackRequest(fetch(url, { method: method, headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) {
      if (!r.ok && r.status !== 204) {
        // FIXED 2026-07-28: this used to throw a bare "POST /api/x -> 502"
        // Error and never touch the response body, so callers (e.g.
        // pre-production.html's Create Production Plan handler) had no way
        // to show the real Salesforce error -- endpoints like
        // /api/production-methods already return detailed JSON on failure
        // ({error, failedRef, detail, all}), it just never got read. Parse
        // that body (best-effort) and attach it to the thrown Error so
        // callers can surface the actual cause instead of a generic message.
        return r.json().catch(function () { return null; }).then(function (data) {
          var err = new Error(method + ' ' + url + ' -> ' + r.status);
          err.status = r.status;
          err.data = data;
          throw err;
        });
      }
      return r.status === 204 ? null : r.json().catch(function () { return null; });
    }));
  }
  function jdel(url){
    return trackRequest(fetch(url, { method: 'DELETE' }).then(function (r) {
      if (!r.ok && r.status !== 204) throw new Error('DELETE ' + url + ' -> ' + r.status);
      return r.status === 204 ? null : r.json().catch(function () { return null; });
    }));
  }

  /* ── orders ── */
  function getOrders(){ return jget('/api/orders').then(function (d) { return d.records || []; }); }
  function getProductionOrders(){ return jget('/api/production-orders').then(function (d) { return d.records || []; }); }
  function getInbox(){ return jget('/api/inbox').then(function (d) { return d.records || []; }); }
  function getPreProductionItems(orderId){ return jget('/api/pre-production-items?orderId=' + encodeURIComponent(orderId)).then(function (d) { return d.records || []; }); }
  function patchItem(itemId, fields){ var b = Object.assign({}, fields); var by = workerName(); if (by) b.Last_Updated_By__c = by; return jsend('/api/pre-production-items/' + encodeURIComponent(itemId), 'PATCH', b); }
  function deleteItem(itemId){ return jdel('/api/pre-production-items/' + encodeURIComponent(itemId)); }
  // Adds ONE Pre_Production_Item__c to an EXISTING Production_Method__c --
  // for the case Management forgot to add an item when the method was first
  // created. item: { type, mesh, pantone, threadColor, threadNumber,
  // stitchCount, transferType } -- only the fields matching `type` matter.
  function createItem(methodId, item){ var b = Object.assign({ methodId: methodId }, item || {}); var by = workerName(); if (by) b.by = by; return jsend('/api/pre-production-items', 'POST', b); }
  /* ── Mockup lightbox ───────────────────────────────────────────────────
     Click any mockup on any board to open it big, with zoom and pan.

     Built as a plain DOM overlay appended to <body> rather than as markup in
     each page's dc template. Three reasons:
       - one implementation instead of five near-copies to keep in step;
       - the boards re-render constantly (20s auto-refresh), and a template
         modal would be torn down and rebuilt mid-zoom, losing the transform;
       - it sits above everything without joining the z-index ladder each page
         maintains (40 header ... 96 sfEnv), which a template modal would have
         to thread through.

     openLightbox(url, alt) is the whole public surface. Pages pass the SAME
     url they already render -- DesignMockupUrl is already a same-origin
     /api/mockup-proxy link by the time the browser sees it (see
     functions/api/_mockup.js), so it must never be re-wrapped. The proxy
     serves one resolution only, so this is the thumbnail at full size, which
     is exactly what "see it clearer" means here. */
  var MIN_ZOOM = 1, MAX_ZOOM = 6, ZOOM_STEP = 0.25;
  var _lb = null;   // the live overlay, or null

  function closeLightbox(){
    if (!_lb) return;
    try { document.removeEventListener('keydown', _lb.onKey, true); } catch (e) {}
    try { if (_lb.el && _lb.el.parentNode) _lb.el.parentNode.removeChild(_lb.el); } catch (e) {}
    try { document.body.style.overflow = _lb.prevOverflow || ''; } catch (e) {}
    _lb = null;
  }

  /* ca-fade is defined in some pages' <style> blocks but not others (index,
     pre-production and calendar don't have it). Inject it once so the overlay
     looks the same everywhere instead of animating on three boards and
     snapping on the rest. */
  function ensureLightboxCss(){
    if (document.getElementById('ca-lightbox-css')) return;
    var s = document.createElement('style');
    s.id = 'ca-lightbox-css';
    s.textContent = '@keyframes ca-fade{from{opacity:0}to{opacity:1}}' +
      '[data-ca-lightbox] button:hover{border-color:#3a3a40 !important;color:#fff !important}';
    document.head.appendChild(s);
  }

  function openLightbox(url, alt){
    if (!url) return;
    closeLightbox();                       // never stack two
    ensureLightboxCss();

    var zoom = 1, panX = 0, panY = 0, drag = null;

    var el = document.createElement('div');
    el.setAttribute('data-ca-lightbox', '');
    el.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(6,6,7,.9);' +
      'backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;' +
      'padding:32px;overflow:hidden;animation:ca-fade .16s ease';

    var img = document.createElement('img');
    img.src = url;
    img.alt = alt || 'Mockup';
    img.draggable = false;
    img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;' +
      'user-select:none;-webkit-user-drag:none;transition:transform .08s linear;' +
      'transform-origin:center center;cursor:zoom-in';

    function paint(){
      img.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoom + ')';
      img.style.cursor = zoom > 1 ? (drag ? 'grabbing' : 'grab') : 'zoom-in';
      if (pct) pct.textContent = Math.round(zoom * 100) + '%';
    }
    function setZoom(next){
      var z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      if (z === zoom) return;
      zoom = z;
      // Snapping back to 1 must also recentre, or the image stays parked
      // off-screen where the last pan left it with no way to find it again.
      if (zoom === MIN_ZOOM) { panX = 0; panY = 0; }
      paint();
    }

    // --- chrome: zoom out / % / zoom in / close -------------------------
    var bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:18px;right:18px;display:flex;align-items:center;' +
      'gap:8px;background:rgba(13,13,15,.94);border:1px solid #2a2a2f;border-radius:11px;padding:7px 9px';
    function btn(icon, title, fn){
      var b = document.createElement('button');
      b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
      b.style.cssText = 'width:32px;height:32px;border-radius:8px;background:#16161a;border:1px solid #2a2a2f;' +
        "color:#ECEAE4;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center";
      b.innerHTML = '<i class="ti ' + icon + '"></i>';
      b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(); });
      return b;
    }
    var pct = document.createElement('span');
    pct.style.cssText = "min-width:46px;text-align:center;font:600 11px/1 'Oswald';letter-spacing:.06em;color:#9C978C";

    bar.appendChild(btn('ti-minus', 'Zoom out', function(){ setZoom(zoom - ZOOM_STEP); }));
    bar.appendChild(pct);
    bar.appendChild(btn('ti-plus', 'Zoom in', function(){ setZoom(zoom + ZOOM_STEP); }));
    bar.appendChild(btn('ti-x', 'Close', closeLightbox));

    var hint = document.createElement('div');
    hint.style.cssText = 'position:absolute;bottom:20px;left:0;right:0;text-align:center;' +
      "font:400 11px/1.4 'Archivo';color:#6C665C;pointer-events:none";
    hint.textContent = 'Scroll to zoom · drag to pan · Esc to close';

    // --- interaction ----------------------------------------------------
    // Backdrop click closes; clicks on the image or the toolbar do not.
    el.addEventListener('click', function (ev) { if (ev.target === el) closeLightbox(); });

    img.addEventListener('click', function (ev) { ev.stopPropagation(); });
    img.addEventListener('dblclick', function (ev) {
      ev.preventDefault();
      setZoom(zoom > 1 ? MIN_ZOOM : 2);
    });

    el.addEventListener('wheel', function (ev) {
      ev.preventDefault();                 // don't scroll the board underneath
      setZoom(zoom + (ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }, { passive: false });

    img.addEventListener('pointerdown', function (ev) {
      if (zoom <= 1) return;               // nothing to pan while it fits
      drag = { x: ev.clientX - panX, y: ev.clientY - panY };
      try { img.setPointerCapture(ev.pointerId); } catch (e) {}
      paint();
    });
    img.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      panX = ev.clientX - drag.x; panY = ev.clientY - drag.y;
      paint();
    });
    function endDrag(ev){
      if (!drag) return;
      drag = null;
      try { img.releasePointerCapture(ev.pointerId); } catch (e) {}
      paint();
    }
    img.addEventListener('pointerup', endDrag);
    img.addEventListener('pointercancel', endDrag);

    // A dead proxy URL should say so rather than leave an empty black square.
    img.addEventListener('error', function () {
      img.style.display = 'none';
      var msg = document.createElement('div');
      msg.style.cssText = "font:400 13px/1.5 'Archivo';color:#9C978C;text-align:center;max-width:320px";
      msg.innerHTML = '<i class="ti ti-photo-off" style="font-size:26px;display:block;margin-bottom:10px"></i>' +
        "This mockup didn't load. The design file may have been removed or renamed in Salesforce.";
      el.appendChild(msg);
    });

    // Capture phase, so this wins over any page-level key handling.
    function onKey(ev){
      if (ev.key === 'Escape') { ev.stopPropagation(); closeLightbox(); }
      else if (ev.key === '+' || ev.key === '=') setZoom(zoom + ZOOM_STEP);
      else if (ev.key === '-' || ev.key === '_') setZoom(zoom - ZOOM_STEP);
      else if (ev.key === '0') setZoom(MIN_ZOOM);
    }
    document.addEventListener('keydown', onKey, true);

    el.appendChild(img); el.appendChild(bar); el.appendChild(hint);
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(el);
    _lb = { el: el, onKey: onKey, prevOverflow: prevOverflow };
    paint();
  }

  /* Convenience for the templates: one call that is safe to wire to any
     mockup, including ones that may not have a URL. Returns a handler that
     also stops the click bubbling, so opening a card's mockup never also
     opens the card's drawer. */
  function mockupClick(url, alt){
    return function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (ev && ev.preventDefault) ev.preventDefault();
      openLightbox(url, alt);
    };
  }

  function searchPlans(q){ return jget('/api/plans?q=' + encodeURIComponent(q || '')).then(function (d) { return d.records || []; }); }
  // Account.Type = 'Press' only -- the shop's press/machine equipment
  // records, not every Account. Powers the Press picker on the
  // Create Production Run modal.
  function searchPresses(q){ return jget('/api/presses?q=' + encodeURIComponent(q || '')).then(function (d) { return d.records || []; }); }
  function createMethod(body){ return jsend('/api/production-methods', 'POST', body); }
  // Creates one Production_Run__c. body: { printMethodId, pressId, scheduledStart, scheduledEnd, quantity }
  function createProductionRun(body){ return jsend('/api/production-runs', 'POST', body); }
  // Every Production_Run__c attached to one Production_Method__c -- powers
  // the card drawer's "Production Runs" section (view + edit existing runs).
  function getProductionRuns(methodId){
    return jget('/api/production-runs?methodId=' + encodeURIComponent(methodId)).then(function (d) {
      // The endpoint reports whether Print_Location__c is queryable in the
      // active org (see _placements.js). Remembered here so the run forms can
      // hide the location picker against an org where the field hasn't been
      // built or has FLS off -- offering it there would let a manager pick a
      // location and then have the whole CREATE fail, which is worse than not
      // offering it at all.
      if (d && typeof d.locationAvailable === 'boolean') _locationAvailable = d.locationAvailable;
      return d.records || [];
    });
  }
  // The Account Manager's SUGGESTED runs for an order (Proposed_Run__c), set on
  // the Close and Create Order screen. These are recommendations only -- they
  // are not Production Runs, they hold no press time, and they cannot reach the
  // Event calendar. The shop reads them while creating the real runs.
  // Returns [] rather than throwing when an order has none, which is the common
  // case: every order closed before 2026-08-18 has zero.
  function getProposedRuns(orderId){
    return jget('/api/proposed-runs?orderId=' + encodeURIComponent(orderId))
      .then(function (d) { return (d && d.proposals) || []; })
      .catch(function () { return []; });
  }
  // Records what the shop decided about one suggestion. fields: any subset of
  // { status: 'Proposed'|'Accepted'|'Rejected'|'Superseded', createdRunId }.
  // Writes only to Proposed_Run__c -- it cannot move press time.
  function patchProposedRun(id, fields){
    return jsend('/api/proposed-runs/' + encodeURIComponent(id), 'PATCH', fields || {});
  }
  // Updates one Production_Run__c. fields: any subset of { pressId, scheduledStart,
  // scheduledEnd, quantity, actualStart, actualEnd } -- actualStart/actualEnd accept
  // '' to clear that field. See functions/api/production-runs/[id].js.
  // ifUnmodifiedSince (optional): the run's LastModifiedDate at the moment the
  // drawer loaded it for editing. When passed, the server rejects the write
  // with a 409 (err.status===409 on the thrown Error, err.data.error==='conflict')
  // if someone else saved this run more recently, instead of silently
  // overwriting their change -- added 2026-07-29 for concurrent-edit safety.
  function patchProductionRun(id, fields, ifUnmodifiedSince){
    var body = Object.assign({}, fields);
    if (ifUnmodifiedSince) body.ifUnmodifiedSince = ifUnmodifiedSince;
    return jsend('/api/production-runs/' + encodeURIComponent(id), 'PATCH', body);
  }
  // Updates ONE Production_Method__c's own Status__c (independent of its
  // order's other methods). orderId is optional but should be passed
  // whenever known -- the server uses it to roll the parent Order's
  // Order_Substatus__c up to whichever sibling method is least advanced, so
  // screens that still read the order-level field stay accurate.
  function patchMethodStatus(id, status, orderId){
    var body = { Status__c: status };
    if (orderId) body.orderId = orderId;
    return jsend('/api/production-methods/' + encodeURIComponent(id), 'PATCH', body);
  }
  // Toggles one of the 7 per-method pre-production checklist booleans
  // (Design_Received__c..Transfers_Ready__c -- same field names as CHECK_FIELD
  // below, just written to the method instead of the order). No orderId
  // needed: these don't affect Order_Substatus__c, so there's nothing to
  // roll up.
  function patchMethodChecklist(id, fields){ return jsend('/api/production-methods/' + encodeURIComponent(id), 'PATCH', fields); }
  // Every Production_Method__c on one order, regardless of its own Status__c
  // (unlike getProductionOrders()/getOrders(), which only surface methods
  // that have already reached the relevant board) -- powers the "Production
  // Methods" section of a card's drawer, so a manager can see/edit/remove
  // every method on the order the open card belongs to, and add a new one,
  // from any card on either board. See functions/api/production-methods/index.js.
  function getMethodsForOrder(orderId){ return jget('/api/production-methods?orderId=' + encodeURIComponent(orderId)).then(function (d) { return d.records || []; }); }
  // Generic per-method write -- same endpoint/shape as patchMethodStatus and
  // patchMethodChecklist above, just named for its newer use: editing a
  // method's Type__c/Placements__c in place from the drawer.
  // ifUnmodifiedSince (optional): the method's LastModifiedDate at the moment
  // the drawer loaded it into the edit form. When passed, the server rejects
  // the write with a 409 (err.status===409, err.data.error==='conflict') if
  // someone else saved this method more recently, instead of silently
  // overwriting their change -- added 2026-07-29 for concurrent-edit safety.
  // Only used by the edit-form save path (saveMethodEdit); the older
  // one-off status/checklist toggles (patchMethodStatus/patchMethodChecklist
  // above) deliberately keep their old unguarded fire-and-forget behavior --
  // a momentary boolean/status flip isn't really at risk the way a form left
  // open for a while is.
  function patchMethodFields(id, fields, ifUnmodifiedSince){
    var body = Object.assign({}, fields);
    if (ifUnmodifiedSince) body.ifUnmodifiedSince = ifUnmodifiedSince;
    return jsend('/api/production-methods/' + encodeURIComponent(id), 'PATCH', body);
  }
  // Removes ONE Production_Method__c. See that endpoint's header comment --
  // Salesforce (not this client) decides whether the delete is allowed if
  // Pre_Production_Item__c/Production_Run__c children still look up to it.
  function deleteMethod(id){ return jdel('/api/production-methods/' + encodeURIComponent(id)); }
  // Removes ONE Production_Run__c.
  function deleteProductionRun(id){ return jdel('/api/production-runs/' + encodeURIComponent(id)); }
  function patchOrder(id, fields){
    var body = Object.assign({}, fields);
    var by = workerName(); if (by) body.Last_Updated_By__c = by;
    return jsend('/api/orders/' + encodeURIComponent(id), 'PATCH', body);
  }
  function getOrderSizes(orderId){ return jget('/api/order-sizes?orderId=' + encodeURIComponent(orderId)).then(function (d) { return d.records || []; }); }
  // Ports Salesforce's "Production Error" quick action (Order -> Flow
  // "SCREEN Order Reprint Process"). items: [{ orderItemId, misprintQty, damagedQty }, ...]
  // -- only lines with misprintQty + damagedQty > 0 get actioned server-side.
  // Creates a new child Order (linked back via Original_Production_Order__c,
  // Status/Order_Substatus__c reset to Pre-Production) with matching reprint
  // OrderItems, and stamps Misprint_Details__c / TotalQtyMisprints__c onto the
  // original order. See functions/api/orders/[id]/reprint.js.
  function createReprintOrder(orderId, items, misprintDetails){
    return jsend('/api/orders/' + encodeURIComponent(orderId) + '/reprint', 'POST', {
      items: items, misprintDetails: misprintDetails, by: workerName()
    });
  }

  /* ── run results (Production_Run_Line_Items__c + Result_Status__c) ──
     The counting screen's data path, and the ONLY place in this app that
     writes the four production-result quantities. Everything downstream --
     the reprint automation, the shortfall reschedule -- reads what these
     write, so before counting.html existed the whole model was inert.

     Note what is NOT here: a setter for Planned_Qty__c. That number is
     generated with the line-item skeleton when a run is confirmed and is the
     yardstick the counts are measured against; letting the person reporting a
     loss also edit the target would quietly erase the discrepancy. Correcting
     a wrong Planned Qty is a Salesforce job, on purpose. */

  // Every run on a method that has actually been printed, counted or not --
  // the tablet splits them into To Count / Counted itself. Returns the whole
  // envelope rather than unwrapping .records, because `available:false` (the
  // org has not had the production-result fields deployed yet) is a state the
  // page has to render differently, not an empty list.
  function getCountableRuns(){ return jget('/api/run-results'); }

  // One run plus the rows to count. Same envelope shape as above.
  function getRunResults(runId){ return jget('/api/run-results?runId=' + encodeURIComponent(runId)); }

  // Records the counts AND submits the run in one call -- deliberately not two.
  // Result_Status__c = 'Submitted' is the only evidence a human counted (a
  // clean run and an untouched run are both all-blanks), so it must land in the
  // same request as the numbers it vouches for. lines:
  //   [{ id, misprintQty, damagedQty, incompleteQty }, ...]
  // Send '' or null for a quantity to CLEAR it; omit the key to leave it alone.
  // Rows with nothing set are fine to send and are skipped server-side.
  // Response carries { totals, incompleteTotal, needsReschedule, rework } --
  // `needsReschedule` is the cue to route the counter to run creation on the
  // SAME method, and `rework` reports whether a reprint order was built.
  function submitRunResults(runId, lines){
    return jsend('/api/run-results', 'POST', { runId: runId, lines: lines, by: workerName() });
  }

  /* ── packaging (Order_Packaging__c) ── */
  function getPackaging(orderId){ return jget('/api/packaging?orderId=' + encodeURIComponent(orderId)).then(function (d) { return d.records || []; }); }
  function postPackaging(orderId, type, qty){ return jsend('/api/packaging', 'POST', { orderId: orderId, Packaging_Type__c: type, Quantity__c: qty }); }
  function deletePackaging(pkgId){ return jdel('/api/packaging/' + encodeURIComponent(pkgId)); }

  /* ── shipping/receiving dashboard ── */
  // Orders where Order_Substatus__c = 'Post-Production' (every method on the
  // order has finished production -- see functions/api/shipping-orders/index.js
  // for why that's the right gate) and Status isn't already 'Complete'.
  function getShippingOrders(){ return jget('/api/shipping-orders').then(function (d) { return d.records || []; }); }
  // Day-over-day trend data for the Stats page (stats.html) -- real
  // Salesforce history (Order.CreatedDate / LastModifiedDate), not a
  // snapshot/tracking system. Returns { dates, newOrders, shipped }, each
  // an array of length 7 (oldest day first). See
  // functions/api/stats-trend/index.js for the query.
  function getStatsTrend(){ return jget('/api/stats-trend'); }
  // Closes an order out from the shipping/receiving board: standard
  // Status -> 'Complete'. Deliberately its own endpoint/call, not a generic
  // patchOrder({Status:'Complete'}) -- see functions/api/orders/[id]/complete.js
  // for why Status isn't on the generic PATCH allow-list.
  function completeOrder(orderId){ return jsend('/api/orders/' + encodeURIComponent(orderId) + '/complete', 'POST', { by: workerName() }); }

  /* ── shipments (zkmulti__MCShipment__c) ── */
  function getShipments(orderId){ return jget('/api/shipments?orderId=' + encodeURIComponent(orderId)).then(function (d) { return d.records || []; }); }
  function postShipment(orderId, o){ o = o || {}; return jsend('/api/shipments', 'POST', { orderId: orderId, Carrier: o.carrier, ServiceType: o.serviceType, TrackingNumber: o.tracking, Weight: o.weight }); }
  // Removes ONE zkmulti__MCShipment__c (and its child zkmulti__MCPackage__c
  // rows first -- see functions/api/shipments/[id].js, onRequestDelete).
  // The endpoint has existed since this file's shipments were first wired up;
  // this wrapper was the only piece missing to actually reach it from the UI
  // (added 2026-07-29, matching deleteMethod/deleteProductionRun above).
  function deleteShipment(id){ return jdel('/api/shipments/' + encodeURIComponent(id)); }
  // Server resolves the wizard's VF domain + org-specific field id from the
  // live connection (see functions/api/orders/[id]/zk-wizard-url.js) --
  // nothing org-specific is hardcoded on this side.
  function getZkWizardUrl(orderId, num){ return jget('/api/orders/' + encodeURIComponent(orderId) + '/zk-wizard-url?num=' + encodeURIComponent(num || '')); }

  /* ── split / combine shipments (Shipment_Order__c junction) ──
     Split: one order's items go out across 2+ physical shipments -- each
     group gets its own Shipment_Order__c "leg", its own OrderItems tagged
     to that leg, and its own logged zkmulti__MCShipment__c.
     Combine: 2+ orders ship together in ONE box -- one Primary order (its
     address/contact wins, one shared shipment record) plus 1+ Secondary
     orders riding along. Reuses the existing Is_Master_Shipment_Order__c /
     Master_Shipment_Order__c display already built into shipping.html's
     drawer (see the modal.hasCombinedNote logic there) -- this is just the
     first thing that actually WRITES those two fields.
     See functions/api/shipments/split.js and .../combine.js for the full
     server-side contract and field-level detail. */
  // groups: [{ itemIds:[...], carrier, serviceType, tracking, weight }, ...] -- 2+ required.
  function splitShipment(orderId, groups){ return jsend('/api/shipments/split', 'POST', { orderId: orderId, groups: groups }); }
  // orderIds: 2+ Order Ids including primaryOrderId. carrier/tracking required, serviceType/weight optional.
  function combineShipment(orderIds, primaryOrderId, o){
    o = o || {};
    return jsend('/api/shipments/combine', 'POST', { orderIds: orderIds, primaryOrderId: primaryOrderId, carrier: o.carrier, serviceType: o.serviceType, tracking: o.tracking, weight: o.weight });
  }
  // Split Shipment's item picker reuses getOrderSizes(orderId) above --
  // same raw OrderItem rows (Id, Size__c, Quantity, Color__c, Product2.Name)
  // the size-breakdown grid already fetches from /api/order-sizes.

  /* ── active Salesforce environment (dev2 / staging / production) ──
     Global, shared across every user -- see functions/api/admin/sf-env.js */
  function getSfEnv(){ return jget('/api/admin/sf-env'); }
  // Overlay on. This one repoints EVERY user's next request at a different
  // Salesforce org, so the pause deserves the most emphatic feedback the app
  // has. getSfEnv() above stays silent -- it is just the header chip.
  function setSfEnv(envKey, pin){
    return foregroundLoad(function () {
      return jsend('/api/admin/sf-env', 'POST', { env: envKey, pin: pin });
    });
  }

  /* ── station worker board ── */
  function getStationItems(station){ return jget('/api/station-items?station=' + encodeURIComponent(station)).then(function (d) { return d.records || []; }); }
  function updateItemStatus(station, itemId, subStatus){ return jsend('/api/update-item-status', 'POST', { station: station, itemId: itemId, subStatus: subStatus, by: workerName() }); }
  function updateOrderReceiving(orderId, status, missing){ return jsend('/api/update-order-receiving', 'POST', { station:'garment', orderId: orderId, status: status, missing: missing || '', by: workerName() }); }
  function getInventory(type){ return jget('/api/inventory?type=' + encodeURIComponent(type)).then(function (d) { return d.items || []; }); }
  function postInventory(type, items){ return jsend('/api/inventory', 'POST', { type: type, items: items }); }
  function stationLogin(station, pin){ return jsend('/api/station-login', 'POST', { station: station, pin: pin }); }

  /* ── mapping helpers ── */
  var SIZE_ORDER = ['YXS','YS','YM','YL','YXL','OS','XS','S','M','L','XL','2XL','3XL','4XL','5XL'];
  var WORKER_COLORS = ['#C6372B','#5E9B9A','#C9923A','#7FA644','#8E6FB0','#3E7CB1'];

  function text(v){ if (v == null) return ''; var s = String(v); if (s.indexOf('<') >= 0) { var el = document.createElement('div'); el.innerHTML = s; s = el.textContent || el.innerText || ''; } return s.replace(/\s+/g, ' ').trim(); }
  function initials(name){
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '\u2014';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  function colorForName(name){
    var h = 0, s = String(name || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return WORKER_COLORS[h % WORKER_COLORS.length];
  }
  function methodOf(rec){
    var p = ((rec.Printer__r && rec.Printer__r.Name) || '').toLowerCase();
    if (/embroid|stitch|thread/.test(p)) return 'em';
    if (/heat|transfer|dtf|vinyl|press/.test(p)) return 'hp';
    if (/screen|print/.test(p)) return 'sp';
    if (rec.Digitize_File__c || rec.Thread_Color_Materials__c) return 'em';
    if (rec.Transfers_Received__c || rec.Transfers_Ready__c) return 'hp';
    return 'sp';
  }
  // Salesforce Date fields come back as plain "YYYY-MM-DD" (needs a noon time
  // appended so it doesn't parse as UTC midnight and roll back a day in local
  // time). Salesforce DateTime fields come back already carrying a "T" and an
  // offset (e.g. "2026-07-25T00:00:00.000+0000") -- appending another "T12:00:00"
  // to those corrupts the string and makes every date fail to parse. Detect
  // which shape we got before deciding whether to append anything.
  function parseSfDate(iso){
    if (!iso) return null;
    var s = String(iso);
    var d = s.indexOf('T') >= 0 ? new Date(s) : new Date(s + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  // `days` (integer, or null when there's no date) is exposed alongside the
  // display label/urgency so callers that list many items (station boards)
  // can sort by actual due date instead of re-parsing the label text.
  function dueInfo(printDateISO){
    var d = parseSfDate(printDateISO);
    if (!d) return { label:'No date', urg:'ok', days:null };
    var today = new Date(); today.setHours(12,0,0,0);
    var days = Math.round((d - today) / 86400000);
    var md = d.toLocaleDateString([], { month:'short', day:'numeric' });
    if (days < 0) return { label:'Overdue \u00b7 ' + (-days) + 'd', urg:'over', days:days };
    if (days === 0) return { label:'Due today', urg:'today', days:days };
    if (days === 1) return { label:'Due tomorrow', urg:'soon', days:days };
    return { label: md + ' \u00b7 ' + days + 'd', urg: days <= 2 ? 'soon' : 'ok', days:days };
  }
  /* \u2500\u2500 Prep-time buffer (added 2026-08-11) \u2500\u2500
     "Prep time" here means runway, not elapsed time: for an order still
     sitting in Pre-Production, how many days are left between now and its
     Print_Date__c. Per Anthony: 3+ days left is healthy, 1-3 is getting
     tight, under 1 (including negative, i.e. already past the print date
     while still in prep) is a real problem.
     Takes the array of orders returned by getOrders() (one entry per order
     with at least one Production_Method__c still in Pre-Production, each
     carrying Order-level Print_Date__c) and rolls every order's buffer into
     ONE team-wide status using "worst case wins": a single order under 1
     day of buffer flips the whole indicator red, regardless of how
     comfortable the rest of the queue looks -- deliberate, not averaged
     away by a healthy queue.
     This is the single source of truth for the thresholds so the Prep Time
     KPI card (index.html) and the Stats page (stats.html) can never drift
     out of sync with each other -- change the 3/1 cutoffs here once. */
  function prepBufferStats(orders){
    var today = new Date(); today.setHours(12,0,0,0);
    var known = [];
    (orders || []).forEach(function (o) {
      if (!o.Print_Date__c) return;
      var d = parseSfDate(o.Print_Date__c);
      if (!d) return;
      known.push((d - today) / 86400000);
    });
    var count = (orders || []).length;
    var worst = known.length ? Math.min.apply(null, known) : null;
    var avg = known.length ? known.reduce(function (a, b) { return a + b; }, 0) / known.length : null;
    var status = 'green';
    if (worst !== null) status = worst >= 3 ? 'green' : (worst >= 1 ? 'yellow' : 'red');
    return { count: count, knownCount: known.length, worst: worst, avg: avg, status: status };
  }
  /* Shared color/label per status bucket so every page that shows the
     glowing indicator (KPI card, Stats page) reads identically. */
  var PREP_STATUS_META = {
    green:  { color:'#7FA644', label:'On Track' },
    yellow: { color:'#C9923A', label:'Watch Close' },
    red:    { color:'#E24A3A', label:'Behind Schedule' }
  };
  /* ── Urgency icon per dueInfo() bucket (added 2026-08-11) ──
     Every board colored the due-date icon+text by urgency but always used
     the SAME icon (ti-clock-hour-4) regardless of level -- color was doing
     100% of the signaling, which washes out under bright shop-floor
     lighting and is a real problem for colorblind workers. Each bucket now
     gets its own icon SHAPE too, so urgency reads even with color removed.
     Single source of truth here so index.html/pre-production.html/
     shipping.html/station.html can't drift into using different icons for
     the same bucket. 'done' isn't a dueInfo() bucket (dueInfo never returns
     it) but index.html's kanban assigns urg:'done' directly for completed
     cards, so it's included here too rather than silently falling back to
     the 'ok' icon. */
  var URG_ICON = {
    over: 'ti-alert-triangle',
    today: 'ti-clock-exclamation',
    soon: 'ti-hourglass-high',
    ok: 'ti-calendar-check',
    done: 'ti-circle-check'
  };
  /* ── Overdue card background/border (added 2026-08-11) ──
     Per Anthony: a 6px color stripe is too easy to miss at a glance /
     under bright light. Overdue cards now get the same tinted-panel
     treatment already used for other "this is a problem" UI elsewhere in
     these boards (misprint badges, Zenkraft error banners) instead of
     just a thin stripe -- everything else about the card (text, stripe,
     icon) stays the same, only urg==='over' gets this. */
  var URG_CARD_BG = { over: '#2A100D' };
  var URG_CARD_BORDER = { over: '#7A241C' };
  function urgCardStyle(urg) {
    return { bg: URG_CARD_BG[urg] || '#141417', border: URG_CARD_BORDER[urg] || '#232327' };
  }
  // ── multi-method / multi-placement orders ──
  // An order can have more than one Production_Method__c child: one per
  // decoration location (e.g. "Front - Screen Print", "Back - Screen Print",
  // "Tag - Heat Press" all under the same order). /api/orders and
  // /api/production-orders attach the raw list as rec.ProductionMethods; this
  // turns it into small, render-ready chips so boards don't have to re-derive
  // labels/colors themselves.
  var METHOD_META = {
    'Screen Print': { key:'sp', short:'Screen', color:'#C6372B' },
    'Embroidery':   { key:'em', short:'Embroid', color:'#5E9B9A' },
    'Heat Press':   { key:'hp', short:'Heat',    color:'#C9923A' },
    'Promotional Items': { key:'promo', short:'Promo', color:'#8E6FB0' }
  };
  function methodsList(rec){
    var raw = (rec && rec.ProductionMethods) || [];
    return raw.map(function (pm) {
      var meta = METHOD_META[pm.Type__c] || { key:'sp', short:pm.Type__c||'Method', color:'#8a8378' };
      // Placements (array, from the Placements__c multi-select field) is the
      // current shape; pm.Placement__c is a single-value fallback for any
      // record the server hasn't resolved into Placements yet.
      var placements = (pm.Placements && pm.Placements.length) ? pm.Placements : (pm.Placement__c ? [pm.Placement__c] : []);
      var placementLabel = placements.join(' + ');
      return {
        id: pm.Id, type: pm.Type__c, key: meta.key, color: meta.color,
        placements: placements, placement: placements[0] || null,
        label: placements.length ? (pm.Type__c + ' – ' + placementLabel) : (pm.Type__c || 'Method'),
        status: pm.Status__c || null
      };
    });
  }
  // Salesforce's compound Address fields (ShippingAddress, BillingAddress)
  // come back over REST as an object -- { street, city, state, postalCode,
  // country, ... } -- or null if nothing's been entered. Turns that into two
  // display lines; returns null (not a string) when there's nothing to show,
  // so callers can branch on it directly instead of printing an empty box.
  function formatAddress(addr){
    if (!addr) return null;
    var line1 = text(addr.street);
    var cityStateZip = [text(addr.city), text(addr.state)].filter(Boolean).join(', ') + (addr.postalCode ? ' ' + text(addr.postalCode) : '');
    var line2 = cityStateZip.trim();
    if (!line1 && !line2) return null;
    return { line1: line1, line2: line2, country: text(addr.country) };
  }
  /**
   * Label for a production run's garment count, in the context of the whole
   * order. Added 2026-08-20 at the shop's request.
   *
   * A run row's editable number is Quantity_Planned_c__c -- the garments THIS
   * run covers -- which is frequently a subset of the job (a 300-piece order
   * split across two press runs). The field is labelled "Total Garments" on
   * index.html and pre-production.html and "Pieces This Run" on calendar.html,
   * which made it easy to read a half-run as the whole order. This renders the
   * order total next to it so a worker can tell those apart at a glance
   * without opening the size breakdown.
   *
   * Lives here rather than in each board because all three already keep their
   * own copies of the run-row view model, and the wording drifting three ways
   * is exactly the failure this file exists to prevent.
   *
   * Returns '' when the order total isn't usable -- an order whose OrderItems
   * failed to load, or one with no sized line items. Callers hide the line
   * entirely on '' rather than printing "of 0", which reads as a real zero.
   */
  function runQtyHint(runQty, orderTotal){
    var total = Number(orderTotal);
    if (!Number.isFinite(total) || total <= 0) return '';
    var planned = Number(runQty);
    // Blank/'' input while a manager is mid-edit: still show the order total,
    // just without a subset claim we can't back up yet.
    if (!Number.isFinite(planned) || planned <= 0) return total + ' garments on this order';
    // >= rather than ===: a planned count above the order total is bad data,
    // but "All N" is still the honest read and beats "350 of 300".
    if (planned >= total) return 'All ' + total + ' garments on this order';
    return planned + ' of ' + total + ' garments on this order';
  }
  function pivotItems(rec){
    var items = (rec.OrderItems && rec.OrderItems.records) || [];
    var bySize = {}, total = 0, garment = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var sz = (it.Size__c || '').toUpperCase(); var q = Number(it.Quantity) || 0;
      if (!sz) continue;
      bySize[sz] = (bySize[sz] || 0) + q; total += q;
      if (!garment && it.Product2 && it.Product2.Name) garment = text(it.Product2.Name) + (it.Color__c ? ' \u00b7 ' + text(it.Color__c) : '');
    }
    var keys = Object.keys(bySize).sort(function (a, b) {
      var ia = SIZE_ORDER.indexOf(a), ib = SIZE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return {
      qty: String(total),
      garment: garment || '\u2014',
      sizes: keys.map(function (k) { return k + bySize[k]; }).join(' \u00b7 '),
      sizeCells: keys.map(function (k) { return { label:k, qty:String(bySize[k]) }; })
    };
  }

  // Placement__c picklist values. MUST match Salesforce (Setup -> Object
  // Manager -> Production Method -> Fields -> Placement) and the server-side
  // ALLOWED_PLACEMENTS in functions/api/production-methods/index.js -- all
  // three copies have to move together if the shop adds a new print location.
  var PLACEMENTS = [
    'Front', 'Back', 'Left Sleeve', 'Right Sleeve',
    'Left Chest', 'Right Chest', 'Full Front', 'Full Back',
    'Tag', 'Hood', 'Pocket'
  ];

  window.CAApi = {
    VALID_NAMES: VALID_NAMES, ROLE_KEY: ROLE_KEY, NAME_KEY: NAME_KEY, STATION_NAME_KEY: STATION_NAME_KEY, role: role, workerName: workerName, anyWorkerName: anyWorkerName, setRole: setRole, setWorkerName: setWorkerName, setIdentity: setIdentity, clearIdentity: clearIdentity, endServerSession: endServerSession, readParam: readParam, writeParams: writeParams, logout: logout, isManager: isManager, isAdmin: isAdmin, canAccessManagement: canAccessManagement, confirmManager: confirmManager, MANAGER_NAMES: MANAGER_NAMES, workerLogin: workerLogin,
    SUBSTATUS_VALUE: SUBSTATUS_VALUE, SUBSTATUS_LABEL: SUBSTATUS_LABEL, STAGE_KEY: STAGE_KEY, STAGE_SUBSTATUS: STAGE_SUBSTATUS, stageOf: stageOf, stageOfMethod: stageOfMethod,
    DELIVERY_LABEL: DELIVERY_LABEL, DELIVERY_METHODS: DELIVERY_METHODS, formatAddress: formatAddress,
    NAV_BOARDS: NAV_BOARDS, buildNavBoards: buildNavBoards,
    getShippingOrders: getShippingOrders, completeOrder: completeOrder, getStatsTrend: getStatsTrend,
    CHECK_FIELD: CHECK_FIELD, RECV_FROM_SF: RECV_FROM_SF, RECV_TO_SF: RECV_TO_SF, TIME_OPTIONS: TIME_OPTIONS,
    PLACEMENTS: PLACEMENTS, methodsList: methodsList, METHOD_META: METHOD_META,
    getOrders: getOrders, getProductionOrders: getProductionOrders, getInbox: getInbox, getPreProductionItems: getPreProductionItems, patchItem: patchItem, deleteItem: deleteItem, createItem: createItem, searchPlans: searchPlans, searchPresses: searchPresses, createMethod: createMethod, createProductionRun: createProductionRun, getProductionRuns: getProductionRuns, patchProductionRun: patchProductionRun, deleteProductionRun: deleteProductionRun, getProposedRuns: getProposedRuns, patchProposedRun: patchProposedRun, patchMethodStatus: patchMethodStatus, patchMethodChecklist: patchMethodChecklist, getMethodsForOrder: getMethodsForOrder, patchMethodFields: patchMethodFields, deleteMethod: deleteMethod, patchOrder: patchOrder, getOrderSizes: getOrderSizes, createReprintOrder: createReprintOrder,
    getCountableRuns: getCountableRuns, getRunResults: getRunResults, submitRunResults: submitRunResults,
    getPackaging: getPackaging, postPackaging: postPackaging, deletePackaging: deletePackaging,
    getShipments: getShipments, postShipment: postShipment, deleteShipment: deleteShipment, getZkWizardUrl: getZkWizardUrl,
    splitShipment: splitShipment, combineShipment: combineShipment,
    getSfEnv: getSfEnv, setSfEnv: setSfEnv,
    getStationItems: getStationItems, updateItemStatus: updateItemStatus, updateOrderReceiving: updateOrderReceiving,
    getInventory: getInventory, postInventory: postInventory, stationLogin: stationLogin,
    SIZE_ORDER: SIZE_ORDER, text: text, initials: initials, colorForName: colorForName, methodOf: methodOf, dueInfo: dueInfo, parseSfDate: parseSfDate, pivotItems: pivotItems, runQtyHint: runQtyHint,
    backgroundLoad: backgroundLoad, foregroundLoad: foregroundLoad,
    trackRequest: trackRequest, hideLoader: hideLoader, showLoaderNow: showLoaderNow,
    STATUS_HELP: STATUS_HELP, statusHelp: statusHelp,
    locationAvailable: locationAvailable, locationsForMethod: locationsForMethod,
    openLightbox: openLightbox, closeLightbox: closeLightbox, mockupClick: mockupClick,
    roundToQuarterHour: roundToQuarterHour,
    prepBufferStats: prepBufferStats, PREP_STATUS_META: PREP_STATUS_META,
    URG_ICON: URG_ICON, urgCardStyle: urgCardStyle
  };
})();
