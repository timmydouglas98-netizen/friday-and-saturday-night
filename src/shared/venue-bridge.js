  // ---------- shared venue bridge (Friday Night Video <-> Saturday Night Karaoke <-> Strip Mall) ----------
  var FSN = (function () {
    var MAP = { street: "street.html", video: "store.html", karaoke: "bar.html" };
    var bootInfo = { venue: null, version: null, at: 0, done: false, timer: null };

    function viaLoader() {
      try { return sessionStorage.getItem("fsn-via-loader") === "1"; } catch (e) { return false; }
    }
    function idbRead(venue, cb) {
      var fin = false, guard = null;
      function out(nextHtml, curHtml) {
        if (fin) return;
        fin = true;
        if (guard) clearTimeout(guard);
        cb(nextHtml || null, curHtml || null);
      }
      if (!window.indexedDB) { out(null, null); return; }
      guard = setTimeout(function () { out(null, null); }, 800);
      try {
        var req = indexedDB.open("fsn-cache", 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("venues")) db.createObjectStore("venues");
        };
        req.onsuccess = function () {
          try {
            var db = req.result, tx = db.transaction("venues", "readonly"), st = tx.objectStore("venues");
            var gNext = st.get("next-" + venue), gCur = st.get(venue);
            var nextVal = null, curVal = null, left = 2;
            function step() {
              if (--left === 0) {
                try { db.close(); } catch (e) {}
                out(nextVal, curVal);
              }
            }
            gNext.onsuccess = function () { nextVal = gNext.result || null; step(); };
            gNext.onerror = step;
            gCur.onsuccess = function () { curVal = gCur.result || null; step(); };
            gCur.onerror = step;
          } catch (e) { try { req.result.close(); } catch (x) {} out(null, null); }
        };
        req.onerror = function () { out(null, null); };
        req.onblocked = function () { out(null, null); };
      } catch (e) { out(null, null); }
    }
    function idbPromote(venue, html, cb) {
      var fin = false, guard = null;
      function out(ok) {
        if (fin) return;
        fin = true;
        if (guard) clearTimeout(guard);
        if (cb) cb(ok);
      }
      if (!window.indexedDB) { out(false); return; }
      guard = setTimeout(function () { out(false); }, 800);
      try {
        var req = indexedDB.open("fsn-cache", 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("venues")) db.createObjectStore("venues");
        };
        req.onsuccess = function () {
          try {
            var db = req.result, tx = db.transaction("venues", "readwrite"), st = tx.objectStore("venues");
            st.put(html, venue);
            st["delete"]("next-" + venue);
            tx.oncomplete = function () { try { db.close(); } catch (e) {} out(true); };
            tx.onerror = function () { try { db.close(); } catch (e) {} out(false); };
            tx.onabort = function () { try { db.close(); } catch (e) {} out(false); };
          } catch (e) { try { req.result.close(); } catch (x) {} out(false); }
        };
        req.onerror = function () { out(false); };
        req.onblocked = function () { out(false); };
      } catch (e) { out(false); }
    }

    function commitBoot(venue, version, cb) {
      if (bootInfo.done || !venue) { if (cb) cb(); return; }
      bootInfo.done = true;
      if (bootInfo.timer) { clearTimeout(bootInfo.timer); bootInfo.timer = null; }
      var called = false;
      function done() { if (!called) { called = true; if (cb) cb(); } }
      try {
        var pendKey = "fsn-boot-pending-" + venue;
        var pend = localStorage.getItem(pendKey);
        if (!pend) return done();
        function finish(cached) {
          if (cached) {
            try {
              localStorage.setItem("fsn-good-" + venue, JSON.stringify({ ref: pend, version: version, t: Date.now() }));
              if (localStorage.getItem("fsn-bad-ref-" + venue) && localStorage.getItem("fsn-bad-ref-" + venue) !== pend) {
                localStorage.removeItem("fsn-bad-ref-" + venue);
              }
            } catch (e) {}
          }
          try { localStorage.removeItem(pendKey); } catch (e) {}
          try { localStorage.removeItem("fsn-boot-fails-" + venue); } catch (e) {}
          try { sessionStorage.removeItem("fsn-next-html-" + venue); } catch (e) {}
          done();
        }
        idbRead(venue, function (nextHtml, curHtml) {
          var html = nextHtml;
          if (!html) {
            try { html = sessionStorage.getItem("fsn-next-html-" + venue); } catch (e) {}
          }
          if (html) {
            idbPromote(venue, html, function (ok) {
              if (ok) {
                finish(true);
              } else {
                var lsOk = false;
                try { localStorage.setItem("fsn-cache-" + venue, html); lsOk = true; } catch (e) {}
                finish(lsOk);
              }
            });
          } else {
            var existing = curHtml;
            if (!existing) {
              try { existing = localStorage.getItem("fsn-cache-" + venue); } catch (e) {}
            }
            var alreadyCached = !!(existing && (!version || existing.indexOf('APP_VERSION = "' + version + '"') !== -1));
            finish(alreadyCached);
          }
        });
      } catch (e) { done(); }
    }

    function navigate(venue) {
      try { if (venue === "video" || venue === "karaoke") localStorage.setItem("fsn-last-venue", venue); } catch (e) {}
      if (viaLoader()) {
        try {
          sessionStorage.setItem("fsn-target", venue);
          sessionStorage.setItem("fsn-instant", "1");
        } catch (e) {}
        location.reload();
      } else {
        location.href = MAP[venue];
      }
    }

    // ---- walking between venues: the street is laid out video store, then the bar to its right, with the Strip as the
    // step-back view. Leaving slides the scene the way you walk; the next venue slides in from the other side. ----
    var POS = { video: 0, karaoke: 1 }, walking = false;
    var didWalkIn = false;
    function walkDir(from, to) {
      if (to === "street") return from && from !== "street" ? "out" : "";
      if (from in POS && to in POS && from !== to) return POS[to] > POS[from] ? "+1" : "-1";
      return "";
    }
    function walkOut(dir, cb) {
      var b = document.body;
      try { sessionStorage.setItem("fsn-walk", JSON.stringify({ dir: dir, t: Date.now() })); } catch (e) {}
      if (!b || !dir) { cb(); return; }
      try {
        document.documentElement.style.background = "#0c0a18";
        b.style.transformOrigin = "50% 60%";
        b.style.transition = "transform .42s cubic-bezier(.55,0,.8,.4), opacity .42s ease-in";
        void b.offsetWidth;
        b.style.transform = dir === "out" ? "scale(.9)" : "translateX(" + (dir === "+1" ? "-14%" : "14%") + ")";
        b.style.opacity = "0";
      } catch (e) {}
      setTimeout(cb, 440);
    }
    (function walkIn() {
      try {
        var w = JSON.parse(sessionStorage.getItem("fsn-walk") || "null");
        sessionStorage.removeItem("fsn-walk");
        var b = document.body;
        if (!w || !b || Date.now() - w.t > 8000) return;
        var from = w.dir === "+1" ? "translateX(14%)" : w.dir === "-1" ? "translateX(-14%)" : w.dir === "out" ? "scale(1.1)" : "";
        if (!from) return;
        didWalkIn = true;
        document.documentElement.style.background = "#0c0a18";
        b.style.transformOrigin = "50% 60%"; b.style.transform = from; b.style.opacity = "0";
        var raf = window.requestAnimationFrame || function (f) { setTimeout(f, 16); };
        raf(function () { raf(function () {
          b.style.transition = "transform .55s cubic-bezier(.2,.65,.3,1), opacity .5s ease-out";
          b.style.transform = ""; b.style.opacity = "";
          setTimeout(function () { b.style.transition = ""; b.style.transformOrigin = ""; }, 650);
        }); });
      } catch (e) {}
    })();

    function go(venue) {
      if (!MAP[venue] || walking) return;
      walking = true;
      var from = bootInfo.venue, dir = from === "street" ? "" : walkDir(from, venue);
      function leave() { walkOut(dir, function () { navigate(venue); }); }
      // If leaving a freshly updated venue that has been up >= 1s, flush its boot confirmation before reloading
      if (bootInfo.venue && !bootInfo.done && (Date.now() - bootInfo.at) >= 1000) {
        commitBoot(bootInfo.venue, bootInfo.version, leave);
      } else {
        leave();
      }
    }

    // Confirm boot on first successful paint (after a short stability settle) so quick switches never trigger false rollbacks
    function ackBoot(venue, version) {
      bootInfo.venue = venue;
      bootInfo.version = version;
      bootInfo.at = Date.now();
      bootInfo.done = false;
      function arm() {
        bootInfo.timer = setTimeout(function () { commitBoot(venue, version); }, 1500);
      }
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(function () { requestAnimationFrame(arm); });
      } else {
        arm();
      }
    }

    return { go: go, viaLoader: viaLoader, ackBoot: ackBoot, isWalking: function () { return didWalkIn; } };
  })();
