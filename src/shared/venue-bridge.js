  // ---------- shared venue bridge (Friday Night Video <-> Saturday Night Karaoke <-> Strip Mall) ----------
  var FSN = (function () {
    var MAP = { street: "street.html", video: "store.html", karaoke: "bar.html" };
    var bootInfo = { venue: null, version: null, at: 0, done: false, timer: null };

    function viaLoader() {
      try { return sessionStorage.getItem("fsn-via-loader") === "1"; } catch (e) { return false; }
    }
    function idbPut(venue, html, cb) {
      if (!window.indexedDB) { if (cb) cb(false); return; }
      try {
        var req = indexedDB.open("fsn-cache", 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("venues")) db.createObjectStore("venues");
        };
        req.onsuccess = function () {
          try {
            var db = req.result, tx = db.transaction("venues", "readwrite");
            tx.objectStore("venues").put(html, venue);
            tx.oncomplete = function () { try { db.close(); } catch (e) {} if (cb) cb(true); };
            tx.onerror = function () { try { db.close(); } catch (e) {} if (cb) cb(false); };
          } catch (e) { if (cb) cb(false); }
        };
        req.onerror = function () { if (cb) cb(false); };
      } catch (e) { if (cb) cb(false); }
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
        var html = null;
        try { html = sessionStorage.getItem("fsn-next-html-" + venue); } catch (e) {}
        function finish() {
          try {
            localStorage.setItem("fsn-good-" + venue, JSON.stringify({ ref: pend, version: version, t: Date.now() }));
            localStorage.removeItem(pendKey);
            localStorage.removeItem("fsn-boot-fails-" + venue);
            if (localStorage.getItem("fsn-bad-ref-" + venue) && localStorage.getItem("fsn-bad-ref-" + venue) !== pend) {
              localStorage.removeItem("fsn-bad-ref-" + venue);
            }
            sessionStorage.removeItem("fsn-next-html-" + venue);
          } catch (e) {}
          done();
        }
        if (html) {
          var guard = setTimeout(finish, 800);
          idbPut(venue, html, function (ok) {
            clearTimeout(guard);
            if (!ok) {
              try { localStorage.setItem("fsn-cache-" + venue, html); } catch (e) {}
            }
            finish();
          });
        } else {
          finish();
        }
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

    return { go: go, viaLoader: viaLoader, ackBoot: ackBoot };
  })();
