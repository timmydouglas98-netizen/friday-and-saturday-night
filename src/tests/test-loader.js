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
    let shown = null, settled = false;
    const finish = () => { if (!settled) { settled = true; resolve({ shown, fetched }); } };
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
      XMLHttpRequest, setTimeout: (f) => setImmediate(f), setInterval: () => 0, clearInterval() {}, clearTimeout() {},
      crypto: crypto.webcrypto, TextEncoder, JSON, Math, Date, parseInt, Uint8Array
    };
    ctx.window = ctx;
    vm.runInNewContext(loaderJs, ctx);
    setTimeout(finish, 400);
  });
}
// The venue that just opened tells the bridge it started fine (what every venue does once it has painted).
function ackBoot(tv, venue, version) {
  return new Promise((resolve) => {
    const ctx = {
      localStorage: tv.local, sessionStorage: tv.session, location: { reload() {} }, document: {},
      setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 20)), clearTimeout, JSON, Date
    };
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

  console.log("Loader tests: " + passed + " passed, " + failed + " failed.");
  if (failed) process.exit(1);
})();
