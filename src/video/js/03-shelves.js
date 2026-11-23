  // ---------- helpers ----------
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }
  var SPINE_COLS = ["#1b1a20", "#efe6d2", "#a8232e", "#1e3c86", "#d8a423", "#2a6643", "#57307a", "#c35a1d", "#0e2a52", "#7a1f2b", "#2b6e78", "#d9cdb5", "#262a33", "#8c2f5c", "#3d4f2a"];
  function lum(hex) { var n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
  function colorsFor(it) {
    var h = hash(it.name), c1 = SPINE_COLS[h % SPINE_COLS.length], c2 = SPINE_COLS[(h >> 4) % SPINE_COLS.length];
    if (c2 === c1) c2 = SPINE_COLS[(h + 3) % SPINE_COLS.length];
    return { c1: c1, c2: c2, c3: c1, ink: lum(c1) > 0.6 ? "#1b1b22" : "#fff4e6" };
  }
  function styleFor(it) { var c = colorsFor(it); return "--c1:" + c.c1 + ";--c2:" + c.c2 + ";--c3:" + c.c3 + ";--c-ink:" + c.ink; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rewindYear() { return rewindY; }
  function visible(it) { var y = rewindYear(); return !y || (it.year && it.year <= y); }
  function rating(it) {
    if (it.type === "series") return "TV";
    var g = it.genres || [];
    if (g.indexOf("Family") !== -1 || g.indexOf("Animation") !== -1) return "G";
    if (g.indexOf("Horror") !== -1 || g.indexOf("Crime") !== -1) return "R";
    return "PG";
  }
  function deepLink(it) {
    var t = it.type === "series" ? "series" : "movie";
    if (it.videoId) return "stremio:///detail/" + t + "/" + it.id + "/" + idPath(it.videoId);
    return t === "movie" ? "stremio:///detail/movie/" + it.id + "/" + it.id : "stremio:///detail/series/" + it.id;
  }
  function aisleList(key) {
    var l = items.filter(function (it) { return it.aisles.indexOf(key) !== -1 && visible(it); });
    var ry = rewindYear();
    if (key === "new" && ry && !onSample) {
      l = items.filter(function (it) { return it.type !== "series" && it.year >= ry - 1 && it.year <= ry && it.aisles.length; });
      var best = function (it) { var b = 1e9; if (it.rk) Object.keys(it.rk).forEach(function (k) { var r = it.rk[k] - (k === "rw" + ry ? 1e6 : 0); if (r < b) b = r; }); return b; };
      return l.map(function (it) { return { it: it, r: best(it) }; }).sort(byRank).map(function (x) { return x.it; });
    }
    if (ry && !onSample && (key === "tv" || isGenreAisle(key))) return eraAisle(key, ry);
    if (key === "new" && !onSample) { var Y = new Date().getFullYear(); l = l.filter(function (it) { return !it.year || it.year >= Y - 1; }); }
    if (key === "classic") l = l.filter(function (it) { return it.year && it.year < 2000; });
    if (RANKED[key]) {
      var fresh = key !== "hold" && !rewindYear();
      l = l.map(function (it, i) { return { it: it, r: (it.rk && it.rk[key] !== undefined ? it.rk[key] : 1e7 + i) + (fresh ? staleness(it) : 0) }; })
        .sort(byRank).map(function (x) { return x.it; });
    }
    // a list from an add-on keeps the list's own order (Letterboxd's ranking, say), not the order its tapes reached the store
    else if (key === "staff" || key.indexOf("addon") === 0) {
      l = l.map(function (it) { return { it: it, r: it.rk && it.rk[key] !== undefined ? it.rk[key] : 1e7 }; }).sort(byRank).map(function (x) { return x.it; });
    }
    return l;
  }

  function ctSize(name) {
    var longest = Math.max.apply(null, String(name).split(/\s+/).map(function (w) { return w.length; }));
    return longest > 11 ? " ct-xs" : longest > 8 ? " ct-s" : "";
  }
  // A flat, inked picture for every box, by genre, in the tape's own colours: what you see before (or instead of) the poster.
  var ART_CACHE = {};
  function coverArt(it, c) {
    var g = it.type === "series" ? "tv" : ((it.genres && it.genres[0]) || "").toLowerCase();
    var kind = /sci|fantasy/.test(g) ? "sci" : /horror/.test(g) ? "horror" : /action|adventure|war|western/.test(g) ? "action" :
      /comedy/.test(g) ? "comedy" : /family|animation|kids/.test(g) ? "family" : /crime|thriller|mystery|suspense|noir/.test(g) ? "crime" :
      /romance/.test(g) ? "romance" : g === "tv" ? "tv" : /drama|history|biography/.test(g) ? "drama" : "burst";
    var A = c.c2, key = kind + A;
    if (ART_CACHE[key]) return ART_CACHE[key];
    var K = "#2a1c18", B = "#fff3d6", I = ' stroke="' + K + '" stroke-width="2.6" stroke-linejoin="round"', b = "";
    if (kind === "sci") b = '<circle cx="16" cy="22" r="1.4" fill="' + B + '"/><circle cx="84" cy="30" r="1.2" fill="' + B + '"/><circle cx="70" cy="16" r="1" fill="' + B + '"/><circle cx="24" cy="70" r="1.1" fill="' + B + '"/>' +
      '<circle cx="52" cy="48" r="22" fill="' + A + '"' + I + '/><path d="M32,54 Q52,46 72,50" fill="none" stroke="' + K + '" stroke-width="2" opacity=".5"/><ellipse cx="52" cy="50" rx="38" ry="8" fill="none" stroke="' + K + '" stroke-width="6"/><ellipse cx="52" cy="50" rx="38" ry="8" fill="none" stroke="' + B + '" stroke-width="2.6"/>';
    else if (kind === "horror") b = '<path d="M14,50 Q50,14 86,50 Q50,86 14,50 Z" fill="' + B + '"' + I + '/><circle cx="50" cy="50" r="14" fill="' + A + '"' + I + '/><circle cx="50" cy="50" r="6" fill="' + K + '"/><circle cx="46" cy="46" r="2.4" fill="' + B + '"/>' +
      '<path d="M22,74 l3,12 l3,-12 M40,78 l3,16 l3,-16 M58,76 l3,10 l3,-10 M74,72 l3,14 l3,-14" fill="#c8352b" stroke="' + K + '" stroke-width="1.4"/>';
    else if (kind === "action") b = '<path d="M50,10 L58,32 L82,22 L70,44 L94,52 L70,60 L82,82 L58,72 L50,94 L42,72 L18,82 L30,60 L6,52 L30,44 L18,22 L42,32 Z" fill="' + A + '"' + I + '/><path d="M50,30 L55,44 L70,46 L58,55 L62,70 L50,61 L38,70 L42,55 L30,46 L45,44 Z" fill="' + B + '"' + I + '/>';
    else if (kind === "comedy") b = '<circle cx="50" cy="50" r="30" fill="' + A + '"' + I + '/><path d="M30,42 h16 v6 h-16 Z M54,42 h16 v6 h-16 Z" fill="' + K + '"/><path d="M46,44 h8" stroke="' + K + '" stroke-width="2.4"/><path d="M34,58 Q50,76 66,58 Z" fill="' + B + '"' + I + '/>';
    else if (kind === "family") b = '<g stroke="' + K + '" stroke-width="2.6">' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (r) { return '<path d="M50,40 L50,14" transform="rotate(' + r + ' 50 40)"/>'; }).join("") + '</g>' +
      '<circle cx="50" cy="40" r="17" fill="#ffd84d"' + I + '/><path d="M-4,92 Q26,62 52,82 Q76,60 104,80 L104,104 L-4,104 Z" fill="' + A + '"' + I + '/>';
    else if (kind === "crime") b = '<circle cx="74" cy="22" r="10" fill="' + B + '"' + I + '/><path d="M44,0 L20,96 L36,96 Z" fill="' + B + '" opacity=".22"/>' +
      '<path d="M-2,96 V62 H12 V48 H24 V66 H34 V40 H48 V70 H58 V54 H70 V64 H80 V44 H92 V96 Z" fill="' + A + '"' + I + '/><path d="M38,48 h4 v4 h-4 Z M84,52 h4 v4 h-4 Z M16,56 h4 v4 h-4 Z" fill="#ffd84d"/>';
    else if (kind === "romance") b = '<path d="M38,70 C10,50 18,24 36,28 C44,30 46,36 46,40 C46,36 50,28 58,28 C76,26 80,50 38,70 Z" fill="' + A + '"' + I + '/>' +
      '<path d="M62,82 C40,66 46,46 60,48 C66,50 68,54 68,58 C68,54 72,48 78,48 C92,48 94,66 62,82 Z" fill="#c8352b"' + I + '/>';
    else if (kind === "tv") b = '<path d="M40,28 L30,10 M60,28 L72,8" stroke="' + K + '" stroke-width="2.6"/><rect x="18" y="28" width="64" height="48" rx="6" fill="' + A + '"' + I + '/>' +
      '<rect x="25" y="35" width="40" height="34" rx="5" fill="' + B + '"' + I + '/><circle cx="74" cy="42" r="3" fill="' + K + '"/><circle cx="74" cy="54" r="3" fill="' + K + '"/>';
    else if (kind === "drama") b = '<circle cx="50" cy="62" r="30" fill="' + A + '"' + I + '/><path d="M18,52 h64 M16,62 h68 M18,72 h64" stroke="' + K + '" stroke-width="5"/>' +
      '<path d="M-4,80 H104 V104 H-4 Z" fill="' + K + '"/>';
    else b = '<g fill="' + A + '" stroke="' + K + '" stroke-width="2">' + [-60, -36, -12, 12, 36, 60].map(function (r) { return '<path d="M50,96 L44,0 L56,0 Z" transform="rotate(' + r + ' 50 96)"/>'; }).join("") + "</g>";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 104">' + b + "</svg>";
    return (ART_CACHE[key] = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")');
  }
  function coverHTML(it, lazy) {
    var c = colorsFor(it), g = (it.genres && it.genres[0]) || "Feature";
    var poster = it.poster && !lazy ? '<img alt="" src="' + esc(it.poster) + '" onerror="this.parentNode.classList.remove(\'has-poster\');this.parentNode.removeChild(this)">' : "";
    return '<div class="cover' + (it.poster && !lazy ? " has-poster" : "") + '"' + (it.poster && lazy ? ' data-poster="' + esc(it.poster) + '"' : "") + ' style="' + styleFor(it) + ';color:' + c.ink + '">' + poster +
      '<i class="art" style="background-image:' + coverArt(it, c).replace(/"/g, "'") + '"></i>' +
      '<div class="band"><span>VHS</span><span>HI-FI</span></div>' +
      '<div class="ct' + ctSize(it.name) + '">' + esc(it.name) + '</div>' +
      '<div class="meta"><span>' + esc(g) + '</span><span>' + (it.year || "") + ' · ' + rating(it) + '</span></div>' +
      '<span class="rs"><b>' + esc(prefs.storeName.toUpperCase()) + '</b><i></i><em>' + (hash(it.id) % 9000 + 1000) + "</em></span>" +
      (hash(it.id) % 3 === 0 ? '<span class="dot2" style="background:' + ["#ffd23f", "#46a758", "#e5484d", "#4c8ff0"][hash(it.name) % 4] + '"></span>' : "") + "</div>";
  }
  // While you read the back of the box, quietly ask the add-ons for copies, so the counter is ready when you get there.
  // Only once you've held the box for a moment, and only for something that's ready to rent (not a box set's episode list).
  function prefetchCopies(it, view) {
    if (!live || !account || !installedAddons.length) return;
    var vid = it.type === "series" ? it.videoId : it.id;
    if (!vid) return;
    setTimeout(function () { if (sameView(view) && modal.caseId === it.id) streamCopies(it, vid, function () {}); }, 700);
  }
  // shelves use the small posters; the box in your hands swaps to a big one once it has loaded
  function bigPoster(url) {
    return String(url || "").replace(/\/poster\/(small|medium)\//, "/poster/large/").replace(/\/t\/p\/w(92|154|185|342|500)\//, "/t/p/w780/");
  }
  function sharpenPoster(box, it) {
    var img = box && box.querySelector(".face.front img"), big = bigPoster(it.poster);
    if (!img || !big || big === it.poster) return;
    var pre = new Image();
    pre.onload = function () { if (document.body.contains(img)) img.src = big; };
    pre.src = big;
  }
  function isRecent(it) { var y = rewindYear() || new Date().getFullYear(); return !it.year || (it.year >= y - 1 && it.year <= y); }
  function daysLate(it) {
    if (!(it.progress > 0.01) || !it.lastWatched) return 0;
    var d = Math.floor((Date.now() - it.lastWatched) / 864e5);
    return d > 14 ? d - 14 : 0;
  }
  function lateFee(it) { return "$" + (daysLate(it) * 0.5).toFixed(2); }
  function blindHTML(it) {
    var g = (it.genres && it.genres[0]) || "mystery";
    var tease = (it.blurb || "").length > 120 ? it.blurb.slice(0, 117).replace(/\s+\S*$/, "") + "…" : (it.blurb || "Trust us on this one.");
    return '<div class="spine kraft"><span class="lbl">?</span><span class="t">Blind date</span><span class="dot" style="background:#d2263a"></span></div>' + blindCover(it);
  }
  function blindCover(it, full) {
    var g = (it.genres && it.genres[0]) || "mystery";
    var tease = !full && (it.blurb || "").length > 120 ? it.blurb.slice(0, 117).replace(/\s+\S*$/, "") + "…" : (it.blurb || "Trust us on this one.");
    return '<div class="cover kraft"><span class="stamp">BLIND DATE</span><div class="tease">' + esc(tease) + "<br>· " + esc(g.toUpperCase()) + " · " + (it.year ? String(it.year).slice(0, 3) + "0s" : "") + "</div></div>";
  }
  function holdSlip() { return '<div class="hold-slip"><b>HOLD</b><span>' + esc((prefs.memberName || "for you").toUpperCase().slice(0, 14)) + "</span></div>"; }
  function tapeHTML(it, isNew, blind, faces) {
    if (blind) return faces ? blindCover(it) : blindHTML(it);
    if (faces) {
      return coverHTML(it, true) +
        (isNew && isRecent(it) && !isWatched(it.id) ? '<div class="new-sticker">NEW</div>' : "") +
        (isWatched(it.id) ? '<div class="rewound">Be kind rewind</div>' : "") +
        (daysLate(it) ? '<div class="late">LATE</div>' : "") +
        (isHeld(it.id) ? holdSlip() : "") +
        (it.progress > 0.01 ? '<div class="prog"><i style="width:' + Math.round(Math.min(1, it.progress) * 100) + '%"></i></div><div class="pbadge">▶ ' + Math.max(1, Math.round(Math.min(1, it.progress) * 100)) + "%</div>" : "");
    }
    var n = it.name.length, longest = Math.max.apply(null, it.name.split(/\s+/).map(function (w) { return w.length; }));
    var tc = n > 30 || longest > 13 ? " t-xl" : n > 15 || longest > 10 ? " t-l" : "";
    return '<div class="spine" style="' + styleFor(it) + '"><span class="lbl">VHS</span><span class="t' + tc + '">' + esc(it.name) +
      '</span><span class="dot"></span></div>' + coverHTML(it, !isNew) +
      (isNew && isRecent(it) && !isWatched(it.id) ? '<div class="new-sticker">NEW</div>' : "") +
      (isWatched(it.id) ? '<div class="rewound">Be kind rewind</div>' : "") +
      (daysLate(it) ? '<div class="late">LATE</div>' : "") +
      (it.progress > 0.01 ? '<div class="prog"><i style="width:' + Math.round(Math.min(1, it.progress) * 100) + '%"></i></div><div class="pbadge">▶ ' + Math.max(1, Math.round(Math.min(1, it.progress) * 100)) + "%</div>" : "");
  }

  // ---------- render ----------
  function renderSigns() {
    var html = "";
    allAisles().forEach(function (a) {
      if (a.key !== "new" && a.key !== aisle && !aisleList(a.key).length) return;
      html += '<button class="sign' + (a.key === "season" ? " seasonal" : "") + (a.key === aisle ? " current" : "") + '" data-aisle="' + a.key + '">' + esc(a.key === "new" && rewindYear() ? "New in " + rewindYear() : a.label) + "</button>";
    });
    $("signs").innerHTML = html;
    signArrows();
  }
  // show an arrow at whichever end of the sign beam has more aisles hidden past the edge
  function signArrows() {
    var el = $("signs"), l = $("signsL"), r = $("signsR");
    if (!el || !l || !r) return;
    if (!el.getAttribute("data-sa")) { el.setAttribute("data-sa", "1"); el.addEventListener("scroll", signArrows); }
    var more = el.scrollWidth - el.clientWidth;
    l.classList.toggle("on", more > 4 && el.scrollLeft > 4);
    r.classList.toggle("on", more > 4 && el.scrollLeft < more - 4);
  }
  // Your Shelf is shown as spines, like a home collection; everything else faces out
  function aisleFaces(key) { return key !== "lib" || isTV(); }   // (on the TV it faces out too: spines are too small to read from the couch)
  function copiesFor(it, i, key) {
    if (key === "new" || key === "season") return i < 10 ? 3 : i < 24 ? 2 : 0;
    if (key === "staff" || key === "cw" || key === "blind") return 0;
    return hash(it.id) % 4 === 0 ? 2 : 0;
  }
  // Big aisles are drawn a chunk at a time: about two screens of tapes a shelf up front, more as you browse towards the end.
  // Hundreds of tapes on the page at once made every press and every aisle change slow on the TV.
  var shelfState = { key: "", list: [], shown: 0, nRows: 2 };
  function tapeButton(it, i, st) {
    var cp = st.faces ? copiesFor(it, i, st.key) : 0;
    return '<button class="tape" data-id="' + esc(it.id) + '"' + (cp ? ' data-copies="' + cp + '"' : "") +
      (st.blind ? ' data-blind="1" aria-label="Blind date tape"' : ' aria-label="' + esc(it.name + (it.year ? ", " + it.year : "")) + '"') + ">" + tapeHTML(it, st.isNew, st.blind, st.faces) + "</button>";
  }
  function growShelves() {
    var st = shelfState;
    if (st.key !== aisle || st.shown >= st.list.length) return false;
    var to = Math.min(st.list.length, st.shown + shelfChunk(st.faces) * st.nRows), html = ["", "", ""];
    for (var i = st.shown; i < to; i++) html[i % st.nRows] += tapeButton(st.list[i], i, st);
    for (var n = 0; n < st.nRows; n++) if (html[n]) $("shelf" + n).insertAdjacentHTML("beforeend", html[n]);
    st.shown = to;
    rebuildRows();
    return true;
  }
  function shelfChunk(faces) { return faces ? 24 : 64; }
  function renderShelves(keepShown) {
    var list = aisleList(aisle);
    var isNew = aisle === "new", blind = aisle === "blind", faces = aisleFaces(aisle);
    var tvLayout = isTV();
    var nRows = faces && !tvLayout ? 3 : 2, groups = [[], [], []];
    var shown = Math.min(list.length, Math.max(shelfChunk(faces) * nRows, keepShown && shelfState.key === aisle ? shelfState.shown : 0));
    shelfState = { key: aisle, list: list, shown: shown, nRows: nRows, faces: faces, isNew: isNew, blind: blind };
    list.slice(0, shown).forEach(function (it, i) { groups[i % nRows].push({ it: it, i: i }); });
    // back to the start of each shelf before swapping the tapes, while the layout is still clean;
    // doing it after made the TV lay out every shelf again, once per shelf
    [0, 1, 2].forEach(function (n) { var el = $("shelf" + n); if (el.scrollLeft) el.scrollLeft = 0; });
    document.querySelector(".fixture").classList.toggle("faces", faces);
    [0, 1, 2].forEach(function (n) {
      var el = $("shelf" + n);
      el.className = "shelf" + (faces ? " faceout" : "");
      if (!list.length && n === 0) { el.innerHTML = '<div class="empty">' + emptyMessage() + "</div>"; return; }
      if (n >= nRows) { el.innerHTML = ""; return; }
      el.innerHTML = groups[n].map(function (g) { return tapeButton(g.it, g.i, shelfState); }).join("");
    });
    var a = allAisles().filter(function (x) { return x.key === aisle; })[0];
    var label = a ? a.label : "";
    var painted = $("painted");
    painted.textContent = label.toLowerCase();
    painted.style.fontSize = "";
    if (painted.scrollWidth > painted.clientWidth && painted.clientWidth) {
      var fs = parseFloat(getComputedStyle(painted).fontSize) || 60;
      painted.style.fontSize = Math.max(16, Math.floor(fs * painted.clientWidth / painted.scrollWidth) - 1) + "px";
    }
    renderTiles(label);
    renderStrips(a);
    renderWallPosters(list, blind);
    stepCache = [0, 0, 0];
    setTimeout(loadVisibleCovers, 0);
  }
  function emptyMessage() {
    if (rewindYear()) return "Nothing on this shelf by<b>" + rewindYear() + "</b>yet. Try a later year.";
    if ((aisle === "cw" || aisle === "lib") && !account) return "Sign in to Stremio at the front desk to see your own tapes here.";
    if (aisle === "cw") return "Nothing in progress. Rent a tape and it'll show up here.";
    if (aisle === "lib") return "Your shelf is empty. Titles you add to your Stremio library land here.";
    if (!live) return "The delivery truck hasn't arrived. Check the TV's internet connection.";
    return "Nothing in this aisle tonight.";
  }
  function renderTiles(label) {
    var html = "", word = label.toUpperCase().replace(/[^A-Z0-9&'!?:\- ]/g, "");
    for (var rep = 0; rep < 6; rep++) {
      for (var i = 0; i < word.length; i++) html += word[i] === " " ? '<i class="sp"></i>' : "<i>" + esc(word[i]) + "</i>";
      html += '<i class="gap">★</i>';
    }
    $("tiles").innerHTML = html;
  }
  function renderStrips(a) {
    var key = a ? a.key : "", name = a ? a.label.toUpperCase() : "";
    var ry = rewindYear();
    var deal = key === "new" ? (ry ? ["New for " + ry, "3 nights", eraPrice(ry)] : ["New release", "3 nights", "$3.99"]) : key === "lib" ? ["Your shelf", "no late fees", "free"] :
      key === "cw" ? ["Keep watching", "rewind optional", "free"] : key === "blind" ? ["Blind date", "no peeking", "$2.99"] :
      key === "season" ? [name, "5 nights", "2 for $5"] : key === "classic" ? ["Classics", "7 nights", "99¢"] :
      key === "hold" ? ["On hold", "behind the counter", (prefs.memberName || "your name").toUpperCase()] : [name || "Catalog", "5 nights", "$1.99"];
    var one = "<span>" + esc(deal[0]) + " · " + esc(deal[1]) + "<b>" + esc(deal[2]) + "</b></span>", html = "";
    html = one;   // one shelf label, not the same price printed fourteen times
    Array.prototype.forEach.call(document.querySelectorAll(".strip"), function (st) { st.innerHTML = html; });
  }
  // painted stand-ins: if a poster is missing or fails to load, the frame shows one of these instead of a black hole
  var PLACEHOLDER_POSTERS = (function () {
    function svg(body) { return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 146" preserveAspectRatio="xMidYMid slice">' + body + "</svg>") + '")'; }
    var I = ' stroke="#2a1c18" stroke-width="2"';
    return [
      svg('<rect width="100" height="146" fill="#1d2a5c"/><circle cx="18" cy="20" r="1.4" fill="#fff"/><circle cx="80" cy="34" r="1.2" fill="#fff"/><circle cx="64" cy="12" r="1" fill="#fff"/>' +
        '<circle cx="54" cy="62" r="26" fill="#e98a3a"' + I + '/><path d="M28,66 Q54,56 80,62 L80,66 Q54,62 28,72 Z" fill="#c8602a"/><ellipse cx="54" cy="64" rx="44" ry="9" fill="none" stroke="#f7d488" stroke-width="3"/>' +
        '<rect x="0" y="108" width="100" height="18" fill="#c8352b"' + I + '/><rect x="16" y="114" width="68" height="5" fill="#fff3d6"/><rect x="26" y="132" width="48" height="4" fill="#8fa6dc"/>'),
      svg('<rect width="100" height="146" fill="#14161c"/><circle cx="50" cy="56" r="28" fill="#9fdc5a"' + I + '/><circle cx="50" cy="56" r="11" fill="#14161c"/><circle cx="46" cy="52" r="3" fill="#fff"/>' +
        '<path d="M14,98 l4,14 l4,-14 M30,98 l3,20 l3,-20 M48,98 l3,12 l3,-12 M66,98 l3,18 l3,-18 M82,98 l3,10 l3,-10" fill="#c8352b"/>' +
        '<rect x="12" y="122" width="76" height="6" fill="#e8e2d0"/><rect x="28" y="133" width="44" height="4" fill="#6a6a74"/>'),
      svg('<rect width="100" height="146" fill="#e8762c"/><path d="M50,14 L60,46 L94,48 L66,68 L76,102 L50,82 L24,102 L34,68 L6,48 L40,46 Z" fill="#ffd84d"' + I + '/>' +
        '<rect x="10" y="114" width="80" height="8" fill="#1b1b22"/><rect x="24" y="128" width="52" height="5" fill="#fff3d6"/>'),
      svg('<rect width="100" height="146" fill="#7fc0c4"/><path d="M0,96 Q30,80 50,92 Q72,104 100,88 L100,146 L0,146 Z" fill="#2f7f86"' + I + '/>' +
        '<circle cx="70" cy="34" r="14" fill="#fff3a6"' + I + '/><path d="M20,70 q10,-10 20,0 q-10,-4 -20,0 Z M44,58 q8,-8 16,0 q-8,-3 -16,0 Z" fill="#2a1c18"/>' +
        '<rect x="12" y="116" width="76" height="8" fill="#fff3d6"' + I + '/>')
    ];
  })();
  function renderWallPosters(list, blind) {
    var picks = blind ? [] : list.filter(function (it) { return it.poster; }).slice(0, 2);
    [0, 1].forEach(function (n) {
      var el = $("wp" + n), it = picks[n] || items.filter(function (x) { return x.poster && x.aisles.length; })[n + 2];
      var stand = PLACEHOLDER_POSTERS[(hash(aisle) + n) % PLACEHOLDER_POSTERS.length];
      el.style.backgroundImage = it ? cssUrl(it.poster) + ", " + stand : stand;
    });
  }
  // posters load for the covers on screen (plus a little either side), not the whole aisle
  var stepCache = [0, 0, 0];
  function loadVisibleCovers() {
    if (!aisleFaces(aisle)) return;
    [0, 1, 2].forEach(function (n) {
      var sh = $("shelf" + n), tapes = sh.children;
      if (!tapes.length || !tapes[0].classList.contains("tape")) return;
      // the first (unfocused) tape gives the spacing; measured once per shelf render
      var step = stepCache[n] || (stepCache[n] = tapes[0].offsetWidth + (parseFloat(getComputedStyle(tapes[0]).marginRight) || 0));
      if (!step) return;
      var i0 = Math.max(0, Math.floor((sh.scrollLeft - sh.clientWidth * 0.4) / step));
      var i1 = Math.min(tapes.length - 1, Math.ceil((sh.scrollLeft + sh.clientWidth * 1.4) / step));
      for (var i = i0; i <= i1; i++) loadCover(tapes[i]);
    });
  }
  function rebuildRows() {
    rows = []; rowKinds = [];
    function push(kind, sel) {
      var els = Array.prototype.slice.call(document.querySelectorAll(sel));
      if (els.length) { rows.push(els); rowKinds.push(kind); }
    }
    push("signs", "#signs .sign");
    push("shelf", "#shelf0 .tape");
    push("shelf", "#shelf1 .tape");
    push("shelf", "#shelf2 .tape");
    push("counter", "#counter .btn");
  }
  function updateCounter() {
    $("rewindVal").textContent = rewindYear() ? String(rewindYear()) : "OFF";
    $("returnsVal").textContent = String(watched.length);
    $("deskVal").textContent = prefs.memberName ? prefs.memberName.split(" ")[0].toUpperCase().slice(0, 10) : "";
  }
  // Redraw the current aisle but keep your place: as many tapes as were drawn, each shelf where it was scrolled to.
  // (Plain renderShelves() starts the aisle from the top, which is right for a new aisle and wrong for anything else.)
  function redrawShelves() {
    var sc = [0, 1, 2].map(function (n) { return $("shelf" + n).scrollLeft; });
    var cur = rows[focus.r] && rows[focus.r][focus.c], fid = cur && cur.classList.contains("tape") ? cur.getAttribute("data-id") : "";
    renderShelves(true); rebuildRows();
    sc.forEach(function (x, n) { if (x) $("shelf" + n).scrollLeft = x; });
    // stay on the same tape even if it moved (Continue Watching puts what you just watched first)
    if (fid) rows.forEach(function (row, r) { if (rowKinds[r] !== "shelf") return; row.forEach(function (el, c) { if (el.getAttribute("data-id") === fid) focus = { r: r, c: c }; }); });
  }
  function renderAll(keepFocus) {
    renderSigns(); if (keepFocus) redrawShelves(); else { renderShelves(); rebuildRows(); } updateCounter(); updateOSD();
    if (!keepFocus) focus = { r: rowKinds.indexOf("shelf") !== -1 ? rowKinds.indexOf("shelf") : 0, c: 0 };
    clampFocus(); applyFocus(true);
  }
  function clampFocus() {
    focus.r = Math.max(0, Math.min(focus.r, rows.length - 1));
    focus.c = Math.max(0, Math.min(focus.c, rows[focus.r].length - 1));
  }

  function updateOSD() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    var y = rewindYear();
    $("osdR").textContent = y ? "SAT 8:00PM " + y : days[d.getDay()] + " " + ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? "AM" : "PM");
  }

  var tvLayoutCache = null;
  function isTV() {
    if (tvLayoutCache === null) tvLayoutCache = !!(window.matchMedia && matchMedia("(min-width: 960px) and (min-aspect-ratio: 4/3)").matches);
    return tvLayoutCache;
  }
  window.addEventListener("resize", function () { tvLayoutCache = null; stepCache = [0, 0, 0]; });
  function applyFocus(quiet) {
    Array.prototype.forEach.call(document.querySelectorAll(".store .focused"), function (e) { e.classList.remove("focused"); });
    var row = rows[focus.r]; if (!row) return;
    var el = row[focus.c]; if (!el) return;
    el.classList.add("focused");
    if (!modal && !isTV()) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
    var parent = el.parentNode;
    // read everything first, then write, so the TV only lays the page out once per press
    var r = isTV() ? null : el.getBoundingClientRect();
    if (parent && (parent.classList.contains("shelf") || parent.id === "signs")) {
      var target = el.offsetLeft - parent.clientWidth / 2 + el.offsetWidth;
      parent.scrollLeft = Math.max(0, target);
      if (parent.classList.contains("shelf")) loadVisibleCovers(); else signArrows();
    }
    if (el.classList.contains("tape")) {
      var it = byId[el.getAttribute("data-id")];
      loadCover(el);
      if (rowKinds[focus.r] === "shelf" && focus.c >= rows[focus.r].length - 8 && !growShelves()) loadMore(aisle);
      if (!el.getAttribute("data-blind") && it && it.genres && it.genres[0]) lastGenre = it.genres[0];
    }
    showTag(el);
    // phones scroll the page; the TV layout fits on one screen
    if (r && (r.top < 0 || r.bottom > window.innerHeight)) window.scrollTo(0, window.pageYOffset + r.top - window.innerHeight * 0.35);
    if (!quiet) { var nowT = Date.now(); moveStreak = nowT - moveClock < 320 ? moveStreak + 1 : 1; moveClock = nowT; sfx(moveStreak > 4 ? "tickfast" : "tick"); }
  }

  // the shelf tag: the title of the tape you're on, in big letters right under it
  function showTag(el) {
    var tags = document.querySelectorAll(".tag");
    for (var i = 0; i < tags.length; i++) tags[i].hidden = true;
    if (!el || !el.classList.contains("tape") || !isTV()) return;
    var sh = el.parentNode, tag = sh.parentNode.querySelector(".tag"), it = byId[el.getAttribute("data-id")];
    if (!tag || !it) return;
    tag.innerHTML = el.getAttribute("data-blind") ? "Blind date<b>? ? ?</b>" : esc(it.name) + (it.year ? "<b>" + esc(it.year) + "</b>" : it.type === "series" ? "<b>TV</b>" : "");
    // centred under the tape; at either end of the shelf it lines up with the tape's edge instead of running off the wall
    var x = el.offsetLeft - sh.scrollLeft, w = el.offsetWidth, W = sh.clientWidth, cx = x + w / 2, edge = window.innerHeight * 0.28;
    tag.className = "tag" + (cx < edge ? " l" : cx > W - edge ? " r" : "");
    tag.style.left = Math.round(cx < edge ? Math.max(0, x) : cx > W - edge ? Math.min(W, x + w) : cx) + "px";
    tag.hidden = false;
    // the shelf's deal label moves to the far end from the tag, so the tag never covers it
    Array.prototype.forEach.call(document.querySelectorAll(".strip"), function (st) { st.classList.remove("far"); });
    var strip = sh.parentNode.querySelector(".strip"); if (strip && cx < W / 2) strip.classList.add("far");
  }
  function loadCover(el) {
    var cov = el.querySelector(".cover[data-poster]");
    if (!cov || cov.getAttribute("data-loading")) return;
    cov.setAttribute("data-loading", "1");
    var img = new Image();
    img.alt = "";
    img.onload = function () { cov.insertBefore(img, cov.firstChild); cov.classList.add("has-poster"); };
    img.src = cov.getAttribute("data-poster");
  }
  // Holding an arrow sends repeats faster than the TV can draw. Move once per drawn frame; if more presses arrive
  // in between, the last one waits its turn and the rest are dropped, so the highlight never runs ahead of the screen.
  var moveBusy = false, moveQueued = null;
  function paced(dr, dc) {
    if (moveBusy) { moveQueued = [dr, dc]; return; }
    moveBusy = true; move(dr, dc);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      moveBusy = false;
      if (moveQueued) { var q = moveQueued; moveQueued = null; paced(q[0], q[1]); }
    }); });
  }
  function move(dr, dc) {
    if (dr) {
      var nr = focus.r + dr;
      if (nr < 0 || nr >= rows.length) return;
      var best = 0;
      if (rowKinds[nr] === "signs") {
        rows[nr].forEach(function (el, i) { if (el.getAttribute("data-aisle") === aisle) best = i; });
      } else {
        var cur = rows[focus.r][focus.c].getBoundingClientRect(), cx = cur.left + cur.width / 2, bd = Infinity;
        var row = rows[nr], i0 = 0, i1 = row.length - 1;
        if (rowKinds[nr] === "shelf" && row.length) {
          var sh = row[0].parentNode;
          var shelfIdx = sh && /^shelf([0-2])$/.test(sh.id) ? +sh.id.charAt(5) : -1;
          var step = shelfIdx >= 0 ? stepCache[shelfIdx] : 0;
          if (step > 0 && sh.clientWidth > 0) {
            i0 = Math.min(row.length - 1, Math.max(0, Math.floor(sh.scrollLeft / step) - 2));
            i1 = Math.min(row.length - 1, Math.ceil((sh.scrollLeft + sh.clientWidth) / step) + 2);
          }
        }
        for (var i = i0; i <= i1; i++) {
          var b = row[i].getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - cx);
          if (d < bd) { bd = d; best = i; }
        }
      }
      focus = { r: nr, c: best };
      applyFocus();
      return;
    }
    var nc = focus.c + dc;
    if (nc >= rows[focus.r].length && rowKinds[focus.r] === "shelf") growShelves();
    if (nc < 0 || nc >= rows[focus.r].length) return;
    focus.c = nc;
    if (rowKinds[focus.r] === "signs") selectAisle(rows[focus.r][nc].getAttribute("data-aisle"));
    else applyFocus();
  }

  // flick to the next or previous aisle and land on its first tape
  function stepAisle(d) {
    var si = rowKinds.indexOf("signs"); if (si < 0) return;
    var keys = rows[si].map(function (el) { return el.getAttribute("data-aisle"); }), i = keys.indexOf(aisle);
    var next = keys[(i + d + keys.length) % keys.length]; if (!next) return;
    selectAisle(next);
    var sh = rowKinds.indexOf("shelf");
    if (sh >= 0) { focus = { r: sh, c: 0 }; applyFocus(true); }
  }
  function selectAisle(key) {
    aisle = key;
    Array.prototype.forEach.call(document.querySelectorAll("#signs .sign"), function (s) {
      s.classList.toggle("current", s.getAttribute("data-aisle") === key);
    });
    renderShelves(); rebuildRows(); noteShown(key);
    focus.r = rowKinds.indexOf("signs");
    rows[focus.r].forEach(function (el, i) { if (el.getAttribute("data-aisle") === key) focus.c = i; });
    applyFocus();
    var first = aisleList(key)[0]; if (first) tvSchedule(first);
  }

  // ---------- the CRT ----------
  var tvTimer = null, trailerTimer = null, tvCurrent = null;
  // ---------- the marquee board ----------
  var mqT = null, mqKey = "";
  function wrapWords(text, max) {
    var words = String(text).toUpperCase().split(/\s+/), lines = [""];
    words.forEach(function (w) {
      var cur = lines[lines.length - 1];
      if (!cur) lines[lines.length - 1] = w;
      else if ((cur + " " + w).length <= max) lines[lines.length - 1] = cur + " " + w;
      else lines.push(w);
    });
    return lines.map(function (l) { return l.length > max ? l.slice(0, max - 1) + "…" : l; });
  }
  function marqueeLines(it, blind) {
    var a = allAisles().filter(function (x) { return x.key === aisle; })[0];
    if (blind) return { head: "BLIND DATE", rows: [["NO PEEKING"], ["? ? ?"], ["UNWRAP AT HOME", 1]] };
    if (!it && rewindYear()) {
      return { head: "REWIND NIGHT", rows: [[(a ? a.label : "The store").toUpperCase().slice(0, 18)], ["ONLY TAPES OUT BY " + rewindYear(), 1], [aisleList(aisle).length + (aisleList(aisle).length === 1 ? " TAPE" : " TAPES") + " ON THE SHELF", 1]] };
    }
    if (!it) {
      var name = a ? a.label : "Welcome", n = aisleList(aisle).length;
      return { head: "NOW ON THE SHELF", rows: wrapWords(name, 18).slice(0, 2).map(function (l) { return [l]; }).concat([[n ? n + (n === 1 ? " TAPE" : " TAPES") + " IN THIS AISLE" : "PICK AN AISLE", 1]]) };
    }
    var m = metaCache[it.id] || {};
    var title = wrapWords(it.name, 20);
    var mins = parseInt(m.runtime || it.runtime, 10);
    var facts = [it.year, mins ? mins + " MIN" : "", rating(it), m.imdbRating ? "★" + m.imdbRating : ""].filter(Boolean).join(" · ");
    var rows = title.length > 2 ? [[title[0]], [title[1].length > 19 ? title[1] : title[1] + "…"]] : title.map(function (l) { return [l]; });
    if (rows.length < 2) rows.push([((it.genres && it.genres[0]) || (it.type === "series" ? "Television" : "Feature")).toUpperCase(), 1]);
    rows.push([facts || "VHS · HI-FI STEREO", 1]);
    return { head: it.aisles.indexOf("new") !== -1 ? "NEW RELEASE" : it.type === "series" ? "NOW ON TV" : "NOW ON THE SHELF", rows: rows };
  }
  function drawMarquee(data) {
    var key = data.head + "|" + data.rows.map(function (r) { return r[0]; }).join("|");
    if (key === mqKey) return;
    mqKey = key;
    $("mqHead").textContent = data.head;
    var k = 0;
    $("mqRows").innerHTML = data.rows.map(function (r) {
      var txt = String(r[0]), html = "";
      for (var i = 0; i < txt.length; i++) {
        var ch = txt[i], cls = ch === " " ? "sp" : (ch === "★" ? "red" : "");
        html += '<b class="' + cls + '">' + (ch === " " ? "&nbsp;" : esc(ch)) + "</b>";
      }
      return '<div class="mq-row' + (r[1] ? " sm" : "") + '">' + html + "</div>";
    }).join("");
  }
  function marqueeFor(it, blind) {
    clearTimeout(mqT);
    // wait until browsing pauses, then change the letters (and again once the details arrive)
    mqT = setTimeout(function () {
      drawMarquee(marqueeLines(it, blind));
      if (it && !blind && !metaCache[it.id]) getMeta(it).then(function () {
        var el = rows[focus.r] && rows[focus.r][focus.c];
        if (el && el.getAttribute("data-id") === it.id) drawMarquee(marqueeLines(it));
      });
    }, 280);
  }
  function tvBlind(it) {
    clearTimeout(tvTimer); clearTimeout(trailerTimer);
    if (!it || tvCurrent === "blind:" + it.id) return;
    tvCurrent = "blind:" + it.id; $("tvFrame").innerHTML = ""; $("tvStill").style.backgroundImage = "";
    staticBurst(200);
    var card = $("tvCard"); card.style.display = "";
    card.innerHTML = '<span class="k">BLIND DATE</span><span class="t">? ? ?</span><span class="s">No peeking. Pick it up to unwrap it.</span>';
    $("osdL").textContent = "PAUSE ❚❚";
  }
  function tvSchedule(it) {
    clearTimeout(tvTimer); clearTimeout(trailerTimer);
    if (!it || (tvCurrent === it.id)) return;
    $("tvFrame").innerHTML = "";
    // wait until you've stopped on a tape before changing the picture: scrolling past costs nothing
    tvTimer = setTimeout(function () { tvShow(it); }, 950);
  }
  // YouTube reports trouble (removed, region-locked, embedding off) through messages; if it does,
  // the corner TV goes back to the still instead of showing an error card.
  // Like Karaoke, embeds route through player.html on GitHub Pages so YouTube sees a real website
  // origin on TizenBrew (avoiding Error 152/153), falling back to a direct embed if the wrapper stalls.
  var YT_DIRECT_ORIGIN = "https://www.youtube-nocookie.com";
  var YT_WRAP_DEFAULT = "https://timmydouglas98-netizen.github.io/friday-and-saturday-night/player.html";
  function ytStored(k) {
    try {
      var raw = localStorage.getItem(k);
      if (raw == null || raw === "") return "";
      try { return JSON.parse(raw); } catch (e) { return raw; }
    } catch (e) { return ""; }
  }
  function ytWrapURL() {
    var u = ytStored("snk-player-url");
    if (typeof u === "string" && u) return u;
    var base = ytStored("snk-phone-url");
    if (typeof base === "string" && base) return base.replace(/index\.html$/, "") + "player.html";
    return YT_WRAP_DEFAULT;
  }
  function ytUrlOrigin(u) {
    var m = /^(https?:\/\/[^\/]+)/.exec(String(u || ""));
    return m ? m[1] : "";
  }
  function ytNoWrap() {
    var v = ytStored("snk-nowrap");
    return v === true || v === 1 || v === "1" || v === "true";
  }
  function ytDirectURL(id, o) {
    var v = encodeURIComponent(id);
    var org = /^https?:\/\//.test(location.origin || "") ? "&origin=" + encodeURIComponent(location.origin) : "";
    return YT_DIRECT_ORIGIN + "/embed/" + v +
      "?autoplay=1&mute=" + (o.mute ? 1 : 0) + "&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1" +
      (o.loop ? "&loop=1&playlist=" + v : "") + org;
  }
  var ytFrames = [];
  // Every trailer goes through here: no controls, no keyboard, no related videos, no annotations, and captions are
  // switched off as soon as the player answers.
  function ytHTML(id, o) {
    o = o || {};
    var v = encodeURIComponent(id);
    var direct = ytDirectURL(id, o);
    var wrapURL = ytWrapURL(), wrapOrigin = ytUrlOrigin(wrapURL);
    var useWrap = !!wrapOrigin && !ytNoWrap() && /^[A-Za-z0-9_\-]{11}$/.test(String(id || ""));
    var src = useWrap ? wrapURL + "#v=" + v + (o.mute ? "&mute=1" : "") + (o.loop ? "&loop=1" : "") : direct;
    return '<iframe class="yt" tabindex="-1" title="' + esc(o.title || "Trailer") + '" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"' +
      (useWrap ? ' data-yt-wrap="' + esc(wrapOrigin) + '" data-yt-direct="' + esc(direct) + '"' : "") +
      ' src="' + esc(src) + '"></iframe>';
  }
  // Watch the trailer: full screen, with sound, over the box you're holding. Back or OK stops it; it closes by
  // itself when the trailer ends, and moves on to the next trailer if YouTube won't play one.
  var trailerView = null;
  function playTrailer(it, ids) {
    closeTrailer();
    clearTimeout(trailerTimer); $("tvFrame").innerHTML = ""; tvCurrent = null; stopHum();
    var el = document.createElement("div"); el.className = "trailer-view";
    document.body.appendChild(el);
    var tv = trailerView = { el: el, n: 0, osdT: 0 };
    function show(n) {
      if (trailerView !== tv) return;
      if (n >= ids.length) { closeTrailer(); toast("YouTube won't play that trailer on this TV", 3000); return; }
      tv.n = n;
      el.innerHTML = '<div class="intro-yt">' + ytHTML(ids[n], { title: "Trailer: " + it.name }) + '</div>' +
        '<div class="intro-osd tv-osd"><span>TRAILER · ' + esc(String(it.name).toUpperCase()) + '</span><span>BACK ◀ STOP</span></div>';
      clearTimeout(tv.osdT); tv.osdT = setTimeout(function () { var o = el.querySelector(".tv-osd"); if (o) o.classList.add("gone"); }, 4000);
      ytWatch(el.querySelector("iframe"), { ended: closeTrailer, error: function () { show(n + 1); } });
    }
    el.addEventListener("click", closeTrailer);
    sfx("clack");
    show(0);
  }
  function closeTrailer() {
    var tv = trailerView; if (!tv) return;
    trailerView = null; clearTimeout(tv.osdT);
    tv.el.innerHTML = ""; if (tv.el.parentNode) tv.el.parentNode.removeChild(tv.el);
    if (modal) modalFocus(true);
    if (prefs.sound && !P && !landingOn && !sleepHold) startHum(true);
  }
  function trailerKey(k) {
    if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP || k === KEY.OK || k === MEDIA.STOP || k === MEDIA.PLAYPAUSE) { sfx("close"); closeTrailer(); return; }
    var o = trailerView.el.querySelector(".tv-osd");   // any other key just brings the label back for a moment
    if (o) { o.classList.remove("gone"); clearTimeout(trailerView.osdT); trailerView.osdT = setTimeout(function () { o.classList.add("gone"); }, 3000); }
  }
  function ytTargetOrigin(frame) {
    var wo = frame && frame.getAttribute("data-yt-wrap");
    return wo || YT_DIRECT_ORIGIN;
  }
  function ytSay(frame, msg) { try { frame.contentWindow.postMessage(JSON.stringify(msg), ytTargetOrigin(frame)); } catch (e) {} }
  function ytQuiet(frame) {
    ytSay(frame, { event: "command", func: "unloadModule", args: ["captions"] });
    ytSay(frame, { event: "command", func: "unloadModule", args: ["cc"] });
    ytSay(frame, { event: "command", func: "setOption", args: ["captions", "track", {}] });
  }
  // h: { playing, ended, error }, each optional
  function ytWatch(frame, h) {
    if (!frame) return;
    ytFrames = ytFrames.filter(function (x) {
      if (document.body.contains(x.frame)) return true;
      clearTimeout(x.wrapT);
      return false;
    });
    var wrapOrigin = frame.getAttribute("data-yt-wrap") || "";
    var direct = frame.getAttribute("data-yt-direct") || "";
    var rec = { frame: frame, h: h || {}, on: false, wrapped: !!wrapOrigin, wrapOrigin: wrapOrigin, wrapOK: false, got: false, wrapT: null };
    if (rec.wrapped && direct) {
      rec.wrapT = setTimeout(function () {
        rec.wrapT = null;
        if (rec.wrapOK || rec.got || !rec.wrapped || !document.body.contains(frame)) return;
        rec.wrapped = false; rec.wrapOrigin = "";
        frame.removeAttribute("data-yt-wrap");
        frame.src = direct;
      }, 6000);
    }
    ytFrames.push(rec);
    frame.addEventListener("load", function () { ytSay(frame, { event: "listening", id: 1, channel: "widget" }); ytQuiet(frame); });
  }
  window.addEventListener("message", function (e) {
    var rec = null;
    ytFrames.forEach(function (x) { if (x.frame.contentWindow && x.frame.contentWindow === e.source) rec = x; });
    if (!rec || !document.body.contains(rec.frame)) return;
    var from = String(e.origin);
    if (!(/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(from) || (rec.wrapped && rec.wrapOrigin && from === rec.wrapOrigin))) return;
    var d = e.data; try { d = typeof d === "string" ? JSON.parse(d) : d; } catch (x) { return; }
    if (!d) return;
    if (d.event === "snk-wrap-ready") {
      rec.wrapOK = true; clearTimeout(rec.wrapT); rec.wrapT = null;
      ytQuiet(rec.frame);
      return;
    }
    rec.got = true; clearTimeout(rec.wrapT); rec.wrapT = null;
    if (d.event === "snk-tick") return;
    var st = d.event === "onStateChange" ? d.info : d.event === "infoDelivery" && d.info ? d.info.playerState : undefined;
    if (d.event === "onReady" || d.event === "initialDelivery") ytQuiet(rec.frame);
    if (d.event === "onError") { if (rec.h.error) rec.h.error(); }
    else if (st === 1) {
      ytQuiet(rec.frame);
      if (!rec.on) { rec.on = true; setTimeout(function () { if (document.body.contains(rec.frame)) ytQuiet(rec.frame); }, 1500); }
      if (rec.h.playing) rec.h.playing();
    }
    else if (st === 0 && rec.h.ended) rec.h.ended();
  });
  function watchTrailer(frame, id) {
    var ok = false;
    ytWatch(frame, { playing: function () { ok = true; }, error: function () { if (!ok && tvCurrent === id) { $("tvFrame").innerHTML = ""; $("osdL").textContent = "PLAY ▶"; } } });
  }
  function tvShow(it) {
    tvCurrent = it.id;
    $("osdL").textContent = "PLAY ▶";
    (function () {
      if (tvCurrent !== it.id) return;
      var card = $("tvCard"), still = $("tvStill");
      card.innerHTML = '<span class="k">NOW SHOWING</span><span class="t">' + esc(it.name) + '</span><span class="s">' +
        esc([it.year, it.director || (it.genres || [])[0]].filter(Boolean).join(" · ")) + "</span>";
      card.style.display = "";
      still.style.backgroundImage = "";
      if (!live || isLight()) return;
      getMeta(it).then(function (m) {
        if (tvCurrent !== it.id) return;
        if (m.background) {
          var img = new Image();
          var show = function () { if (tvCurrent !== it.id) return; still.style.backgroundImage = cssUrl(m.background); card.style.display = "none"; };
          img.src = m.background;
          // decode away from the main thread where the browser can, so the still never stalls a key press
          if (img.decode) img.decode().then(show, function () {}); else img.onload = show;
        }
        if (prefs.trailers && m.trailers.length) {
          trailerTimer = setTimeout(function () {
            if (tvCurrent !== it.id || modal) return;
            $("tvFrame").innerHTML = ytHTML(m.trailers[0], { mute: !prefs.sound, loop: true, title: "Trailer: " + it.name });
            $("osdL").textContent = "TRAILER ▶"; sfx("degauss");
            watchTrailer($("tvFrame").querySelector("iframe"), it.id);
          }, 2600);
        }
      });
    })();
  }
  var noiseCtx = $("tvNoise").getContext("2d");
  function staticBurst(ms) {
    if (isCalm()) return;
    var cv = $("tvNoise"); cv.classList.add("on");
    var end = Date.now() + ms, img = noiseCtx.createImageData(80, 60), d = img.data;
    (function frame() {
      for (var i = 0; i < d.length; i += 4) { var v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      noiseCtx.putImageData(img, 0, 0);
      if (Date.now() < end) requestAnimationFrame(frame); else cv.classList.remove("on");
    })();
    sfx("static");
  }

