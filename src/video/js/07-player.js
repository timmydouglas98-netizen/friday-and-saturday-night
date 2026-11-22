  // =====================================================================
  // ---------- renting and playing, all inside the store ----------
  // =====================================================================
  function epLabel(vid) {
    var m = String(vid || "").match(/:(\d+):(\d+)$/);
    return m ? "S" + m[1] + "E" + m[2] : "";
  }
  function fmtTime(ms) {
    var t = Math.max(0, Math.floor((ms || 0) / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  // Stremio ids for episodes are "tt123:season:episode"; addons expect the colons as-is
  function idPath(id) { return String(id).split(":").map(encodeURIComponent).join(":"); }
  function addonBase(url) { return String(url || "").replace(/\/manifest\.json.*$/, ""); }
  function addonHas(ad, resource, type, id) {
    var m = ad.manifest || {};
    var res = (m.resources || []).filter(function (r) { return r === resource || (r && r.name === resource); })[0];
    if (!res) return false;
    var types = (res.types || m.types || []), prefixes = res.idPrefixes || m.idPrefixes;
    if (types.length && types.indexOf(type) === -1) return false;
    if (prefixes && prefixes.length && !prefixes.some(function (p) { return String(id).indexOf(p) === 0; })) return false;
    return true;
  }

  // --- what a copy is, read from the addon's description of it ---
  var DEBRID_RX = /\[(rd|ad|pm|dl|tb|ed|oc|pio)[^\]]{0,4}\]|\b(rd|ad|pm|tb|dl)\s?(\+|⚡)|⚡\uFE0F?\s?(rd|ad|pm|tb|dl)\b|real-?debrid|all-?debrid|premiumize|debrid-?link|torbox|easy-?debrid|offcloud/i;
  function parseCopy(st, addonName, transport) {
    var text = [st.name, st.title, st.description].filter(Boolean).join(" ");
    var debrid = !!st.url && (DEBRID_RX.test(st.name || "") || DEBRID_RX.test(text) || /realdebrid|alldebrid|premiumize|debridlink|torbox|debrid/i.test(transport || ""));
    var res = /2160p|\b4k\b|\buhd\b/i.test(text) ? 2160 : /1440p/i.test(text) ? 1440 : /1080p/i.test(text) ? 1080 : /720p/i.test(text) ? 720 : /480p|\bsd\b/i.test(text) ? 480 : 0;
    var hdr = /hdr10|\bhdr\b|\bhlg\b/i.test(text);
    var dv = /\bdv\b|dolby.?vision|\bdovi\b/i.test(text);
    var cam = /\b(cam|hdcam|camrip|telesync|hdts|tc)\b/i.test(text);
    var langs = copyLangs(text);
    var sm = text.match(/([\d.]+)\s*(GB|MB)\b/i);
    var size = sm ? parseFloat(sm[1]) / (/mb/i.test(sm[2]) ? 1024 : 1) : 0;
    var kind = st.url ? (/download|uncached|⏳|⬇/i.test(st.name || "") ? "uncached" : "instant") : (st.infoHash ? "torrent" : "other");
    var first = String(st.title || st.description || "").split("\n")[0];
    var vc = /\b(hevc|[hx]\.?265)\b/i.test(text) ? "HEVC" : /\bav1\b/i.test(text) ? "AV1" : /\b(avc|[hx]\.?264)\b/i.test(text) ? "H.264" : "";
    // what the TV can play itself: Samsung's 2018+ TVs have no DTS
    var ac = /\b(ddp|dd\+|e-?ac-?3|eac3)/i.test(text) ? "DD+" : /\btrue-?hd\b/i.test(text) ? "TrueHD" : /\bdts/i.test(text) ? "DTS" :
      /\b(ac-?3|dd[ .]?[257]\.[01]|dolby digital)\b/i.test(text) ? "DD" : /\baac\b/i.test(text) ? "AAC" : /\bopus\b/i.test(text) ? "Opus" : "";
    var remux = /\bremux\b/i.test(text) || (res === 2160 && size >= 45);
    return { st: st, addon: addonName, res: res, hdr: hdr, dv: dv, dvOnly: dv && !hdr, cam: cam, size: size, kind: kind, debrid: debrid, file: first, langs: langs, vc: vc, ac: ac, remux: remux };
  }
  // what languages a copy's description says it has (Torrentio lists them as flags and words)
  var FLAG_LANG = { "🇬🇧": "en", "🇺🇸": "en", "🇮🇹": "it", "🇪🇸": "es", "🇲🇽": "es", "🇫🇷": "fr", "🇩🇪": "de", "🇷🇺": "ru", "🇺🇦": "uk", "🇵🇹": "pt", "🇧🇷": "pt",
    "🇯🇵": "ja", "🇰🇷": "ko", "🇨🇳": "zh", "🇮🇳": "hi", "🇳🇱": "nl", "🇵🇱": "pl", "🇹🇷": "tr", "🇸🇦": "ar", "🇨🇿": "cs", "🇭🇺": "hu", "🇬🇷": "el", "🇹🇭": "th", "🇻🇳": "vi" };
  function copyLangs(text) {
    var out = [], t = String(text || "");
    for (var f in FLAG_LANG) if (t.indexOf(f) !== -1 && out.indexOf(FLAG_LANG[f]) === -1) out.push(FLAG_LANG[f]);
    var words = { it: /\b(ita|italian)\b/i, es: /\b(spa|spanish|castellano|latino)\b/i, fr: /\b(french|truefrench|vff?)\b/i, de: /\b(ger|german)\b/i,
      ru: /\b(rus|russian)\b/i, hi: /\b(hindi)\b/i, pt: /\b(por|portuguese|dublado)\b/i, en: /\b(eng|english)\b/i };
    for (var k in words) if (words[k].test(t) && out.indexOf(k) === -1) out.push(k);
    if (/multi/i.test(t) && out.indexOf("multi") === -1) out.push("multi");
    return out;
  }
  function langPenalty(c) {
    var want = prefs.audioLang || "en", L = c.langs || [];
    var others = L.filter(function (x) { return x !== want && x !== "multi"; });
    if (!L.length) return 0;                           // no languages listed: usually the original audio
    if (L.indexOf(want) !== -1 && !others.length) return 0; // only your language
    if (L.indexOf(want) !== -1) return 1;              // yours plus others: may start on the wrong one
    if (!others.length) return 1.5;                    // "multi" with nothing named
    return 2;                                          // only other languages (a dub)
  }
  function copyUrl(c) {
    if (c.fake) return "";
    if (c.kind === "torrent") return prefs.server ? prefs.server + "/" + encodeURIComponent(c.st.infoHash) + "/" + (typeof c.st.fileIdx === "number" ? c.st.fileIdx : 0) : "";
    var u = String(c.st.url || "");
    return /^https?:\/\//i.test(u) ? u : "";   // only ordinary web streams go to the player
  }
  // cached debrid copies first, then other direct links, then torrents (if you have a server), then debrid copies still downloading
  function tierOf(c) {
    if (c.fake) return 0;
    if (c.kind === "instant") return c.debrid ? 0 : 1;
    if (c.kind === "torrent") return prefs.server ? 2 : 5;
    if (c.kind === "uncached") return 3;
    return 6;
  }
  function rankCopies(list) {
    var tier = tierOf;
    function bucket(c) {
      if (prefs.pick === "4k-sdr") return (c.res === 2160 && !c.hdr && !c.dv) ? 0 : 1;
      if (prefs.pick === "1080") return c.res && c.res <= 1080 ? 0 : 1;
      return 0;
    }
    // within the same resolution: a format the TV decodes well, sound it can play, then (if you prefer) not a giant remux, then biggest
    function vcPenalty(c) { return c.vc === "HEVC" ? 0 : !c.vc ? 1 : c.vc === "AV1" ? 1 : (c.res === 2160 ? 3 : 1); }
    // DTS is the one Samsung TVs definitely can't play; remuxes with TrueHD usually carry a track the TV can use
    function acPenalty(c) { return c.ac === "DTS" ? 1 : 0; }
    function key(c) { return [tier(c), c.cam ? 1 : 0, langPenalty(c) === 2 ? 1 : 0, c.dvOnly ? 1 : 0, bucket(c), langPenalty(c), -(c.res || 0), (c.hdr || c.dv) ? 1 : 0, vcPenalty(c), acPenalty(c), (prefs.remux === "avoid" && c.remux) ? 1 : 0, -c.size]; }
    return list.slice().sort(function (a, b) {
      var ka = key(a), kb = key(b);
      for (var i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
      return 0;
    }).filter(function (c) { return c.kind !== "other" || c.fake; });
  }
  function stickers(c) {
    if (c.fake) return '<span class="stk">TEST PATTERN</span>';
    var out = [];
    if (c.res) out.push('<span class="stk' + (c.res === 2160 ? " k4" : "") + '">' + (c.res === 2160 ? "4K" : c.res + "p") + "</span>");
    if (c.dvOnly) out.push('<span class="stk bad" title="Samsung TVs can\'t show Dolby Vision">DOLBY VISION ONLY</span>');
    else if (c.hdr) out.push('<span class="stk warn">HDR' + (c.dv ? " + DV" : "") + "</span>");
    else if (c.res) out.push('<span class="stk">SDR</span>');
    if (c.size) out.push('<span class="stk">' + (c.size >= 1 ? c.size.toFixed(1) + " GB" : Math.round(c.size * 1024) + " MB") + "</span>");
    if (c.vc) out.push('<span class="stk' + (c.vc === "H.264" && c.res === 2160 ? " warn" : "") + '">' + c.vc + "</span>");
    if (c.ac) out.push('<span class="stk' + (c.ac === "DTS" ? " bad" : "") + '"' + (c.ac === "DTS" ? ' title="Samsung TVs from 2018 on can\'t play DTS sound"' : "") + ">" + c.ac + (c.ac === "DTS" ? " · MAY BE SILENT" : "") + "</span>");
    if (c.remux) out.push('<span class="stk">REMUX</span>');
    out.push(c.kind === "instant" ? (c.debrid ? '<span class="stk ok">DEBRID · INSTANT</span>' : '<span class="stk">DIRECT LINK</span>') : c.kind === "torrent" ? '<span class="stk ' + (prefs.server ? "warn" : "bad") + '">' + (prefs.server ? "TORRENT" : "TORRENT · NEEDS SERVER") + "</span>" : '<span class="stk bad">NOT CACHED YET</span>');
    if (c.cam) out.push('<span class="stk bad">CAM</span>');
    var L = (c.langs || []).filter(function (x) { return x !== "multi"; });
    if (langPenalty(c) === 2) out.push('<span class="stk warn">' + esc(L.map(function (x) { return langName(x).toUpperCase(); }).join(" / ") || "DUBBED") + " AUDIO</span>");
    else if ((c.langs || []).indexOf("multi") !== -1) out.push('<span class="stk">MULTI AUDIO</span>');
    return out.join("");
  }
  var copyCache = {};                 // "type|id|ranking" -> { t, copies, note }
  function copyKey(type, vid) { return type + "|" + vid; }
  var COPY_TTL = 5 * 60 * 1000;
  function clearCopyCache() { copyCache = {}; copyFlights = {}; }
  // Asks every stream addon at once and reports as answers arrive.
  // onUpdate({ copies, note, ready, done, answered, total }) — "ready" means the best copy is settled:
  // Torrentio has answered (or, without Torrentio, 1.5s after the first answer), or everyone has.
  // Copies are ranked within each addon and appended in arrival order, so the first one never moves.
  var copyFlights = {};
  function streamCopies(it, vid, onUpdate) {
    var type = it.type === "series" ? "series" : "movie", key = copyKey(type, vid);
    var hit = copyCache[key];
    if (hit && Date.now() - hit.t < COPY_TTL) { onUpdate({ copies: rankCopies(hit.raw), note: hit.note, ready: true, done: true, answered: 1, total: 1 }); return; }
    if (!live) {
      onUpdate({ copies: [{ fake: true, kind: "instant", res: 0, size: 0, file: "Preview tape. On the TV this lists copies from your Stremio addons.", addon: "Preview" }], note: "", ready: true, done: true, answered: 1, total: 1 });
      return;
    }
    if (!account) { onUpdate({ copies: [], note: "signin", ready: true, done: true, answered: 0, total: 0 }); return; }
    // already asking the add-ons for this one (say, since you picked up the box): join that search instead of starting another
    var fl = copyFlights[key];
    if (fl) { fl.subs.push(onUpdate); if (fl.last) onUpdate(fl.last); return; }
    var sources = installedAddons.filter(function (ad) { return addonOK(ad.transportUrl) && addonHas(ad, "stream", type, vid); });
    if (!sources.length) { onUpdate({ copies: [], note: "noaddons", ready: true, done: true, answered: 0, total: 0 }); return; }
    fl = copyFlights[key] = { subs: [onUpdate], last: null };
    function send(u) { fl.last = u; fl.subs.slice().forEach(function (f) { try { f(u); } catch (e) {} }); }
    var failedSources = [], shown = [], all = [], answered = 0, ready = false, graceStarted = false, graceFired = false, finished = false, bestChanged = false;
    function emit() {
      var done = answered === sources.length;
      // settle on a best copy once a cached debrid one is in, or after a few seconds if what we have is playable, or when everyone's answered
      if (!ready && (done || (shown[0] && tierOf(shown[0]) === 0) || (answered > 0 && graceFired && shown[0] && tierOf(shown[0]) <= 2))) ready = true;
      if (done && !finished) {
        finished = true;
        // only a full answer is kept: if an addon timed out, the next try asks everyone again
        if (!failedSources.length) copyCache[key] = { t: Date.now(), raw: all.slice(), note: "" };
        if (copyFlights[key] === fl) delete copyFlights[key];
        diag.copies(all.length, sources.length, failedSources);
      }
      send({ copies: shown.slice(), note: "", ready: ready, done: done, answered: answered, total: sources.length, failed: failedSources.length, bestChanged: bestChanged });
      bestChanged = false;
    }
    sources.forEach(function (ad) {
      var name = (ad.manifest && ad.manifest.name) || "Addon";
      getJSON(addonBase(ad.transportUrl) + "/stream/" + type + "/" + idPath(vid) + ".json", 20000)
        .then(function (j) { return (j.streams || []).map(function (st) { return parseCopy(st, name, ad.transportUrl); }); }, function (e) { failedSources.push(name); diag.addonFail(name, "copies", e); return []; })
        .then(function (list) {
          answered++;
          var ranked = rankCopies(list);
          all = all.concat(list);
          if (!ready) {
            // until the best copy is settled, keep everything ranked together
            shown = rankCopies(all);
          } else if (ranked.length && (!shown.length || tierOf(ranked[0]) < tierOf(shown[0]))) {
            // a later addon brought a better kind of copy (say, cached debrid after plain torrents): that becomes the one to play
            shown = rankCopies(all); bestChanged = true;
          } else {
            shown = shown.concat(ranked);
          }
          // (once everyone has answered there's nothing left to settle, so the grace timer stays quiet)
          if (!graceStarted) { graceStarted = true; setTimeout(function () { graceFired = true; if (!finished) emit(); }, 4000); }
          emit();
        });
    });
  }
  // the whole set at once (used for the next episode, where nothing is on screen yet)
  function fetchCopies(it, vid) {
    return new Promise(function (resolve) {
      streamCopies(it, vid, function (u) { var k2 = copyKey(it.type === "series" ? "series" : "movie", vid); if (u.done) resolve({ copies: copyCache[k2] ? rankCopies(copyCache[k2].raw) : u.copies, note: u.note }); });
    });
  }
  // tell the subtitle addon which file is playing (name, size, hash) so it can pick subtitles timed for that release
  function subExtra(copy) {
    if (!copy || !copy.st) return "";
    var bh = copy.st.behaviorHints || {}, parts = [];
    var fname = bh.filename || (/\.(mkv|mp4|avi|m4v|ts|webm)\b/i.test(copy.file || "") ? String(copy.file).trim() : "");
    if (bh.videoHash) parts.push("videoHash=" + encodeURIComponent(bh.videoHash));
    if (bh.videoSize) parts.push("videoSize=" + encodeURIComponent(bh.videoSize));
    if (fname) parts.push("filename=" + encodeURIComponent(fname));
    return parts.join("&");
  }
  function fetchSubtitles(it, vid, copy) {
    if (!live || !account) return Promise.resolve([]);
    var type = it.type === "series" ? "series" : "movie";
    var sources = installedAddons.filter(function (ad) { return addonOK(ad.transportUrl) && addonHas(ad, "subtitles", type, vid); });
    var extra = subExtra(copy);
    return Promise.all(sources.map(function (ad) {
      var base = addonBase(ad.transportUrl) + "/subtitles/" + type + "/" + idPath(vid);
      var plain = function () { return getJSON(base + ".json", 10000).then(function (j) { return j.subtitles || []; }, function () { return []; }); };
      if (!extra) return plain();
      return getJSON(base + "/" + extra + ".json", 10000).then(function (j) { return (j.subtitles && j.subtitles.length) ? j.subtitles : plain(); }, plain);
    })).then(function (lists) {
      var seen = {}, out = [];
      [].concat.apply([], lists).forEach(function (sb) {
        if (!sb || !webUrl(sb.url)) return;
        var lang = String(sb.lang || "und").toLowerCase();
        seen[lang] = (seen[lang] || 0) + 1;
        if (seen[lang] <= 6) out.push({ lang: lang, url: sb.url, n: seen[lang] });
      });
      return out;
    });
  }

  // --- the counter: checkout, copies, resume ---
  var co = null;   // the rental in progress: { it, vid, copies, note }
  function checkoutView(it, vid) {
    vid = vid || it.id;
    var mine = co = { it: it, vid: vid, copies: null };
    sfx("receipt");
    var due = new Date(Date.now() + 3 * 864e5);
    var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var title = it.name + (it.type === "series" ? " " + epLabel(vid) : "");
    openModal('<div class="panel" role="dialog" aria-label="Checkout"><div class="case-view"><div class="receipt" style="margin:0 24px 16px 0">' +
      "<h4>" + esc(prefs.storeName.toUpperCase()) + "</h4>" +
      '<div class="row"><span>TITLE</span><span>' + esc(title.toUpperCase()) + "</span></div>" +
      '<div class="row"><span>DUE BACK</span><span>' + due.getDate() + " " + months[due.getMonth()] + " BY 7PM</span></div>" +
      '<div class="row"><span>LATE FEES</span><span>$0.00</span></div>' +
      '<div class="foot">THANKS FOR RENTING!<br>PLEASE BE KIND · REWIND</div></div>' +
      '<div class="details" id="coSide"><h3>' + esc(title) + '</h3><p class="note" id="coMsg">Checking the back room for copies…</p>' +
      '<div class="actions col"><button class="btn" data-m="play" data-id="' + esc(it.id) + '">Open in the Stremio app instead</button><button class="btn" data-m="close">Back to the aisles</button></div></div></div></div>');
    var drawn = false;
    streamCopies(it, vid, function (r) {
      if (co !== mine || !$("coSide")) return;   // only this visit to the counter, not an earlier one for the same tape
      co.copies = r.copies;
      var side = $("coSide"), html = "<h3>" + esc(title) + "</h3>";
      var back = '<button class="btn" data-m="play" data-id="' + esc(it.id) + '">Open in the Stremio app instead</button><button class="btn" data-m="close">Back to the aisles</button>';
      if (!r.ready) {
        var msg = $("coMsg"); if (msg) msg.textContent = "Checking the back room for copies… (" + r.answered + " of " + r.total + " shelves checked)";
        return;
      }
      if (drawn && r.bestChanged) drawn = false;
      if (drawn) {
        // later addons just add to the pile; the Play button stays put
        var more = side.querySelector('[data-m="copies"]');
        if (more) more.textContent = "Choose another copy (" + r.copies.length + ")";
        else if (r.copies.length > 1) {
          var pb = side.querySelector('[data-m="playbest"]');
          if (pb) { pb.insertAdjacentHTML("afterend", '<button class="btn" data-m="copies">Choose another copy (' + r.copies.length + ")</button>"); var keep = modal.els[modal.idx]; refreshModalEls(); modal.idx = Math.max(0, modal.els.indexOf(keep)); }
        }
        var note = $("coMore"); if (note) note.textContent = r.done ? "" : "Still checking " + (r.total - r.answered) + " more shelf" + (r.total - r.answered === 1 ? "" : "s") + "…";
        return;
      }
      if (!r.copies.length && !r.done) return;
      drawn = !!r.copies.length;
      if (!r.copies.length) {
        var why = r.note === "signin" ? "Sign in to Stremio at the front desk so I can use your addons to find a copy."
          : r.note === "noaddons" ? "None of your Stremio addons provide copies for this one."
          : r.failed ? (r.failed === r.total ? "I couldn't reach any of your addons just now." : r.failed + " of your addons didn't answer, and the rest had nothing.") + " Give it a moment and ask again."
          : "Every copy is out. None of your addons had this one right now.";
        side.innerHTML = html + '<p class="note">' + esc(why) + '</p><div class="actions col">' +
          (r.note === "signin" ? '<button class="btn primary" data-m="account">Sign in to Stremio</button>'
            : r.note === "noaddons" ? "" : '<button class="btn primary" data-m="askagain">Ask again</button>') + back + "</div>";
      } else {
        var b = r.copies[0], torrentsWaiting = !prefs.server && r.copies.some(function (c) { return c.kind === "torrent"; });
        side.innerHTML = html + '<p class="note">Best copy for you:</p><div class="best">' + stickers(b) + "</div>" +
          '<p class="note">' + esc(b.file || b.addon) + "</p>" +
          (torrentsWaiting && b.kind !== "instant" ? '<p class="note">Some copies are plain torrents. Add a streaming server in Player settings to play those.</p>' : "") +
          '<div class="actions col"><button class="btn primary" data-m="playbest">Play it</button>' +
          (r.copies.length > 1 ? '<button class="btn" data-m="copies">Choose another copy (' + r.copies.length + ")</button>" : "") + back + "</div>" +
          '<p class="note" id="coMore">' + (r.done ? "" : "Still checking " + (r.total - r.answered) + " more shelf" + (r.total - r.answered === 1 ? "" : "s") + "…") + "</p>";
      }
      refreshModalEls(); modal.idx = 0; modalFocus(true);
    });
  }
  function copiesView() {
    if (!co || !co.copies) return;
    openModal('<div class="panel" role="dialog" aria-label="Choose a copy"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">#</div><p>Here\'s every copy we have, best first.</p></div><div class="copies">' +
      rankCopies(co.copies).slice(0, 30).map(function (c) {
        var i = co.copies.indexOf(c);
        return '<button class="copy" data-m="copy" data-i="' + i + '">' + stickers(c) + '<span class="src">' + esc((c.addon ? c.addon + " · " : "") + (c.file || "")) + "</span></button>";
      }).join("") + '</div><div class="actions"><button class="btn" data-m="close">Back to the aisles</button></div></div>');
  }
  function resumePoint(it, vid) {
    var lp = progressMap[it.id];
    if (lp && lp.v === vid && lp.d && lp.t > 120000 && lp.t / lp.d < 0.95) return lp.t;
    var ep = it.type === "series" && progressMap["ep:" + vid];
    if (ep && ep.d && ep.t > 120000 && ep.t / ep.d < 0.95) return ep.t;
    var li = libRaw[it.id], st = li && li.state;
    if (st && st.timeOffset > 120000 && (st.video_id === vid || (!st.video_id && vid === it.id)) && (!st.duration || st.timeOffset / st.duration < 0.95)) return st.timeOffset;
    return 0;
  }
  // Play on the remote: skip the case and the counter, go straight to the best copy (picking up where you left off)
  function quickPlay(it, epVid) {
    if (!it) return;
    if (it.type === "series" && !it.videoId && !epVid) { sfx("press"); return episodesView(it); }
    if (account && live && !installedAddons.length && !diag.account) { toast("Still opening up, one moment…", 2500); return; }
    var vid = epVid || (it.type === "series" ? it.videoId : it.id), started = false;
    sfx("press"); toast("Getting " + it.name + " ready…", 4000);
    co = { it: it, vid: vid, copies: null };
    streamCopies(it, vid, function (r) {
      if (started || !co || co.it !== it || co.vid !== vid || P) return;
      if (!r.ready) return;
      var first = -1;
      r.copies.some(function (c, i) { if (c.fake || copyUrl(c)) { first = i; return true; } return false; });
      if (first < 0) { if (r.done) { started = true; checkoutView(it, vid); } return; }   // the counter explains what's missing
      started = true;
      co.copies = r.copies; co.idx = first;
      $("toast").classList.remove("show");
      beginPlayback(resumePoint(it, vid));
    });
  }
  function playFromCheckout(i) {
    if (!co || !co.copies || !co.copies[i]) return;
    co.idx = i;
    var c = co.copies[i];
    if (!c.fake && !copyUrl(c)) { toast("That copy is a torrent. Add your streaming server in Player settings first.", 5000); return; }
    var t = resumePoint(co.it, co.vid);
    if (t) {
      openModal('<div class="panel" role="dialog" aria-label="Resume"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">▶</div><p>You stopped this tape at ' + fmtTime(t) + ".</p></div>" +
        '<div class="actions"><button class="btn primary" data-m="resume" data-t="' + t + '">Pick up from ' + fmtTime(t) + '</button><button class="btn" data-m="fromstart">Start from the beginning</button><button class="btn" data-m="close">Not now</button></div></div>');
      return;
    }
    beginPlayback(0);
  }

  // --- player settings ---
  function playerSettings(idx) {
    var modeLabel = { "4k-sdr": "4K non-HDR first", "best": "Highest quality", "1080": "1080p max (smoother on slow Wi-Fi)" }[prefs.pick];
    openModal('<div class="panel" role="dialog" aria-label="Player settings"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">▶</div><p>How the store picks and plays your tapes.</p></div>' +
      '<div class="actions col">' +
      '<button class="btn" data-m="pick-mode">Best copy: ' + esc(modeLabel) + "</button>" +
      '<button class="btn" data-m="toggle-remux">Big remux files: ' + (prefs.remux === "avoid" ? "Avoid (lighter copies first)" : "Allow (biggest copy first)") + "</button>" +
      '<button class="btn" data-m="toggle-vhs">VHS look on films: ' + (prefs.vhs ? "On" : "Off") + "</button>" +
      '<button class="btn" data-m="toggle-previews">Coming attractions before films: ' + (prefs.previews ? "On" : "Off") + "</button>" +
      '<button class="btn" data-m="toggle-autonext">Next episode: ' + ({ auto: "Plays after a 10-second countdown", ask: "Asks first", off: "Off" })[nextEpMode()] + "</button>" +
      '<button class="btn" data-m="audio-lang">Preferred audio: ' + esc(langName(prefs.audioLang || "en")) + "</button></div>" +
      '<div class="desk-side"><label for="serverUrl">Streaming server for plain torrents (optional)</label>' +
      '<input class="field" id="serverUrl" data-m="input" data-submit="saveserver" value="' + esc(prefs.server || "") + '" placeholder="http://192.168.1.20:11470">' +
      '<p class="note">Cached Real-Debrid copies don\'t need this. For plain torrents, run Stremio on a computer at home and enter its address and port 11470.</p></div>' +
      '<div class="actions"><button class="btn primary" data-m="saveserver">Save server</button><button class="btn" data-m="office">Back to the back office</button><button class="btn" data-m="close">Back to the aisles</button></div></div>');
    if (idx) { modal.idx = Math.min(idx, modal.els.length - 1); modalFocus(true); }
  }

  // --- box sets ---
  // an episode that hasn't aired yet: its air date ("14 Nov"), otherwise ""
  function notAired(v) {
    var t = v && v.released ? Date.parse(v.released) : NaN;
    if (!isFinite(t) || t <= Date.now()) return "";
    var d = new Date(t), mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    return d.getDate() + " " + mo + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "");
  }
  function episodesView(it, season) {
    openModal('<div class="panel" role="dialog" aria-label="Box set"><h3 class="details" style="margin:0;font-family:var(--f-spine);font-weight:400;text-transform:uppercase;color:var(--blue);font-size:30px">' + esc(it.name) + '</h3><p class="note">Opening the box set…</p><div class="actions"><button class="btn" data-m="close">Back to the aisles</button></div></div>');
    var view = modal.seq;
    getMeta(it).then(function (m) {
      if (!sameView(view)) return;
      var vids = (m.videos || []).filter(function (v) { return v.season !== undefined && v.season !== null; });
      if (!vids.length) {
        overlay.querySelector(".note").textContent = m.failedAt ? "I couldn't get the episode list from Stremio just now. Give it a minute and open the box set again."
          : "This box set came without an episode list. Try opening it in the Stremio app.";
        if (m.failedAt) delete metaCache[it.id];
        return;
      }
      var seasons = []; vids.forEach(function (v) { if (seasons.indexOf(v.season) === -1) seasons.push(v.season); });
      seasons.sort(function (a, b) { return (a === 0 ? 999 : a) - (b === 0 ? 999 : b); });
      var cur = it.videoId && epLabel(it.videoId) ? parseInt(it.videoId.split(":")[1], 10) : null;
      var sn = season !== undefined ? season : (cur !== null && seasons.indexOf(cur) !== -1 ? cur : seasons[0]);
      var eps = vids.filter(function (v) { return v.season === sn; }).sort(function (a, b) { return a.episode - b.episode; });
      var lp = progressMap[it.id];
      openModal('<div class="panel" role="dialog" aria-label="Box set"><div class="details" style="max-width:none"><h3>' + esc(it.name) + "</h3></div>" +
        '<div class="seasons">' + seasons.map(function (x) {
          return '<button class="btn' + (x === sn ? " on" : "") + '" data-m="season" data-id="' + esc(it.id) + '" data-s="' + esc(x) + '">' + (x === 0 ? "Specials" : "Season " + esc(x)) + "</button>";
        }).join("") + '</div><div class="eps">' + eps.map(function (v) {
          var air = notAired(v);
          var mark = air ? " · airs " + air : it.videoId === v.id ? " · up to here" : ((lp && lp.v === v.id) || progressMap["ep:" + v.id] ? " · started" : "");
          var en = v.episode === null ? "?" : String(v.episode);
          return '<button class="ep" data-m="ep" data-id="' + esc(it.id) + '" data-vid="' + esc(v.id) + '"><b>E' + esc(en) + "</b>" + esc(v.title || "Episode " + en) + esc(mark) + "</button>";
        }).join("") + '</div><div class="actions"><button class="btn" data-m="close">Back to the aisles</button></div></div>');
      var focusEp = Array.prototype.filter.call(overlay.querySelectorAll(".ep"), function (b) { return it.videoId && b.getAttribute("data-vid") === it.videoId; })[0] || (season !== undefined ? overlay.querySelector(".seasons .btn.on") : overlay.querySelector(".ep"));
      if (focusEp) { modal.idx = modal.els.indexOf(focusEp); modalFocus(true); }
    });
  }

  // --- engines: Samsung AVPlay, web <video>, and a test pattern for the preview ---
  var webapisState = null;
  function ensureWebapis(cb) {
    if (window.webapis && webapis.avplay) return cb(true);
    if (!window.tizen) return cb(false);
    if (webapisState === "failed") return cb(false);
    var done = false;
    function fin(ok) { if (done) return; done = true; webapisState = ok ? "ok" : "failed"; cb(ok); }
    var sc = document.createElement("script");
    sc.src = "$WEBAPIS/webapis/webapis.js";
    sc.onload = function () { fin(!!(window.webapis && webapis.avplay)); };
    sc.onerror = function () { fin(false); };
    document.head.appendChild(sc);
    setTimeout(function () { fin(!!(window.webapis && webapis.avplay)); }, 3000);
  }
  function avEngine(url, startMs, is4k, cb, heavy) {
    var av = webapis.avplay, stage = $("pStage");
    var avAudio = -1; // AVPlay never says which audio track is playing, so remember the one we picked
    stage.innerHTML = '<object id="avobj" type="application/avplayer"></object>';
    $("player").classList.add("av");
    document.documentElement.style.background = "transparent"; document.body.style.background = "transparent";
    var paused = false, suspended = false, prepT = null;
    function avTracks() {
      try {
        return av.getTotalTrackInfo().map(function (t) {
          var info = {}; try { info = JSON.parse(t.extra_info); } catch (e) {}
          return { type: t.type, index: t.index, lang: String(info.language || info.track_lang || "").toLowerCase(), label: "", on: t.type === "AUDIO" && t.index === avAudio };
        });
      } catch (e) { return []; }
    }
    // the web player picks your language itself; AVPlay has to be told, before the tape starts
    function pickAudio() {
      try {
        var aud = avTracks().filter(function (t) { return t.type === "AUDIO"; });
        if (aud.length < 2) return;
        var want = prefs.audioLang || "en";
        var best = aud.filter(function (t) { return langMatches(t.lang, t.label, want); })[0];
        if (!best) return;
        av.setSelectTrack("AUDIO", best.index); avAudio = best.index;
        if (best !== aud[0] && cb.audio) cb.audio(best);
      } catch (e) {}
    }
    try {
      av.open(url);
      try { av.setDisplayRect(0, 0, 1920, 1080); } catch (e) {}
      try { av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (e) {}
      if (is4k) { try { av.setStreamingProperty("SET_MODE_4K", "TRUE"); } catch (e) {} }
      // big files over Wi-Fi: a deeper buffer before starting and after a stall, so the picture stutters less
      if (heavy) {
        try { av.setBufferingParam("PLAYER_BUFFER_FOR_PLAY", "PLAYER_BUFFER_SIZE_IN_SECOND", 8); } catch (e) {}
        try { av.setBufferingParam("PLAYER_BUFFER_FOR_RESUME", "PLAYER_BUFFER_SIZE_IN_SECOND", 15); } catch (e) {}
      }
      av.setListener({
        onbufferingstart: function () { cb.buffering(true); },
        onbufferingcomplete: function () { cb.buffering(false); },
        onstreamcompleted: function () { cb.ended(); },
        onerror: function (e) { cb.error(String(e)); },
        oncurrentplaytime: function () {}
      });
      prepT = setTimeout(function () { try { av.stop(); } catch (e) {} cb.error("prepare timeout"); }, 25000);
      av.prepareAsync(function () {
        clearTimeout(prepT);
        pickAudio();
        function rdy() { cb.ready(); }
        if (startMs) { try { av.seekTo(startMs, rdy, rdy); } catch (e) { rdy(); } } else rdy();
      }, function (e) { clearTimeout(prepT); cb.error(String(e && e.name || e)); });
    } catch (e) { setTimeout(function () { cb.error(String(e && e.message || e)); }, 0); }
    return {
      kind: "av",
      start: function () { try { av.play(); paused = false; } catch (e) {} cb.playing(); },
      play: function () { try { av.play(); paused = false; } catch (e) {} },
      pause: function () { try { av.pause(); paused = true; } catch (e) {} },
      paused: function () { return paused; },
      time: function () { try { return av.getCurrentTime(); } catch (e) { return 0; } },
      duration: function () { try { return av.getDuration(); } catch (e) { return 0; } },
      seek: function (ms) { try { av.seekTo(Math.max(0, Math.round(ms))); } catch (e) {} },
      // Samsung's player has to be put away when the TV leaves the app (Home, Source) and brought back after
      suspend: function () { try { av.pause(); paused = true; } catch (e) {} try { av.suspend(); suspended = true; } catch (e) {} },
      restore: function () {
        if (suspended) { suspended = false; try { av.restore(); } catch (e) { return false; } }
        try { av.pause(); paused = true; } catch (e) {}
        return true;
      },
      tracks: avTracks,
      setTrack: function (type, index) { try { av.setSelectTrack(type, index); if (type === "AUDIO") avAudio = index; } catch (e) {} },
      info: function () {
        var out = {};
        try {
          av.getCurrentStreamInfo().forEach(function (t) {
            if (t.type !== "VIDEO") return;
            var x = {}; try { x = JSON.parse(t.extra_info); } catch (e) {}
            out.w = parseInt(x.Width, 10) || 0; out.h = parseInt(x.Height, 10) || 0;
          });
        } catch (e) {}
        return out;
      },
      close: function () {
        clearTimeout(prepT); prepT = null;
        try { av.stop(); } catch (e) {} try { av.close(); } catch (e) {}
        stage.innerHTML = ""; $("player").classList.remove("av");
        document.documentElement.style.background = ""; document.body.style.background = "";
      }
    };
  }
  function htmlEngine(url, startMs, cb) {
    var stage = $("pStage"), v = document.createElement("video");
    // load muted and paused; the tape only starts once the picture is ready
    v.autoplay = false; v.preload = "auto"; v.muted = true; v.setAttribute("playsinline", "");
    stage.innerHTML = ""; stage.appendChild(v);
    var phase = "load", warmFrom = 0, warmT = null, seekT = null, buffering = false, lastT = -1;
    function readyNow() {
      if (phase === "ready" || phase === "live") return;
      phase = "ready"; clearTimeout(warmT);
      try { v.pause(); } catch (e) {}
      cb.ready();
    }
    // after a short silent run the decoder is warmed up; go back to the start point and wait
    function rewindThenReady() {
      if (phase !== "warm") return;
      phase = "rewind";
      try { v.pause(); } catch (e) {}
      var done = false;
      function fin() { if (done) return; done = true; v.removeEventListener("seeked", fin); readyNow(); }
      v.addEventListener("seeked", fin);
      try { v.currentTime = warmFrom; } catch (e) { fin(); }
      clearTimeout(seekT); seekT = setTimeout(fin, 4000);
    }
    v.addEventListener("loadedmetadata", function () {
      pickAudio();
      if (startMs) { try { v.currentTime = startMs / 1000; } catch (e) {} }
    });
    v.addEventListener("canplay", function () {
      if (phase !== "load") return;
      phase = "warm"; warmFrom = startMs ? startMs / 1000 : v.currentTime;
      var q = v.play(); if (q && q.catch) q.catch(function () { readyNow(); });
      warmT = setTimeout(rewindThenReady, 20000);
    });
    v.addEventListener("waiting", function () { if (phase !== "live") return; buffering = true; cb.buffering(true); });
    v.addEventListener("playing", function () { if (phase !== "live") return; buffering = false; cb.buffering(false); cb.playing(); });
    v.addEventListener("timeupdate", function () {
      if (phase === "warm" && v.currentTime >= warmFrom + 1.5 && (v.videoWidth > 0 || !("videoWidth" in v))) { rewindThenReady(); return; }
      if (phase !== "live") return;
      // some TVs never send "playing" after a stall, so moving time clears the message too
      if (buffering && lastT >= 0 && v.currentTime > lastT + 0.2) { buffering = false; cb.buffering(false); }
      lastT = v.currentTime;
    });
    setTimeout(function () { if (phase === "load") cb.error("timed out loading"); }, 45000);
    function audioList() {
      var at = v.audioTracks, out = [];
      if (!at || typeof at.length !== "number") return out;
      for (var i = 0; i < at.length; i++) {
        var t = at[i];
        out.push({ type: "AUDIO", index: i, lang: String(t.language || "").toLowerCase(), label: t.label || "", on: !!t.enabled });
      }
      return out;
    }
    function setAudio(index) {
      var at = v.audioTracks; if (!at) return false;
      var cur = v.currentTime;
      for (var i = 0; i < at.length; i++) at[i].enabled = (i === index);
      // nudging playback makes some TV decoders switch straight away
      try { v.currentTime = cur; } catch (e) {}
      return true;
    }
    var picked = false;
    function pickAudio() {
      if (picked) return;
      var list = audioList(); if (list.length < 2) return;
      picked = true;
      var want = prefs.audioLang || "en";
      var cur = list.filter(function (t) { return t.on; })[0];
      if (cur && langMatches(cur.lang, cur.label, want)) return;
      var best = list.filter(function (t) { return langMatches(t.lang, t.label, want); })[0];
      if (best) { setAudio(best.index); cb.audio && cb.audio(best); }
    }
    if (v.audioTracks && v.audioTracks.addEventListener) {
      try { v.audioTracks.addEventListener("addtrack", function () { setTimeout(pickAudio, 50); }); } catch (e) {}
    }
    v.addEventListener("ended", function () { if (phase === "live") cb.ended(); });
    v.addEventListener("error", function () { clearTimeout(warmT); cb.error("code " + (v.error ? v.error.code : "?")); });
    v.src = url;
    try { v.load(); } catch (e) {}
    return {
      kind: "html",
      start: function () {
        phase = "live"; lastT = -1;
        v.muted = false;
        var q = v.play(); if (q && q.catch) q.catch(function () {});
      },
      play: function () { var q = v.play(); if (q && q.catch) q.catch(function () {}); },
      pause: function () { v.pause(); },
      paused: function () { return v.paused; },
      time: function () { return v.currentTime * 1000; },
      duration: function () { return isFinite(v.duration) ? v.duration * 1000 : 0; },
      seek: function (ms) { try { v.currentTime = Math.max(0, ms / 1000); } catch (e) {} },
      volume: function (x) { try { v.volume = Math.max(0, Math.min(1, x)); } catch (e) {} },
      info: function () {
        var q = null; try { q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null; } catch (e) {}
        var ahead = null;
        try { for (var i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 0.5 && v.buffered.end(i) >= v.currentTime) ahead = v.buffered.end(i) - v.currentTime; } catch (e) {}
        return { w: v.videoWidth, h: v.videoHeight, dropped: q ? q.droppedVideoFrames : v.webkitDroppedFrameCount, decoded: q ? q.totalVideoFrames : v.webkitDecodedFrameCount, ahead: ahead };
      },
      tracks: audioList,
      canSwitchAudio: function () { return !!v.audioTracks; },
      setTrack: function (type, index) { if (type === "AUDIO") setAudio(index); },
      close: function () { clearTimeout(warmT); clearTimeout(seekT); phase = "closed"; try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) {} stage.innerHTML = ""; }
    };
  }
  // The sample tape you get in a browser preview (on the TV the real copy plays): colour bars with the store's
  // own ink and cream, and the title up top so the player's bar along the bottom never sits on it.
  function drawTestCard(ctx, it, t) {
    var bars = ["#d8d2c4", "#e2c73a", "#4fb7b0", "#5aa845", "#b0569a", "#c8402e", "#2f4f9a"], w = 960 / 7;
    ctx.fillStyle = "#1c1430"; ctx.fillRect(0, 0, 960, 540);
    bars.forEach(function (c, i) { ctx.fillStyle = c; ctx.fillRect(i * w, 0, w + 1, 196); });
    ctx.fillStyle = "#2a1c18"; for (var i = 1; i < 7; i++) ctx.fillRect(i * w - 1.5, 0, 3, 196);
    ctx.fillRect(0, 194, 960, 4);
    // cream label band with an inked plate
    ctx.fillStyle = "#f6ecd2"; ctx.fillRect(0, 198, 960, 132);
    ctx.fillStyle = "#2a1c18"; ctx.fillRect(0, 328, 960, 4);
    var name = it.name.length > 26 ? it.name.slice(0, 25) + "…" : it.name;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    var fs = name.length > 18 ? 40 : 50;
    ctx.font = fs + "px Caprasimo, Georgia, serif";
    var tw = Math.min(860, ctx.measureText(name).width + 60);
    ctx.fillStyle = "#2a1c18"; ctx.fillRect(480 - tw / 2 + 5, 214 + 5, tw, 72);
    ctx.fillStyle = "#c8402e"; ctx.fillRect(480 - tw / 2, 214, tw, 72);
    ctx.lineWidth = 3; ctx.strokeStyle = "#2a1c18"; ctx.strokeRect(480 - tw / 2, 214, tw, 72);
    ctx.fillStyle = "#fff4dc"; ctx.fillText(name, 480, 214 + 36 + fs * .36, 820);
    ctx.font = "500 20px Oswald, Impact, sans-serif"; ctx.fillStyle = "#2a1c18";
    ctx.fillText("SAMPLE TAPE  ·  ON YOUR TV THE REAL ONE PLAYS RIGHT HERE", 480, 316);
    // a little tracking wobble running down the bars, on twos
    var y = Math.floor(t / 83) * 3 % 196;
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(0, y, 960, 3);
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect((Math.floor(t / 83) * 9) % 960, y, 26, 3);
  }
  function fakeEngine(it, startMs, cb) {
    var stage = $("pStage"), cv = document.createElement("canvas");
    cv.width = 960; cv.height = 540; stage.innerHTML = ""; stage.appendChild(cv);
    var ctx = cv.getContext("2d"), t = startMs || 0, playing = false;
    var dur = ((it.type === "series" ? 22 : it.runtime) || 100) * 60000;
    var bars = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
    var last = Date.now();
    var iv = setInterval(function () {
      var now = Date.now();
      if (playing) t += now - last;
      last = now;
      if (t >= dur) { t = dur; clearInterval(iv); cb.ended(); }
      drawTestCard(ctx, it, t);
    }, 200);
    playing = false;
    setTimeout(function () { cb.ready(); }, 400);
    return {
      kind: "fake",
      start: function () { playing = true; cb.playing(); },
      play: function () { playing = true; }, pause: function () { playing = false; }, paused: function () { return !playing; },
      time: function () { return t; }, duration: function () { return dur; },
      seek: function (ms) { t = Math.max(0, Math.min(dur - 1000, ms)); },
      tracks: function () { return []; }, setTrack: function () {}, info: function () { return { w: 960, h: 540 }; },
      close: function () { clearInterval(iv); stage.innerHTML = ""; }
    };
  }

  // --- the player itself ---
  var P = null;   // the tape in the machine
  // every tape gets its own number, so a timer left over from the last one can never act on the next
  var playSeq = 0;
  function samePlay(seq) { return !!P && P.seq === seq; }
  function beginPlayback(resumeMs) {
    if (!co) return;
    if (co.it && isHeld(co.it.id)) { unholdIt(co.it, true); toast("Picked up your hold. Enjoy!", 2400); }
    var c = co.copies[co.idx || 0];
    closeModal();
    stopHum(); $("tvFrame").innerHTML = ""; clearTimeout(trailerTimer);
    P = { seq: ++playSeq, it: co.it, vid: co.vid, copies: co.copies, idx: co.idx || 0, start: resumeMs || 0, eng: null, menu: null, intro: null,
          lastSave: 0, lastSync: Date.now(), watched: 0, pend: 0, seekT: null, osdT: null, barT: null, subs: [], cues: null, cueLabel: "Off", ended: false,
          autoTries: 0, lastAt: 0, nextPre: false };
    var pl = $("player"); pl.hidden = false; pl.classList.toggle("vhs", !!prefs.vhs);
    $("pTitle").textContent = P.it.name + (P.it.type === "series" ? " · " + epLabel(P.vid) : "");
    $("pSubs").innerHTML = ""; $("pCenter").innerHTML = ""; $("pMenu").hidden = true;
    P.subOffset = (prefs.subOffsets || {})[P.it.id] || 0;
    applySubStyle();
    P.introDone = false; P.ready = false; P.started = false; P.failed = false;
    // with no trailers before the film, the tape loads behind the VCR animation
    var parallel = !(prefs.previews && !isLight() && live && !P.start);
    if (parallel) openCopy(P.idx, P.start);
    insertTape(function () {
      comingAttractions(function () {
        if (!P) return;
        P.introDone = true;
        if (parallel) maybeStart(); else openCopy(P.idx, P.start);
      });
    });
  }
  function showLoading() {
    if (!P || P.failed) return;
    var c = P.copies[P.idx] || {};
    var intro = $("pIntro"); intro.hidden = false; intro.className = "p-intro blue";
    intro.innerHTML = '<div class="tracking"></div><div class="intro-osd"><span>PLAY ▶</span><span>SP</span></div>' +
      '<div class="intro-msg">LOADING TAPE<small>' + esc(c.fake ? "Preview tape" : [c.res === 2160 ? "4K" : c.res ? c.res + "p" : "", c.kind === "torrent" ? "torrent via your server" : "instant copy"].filter(Boolean).join(" · ")) +
      " · BACK to stop</small></div>";
    P.intro = { loading: true, skip: function () {}, cancel: function () { stopTape(false); } };
  }
  function maybeStart() {
    if (!P || P.started || P.failed || !P.introDone) return;
    if (!P.ready || !P.eng) { if (!(P.intro && P.intro.loading)) showLoading(); return; }
    P.started = true;
    if (P.intro && P.intro.loading) { var intro = $("pIntro"); intro.hidden = true; intro.innerHTML = ""; P.intro = null; }
    $("pCenter").innerHTML = "";
    P.lastSave = Date.now();
    P.eng.start();
  }
  // ---------- loading the tape ----------
  // Drawn the way the outside of the store is: inked shapes, flat colour with one shadow tone, moving on twos.
  var T2 = { INK: "#1b151e", CX: 960, HY: 110, Z0: 3000, W: 770, D: 430, yT: 596, yB: 688 };
  function t2Cassette(title) {   // the cassette lying label-up, 720 x 410 around its middle
    var I = ' stroke="' + T2.INK + '" stroke-width="5" stroke-linejoin="round"', o = "";
    o += '<rect x="-352" y="-190" width="720" height="410" rx="24" fill="#120f18" opacity=".45"/>';
    o += '<rect x="-360" y="-205" width="720" height="410" rx="24" fill="#24212b"' + I + "/>";
    o += '<path d="M-336,-205 L-60,-205 L-250,205 L-336,205 Q-360,205 -360,181 L-360,-181 Q-360,-205 -336,-205 Z" fill="#2e2a37"/>';
    o += '<rect x="-330" y="146" width="660" height="38" rx="8" fill="#19171f"' + I.replace('"5"', '"3"') + "/>";
    for (var i = 0; i < 14; i++) o += '<rect x="' + (-306 + i * 45) + '" y="154" width="22" height="22" rx="3" fill="#2a2732"/>';
    // the label, handwritten at the store
    o += '<rect x="-304" y="-182" width="608" height="126" rx="9" fill="#f6eeda"' + I.replace('"5"', '"4"') + "/>";
    o += '<path d="M-302,-146 L-302,-172 Q-302,-180 -294,-180 L294,-180 Q302,-180 302,-172 L302,-146 Z" fill="#c8352b"/>';
    o += '<text x="-284" y="-153" font-family="Oswald, Arial Narrow, sans-serif" font-weight="600" font-size="21" letter-spacing="4" fill="#fff6e4">PROPERTY OF ' + esc(prefs.storeName.toUpperCase().slice(0, 30)) + "</text>";
    o += '<text x="-284" y="-84" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="46" fill="#1e3d93"' + (title.length > 20 ? ' textLength="560" lengthAdjust="spacingAndGlyphs"' : "") + ">" + esc(title) + "</text>";
    o += '<path d="M-284,-70 L250,-70" stroke="#c9bfa6" stroke-width="2"/>';
    // the window and the two reels: all the tape is on the left one, rewound and ready
    o += '<clipPath id="t2Win"><rect x="-212" y="-30" width="424" height="150" rx="18"/></clipPath>';
    o += '<rect x="-212" y="-30" width="424" height="150" rx="18" fill="#59627c"' + I.replace('"5"', '"4"') + "/>";
    o += '<g clip-path="url(#t2Win)"><circle cx="-100" cy="45" r="98" fill="#6b4630"/><circle cx="-100" cy="45" r="98" fill="none" stroke="#4d3122" stroke-width="5"/>' +
      '<circle cx="-100" cy="45" r="70" fill="none" stroke="#7d553b" stroke-width="3"/><circle cx="112" cy="45" r="46" fill="#6b4630" stroke="#4d3122" stroke-width="5"/>' +
      '<path d="M-212,-30 L-90,-30 L-170,120 L-212,120 Z" fill="#fff" opacity=".12"/></g>';
    [-100, 112].forEach(function (cx) {
      o += '<circle cx="' + cx + '" cy="45" r="30" fill="#f1ead8"' + I.replace('"5"', '"3.5"') + '/><circle cx="' + cx + '" cy="45" r="11" fill="#24212b"/>';
      for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3; o += '<rect x="-3.5" y="-25" width="7" height="9" fill="#24212b" transform="translate(' + cx + ',45) rotate(' + (k * 60) + ')"/>'; }
    });
    [[-338, -183], [338, -183], [-338, 124], [338, 124]].forEach(function (p) { o += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="#15131a" stroke="#3a3644" stroke-width="2"/>'; });
    return o;
  }
  function t2Shot1(title) {
    var I = ' stroke="' + T2.INK + '" stroke-width="5"', o = '<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
    o += '<defs><radialGradient id="t2Lamp" cx="62%" cy="42%" r="62%"><stop offset="0" stop-color="#ffd58a" stop-opacity=".42"/><stop offset=".55" stop-color="#ffb060" stop-opacity=".12"/><stop offset="1" stop-color="#1a0f18" stop-opacity=".2"/></radialGradient>' +
      '<radialGradient id="t2Vig1" cx="55%" cy="46%" r="75%"><stop offset=".5" stop-color="#140a12" stop-opacity="0"/><stop offset="1" stop-color="#140a12" stop-opacity=".6"/></radialGradient></defs>';
    // the coffee table: boards, a few knots and a ring where someone's mug was
    o += '<rect width="1920" height="1080" fill="#8a5632"/>';
    [0, 216, 432, 648, 864].forEach(function (y, i) {
      o += '<rect x="0" y="' + y + '" width="1920" height="216" fill="' + (i % 2 ? "#93603a" : "#85522f") + '"/><path d="M0,' + y + ' L1920,' + y + '" stroke="#5b3620" stroke-width="5"/>';
      o += '<path d="M' + (120 + i * 310) + "," + (y + 70) + " q160,-26 340,0 M" + (900 + i * 130) + "," + (y + 150) + ' q220,22 420,-6" fill="none" stroke="#6f4326" stroke-width="3" opacity=".7"/>';
    });
    o += '<ellipse cx="1560" cy="250" rx="34" ry="20" fill="#6a3f24"/><ellipse cx="1560" cy="250" rx="16" ry="9" fill="#55301b"/><ellipse cx="250" cy="930" rx="26" ry="15" fill="#6a3f24"/>';
    o += '<ellipse cx="1650" cy="860" rx="92" ry="88" fill="none" stroke="#6f4326" stroke-width="7" opacity=".55"/>';
    o += '<rect width="1920" height="1080" fill="url(#t2Lamp)"/>';
    // the tape, sliding out from under its case
    o += '<g class="t2-cas1"><g transform="translate(600,540) rotate(93)">' + t2Cassette(title) + "</g></g>";
    o += '<rect width="1920" height="1080" fill="url(#t2Vig1)"/>';
    return o + "</svg>";
  }
  function t2Shot2() {
    var K = T2.INK, I = ' stroke="' + K + '" stroke-width="6" stroke-linejoin="round"', I4 = ' stroke="' + K + '" stroke-width="4" stroke-linejoin="round"', o = '<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
    o += '<defs><linearGradient id="t2Fall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".42"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="t2Vig" cx="50%" cy="52%" r="72%"><stop offset=".45" stop-color="#0c0810" stop-opacity="0"/><stop offset="1" stop-color="#0c0810" stop-opacity=".62"/></radialGradient>' +
      '<clipPath id="t2Slot"><rect x="560" y="592" width="800" height="100"/></clipPath></defs>';
    // the wall behind the cabinet
    o += '<rect width="1920" height="1080" fill="#3d3157"/>';
    for (var s = 0; s < 14; s++) o += '<rect x="' + (s * 148 - 20) + '" y="0" width="58" height="1080" fill="#44375f"/>';
    // the cabinet: top board, sides, the dark shelf the VCR lives on, a drawer underneath
    o += '<rect x="228" y="198" width="1464" height="882" fill="#1d1826"/>';
    o += '<rect x="228" y="198" width="1464" height="150" fill="url(#t2Fall)"/>';
    o += '<path d="M228,904 L1692,904 L1580,736 L340,736 Z" fill="#9a6238"' + I4 + '/><path d="M228,904 L340,736 L420,736 L330,904 Z" fill="#7a4a2a"/>';
    o += '<path d="M392,872 L1528,872 L1470,800 L450,800 Z" fill="#17121d" opacity=".55"/>';
    o += '<rect x="140" y="198" width="90" height="882" fill="#7f4f2d"' + I + '/><rect x="1690" y="198" width="90" height="882" fill="#7f4f2d"' + I + "/>";
    o += '<rect x="140" y="198" width="34" height="882" fill="#925c36"/><rect x="1690" y="198" width="34" height="882" fill="#925c36"/>';
    o += '<rect x="228" y="904" width="1464" height="40" fill="#8a5632"' + I4 + '/><rect x="228" y="944" width="1464" height="140" fill="#734527"' + I4 + "/>";
    o += '<rect x="290" y="976" width="1340" height="120" rx="8" fill="#7f4f2d"' + I4 + '/><ellipse cx="960" cy="1022" rx="46" ry="13" fill="#d9a441"' + I4 + '/><ellipse cx="960" cy="1019" rx="30" ry="6" fill="#f0c666"/>';
    o += '<rect x="120" y="150" width="1680" height="50" rx="6" fill="#a86a3c"' + I + '/><rect x="126" y="154" width="1668" height="12" fill="#bd7d49"/>';
    // the bottom of the television sitting on top: a slice of screen, the brand, the speaker
    o += '<rect x="330" y="-40" width="1260" height="192" rx="20" fill="#2b2833"' + I + '/><rect x="336" y="126" width="1248" height="22" fill="#211e28"/>';
    o += '<rect class="t2-screen" x="420" y="-60" width="930" height="140" rx="30" fill="currentColor"' + I + '/><path d="M450,62 L1320,62" stroke="#fff" stroke-width="4" opacity=".35"/>';
    for (var g = 0; g < 7; g++) o += '<rect x="1400" y="' + (-6 + g * 16) + '" width="150" height="7" rx="3" fill="#17141d"/>';
    o += '<text x="885" y="121" text-anchor="middle" font-family="Oswald, Arial Narrow, sans-serif" font-weight="600" font-size="22" letter-spacing="9" fill="#8f8ca0">VIDEOVISION</text><circle cx="1362" cy="113" r="6" fill="#ff4b3a"/>';
    // the VCR
    o += '<g class="t2-vcr" id="t2Vcr">';
    o += '<rect x="452" y="846" width="84" height="18" rx="4" fill="#15131a"/><rect x="1384" y="846" width="84" height="18" rx="4" fill="#15131a"/>';
    o += '<path d="M410,560 L1510,560 L1416,483 L504,483 Z" fill="#4c4c5c"' + I + '/><path d="M410,560 L1510,560 L1416,483 L504,483 Z" fill="url(#t2Fall)"/>';
    for (var v = 0; v < 11; v++) { var vx = 1130 + v * 26; o += '<path d="M' + vx + ",540 L" + (vx - 16) + ',502" stroke="' + K + '" stroke-width="5" stroke-linecap="round"/>'; }
    o += '<rect x="410" y="560" width="1100" height="290" rx="12" fill="#363642"' + I + "/>";
    o += '<path d="M422,712 L1498,712 L1498,838 Q1498,844 1492,844 L428,844 Q422,844 422,838 Z" fill="#2a2a34"/><path d="M416,712 L1504,712" stroke="' + K + '" stroke-width="4"/><path d="M424,570 L1496,570" stroke="#585868" stroke-width="5" stroke-linecap="round"/>';
    o += '<rect x="546" y="580" width="828" height="124" rx="10" fill="#0d0b12"' + I + "/>";
    o += '<g id="t2Flap"><rect x="560" y="592" width="800" height="100" fill="#25242e"/><path d="M560,604 L1360,604" stroke="#3f3e4c" stroke-width="6"/>' +
      '<path d="M900,662 L1020,662 M900,674 L1020,674" stroke="#15131a" stroke-width="5" stroke-linecap="round"/></g>';
    o += '<text x="452" y="774" font-family="Oswald, Arial Narrow, sans-serif" font-weight="600" font-size="31" letter-spacing="10" fill="#cfcde0">VIDEOVISION</text>';
    o += '<text x="452" y="806" font-family="Oswald, Arial Narrow, sans-serif" font-weight="600" font-size="15" letter-spacing="4" fill="#85839a">HQ · 4 HEAD · HI-FI STEREO</text>';
    o += '<rect x="800" y="734" width="320" height="84" rx="8" fill="#06140a"' + I4 + '/><text class="t2-vfd" id="t2Vfd" x="960" y="796" text-anchor="middle">--:--</text>';
    [[1160, 84], [1258, 58], [1330, 58], [1402, 58]].forEach(function (b) { o += '<rect x="' + b[0] + '" y="760" width="' + b[1] + '" height="30" rx="7" fill="#9391b4"' + I4 + '/><rect x="' + (b[0] + 5) + '" y="764" width="' + (b[1] - 10) + '" height="7" rx="3" fill="#b9b7d6"/>'; });
    o += '<circle class="t2-led" id="t2Led" cx="1478" cy="775" r="9" fill="#3a1010" stroke="' + K + '" stroke-width="3"/>';
    o += '<g transform="translate(430,596) rotate(-5)"><rect width="104" height="46" rx="5" fill="#f6eeda"' + I4 + '/><text x="52" y="20" text-anchor="middle" font-family="Oswald, Arial Narrow, sans-serif" font-weight="700" font-size="14" letter-spacing="1" fill="#c8352b">BE KIND</text>' +
      '<text x="52" y="38" text-anchor="middle" font-family="Oswald, Arial Narrow, sans-serif" font-weight="700" font-size="14" letter-spacing="1" fill="#1e3d93">REWIND</text></g>';
    o += "</g>";
    o += '<g id="t2Cas"></g>';
    o += '<rect width="1920" height="1080" fill="url(#t2Vig)"/>';
    return o + "</svg>";
  }
  // where a point of the room lands on screen; z is how far it is in front of the VCR's face (negative: inside it)
  function t2P(x, y, z) { var k = T2.Z0 / (T2.Z0 - z); return [T2.CX + (x - T2.CX) * k, T2.HY + (y - T2.HY) * k]; }
  function t2Pts(a) { return a.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }
  // the cassette on its way in: its top (label, window, reels) in perspective, and the end facing you with the title on it
  function t2CasSVG(zn, dy, title) {
    var K = T2.INK, x0 = T2.CX - T2.W / 2, x1 = T2.CX + T2.W / 2, yT = T2.yT + dy, yB = T2.yB + dy, D = T2.D, o = "";
    var vmax = Math.max(0, Math.min(1, zn / D));   // how much of its length is still outside the machine
    function top(u, v) { return t2P(x0 + u * T2.W, yT, zn - Math.min(v, vmax) * D); }
    function quad(u0, v0, u1, v1, fill, extra) { return '<polygon points="' + t2Pts([top(u0, v0), top(u1, v0), top(u1, v1), top(u0, v1)]) + '" fill="' + fill + '"' + (extra || "") + "/>"; }
    function reel(u, v, ru, rv, fill, extra) {
      var p = []; for (var i = 0; i < 18; i++) { var a = i * Math.PI / 9; p.push(top(u + Math.cos(a) * ru, v + Math.sin(a) * rv)); }
      return '<polygon points="' + t2Pts(p) + '" fill="' + fill + '"' + (extra || "") + "/>";
    }
    if (vmax > 0) {
      o += quad(0, 0, 1, 1, "#24212b", ' stroke="' + K + '" stroke-width="6" stroke-linejoin="round"');
      o += quad(0, 0, .36, 1, "#2e2a37");
      if (vmax > .05) o += quad(.06, .05, .94, .34, "#f6eeda", ' stroke="' + K + '" stroke-width="3" stroke-linejoin="round"') + quad(.06, .05, .94, .12, "#c8352b");
      if (vmax > .44) {
        o += quad(.2, .44, .8, .86, "#59627c", ' stroke="' + K + '" stroke-width="4" stroke-linejoin="round"');
        o += reel(.37, .65, .125, .19, "#6b4630", ' stroke="#4d3122" stroke-width="3"') + reel(.37, .65, .04, .06, "#f1ead8", ' stroke="' + K + '" stroke-width="2.5"');
        o += reel(.645, .65, .06, .09, "#6b4630", ' stroke="#4d3122" stroke-width="3"') + reel(.645, .65, .04, .06, "#f1ead8", ' stroke="' + K + '" stroke-width="2.5"');
      }
    }
    // the end facing you
    var a = t2P(x0, yT, zn), b = t2P(x1, yB, zn), w = b[0] - a[0], h = b[1] - a[1], k = w / T2.W;
    var face = '<rect x="' + a[0].toFixed(1) + '" y="' + a[1].toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + (5 * k).toFixed(1) + '" fill="#1c1a22" stroke="' + K + '" stroke-width="6" stroke-linejoin="round"/>';
    var lx = a[0] + 26 * k, ly = a[1] + 15 * k, lw = w - 52 * k, lh = h - 30 * k;
    face += '<rect x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" width="' + lw.toFixed(1) + '" height="' + lh.toFixed(1) + '" rx="' + (4 * k).toFixed(1) + '" fill="#f6eeda" stroke="' + K + '" stroke-width="3"/>';
    face += '<rect x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" width="' + (64 * k).toFixed(1) + '" height="' + lh.toFixed(1) + '" fill="#c8352b"/>';
    var fs = lh * .68, tw = lw - 64 * k - 150 * k;
    face += '<text x="' + (lx + 84 * k).toFixed(1) + '" y="' + (ly + lh * .74).toFixed(1) + '" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="' + fs.toFixed(1) + '" fill="#1e3d93"' +
      (title.length * fs * .56 > tw ? ' textLength="' + tw.toFixed(1) + '" lengthAdjust="spacingAndGlyphs"' : "") + ">" + esc(title) + "</text>";
    for (var i = 0; i < 16; i++) face += '<rect x="' + (lx + lw - (120 - i * 6.6) * k).toFixed(1) + '" y="' + (ly + lh * .2).toFixed(1) + '" width="' + ((i % 3 ? 2.2 : 4) * k).toFixed(1) + '" height="' + (lh * .6).toFixed(1) + '" fill="' + K + '"/>';
    if (zn < 0) face = '<g clip-path="url(#t2Slot)">' + face + '<rect x="560" y="592" width="800" height="100" fill="#0d0b12" opacity="' + Math.min(.7, -zn / 90).toFixed(2) + '"/></g>';
    return o + face;
  }
  function insertTape(next) {
    if (!P) return;
    var intro = $("pIntro"); intro.hidden = false; intro.className = "p-intro";
    var it = P.it, title = it.name + (it.type === "series" ? " " + epLabel(P.vid) : "");
    if (title.length > 34) title = title.slice(0, 33) + "…";
    var reduce = isCalm() || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    intro.innerHTML = '<div class="ins tape2' + (reduce ? " still" : "") + '" id="ins"><div class="t2-stage" id="insScene">' +
      '<div class="t2-shot t2-s1">' + t2Shot1(title) + '<div class="t2-sleeve tape" id="t2Sleeve">' + coverHTML(it) + "</div></div>" +
      '<div class="t2-shot t2-s2" id="t2S2">' + t2Shot2() + "</div></div></div>";
    loadCover($("t2Sleeve"));
    function fit() {
      var sc = $("insScene"); if (!sc) return;
      sc.style.transform = "scale(" + Math.max(window.innerWidth / 1920, window.innerHeight / 1080) + ")";
    }
    fit();
    var timers = [], done = false, loop = null, loaded = false;
    function at(ms, fn) { timers.push(setTimeout(function () { if (P && !done) fn(); }, reduce ? Math.min(ms, 300) : ms)); }
    function finish() {
      if (done || !P) return; done = true;
      timers.forEach(clearTimeout); clearInterval(loop);
      P.intro = null; intro.hidden = true; intro.innerHTML = ""; next();
    }
    function cls(id, c) { var e = $(id); if (e) e.setAttribute("class", c); }
    // the tape's trip into the machine: up from the bottom of the frame, a beat at the slot, then pushed home
    function draw(t) {
      var g = $("t2Cas"), flap = $("t2Flap"); if (!g || loaded) return;
      var zn, dy = 0, a;
      if (t < .5) { a = 1 - Math.pow(1 - t / .5, 2); zn = 1500 - 980 * a; dy = 330 * (1 - a); }
      else if (t < .6) zn = 520;
      else if (t < .92) { a = (t - .6) / .32; a = a * a * (3 - 2 * a); zn = 520 - 526 * a; }
      else { a = (t - .92) / .08; zn = -6 - 64 * a; dy = 5 * a; }
      g.innerHTML = t2CasSVG(zn, dy, title);
      if (flap) flap.style.display = zn - T2.D < 4 ? "none" : "";
    }
    P.intro = { skip: finish };
    at(220, function () { sfx("shhk"); });
    at(1250, function () {
      var ins = $("ins"); if (ins) ins.className = "ins tape2 shot2" + (reduce ? " still" : "");
      if (reduce) return draw(1);
      var t0 = Date.now(); draw(0);
      loop = setInterval(function () { var t = Math.min(1, (Date.now() - t0) / 1500); draw(t); if (t >= 1) clearInterval(loop); }, 83);   // on twos
    });
    at(2080, function () { sfx("slide"); });
    at(2780, function () {
      sfx("clack");
      clearInterval(loop); loaded = true;
      var g = $("t2Cas"), flap = $("t2Flap"); if (g) g.innerHTML = ""; if (flap) flap.style.display = "";
      cls("t2Vcr", "t2-vcr thunk"); cls("t2Led", "t2-led on"); cls("t2S2", "t2-shot t2-s2 blue");
      var vfd = $("t2Vfd"); if (vfd) { vfd.setAttribute("class", "t2-vfd on"); vfd.textContent = "▶ PLAY"; }
    });
    at(3050, function () { whirr(0.7); var vfd = $("t2Vfd"); if (vfd) vfd.textContent = "0:00:00"; });
    at(3450, function () { var ins = $("ins"); if (ins) ins.className = "ins tape2 shot2 switching"; });
    at(3740, function () { var ins = $("ins"); if (ins) ins.className = "ins tape2 shot2 switching out"; });
    at(3950, function () {
      intro.className = "p-intro blue";
      intro.innerHTML = '<div class="tracking"></div><div class="intro-osd"><span>PLAY ▶</span><span>SP</span></div>';
    });
    at(5000, finish);
  }
  // Coming attractions: a trailer for something people are talking about. Tonight that's the newest of what Letterboxd
  // is watching this week (through Stremboxd), then films still to come this year, then the New Releases wall.
  // On Rewind Night it's the big films of the year the store is set to. No trailer plays twice in one sitting.
  var trailersShown = {}, upcoming = [];
  function attractionPool() {
    var ry = rewindYear(), Y = new Date().getFullYear();
    var ok = function (x) { return x !== P.it && x.id !== P.it.id && x.type !== "series" && !trailersShown[x.id] && /^tt\d+$/.test(x.id); };
    if (ry && !onSample) {
      var ek = eraKey(ry);
      return items.filter(function (x) { return ok(x) && x.year === ry && x.rk && x.rk[ek] !== undefined; }).sort(function (a, b) { return a.rk[ek] - b.rk[ek]; }).slice(0, 30);
    }
    var soon = {}; upcoming.forEach(function (x) { soon[x.id] = 1; });
    var lb = aisleList("staff").filter(function (x) { return ok(x) && x.year >= Y - 1; });
    // films that are both on Letterboxd's list and not out yet come first, then this year's, then last year's
    lb = lb.map(function (x, i) { return { it: x, r: (soon[x.id] ? 0 : x.year >= Y ? 100 : 200) + i }; }).sort(function (a, b) { return a.r - b.r; }).map(function (x) { return x.it; }).slice(0, 16);
    var seen = {}; lb.forEach(function (x) { seen[x.id] = 1; });
    var rest = upcoming.filter(function (x) { return ok(x) && !seen[x.id]; }).slice(0, 12);
    if (lb.length + rest.length < 4) rest = rest.concat(aisleList("new").filter(function (x) { return ok(x) && !seen[x.id]; }).slice(0, 12));
    return lb.concat(rest);
  }
  function comingAttractions(next) {
    if (!P || !prefs.previews || isLight() || !live || P.start) return next();
    var play = P, pool = attractionPool(), tries = 0, ry = rewindYear();
    function tryOne() {
      if (P !== play) return;
      if (!pool.length || tries++ >= 4) return next();
      // one of the first few, so it's popular but not the same one every night
      var pick = pool.splice(Math.floor(Math.random() * Math.min(6, pool.length)), 1)[0];
      getMeta(pick).then(function (m) {
        if (P !== play) return;
        if (!m.trailers.length) return tryOne();
        trailersShown[pick.id] = 1;
        var intro = $("pIntro"); intro.hidden = false; intro.className = "p-intro";
        intro.innerHTML = '<div class="intro-yt">' + ytHTML(m.trailers[0], { title: "Coming attractions: " + pick.name }) +
          '</div><div class="intro-osd" style="pointer-events:none"><span>COMING ATTRACTIONS' + (ry ? " · " + ry : "") + "</span><span>OK SKIP ▶▶</span></div>";
        var t = setTimeout(done, 150000), fin = false;
        function done() { if (fin) return; fin = true; clearTimeout(t); if (P !== play) return; P.intro = null; intro.hidden = true; intro.innerHTML = ""; next(); }
        // the film starts the moment the trailer ends (or if YouTube won't play it), not after YouTube's end screen
        ytWatch(intro.querySelector("iframe"), { ended: done, error: done });
        P.intro = { skip: done };
      }, tryOne);
    }
    tryOne();
  }
  function openCopy(i, startMs) {
    if (!P) return;
    var c = P.copies[i];
    if (!c) return playerFail("Every copy we tried wouldn't play on this TV.");
    var url = copyUrl(c);
    if (!c.fake && !url) return openCopy(i + 1, startMs);
    P.idx = i; P.ended = false; P.ready = false; P.started = false; P.failed = false;
    var tok = P.openTok = (P.openTok || 0) + 1, play = P;
    function mine() { return P && P === play && P.openTok === tok; }
    refreshSubs(c);
    if (P.eng) { try { P.eng.close(); } catch (e) {} P.eng = null; }
    $("pCenter").innerHTML = "";
    if (P.introDone) showLoading();
    var cb = {
      ready: function () { if (!mine()) return; P.ready = true; maybeStart(); },
      buffering: function (on) { if (!mine()) return; $("pCenter").innerHTML = on ? "<div>TRACKING…</div><small>Buffering</small>" : ""; },
      playing: function () { if (!mine()) return; $("pCenter").innerHTML = ""; osd("PLAY ▶"); showBar(); if (!play.diagPlayed) { play.diagPlayed = true; diag.play(c, "playing", P.eng && P.eng.kind); if (!c.fake) noteRental(P.it); } },
      audio: function (a) { if (mine()) osd("AUDIO " + trackName(a).toUpperCase(), 3000); },
      ended: function () { if (mine()) tapeEnded(); },
      error: function (msg) {
        if (!mine()) return;
        var at = P.eng ? P.eng.time() : startMs;
        if (P.copies[P.idx] !== c) return;
        diag.play(c, "wouldn't play: " + msg);
        P.lastAt = at || startMs || 0;
        // try up to two more ready-to-play copies by itself, never ones still downloading (they'd be added to your debrid account)
        var nx = P.autoTries < 2 ? nextAutoCopy(i) : -1;
        if (nx !== -1) { P.autoTries++; toast("That copy wouldn't play (" + msg + "). Trying the next best copy…", 4000); openCopy(nx, P.lastAt); }
        else playerFail("That copy wouldn't play on this TV (" + msg + ").");
      }
    };
    if (c.fake) { P.eng = fakeEngine(P.it, startMs, cb); return; }
    ensureWebapis(function (ok) {
      if (!mine()) return;
      P.eng = ok ? avEngine(url, startMs, c.res === 2160, cb, c.res === 2160 || c.remux || c.size >= 15) : htmlEngine(url, startMs, cb);
    });
  }
  function nextAutoCopy(i) {
    for (var j = i + 1; j < P.copies.length; j++) { var c = P.copies[j]; if (c.fake || (copyUrl(c) && tierOf(c) < 3)) return j; }
    return -1;
  }
  function playerFail(msg) {
    if (!P) return;
    P.failed = true;
    if (P.intro && P.intro.loading) { var intro = $("pIntro"); intro.hidden = true; intro.innerHTML = ""; P.intro = null; }
    if (P.eng) { try { P.eng.close(); } catch (e) {} P.eng = null; }
    $("pCenter").innerHTML = "<div>NO SIGNAL</div><small>" + esc(msg) + "</small>";
    var menu = [];
    if (P.copies.length > 1) menu.push({ label: "Choose another copy", fn: copyMenu });
    playerMenu("This tape won't play", menu.concat([
      { label: "Open in the Stremio app", fn: function () { var it = P.it; stopTape(false); launchStremio(it); } },
      { label: "Back to the store", fn: function () { stopTape(false); } }
    ]));
  }
  function osd(text, ms) {
    var o = $("pOsd"); $("pOsdL").textContent = text; o.classList.remove("off");
    clearTimeout(P.osdT); P.osdT = setTimeout(function () { if (P && P.eng && !P.eng.paused()) o.classList.add("off"); }, ms || 2500);
  }
  function showBar(ms) {
    var pl = $("player"); pl.classList.add("bar-on");
    clearTimeout(P.barT); P.barT = setTimeout(function () { if (P && P.eng && !P.eng.paused() && !P.menu) pl.classList.remove("bar-on"); }, ms || 4000);
    tickPlayer();
  }
  function tickPlayer() {
    if (!P || !P.eng) return;
    var t = P.eng.time(), d = P.eng.duration();
    $("pCur").textContent = fmtTime(t); $("pDur").textContent = d ? fmtTime(d) : "--:--:--";
    $("pFill").style.width = d ? Math.min(100, t / d * 100) + "%" : "0";
    $("pOsdR").textContent = fmtTime(t);
    var endTxt = d && d > t ? "ENDS " + clockTime(new Date(Date.now() + d - t)) : "";
    if (P.sleep) endTxt += (endTxt ? " · " : "") + (P.sleep.mode === "end" ? "SLEEP AT END" : "SLEEP " + Math.max(1, Math.ceil((P.sleep.at - Date.now()) / 60000)) + "M");
    $("pEnd").textContent = endTxt;
    renderSubs(t);
  }
  setInterval(function () {
    if (!P || !P.eng || P.intro || !P.started) return;
    tickPlayer();
    var now = Date.now();
    if (!P.eng.paused()) { P.watched += 500; if (P.eng.kind !== "fake") stats.ms += 500; }
    if (now - P.lastSave > 10000) { P.lastSave = now; saveLocalProgress(false); save("fnv-stats", stats); }
    if (now - P.lastSync > 60000) { P.lastSync = now; syncStremio(false); }
    if (P.sleep && P.sleep.mode === "mins" && now >= P.sleep.at) goToSleep();
    // the last few minutes of an episode: find the next one's copies now, so it starts straight after the countdown
    if (!P.nextPre && P.it.type === "series" && nextEpMode() !== "off" && live && account) {
      var pd = P.eng.duration(), pt = P.eng.time();
      if (pd > 120000 && pt > 60000 && pd - pt < 240000) {
        P.nextPre = true;
        var preIt = P.it, preSeq = P.seq;
        nextEpisode(function (nx) { if (nx && samePlay(preSeq)) streamCopies(preIt, nx.id, function () {}); });
      }
    }
    if (P.menu && P.menu.info && now - (P.infoT || 0) > 1000) {
      P.infoT = now;
      infoLines().forEach(function (l, i) { if (P.menu.els[i]) P.menu.els[i].textContent = l; });
    }
  }, 500);

  // subtitles get their own quicker clock, so lines come and go on time rather than up to half a second late
  setInterval(function () {
    if (P && P.eng && P.cues && P.started && !P.intro) renderSubs(P.eng.time());
  }, 100);
  // never skip past the end of the tape: stop a few seconds short and let it finish properly
  function seekLimit(ms) { var d = P.eng.duration(); return Math.max(0, d ? Math.min(ms, d - 5000) : ms); }
  function queueSeek(delta) {
    if (!P || !P.eng) return;
    P.pend += delta;
    var target = seekLimit(P.eng.time() + P.pend);
    osd((P.pend < 0 ? "◀◀ " : "▶▶ ") + (P.pend < 0 ? "-" : "+") + fmtTime(Math.abs(P.pend)).replace(/^0:/, ""), 1800);
    $("pCur").textContent = fmtTime(target); showBar();
    sfx(delta < 0 ? "rew" : "ff");
    clearTimeout(P.seekT);
    P.seekT = setTimeout(function () { if (!P || !P.eng) return; P.eng.seek(seekLimit(P.eng.time() + P.pend)); P.pend = 0; }, 700);
  }
  function infoLines() {
    var c = P.copies[P.idx] || {}, inf = P.eng && P.eng.info ? P.eng.info() : {}, d = P.eng ? P.eng.duration() : 0;
    var mbps = c.size && d > 600000 ? (c.size * 8 * 1024 / (d / 1000)) : 0;
    var audio = (P.eng ? P.eng.tracks() : []).filter(function (t) { return t.type === "AUDIO"; }), curA = audio.filter(function (t) { return t.on; })[0];
    var px = inf.w && inf.h ? inf.w + " × " + inf.h + (inf.w >= 3800 ? "  (full 4K)" : inf.w >= 1900 ? "  (1080p)" : "") : "not reported yet";
    return [
      "Picture being decoded: " + px,
      "Player: " + (P.eng ? (P.eng.kind === "av" ? "Samsung AVPlay" : P.eng.kind === "html" ? "TV web player" : "test pattern") : "-"),
      "Dropped frames: " + (inf.decoded ? (inf.dropped || 0) + " of " + inf.decoded + (inf.decoded > 200 && inf.dropped / inf.decoded > 0.02 ? "  (stuttering)" : "") : "not reported"),
      "Buffered ahead: " + (inf.ahead != null ? Math.round(inf.ahead) + " s" : "not reported"),
      "Copy: " + [c.res === 2160 ? "4K" : c.res ? c.res + "p" : "", c.hdr ? "HDR" : c.res ? "SDR" : "", c.vc, c.ac, c.remux ? "remux" : ""].filter(Boolean).join(" · "),
      "Average bitrate: " + (mbps ? mbps.toFixed(0) + " Mbps" : "unknown") + (c.size ? "  (" + c.size.toFixed(1) + " GB)" : ""),
      "Audio track: " + (curA ? trackName(curA) : audio.length ? "track 1" : "default") + (audio.length > 1 ? " of " + audio.length : ""),
      "File: " + (c.file || "-").slice(0, 70)
    ];
  }
  function playbackInfo() {
    var list = infoLines().map(function (l) { return { label: l, fn: function () {} }; });
    list.push({ label: "Back to options", fn: optionsMenu });
    playerMenu("Playback info", list);
    P.menu.info = true; P.menu.idx = list.length - 1; menuFocus();
    $("pMenu").classList.add("info");
  }
  function clockTime(d) { var h = d.getHours(), m = d.getMinutes(); return ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? "AM" : "PM"); }
  // --- sleep timer: fade the picture and sound, then stop the tape and keep the store quiet ---
  var SLEEP_STEPS = [null, "end", 30, 60, 90];
  var sleepHold = false;
  function sleepLabel() {
    if (!P || !P.sleep) return "Off";
    if (P.sleep.mode === "end") return "End of this " + (P.it.type === "series" ? "episode" : "film");
    return Math.max(1, Math.ceil((P.sleep.at - Date.now()) / 60000)) + " min left";
  }
  function cycleSleep() {
    var cur = !P.sleep ? null : P.sleep.mode === "end" ? "end" : P.sleep.mins;
    var nx = SLEEP_STEPS[(SLEEP_STEPS.indexOf(cur) + 1) % SLEEP_STEPS.length];
    P.sleep = nx === null ? null : nx === "end" ? { mode: "end" } : { mode: "mins", mins: nx, at: Date.now() + nx * 60000 };
    osd(P.sleep ? "SLEEP: " + sleepLabel().toUpperCase() : "SLEEP OFF", 2500);
    var keep = P.menu ? P.menu.idx : 0;
    optionsMenu(); P.menu.idx = keep; menuFocus();
  }
  function goToSleep() {
    if (!P || P.sleeping) return;
    P.sleeping = true; closeMenu();
    $("player").classList.add("sleeping");
    osd("GOODNIGHT", 9000);
    var steps = 16, n = 0, seq = P.seq;
    P.fadeT = setInterval(function () {
      if (!samePlay(seq)) return;
      n++; if (P.eng && P.eng.volume) P.eng.volume(Math.max(0, 1 - n / steps));
      if (n >= steps) {
        clearInterval(P.fadeT);
        sleepHold = true;
        stopTape(true);
        if (samePlay(seq)) { closePlayer(); redrawShelves(); clampFocus(); applyFocus(true); }   // belt and braces
        stopHum(); $("player").classList.remove("sleeping");
      }
    }, 500);
  }
  function wakeUp() {
    if (!P || !P.sleeping) return false;
    clearInterval(P.fadeT); P.sleeping = false; P.sleep = null;
    if (P.eng && P.eng.volume) P.eng.volume(1);
    $("player").classList.remove("sleeping"); osd("SLEEP OFF", 2000);
    return true;
  }
  function togglePause() {
    if (!P || !P.eng) return;
    sfx("pclick");
    if (P.eng.paused()) { P.eng.play(); osd("PLAY ▶"); showBar(); }
    else { P.eng.pause(); osd("PAUSE ❚❚", 600000); $("player").classList.add("bar-on"); tickPlayer(); saveLocalProgress(false); }
  }

  // --- player menus (a VCR on-screen menu) ---
  function playerMenu(title, list) {
    if (!P) return;
    var m = $("pMenu"); m.hidden = false; m.classList.remove("info");
    m.innerHTML = "<h4>" + esc(title) + "</h4>" + list.map(function (x, i) { return '<button data-pi="' + i + '">' + esc(x.label) + "</button>"; }).join("");
    P.menu = { list: list, idx: 0, els: Array.prototype.slice.call(m.querySelectorAll("button")) };
    menuFocus();
    $("player").classList.add("bar-on");
  }
  function menuFocus() {
    P.menu.els.forEach(function (e) { e.classList.remove("focused"); });
    var el = P.menu.els[P.menu.idx]; if (el) { el.classList.add("focused"); try { el.scrollIntoView({ block: "nearest" }); } catch (e) {} }
  }
  function closeMenu() { if (!P) return; P.menu = null; $("pMenu").hidden = true; $("pMenu").innerHTML = ""; $("pMenu").classList.remove("info"); showBar(); }
  var LANG_ALIASES = {
    en: ["en", "eng", "english"], es: ["es", "spa", "spanish", "castellano", "latino"], fr: ["fr", "fre", "fra", "french", "vf", "vff", "truefrench"],
    de: ["de", "ger", "deu", "german"], it: ["it", "ita", "italian"], pt: ["pt", "por", "pob", "portuguese"], ru: ["ru", "rus", "russian"],
    ja: ["ja", "jpn", "japanese"], ko: ["ko", "kor", "korean"], zh: ["zh", "chi", "zho", "chinese", "mandarin", "cantonese"], hi: ["hi", "hin", "hindi"],
    nl: ["nl", "dut", "nld", "dutch"], pl: ["pl", "pol", "polish"], tr: ["tr", "tur", "turkish"], ar: ["ar", "ara", "arabic"]
  };
  function normLang(code) {
    code = String(code || "").toLowerCase();
    for (var k in LANG_ALIASES) if (LANG_ALIASES[k].indexOf(code) !== -1) return k;
    return code;
  }
  function langMatches(code, label, want) {
    var names = LANG_ALIASES[want] || [want];
    if (normLang(code) === want) return true;
    var l = String(label || "").toLowerCase();
    return names.some(function (n) { return n.length > 2 && l.indexOf(n) !== -1; });
  }
  function langName(code) {
    var names = { eng: "English", en: "English", spa: "Spanish", es: "Spanish", fre: "French", fra: "French", fr: "French", ger: "German", deu: "German", de: "German", ita: "Italian", it: "Italian", por: "Portuguese", pob: "Portuguese (BR)", pt: "Portuguese", dut: "Dutch", nld: "Dutch", jpn: "Japanese", ja: "Japanese", kor: "Korean", chi: "Chinese", zho: "Chinese", ara: "Arabic", rus: "Russian", swe: "Swedish", dan: "Danish", nor: "Norwegian", fin: "Finnish", pol: "Polish", gre: "Greek", ell: "Greek", heb: "Hebrew", tur: "Turkish", hin: "Hindi", vie: "Vietnamese", tha: "Thai", ind: "Indonesian", ru: "Russian", ko: "Korean", zh: "Chinese", hi: "Hindi", nl: "Dutch", pl: "Polish", tr: "Turkish", ar: "Arabic", uk: "Ukrainian", ukr: "Ukrainian", cs: "Czech", hu: "Hungarian", el: "Greek", th: "Thai", vi: "Vietnamese" };
    return names[code] || String(code || "?").toUpperCase();
  }
  function optionsMenu() {
    if (!P) return;
    var tracks = P.eng ? P.eng.tracks() : [];
    var audio = tracks.filter(function (t) { return t.type === "AUDIO"; });
    var list = [
      { label: "Subtitles: " + P.cueLabel, fn: subtitleMenu },
      { label: "Choose another copy", fn: copyMenu },
      { label: "VHS look: " + (prefs.vhs ? "On" : "Off"), fn: function () { prefs.vhs = !prefs.vhs; save("fnv-prefs", prefs); $("player").classList.toggle("vhs", prefs.vhs); optionsMenu(); } },
      { label: "Sleep timer: " + sleepLabel(), fn: cycleSleep },
      { label: "Playback info", fn: playbackInfo },
      { label: "Stop the tape", fn: function () { stopTape(true); } },
      { label: "Keep watching", fn: closeMenu }
    ];
    var curA = audio.filter(function (a) { return a.on; })[0];
    list.splice(1, 0, { label: "Audio: " + (audio.length ? (curA ? trackName(curA) : "Track 1") + " (" + audio.length + ")" : "Default"), fn: audioMenu });
    playerMenu("Options", list);
  }
  function trackName(a) {
    var n = a.lang && a.lang !== "und" ? langName(a.lang) : "";
    var lab = (a.label || "").trim();
    if (lab && n && lab.toLowerCase().indexOf(n.toLowerCase()) === -1) return n + " · " + lab;
    return n || lab || "Track " + (a.index + 1);
  }
  function audioMenu() {
    var audio = (P.eng ? P.eng.tracks() : []).filter(function (t) { return t.type === "AUDIO"; });
    var list = [];
    audio.forEach(function (a, i) {
      list.push({ label: (a.on ? "▶ " : "") + trackName(a), fn: function () {
        P.eng.setTrack("AUDIO", a.index); closeMenu(); osd("AUDIO " + trackName(a).toUpperCase());
        if (a.lang && a.lang !== "und") { prefs.audioLang = normLang(a.lang); save("fnv-prefs", prefs); }
      } });
    });
    if (audio.length < 2) {
      list.push({ label: audio.length ? "Only one audio track in this copy" : "This TV didn't list this copy's audio tracks", fn: closeMenu });
      list.push({ label: "Try another copy (" + langName(prefs.audioLang || "en") + " first)", fn: copyMenu });
    }
    playerMenu("Audio", list);
  }
  // subtitle size and height, for every film (sitting across the room is the same for all of them)
  var SUB_SIZES = { s: { label: "Small", k: 0.8 }, m: { label: "Medium", k: 1 }, l: { label: "Large", k: 1.25 }, xl: { label: "Extra large", k: 1.5 } };
  var SUB_POS = { low: { label: "Low", b: "5vh" }, mid: { label: "Standard", b: "9vh" }, high: { label: "High", b: "18vh" } };
  function subSize() { return SUB_SIZES[prefs.subSize] ? prefs.subSize : "m"; }
  function subPos() { return SUB_POS[prefs.subPos] ? prefs.subPos : "mid"; }
  function applySubStyle() { var pl = $("player"); pl.style.setProperty("--sub-scale", SUB_SIZES[subSize()].k); pl.style.setProperty("--sub-bottom", SUB_POS[subPos()].b); }
  function reopenSubs() { var idx = P && P.menu ? P.menu.idx : 0; subtitleMenu(); if (P && P.menu) { P.menu.idx = idx; menuFocus(); } }
  function subtitleMenu() {
    var list = [{ label: "Off", fn: function () { P.lastSub = P.subPick || P.lastSub; P.cues = null; P.subToken = null; P.subPick = null; P.cueLabel = "Off"; prefs.subLang = ""; save("fnv-prefs", prefs); $("pSubs").innerHTML = ""; lastCue = ""; closeMenu(); } }];
    if (P.cues) list.push({ label: "Timing: " + fmtOffset(P.subOffset) + "  (adjust)", fn: function () { timingMenu(false); } });
    list.push({ label: "Size: " + SUB_SIZES[subSize()].label, fn: function () { var k = Object.keys(SUB_SIZES); prefs.subSize = k[(k.indexOf(subSize()) + 1) % k.length]; save("fnv-prefs", prefs); applySubStyle(); osd("CC SIZE " + SUB_SIZES[subSize()].label.toUpperCase()); reopenSubs(); } });
    list.push({ label: "Height: " + SUB_POS[subPos()].label, fn: function () { var k = Object.keys(SUB_POS); prefs.subPos = k[(k.indexOf(subPos()) + 1) % k.length]; save("fnv-prefs", prefs); applySubStyle(); osd("CC " + SUB_POS[subPos()].label.toUpperCase()); reopenSubs(); } });
    // your language first, then the rest
    var want = prefs.subLang || "eng";
    var subs = P.subs.slice().sort(function (a, b) { return (normLang(b.lang) === normLang(want)) - (normLang(a.lang) === normLang(want)); });
    subs.slice(0, 40).forEach(function (sb) {
      list.push({ label: (P.subPick === sb.url ? "▶ " : "") + langName(sb.lang) + " · option " + sb.n, fn: function () { loadSubs(sb); prefs.subLang = prefs.lastSubLang = sb.lang; save("fnv-prefs", prefs); closeMenu(); } });
    });
    if (!P.subs.length) list.push({ label: "No subtitles from your addons", fn: closeMenu });
    playerMenu("Subtitles", list);
  }
  // the remote's Caption button: subtitles off, or back on in the last (or your usual) language
  function toggleCaptions() {
    if (!P) return;
    if (P.cues || (P.subPick && P.cueLabel !== "Off")) {
      P.lastSub = P.subPick || P.lastSub; P.cues = null; P.subToken = null; P.subPick = null; P.cueLabel = "Off";
      prefs.subLang = ""; save("fnv-prefs", prefs); renderSubs(0); osd("CC OFF", 2000);
      return;
    }
    var want = normLang(prefs.lastSubLang || "eng");
    var sb = (P.lastSub && P.subs.filter(function (x) { return x.url === P.lastSub; })[0]) || P.subs.filter(function (x) { return normLang(x.lang) === want; })[0];
    if (sb) { loadSubs(sb); prefs.subLang = prefs.lastSubLang = sb.lang; save("fnv-prefs", prefs); osd("CC " + langName(sb.lang).toUpperCase() + "…", 2000); }
    else if (P.subs.length) subtitleMenu();
    else osd(P.subsKey && P.cueLabel === "Looking…" ? "CC LOOKING…" : "NO CAPTIONS", 2500);
  }
  function fmtOffset(ms) { ms = ms || 0; return (ms > 0 ? "+" : ms < 0 ? "−" : "") + (Math.abs(ms) / 1000).toFixed(1) + "s"; }
  function setOffset(ms) {
    P.subOffset = ms;
    if (!prefs.subOffsets) prefs.subOffsets = {};
    if (ms) prefs.subOffsets[P.it.id] = ms; else delete prefs.subOffsets[P.it.id];
    save("fnv-prefs", prefs);
    lastCue = "~"; osd("CC " + fmtOffset(ms));
  }
  function timingMenu(keep) {
    var idx = keep && P.menu ? P.menu.idx : 0;
    playerMenu("Timing " + fmtOffset(P.subOffset), [
      { label: "Show subtitles earlier (−0.5s)", fn: function () { setOffset((P.subOffset || 0) - 500); timingMenu(true); } },
      { label: "Show subtitles later (+0.5s)", fn: function () { setOffset((P.subOffset || 0) + 500); timingMenu(true); } },
      { label: "Earlier by 5s", fn: function () { setOffset((P.subOffset || 0) - 5000); timingMenu(true); } },
      { label: "Later by 5s", fn: function () { setOffset((P.subOffset || 0) + 5000); timingMenu(true); } },
      { label: "Reset to 0.0s", fn: function () { setOffset(0); timingMenu(true); } },
      { label: "Done", fn: closeMenu }
    ]);
    if (idx) { P.menu.idx = Math.min(idx, 5); menuFocus(); }
  }
  function copyMenu() {
    playerMenu("Copies", P.copies.slice(0, 25).map(function (c, i) {
      var lp = langPenalty(c), L = (c.langs || []).filter(function (x) { return x !== "multi"; });
      var label = (i === P.idx ? "▶ " : "") + (c.fake ? "Preview tape" : [c.res === 2160 ? "4K" : c.res ? c.res + "p" : "?", c.dvOnly ? "DV only" : c.hdr ? "HDR" : "SDR", c.size ? c.size.toFixed(1) + "GB" : "", c.kind === "instant" ? "instant" : c.kind,
        lp === 2 ? L.map(langName).join("/") + " audio" : (c.langs || []).indexOf("multi") !== -1 ? "multi audio" : ""].filter(Boolean).join(" · "));
      return { label: label, fn: function () { closeMenu(); var at = P.eng ? P.eng.time() : (P.lastAt || P.start || 0); P.autoTries = 0; openCopy(i, at); } };
    }));
  }

  // --- subtitles, drawn as retro closed captions ---
  function parseSubs(text) {
    var cues = [];
    function ms(t) { var p = t.replace(",", ".").split(":"); var s = parseFloat(p.pop()) || 0, m = parseInt(p.pop() || "0", 10), h = parseInt(p.pop() || "0", 10); return ((h * 60 + m) * 60 + s) * 1000; }
    String(text).replace(/\r/g, "").split(/\n\n+/).forEach(function (block) {
      var lines = block.split("\n"), i = 0;
      while (i < lines.length && lines[i].indexOf("-->") === -1) i++;
      if (i >= lines.length) return;
      var m = lines[i].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/); if (!m) return;
      var body = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").replace(/\{[^}]+\}/g, "").trim();
      if (body) cues.push({ s: ms(m[1]), e: ms(m[2]), t: body });
    });
    return cues;
  }
  function refreshSubs(copy) {
    if (!P) return;
    var key = P.vid + "|" + (copy && copy.st ? (copy.st.url || copy.st.infoHash || "") : "");
    if (P.subsKey === key) return;
    P.subsKey = key; P.subs = []; P.cues = null; P.cueLabel = prefs.subLang ? "Looking…" : "Off"; lastCue = ""; $("pSubs").innerHTML = "";
    fetchSubtitles(P.it, P.vid, copy).then(function (list) {
      if (!P || P.subsKey !== key) return;
      P.subs = list;
      var m = prefs.subLang && list.filter(function (x) { return x.lang === prefs.subLang; })[0];
      if (m) loadSubs(m); else P.cueLabel = "Off";
    });
  }
  function loadSubs(sb) {
    if (!P) return;
    var token = P.subsKey + "|" + sb.url;
    P.subToken = token; P.subPick = sb.url;
    P.cueLabel = langName(sb.lang) + "…";
    var direct = fetch(sb.url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
    var viaServer = function () {
      if (!prefs.server) throw new Error("no server");
      return fetch(prefs.server + "/subtitles.vtt?from=" + encodeURIComponent(sb.url)).then(function (r) { return r.text(); });
    };
    direct.catch(viaServer).then(function (txt) {
      if (!P || P.subToken !== token) return;
      if (typeof txt !== "string" || txt.length > 3000000) throw new Error("too big");
      P.cues = parseSubs(txt).sort(function (a, b) { return a.s - b.s; }); P.cueLabel = langName(sb.lang) + (sb.n > 1 ? " " + sb.n : "");
      osd("CC " + langName(sb.lang).toUpperCase());
    }).catch(function () { if (P) { P.cueLabel = "Off"; toast("Couldn't load those subtitles.", 3000); } });
  }
  var lastCue = "";
  function renderSubs(t) {
    if (!P || !P.cues) { if (lastCue) { $("pSubs").innerHTML = ""; lastCue = ""; } return; }
    var txt = "";
    t -= P.subOffset || 0;
    for (var i = 0; i < P.cues.length; i++) { var c = P.cues[i]; if (t >= c.s && t <= c.e) { txt = c.t; break; } if (c.s > t) break; }
    if (txt !== lastCue) { lastCue = txt; $("pSubs").innerHTML = txt ? txt.split("\n").map(function (l) { return "<span>" + esc(l) + "</span>"; }).join("<br>") : ""; }
  }

  // --- saving progress, locally and to your Stremio account ---
  function pruneEpisodes() {
    var eps = Object.keys(progressMap).filter(function (k) { return k.indexOf("ep:") === 0; });
    if (eps.length <= 400) return;
    eps.sort(function (a, b) { return progressMap[a].at - progressMap[b].at; }).slice(0, eps.length - 400).forEach(function (k) { delete progressMap[k]; });
  }
  function saveLocalProgress(finished, nextId) {
    if (!P || !P.eng) return;
    var t = P.eng.time(), d = P.eng.duration();
    var epKey = "ep:" + P.vid;
    if (finished) { delete progressMap[P.it.id]; delete progressMap[epKey]; }
    else if (t > 5000) {
      progressMap[P.it.id] = { v: P.vid, t: t, d: d, at: Date.now() };
      // series: each episode keeps its own spot too, so going back to an earlier one picks up where it was left
      if (P.it.type === "series") progressMap[epKey] = { t: t, d: d, at: Date.now() };
    }
    pruneEpisodes();
    save("fnv-progress", progressMap);
    // keep Continue Watching on the shelf in step
    var it = P.it;
    if (finished && nextId) { it.progress = 0; it.videoId = nextId; it.lastWatched = Date.now(); if (it.aisles.indexOf("cw") === -1) it.aisles.push("cw"); }
    else if (finished) { it.progress = 0; it.aisles = it.aisles.filter(function (a) { return a !== "cw"; }); }
    else if (d) { it.progress = t / d; it.lastWatched = Date.now(); if (it.type === "series") it.videoId = P.vid; if (it.aisles.indexOf("cw") === -1) it.aisles.push("cw"); }
  }
  // a copy of this title's Stremio library entry to change and send back (a hidden one if it isn't in your library,
  // which is what Stremio itself does for things you watch without adding them)
  function libItemFor(it) {
    var now = new Date().toISOString();
    var li = libRaw[it.id] ? JSON.parse(JSON.stringify(libRaw[it.id])) : {
      _id: it.id, name: it.name, type: it.type === "series" ? "series" : "movie", poster: it.poster || "", posterShape: "poster",
      removed: true, temp: true, _ctime: now,
      behaviorHints: { defaultVideoId: null, featuredVideoId: null, hasScheduledVideos: false },
      state: { lastWatched: now, timeWatched: 0, timeOffset: 0, overallTimeWatched: 0, timesWatched: 0, flaggedWatched: 0, duration: 0, video_id: null, watched: null, noNotif: false }
    };
    if (!li.state) li.state = {};
    return li;
  }
  // "Mark as watched" on a film goes to your Stremio account too, so your phone and other devices agree
  function markWatchedInStremio(it, on) {
    if (!account || !live || it.type !== "movie" || !/^tt\d+$/.test(it.id)) return;
    var li = libItemFor(it), st = li.state, now = new Date().toISOString();
    st.flaggedWatched = on ? 1 : 0;
    st.timesWatched = on ? Math.max(1, st.timesWatched || 0) : 0;
    if (on) st.lastWatched = now;
    li._mtime = now;
    libRaw[it.id] = li;
    api("datastorePut", { authKey: account.authKey, collection: "libraryItem", changes: [li] }).catch(function (e) { diag.err("Couldn't tell Stremio about " + it.name, e); });
  }
  function syncStremio(finished, nextId) {
    if (!P || !P.eng || !account || P.eng.kind === "fake") return;
    var it = P.it, now = new Date().toISOString(), t = Math.round(P.eng.time()), d = Math.round(P.eng.duration());
    var li = libItemFor(it);
    var st = li.state;
    st.timeOffset = finished ? (nextId ? 1 : 0) : t;
    st.duration = d;
    st.lastWatched = now;
    st.video_id = finished && nextId ? nextId : P.vid;
    st.timeWatched = (st.timeWatched || 0) + P.watched;
    st.overallTimeWatched = (st.overallTimeWatched || 0) + P.watched;
    if (finished) { st.timesWatched = (st.timesWatched || 0) + 1; if (li.type === "movie") st.flaggedWatched = 1; }
    li._mtime = now;
    P.watched = 0;
    libRaw[it.id] = li;
    api("datastorePut", { authKey: account.authKey, collection: "libraryItem", changes: [li] }).catch(function () {});
  }

  // --- endings ---
  // the episode after this one, from details already in hand (null if there isn't one, it hasn't aired, or we haven't looked)
  function nextAfter(m, vid) {
    var vids = ((m && m.videos) || []).filter(function (v) { return v.season > 0; }).sort(function (a, b) { return a.season - b.season || a.episode - b.episode; });
    var i = -1; vids.forEach(function (v, k) { if (v.id === vid) i = k; });
    var nx = i >= 0 && vids[i + 1] ? vids[i + 1] : null;
    return nx && !notAired(nx) ? nx : null;
  }
  function nextEpisode(cb) {
    if (!P || P.it.type !== "series") return cb(null);
    var vid = P.vid;
    getMeta(P.it).then(function (m) {
      var vids = (m.videos || []).filter(function (v) { return v.season > 0; }).sort(function (a, b) { return a.season - b.season || a.episode - b.episode; });
      var i = -1; vids.forEach(function (v, k) { if (v.id === vid) i = k; });
      var nx = i >= 0 && vids[i + 1] ? vids[i + 1] : null;
      cb(nx && !notAired(nx) ? nx : null);   // the next one hasn't been on TV yet: nothing to rent
    });
  }
  // stoppedByYou: you chose Stop in the credits. It still counts as finished, but nothing else starts playing.
  function tapeEnded(stoppedByYou) {
    if (!P || P.ended) return;
    P.ended = true;
    // a finished episode leaves the show on Continue Watching, pointing at the next one (as Stremio's own apps do)
    var upNext = P.it.type === "series" ? nextAfter(metaCache[P.it.id], P.vid) : null, upId = upNext ? upNext.id : "";
    saveLocalProgress(true, upId); syncStremio(true, upId);
    if (stoppedByYou) return rewindEnding();
    if (P.sleep && P.sleep.mode === "end") return goToSleep();
    if (P.it.type === "series" && nextEpMode() !== "off") {
      var seq = P.seq;
      nextEpisode(function (nx) { if (!samePlay(seq) || P.intro || !P.ended) return; if (nx) countdown(nx, nextEpMode() === "ask"); else rewindEnding(); });
    } else rewindEnding();
  }
  function nextEpMode() { return ["auto", "ask", "off"].indexOf(prefs.nextEp) !== -1 ? prefs.nextEp : prefs.noAutoNext ? "off" : "auto"; }
  function countdown(nx, ask) {
    var intro = $("pIntro"); intro.hidden = false; intro.className = "p-intro blue";
    var n = 10, it = P.it;
    function draw() {
      intro.innerHTML = '<div class="tracking"></div><div class="intro-osd"><span>STOP ■</span><span>' + epLabel(nx.id) + '</span></div><div class="intro-msg">NEXT EPISODE<b>' + esc(nx.title || "Episode " + nx.episode) +
        "</b>" + (ask ? "READY WHEN YOU ARE" : "STARTING IN " + n) + "<small>OK play" + (ask ? "" : " now") + " · BACK stop</small></div>";
    }
    draw();
    // "Ask" waits for you; "Auto" counts down from 10
    var seq = P.seq, iv = P.introIv = ask ? null : setInterval(function () { n--; if (n <= 0) go(); else draw(); }, 1000);
    function go() { clearInterval(iv); if (!samePlay(seq)) return; P.intro = null; playNext(it, nx.id); }
    P.intro = { skip: go, cancel: function () { clearInterval(iv); if (!samePlay(seq)) return; P.intro = null; rewindEnding(); } };
  }
  function playNext(it, vid) {
    var intro = $("pIntro");
    intro.innerHTML = '<div class="tracking"></div><div class="intro-msg">FINDING THE NEXT TAPE…<small>BACK stop</small></div>';
    var seq = P.seq;
    P.intro = { skip: function () {}, cancel: function () { stopTape(false); } };
    fetchCopies(it, vid).then(function (r) {
      if (!samePlay(seq)) return;
      P.intro = null;
      var c0 = r.copies.filter(function (c) { return c.fake || copyUrl(c); });
      if (!c0.length) { intro.hidden = true; return playerFail("No copies of " + epLabel(vid) + " right now."); }
      if (P.eng) { try { P.eng.close(); } catch (e) {} P.eng = null; }
      P.vid = vid; P.copies = c0; P.idx = 0; P.cues = null; P.cueLabel = "Off"; P.watched = 0; P.autoTries = 0; P.lastAt = 0; P.start = 0; P.nextPre = false;
      $("pTitle").textContent = it.name + " · " + epLabel(vid);
      intro.hidden = true; intro.innerHTML = "";
      openCopy(0, 0);
    });
  }
  function whirr(sec) {
    if (!prefs.sound || !ac || ac.state !== "running") return;
    var f = burst(sec, "bandpass", 400, 0.18);
    f.frequency.linearRampToValueAtTime(3200, ac.currentTime + sec);
  }
  function rewindEnding() {
    if (!P) return;
    var from = P.eng ? P.eng.time() : 0, it = P.it;
    if (P.eng) { try { P.eng.close(); } catch (e) {} P.eng = null; }
    var intro = $("pIntro"); intro.hidden = false; intro.className = "p-intro blue";
    intro.innerHTML = '<div class="tracking"></div><div class="intro-osd"><span>◀◀ REW</span><span id="rwc">' + fmtTime(from) + '</span></div><div class="intro-msg">BE KIND, REWIND</div>';
    whirr(1.8);
    var t0 = Date.now(), dur = 1800;
    var skip = false;
    P.intro = { skip: function () { skip = true; } };
    var seq = P.seq;
    (function frame() {
      if (!samePlay(seq)) return;
      var k = Math.min(1, (Date.now() - t0) / dur);
      var el = $("rwc"); if (el) el.textContent = fmtTime(from * (1 - k));
      if (k < 1 && !skip) return requestAnimationFrame(frame);
      sfx("clunk");
      intro.innerHTML = '<div class="intro-osd"><span>STOP ■</span><span>0:00:00</span></div><div class="intro-msg">THANKS FOR RENTING<b>' + esc(it.name) + "</b>PLEASE COME AGAIN</div>";
      P.endT = setTimeout(function () {
        if (!samePlay(seq)) return;
        if (watched.indexOf(it.id) === -1 && it.type !== "series") { watched.push(it.id); syncWatched(); save("fnv-watched", watched); }
        closePlayer();
        redrawShelves(); updateCounter(); clampFocus(); applyFocus(true);
        clerk("Thanks for bringing back " + it.name + " on time. Here's what I'd watch next.");
      }, 1600);
    })();
  }
  function stopTape(save2) {
    if (!P) return;
    if (P.eng && save2 !== false && !P.ended) {
      var t = P.eng.time(), d = P.eng.duration();
      // stopping in the credits counts as finishing, but only once, and not when the sleep timer is turning things off
      if (d && t / d > 0.92 && !P.sleeping) { closeMenu(); return tapeEnded(true); }
      saveLocalProgress(false); syncStremio(false);
    }
    if (P.eng && !P.sleeping) sfx("eject");
    closePlayer();
    redrawShelves(); clampFocus(); applyFocus(true);
  }
  function closePlayer() {
    if (!P) return;
    if (P.eng) { try { P.eng.close(); } catch (e) {} }
    clearTimeout(P.seekT); clearTimeout(P.osdT); clearTimeout(P.barT); clearTimeout(P.endT);
    clearInterval(P.fadeT); clearInterval(P.introIv);
    P = null;
    var pl = $("player"); pl.hidden = true; pl.classList.remove("bar-on", "vhs", "av", "sleeping");
    $("pIntro").hidden = true; $("pIntro").innerHTML = ""; $("pMenu").hidden = true; $("pSubs").innerHTML = ""; lastCue = "";
    lastInput = Date.now(); tvCurrent = null;
    if (prefs.sound && !sleepHold) startHum(true);
  }

  // --- the remote while a tape is playing ---
  var MEDIA = { PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413, REW: 412, FF: 417, SPACE: 32 };
  function playerKey(k) {
    if (P.sleeping) { wakeUp(); return true; }
    if (P.intro) {
      if (k === KEY.OK || k === MEDIA.PLAY || k === MEDIA.PLAYPAUSE) P.intro.skip();
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP || k === MEDIA.STOP) { if (P.intro.cancel) P.intro.cancel(); else stopTape(false); }
      return true;
    }
    if (P.menu) {
      // Info again closes the playback info it opened
      if (k === KEY.INFO && P.menu.info && P.eng) { closeMenu(); return true; }
      if (k === KEY.UP) { if (P.menu.idx > 0) { P.menu.idx--; menuFocus(); } }
      else if (k === KEY.DOWN) { if (P.menu.idx < P.menu.els.length - 1) { P.menu.idx++; menuFocus(); } }
      else if (k === KEY.OK) { var item = P.menu.list[P.menu.idx]; if (item) item.fn(); }
      // with a tape running, Back closes the menu; with nothing playing (the "won't play" card), it goes back to the store
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP || k === KEY.LEFT) { if (P.eng) closeMenu(); else if (k !== KEY.LEFT) stopTape(false); }
      return true;
    }
    if (!P.eng) { if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP) stopTape(false); return true; }
    if (k === KEY.OK || k === MEDIA.PLAYPAUSE || k === MEDIA.SPACE) togglePause();
    else if (k === MEDIA.PLAY) { if (P.eng.paused()) togglePause(); }
    else if (k === MEDIA.PAUSE) { if (!P.eng.paused()) togglePause(); }
    else if (k === KEY.LEFT) queueSeek(-10000);
    else if (k === KEY.RIGHT) queueSeek(30000);
    else if (k === MEDIA.REW) queueSeek(-60000);
    else if (k === MEDIA.FF) queueSeek(60000);
    else if (k === KEY.UP) { showBar(); osd(P.eng.paused() ? "PAUSE ❚❚" : "PLAY ▶"); }
    else if (k === KEY.DOWN) optionsMenu();
    else if (k === KEY.CAPTION) toggleCaptions();
    else if (k === KEY.INFO) playbackInfo();
    else if (k === MEDIA.STOP) stopTape(true);
    else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP) {
      playerMenu("Stop the tape?", [
        { label: "Keep watching", fn: closeMenu },
        { label: "Stop and go back to the store", fn: function () { stopTape(true); } }
      ]);
    }
    else return false;
    return true;
  }
  $("player").addEventListener("click", function (e) {
    if (!P) return;
    var b = e.target.closest("#pMenu button");
    if (b && P.menu) { P.menu.idx = parseInt(b.getAttribute("data-pi"), 10); menuFocus(); var item = P.menu.list[P.menu.idx]; if (item) item.fn(); return; }
    if (P.intro) { P.intro.skip(); return; }
    if (P.eng) { if (P.menu) closeMenu(); else togglePause(); }
  });

