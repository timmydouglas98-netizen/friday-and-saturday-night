// The loader's update and rollback rules, tested by running the real loader (src/loader/index.html) and the real venue
// bridge (src/shared/venue-bridge.js) against a pretend TV: in-memory storage and a pretend GitHub.
// Run by src/build.py; or on its own: node src/tests/test-loader.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const SRC = path.join(__dirname, "..");
const loaderHtml = fs.readFileSync(path.join(SRC, "loader", "index.html"), "utf8");
const loaderJs = loaderHtml.slice(loaderHtml.lastIndexOf("<script>") + 8, loaderHtml.lastIndexOf("</script>"));
const bridgeJs = fs.readFileSync(path.join(SRC, "shared", "venue-bridge.js"), "utf8");

function storage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
function makeIDB() {
  const stores = new Map();
  let initialized = false;
  return {
    open() {
      const req = {};
      const db = {
        objectStoreNames: { contains: (n) => stores.has(n) },
        createObjectStore: (n) => { if (!stores.has(n)) stores.set(n, new Map()); },
        transaction(storeName) {
          const tx = {};
          let scheduled = false;
          const finishTx = () => {
            if (scheduled) return;
            scheduled = true;
            setImmediate(() => { if (tx.oncomplete) tx.oncomplete(); });
          };
          tx.objectStore = (n) => {
            const m = stores.get(n || storeName);
            if (!m) throw new Error("missing store: " + n);
            return {
              get(k) {
                const g = {};
                setImmediate(() => {
                  g.result = m.has(k) ? m.get(k) : undefined;
                  if (g.onsuccess) g.onsuccess();
                });
                return g;
              },
              put(v, k) {
                m.set(k, v);
                finishTx();
                return {};
              },
              delete(k) {
                m.delete(k);
                finishTx();
                return {};
              }
            };
          };
          return tx;
        },
        close() {}
      };
      setImmediate(() => {
        req.result = db;
        if (!initialized) {
          initialized = true;
          if (req.onupgradeneeded) req.onupgradeneeded();
        }
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    _get(k) {
      const m = stores.get("venues");
      return m && m.has(k) ? m.get(k) : undefined;
    }
  };
}
// a page the loader will accept as the video store at a given version
function storePage(ver) { return "<html><script>var p='fnv-prefs'; var APP_VERSION = \"" + ver + "\";" + "x".repeat(60000) + "</script>"; }
function sha(t) { return crypto.createHash("sha256").update(t, "utf8").digest("hex"); }
function release(ref, ver, html, opts) {
  opts = opts || {};
  return JSON.stringify({ venues: { video: { ref: ref, version: opts.version || ver, sha256: opts.badHash ? "0".repeat(64) : sha(html) } } });
}

// One cold start of the app: runs the loader and reports what it put on screen and what it fetched.
function boot(tv, github) {
  return new Promise((resolve) => {
    const fetched = [];
    let shown = null, settled = false, safety = null;
    const finish = () => { if (!settled) { settled = true; clearTimeout(safety); resolve({ shown, fetched }); } };
    function XMLHttpRequest() {}
    XMLHttpRequest.prototype.open = function (m, url) { this.url = url; };
    XMLHttpRequest.prototype.send = function () {
      const url = this.url; fetched.push(url);
      setImmediate(() => {
        // the most specific match wins ("/v1/app/store.html" over the bundled "store.html")
        const hit = github.offline ? null : Object.keys(github.files).filter((k) => url.indexOf(k) !== -1).sort((a, b) => b.length - a.length)[0];
        if (hit == null) { this.status = 0; this.responseText = ""; return this.onerror && this.onerror(); }
        this.status = 200; this.responseText = github.files[hit]; this.onload();
      });
    };
    const el = () => ({ className: "", textContent: "", innerHTML: "", firstChild: { nodeValue: "" }, appendChild() {} });
    const document = { getElementById: el, createElement: el, createTextNode: () => ({}), open() {}, write(h) { shown = h; }, close() { finish(); } };
    const ctx = {
      localStorage: tv.local, sessionStorage: tv.session, document, location: { protocol: "https:", replace() {} },
      XMLHttpRequest, setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 30)), setInterval: () => 0, clearInterval() {}, clearTimeout,
      crypto: crypto.webcrypto, TextEncoder, JSON, Math, Date, parseInt, Uint8Array
    };
    if (tv.idb) ctx.indexedDB = tv.idb;
    ctx.window = ctx;
    vm.runInNewContext(loaderJs, ctx);
    safety = setTimeout(finish, 400);
  });
}
// The venue that just opened tells the bridge it started fine (what every venue does once it has painted).
function ackBoot(tv, venue, version) {
  return new Promise((resolve) => {
    const ctx = {
      localStorage: tv.local, sessionStorage: tv.session, location: { reload() {} }, document: {},
      setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 20)), clearTimeout, JSON, Date
    };
    if (tv.idb) ctx.indexedDB = tv.idb;
    ctx.window = ctx;
    vm.runInNewContext(bridgeJs + "\nFSN.ackBoot(" + JSON.stringify(venue) + ", " + JSON.stringify(version) + ");", ctx);
    setTimeout(resolve, 120);
  });
}

let passed = 0, failed = 0;
function check(name, got, want) {
  if (got === want) passed++;
  else { failed++; console.error("FAIL " + name + "\n  got:  " + JSON.stringify(got) + "\n  want: " + JSON.stringify(want)); }
}
const ver = (html) => (html && /APP_VERSION = "([^"]+)"/.exec(html) || [])[1] || null;
const asked = (r, ref) => r.fetched.some((u) => u.indexOf("/" + ref + "/app/store.html") !== -1);

(async function () {
  const tv = { local: storage(), session: storage() };
  const v1 = storePage("1.0"), v2 = storePage("2.0"), v3 = storePage("3.0"), bundled = storePage("0.9");
  const github = { files: { "store.html": bundled }, offline: false };   // "store.html" alone: the copy bundled with the app
  const publish = (ref, html, opts) => { github.files["HEAD/release.json"] = release(ref, ver(html), html, opts); github.files["/" + ref + "/app/store.html"] = html; };

  // first ever start, nothing cached, offline: the copy bundled with the app opens
  github.offline = true;
  let r = await boot(tv, github);
  check("offline first start opens nothing (no bundled copy reachable either)", r.shown, null);
  github.offline = false;

  // a good release arrives and opens; once the store says it started, it's remembered as good and cached
  publish("v1", v1);
  r = await boot(tv, github);
  check("v1 opens", ver(r.shown), "1.0");
  check("v1 is pending until the store confirms it", tv.local.getItem("fsn-boot-pending-video"), "v1");
  await ackBoot(tv, "video", "1.0");
  check("confirmed: no longer pending", tv.local.getItem("fsn-boot-pending-video"), null);
  check("confirmed: remembered as the good release", JSON.parse(tv.local.getItem("fsn-good-video")).ref, "v1");
  check("confirmed: cached for next time", ver(tv.local.getItem("fsn-cache-video")), "1.0");

  // next start: straight from the cache, without downloading the store again
  r = await boot(tv, github);
  check("up to date: opens from the cache", ver(r.shown), "1.0");
  check("up to date: doesn't download the store", asked(r, "v1"), false);

  // a broken release (it never confirms): tried twice, then skipped in favour of the last good one
  publish("v2", v2);
  r = await boot(tv, github);
  check("broken v2, first try", ver(r.shown), "2.0");
  r = await boot(tv, github);
  check("broken v2, second try", ver(r.shown), "2.0");
  r = await boot(tv, github);
  check("after two failed starts, back to the last good release", ver(r.shown), "1.0");
  check("v2 is marked bad", tv.local.getItem("fsn-bad-ref-video"), "v2");
  r = await boot(tv, github);
  check("v2 stays skipped", ver(r.shown), "1.0");
  check("and isn't downloaded again", asked(r, "v2"), false);

  // the fix ships as v3: it opens, confirms, and the bad mark on v2 is cleared
  publish("v3", v3);
  r = await boot(tv, github);
  check("the fixed release opens", ver(r.shown), "3.0");
  await ackBoot(tv, "video", "3.0");
  check("bad mark cleared once a newer release works", tv.local.getItem("fsn-bad-ref-video"), null);
  check("v3 is the good release now", JSON.parse(tv.local.getItem("fsn-good-video")).ref, "v3");

  // a download that doesn't match its fingerprint, or claims the wrong version, is refused
  const v4 = storePage("4.0");
  publish("v4", v4, { badHash: true });
  r = await boot(tv, github);
  check("a download with the wrong fingerprint is refused", ver(r.shown), "3.0");
  check("and nothing is left pending", tv.local.getItem("fsn-boot-pending-video"), null);
  publish("v4", v4, { version: "9.9" });
  r = await boot(tv, github);
  check("a download that isn't the version release.json promised is refused", ver(r.shown), "3.0");

  // GitHub unreachable: the cached store opens
  github.offline = true;
  r = await boot(tv, github);
  check("offline: the cached store opens", ver(r.shown), "3.0");
  github.offline = false;

  // a release.json that's been tampered with (a ref that isn't a plain tag) falls back to the cache
  github.files["HEAD/release.json"] = JSON.stringify({ venues: { video: { ref: "../../evil", version: "5.0" } } });
  r = await boot(tv, github);
  check("a strange ref is ignored", ver(r.shown), "3.0");

  // --- IndexedDB path (staging in next-video, promotion on ackBoot, warm hit, two-strike rollback) ---
  const idbTv = { local: storage(), session: storage(), idb: makeIDB() };
  publish("v1", v1);
  r = await boot(idbTv, github);
  check("idb: v1 opens", ver(r.shown), "1.0");
  check("idb: v1 staged into next-video", ver(idbTv.idb._get("next-video")), "1.0");
  check("idb: sessionStorage staging not used when IDB succeeds", idbTv.session.getItem("fsn-next-html-video"), null);
  check("idb: video slot stays empty until confirmed", idbTv.idb._get("video"), undefined);
  check("idb: v1 is pending until confirmed", idbTv.local.getItem("fsn-boot-pending-video"), "v1");

  await ackBoot(idbTv, "video", "1.0");
  check("idb: promoted to video slot on ackBoot", ver(idbTv.idb._get("video")), "1.0");
  check("idb: next-video cleaned up on ackBoot", idbTv.idb._get("next-video"), undefined);
  check("idb: localStorage fallback cache not written", idbTv.local.getItem("fsn-cache-video"), null);
  check("idb: pending cleared on ackBoot", idbTv.local.getItem("fsn-boot-pending-video"), null);
  check("idb: v1 remembered as good", JSON.parse(idbTv.local.getItem("fsn-good-video")).ref, "v1");

  // warm cache hit reads directly from IDB without re-downloading
  r = await boot(idbTv, github);
  check("idb: warm cache hit opens v1", ver(r.shown), "1.0");
  check("idb: warm cache hit does not re-download v1", asked(r, "v1"), false);

  // two-strike rollback keeps last good v1 intact in IDB
  publish("v2", v2);
  r = await boot(idbTv, github);
  check("idb: broken v2, first try", ver(r.shown), "2.0");
  check("idb: v2 staged in next-video without overwriting video", ver(idbTv.idb._get("video")), "1.0");
  r = await boot(idbTv, github);
  check("idb: broken v2, second try", ver(r.shown), "2.0");
  r = await boot(idbTv, github);
  check("idb: after two failed starts, rolls back to v1 from IDB", ver(r.shown), "1.0");
  check("idb: v2 marked bad", idbTv.local.getItem("fsn-bad-ref-video"), "v2");
  check("idb: v1 remains intact in IDB video slot", ver(idbTv.idb._get("video")), "1.0");
  r = await boot(idbTv, github);
  check("idb: v2 stays skipped and is not re-downloaded", asked(r, "v2"), false);

  // fixed v3 confirms cleanly, promotes in IDB, and clears bad mark
  publish("v3", v3);
  r = await boot(idbTv, github);
  check("idb: fixed v3 opens", ver(r.shown), "3.0");
  await ackBoot(idbTv, "video", "3.0");
  check("idb: v3 promoted to video slot", ver(idbTv.idb._get("video")), "3.0");
  check("idb: next-video cleaned up after v3", idbTv.idb._get("next-video"), undefined);
  check("idb: bad mark cleared after v3 confirms", idbTv.local.getItem("fsn-bad-ref-video"), null);
  check("idb: v3 remembered as good", JSON.parse(idbTv.local.getItem("fsn-good-video")).ref, "v3");

  // storage glitch: pending ref with no staged HTML and mismatched cached version must not overwrite fsn-good
  idbTv.local.setItem("fsn-boot-pending-video", "v9");
  idbTv.local.setItem("fsn-boot-fails-video", "v9|1");
  await ackBoot(idbTv, "video", "9.0");
  check("idb: glitch still clears pending key", idbTv.local.getItem("fsn-boot-pending-video"), null);
  check("idb: glitch still clears fails key", idbTv.local.getItem("fsn-boot-fails-video"), null);
  check("idb: glitch does not point fsn-good at uncached ref", JSON.parse(idbTv.local.getItem("fsn-good-video")).ref, "v3");

  console.log("Loader tests: " + passed + " passed, " + failed + " failed.");
  if (failed) process.exit(1);
})();
