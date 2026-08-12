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
  function logout(){ try { localStorage.removeItem(ROLE_KEY); localStorage.removeItem(NAME_KEY); } catch (_) {} }
  /* ── manager-only action gate ──
     role() reflects whichever PIN was entered at login.html and is easy to
     go stale on a shared tablet: tapping "Switch user" (the repeat icon on
     index.html/pre-production.html) only changes the attributed NAME, not
     the stored role -- so if a manager unlocks a tablet once, every worker
     who "switches user" after them is still, silently, holding manager
     role. Actions gated behind role therefore re-check the PIN live instead
     of trusting the stored role, so a stale session can't carry manager
     privileges to whoever picks up the tablet next.

     MANAGER_PIN is printed right on login.html's own screen (Worker PIN
     1234 / Manager PIN 6767), so it was never actually a secret -- anyone
     could pick "manager" at login and get the role. Manager status is now
     scoped to a specific named roster (MANAGER_NAMES) instead: only the
     person currently attributed as Gian, Anthony, or Parker can hold or
     re-confirm manager, regardless of who typed the PIN. Keep MANAGER_NAMES
     and MANAGER_PIN in sync with login.html if either changes.
     NOT real security (same caveat as the rest of this file's PIN model --
     it's a plain string/name compared in the browser). Cloudflare Access is
     the actual perimeter; this is just making the existing worker/manager
     distinction mean something in the UI. */
  var MANAGER_PIN = '6767';
  var MANAGER_NAMES = ['Gian', 'Anthony', 'Parker'];
  function isManager(){ return role() === 'manager' && MANAGER_NAMES.indexOf(workerName()) !== -1; }
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
    { key:'index', label:'Production Dashboard', sub:'Kanban · print → ship', href:'index.html', color:'#C6372B', icon:'ti-layout-kanban' },
    { key:'station', label:'Station Board', sub:'Ink · screens · transfers', href:'station.html', color:'#5E9B9A', icon:'ti-device-tablet' },
    { key:'shipping', label:'Shipping/Receiving', sub:'Post-production · ship · complete', href:'shipping.html', color:'#3E7CB1', icon:'ti-truck-delivery' },
    { key:'stats', label:'Stats', sub:'Prep-time buffer · team status · board totals', href:'stats.html', color:'#7FA644', icon:'ti-chart-bar' },
  ];
  function buildNavBoards(currentKey){
    return NAV_BOARDS.map(function (b) {
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
  // 'Design received' RELABELED 2026-08-10: the shop no longer burns screens
  // from film -- art now goes straight to an exposure unit that burns the
  // emulsion directly. The old "Films printed"/Films_Printed__c checklist item
  // was repurposed to track a still-real precondition: has the customer's
  // design/art actually arrived yet, before it can go on the exposure unit.
  // The Salesforce field itself was renamed to match (Films_Printed__c ->
  // Design_Received__c, on both Order and Production_Method__c, in both
  // dev2 and Staging) -- this is the field's real, current API name, not
  // just a display label. See also pre-production.html's M.sp.prereq.
  var CHECK_FIELD = {
    'Design received':'Design_Received__c', 'Screens completed':'Screens_Completed__c', 'Inks mixed':'Mix_Inks__c',
    'File digitized':'Digitize_File__c', 'Thread & materials':'Thread_Color_Materials__c',
    'Transfers received':'Transfers_Received__c', 'Transfers ready':'Transfers_Ready__c'
  };
  /* Receiving_Status__c picklist <-> board key */
  var RECV_FROM_SF = { 'Not Received':'none', 'Partial':'partial', 'Counted In':'countedin', 'Staged':'staged' };
  var RECV_TO_SF = { none:'Not Received', partial:'Partial', countedin:'Counted In', staged:'Staged' };

  /* ── low-level fetch ── */
  function jget(url){
    return fetch(url, { headers: { Accept:'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('GET ' + url + ' -> ' + r.status);
      return r.json();
    });
  }
  function jsend(url, method, body){
    return fetch(url, { method: method, headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) {
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
    });
  }
  function jdel(url){
    return fetch(url, { method: 'DELETE' }).then(function (r) {
      if (!r.ok && r.status !== 204) throw new Error('DELETE ' + url + ' -> ' + r.status);
      return r.status === 204 ? null : r.json().catch(function () { return null; });
    });
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
  function searchVendors(q){ return jget('/api/vendors?q=' + encodeURIComponent(q || '')).then(function (d) { return d.records || []; }); }
  function searchPlans(q){ return jget('/api/plans?q=' + encodeURIComponent(q || '')).then(function (d) { return d.records || []; }); }
  // Account.Type = 'Press' only -- the shop's press/machine equipment
  // records, not every vendor Account. Powers the Press picker on the
  // Create Production Run modal.
  function searchPresses(q){ return jget('/api/presses?q=' + encodeURIComponent(q || '')).then(function (d) { return d.records || []; }); }
  function createMethod(body){ return jsend('/api/production-methods', 'POST', body); }
  // Creates one Production_Run__c. body: { printMethodId, pressId, scheduledStart, scheduledEnd, quantity }
  function createProductionRun(body){ return jsend('/api/production-runs', 'POST', body); }
  // Every Production_Run__c attached to one Production_Method__c -- powers
  // the card drawer's "Production Runs" section (view + edit existing runs).
  function getProductionRuns(methodId){ return jget('/api/production-runs?methodId=' + encodeURIComponent(methodId)).then(function (d) { return d.records || []; }); }
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
  // method's Type__c/Placements__c/Vendor__c in place from the drawer.
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
  function setSfEnv(envKey, pin){ return jsend('/api/admin/sf-env', 'POST', { env: envKey, pin: pin }); }

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
        vendor: pm.Vendor || null, status: pm.Status__c || null
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
    VALID_NAMES: VALID_NAMES, ROLE_KEY: ROLE_KEY, NAME_KEY: NAME_KEY, role: role, workerName: workerName, setRole: setRole, setWorkerName: setWorkerName, logout: logout, isManager: isManager, confirmManager: confirmManager, MANAGER_NAMES: MANAGER_NAMES,
    SUBSTATUS_VALUE: SUBSTATUS_VALUE, SUBSTATUS_LABEL: SUBSTATUS_LABEL, STAGE_KEY: STAGE_KEY, STAGE_SUBSTATUS: STAGE_SUBSTATUS, stageOf: stageOf, stageOfMethod: stageOfMethod,
    DELIVERY_LABEL: DELIVERY_LABEL, DELIVERY_METHODS: DELIVERY_METHODS, formatAddress: formatAddress,
    NAV_BOARDS: NAV_BOARDS, buildNavBoards: buildNavBoards,
    getShippingOrders: getShippingOrders, completeOrder: completeOrder, getStatsTrend: getStatsTrend,
    CHECK_FIELD: CHECK_FIELD, RECV_FROM_SF: RECV_FROM_SF, RECV_TO_SF: RECV_TO_SF,
    PLACEMENTS: PLACEMENTS, methodsList: methodsList, METHOD_META: METHOD_META,
    getOrders: getOrders, getProductionOrders: getProductionOrders, getInbox: getInbox, getPreProductionItems: getPreProductionItems, patchItem: patchItem, deleteItem: deleteItem, createItem: createItem, searchVendors: searchVendors, searchPlans: searchPlans, searchPresses: searchPresses, createMethod: createMethod, createProductionRun: createProductionRun, getProductionRuns: getProductionRuns, patchProductionRun: patchProductionRun, deleteProductionRun: deleteProductionRun, patchMethodStatus: patchMethodStatus, patchMethodChecklist: patchMethodChecklist, getMethodsForOrder: getMethodsForOrder, patchMethodFields: patchMethodFields, deleteMethod: deleteMethod, patchOrder: patchOrder, getOrderSizes: getOrderSizes, createReprintOrder: createReprintOrder,
    getPackaging: getPackaging, postPackaging: postPackaging, deletePackaging: deletePackaging,
    getShipments: getShipments, postShipment: postShipment, deleteShipment: deleteShipment, getZkWizardUrl: getZkWizardUrl,
    splitShipment: splitShipment, combineShipment: combineShipment,
    getSfEnv: getSfEnv, setSfEnv: setSfEnv,
    getStationItems: getStationItems, updateItemStatus: updateItemStatus, updateOrderReceiving: updateOrderReceiving,
    getInventory: getInventory, postInventory: postInventory, stationLogin: stationLogin,
    SIZE_ORDER: SIZE_ORDER, text: text, initials: initials, colorForName: colorForName, methodOf: methodOf, dueInfo: dueInfo, parseSfDate: parseSfDate, pivotItems: pivotItems,
    prepBufferStats: prepBufferStats, PREP_STATUS_META: PREP_STATUS_META,
    URG_ICON: URG_ICON, urgCardStyle: urgCardStyle
  };
})();
