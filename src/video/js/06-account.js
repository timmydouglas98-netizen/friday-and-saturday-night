  // ---------- your Stremio account ----------
  function timeoutP(p, ms, ctl) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { if (ctl) try { ctl.abort(); } catch (e) {} reject(new Error("Stremio took too long to answer.")); }, ms);
      p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function api(method, body, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var req = fetch(API + method, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("Stremio's servers answered " + r.status + "."); return r.json(); });
    return timeoutP(req.catch(function (e) { if (e && e.name === "AbortError") throw new Error("Stremio took too long to answer."); throw e; }), ms || 9000, ctl)
      .then(function (j) { if (j.error) { var er = new Error(j.error.message || "Stremio said no."); er.stremio = true; er.code = j.error.code; throw er; } return j.result; });
  }
  function saveAccount(key) { account = { authKey: key }; save("fnv-auth", account); updateCounter(); }

  // Taking a tape off Continue Watching rewinds it, the same thing Stremio's own "dismiss" does, so it stays off on every device.
  // The box keeps an Undo button until you pick up something else.
  var cwUndo = null;
  function dropFromCW(it) {
    var pre = {}; Object.keys(progressMap).forEach(function (k) { if (k === it.id || k.indexOf("ep:" + it.id + ":") === 0) pre[k] = progressMap[k]; });
    cwUndo = { id: it.id, progress: it.progress, lastWatched: it.lastWatched, pm: pre, li: libRaw[it.id] ? JSON.parse(JSON.stringify(libRaw[it.id])) : null };
    it.aisles = it.aisles.filter(function (a) { return a !== "cw"; }); it.progress = 0;
    Object.keys(pre).forEach(function (k) { delete progressMap[k]; }); save("fnv-progress", progressMap);
    var li = libRaw[it.id];
    if (li && account) {
      li = JSON.parse(JSON.stringify(li)); li.state = li.state || {}; li.state.timeOffset = 0; li._mtime = new Date().toISOString();
      libRaw[it.id] = li;
      api("datastorePut", { authKey: account.authKey, collection: "libraryItem", changes: [li] }).catch(function (e) { diag.err("Couldn't tell Stremio to take " + it.name + " off Continue Watching", e); });
    }
    toast("Taken off Continue Watching", 2500);
    setTimeout(saveSnapshot, 0);
  }
  function undoDropCW(it) {
    var u = cwUndo; if (!u || u.id !== it.id) return;
    cwUndo = null;
    if (it.aisles.indexOf("cw") === -1) it.aisles.push("cw");
    it.progress = u.progress; it.lastWatched = u.lastWatched;
    Object.keys(u.pm).forEach(function (k) { progressMap[k] = u.pm[k]; }); save("fnv-progress", progressMap);
    if (u.li && account) {
      var li = JSON.parse(JSON.stringify(u.li)); li._mtime = new Date().toISOString(); libRaw[it.id] = li;
      api("datastorePut", { authKey: account.authKey, collection: "libraryItem", changes: [li] }).catch(function (e) { diag.err("Couldn't put " + it.name + " back on Continue Watching", e); });
    }
    toast("Back on Continue Watching", 2500);
    setTimeout(saveSnapshot, 0);
  }
  function fromLibrary(li) {
    var st = li.state || {};
    return {
      id: li._id, type: li.type, name: li.name || "Untitled", poster: li.poster || "",
      year: parseInt(li.year, 10) || 0, genres: [],
      progress: st.duration > 0 ? st.timeOffset / st.duration : 0,
      videoId: (li.type === "series" && st.video_id) ? st.video_id : "",
      seen: li.type === "movie" && (st.timesWatched > 0 || !!st.flaggedWatched),
      lastWatched: Date.parse(st.lastWatched || li._mtime || "") || 0,
      mtime: Date.parse(li._mtime || "") || 0
    };
  }
  function loadLibrary() {
    var mine = account.authKey;
    return api("datastoreGet", { authKey: mine, collection: "libraryItem", ids: [], all: true }, 20000).then(function (list) {
      if (!account || account.authKey !== mine) return 0;
      list = (list || []).filter(function (li) { return li && li._id && li.type !== "other"; });
      libRaw = {}; list.forEach(function (li) { libRaw[li._id] = li; });
      var cw = list.filter(function (li) { return (!li.removed || li.temp) && li.state && li.state.timeOffset > 0; })
        .map(fromLibrary).sort(function (a, b) { return b.lastWatched - a.lastWatched; });
      var lib = list.filter(function (li) { return !li.removed && !li.temp; })
        .map(fromLibrary).sort(function (a, b) { return b.mtime - a.mtime; });
      // drop the example progress from the sample shelf
      items.forEach(function (it) { var i = it.aisles.indexOf("cw"); if (i !== -1) { it.aisles.splice(i, 1); it.progress = 0; } });
      items.forEach(function (it) { var j = it.aisles.indexOf("lib"); if (j !== -1) it.aisles.splice(j, 1); });
      cw.slice(0, 30).forEach(function (it) { var x = add(it, "cw"); x.progress = it.progress; x.videoId = it.videoId; x.lastWatched = it.lastWatched; });
      lib.forEach(function (it) { add(it, "lib"); });
      fillPosters();
      libLoadedAt = Date.now();
      return lib.length;
    });
  }
  // Continue Watching from your account again (say, after watching on your phone), without moving you off your aisle
  var libLoadedAt = 0;
  function refreshLibraryQuietly(minAge) {
    if (!account || !live || P || Date.now() - libLoadedAt < (minAge || 120000)) return;
    libLoadedAt = Date.now();
    loadLibrary().then(function () {
      if (P) return;
      tagSpecial(); setTimeout(saveSnapshot, 0);
      if (!modal) { renderSigns(); redrawShelves(); clampFocus(); if (!landingOn && !demoOn) applyFocus(true); }
    }, function (e) { diag.err("Couldn't refresh Continue Watching", e); });
  }
  function catalogUsable(c) {
    if (!c || (c.type !== "movie" && c.type !== "series")) return false;
    if (c.extraRequired && c.extraRequired.length) return false;
    return !(c.extra || []).some(function (e) { return e && e.isRequired; });
  }
  function loadAddonAisles() {
    var mine = account.authKey;
    return api("addonCollectionGet", { type: "AddonCollectionGet", authKey: mine, update: true }).then(function (res) {
      if (!account || account.authKey !== mine) return { addons: 0, staff: false };
      var addons = (res && res.addons) || [];
      installedAddons = addons;
      clearCopyCache();
      var jobs = [], extras = [], staffFound = false;
      // Each list is restocked when it answers and keeps what it had if it doesn't; lists you've moved, hidden or
      // removed are cleared out once they've all been asked. A list gets 20 seconds and a second try, because a
      // new Letterboxd list can take a while the first time it's fetched.
      var wanted = {};
      function restock(key, metas, type) {
        items.forEach(function (it) { var i = it.aisles.indexOf(key); if (i !== -1) it.aisles.splice(i, 1); if (it.rk) delete it.rk[key]; });
        metas.forEach(function (mt, i) { var it = fromMeta(mt); if (!it.id || !it.name) return; it.type = mt.type || type; rankIn(key, add(it, key), i); });
      }
      function fetchList(url) {
        return getJSON(url, 20000).then(null, function () { return new Promise(function (go) { setTimeout(go, 1500); }).then(function () { return getJSON(url, 20000); }); });
      }
      staffConnected = false;
      var roles = { day: [], night: [], back: [] }, choices = [];
      // one entry per list, duplicates (an add-on installed twice, a list added twice) already left out: see 00-logic.js
      planAddonLists(addons, addonOK, catalogUsable).forEach(function (e) {
          var m = e.m, base = e.base, c = e.c, isLB = e.isLB, key;
          if (isLB && !staffFound && /popular/i.test((c.id || "") + " " + (c.name || ""))) { key = "staff"; staffFound = true; }
          else {
            var ck = (m.id || base) + "|" + c.type + "|" + c.id, nm = c.name || m.name || "List", role = listRole(ck, nm);
            choices.push({ key: ck, name: nm, role: role });
            if (role === "off") return;
            if (role !== "aisle") {
              // a clerk's list or the back room: stocked, but never shown as an aisle
              var ch = choices[choices.length - 1];
              jobs.push(fetchList(base + "/catalog/" + c.type + "/" + encodeURIComponent(c.id) + ".json").then(function (j) {
                var ms = (j && j.metas) || []; ch.n = ms.length; ch.fail = false;
                ms.forEach(function (mt) { var it = fromMeta(mt); if (!it.id || !it.name) return; it.type = mt.type || c.type; var ex = add(it, null); if (!ex.fromList) ex.fromList = nm; roles[role].push(ex); });
              }, function (e) {
                ch.fail = true; diag.addonFail(m.name || "Add-on", "list " + nm, e);
                (roleItems[role] || []).forEach(function (x) { if (x.fromList === nm) roles[role].push(x); });   // keep what it had
              }));
              return;
            }
            if (extras.length >= 24) { choices[choices.length - 1].full = true; return; }
            // the aisle's name in the store's books stays the same from visit to visit, whatever order the lists come in
            key = "addon" + hash(ck).toString(36); while (wanted[key]) key += "x";
            var label = c.name || m.name || "Addon";
            var tv = e.tv ? " · TV" : "", room = 24 - tv.length;
            extras.push({ key: key, label: (label.length > room ? label.slice(0, room - 1) + "…" : label) + tv });
          }
          wanted[key] = 1;
          var choice = key === "staff" ? null : choices[choices.length - 1];
          var cbase = base + "/catalog/" + c.type + "/" + encodeURIComponent(c.id);
          var pages = (c.extra || []).some(function (e) { return e && e.name === "skip"; }) || (c.extraSupported || []).indexOf("skip") !== -1;
          jobs.push(fetchList(cbase + ".json").then(function (j) {
            var metas = (j && j.metas) || [];
            restock(key, metas, c.type);
            if (choice) { choice.n = metas.length; choice.more = pages && metas.length >= 50; choice.fail = false; }
            if (pages && metas.length) pager[key] = { type: c.type, tail: 1e6, feeds: [{ base: cbase, extras: "", skip: metas.length, start: 0, done: false, pages: 1, fails: 0 }] };
            else delete pager[key];
          }, function (err) { if (choice) choice.fail = true; diag.addonFail(m.name || "Add-on", "aisle " + (c.name || c.id), err); }));
      });
      extraAisles = extras;
      return Promise.all(jobs).then(function () {
        items.forEach(function (it) { it.aisles = it.aisles.filter(function (a) { return (a !== "staff" && a.indexOf("addon") !== 0) || wanted[a]; }); });
        Object.keys(pager).forEach(function (k) { if (k.indexOf("addon") === 0 && !wanted[k]) delete pager[k]; });
        roleItems = roles; catalogChoices = choices;
        if (modal && modal.view === "lists") listsPanel(modal.idx);
        return { addons: addons.length, staff: staffFound };
      });
    });
  }
  var firstShelves = true;   // the first time your tapes arrive, the store opens on Continue Watching
  function refreshAccount(announce) {
    if (!account) return Promise.resolve();
    $("status").textContent = "Pulling your tapes…";
    return Promise.all([loadLibrary(), loadAddonAisles()]).then(function (r) {
      staffConnected = !!r[1].staff;
      if (!!prefs.staffSeen !== staffConnected) { prefs.staffSeen = staffConnected; save("fnv-prefs", prefs); }
      setTimeout(saveSnapshot, 0);
      accountInfo = r[0] + " titles in your library · " + r[1].addons + " addons" + (r[1].staff ? " · Staff Picks from Letterboxd" : "");
      tagSpecial();
      if (!allAisles().some(function (a) { return a.key === aisle; })) aisle = "new";
      if (aisleList("cw").length && (announce || (firstShelves && aisle === "new"))) aisle = "cw";
      firstShelves = false;
      renderAll(!announce);
      $("status").textContent = "Welcome back · your tapes are on the shelves";
      diag.account = { ok: true, t: Date.now(), info: accountInfo };
    }, function (e) {
      diag.account = { ok: false, t: Date.now() }; diag.err("Your Stremio account didn't load", e);
      // only Stremio itself saying the sign-in is no good signs you out (not a hotel wi-fi page or a garbled answer)
      if (e && e.stremio && (e.code === 1 || /auth|session|token/i.test(e.message))) { account = null; save("fnv-auth", null); updateCounter(); }
      $("status").textContent = "Couldn't pull your tapes just now · try Refresh at the front desk";
      tagSpecial(); renderAll(true);
    });
  }

  var linkPoll = null, linkExpiry = 0;
  function stopLinkPoll() { clearInterval(linkPoll); linkPoll = null; }
  function accountPanel() {
    if (account) {
      openModal('<div class="panel"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">✓</div><p>You\'re signed in to Stremio.' +
        (accountInfo ? "<br>" + esc(accountInfo) : "") + '</p></div><div class="actions">' +
        '<button class="btn primary" data-m="refresh">Refresh my shelves</button>' +
        '<button class="btn" data-m="signout">Sign out</button>' +
        '<button class="btn" data-m="close">Back to the aisles</button></div></div>');
      return;
    }
    linkSignIn();
  }
  function linkSignIn() {
    stopLinkPoll();
    openModal('<div class="panel"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">?</div><p>Sign in to Stremio to stock your own shelves.</p></div>' +
      '<p class="note" id="linkMsg">Getting a sign-in code…</p><div class="actions">' +
      '<button class="btn" data-m="email">Use email and password</button><button class="btn" data-m="close">Not now</button></div></div>');
    var view = modal && modal.seq;
    timeoutP(getJSON(LINK + "create?type=Create", 8000), 9000).then(function (j) {
      var r = j.result || j;
      if (!r || !r.code) throw new Error("no code");
      if (!sameView(view)) return;
      var link = r.link || ("https://link.stremio.com/" + r.code);
      linkExpiry = Date.now() + 290000;
      var qr = r.qrcode || ("https://link.stremio.com/qr?data=" + encodeURIComponent(link));
      openModal('<div class="panel"><div class="link-code"><div class="code">' + esc(r.code) + '</div><img alt="QR code to sign in" src="' + esc(qr) + '" onerror="this.parentNode.removeChild(this)"></div>' +
        '<ol class="steps"><li>On your phone, scan the code or go to <b>link.stremio.com</b></li><li>Sign in to Stremio if it asks</li><li>Enter <b>' + esc(r.code) + '</b>. This screen updates by itself.</li></ol>' +
        '<p class="note" id="linkMsg">Waiting for you… the code lasts 5 minutes.</p><div class="actions">' +
        '<button class="btn" data-m="email">Use email and password</button><button class="btn" data-m="close">Not now</button></div></div>');
      linkPoll = setInterval(function () {
        if (Date.now() > linkExpiry) { stopLinkPoll(); linkSignIn(); return; }
        var poll = linkPoll;
        getJSON(LINK + "read?type=Read&code=" + encodeURIComponent(r.code), 6000).then(function (rj) {
          if (!linkPoll || linkPoll !== poll || !rj || !rj.result || !rj.result.authKey) return;
          stopLinkPoll();
          finishSignIn(rj.result.authKey, true);
        }, function () {});
      }, 3000);
    }).catch(function () {
      var m = $("linkMsg");
      if (m && sameView(view)) m.textContent = "Couldn't get a code from Stremio from here. On the TV this works; you can also use email and password.";
    });
  }
  function finishSignIn(key, fromLink) {
    var m = $("linkMsg"); if (m) m.textContent = "Signing you in…";
    var p = fromLink ? api("loginWithToken", { type: "LoginWithToken", token: key }).then(function (r) { return (r && r.authKey) || key; }, function () { return key; })
                     : Promise.resolve(key);
    p.then(function (k) {
      saveAccount(k); sfx("chime"); closeModal(); refreshAccount(true).then(welcomeCard);
    });
  }
  function emailSignIn() {
    stopLinkPoll();
    openModal('<div class="panel"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">@</div><p>Sign in with your Stremio email and password.</p></div>' +
      '<input class="field" id="fnvEmail" data-m="input" type="email" autocomplete="username" placeholder="Email">' +
      '<input class="field" id="fnvPass" data-m="input" type="password" autocomplete="current-password" placeholder="Password">' +
      '<p class="err" id="loginErr"></p><div class="actions">' +
      '<button class="btn primary" data-m="login">Sign in</button><button class="btn" data-m="relink">Use a code instead</button><button class="btn" data-m="close">Not now</button></div>' +
      '<p class="note">Your password goes straight to Stremio. Only the sign-in key is kept on this TV.</p></div>');
  }
  function doEmailLogin() {
    var email = ($("fnvEmail").value || "").trim(), pass = $("fnvPass").value || "", err = $("loginErr");
    if (!email || !pass) { err.textContent = "Enter both your email and password."; return; }
    err.textContent = "Signing in…";
    api("login", { type: "Login", email: email, password: pass, facebook: false }).then(function (r) {
      if (!r || !r.authKey) throw new Error("Stremio didn't send a sign-in key.");
      saveAccount(r.authKey); sfx("chime"); closeModal(); refreshAccount(true).then(welcomeCard);
    }).catch(function (e) {
      err.textContent = /fetch|network|load/i.test(e.message) ? "Couldn't reach Stremio from here. Try it on the TV." : e.message;
    });
  }
  function signOut() {
    var key = account && account.authKey;
    if (key) api("logout", { type: "Logout", authKey: key }).catch(function () {});
    progressMap = {}; save("fnv-progress", progressMap);
    try { localStorage.removeItem("fnv-shelves"); } catch (e) {}
    libRaw = {}; installedAddons = [];
    account = null; accountInfo = ""; save("fnv-auth", null); extraAisles = []; roleItems = { day: [], night: [], back: [] }; catalogChoices = []; clearCopyCache(); staffConnected = false; prefs.staffSeen = false; save("fnv-prefs", prefs);
    items.forEach(function (it) {
      it.aisles = it.aisles.filter(function (a) { return a !== "cw" && a !== "lib" && a !== "staff" && a.indexOf("addon") !== 0; });
      it.progress = 0; it.videoId = ""; it.seen = false;
    });
    if (["cw", "lib", "staff"].indexOf(aisle) !== -1 || aisle.indexOf("addon") === 0) aisle = "new";
    closeModal(); renderAll(); $("status").textContent = "Signed out · see you next time"; toast("Signed out. Your lists come back when you sign in again.", 3500);
  }

  // ---------- seasonal displays, blind dates ----------
  function dayShuffle(list) { return list.map(function (it) { return { it: it, k: daily(hash(it.id) % 99991) }; }).sort(function (a, b) { return a.k - b.k; }).map(function (x) { return x.it; }); }
  function shuffled2(list) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var holds = store("fnv-holds", [], function (l) {
    return l.filter(function (h) { return isObj(h) && typeof h.id === "string" && h.id && typeof h.name === "string" && numIn(h.t, 0, 1e13); }).slice(0, 80);
  });
  // a hold matches by id, or by title and year (see findHold in 00-logic.js)
  function holdFor(id) { return findHold(holds, id, byId[id]); }
  function isHeld(id) { return !!holdFor(id); }
  // put the name slip on (or take it off) every copy of this tape already on the shelves, so a hold shows at once
  function refreshHoldMarks() {
    Array.prototype.forEach.call(document.querySelectorAll(".tape[data-id]"), function (el) {
      if (el.getAttribute("data-blind")) return;
      var id = el.getAttribute("data-id"), old = el.querySelector(".hold-slip"), want = isHeld(id) && el.querySelector(".cover") && !el.querySelector(".spine");
      if (old && !want) old.parentNode.removeChild(old);
      else if (want && !old) el.insertAdjacentHTML("beforeend", holdSlip());
    });
  }
  function applyHolds() {
    items.forEach(function (it) { var i = it.aisles.indexOf("hold"); if (i !== -1) it.aisles.splice(i, 1); });
    holds.forEach(function (h, i) {
      var it = add({ id: h.id, type: h.type === "series" ? "series" : "movie", name: h.name, year: h.year || 0, genres: strList(h.genres, 12), poster: webUrl(h.poster), blurb: typeof h.blurb === "string" ? h.blurb : "" }, "hold");
      rankIn("hold", it, -h.t);
    });
  }
  function holdIt(it) {
    if (isHeld(it.id)) return;
    holds.unshift({ id: it.id, type: it.type, name: it.name, year: it.year || 0, genres: (it.genres || []).slice(0, 4), poster: it.poster || "", blurb: (it.blurb || "").slice(0, 300), t: Date.now() });
    holds = holds.slice(0, 80); save("fnv-holds", holds);
    applyHolds();
    sfx("clack"); later([180], function () { sfx("tick"); });
    refreshHoldMarks();
    toast("On hold behind the counter · under " + (prefs.memberName ? prefs.memberName.toUpperCase() : "your name") + (account ? " · and in your Stremio library" : ""), 3200);
    if (account && !(libRaw[it.id] && !libRaw[it.id].removed)) {
      var now = new Date().toISOString(), li = libRaw[it.id] ? JSON.parse(JSON.stringify(libRaw[it.id])) : {
        _id: it.id, name: it.name, type: it.type === "series" ? "series" : "movie", poster: it.poster || "", posterShape: "poster", _ctime: now,
        behaviorHints: { defaultVideoId: null, featuredVideoId: null, hasScheduledVideos: false },
        state: { lastWatched: null, timeWatched: 0, timeOffset: 0, overallTimeWatched: 0, timesWatched: 0, flaggedWatched: 0, duration: 0, video_id: null, watched: null, noNotif: false }
      };
      li.removed = false; li.temp = false; li._mtime = now;
      libRaw[it.id] = li; holds[0].lib = true; save("fnv-holds", holds);
      add(it, "lib");
      api("datastorePut", { authKey: account.authKey, collection: "libraryItem", changes: [li] }).catch(function (e) { diag.err("Couldn't add " + it.name + " to your Stremio library", e); });
    }
    renderSigns(); setTimeout(saveSnapshot, 0);
  }
  function unholdIt(it, quiet) {
    var h = holdFor(it.id);
    if (!h) return;
    holds = holds.filter(function (x) { return x !== h; });
    save("fnv-holds", holds);
    var i = it.aisles.indexOf("hold"); if (i !== -1) it.aisles.splice(i, 1);
    var heldCopy = byId[h.id];   // the copy on the On Hold shelf, if it was held under another id
    if (heldCopy && heldCopy !== it) { i = heldCopy.aisles.indexOf("hold"); if (i !== -1) heldCopy.aisles.splice(i, 1); it = heldCopy; }
    // only take it back out of the Stremio library if putting it on hold is what put it there
    if (h.lib && account && libRaw[it.id] && !(libRaw[it.id].state && libRaw[it.id].state.timeOffset > 0)) {
      var li = JSON.parse(JSON.stringify(libRaw[it.id])); li.removed = true; li._mtime = new Date().toISOString(); libRaw[it.id] = li;
      var j = it.aisles.indexOf("lib"); if (j !== -1) it.aisles.splice(j, 1);
      api("datastorePut", { authKey: account.authKey, collection: "libraryItem", changes: [li] }).catch(function () {});
    }
    refreshHoldMarks();
    if (!quiet) { sfx("close"); toast("Back on the shelf", 2200); }
    if (aisle === "hold" && !aisleList("hold").length) aisle = "new";
    renderSigns(); setTimeout(saveSnapshot, 0);
  }
  function tagSpecial() {
    applyHolds();
    items.forEach(function (it) { it.aisles = it.aisles.filter(function (a) { return a !== "season" && a !== "blind"; }); });
    if (season) {
      items.filter(function (it) { return it.aisles.length && it.type !== "series" && season.match(it); }).slice(0, 30)
        .forEach(function (it) { it.aisles.push("season"); });
    }
    dayShuffle(items.filter(function (it) { return stocked(it) && visible(it) && it.type !== "series" && it.blurb && !isWatched(it.id) && !(it.progress > 0.01); })).slice(0, 12)
      .forEach(function (it) { it.aisles.push("blind"); });
    updateSeasonDecor();
  }
  function setBanner() {
    var b = $("banner");
    if (rewindYear()) b.innerHTML = "<b>" + String(rewindYear()).slice(2) + "</b><span>REWIND<br>NIGHT</span><em>the shelves of " + rewindYear() + "</em>";
    else if (season) b.innerHTML = season.banner;
    else b.innerHTML = "<b>3</b><span>NIGHTS<br>$3.99</span><em>every new release</em>";
  }
  function updateSeasonDecor() {
    var root = document.documentElement;
    if (season) { root.style.setProperty("--season-1", season.c1); root.style.setProperty("--season-2", season.c2); }
    $("bunting").hidden = !season;
    if (season) { $("banner").style.background = season.c2; $("banner").style.borderColor = season.c1; }
    setBanner();
    var st = $("standee"), top = season && aisleList("season")[0];
    if (!top) { st.hidden = true; return; }
    st.hidden = false;
    st.innerHTML = '<div class="sh">' + esc(season.standee) + '</div><div class="sp">' + coverHTML(top) + '</div><div class="base"></div>';
  }
  function blindView(it) {
    sfx("rustle");
    openModal('<div class="panel" role="dialog" aria-label="Blind date tape"><div class="case-view">' +
      '<div class="blind-box" id="blindBox">' + blindCover(it, true) + "</div>" +
      '<div class="details"><h3>Blind date</h3><div class="facts"><span class="chip">' + esc(((it.genres || [])[0] || "Mystery")) + "</span>" +
      (it.year ? '<span class="chip">' + String(it.year).slice(0, 3) + "0s</span>" : "") + "</div>" +
      '<p class="flip-hint">The clerk wrapped this one so you judge it by the blurb alone.</p>' +
      '<div class="actions col">' +
      '<button class="btn primary" data-m="unwrap" data-id="' + esc(it.id) + '">Unwrap it</button>' +
      '<button class="btn" data-m="rent" data-id="' + esc(it.id) + '">Rent it unseen</button>' +
      '<button class="btn" data-m="close">Put it back</button></div>' +
      '<div class="blind-note">' + clerkHead(shiftNow() === "night" ? "Don't peek. Not knowing is the whole point." : "Wrapped it myself, mate. Trust me on this one.") + "</div></div></div></div>", putBack);
    liftFrom($("blindBox"));
  }

  // ---------- double features ----------
  function doubleFeature() {
    var pool = items.filter(function (it) { return it.aisles.length && visible(it) && it.type !== "series" && !isWatched(it.id); });
    if (pool.length < 2) return;
    var best = null;
    for (var n = 0; n < 160; n++) {
      var a = pickOne(pool), b = pickOne(pool);
      if (a === b) continue;
      var score = 0, why = "";
      var shared = (a.genres || []).filter(function (g) { return (b.genres || []).indexOf(g) !== -1; })[0];
      if (a.director && a.director === b.director) { score = 3 + Math.random(); why = "Both directed by " + a.director + "."; }
      else if (shared && a.year && b.year && Math.abs(a.year - b.year) >= 8) { score = 2 + Math.random(); why = "Two eras of " + shared + ": " + Math.min(a.year, b.year) + " and " + Math.max(a.year, b.year) + "."; }
      else if (shared) { score = 1 + Math.random(); why = "Two " + shared + " picks, back to back."; }
      if (!best || score > best.score) {
        var first = (a.year || 0) <= (b.year || 0) ? a : b;
        best = { score: score, a: first, b: first === a ? b : a, why: why || "Opposites attract." };
      }
    }
    var mins = (best.a.runtime || 0) + (best.b.runtime || 0);
    sfx("double");
    openModal('<div class="panel" role="dialog" aria-label="Double feature"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">2×</div><p>Tonight\'s double feature. ' +
      esc(best.why) + (mins ? " About " + (Math.round(mins / 6) / 10) + " hours all up." : "") + '</p></div><div class="picks">' +
      [["First up", best.a], ["Then", best.b]].map(function (p) {
        return '<button class="pick" data-m="open" data-id="' + esc(p[1].id) + '"><span class="why">' + p[0] + '</span><span class="pt">' + esc(p[1].name) +
          '</span><span class="pn">' + esc([p[1].year, (p[1].genres || [])[0]].filter(Boolean).join(" · ")) + "</span></button>";
      }).join("") + '</div><div class="actions"><button class="btn" data-m="double">Another pair</button><button class="btn" data-m="close">Back to the aisles</button></div></div>');
  }

  // ---------- search at the counter ----------
  function searchPanel() {
    openModal('<div class="panel" role="dialog" aria-label="Search"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">?</div><p>"Do you have…?" Type a title or an actor and I\'ll check out the back.</p></div>' +
      '<input class="field" id="q" data-m="input" data-submit="dosearch" type="search" placeholder="Title or actor" autocomplete="off">' +
      '<div class="actions"><button class="btn primary" data-m="dosearch">Search</button><button class="btn" data-m="close">Never mind</button></div>' +
      '<p class="note" id="searchMsg"></p><div class="picks results" id="results"></div></div>');
  }
  function refreshModalEls() { if (modal) modal.els = Array.prototype.slice.call(overlay.querySelectorAll("[data-m]")); }
  var searchSeq = 0;
  function doSearch(liveTyping) {
    var q = ($("q").value || "").trim(), msg = $("searchMsg");
    if (!q) { msg.textContent = "Type something first."; return; }
    if (!liveTyping) {
      var rs = (prefs.recentSearches || []).filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
      rs.unshift(q); prefs.recentSearches = rs.slice(0, 6); save("fnv-prefs", prefs);
    }
    msg.textContent = "Checking the shelves…";
    var seq = ++searchSeq, view = modal && modal.seq;
    var local = items.filter(function (it) {
      var hay = (it.name + " " + (it.cast || []).join(" ") + " " + (it.director || "")).toLowerCase();
      return hay.indexOf(q.toLowerCase()) !== -1;
    });
    var p = !live ? Promise.resolve(local) : Promise.all(["movie", "series"].map(function (t) {
      return getJSON(CINEMETA + "/catalog/" + t + "/top/search=" + encodeURIComponent(q) + ".json", 7000)
        .then(function (j) { return (j.metas || []).map(function (m) { var it = fromMeta(m); it.type = t; return add(it); }); }, function () { return []; });
    })).then(function (r) {
      var seen = {}, out = [];
      local.concat(r[0], r[1]).forEach(function (it) { if (it && !seen[it.id]) { seen[it.id] = 1; out.push(it); } });
      return out;
    });
    p.then(function (list) {
      if (seq !== searchSeq || !sameView(view) || !$("results")) return;   // a newer search, or a different panel
      var msg = $("searchMsg"); if (!msg) return;
      msg.textContent = list.length ? "Found " + Math.min(list.length, 12) + (list.length > 12 ? " of " + list.length : "") + "." : "Sorry, nothing by that name. Try another spelling.";
      $("results").innerHTML = list.slice(0, 12).map(function (it) {
        return '<button class="pick" data-m="open" data-id="' + esc(it.id) + '"><span class="why">' + (it.type === "series" ? "TV" : "Movie") + '</span><span class="pt">' + esc(it.name) +
          '</span><span class="pn">' + esc([it.year, (it.genres || [])[0]].filter(Boolean).join(" · ")) + "</span></button>";
      }).join("");
      refreshModalEls();
      if (list.length && !liveTyping) { modal.idx = modal.els.indexOf(overlay.querySelector("#results .pick")); modalFocus(true); }
    });
  }

  // ---------- front desk: store name, membership card, settings ----------
  function applyStoreName() {
    var words = prefs.storeName.trim().split(/\s+/);
    var last = words.length > 1 ? words.pop() : words[0];
    $("logo1").textContent = words.length && words[0] !== last ? words.join(" ") : "";
    $("logo1").style.display = $("logo1").textContent ? "" : "none";
    $("logo2").textContent = last;
    $("logo").setAttribute("aria-label", prefs.storeName);
    document.title = prefs.storeName;
  }
  function memberNumber() {
    var h = String(hash((prefs.memberName || "guest") + prefs.memberSince) % 1e12);
    while (h.length < 12) h = "0" + h;
    return h.slice(0, 4) + " " + h.slice(4, 8) + " " + h.slice(8);
  }
  // what you've rented, kept on this TV: tapes per year, what you rent most, time in front of the set
  var stats = store("fnv-stats", {}, function (x) {
    var out = { rented: {}, genres: {}, ms: numIn(x.ms, 0, 1e12) ? x.ms : 0 };
    if (isObj(x.rented)) Object.keys(x.rented).forEach(function (k) { if (/^\d{4}$/.test(k) && numIn(x.rented[k], 0, 1e6)) out.rented[k] = x.rented[k]; });
    if (isObj(x.genres)) Object.keys(x.genres).slice(0, 60).forEach(function (k) { if (k.length < 40 && numIn(x.genres[k], 0, 1e6)) out.genres[k] = x.genres[k]; });
    return out;
  });
  if (!isObj(stats.rented)) stats = { rented: {}, genres: {}, ms: 0 };
  function noteRental(it) {
    var y = String(new Date().getFullYear()), g = (it.genres || [])[0] || (it.type === "series" ? "Television" : "");
    stats.rented[y] = (stats.rented[y] || 0) + 1;
    if (g) stats.genres[g] = (stats.genres[g] || 0) + 1;
    save("fnv-stats", stats);
  }
  function statsCells() {
    var y = String(new Date().getFullYear()), fav = "", best = 0;
    Object.keys(stats.genres).forEach(function (g) { if (stats.genres[g] > best) { best = stats.genres[g]; fav = g; } });
    var label = fav ? ((AISLES.filter(function (a) { return a.key === fav; })[0] || {}).label || fav) : "—";
    var owed = 0; items.forEach(function (it) { if (it.aisles.indexOf("cw") !== -1) owed += daysLate(it) * 0.5; });
    var hrs = Math.floor(stats.ms / 3600000);
    return [[String(stats.rented[y] || 0), "Tapes in " + y], [label, "Top aisle"], [hrs + (hrs === 1 ? " hr" : " hrs"), "Watched"], ["$" + owed.toFixed(2), "Late fees"]];
  }
  function memberCardHTML() {
    var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var since = prefs.memberSince.split("-");
    return '<div class="member"><div class="mlogo">' + esc(prefs.storeName) + '</div><div class="mkind">MEMBERSHIP CARD</div>' +
      '<div class="mname">' + esc(prefs.memberName || "Valued member") + '</div><div class="mrow"><span>NO. ' + memberNumber() + "<br>MEMBER SINCE " +
      months[(parseInt(since[1], 10) || 1) - 1] + " " + since[0] + '</span><span class="mbar"></span></div>' +
      '<div class="mstats">' + statsCells().map(function (c) { return "<div><b>" + esc(c[0]) + "</b><span>" + esc(c[1]) + "</span></div>"; }).join("") + "</div></div>";
  }
  function frontDesk(idx) {
    openModal('<div class="panel" role="dialog" aria-label="Front desk"><div class="desk">' + memberCardHTML() +
      '<div class="desk-side"><label for="storeName">Store name</label><input class="field" id="storeName" data-m="input" value="' + esc(prefs.storeName) + '" maxlength="28">' +
      '<label for="memberName">Name on your card</label><input class="field" id="memberName" data-m="input" data-submit="savenames" value="' + esc(prefs.memberName || "") + '" maxlength="24" placeholder="Your name">' +
      '<div class="actions"><button class="btn primary" data-m="savenames">Save names</button></div></div></div>' +
      '<div class="actions grid3">' +
      '<button class="btn" data-m="account">Your Stremio card: ' + (account ? "Signed in" : "Sign in") + "</button>" +
      '<button class="btn" data-m="toggle-sound">Store sounds: ' + (!prefs.sound ? "Off" : prefs.quiet ? "Quiet" : "On") + "</button>" +
      '<button class="btn" data-m="toggle-calm">Atmosphere: ' + ({ full: "Full", calm: "Calm · no flashing or flicker", light: "Light · fastest, mostly still" })[prefs.atmos] + "</button>" +
      '<button class="btn" data-m="outside">Outside: weather &amp; decorations</button>' +
      '<button class="btn" data-m="toggle-outside">Front door: ' + ({ sunset: "Always sunset", clock: "Follows the clock", skip: "Skip it" }[prefs.outside || "sunset"]) + "</button>" +
      '<button class="btn" data-m="office">Staff only: back office</button>' +
      '<button class="btn primary full" data-m="close">Back to the aisles</button></div></div>');
    if (idx) { modal.idx = Math.min(idx, modal.els.length - 1); modalFocus(true); }
  }
  // the back office: the TV, the player, the clerks' lists, and the tools for when something's wrong
  function backOffice(idx) {
    openModal('<div class="panel" role="dialog" aria-label="Back office">' + clerkHead(shiftNow() === "day" ? "Mind the boxes. Everything technical lives back here." : "Staff only. Don't touch the wires.") +
      '<div class="actions grid3">' +
      '<button class="btn" data-m="psettings">Player settings</button>' +
      '<button class="btn" data-m="toggle-crt">Screensaver: ' + (prefs.trailers ? "Trailers" : "Stills only") + "</button>" +
      '<button class="btn" data-m="lists">Clerks &amp; back room</button>' +
      '<button class="btn" data-m="staffinfo">Staff Picks: ' + (staffOn() ? "From Letterboxd" : "Set up") + "</button>" +
      '<button class="btn" data-m="checks">Test my setup</button>' +
      '<button class="btn" data-m="diag">Diagnostics</button>' +
      '<button class="btn" data-m="resetask">Reset this TV</button>' +
      '<button class="btn primary wide" data-m="desk">Back to the front desk</button></div>' +
      '<p class="note">' + "Version " + APP_VERSION + " · updated " + APP_UPDATED + "</p></div>", function () { frontDesk(0); });
    modal.view = "office";
    if (idx) { modal.idx = Math.min(idx, modal.els.length - 1); modalFocus(true); }
  }
  function ago(t) {
    if (!t) return "never";
    var s = Math.round((Date.now() - t) / 1000);
    return s < 60 ? s + "s ago" : s < 3600 ? Math.round(s / 60) + " min ago" : Math.round(s / 3600) + " h ago";
  }
  function storageUse() {
    try {
      var n = 0, big = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i), v = localStorage.getItem(k) || ""; n += (k.length + v.length) * 2; if (v.length > 50000) big.push(k.replace("fnv-", "") + " " + Math.round(v.length * 2 / 1024) + " KB"); }
      return Math.round(n / 1024) + " KB in use" + (big.length ? " (" + big.join(", ") + ")" : "");
    } catch (e) { return "can't tell"; }
  }
  function diagnosticsPanel() {
    var ca = diag.catalog, ac = diag.account, lp = diag.lastPlay, ls = diag.lastSearch;
    var rows = [
      ["Version", APP_VERSION + " · " + (window.tizen ? "Tizen" : "browser") + " · up " + ago(diag.started).replace(" ago", "")],
      ["Right now", landingOn ? "Outside" : P ? "Playing a tape" : modal ? "At a panel" : "In the aisles"],
      ["Shelves", (onSample ? "sample shelf" : live ? "live" : "last time's") + " · " + items.length + " tapes · aisle " + ((allAisles().filter(function (a) { return a.key === aisle; })[0] || {}).label || aisle)],
      ["Catalog", !ca ? "still checking" : ca.ok ? "answering (" + ago(ca.t) + ")" : "didn't answer (" + ago(ca.t) + ")"],
      ["Stremio account", !account ? "not signed in" : !ac ? "signed in · loading" : ac.ok ? "signed in · " + ac.info : "signed in · didn't load (" + ago(ac.t) + ")"],
      ["Add-ons", installedAddons.length ? installedAddons.map(function (ad) { var n = diag.clean((ad.manifest && ad.manifest.name) || "Add-on"), f = diag.addons[n]; return n + (f ? " ✗ " + f.what + " " + ago(f.t) : " ✓"); }).join(" · ") : "none loaded"],
      ["Last copy search", ls ? ls.n + " copies from " + (ls.total - ls.failed.length) + " of " + ls.total + " add-ons" + (ls.failed.length ? " · no answer: " + ls.failed.join(", ") : "") + " (" + ago(ls.t) + ")" : "none yet"],
      ["Last tape", lp ? lp.result + " · " + lp.copy + (lp.engine ? " · " + lp.engine + " player" : "") + " (" + ago(lp.t) + ")" : "none yet"],
      ["Streaming server", prefs.server ? (lanHost((parseUrl(prefs.server) || {}).hostname) ? "set (home network)" : "set") : "not set"],
      ["Atmosphere", prefs.atmos + " · sound " + (!prefs.sound ? "off" : prefs.quiet ? "quiet" : "on")],
      ["Saved on this TV", storageUse()],
      ["Loader", (function () { try { var g = JSON.parse(localStorage.getItem("fsn-good-video") || "null"), b = localStorage.getItem("fsn-bad-ref-video"); return g && g.ref ? "release " + g.ref + (b ? " · skipped broken " + b : "") : "not using releases yet"; } catch (e) { return "unknown"; } })()]
    ];
    var errs = diag.errors.length ? diag.errors.map(function (e) { return "<li><b>" + esc(ago(e.t)) + "</b> " + esc(e.msg) + "</li>"; }).join("") : "<li>Nothing has gone wrong since the store opened.</li>";
    openModal('<div class="panel diag" role="dialog" aria-label="Diagnostics"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">i</div><p>How the store is doing. If something\'s not right, take a photo of this screen.</p></div>' +
      '<dl class="diag-list">' + rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl>" +
      '<h4 class="diag-h">Recent problems</h4><ol class="diag-errs">' + errs + "</ol>" +
      '<div class="actions"><button class="btn" data-m="diag">Refresh</button><button class="btn" data-m="office">Back to the back office</button></div></div>', function () { backOffice(0); });
  }
  function outsidePanel(idx) {
    var typed = $("wxPlace") && modal && modal.view === "outside" ? $("wxPlace").value : null;
    var m = prefs.wxMode || "live", p = prefs.wxPlace, where = p ? p.name + (p.admin ? ", " + p.admin : "") : "";
    var now = m !== "live" ? "The weather outside is set to " + WX_WORDS[m] + ", whatever it's really doing." :
      !p ? "I'll show the real weather once I know your suburb." :
      wxNow && wxNow.key === placeKey(p) ? "Right now in " + esc(where) + ": " + WX_WORDS[codeKind(wxNow.code, wxNow.precip)] + "." : "Checking the weather in " + esc(where) + "…";
    var deco = prefs.deco || "auto", dk = decoKind();
    var decoLabel = deco === "auto" ? "Automatic" + (dk === "halloween" ? " (Halloween now)" : dk === "xmas" ? " (Christmas now)" : "") :
      { halloween: "Always Halloween", xmas: "Always Christmas", none: "None" }[deco];
    var wxLabel = m === "live" ? "Live" + (p ? " · " + esc(p.name) : "") : { clear: "Always clear", drizzle: "Always drizzly", rain: "Always raining", storm: "Always stormy", fog: "Always foggy", snow: "Always snowing" }[m];
    openModal('<div class="panel" role="dialog" aria-label="Outside"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">☂</div><p>' + now + "</p></div>" +
      '<div class="desk-side"><label for="wxPlace">Your suburb or town (for live weather)</label>' +
      '<input class="field" id="wxPlace" data-m="input" data-submit="wxsave" value="' + esc(p && !p.auto ? p.name : "") + '" maxlength="40" placeholder="' + esc(p ? p.name : "e.g. Brunswick") + '">' +
      '<div class="actions"><button class="btn primary" data-m="wxsave">Save suburb</button></div></div>' +
      '<div class="actions">' +
      '<button class="btn" data-m="wx-mode">Weather: ' + wxLabel + "</button>" +
      '<button class="btn" data-m="deco-mode">Decorations: ' + decoLabel + "</button>" +
      '<button class="btn" data-m="door-mode">Front door: ' + ({ sunset: "Always sunset", clock: "Follows the clock", skip: "Skip it" }[prefs.outside || "sunset"]) + "</button>" +
      '<button class="btn primary" data-m="golook">Go outside and look</button>' +
      '<button class="btn" data-m="desk">Back to the front desk</button></div>' +
      '<p class="note">Live weather comes from Open-Meteo, a free service. It checks every 20 minutes while you\'re outside.</p></div>');
    modal.view = "outside";
    if (typed !== null && $("wxPlace")) $("wxPlace").value = typed;
    if (idx) { modal.idx = Math.min(idx, modal.els.length - 1); modalFocus(true); }
  }
  function saveWxPlace() {
    var v = ($("wxPlace").value || "").trim();
    if (!v) { delete prefs.wxPlace; save("fnv-prefs", prefs); wxNow = null; refreshWeather(true); return outsidePanel(0); }
    toast("Looking up " + v + "…");
    geocode(v).then(function (pl) {
      if (!pl) { toast("Couldn't find " + v + ". Try a nearby town."); return; }
      prefs.wxPlace = pl; prefs.wxMode = "live"; save("fnv-prefs", prefs); wxNow = null;
      toast("Weather set to " + pl.name + (pl.admin ? ", " + pl.admin : ""));
      refreshWeather(true);
      if (modal && modal.view === "outside") outsidePanel(0);
    }, function () { toast("Couldn't reach the weather service just now."); });
  }
  function staffInfo() {
    openModal('<div class="panel" role="dialog" aria-label="Staff Picks"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">★</div><p>' +
      (staffOn() ? "Staff Picks is stocked from Letterboxd's popular list through your Stremboxd addon." :
        "Staff Picks fills itself from Letterboxd's popular films. To switch it on:") + "</p></div>" +
      (staffOn() ? "" : '<ol class="steps"><li>On your phone or computer, go to <b>stremboxd.com/configure</b></li><li>Enter your Letterboxd username (no login needed) and turn on the <b>Popular</b> catalog</li><li>Install it into Stremio, then come back here and choose <b>Stremio</b> then <b>Refresh my shelves</b></li></ol>') +
      '<div class="actions"><button class="btn" data-m="office">Back to the back office</button></div></div>');
  }
  function resetAsk() {
    openModal('<div class="panel" role="dialog" aria-label="Reset this TV"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">!</div><p>Reset this TV? This signs out of Stremio and clears the store name, your settings, the return slot and saved places on this TV. ' +
      "Your Stremio library and watch progress are safe in your account.</p></div>" +
      '<div class="actions"><button class="btn" data-m="office">Keep everything</button><button class="btn primary" data-m="resetyes">Yes, reset this TV</button></div></div>');
  }
  function resetTV() {
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf("fnv-") === 0 && ["fnv-store-cache", "fnv-good", "fnv-bad-ref", "fnv-boot-pending", "fnv-boot-fails"].indexOf(k) === -1 /* the loader's copy of this page and its release notes */; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    toast("Resetting…", 2000);
    setTimeout(function () { location.reload(); }, 600);
  }
  function saveNames() {
    var sn = ($("storeName").value || "").trim(), mn = ($("memberName").value || "").trim();
    prefs.storeName = sn || "Friday Night Video"; prefs.memberName = mn;
    save("fnv-prefs", prefs); applyStoreName(); updateCounter(); sfx("chime");
    redrawShelves(); clampFocus();
    if ($("oSvg")) updateLanding();
    frontDesk(0); toast("Welcome to " + prefs.storeName + "!");
  }
  function welcomeCard() {
    if (modal) return;
    openModal('<div class="panel" role="dialog" aria-label="Membership card"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">:)</div><p>You\'re signed in. Here\'s your card. Your shelves are stocked.</p></div>' +
      memberCardHTML() + '<div class="actions"><button class="btn primary" data-m="close">Start browsing</button><button class="btn" data-m="desk">Put my name on it</button></div></div>');
  }

  // ---------- test my setup ----------
  function runChecks() {
    var rows = [
      { id: "c1", label: "Stremio's movie catalog" },
      { id: "c2", label: "Stremio sign-in server" },
      { id: "c3", label: "Poster and backdrop images" },
      { id: "c4", label: "Handing titles to the Stremio app" },
      { id: "c5", label: "Trailers on the CRT" },
      { id: "c6", label: "Built-in player" },
      { id: "c7", label: "Streaming server for torrents" }
    ];
    openModal('<div class="panel" role="dialog" aria-label="Test my setup"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">✓</div><p>Checking the store. This takes a few seconds.</p></div><ul class="checks">' +
      rows.map(function (r) { return '<li id="' + r.id + '"><span class="mark wait">…</span><span><b>' + esc(r.label) + '</b><br><span class="d">Checking…</span></span></li>'; }).join("") +
      '</ul><div class="actions"><button class="btn" data-m="checks">Run again</button><button class="btn" data-m="office">Back to the back office</button></div></div>');
    function set(id, state, text) {
      var li = $(id); if (!li) return;
      var m = li.querySelector(".mark"); m.className = "mark " + state; m.textContent = state === "ok" ? "✓" : state === "bad" ? "✗" : "–";
      li.querySelector(".d").textContent = text;
    }
    getJSON(CINEMETA + "/catalog/movie/top.json", 7000).then(function () { set("c1", "ok", "Reachable. Aisles stock themselves live."); },
      function () { set("c1", "bad", "Can't reach it, so you're seeing the sample shelf. Check the TV's internet connection."); });
    var acc = account ? api("addonCollectionGet", { type: "AddonCollectionGet", authKey: account.authKey, update: true }).then(function () { return "Signed in and working."; })
                      : timeoutP(getJSON(LINK + "create?type=Create", 7000), 8000).then(function () { return "Reachable. You can sign in from the front desk."; });
    acc.then(function (t) { set("c2", "ok", t); }, function (e) { set("c2", "bad", "Blocked or failing (" + e.message + "). Check the TV's internet connection, then try again later. If it keeps failing, Stremio may be having trouble."); });
    var img = new Image(), done = false;
    img.onload = function () { if (!done) { done = true; set("c3", "ok", "Images load."); } };
    img.onerror = function () { if (!done) { done = true; set("c3", "bad", "Images don't load, so boxes use drawn covers."); } };
    setTimeout(function () { if (!done) { done = true; set("c3", "bad", "Images are timing out."); } }, 8000);
    img.src = "https://images.metahub.space/poster/medium/tt0133093/img?check=" + Date.now();
    if (window.tizen && tizen.application) set("c4", "ok", "Running as a TV app. Rent a tape to try it.");
    else set("c4", "skip", "Only works on the TV, not in this preview.");
    ensureWebapis(function (ok) { set("c6", ok ? "ok" : "skip", ok ? "Samsung's own video player is available (best for 4K)." : "Using the web video player. On the TV this should switch to Samsung's player."); });
    if (!prefs.server) set("c7", "skip", "Not set up. Only needed for plain torrents, not cached Real-Debrid copies.");
    else timeoutP(fetch(prefs.server + "/settings").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); }), 6000)
      .then(function () { set("c7", "ok", "Reachable at " + prefs.server + "."); }, function (e) { set("c7", "bad", "Can't reach " + prefs.server + " (" + e.message + "). Is Stremio running on that computer?"); });
    set("c5", "skip", "Can't be checked automatically. Stop on a tape for 3 seconds: if the CRT shows a YouTube error, switch the CRT to stills here.");
  }

  // ---------- lighting, closing time, announcements ----------
  var toastT = null;
  function toast(msg, ms) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, ms || 3500);
  }
  var announced = {};
  var wasNight = null, wasClosed = null, lastShift = null;
  function updateLighting() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes(), night = h >= 22 || h < 6, closed = h < 6;
    document.body.classList.toggle("night", night);
    // lights go down while you're here: one clunk at 10pm, three at closing
    if (wasNight === false && night && !closed) lightsClunk(0.7);
    if (wasClosed === false && closed) {
      [0, 750, 1500].forEach(function (ms, i) { setTimeout(function () { document.body.classList.add("lo" + (i + 1)); lightsClunk([0.6, 0.5, 0.4][i]); }, ms); });
    } else if (wasClosed === null && closed) document.body.classList.add("lo1", "lo2", "lo3");
    if (!closed) document.body.classList.remove("lo1", "lo2", "lo3");
    wasNight = night; wasClosed = closed;
    var sh = shiftNow();
    if (lastShift && sh !== lastShift && !P) {
      sfx("shiftbell");
      toast(sh === "night" ? "Dave's knocked off. Gus has the counter for the night shift." : "Morning! Dave's back on the counter.", 6000);
    }
    if (!P) lastShift = sh;
    // keep the weather fresh while you browse, and let the roof hear it
    refreshWeather();
    if (hum && !P && !landingOn && hum.wx !== wxKind()) { stopHum(); startHum(true); }
    var day = d.toDateString();
    if (h === 23 && m >= 45 && !announced["close" + day]) {
      announced["close" + day] = 1; sfx("chime");
      toast("Attention " + prefs.storeName + " shoppers: we close in 15 minutes. Please bring your selections to the counter.", 9000);
    }
    if (h === 0 && m < 5 && !announced["shut" + day]) {
      announced["shut" + day] = 1; sfx("chime");
      toast("We're closed. Lights are down, but you're welcome to stay as long as you like.", 9000);
    }
  }

  // ---------- demo loop screensaver ----------
  var lastInput = Date.now(), demoOn = false, demoT = null, demoTrailerT = null;
  var IDLE_MS = 180000;
  var DEMO_MAX_MS = 30 * 60000, demoStart = 0;
  function startDemo() {
    demoOn = true; demoStart = Date.now();
    var d = $("demo"); d.hidden = false;
    d.innerHTML = '<div class="crt"><div class="screen"><div class="tv-still" id="dStill"></div><div class="tv-frame" id="dFrame"></div>' +
      '<div class="tv-card" id="dCard"></div><div class="scan"></div><div class="tv-osd"><span>PLAY ▶</span><span>' + esc(prefs.storeName.toUpperCase()) + '</span></div></div>' +
      '<div class="crt-base"><span class="brand">VIDEOVISION</span><span class="led"></span></div></div><div class="demo-hint">Press any button to come back in</div>';
    $("tvFrame").innerHTML = "";
    demoNext();
  }
  function demoNext() {
    clearTimeout(demoT); clearTimeout(demoTrailerT);
    var pool = items.filter(function (it) { return it.aisles.length && it.type !== "series" && visible(it); });
    if (!pool.length || !demoOn) return;
    var it = pickOne(pool), seq = ++demoSeq;
    function current() { return demoOn && demoSeq === seq; }
    $("dFrame").innerHTML = ""; $("dStill").style.backgroundImage = "";
    var card = $("dCard"); card.style.display = "";
    // nobody's watched for half an hour: stop the trailers and leave a still card, so the TV's own screensaver can take over
    if (Date.now() - demoStart > DEMO_MAX_MS) {
      card.innerHTML = '<span class="k">' + esc(prefs.storeName.toUpperCase()) + '</span><span class="t">Back in a bit</span><span class="s">Press any button to come back in</span>';
      return;
    }
    card.innerHTML = '<span class="k">NOW PLAYING AT ' + esc(prefs.storeName.toUpperCase()) + '</span><span class="t">' + esc(it.name) + '</span><span class="s">' +
      esc([it.year, it.director || (it.genres || [])[0]].filter(Boolean).join(" · ")) + "</span>";
    if (live) getMeta(it).then(function (m) {
      if (!current()) return;
      if (m.background) { var img = new Image(); img.onload = function () { if (!current()) return; $("dStill").style.backgroundImage = cssUrl(m.background); card.style.display = "none"; }; img.src = m.background; }
      if (prefs.trailers && !isLight() && m.trailers.length) demoTrailerT = setTimeout(function () {
        if (!current()) return;
        var hr = new Date().getHours(), hush = !prefs.sound || hr >= 22 || hr < 7;   // no trailer sound late at night
        $("dFrame").innerHTML = ytHTML(m.trailers[0], { mute: hush, loop: true, title: "Trailer: " + it.name });
        ytWatch($("dFrame").querySelector("iframe"));
      }, 2500);
    });
    demoT = setTimeout(demoNext, live ? 45000 : 12000);
  }
  var demoSeq = 0;
  function stopDemo() {
    demoOn = false; demoSeq++; clearTimeout(demoT); clearTimeout(demoTrailerT);
    var d = $("demo"); d.hidden = true; d.innerHTML = "";
    lastInput = Date.now(); tvCurrent = null; applyFocus(true);
  }
  function noteInput(e) {
    lastInput = Date.now(); sleepHold = false;
    if (demoOn) { stopDemo(); e.preventDefault(); e.stopPropagation(); }
  }
  window.addEventListener("keydown", noteInput, true);
  window.addEventListener("click", noteInput, true);
  window.addEventListener("touchstart", function () { lastInput = Date.now(); }, true);
  var lastLightAt = Date.now();
  setInterval(function () {
    var now = Date.now();
    if (!demoOn && !modal && !P && !landingOn && !sleepHold && now - lastInput > IDLE_MS) startDemo();
    if (P) return;
    if (now - lastLightAt >= 30000) { lastLightAt = now; updateLighting(); }
  }, 5000);

