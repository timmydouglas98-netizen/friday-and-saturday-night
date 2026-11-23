  // ---------- diagnostics: what the store knows about its own health, for the Front desk screen ----------
  // Nothing private goes in here: no sign-in key, no add-on addresses (they often carry your debrid key), no library.
  var diag = {
    errors: [], addons: {}, catalog: null, account: null, lastPlay: null, lastSearch: null, started: Date.now(),
    clean: function (x) {
      var t = String(x == null ? "" : (x && x.message) || x);
      if (account && account.authKey) t = t.split(account.authKey).join("•••");
      return t.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[link]").replace(/[A-Za-z0-9_\-]{24,}/g, "•••").slice(0, 160);
    },
    err: function (what, e) {
      diag.errors.unshift({ t: Date.now(), msg: diag.clean(what) + (e ? " (" + diag.clean(e) + ")" : "") });
      if (diag.errors.length > 12) diag.errors.length = 12;
    },
    addonFail: function (name, what, e) { diag.addons[diag.clean(name)] = { t: Date.now(), what: diag.clean(what) }; diag.err(name + " didn't answer for its " + what, e); },
    copies: function (n, total, failed) { diag.lastSearch = { t: Date.now(), n: n, total: total, failed: failed.map(diag.clean) }; },
    play: function (c, result, engine) {
      var d = c.fake ? "test tape" : [c.res === 2160 ? "4K" : c.res ? c.res + "p" : "", c.dv ? "DV" : c.hdr ? "HDR" : "", c.vc, c.ac, c.size ? c.size.toFixed(1) + " GB" : "", c.remux ? "remux" : "",
        c.kind === "instant" ? (c.debrid ? "debrid instant" : "direct") : c.kind, c.addon ? "from " + c.addon : ""].filter(Boolean).join(" · ");
      diag.lastPlay = { t: Date.now(), copy: diag.clean(d), result: diag.clean(result), engine: ({ av: "AVPlay", html: "HTML5", fake: "test" })[engine] || "" };
    }
  };
  window.addEventListener("error", function (e) { diag.err("Script error: " + (e && e.message)); });
  window.addEventListener("unhandledrejection", function (e) { diag.err("Unhandled problem", e && e.reason); });
  function isCalm() { return !!prefs && (prefs.atmos === "calm" || prefs.atmos === "light"); }
  function isLight() { return !!prefs && prefs.atmos === "light"; }
  function applyAtmos() { var h = document.documentElement.classList; h.toggle("calm", isCalm()); h.toggle("light", isLight()); }
  // the pick-up, put-back and flip animations still run, but finish at once in calm mode
  function calmAnim(el, frames, opts) {
    if (isCalm()) { var o = {}; for (var k in opts) o[k] = opts[k]; o.duration = 1; opts = o; }
    return el.animate(frames, opts);
  }
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function store(k, def, fix) {
    var v;
    try { var raw = localStorage.getItem(k); v = raw ? JSON.parse(raw) : undefined; } catch (e) { v = undefined; }
    if (v === undefined || v === null) return def;
    if (Array.isArray(def) ? !Array.isArray(v) : (def === null || isObj(def)) ? !isObj(v) : typeof v !== typeof def) return def;
    if (fix) { try { v = fix(v); } catch (e) { return def; } }
    return v === undefined ? def : v;
  }
  function numIn(v, lo, hi) { return typeof v === "number" && isFinite(v) && v >= lo && v <= hi; }
  function strList(a, max) { return (Array.isArray(a) ? a : []).filter(function (x) { return typeof x === "string" && x.length < 300; }).slice(0, max); }
  function fixPrefs(p) {
    ["sound", "quiet", "trailers", "vhs", "staffSeen", "noAutoNext", "previews", "stillsOnTV", "calm"].forEach(function (k) { if (p[k] !== undefined && typeof p[k] !== "boolean") delete p[k]; });
    ["storeName", "server", "atmos", "nextEp", "subSize", "subPos", "outside", "wxMode", "pick", "audioLang", "subLang", "lastSubLang", "memberName", "memberSince", "remux", "deco"].forEach(function (k) { if (p[k] !== undefined && typeof p[k] !== "string") delete p[k]; });
    if (p.storeName) p.storeName = p.storeName.slice(0, 60);
    if (p.server && !parseUrl(p.server)) p.server = "";
    p.recentSearches = strList(p.recentSearches, 6);
    if (!isObj(p.subOffsets)) p.subOffsets = {};
    Object.keys(p.subOffsets).forEach(function (k) { if (!numIn(p.subOffsets[k], -600000, 600000)) delete p.subOffsets[k]; });
    if (!isObj(p.listRoles)) delete p.listRoles;
    else Object.keys(p.listRoles).forEach(function (k) { if (typeof p.listRoles[k] !== "string") delete p.listRoles[k]; });
    var w = p.wxPlace;
    if (w !== undefined && !(isObj(w) && typeof w.name === "string" && numIn(w.lat, -90, 90) && numIn(w.lon, -180, 180))) delete p.wxPlace;
    return p;
  }
  function fixProgress(m) {
    Object.keys(m).forEach(function (k) { var e = m[k]; if (!isObj(e) || !numIn(e.t, 0, 1e9) || !numIn(e.d || 0, 0, 1e9) || (e.v !== undefined && typeof e.v !== "string")) delete m[k]; else if (!numIn(e.at, 0, 1e13)) e.at = 0; });
    return m;
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var watchedSet = new Set(watched);
  // ---------- keeping the shelves fresh ----------
  // Every tape remembers how many days it has sat on the first screen of an aisle without being picked up. After three
  // days it drifts back for a week to let others have the front of the shelf, then returns with a clean slate.
  // Tapes you've already watched go to the back of their aisle. Both are worked out once, when the store opens,
  // so nothing moves under you while you browse.
  var seen = store("fnv-seen", {}, function (m) {
    var out = {}, today = dayNo();
    Object.keys(m).slice(0, 4000).forEach(function (k) { var e = m[k]; if (k.length < 60 && Array.isArray(e) && numIn(e[0], 0, 99) && numIn(e[1], 0, 1e6) && today - e[1] < 30) out[k] = [e[0], e[1]]; });
    return out;
  });
  var tiredAtOpen = {}, watchedAtOpen = {}, seenT = null;
  (function () {
    var today = dayNo();
    Object.keys(seen).forEach(function (k) { var e = seen[k]; if (e[0] > 2 && today - e[1] <= 7) tiredAtOpen[k] = Math.min(150, 50 + (e[0] - 3) * 25); });
    watched.forEach(function (id) { watchedAtOpen[id] = 1; });
  })();
  function staleness(it) { return (tiredAtOpen[it.id] || 0) + (watchedAtOpen[it.id] || it.seen ? 5000 : 0); }
  function saveSeenSoon() { clearTimeout(seenT); seenT = setTimeout(function () { save("fnv-seen", seen); }, 3000); }
  // the first screenful of an aisle you've walked into: one more day on show for each of those tapes
  function noteShown(key) {
    if (!live || onSample || landingOn || rewindYear() || !RANKED[key] || key === "hold" || key === "rewind") return;
    var list = aisleList(key), today = dayNo(), dirty = false;
    for (var i = 0; i < list.length && i < 18; i++) {
      var id = list[i].id, e = seen[id];
      if (e && e[1] === today) continue;
      seen[id] = [e && today - e[1] <= 7 ? Math.min(9, e[0] + 1) : 1, today]; dirty = true;
    }
    if (dirty) saveSeenSoon();
  }
  function syncWatched() { watchedSet = new Set(watched); }
  function isWatched(id) { return watchedSet.has(id) || !!(byId[id] && byId[id].seen); }
  function allAisles() {
    var cut = 0; while (cut < AISLES.length && AISLES[cut].key !== "tv") cut++;
    var base = AISLES.slice(0, cut).concat(extraAisles).concat(AISLES.slice(cut));
    return base;
  }
  function $(id) { return document.getElementById(id); }

  var seqNo = 0;
  // ties on a shelf are settled by the order tapes arrived in, so the same list always sorts the same way
  function byRank(a, b) { return a.r - b.r || (a.it.seq || 0) - (b.it.seq || 0); }
  function add(it, a) {
    var ex = byId[it.id];
    if (!ex) { ex = it; ex.aisles = []; ex.seq = ++seqNo; byId[it.id] = ex; items.push(ex); }
    else {
      ["poster", "blurb", "year", "progress", "videoId", "seen", "type"].forEach(function (k) { if (!ex[k] && it[k]) ex[k] = it[k]; });
      if (!ex.genres || !ex.genres.length) ex.genres = it.genres;
    }
    if (a && ex.aisles.indexOf(a) === -1) ex.aisles.push(a);
    return ex;
  }
  function fromSample(s, type) {
    return { id: s[0], type: type || "movie", name: s[1], year: s[2], genres: s[3], runtime: s[4], director: s[5], cast: s[6].split(", "), blurb: s[7] };
  }
  var onSample = false;   // the built-in sample shelf is showing; never saved as "last time's shelves"
  function loadSample() {
    onSample = true;
    SAMPLE.forEach(function (s) {
      var it = add(fromSample(s));
      it.genres.forEach(function (g) { if (it.aisles.indexOf(g) === -1) it.aisles.push(g); });
      if (it.genres.indexOf("Crime") !== -1 && it.aisles.indexOf("Thriller") === -1) it.aisles.push("Thriller");
    });
    SAMPLE_TV.forEach(function (s) { add(fromSample(s, "series"), "tv"); });
    items.slice().sort(function (a, b) { return b.year - a.year; }).slice(0, 14)
      .forEach(function (it) { it.aisles.push("new"); });
  }

  // ---------- live data from Stremio's Cinemeta catalog ----------
  // Web addresses from add-ons and services only get used if they're ordinary web links.
  // a whole number in range, or null: season and episode numbers come from add-ons, so they're checked before use
  function intIn(v, lo, hi) { var n = typeof v === "string" && v.trim() !== "" ? Number(v) : v; return typeof n === "number" && isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi ? n : null; }
  function webUrl(u) { u = String(u || ""); return /^https?:\/\/[^\s"<>\\]+$/i.test(u) ? u : ""; }
  // Add-ons must use https, except ones running on your own home network (a computer or NAS at home).
  // A host counts as "home network" only if it is exactly localhost, a complete private IPv4 address,
  // or a single-label name ending in .local. (Prefix checks let names like 10.example.com through.)
  function lanHost(host) {
    host = String(host || "").toLowerCase().replace(/\.$/, "");
    if (host === "localhost") return true;
    if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.local$/.test(host)) return true;
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m) return false;
    var o = [+m[1], +m[2], +m[3], +m[4]];
    if (o.some(function (n, i) { return n > 255 || (m[i + 1].length > 1 && m[i + 1][0] === "0"); })) return false;
    return o[0] === 127 || o[0] === 10 || (o[0] === 192 && o[1] === 168) || (o[0] === 172 && o[1] >= 16 && o[1] <= 31);
  }
  function parseUrl(u) { try { return new URL(String(u || "")); } catch (e) { return null; } }
  function addonOK(url) {
    var u = parseUrl(url);
    if (!u || u.username || u.password) return false;
    return u.protocol === "https:" || (u.protocol === "http:" && lanHost(u.hostname));
  }
  function cssUrl(u) { return "url('" + String(u || "").replace(/'/g, "%27").replace(/[\n\r]/g, "") + "')"; }
  function getJSON(url, ms) {
    return new Promise(function (resolve, reject) {
      var done = false, ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (!done) { done = true; if (ctl) try { ctl.abort(); } catch (e) {} reject(new Error("timeout")); } }, ms);
      fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) { if (!done) { done = true; clearTimeout(t); resolve(j); } })
        .catch(function (e) { if (!done) { done = true; clearTimeout(t); reject(e); } });
    });
  }
  function arr(x) { return Array.isArray(x) ? x : (x ? [x] : []); }
  function fromMeta(m) {
    return {
      id: m.imdb_id || m.id, type: m.type || "movie", name: m.name,
      year: parseInt(m.releaseInfo || m.year, 10) || 0,
      genres: arr(m.genres || m.genre), runtime: parseInt(m.runtime, 10) || 0,
      blurb: m.description || "", poster: webUrl(m.poster)
    };
  }
  // the shelves from last time, shown straight away while Stremio is asked for today's stock
  var SNAP_KEY = "fnv-shelves", SNAP_MAX = 600000;
  // on today's shelves (a tape that only came in for Rewind Night isn't)
  function stocked(it) { return it.aisles.some(function (a) { return a.indexOf("rw") !== 0; }); }
  function saveSnapshot() {
    if (onSample) return;
    try {
      var inRole = {};
      ["day", "night", "back"].forEach(function (r) { (roleItems[r] || []).forEach(function (it) { inRole[it.id] = 1; }); });
      var keep = items.filter(function (it) { return stocked(it) || inRole[it.id]; }).slice(0, 1800);
      var snap = {
        t: Date.now(), extra: extraAisles, choices: catalogChoices,
        roles: { day: (roleItems.day || []).map(function (x) { return x.id; }), night: (roleItems.night || []).map(function (x) { return x.id; }), back: (roleItems.back || []).map(function (x) { return x.id; }) },
        items: keep.map(function (it) {
          return [it.id, it.type, it.name, it.year || 0, it.genres || [], it.poster || "", (it.blurb || "").slice(0, 400), it.aisles, it.progress || 0, it.videoId || "", it.seen ? 1 : 0, it.lastWatched || 0, it.runtime || 0, it.fromList || "", it.rk || 0];
        })
      };
      var str = JSON.stringify(snap);
      // kept well under the TV's storage limit, which it shares with the loader's copy of the store
      if (str.length > SNAP_MAX) { snap.items.forEach(function (a) { a[6] = String(a[6] || "").slice(0, 140); }); str = JSON.stringify(snap); }
      if (str.length > SNAP_MAX) { snap.items.forEach(function (a) { a[6] = ""; }); str = JSON.stringify(snap); }
      if (str.length > SNAP_MAX) { snap.items = snap.items.slice(0, 700); str = JSON.stringify(snap); }
      localStorage.setItem(SNAP_KEY, str);
    } catch (e) { try { localStorage.removeItem(SNAP_KEY); } catch (x) {} }
  }
  function loadSnapshot() {
    var snap = store(SNAP_KEY, null);
    if (!snap || !Array.isArray(snap.items) || !snap.items.length || !numIn(snap.t, 0, 1e13) || Date.now() - snap.t > 14 * 864e5) return false;
    var its = [], ids = {};
    snap.items.forEach(function (a) {
      if (!Array.isArray(a) || typeof a[0] !== "string" || !a[0] || ids[a[0]] || typeof a[2] !== "string") return;
      var it = { id: a[0], type: a[1] === "series" ? "series" : "movie", name: a[2], year: numIn(a[3], 1800, 3000) ? a[3] : undefined,
        genres: strList(a[4], 12), poster: webUrl(a[5]), blurb: typeof a[6] === "string" ? a[6] : "", progress: numIn(a[8], 0, 1) ? a[8] : 0,
        videoId: typeof a[9] === "string" ? a[9] : "", seen: !!a[10], lastWatched: numIn(a[11], 0, 1e13) ? a[11] : 0, runtime: numIn(a[12], 0, 10000) ? a[12] : undefined };
      if (typeof a[13] === "string") it.fromList = a[13];
      if (isObj(a[14])) { it.rk = {}; Object.keys(a[14]).forEach(function (k) { if ((RANKED[k] || k === "staff" || k.indexOf("addon") === 0) && numIn(a[14][k], -1e13, 1e8)) it.rk[k] = a[14][k]; }); }
      it.aisles = strList(a[7], 40);
      it.seq = ++seqNo; ids[it.id] = it; its.push(it);
    });
    if (!its.length) return false;
    var extra = Array.isArray(snap.extra) ? snap.extra.filter(function (x) { return isObj(x) && typeof x.key === "string" && typeof x.label === "string"; }) : [];
    items = its; byId = ids;
    extraAisles = extra; catalogChoices = Array.isArray(snap.choices) ? snap.choices.filter(isObj) : [];
    roleItems = { day: [], night: [], back: [] };
    ["day", "night", "back"].forEach(function (r) { strList(isObj(snap.roles) ? snap.roles[r] : [], 2000).forEach(function (id) { if (byId[id]) roleItems[r].push(byId[id]); }); });
    live = true;
    return true;
  }
  // ---------- the stock: where each aisle's tapes come from ----------
  // Each aisle draws on several of Cinemeta's lists in turn: this week's popular titles, the featured list and, for
  // Classics, popular films from a handful of older years. New Releases come from this year's and last year's lists only.
  // Every tape gets a place on the shelf when it arrives; later deliveries go behind it, so nothing jumps under you.
  // The order is shuffled a little each day and the featured lists start at a different page, so the store restocks.
  var RANKED = { "new": 1, tv: 1, classic: 1, hold: 1, rewind: 1, Animation: 1 };
  GENRE_KEYS.forEach(function (g) { RANKED[g] = 1; });
  var HOME_ORDER = ["Animation", "Horror", "Sci-Fi", "Family", "Romance", "Comedy", "Thriller", "Action", "Drama"];
  function dayNo() { var d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); }
  function daily(n) { var x = Math.sin((n + 1) * 12.9898 + dayNo() * 78.233) * 43758.5453; return x - Math.floor(x); }
  // the one section a tape lives in, the way a real store shelves each title once: it drifts to the back of the others
  function homeOf(it) {
    var g = it.genres || [];
    for (var i = 0; i < HOME_ORDER.length; i++) {
      var k = HOME_ORDER[i];
      if (g.indexOf(k) !== -1 || (k === "Thriller" && (g.indexOf("Crime") !== -1 || g.indexOf("Mystery") !== -1))) return k;
    }
    return "";
  }
  function feed(base, extras, start) { return { base: base, extras: extras || "", skip: start || 0, start: start || 0, done: false, pages: 0, fails: 0 }; }
  function stockPlan() {
    var Y = new Date().getFullYear(), M = CINEMETA + "/catalog/movie/", S = CINEMETA + "/catalog/series/", d = dayNo();
    var plan = {
      "new": { type: "movie", feeds: [feed(M + "year", "genre=" + Y), feed(M + "year", "genre=" + (Y - 1))], tail: 0 },
      tv: { type: "series", feeds: [feed(S + "top"), feed(S + "imdbRating", "", 50 * (d % 3))], tail: 0 },
      classic: { type: "movie", feeds: [], tail: 0 }
    };
    GENRE_KEYS.concat(["Animation"]).forEach(function (g, i) {
      plan[g] = { type: "movie", tail: 0, feeds: [feed(M + "top", "genre=" + encodeURIComponent(g)), feed(M + "imdbRating", "genre=" + encodeURIComponent(g), 50 * ((d + i) % 4))] };
    });
    // Classics: popular films from eight years between 1960 and 1999, a different eight each day
    var pool = [], years = [];
    for (var y = 1960; y <= 1999; y++) pool.push(y);
    while (years.length < 8) years.push(pool.splice(Math.floor(daily(years.length + 7) * pool.length), 1)[0]);
    plan.classic.feeds = years.map(function (yr) { return feed(M + "year", "genre=" + yr); });
    return plan;
  }
  function feedUrl(f) {
    var q = [f.extras, f.skip ? "skip=" + f.skip : ""].filter(Boolean).join("&");
    return f.base + (q ? "/" + q : "") + ".json";
  }
  function rankIn(key, it, r) { if (!it.rk) it.rk = {}; if (it.rk[key] === undefined || r < it.rk[key]) it.rk[key] = r; }
  function placeBatch(key, batches) {
    // batches: one list of metas per feed; interleaved so the front of the shelf mixes every list
    var pg = pager[key], n = batches.length, base = pg.tail, top = base, gen = GENRE_KEYS.indexOf(key) !== -1 || key === "Animation";
    batches.forEach(function (metas, s) {
      (metas || []).forEach(function (m, i) {
        var it0 = fromMeta(m); if (!it0.id || !it0.name) return;
        // a New Release has to be out already: this year's list also carries films still to come
        if (key === "new" && m.released && Date.parse(m.released) > Date.now()) { if (upcoming.length < 40) upcoming.push(it0); return; }
        if (pg.type) it0.type = m.type || pg.type;
        var it = add(it0, key);
        // a wide daily shuffle: the front of the shelf is a different draw from the first hundred or so each day
        var r = base + (i * n + s) * 0.4 + daily(hash(it.id) % 997) * 60 + (gen && homeOf(it) && homeOf(it) !== key ? 40 : 0);
        rankIn(key, it, r); if (r > top) top = r;
      });
    });
    pg.tail = top + 60;
  }
  function pullFeed(key, f, ms) {
    return getJSON(feedUrl(f), ms || 8000).then(function (j) {
      var metas = (j && j.metas) || [];
      f.pages++; f.skip += metas.length;
      if (!metas.length || f.skip - f.start >= MAX_PER_AISLE) f.done = true;
      return metas;
    }, function (e) { f.fails++; if (f.fails > 2) f.done = true; throw e; });
  }
  // ---------- Rewind Night: the whole store as it was in the year you pick ----------
  // Each year gets its own delivery. First that year's and the year before's films, for the New Releases wall: these
  // are asked for while you're still resting on the year in the dial, so they're usually in before you press OK.
  // Then four more years of films and five years of television for the other aisles. Cinemeta has no "this genre in
  // that year" list, so the genre aisles are sorted out here from each film's own genres.
  var eraPager = {};
  function eraKey(ry) { return "rw" + ry; }
  function isEra(it) { return it.aisles.some(function (a) { return a.indexOf("rw") === 0; }); }
  function eraFeed(type, yr) { var f = feed(CINEMETA + "/catalog/" + type + "/year", "genre=" + yr); f.type = type; f.yr = yr; return f; }
  function eraPlace(ry, type, batches) {
    var pg = eraPager[ry]; if (!pg) return;
    // each year's delivery keeps its own places ("rw1994"), so one era's order never leaks into another's
    pg.type = type; pager[eraKey(ry)] = pg; placeBatch(eraKey(ry), batches);
    fillPosters();
  }
  function eraPull(ry, feeds, type) {
    return Promise.all(feeds.map(function (f) { return pullFeed("rewind", f, 8000).then(function (m) { return m; }, function () { return []; }); }))
      .then(function (b) { eraPlace(ry, type, b); return b; });
  }
  // the front of the store for that year; the promise settles once those tapes are on the shelf
  function rewindStock(ry) {
    if (!ry || !live || onSample || !pager) return Promise.resolve();
    var pg = eraPager[ry];
    if (!pg) {
      pg = eraPager[ry] = { type: "movie", tail: 0, feeds: [eraFeed("movie", ry), eraFeed("movie", ry - 1)], oldest: ry - 1, tease: [], dry: 0 };
      pg.front = eraPull(ry, pg.feeds.slice(0, 2), "movie").then(function (b) {
        pg.tease = (b[0] || []).slice(0, 3).map(function (m) { return m && m.name; }).filter(Boolean);
        if (!b[0].length && !b[1].length && eraPager[ry] === pg) delete eraPager[ry];   // nothing came: ask again next time
      });
    }
    return pg.front;
  }
  // the rest of that era, for the genre aisles and Television
  function rewindRest(ry) {
    var pg = eraPager[ry]; if (!pg || pg.rest) return;
    pg.rest = true;
    var films = [2, 3, 4, 5].map(function (n) { return eraFeed("movie", ry - n); }), shows = [0, 1, 2, 3, 4].map(function (n) { return eraFeed("series", ry - n); });
    pg.feeds = pg.feeds.concat(films, shows); pg.oldest = ry - 5;
    var settle = function () {
      if (rewindY !== ry || modal || P || rewinding || landingOn) return;
      renderSigns(); refreshShelvesInPlace(); rebuildRows(); clampFocus(); applyFocus(true);
    };
    eraPull(ry, films, "movie").then(settle);
    eraPull(ry, shows, "series").then(settle);
  }
  // more of the era as you browse to the end of a shelf; when its lists run out, it reaches further back in time
  function eraMore(key, ry) {
    var pg = eraPager[ry]; if (!pg || pg.loading || !live || pg.dry > 4) return;
    var type = key === "tv" ? "series" : "movie";
    var open = pg.feeds.filter(function (f) { return !f.done && f.type === type && (key !== "new" || f.yr >= ry - 1); });
    if (!open.length && key !== "new" && pg.rest && ry - pg.oldest < 14) { pg.oldest--; var nf = eraFeed(type, pg.oldest); pg.feeds.push(nf); open = [nf]; }
    if (!open.length) return;
    var f = open.sort(function (a, b) { return a.pages - b.pages || b.yr - a.yr; })[0];
    pg.loading = true;
    var before = aisleList(key).length;
    pullFeed("rewind", f, 9000).then(function (metas) {
      pg.loading = false;
      eraPlace(ry, type, [metas]);
      var after = aisleList(key).length, here = rewindY === ry && aisle === key;
      pg.dry = after === before ? pg.dry + 1 : 0;
      if (here && !modal && after !== before) refreshShelvesInPlace();
      if (here && after === before && metas.length) setTimeout(function () { loadMore(key); }, 400);
    }, function () { pg.loading = false; });
  }
  function isGenreAisle(key) { return key === "Animation" || GENRE_KEYS.indexOf(key) !== -1; }
  function genreHas(it, key) {
    var g = it.genres || [];
    return g.indexOf(key) !== -1 || (key === "Thriller" && (g.indexOf("Crime") !== -1 || g.indexOf("Mystery") !== -1));
  }
  // A genre aisle (or Television) in the year you rewound to: the era's own delivery first, newest years at the front
  // and each film in its home section, then older favourites the store already had.
  function eraAisle(key, ry) {
    var l = [], ek = eraKey(ry);
    items.forEach(function (it) {
      if (!it.year || it.year > ry || !it.aisles.length) return;
      var inA = it.aisles.indexOf(key) !== -1, mine = it.rk && it.rk[ek] !== undefined, other = !mine && isEra(it), r;
      if (key === "tv") {
        if (it.type !== "series" || !(inA || mine || other)) return;
      } else if (it.type === "series" || !(inA || ((mine || other) && genreHas(it, key)))) return;
      var home = key === "tv" ? "" : homeOf(it);
      // this year's delivery in its own order; tapes that came in for another year by age; then what the store had anyway
      r = mine ? it.rk[ek] + (home && home !== key ? 150 : 0) + (ry - it.year) * 6 :
        other ? 220 + (ry - it.year) * 25 + hash(it.id) % 40 : 260 + (it.rk && it.rk[key] !== undefined ? it.rk[key] : 500);
      l.push({ it: it, r: r });
    });
    return l.sort(byRank).map(function (x) { return x.it; });
  }
  function eraPrice(ry) { return ry < 1980 ? "$1.50" : ry < 1990 ? "$2.49" : ry < 2000 ? "$2.99" : ry < 2010 ? "$3.49" : "$3.99"; }
  function loadLive() {
    eraPager = {}; upcoming = [];
    pager = stockPlan();
    var first = [];
    // the first page of every list, all at once; Classics starts with four of its eight years
    Object.keys(pager).forEach(function (key) {
      var pg = pager[key], feeds = key === "classic" ? pg.feeds.slice(0, 4) : pg.feeds;
      first.push(Promise.all(feeds.map(function (f) {
        return pullFeed(key, f, key === "new" ? 6000 : 8000).then(function (m) { return m; }, function () { return []; });
      })).then(function (batches) { return { key: key, batches: batches }; }));
    });
    return Promise.all(first).then(function (res) {
      var got = 0;
      res.forEach(function (r) { r.batches.forEach(function (b) { got += b.length; }); });
      if (!got) throw new Error("Cinemeta sent no titles");
      // tapes that came from your account (Continue Watching, Your Shelf, your lists) stay on the shelves until
      // the account answers; only the catalog's own stock is replaced
      var mine = function (a) { return a === "cw" || a === "lib" || a === "staff" || a.indexOf("addon") === 0; };
      var kept = onSample ? [] : items.filter(function (it) { return it.aisles.some(mine); });
      ["day", "night", "back"].forEach(function (r) { (roleItems[r] || []).forEach(function (it) { if (kept.indexOf(it) === -1) kept.push(it); }); });
      items = []; byId = {};
      kept.forEach(function (it) { it.aisles = it.aisles.filter(mine); it.rk = {}; byId[it.id] = it; items.push(it); });
      res.forEach(function (r) { placeBatch(r.key, r.batches); });
      fillPosters();
      live = true; onSample = false;
    });
  }
  // anything without art gets Stremio's standard poster for that title
  function fillPosters() {
    items.forEach(function (it) { if (!it.poster && /^tt\d+$/.test(it.id)) it.poster = "https://images.metahub.space/poster/medium/" + it.id + "/img"; });
  }
  // the next page of an aisle, fetched when you get near the end of its shelves
  function loadMore(key) {
    var ry = rewindYear();
    if (ry && !onSample && eraPager[ry] && (key === "new" || key === "tv" || isGenreAisle(key))) return eraMore(key, ry);
    var pg = pager[key];
    if (!pg || !pg.feeds || pg.loading || !live) return;
    var open = pg.feeds.filter(function (f) { return !f.done; });
    if (!open.length) return;
    var f = open.sort(function (a, b) { return a.pages - b.pages; })[0];
    pg.loading = true;
    var before = aisleList(key).length;
    pullFeed(key, f, 9000).then(function (metas) {
      pg.loading = false;
      var b = pg.feeds.map(function (x) { return x === f ? metas : []; });
      placeBatch(key, b);
      fillPosters();
      var after = aisleList(key).length;
      if (aisle === key && !modal && after !== before) refreshShelvesInPlace();
      // a page of nothing but tapes already on this shelf: try the next list straight away
      if (after === before && metas.length) setTimeout(function () { loadMore(key); }, 400);
    }, function () { pg.loading = false; });
  }
  // re-draw the current aisle without jumping the shelves back to the start
  function refreshShelvesInPlace() {
    var st = shelfState, fresh = aisleList(aisle), same = st.key === aisle, has = {};
    // What's already on the shelf stays exactly where it is, and anything new goes on after it. (Sorting the whole
    // aisle again here could slide a tape from one shelf to the other, so the row below showed films you'd just passed.)
    if (same) {
      fresh.forEach(function (it) { has[it.id] = 1; });
      for (var i = 0; same && i < st.shown; i++) if (!has[st.list[i].id]) same = false;
      // a shelf that wasn't full yet is simply drawn again
      if (same && st.shown < shelfChunk(st.faces) * st.nRows && fresh.length > st.shown) same = false;
    }
    if (same) {
      var head = st.list.slice(0, st.shown), inHead = {};
      head.forEach(function (it) { inHead[it.id] = 1; });
      st.list = head.concat(fresh.filter(function (it) { return !inHead[it.id]; }));
      if (rowKinds[focus.r] === "shelf" && focus.c >= rows[focus.r].length - 8) growShelves();
      return;
    }
    var s0 = $("shelf0").scrollLeft, s1 = $("shelf1").scrollLeft, s2 = $("shelf2").scrollLeft, keep = { r: focus.r, c: focus.c };
    renderShelves(true); rebuildRows();
    $("shelf0").scrollLeft = s0; $("shelf1").scrollLeft = s1; $("shelf2").scrollLeft = s2;
    loadVisibleCovers();
    focus = keep; clampFocus();
    var el = rows[focus.r] && rows[focus.r][focus.c];
    Array.prototype.forEach.call(document.querySelectorAll(".store .focused"), function (e) { e.classList.remove("focused"); });
    if (el) { el.classList.add("focused"); if (el.classList.contains("tape")) loadCover(el); }
  }
  // Fuller details (synopsis, cast, director, IMDb rating, trailer) for the back of the box.
  function getMeta(it) {
    var mc = metaCache[it.id];
    if (mc && !(mc.failedAt && Date.now() - mc.failedAt > 60000)) return Promise.resolve(mc);
    var base = {
      description: it.blurb || "", director: arr(it.director), cast: it.cast || [],
      imdbRating: "", runtime: it.runtime ? it.runtime + " min" : "", trailers: [], background: "", videos: []
    };
    if (it.type === "series" && !live) {
      // the sample shelf has no episode list, so the preview gets a pretend box set (never a real show: those wait for Stremio's list)
      for (var se = 1; se <= 2; se++) for (var ep = 1; ep <= 6; ep++)
        base.videos.push({ id: it.id + ":" + se + ":" + ep, season: se, episode: ep, title: "Episode " + ep, overview: "" });
    }
    if (!live) { metaCache[it.id] = base; return Promise.resolve(base); }
    if (metaFlights[it.id]) return metaFlights[it.id];
    var isImdb = /^tt\d+$/.test(it.id), type = it.type === "series" ? "series" : "movie", url;
    if (isImdb) {
      url = CINEMETA + "/meta/" + type + "/" + idPath(it.id) + ".json";
    } else {
      var ad = (installedAddons || []).filter(function (a) {
        return a && addonOK(a.transportUrl) && addonHas(a, "meta", type, it.id);
      })[0];
      if (!ad) { if (installedAddons && installedAddons.length) metaCache[it.id] = base; return Promise.resolve(base); }
      url = addonBase(ad.transportUrl) + "/meta/" + type + "/" + idPath(it.id) + ".json";
    }
    var id0 = it.id;
    return metaFlights[id0] = getJSON(url, 6000).then(function (j) {
      delete metaFlights[id0];
      var m = (j && j.meta) || {};
      var yt = [];
      arr(m.trailers).forEach(function (t) { if (t && t.source) yt.push(t.source); });
      arr(m.trailerStreams).forEach(function (t) { if (t && t.ytId) yt.push(t.ytId); });
      var d = {
        description: m.description || base.description,
        director: arr(m.director).length ? arr(m.director) : base.director,
        cast: arr(m.cast).length ? arr(m.cast).slice(0, 4) : base.cast,
        imdbRating: m.imdbRating || "",
        runtime: m.runtime || base.runtime,
        trailers: yt,
        background: webUrl(m.background) || (isImdb ? "https://images.metahub.space/background/medium/" + encodeURIComponent(it.id) + "/img" : ""),
        videos: arr(m.videos).map(function (v) {
          return { id: String(v.id || ""), season: intIn(v.season, 0, 9999), episode: intIn(v.episode != null ? v.episode : v.number, 0, 99999), title: v.title || v.name || "", overview: v.overview || v.description || "", released: v.released, thumbnail: webUrl(v.thumbnail) };
        })
      };
      // tapes from your library arrive without these: fill them in from the details
      if (!it.genres || !it.genres.length) it.genres = arr(m.genres || m.genre).filter(function (g) { return typeof g === "string"; });
      if (!it.year) it.year = parseInt(m.releaseInfo || m.year, 10) || 0;
      if (!it.blurb && d.description) it.blurb = d.description;
      if (!it.runtime) it.runtime = parseInt(m.runtime, 10) || 0;
      metaCache[it.id] = d; return d;
    }, function (e) { delete metaFlights[id0]; base.failedAt = Date.now(); metaCache[it.id] = base; diag.err("Details for " + it.name + " didn't load", e); return base; });
  }
  var metaFlights = {};

