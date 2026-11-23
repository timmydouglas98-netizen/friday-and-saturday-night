  // ---------- leaving the app (Home, Source, the TV's menus) and coming back ----------
  // A tape is saved, synced and paused on the way out, so nothing plays on behind the TV's back and nothing is lost
  // if the TV closes the app while it's in the background. Coming back, it waits paused for you.
  var hiddenAt = 0;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      hiddenAt = Date.now();
      if (P && P.eng && P.started && !P.ended) {
        saveLocalProgress(false); syncStremio(false); save("fnv-stats", stats);
        P.lastSync = Date.now();
        P.bgAt = P.eng.time();
        if (P.eng.suspend) P.eng.suspend(); else if (!P.eng.paused()) P.eng.pause();
        P.bgPaused = true;
      }
      if (ac && ac.state === "running") { try { ac.suspend(); } catch (e) {} }
      return;
    }
    var away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0; lastInput = Date.now();
    if (ac && ac.state === "suspended" && prefs.sound) { try { ac.resume(); } catch (e) {} }
    if (P && P.bgPaused) {
      P.bgPaused = false;
      // if Samsung's player can't pick up where it was, open the same copy again at the same spot
      if (P.eng && P.eng.restore && !P.eng.restore()) { openCopy(P.idx, P.bgAt || 0); return; }
      if (P.eng && !P.eng.paused()) P.eng.pause();
      if (P.eng) { osd("PAUSE ❚❚", 600000); $("player").classList.add("bar-on"); tickPlayer(); }
      return;
    }
    if (!P && away > 120000) refreshLibraryQuietly();
  });

  // ---------- input: TV remote, keyboard, touch ----------
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 10009, ESC: 27, BKSP: 8, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406, CHUP: 427, CHDOWN: 428, INFO: 457, CAPTION: 10221 };
  document.addEventListener("keydown", function (e) {
    var k = e.keyCode;
    if (landingOn) {
      if (prefs.sound && !amb && !entering) startAmbience();
      if (k === KEY.OK || k === MEDIA.PLAY || k === MEDIA.PLAYPAUSE) enterStore();
      else if (k === KEY.RIGHT) FSN.go("karaoke");
      else if (k === KEY.BACK || k === KEY.ESC) FSN.go("street");
      e.preventDefault(); return;
    }
    if (P) { if (playerKey(k)) e.preventDefault(); return; }
    if (trailerView) { trailerKey(k); e.preventDefault(); return; }
    if (prefs.sound && !hum) startHum();
    if (rewinding) { e.preventDefault(); return; }
    if (osk) { if (boardKey(e)) e.preventDefault(); return; }
    if (modal) {
      var typing = document.activeElement && document.activeElement.tagName === "INPUT";
      if (typing && (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.BKSP)) return;
      // Back or the keyboard's Cancel closes the keyboard and leaves you on the box
      if (typing && (k === KEY.BACK || k === KEY.ESC || k === 65385)) { e.preventDefault(); document.activeElement.blur(); modalFocus(true); return; }
      if (typing && (k === KEY.OK || k === 65376)) {
        e.preventDefault();
        var sub = document.activeElement.getAttribute("data-submit");
        if (sub) { var btn = overlay.querySelector('button[data-m="' + sub + '"]'); if (btn) { modal.idx = modal.els.indexOf(btn); modalFocus(true); activateModal(btn); return; } }
        if (modal.idx < modal.els.length - 1) { modal.idx++; modalFocus(); }
        return;
      }
      if (modal.keys && !typing && modal.keys(k)) { e.preventDefault(); return; }
      // Info on a box flips it over to read the back
      if (k === KEY.INFO && !typing) { if ($("box3d")) flipBox(); e.preventDefault(); return; }
      if ((k === MEDIA.PLAY || k === MEDIA.PLAYPAUSE) && !typing) {
        var cur = modal.els[modal.idx], best = overlay.querySelector('[data-m="playbest"]');
        if (best) { modal.idx = modal.els.indexOf(best); activateModal(best); }
        else {
          var pid = (cur && cur.getAttribute("data-id")) || modal.caseId;
          if (pid && byId[pid]) {
            var pvid = cur && cur.getAttribute("data-vid");
            closeModal(); quickPlay(byId[pid], pvid || "");
          }
        }
        e.preventDefault(); return;
      }
      if (k === KEY.LEFT || k === KEY.UP || k === KEY.RIGHT || k === KEY.DOWN) modalMove(k);
      else if (k === KEY.OK) activateModal(modal.els[modal.idx]);
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP) dismissModal();
      else return;
      e.preventDefault(); return;
    }
    if (k === KEY.LEFT) paced(0, -1);
    else if (k === KEY.RIGHT) paced(0, 1);
    else if (k === KEY.UP) paced(-1, 0);
    else if (k === KEY.DOWN) paced(1, 0);
    else if (k === KEY.OK) activateStore(rows[focus.r][focus.c]);
    else if (k === MEDIA.PLAY || k === MEDIA.PLAYPAUSE) {
      var pe = rows[focus.r] && rows[focus.r][focus.c];
      if (pe && pe.classList.contains("tape")) quickPlay(byId[pe.getAttribute("data-id")]);
    }
    else if (k === KEY.INFO) {
      // Info on a tape: pick it up and turn it over
      var ie = rows[focus.r] && rows[focus.r][focus.c];
      if (ie && ie.classList.contains("tape") && !ie.getAttribute("data-blind") && byId[ie.getAttribute("data-id")]) {
        activateStore(ie);
        var iv = modal && modal.seq;
        setTimeout(function () { if (modal && modal.seq === iv && $("box3d") && !$("box3d").classList.contains("flipped")) flipBox(); }, 650);
      }
    }
    else if (k === KEY.CHUP || k === 33) stepAisle(1);
    else if (k === KEY.CHDOWN || k === 34) stepAisle(-1);
    else if (k === KEY.RED) clerk();
    else if (k === KEY.GREEN) { if (rewindY) setRewind(0); else rewindPanel(); }
    else if (k === KEY.YELLOW) returns();
    else if (k === KEY.BLUE) {
      audioReady();
      if (!prefs.sound) { prefs.quiet = false; setSound(true); } else if (!prefs.quiet) { prefs.quiet = true; save("fnv-prefs", prefs); } else { prefs.quiet = false; setSound(false); }
      setVolume(); toast("Store sounds " + (!prefs.sound ? "off" : prefs.quiet ? "quiet" : "on"));
    }
    else if (k === KEY.BACK || k === KEY.ESC) goOutside();
    else return;
    e.preventDefault();
  });

  document.addEventListener("click", function (e) {
    if (modal || P || landingOn) return;
    var el = e.target.closest(".tape, .sign, #counter .btn"); if (!el) return;
    if (prefs.sound && !hum) startHum();
    if (el.classList.contains("sign")) { selectAisle(el.getAttribute("data-aisle")); return; }
    for (var r = 0; r < rows.length; r++) {
      var c = rows[r].indexOf(el);
      if (c !== -1) {
        var already = focus.r === r && focus.c === c;
        focus = { r: r, c: c }; applyFocus();
        if (already || !el.classList.contains("tape") || el.parentNode.classList.contains("faceout")) activateStore(el);
        return;
      }
    }
  });

  // Samsung remotes only send colour keys to apps that ask for them
  ["ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop", "MediaRewind", "MediaFastForward", "ChannelUp", "ChannelDown", "Info", "Caption"].forEach(function (k) {
    try { tizen.tvinputdevice.registerKey(k); } catch (e) {}
  });
  setInterval(updateOSD, 30000);

  // ---------- open the store ----------
  var status = $("status");
  applyStoreName();
  drawStore();
  var fromSnap = loadSnapshot();
  if (!fromSnap) loadSample();
  tagSpecial(); renderAll();
  if (fromSnap) { $("status").textContent = "Unloading tonight's delivery…"; landStatus("Open until midnight · " + items.length + " tapes in stock"); }
  updateLighting();
  $("tvCard").querySelector(".t").textContent = prefs.storeName;
  if (!prefs.outside) prefs.outside = "sunset";
  showLanding();
  if (!landingOn) noteShown(aisle);
  if (prefs.sound) startHum();
  // The catalog (Cinemeta) and your account load independently: a catalog hiccup no longer skips your library and lists.
  loadLive().then(function () { return true; }, function (e) { diag.err("Stremio's catalog didn't answer", e); return false; }).then(function (catalogOK) {
    diag.catalog = { ok: catalogOK, t: Date.now() };
    var status = $("status");
    if (!catalogOK && onSample && account) {
      // no catalog and no saved shelves: drop the sample's pretend progress before your own arrives
      items.forEach(function (it) { it.aisles = it.aisles.filter(function (a) { return a !== "cw"; }); it.progress = 0; it.lastWatched = 0; });
    }
    if (account) {
      if (catalogOK) { tagSpecial(); renderAll(true); }   // today's stock goes on the shelves straight away
      return refreshAccount(false).then(function () {
        if (catalogOK) restockLater();
        if (!account) { tagSpecial(); renderAll(true); }
        if (!catalogOK) status.textContent = account ? "Tonight's delivery is late · your own tapes are on the shelves" : "Tonight's delivery is late · showing last night's shelves";
        if (landingOn) updateLanding();
      });
    }
    if (!catalogOK) {
      if (fromSnap) { status.textContent = "Tonight's delivery is late · showing last night's shelves"; return; }
      status.textContent = "Open for browsing · sign in at the front desk to stock your own shelves";
      return;
    }
    tagSpecial();
    renderAll(true);
    saveSnapshot();
    status.textContent = items.length + " tapes on the shelves tonight";
    if (landingOn) updateLanding();
    restockLater();
  }).catch(function () {});
  function restockLater() {
    var jobs = [];
    ["classic"].forEach(function (key) { var pg = pager[key]; if (pg) pg.feeds.slice(4).forEach(function (f) { jobs.push([key, f]); }); });
    Object.keys(pager).forEach(function (key) { if (key.indexOf("addon") === 0) return; var pg = pager[key]; pg.feeds.forEach(function (f) { if (!f.done && f.pages < 2) jobs.push([key, f]); }); });
    var n = 0;
    (function next() {
      if (n >= jobs.length) { tagSpecial(); renderSigns(); saveSnapshot(); return; }
      var key = jobs[n][0], f = jobs[n][1]; n++;
      if (f.done || (P && P.eng)) { setTimeout(next, P && P.eng ? 30000 : 50); return; }
      var before = aisleList(key).length;
      pullFeed(key, f, 9000).then(function (metas) {
        var pg = pager[key]; if (!pg) return; placeBatch(key, pg.feeds.map(function (x) { return x === f ? metas : []; }));
        fillPosters();
        if (aisle === key && !modal && aisleList(key).length !== before) refreshShelvesInPlace();
      }, function () {}).then(function () { setTimeout(next, 900); });
    })();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { applyFocus(true); });
  FSN.ackBoot("video", APP_VERSION);
