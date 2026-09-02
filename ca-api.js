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
  /* The shared manager PIN used to live here as a literal, shipped in
     view-source to every tablet. It is gone: confirmManager() below now asks
     the SERVER to check a PERSONAL PIN against WORKER_PINS. The client holds no
     secret at all. */
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
  /* ── manager confirmation (server-checked as of 2026-08-28) ──
     RETURNS A PROMISE. Every call site must await it:

         if (!(await api.confirmManager('Removing a production run'))) return;

     Getting that wrong is silent and total: `!somePromise` is always false, so
     an un-awaited guard never returns early and the destructive action runs
     with no confirmation while looking perfectly healthy in testing. If you add
     a call site, grep the identifier afterwards and check every one is awaited.

     Two things changed from the old client-side version:

     1. No PIN in the browser. The typed PIN goes to /api/worker-login, which
        checks it against WORKER_PINS server-side and answers {name, role}.
        workerLogin() deliberately does NOT write identity (login.html does that
        itself), so confirming here never changes who is signed in.

     2. An elevated stored role no longer skips the prompt. The old version
        opened with `if (isManager()) return true`, so a tablet left signed in
        as a manager -- the exact shared-tablet case the confirmation exists
        for -- was never asked for anything. It always prompts now.

     Any manager's own PIN works regardless of who is signed in, so a manager
     can authorise in place instead of the worker switching user first.

     KNOWN SIDE EFFECT: /api/worker-login also issues the signed ca_sess cookie,
     so a successful confirmation leaves the tablet's SERVER session as that
     manager. That is inert today (requireCap is report-only unless
     ACCESS_ENFORCE=1) and arguably right -- the write being authorised is the
     manager's -- but it needs a decision before enforcement is switched on. */
  function confirmManager(actionLabel){
    var entered = window.prompt(
      (actionLabel || 'This action') + ' needs a manager PIN.\n\n' +
      'Anthony, Gian or Parker can enter their own PIN — whoever is signed in on this tablet.'
    );
    if (entered == null) return Promise.resolve(false);          // cancelled
    entered = String(entered).trim();
    if (!entered) return Promise.resolve(false);
    return workerLogin(entered).then(function (who) {
      var r = who && who.role;
      if (r === 'manager' || r === 'admin') return true;
      window.alert('That PIN belongs to ' + ((who && who.name) || 'a worker') +
                   ', who is not a manager. Ask Anthony, Gian or Parker.');
      return false;
    }).catch(function (e) {
      /* Fail CLOSED, and say which kind of failure it was. A confirmation that
         could not be checked is not a confirmation. */
      if (e && e.status === 401) window.alert('That PIN was not recognised.');
      else window.alert('Could not check that PIN — no answer from the server. Nothing was changed.');
      return false;
    });
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

  /* Shipping_Delivery__c's label/value trap is documented on DELIVERY_LABEL
     below, next to the data itself. */
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
    // Run Results (2026-08-27). The press-side tablet board -- the first surface
    // in this app that lives at the press rather than before or after it. Not
    // folded into station.html because that board is pre-production only (ink,
    // screens, transfers, receiving) and counting is the opposite end of the
    // job. Deliberately visible to everyone: the press operator who ran the job
    // is the person who should be counting it, and gating this behind a manager
    // role is exactly how the numbers end up being typed second-hand off a run
    // sheet the next morning, which is what the whole model exists to stop.
    { key:'counting', label:'Run Results', sub:'Record results · misprints · shortfalls', href:'counting.html', color:'#C9923A', icon:'ti-clipboard-list' },
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
  /* ── Shipping_Delivery__c ("Delivery Method" in Setup) ────────────────
     THE TRAP, and the one place it is written down: the picklist entry shown
     on screen as "Local Dropoff" is STORED as "Delivery". Label and value do
     not match, exactly like Order_Substatus__c's "In Production"/"Production"
     pair above. Confirmed live in Setup (Object Manager -> Order -> Fields)
     2026-08-10; the same finding is recorded in
     functions/api/shipping-orders/index.js's header.

     There are FIVE methods, and "Local Dropoff" is NOT one of the five stored
     values -- it is what "Delivery" is called on screen. The field is a
     RESTRICTED picklist, so writing the literal "Local Dropoff" does not
     quietly store a wrong value: Salesforce rejects the PATCH with
     INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST and the save fails. Until
     2026-08-28 index.html's drawer offered "Local Dropoff" and "Delivery" as
     two separate options, so picking the first one -- the one that reads
     correctly to a human -- was the one that could not save.

     DELIVERY_METHODS is the stored-value list, in the tab order
     shipping.html uses. DELIVERY_LABEL is the ONLY map from a stored value to
     what a human should see; every board renders through it (see
     deliveryOptions() below, shipping.html's tabDefs/methodLabel). Never
     hand-write a delivery option list anywhere else. */
  var DELIVERY_METHODS = ['Shipping', 'Delivery', 'Pickup', 'Split Ship', 'Order Fulfillment'];
  var DELIVERY_LABEL = { 'Shipping':'Shipping', 'Delivery':'Local Dropoff', 'Pickup':'Pick-up', 'Split Ship':'Split Ship', 'Order Fulfillment':'Order Fulfillment' };
  /* Options for a delivery-method <select>: one entry per STORED value,
     labelled through DELIVERY_LABEL. Exists so no board can grow its own copy
     of the list and reintroduce the label-as-value bug. */
  function deliveryOptions(blankLabel){
    var out = blankLabel == null ? [] : [{ value:'', label:blankLabel }];
    return out.concat(DELIVERY_METHODS.map(function (v) {
      return { value:v, label:(DELIVERY_LABEL[v] || v) };
    }));
  }
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
  /* Turn a failed Response into an Error carrying the server's own words.
     Every endpoint here answers {error, detail, ...} on failure (see
     jsonError in functions/api/_sf.js, and production-methods' richer
     {error, failedRef, detail, all}), and until 2026-08-31 only jsend() read
     it -- jget and jdel threw a bare 'GET /api/x -> 500' with no status and no
     body, so a caller could not tell a 401 from a 502 from an FLS gap, and the
     boards' catch blocks had nothing to show but a generic string.

     Best-effort on purpose: a non-JSON body (an HTML error page from the edge,
     an empty 502) must not turn into a parse exception on top of the failure
     being reported. */
  function httpError(method, url, r){
    return r.json().catch(function () { return null; }).then(function (data) {
      var err = new Error(method + ' ' + url + ' -> ' + r.status);
      err.status = r.status;
      err.data = data;
      // The most specific human-usable string the server gave us, if any.
      err.detail = (data && (data.detail || data.error)) || '';
      throw err;
    });
  }
  /* ── demo-mode recovery (2026-08-31) ────────────────────────────────
     Every board's auto-refresh used to be gated on `connection === 'live'`,
     which meant the refresh that would RESTORE a board was itself unreachable
     the moment that board fell back to demo. One failed query and the tablet
     showed plausible fake numbers behind an amber chip until a human noticed
     and reloaded -- and nobody reloads a wall-mounted tablet.

     shouldPoll() replaces that gate. Live boards poll every tick as before;
     a board sitting in demo retries every DEMO_RETRY_EVERY-th tick instead of
     never. Slower on purpose: the API being down is the common reason to be in
     demo, and hammering it from six boards helps nobody.

     `key` just namespaces the tick counter so two boards (or two intervals on
     one board) don't share one. Callers keep their own "is a drawer open"
     guards -- this only answers "may I talk to the server right now". */
  var DEMO_RETRY_EVERY = 5;
  var _pollTicks = {};
  function shouldPoll(connection, key){
    if (connection === 'live') return true;
    if (connection !== 'demo') return false;          // 'loading' -- first load is still in flight
    var k = key || 'default';
    _pollTicks[k] = (_pollTicks[k] || 0) + 1;
    return _pollTicks[k] % DEMO_RETRY_EVERY === 0;
  }

  /* ── telling the worker a write did not happen (2026-08-31, E4.3) ─────
     THE PROBLEM this exists to solve: ~20 write paths across the boards ran
     their optimistic local update and then either skipped the server call
     (`if (connection === 'live')`) or swallowed its failure (`.catch(()=>{})`).
     Both look identical on screen to a save that worked. A worker taps, the
     tile moves, and Salesforce never hears about it -- and because a board
     falls back to demo silently, "not live" is a state a tablet can be in for
     hours without anyone noticing.

     The reason every board swallowed is that there was nowhere to PUT the
     news: alert() is modal and unusable for a background save, and no board
     had a notification surface. So this module owns one, the same way it
     already owns the loading overlay.

     Deliberately NOT alert(): these fire from debounced background saves, and
     a modal dialog on every keystroke's failed autosave would be worse than
     the silence it replaces. */
  var TOAST_MS = { info: 4000, warn: 7000, error: 11000 };
  var _toastEl = null, _toasts = {};
  function toastCss(){
    return '.ca-toasts{position:fixed;z-index:2147483000;left:50%;transform:translateX(-50%);bottom:22px;'
      + 'display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:min(560px,92vw)}'
      + '.ca-toast{pointer-events:none;display:flex;align-items:flex-start;gap:9px;font:500 13px/1.45 Archivo,system-ui,sans-serif;'
      + 'border-radius:11px;padding:12px 15px;box-shadow:0 18px 40px -14px rgba(0,0,0,.75);border:1px solid;'
      + 'animation:ca-toast-in .16s ease}'
      + '.ca-toast-info{background:#101013;border-color:#2a2a2f;color:#ECEAE4}'
      + '.ca-toast-warn{background:#241a09;border-color:#5E4214;color:#E0B870}'
      + '.ca-toast-error{background:#2A100D;border-color:#7A241C;color:#E8A89F}'
      + '.ca-toast-x{pointer-events:auto;margin-left:6px;background:none;border:0;color:inherit;opacity:.6;cursor:pointer;font-size:15px;line-height:1}'
      + '@keyframes ca-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}';
  }
  function toastHost(){
    if (typeof document === 'undefined' || !document.body) return null;
    if (_toastEl && _toastEl.parentNode) return _toastEl;
    if (!document.getElementById('ca-toast-style')) {
      var st = document.createElement('style');
      st.id = 'ca-toast-style'; st.textContent = toastCss();
      document.head.appendChild(st);
    }
    var host = document.createElement('div');
    host.className = 'ca-toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
    _toastEl = host;
    return host;
  }
  /* Deduped by message text: a debounced autosave that fails on every keystroke
     must not stack forty identical strips down the screen -- the repeat just
     restarts the existing one's timer. */
  function toast(kind, message){
    var msg = String(message == null ? '' : message).trim();
    if (!msg) return;
    var host = toastHost();
    if (!host) return;
    var k = (kind === 'error' || kind === 'warn') ? kind : 'info';
    var existing = _toasts[msg];
    if (existing && existing.el.parentNode) {
      clearTimeout(existing.timer);
      existing.timer = setTimeout(function () { dismissToast(msg); }, TOAST_MS[k]);
      return;
    }
    var el = document.createElement('div');
    el.className = 'ca-toast ca-toast-' + k;
    var span = document.createElement('span');
    span.textContent = msg;
    el.appendChild(span);
    var x = document.createElement('button');
    x.className = 'ca-toast-x'; x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.textContent = '×';
    x.onclick = function () { dismissToast(msg); };
    el.appendChild(x);
    host.appendChild(el);
    _toasts[msg] = { el: el, timer: setTimeout(function () { dismissToast(msg); }, TOAST_MS[k]) };
  }
  function dismissToast(msg){
    var t = _toasts[msg];
    if (!t) return;
    clearTimeout(t.timer);
    if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
    delete _toasts[msg];
  }

  /* The most useful human string we can get out of a failed write. Reads the
     `detail` httpError() attaches (see jget/jsend/jdel above) before falling
     back to the bare message. */
  function errText(e){
    if (!e) return '';
    if (e.detail) return String(e.detail);
    if (e.data && (e.data.detail || e.data.error)) return String(e.data.detail || e.data.error);
    if (e.status) return 'server returned ' + e.status;
    return e.message ? String(e.message) : '';
  }

  /* May this board write to Salesforce right now? The single decision point --
     boards used to inline `this._api && this.state.connection === 'live'` and
     then just return, which is the silent half of the bug. Callers should say
     something when this is false; reportBlockedWrite() is the standard way. */
  /* ── loading vs empty vs error, told apart (E4.5) ──────────────────────
     Every board computed its empty state as `count === 0` and nothing else,
     so the FIRST PAINT of every board -- before a single row had arrived --
     asserted the board was empty. shipping.html said "Nothing in
     Post-Production for this view -- the shop floor is caught up." while it
     was still fetching. index.html and pre-production.html said "No orders --
     drag one here" in every column. That is not a missing spinner; it is the
     app making a confident, false statement about the shop, in the same words
     it uses when the statement is true.

     Three states, and they have to look different:

       loading  the answer is not known yet. Say nothing ABOUT THE WORK --
                no counts, no "caught up", no "nothing here".
       error    the fetch failed and what is on screen is demo fixtures. The
                amber chip already says so; this says it where the rows would
                have been, because that is where someone is looking.
       empty    genuinely nothing, and the copy says WHAT WOULD PUT SOMETHING
                HERE. An empty board that does not explain itself is
                indistinguishable from a broken one.

     `ready` means there are rows and no notice belongs on screen at all.

     Demo counts as `error` on purpose. A board only falls back to demo when
     its fetch failed (see the demo-recovery note above), so "these are not
     your numbers" is the honest reading even when the fixtures are non-empty. */
  function listState(connection, count){
    if (connection === 'loading') return 'loading';
    if (connection === 'demo') return 'error';
    return (Number(count) > 0) ? 'ready' : 'empty';
  }
  /* The generic half of the notice. The `empty` case deliberately carries NO
     copy of its own -- only the board knows what would put something in it,
     and a generic "nothing here" is precisely what this story exists to
     remove. Callers pass their own sentence. */
  function listNotice(state, emptyMsg){
    if (state === 'loading') return 'Loading…';
    if (state === 'error') return 'Could not reach Salesforce — showing demo data. Do not work from these numbers.';
    if (state === 'empty') return emptyMsg || '';
    return '';
  }

  function canWrite(connection){ return connection === 'live'; }
  function reportBlockedWrite(what){
    toast('warn', (what ? what + ': ' : '') + 'not saved — this board is on demo data, not connected to Salesforce.');
  }
  /* Standard failure report for a write that DID reach the server and lost.
     `what` names the action in the worker's words, not the endpoint's. */
  function reportFailedWrite(what, e){
    var d = errText(e);
    toast('error', (what || 'That change') + ' was NOT saved' + (d ? ' — ' + d : '') + '.');
  }

  function jget(url){
    return trackRequest(fetch(url, { headers: { Accept:'application/json' } }).then(function (r) {
      if (!r.ok) return httpError('GET', url, r);
      return r.json();
    }));
  }
  function jsend(url, method, body){
    return trackRequest(fetch(url, { method: method, headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) {
      // FIXED 2026-07-28: this used to throw a bare "POST /api/x -> 502" Error
      // and never touch the response body, so callers (e.g. pre-production's
      // Create Production Plan handler) had no way to show the real Salesforce
      // error. Extracted to httpError() on 2026-08-31 and shared with jget/jdel,
      // which still had the original bug.
      if (!r.ok && r.status !== 204) return httpError(method, url, r);
      return r.status === 204 ? null : r.json().catch(function () { return null; });
    }));
  }
  function jdel(url){
    return trackRequest(fetch(url, { method: 'DELETE' }).then(function (r) {
      if (!r.ok && r.status !== 204) return httpError('DELETE', url, r);
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
  // createReprintOrder REMOVED 2026-08-27, along with the "Production Error"
  // modal in index.html and functions/api/orders/[id]/reprint.js. Reprints are
  // now built automatically from the counts a press operator enters on
  // counting.html -- see functions/api/_rework.js.
  //
  // Not a cleanup: the two paths could not coexist. Both linked the child order
  // back with Original_Production_Order__c, which is what the automation's
  // idempotency guard checks, so a manual reprint permanently and silently
  // blocked the automatic one on that order -- and because nothing records
  // WHICH damage a reprint covered, the guard could not be taught to tell them
  // apart without risking a double order of real garments.

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
  /* ── the run allocation grid (E1.3) ───────────────────────────────────
     Which sizes of the parent order a run is printing, and how many.

     getRunLineItems() returns the run's own rows PLUS `allocatedElsewhere` --
     what the OTHER runs on the same method have already committed per
     OrderItem, computed as planned MINUS incomplete exactly the way the
     skeleton Flow computes it. Pair it with getOrderSizes() (the OrderItem
     quantities) to show what is left for a size:

         remaining = orderQty - allocatedElsewhere

     The endpoint does NOT return the OrderItem rows itself -- the drawer
     already fetches them, and a second copy of that SELECT is a second place
     to get the field list wrong.

     patchRunLineItems() writes Planned_Qty__c and nothing else. Note what is
     NOT here: any way to delete a row. Un-allocating a size is
     `plannedQty: 0`. See CLAUDE.md rule 10 -- the skeleton Flow's only guard
     is "does this run have any rows", so emptying a run makes it regenerate
     the whole skeleton on that run's next save and silently overwrite the
     manager. Nor is there a setter for the three count fields: those belong to
     the person counting (/api/run-results), not the manager allocating.

     Both throw via jget/jsend on a non-2xx, so the caller sees a real reason
     (err.status / err.detail) -- over-allocation comes back 409 with a message
     naming the size and the remainder. */
  function getRunLineItems(runId){ return jget('/api/run-line-items?runId=' + encodeURIComponent(runId)); }
  /* Just `methodCommitted` -- how many garments every run on this method has
     committed between them (planned minus incomplete). Subtract it from the
     order's own garment total and you have what is still unallocated, which is
     what runQtyHint's third argument wants. Separate from getRunLineItems
     because the New Run form needs the number BEFORE a run exists to ask
     about. */
  function getMethodAllocation(methodId){ return jget('/api/run-line-items?methodId=' + encodeURIComponent(methodId)); }
  function patchRunLineItems(runId, updates){ return jsend('/api/run-line-items', 'PATCH', { runId: runId, updates: updates }); }

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

  /* ── mockup thumbnails ──
     Build the <img> as a React node instead of putting its URL in a template
     hole.

     WHY (2026-08-27): the <x-dc> template is ordinary HTML sitting in the
     document, so the BROWSER parses it before dc-runtime ever runs. An
     <img src="{{o.mockupUrl}}"> therefore issues a real request for the literal
     path /%7B%7Bo.mockupUrl%7D%7D on every single page load. Cloudflare Pages
     answers that with the SPA fallback -- HTTP 200 and the whole ~188KB page,
     downloaded as an "image" and thrown away. It is not an image, so the load
     fails, which fires the inline onError attribute, whose literal text
     `{{ o.onThumbErr }}` is then evaluated as JavaScript and throws
     `ReferenceError: o is not defined` into the console. Every load, every
     board, on tablets over shop wifi.

     Neither symptom affects the rendered card: React receives a proper onError
     prop and the "no mockup" fallback works correctly. The cost is a wasted
     page-sized download and a console error that looks like a real bug and is
     not -- it sent this project chasing the wrong thing twice.

     Building the node here keeps the URL out of the parsed template entirely.
     index.html:1974 and station.html already used React.createElement for their
     larger mockups, which is very likely why neither ever produced this error.

     When onClick is given the node also gets a hover brightness bump, replacing
     the style-hover pseudo-attribute the template version used. */
  function mockupThumb(url, style, onError, onClick, alt){
    if (!url || typeof React === 'undefined') return null;
    var props = { src: url, alt: alt || '', style: Object.assign({}, style || {}) };
    if (onError) props.onError = onError;
    if (onClick) {
      props.onClick = onClick;
      props.style.cursor = 'zoom-in';
      props.onMouseEnter = function (e) { e.currentTarget.style.filter = 'brightness(1.12)'; };
      props.onMouseLeave = function (e) { e.currentTarget.style.filter = ''; };
    }
    return React.createElement('img', props);
  }
  // The two thumbnail sizes in use, so four call sites can't drift apart.
  var THUMB_CARD = { width:64, height:'auto', alignSelf:'stretch', objectFit:'cover', flexShrink:0, background:'#121215', borderRight:'1px solid #202024' };
  var THUMB_PANEL = { width:96, height:96, flexShrink:0, borderRadius:11, border:'1px solid #232327', objectFit:'cover', background:'#121215' };

  // Runs that finished with garments that never reached the press -- the
  // manager-facing half of the incomplete alert. Returns the whole envelope:
  //   { available, records, byMethod:{methodId:qty}, byOrder:{orderId:qty}, totalOutstanding }
  // `byMethod` / `byOrder` are pre-summed and already filtered to OUTSTANDING
  // shortfalls, so a board renders a badge with a single lookup and no grouping.
  //
  // "Outstanding" is derived, not stored: a shortfall stops counting once a
  // later run exists on the same method. See functions/api/shortfalls/index.js
  // for why, and for the assumption that carries.
  //
  // Boards should call this in the BACKGROUND and ignore failures. It is
  // deliberately separate from the main board query so that an org without the
  // production-result fields loses a badge rather than a whole screen.
  function getShortfalls(){ return jget('/api/shortfalls'); }

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
  /* `missing` is the Partial count-in note. It is OMITTED from the body unless
     the caller passes a string, and that distinction is load-bearing: the old
     `missing: missing || ''` sent the key on every call, so the endpoint wrote
     '' over whatever was in Salesforce every time a worker tapped Partial --
     erasing a note somebody had typed in Salesforce itself. Absent now means
     "leave it alone"; a string (including '') means "write exactly this", which
     is what the station's own Missing Items box sends when it saves. */
  function updateOrderReceiving(orderId, status, missing){
    var body = { station:'garment', orderId: orderId, status: status, by: workerName() };
    if (typeof missing === 'string') body.missing = missing;
    return jsend('/api/update-order-receiving', 'POST', body);
  }
  function getInventory(type){ return jget('/api/inventory?type=' + encodeURIComponent(type)).then(function (d) { return d.items || []; }); }
  function postInventory(type, items){ return jsend('/api/inventory', 'POST', { type: type, items: items }); }

  /* ── production run rows (E10.1, 2026-08-31) ──────────────────────────
     The Production Runs row is rendered by index.html AND pre-production.html,
     and both boards had their own private copy of every piece of it: the
     record mapping, the edit-buffer shape, the date splitting/joining, and the
     schedule-status wording. That is what this module ends.

     It had already drifted, which is why the story existed:
       - `schedStatus` was mapped on pre-production and NOT on index, so the
         production dashboard could not tell a published run from one whose
         calendar publish had failed -- even though production-runs/index.js's
         own comment says "every board reads it ... to warn when a run never
         made it onto the calendar". It didn't.
       - The status wording itself existed in THREE places (twice inside
         pre-production.html alone), which is three chances to disagree about
         what 'Planned' means.
     Q2 was the same failure in a different function (saveMethodEdit).

     These are all PURE. The boards keep their own setState handlers -- what
     they no longer keep is their own idea of the shape. */

  /** One Production_Run__c record from /api/production-runs -> the local shape
   *  both boards' state and view models are written against. */
  function runRecordFromApi(r){
    r = r || {};
    return {
      id: r.Id, name: r.Name,
      pressId: r.Press__c || null,
      pressName: (r.Press__r && r.Press__r.Name) || '',
      scheduledStart: r.Scheduled_Start__c || null,
      scheduledEnd: r.Scheduled_End__c || null,
      actualStart: r.Actual_Start__c || null,
      actualEnd: r.Actual_End__c || null,
      qty: r.Quantity_Planned_c__c != null ? r.Quantity_Planned_c__c : null,
      /* Print_Location__c comes back null both when the run has no location
         and when the org doesn't have the field -- the row treats the two
         identically, so neither needs its own branch. */
      printLocation: r.Print_Location__c || '',
      /* The calendar publish state. Selected by the endpoint since 2026-08-19;
         only pre-production.html used to map it. */
      schedStatus: r.Auto_Scheduling_Status__c || null,
      lastModifiedDate: r.LastModifiedDate || null,
    };
  }

  /** Split an ISO datetime into the {date,time} pair <input type=date> and
   *  <input type=time> need. Local-time components on both sides of the round
   *  trip, so this always matches what buildRunDateTime() rebuilds. */
  function splitDT(iso){
    if (!iso) return { date:'', time:'' };
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { date:'', time:'' };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return {
      date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      time: pad(d.getHours()) + ':' + pad(d.getMinutes()),
    };
  }

  /** The inverse: a date+time pair (both browser-local) -> the ISO string
   *  Salesforce expects. null when either half is missing/unparseable. */
  function buildRunDateTime(dateStr, timeStr){
    if (!dateStr || !timeStr) return null;
    var d = new Date(dateStr + 'T' + timeStr + ':00');
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  /** A mapped run -> the editable form buffer a run row diverges into as a
   *  manager types, until Save writes it back. */
  function runEditFieldsFromRecord(r){
    r = r || {};
    var ss = splitDT(r.scheduledStart), se = splitDT(r.scheduledEnd);
    var as = splitDT(r.actualStart), ae = splitDT(r.actualEnd);
    return {
      pressId: r.pressId || null, pressName: r.pressName || '', pressQ: r.pressName || '',
      startDate: ss.date, startTime: ss.time, endDate: se.date, endTime: se.time,
      actualStartDate: as.date, actualStartTime: as.time,
      actualEndDate: ae.date, actualEndTime: ae.time,
      qty: r.qty != null ? String(r.qty) : '',
      printLocation: r.printLocation || '',
      /* Carried through so saveRunRow can send it back as ifUnmodifiedSince --
         see patchProductionRun above. */
      loadedAt: r.lastModifiedDate || null,
    };
  }

  /* ── the run allocation grid (E1.3) ───────────────────────────────────
     One pure function that turns the three inputs the grid needs -- the
     order's OrderItem rows, this run's line items, and what the other runs on
     the method have committed -- into rows ready to render. Lives here because
     index.html and pre-production.html both render run rows, and W5 was the
     story about these two boards keeping private copies of the same shape.

     `edits` is the manager's in-progress typing, keyed by LINE id, values as
     STRINGS so a field can be emptied while it is being retyped. A size with
     no edit falls back to what Salesforce holds.

     remaining = orderQty - committedElsewhere, where committedElsewhere is
     planned MINUS incomplete across every OTHER run on the method -- the
     skeleton Flow's own arithmetic, so the grid and the Flow can never
     disagree about what is left. An incomplete garment was planned but never
     reached the press, so it gives its capacity back. */
  function runAllocRows(orderItems, lines, allocatedElsewhere, edits){
    edits = edits || {};
    var elsewhere = {};
    (allocatedElsewhere || []).forEach(function (a) { elsewhere[a.orderProductId] = Number(a.qty) || 0; });
    var lineByOp = {};
    (lines || []).forEach(function (l) { if (l.orderProductId) lineByOp[l.orderProductId] = l; });

    var rows = (orderItems || [])
      // A row with no Size__c is a non-garment line (a setup fee, a rush
      // charge) -- order-sizes returns them intact and the front end keeps
      // them out of the grid. Same rule the drawer's size breakdown uses.
      .filter(function (it) { return it && it.Id && it.Size__c; })
      .map(function (it) {
        var line = lineByOp[it.Id] || null;
        var orderQty = Number(it.Quantity) || 0;
        var committed = elsewhere[it.Id] || 0;
        var remaining = orderQty - committed;
        var saved = line && line.plannedQty != null ? Number(line.plannedQty) : 0;
        var raw = (line && Object.prototype.hasOwnProperty.call(edits, line.id))
          ? edits[line.id]
          : (line && line.plannedQty != null ? String(line.plannedQty) : '');
        var typed = String(raw === null || raw === undefined ? '' : raw).trim();
        var value = typed === '' ? 0 : Number(typed);
        var bad = typed !== '' && (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value);
        var over = !bad && value > remaining;
        return {
          orderProductId: it.Id,
          lineId: line ? line.id : null,
          /* No line item for this size. The skeleton Flow creates one per
             OrderItem, so this means the run predates the Flow or the product
             was added to the order afterwards. Shown, but not editable -- the
             app deliberately has no create path (see run-line-items' header). */
          missing: !line,
          label: [it.Size__c, it.Color__c].filter(Boolean).join(' · '),
          size: it.Size__c, color: it.Color__c || '',
          orderQty: orderQty,
          committedElsewhere: committed,
          remaining: remaining,
          saved: saved,
          raw: typed,
          value: bad ? saved : value,
          bad: bad,
          over: over,
          /* Named and numbered, so the refusal is actionable at the press. The
             server refuses this too -- this is the fast copy, not the only
             one. */
          message: bad ? 'Whole numbers only.'
                 : over ? ('Only ' + remaining + ' left for ' + (it.Size__c || 'this size') +
                           ' — ' + orderQty + ' ordered, ' + committed + ' planned on other runs.')
                 : '',
          dirty: !!line && !bad && value !== saved,
        };
      });

    rows.sort(function (a, b) {
      var ia = SIZE_ORDER.indexOf(a.size), ib = SIZE_ORDER.indexOf(b.size);
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return String(a.color).localeCompare(String(b.color));
    });
    return rows;
  }

  /** The run's total. DERIVED from the grid, never typed -- see D3. */
  function runAllocTotal(rows){
    return (rows || []).reduce(function (a, r) { return a + (r.bad ? r.saved : r.value); }, 0);
  }

  /** Only the rows that actually changed, in the shape the PATCH wants. */
  function runAllocUpdates(rows){
    return (rows || [])
      .filter(function (r) { return r.dirty && r.lineId && !r.bad && !r.over; })
      .map(function (r) { return { id: r.lineId, plannedQty: r.value }; });
  }

  /** Anything the grid must refuse before it will save. */
  function runAllocBlockers(rows){
    return (rows || []).filter(function (r) { return r.bad || r.over; });
  }

  /** What is TRUE of this run's place on the shop calendar, in one vocabulary
   *  shared by every surface that shows a run.
   *
   *  'Planned' means the publish FAILED, not that someone still has to act --
   *  runs publish at creation now, so notPublished drives a warning rather
   *  than a button. See functions/api/_run-schedule-status.js. */
  function runScheduleStatus(schedStatus){
    var published = schedStatus === 'Confirmed';
    return {
      published: published,
      notPublished: !published,
      label: published ? 'On the shop calendar'
           : schedStatus === 'Planned' ? 'Not on the shop calendar — publishing failed'
           : 'Suggested by the auto-scheduler — it may move again',
      color: published ? '#9878C0' : '#6C665C',
    };
  }

  /* ── mapping helpers ── */
  var SIZE_ORDER = ['YXS','YS','YM','YL','YXL','OS','XS','S','M','L','XL','2XL','3XL','4XL','5XL'];
  var WORKER_COLORS = ['#C6372B','#5E9B9A','#C9923A','#7FA644','#8E6FB0','#3E7CB1'];

  /* Strip markup out of a Salesforce value and return the visible text.
   *
   * EVERY formula field on every board comes through here -- trap 6 in
   * CLAUDE.md. GOA_Order_Number__c and Customer_Order_Name__c are HYPERLINK()
   * formulas and arrive as `<a href="/801ca...">20484-3</a>`, so without this
   * the boards render the anchor tag as visible text. That has shipped as a
   * visible bug twice.
   *
   * WHY NOT innerHTML (E6.7). This used to build a detached <div> and assign
   * s to its innerHTML. A detached element does not run <script>, which is
   * presumably why it looked safe -- but it DOES load resources, so
   * `<img src=x onerror=...>` fires the handler anyway. Measured in Chrome
   * against this very function, not assumed: the payload executed.
   *
   * The input is Salesforce rich text, which means it is whatever somebody
   * typed into a Salesforce field. Nothing between that field and this line
   * sanitises it.
   *
   * DOMParser builds an INERT document: no scripts, no resource loads, no
   * handlers. Same parser, same entity handling, same textContent -- verified
   * to produce byte-identical output to the old version across every real
   * input shape, including both HYPERLINK formulas, nested tags, entities,
   * <br>, multi-paragraph rich text and the whitespace collapsing below.
   * Do not "improve" the entity or spacing behaviour here; the boards depend
   * on the current strings. */
  function text(v){
    if (v == null) return '';
    var s = String(v);
    if (s.indexOf('<') >= 0) {
      var doc = new DOMParser().parseFromString(s, 'text/html');
      s = (doc.body && doc.body.textContent) || '';
    }
    return s.replace(/\s+/g, ' ').trim();
  }
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
  /* Which print method an order probably needs -- AND HOW SURE WE ARE. (E3.3)
   *
   * There is no field on Order that says. This reads five weak signals and
   * guesses, which is fine as long as the guess is presented as a guess. It
   * was not: methodOf() below returned a bare 'sp' for "no idea" exactly as it
   * does for "the press is literally called Screen Print 1", and nothing
   * downstream could tell those apart. On the Begin Set-up form that means a
   * confident, wrong Screen Print sitting in a field the manager is about to
   * accept -- and a silent wrong guess prints the job wrong.
   *
   * The signal order is the original one and must stay that way: press name
   * first, then the prep checklist, because a press name is a statement about
   * this job and a checklist tick is a side effect of someone starting work.
   *
   * Returns { type, key, confident, from, reason }:
   *   type        'Screen Print' | 'Embroidery' | 'Heat Press', or null
   *   key         the short code the boards use, or null
   *   confident   true only when a signal actually matched
   *   from        the press name it read, so the UI can show its working
   *   reason      'press-name' | 'prep-checklist' | 'no-match' | 'no-press-name'
   *
   * WHICH SIGNALS ARE EVEN AVAILABLE DEPENDS ON THE CALLER. /api/orders returns
   * the four checklist fields; /api/inbox does NOT, so on the Begin Set-up form
   * only the press name can ever match and everything else lands on no-match.
   * That is not a bug to fix here -- it is why `reason` exists. */
  var METHOD_BY_KEY = { sp:'Screen Print', em:'Embroidery', hp:'Heat Press' };
  function methodGuess(rec){
    var r = rec || {};
    var name = (r.Printer__r && r.Printer__r.Name) || '';
    var p = String(name).toLowerCase();
    var hit = function (key, reason, from) {
      return { type: METHOD_BY_KEY[key], key: key, confident: true, from: from, reason: reason };
    };
    /* These patterns mirror PRESS_GROUPS in functions/api/_priority.js, which
       is the authority on which physical press runs which method. They were
       NOT aligned before, and the difference mattered:

         old heat pattern   /heat|transfer|dtf|vinyl|press/
                            ^^^^^ a bare "press"

       "Press 1" and "Press 2" are the shop's two SCREEN PRINT presses -- see
       PRESS_GROUPS, where press1/press2 carry methodTypes ["Screen Print"].
       The bare `press` matched them first, so the shop's two busiest presses
       were confidently classified Heat Press, and that is what the Method chip
       printed on the order sheet that goes to the floor.

       The server requires a qualifier -- (heat|hat|shirt)\s*press -- and so do
       we now. `press 1` / `press 2` / `10 head` / `6 head` are screen print,
       matching press1 and press2.

       This IS a second copy of a matching rule, which _priority.js warns
       against ("a second copy would drift the first time a press is renamed").
       The durable fix is for /api/inbox to return the group the server already
       computes, and let the browser stop guessing. Until then these two must be
       changed together -- and the equivalence test that caught this compares
       them, so a drift shows up. */
    if (/embroid|stitch|thread/.test(p)) return hit('em', 'press-name', name);
    if (/(heat|hat|shirt)\s*press|transfer|dtf|vinyl/.test(p)) return hit('hp', 'press-name', name);
    if (/screen|press\s*0*[12]\b|\b\d+\s*head\b|print/.test(p)) return hit('sp', 'press-name', name);
    if (r.Digitize_File__c || r.Thread_Color_Materials__c) return hit('em', 'prep-checklist', '');
    if (r.Transfers_Received__c || r.Transfers_Ready__c) return hit('hp', 'prep-checklist', '');
    return {
      type: null, key: null, confident: false, from: name,
      reason: String(name).trim() ? 'no-match' : 'no-press-name',
    };
  }
  /* The old shape, unchanged on purpose. order-sheet.html's Method chip wants a
     best guess for a printed reference and has always fallen back to Screen
     Print; keeping that here means E3.3 changes no existing behaviour anywhere,
     and only the new caller has to reason about confidence. One inference path,
     two views of it. */
  function methodOf(rec){ return methodGuess(rec).key || 'sp'; }
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
  /* `unallocated` (optional, E1.3) is what the ORDER still has spare across
     every run on this method -- orderTotal minus what all runs have committed,
     planned minus incomplete, the skeleton Flow's own arithmetic. Passing it
     turns "150 of 300" into "150 of 300 · 40 unallocated", which is the number
     a manager sizing the NEXT run actually needs; without it the hint is
     exactly as it was. Omitted, negative, or non-finite -> the original text,
     because a remainder we cannot compute must not read as zero spare. */
  function runQtyHint(runQty, orderTotal, unallocated){
    var total = Number(orderTotal);
    if (!Number.isFinite(total) || total <= 0) return '';
    var planned = Number(runQty);
    /* == null catches BOTH null and undefined before Number() gets a chance:
       Number(null) is 0, which would render an UNKNOWN remainder as "fully
       allocated" -- the one reading worse than saying nothing. */
    var spare = (unallocated == null) ? NaN : Number(unallocated);
    var tail = (Number.isFinite(spare) && spare >= 0)
      ? (spare === 0 ? ' · fully allocated' : ' · ' + spare + ' unallocated')
      : '';
    // Blank/'' input while a manager is mid-edit: still show the order total,
    // just without a subset claim we can't back up yet.
    if (!Number.isFinite(planned) || planned <= 0) return total + ' garments on this order' + tail;
    // >= rather than ===: a planned count above the order total is bad data,
    // but "All N" is still the honest read and beats "350 of 300".
    if (planned >= total) return 'All ' + total + ' garments on this order' + tail;
    return planned + ' of ' + total + ' garments on this order' + tail;
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
    DELIVERY_LABEL: DELIVERY_LABEL, DELIVERY_METHODS: DELIVERY_METHODS, deliveryOptions: deliveryOptions, shouldPoll: shouldPoll, formatAddress: formatAddress,
    runRecordFromApi: runRecordFromApi, runEditFieldsFromRecord: runEditFieldsFromRecord, runScheduleStatus: runScheduleStatus, splitDT: splitDT, buildRunDateTime: buildRunDateTime,
    runAllocRows: runAllocRows, runAllocTotal: runAllocTotal, runAllocUpdates: runAllocUpdates, runAllocBlockers: runAllocBlockers,
    NAV_BOARDS: NAV_BOARDS, buildNavBoards: buildNavBoards,
    getShippingOrders: getShippingOrders, completeOrder: completeOrder, getStatsTrend: getStatsTrend,
    CHECK_FIELD: CHECK_FIELD, RECV_FROM_SF: RECV_FROM_SF, RECV_TO_SF: RECV_TO_SF, TIME_OPTIONS: TIME_OPTIONS,
    PLACEMENTS: PLACEMENTS, methodsList: methodsList, METHOD_META: METHOD_META,
    getOrders: getOrders, getProductionOrders: getProductionOrders, getInbox: getInbox, getPreProductionItems: getPreProductionItems, patchItem: patchItem, deleteItem: deleteItem, createItem: createItem, searchPlans: searchPlans, searchPresses: searchPresses, createMethod: createMethod, createProductionRun: createProductionRun, getProductionRuns: getProductionRuns, patchProductionRun: patchProductionRun, deleteProductionRun: deleteProductionRun, getProposedRuns: getProposedRuns, patchProposedRun: patchProposedRun, patchMethodStatus: patchMethodStatus, patchMethodChecklist: patchMethodChecklist, getMethodsForOrder: getMethodsForOrder, patchMethodFields: patchMethodFields, deleteMethod: deleteMethod, patchOrder: patchOrder, getOrderSizes: getOrderSizes,
    getCountableRuns: getCountableRuns, getRunResults: getRunResults, submitRunResults: submitRunResults,
    getRunLineItems: getRunLineItems, getMethodAllocation: getMethodAllocation, patchRunLineItems: patchRunLineItems,
    getShortfalls: getShortfalls,
    mockupThumb: mockupThumb, THUMB_CARD: THUMB_CARD, THUMB_PANEL: THUMB_PANEL,
    getPackaging: getPackaging, postPackaging: postPackaging, deletePackaging: deletePackaging,
    getShipments: getShipments, postShipment: postShipment, deleteShipment: deleteShipment, getZkWizardUrl: getZkWizardUrl,
    splitShipment: splitShipment, combineShipment: combineShipment,
    getSfEnv: getSfEnv, setSfEnv: setSfEnv,
    getStationItems: getStationItems, updateItemStatus: updateItemStatus, updateOrderReceiving: updateOrderReceiving,
    getInventory: getInventory, postInventory: postInventory,
    methodGuess: methodGuess,
    SIZE_ORDER: SIZE_ORDER, text: text, initials: initials, colorForName: colorForName, methodOf: methodOf, dueInfo: dueInfo, parseSfDate: parseSfDate, pivotItems: pivotItems, runQtyHint: runQtyHint,
    backgroundLoad: backgroundLoad, foregroundLoad: foregroundLoad,
    toast: toast, errText: errText, canWrite: canWrite, reportBlockedWrite: reportBlockedWrite, reportFailedWrite: reportFailedWrite,
    listState: listState, listNotice: listNotice,
    trackRequest: trackRequest, hideLoader: hideLoader, showLoaderNow: showLoaderNow,
    STATUS_HELP: STATUS_HELP, statusHelp: statusHelp,
    locationAvailable: locationAvailable, locationsForMethod: locationsForMethod,
    openLightbox: openLightbox, closeLightbox: closeLightbox, mockupClick: mockupClick,
    roundToQuarterHour: roundToQuarterHour,
    prepBufferStats: prepBufferStats, PREP_STATUS_META: PREP_STATUS_META,
    URG_ICON: URG_ICON, urgCardStyle: urgCardStyle
  };
})();
