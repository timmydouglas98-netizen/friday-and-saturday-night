  // ---------- overlays ----------
  var overlay = $("overlay");
  // The tape flies from its spot on the shelf into your hands, and back again when you put it back.
  var pickSrc = null, picked = null, putting = false;
  // a tape taken from the back room: where it sat, and which shelf to return to
  var pickFrom = null;
  function rectOf(el) { return (el.querySelector(".cover") || el).getBoundingClientRect(); }
  function flyTransform(a, b, k, lift, tilt) {
    var s = a.width / b.width, sc = s + (1 - s) * (1 - k);
    var dx = (a.left + a.width / 2) - (b.left + b.width / 2), dy = (a.top + a.height / 2) - (b.top + b.height / 2);
    return "translate(" + (dx * k).toFixed(1) + "px," + (dy * k - lift).toFixed(1) + "px) scale(" + sc.toFixed(3) + ") rotate(" + tilt + "deg)";
  }
  function liftFrom(box) {
    var src = pickSrc; pickSrc = null;
    var from = pickFrom; pickFrom = null;
    if (from && box && box.animate) {
      // the back-room shelf has already been swapped for the case, so fly from where the tape was
      var fb = box.getBoundingClientRect(), fp = overlay.querySelector(".panel");
      if (picked && picked.src) picked.src.style.visibility = "";
      picked = { rect: from.rect, back: from.back, box: box };
      fp.classList.add("no-ease"); overlay.classList.add("no-ease"); fp.classList.add("lifting"); overlay.classList.add("lifting");
      void getComputedStyle(fp).opacity; fp.classList.remove("no-ease"); overlay.classList.remove("no-ease");
      calmAnim(box, [
        { transform: flyTransform(from.rect, fb, 1, 0, 0) },
        { transform: flyTransform(from.rect, fb, .5, fb.height * .07, -4), offset: .5 },
        { transform: "translate(0,0) scale(1) rotate(0deg)" }
      ], { duration: 560, easing: "cubic-bezier(.25,.8,.3,1)" });
      requestAnimationFrame(function () { requestAnimationFrame(function () { fp.classList.remove("lifting"); overlay.classList.remove("lifting"); }); });
      return;
    }
    if (!src) { if (picked && box) picked.box = box; return; }   // re-drawn while still in hand
    if (picked) { if (picked.src) picked.src.style.visibility = ""; picked = null; }
    if (!box || !box.animate || !document.body.contains(src)) return;
    var a = rectOf(src), b = box.getBoundingClientRect(), panel = overlay.querySelector(".panel");
    if (!a.width || !b.width) return;
    picked = { src: src, box: box };
    src.style.visibility = "hidden";
    // jump straight to "no backdrop yet" (no transition), then let it fade in while the box flies
    panel.classList.add("no-ease"); overlay.classList.add("no-ease");
    panel.classList.add("lifting"); overlay.classList.add("lifting");
    void getComputedStyle(panel).opacity; void overlay.offsetWidth;
    panel.classList.remove("no-ease"); overlay.classList.remove("no-ease");
    calmAnim(box, [
      { transform: flyTransform(a, b, 1, 0, 0) },
      { transform: flyTransform(a, b, .5, b.height * .07, -4), offset: .5 },
      { transform: "translate(0,0) scale(1) rotate(0deg)" }
    ], { duration: 560, easing: "cubic-bezier(.25,.8,.3,1)" });
    requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.remove("lifting"); overlay.classList.remove("lifting"); }); });
  }
  function putBack() {
    if (putting) return;
    var toBack = picked && picked.back;
    if (!picked || !document.body.contains(picked.box) || (!toBack && !document.body.contains(picked.src))) return toBack ? reopenBack(toBack) : closeModal();
    var box = picked.box, a = toBack ? picked.rect : rectOf(picked.src), b = box.getBoundingClientRect(), panel = overlay.querySelector(".panel");
    putting = true;
    if (box.classList.contains("flipped")) {
      var card = box.querySelector(".card"); if (card) card.style.transition = "transform .42s cubic-bezier(.45,0,.6,1)";
      box.classList.remove("flipped");
    }
    panel.classList.add("lifting"); overlay.classList.add("lifting");
    var done = false;
    function end() { if (done) return; done = true; putting = false; overlay.classList.remove("lifting"); if (toBack) reopenBack(toBack); else closeModal(); }
    var anim = calmAnim(box, [
      { transform: "translate(0,0) scale(1) rotate(0deg)" },
      { transform: flyTransform(a, b, .55, b.height * .05, -3), offset: .45 },
      { transform: flyTransform(a, b, 1, 0, 0) }
    ], { duration: 420, easing: "cubic-bezier(.45,0,.6,1)", fill: "forwards" });
    anim.onfinish = end; setTimeout(end, 700);
    sfx("shhk");
  }
  function openModal(html, onBack) {
    if (!lastStoreFocus) lastStoreFocus = { r: focus.r, c: focus.c };
    $("tvFrame").innerHTML = ""; clearTimeout(trailerTimer);
    overlay.classList.remove("holding");
    overlay.innerHTML = html; overlay.hidden = false;
    Array.prototype.forEach.call(overlay.querySelectorAll(".clerk-face"), function (f) {
      var who = f.getAttribute("data-who") || shiftNow(), g = (f.textContent || "").trim();
      f.innerHTML = clerkPortrait(who) + (g && g !== CLERKS.day.face && g !== CLERKS.night.face ? '<i class="cf-badge">' + esc(g) + "</i>" : "");
    });
    var els = Array.prototype.slice.call(overlay.querySelectorAll("[data-m]"));
    modal = { els: els, idx: 0, onBack: onBack || closeModal, seq: ++viewSeq };
    if (ac) duckRoom(true);
    modalFocus(true);
  }
  // Arrows in a panel go where they point: up and down between rows, left and right along one. At the end of a line,
  // left and right carry on to the next one, so nothing is out of reach.
  function modalMove(k) {
    var els = modal.els, cur = els[modal.idx], vert = k === KEY.UP || k === KEY.DOWN, fwd = k === KEY.DOWN || k === KEY.RIGHT, pick = -1;
    if (cur) {
      var a = cur.getBoundingClientRect(), cands = [], near = Infinity;
      els.forEach(function (el, i) {
        if (i === modal.idx) return;
        var b = el.getBoundingClientRect(); if (!b.width && !b.height) return;
        var gap, side, tol = Math.max(4, Math.min(a.height, b.height) * .3);
        if (vert) {
          gap = fwd ? b.top - a.bottom : a.top - b.bottom;
          side = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));      // 0 when one is above the other
        } else {
          gap = fwd ? b.left - a.right : a.left - b.right;
          side = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
          if (side > 0) return;                                                             // left and right stay on the line
        }
        if (gap < -tol) return;
        gap = Math.max(0, gap);
        cands.push({ i: i, gap: gap, side: side, mid: vert ? Math.abs(a.left + a.width / 2 - b.left - b.width / 2) : Math.abs(a.top + a.height / 2 - b.top - b.height / 2) });
        if (gap < near) near = gap;
      });
      // the nearest row (or the nearest thing along the line), and on it whatever lines up best
      var band = near + (vert ? a.height : a.width) * 0.5, best = null;
      cands.forEach(function (c) {
        if (c.gap > band) return;
        if (!best || c.side < best.side || (c.side === best.side && (vert ? c.mid < best.mid : c.gap < best.gap))) best = c;
      });
      if (best) pick = best.i;
    }
    if (pick === -1 && !vert) { pick = modal.idx + (fwd ? 1 : -1); if (pick < 0 || pick >= els.length) pick = -1; }
    if (pick !== -1) { modal.idx = pick; modalFocus(); }
  }
  function modalFocus(quiet) {
    modal.els.forEach(function (e) {
      e.classList.remove("focused");
      if (e.tagName === "INPUT" && e.hasAttribute("data-ph")) e.placeholder = e.getAttribute("data-ph");
    });
    var el = modal.els[modal.idx]; if (!el) return;
    el.classList.add("focused");
    if (el.tagName === "INPUT") {
      // Highlight a text box without opening the TV's keyboard; OK opens it.
      var ae = document.activeElement;
      if (ae && ae !== el && ae.blur) ae.blur();
      if (document.activeElement !== el) {
        if (!el.hasAttribute("data-ph")) el.setAttribute("data-ph", el.placeholder || "");
        if (!el.value) el.placeholder = (el.getAttribute("data-ph") ? el.getAttribute("data-ph") + " · " : "") + "press OK to type";
      }
    } else if (!isTV()) {
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    } else if (document.activeElement && document.activeElement !== el && document.activeElement.tagName === "INPUT") document.activeElement.blur();
    try { el.scrollIntoView({ block: "nearest" }); } catch (e) {}
    if (!quiet) sfx("tick");
  }
  function dismissModal() { if (modal.onBack !== putBack) sfx("close"); modal.onBack(); }
  // back onto the back-room shelf, in the same spot, with the same tapes
  function reopenBack(back) { picked = null; backroomShelf(back.who, back.list, back.focus); }
  // every panel gets its own number: a slow answer meant for an earlier panel is dropped instead of drawn into this one
  var viewSeq = 0;
  function sameView(v) { return !!modal && modal.seq === v; }
  function closeModal() {
    viewSeq++;
    closeTrailer();
    if (osk) closeBoard(true);
    stopLinkPoll();
    overlay.hidden = true; overlay.innerHTML = ""; modal = null; overlay.classList.remove("holding");
    if (ac) duckRoom(false);
    overlay.classList.remove("lifting");
    if (picked) { if (picked.src) picked.src.style.visibility = ""; picked = null; }
    if (lastStoreFocus) { focus = lastStoreFocus; lastStoreFocus = null; }
    clampFocus(); tvCurrent = null; applyFocus(true);
  }
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) { if (modal) dismissModal(); return; }
    var box = e.target.closest(".box3d");
    if (box) { flipBox(); return; }
    var b = e.target.closest("[data-m]"); if (!b || !modal) return;
    modal.idx = modal.els.indexOf(b); modalFocus(true); activateModal(b);
  });

  // Stills for the back of the box. A series gets three different episodes; a film gets one wide still.
  // Nothing shows until the pictures have actually loaded, and a missing picture just drops out.
  function stillsHTML(m) {
    var thumbs = (m.videos || []).filter(function (v) { return v.thumbnail && v.season > 0; });
    var pics = [];
    if (thumbs.length >= 3) pics = [thumbs[0], thumbs[Math.floor(thumbs.length / 2)], thumbs[thumbs.length - 1]].map(function (v) { return v.thumbnail; });
    else if (m.background) pics = [m.background];
    if (!pics.length) return "";
    return '<div class="shots ' + (pics.length > 1 ? "three" : "one") + '">' + pics.map(function (u) { return '<i data-src="' + esc(u) + '"></i>'; }).join("") + "</div>";
  }
  function armStills(root) {
    var box = root && root.querySelector(".shots"); if (!box) return;
    var tiles = Array.prototype.slice.call(box.querySelectorAll("i[data-src]")), left = tiles.length;
    tiles.forEach(function (t) {
      var img = new Image();
      img.onload = function () { t.style.backgroundImage = cssUrl(t.getAttribute("data-src")); t.classList.add("ok"); if (!--left) done(); };
      img.onerror = function () { if (t.parentNode) t.parentNode.removeChild(t); if (!--left) done(); };
      img.src = t.getAttribute("data-src");
    });
    function done() {
      var ok = box.querySelectorAll("i.ok").length;
      if (!ok) { if (box.parentNode) box.parentNode.removeChild(box); return; }
      if (ok === 1) { box.className = "shots one"; }
      box.classList.add("ready");
    }
  }
  function backHTML(it, m) {
    var cast = (m.cast || []).slice(0, 3).join(" · ");
    var dir = (m.director || []).join(", ");
    return '<div class="vback" style="' + styleFor(it) + '">' +
      '<div class="bt">' + esc(it.name) + "</div>" +
      '<p class="syn">' + esc(m.description || "No write-up on the back of this one. Living dangerously.") + "</p>" +
      (cast ? '<p class="star"><b>Starring</b> ' + esc(cast) + "</p>" : "") +
      stillsHTML(m) +
      '<div class="vinfo">' + (dir ? '<span class="dir">Directed by ' + esc(dir) + "</span>" : "") +
      '<span class="box">' + rating(it) + "</span>" +
      (m.runtime ? '<span class="box">' + esc(String(m.runtime).toUpperCase()) + "</span>" : "") +
      (m.imdbRating ? '<span class="box">IMDb ' + esc(m.imdbRating) + "</span>" : "") +
      '<span class="bar"></span><span class="fmt">VHS · COLOR · HI-FI STEREO · ' + (it.year || "") + "</span></div></div>";
  }
  function caseView(it, quiet, from) {
    if (cwUndo && cwUndo.id !== it.id) cwUndo = null;
    if (!quiet) sfx("clack");
    if (!quiet && seen[it.id]) { delete seen[it.id]; saveSeenSoon(); }   // picked up: it isn't being walked past
    if (!quiet && daysLate(it)) later([380], function () { sfx("coin"); });
    var w = isWatched(it.id);
    var lateChip = daysLate(it) ? '<span class="chip late-chip">LATE · ' + lateFee(it) + " owing</span>" : "";
    if (from === "backroom") lateChip += '<span class="chip br-chip">BACK ROOM</span>';
    var talker = it.aisles.indexOf("staff") !== -1 ? '<div class="shelf-talker">' + STAFF_NOTE + " <b>— Staff</b></div>" : "";
    var facts = [it.year, rating(it)].concat((it.genres || []).slice(0, 2), it.runtime ? [it.runtime + " min"] : []).filter(Boolean)
      .map(function (f) { return '<span class="chip">' + esc(f) + "</span>"; }).join("");
    openModal('<div class="panel case" role="dialog" aria-label="' + esc(it.name) + '"><div class="case-view">' +
      '<div class="box3d" id="box3d"><div class="card"><div class="face front">' + coverHTML(it) + (isHeld(it.id) ? holdSlip() : "") + '</div><div class="face back" id="boxBack">' + backHTML(it, { description: it.blurb, cast: it.cast || [], director: arr(it.director) }) + "</div></div></div>" +
      '<div class="details"><h3>' + esc(it.name) + '</h3><div class="facts" id="facts">' + facts + lateChip + "</div>" +
      '<div class="case-info"><p class="cblurb" id="cBlurb">' + esc(it.blurb || "") + '</p><p class="ccred" id="cCred">' + caseCredits(it, { director: arr(it.director), cast: it.cast || [] }) + "</p></div>" +
      talker +
      '<div class="actions grid2">' +
      (it.type === "series"
        ? (it.videoId ? '<button class="btn primary" data-m="rent" data-id="' + esc(it.id) + '" data-vid="' + esc(it.videoId) + '">Keep watching ' + esc(epLabel(it.videoId)) + "</button>" : "") +
          '<button class="btn' + (it.videoId ? "" : " primary") + '" data-m="episodes" data-id="' + esc(it.id) + '">Open the box set</button>'
        : '<button class="btn primary" data-m="rent" data-id="' + esc(it.id) + '">' + (resumePoint(it, it.id) ? "Keep watching" : "Rent it") + "</button>") +
      '<button class="btn" data-m="flip">Flip the box</button>' +
      '<button class="btn" data-m="watched" data-id="' + esc(it.id) + '">' + (w ? "Take it out of returns" : "Mark as watched") + "</button>" +
      '<button class="btn" data-m="hold" data-id="' + esc(it.id) + '">' + (isHeld(it.id) ? "Take it off hold" : "Put it on hold") + "</button>" +
      (it.aisles.indexOf("cw") !== -1 ? '<button class="btn" data-m="uncw" data-id="' + esc(it.id) + '">Take off Continue Watching</button>'
        : cwUndo && cwUndo.id === it.id ? '<button class="btn" data-m="recw" data-id="' + esc(it.id) + '">Undo · put back on Continue Watching</button>' : "") +
      '<button class="btn" data-m="close">Put it back</button>' +
      "</div></div></div></div>", putBack);
    modal.caseId = it.id; modal.from = from || "";
    overlay.classList.add("holding");   // the store dims further while you've got a box in your hands
    sharpenPoster($("box3d"), it);
    prefetchCopies(it, modal.seq);
    liftFrom($("box3d"));
    getMeta(it).then(function (m) {
      var back = $("boxBack"); if (!back) return;
      back.innerHTML = backHTML(it, m); armStills(back);
      var cb = $("cBlurb"), cc = $("cCred");
      if (cb && m.description) cb.textContent = m.description;
      if (cc) cc.innerHTML = caseCredits(it, m);
      var rtm = parseInt(m.runtime, 10);
      if (rtm && $("facts") && !$("facts").querySelector(".rt") && !/\d min/.test($("facts").textContent)) $("facts").insertAdjacentHTML("beforeend", '<span class="chip rt">' + rtm + " min</span>");
      if (m.imdbRating && $("facts")) $("facts").insertAdjacentHTML("beforeend", '<span class="chip imdb">IMDb ' + esc(m.imdbRating) + "</span>");
      // the trailer button goes on the box once we know there's a trailer to show
      if (m.trailers && m.trailers.length && modal && modal.caseId === it.id && !overlay.querySelector('[data-m="trailer"]')) {
        var flipBtn = overlay.querySelector('[data-m="flip"]'), cur = modal.els[modal.idx];
        if (flipBtn) {
          flipBtn.insertAdjacentHTML("beforebegin", '<button class="btn" data-m="trailer" data-id="' + esc(it.id) + '">Watch the trailer</button>');
          modal.trailers = m.trailers.slice(0, 4);
          refreshModalEls(); modal.idx = Math.max(0, modal.els.indexOf(cur)); modalFocus(true);
        }
      }
    });
  }
  function caseCredits(it, m) {
    var dir = (m.director || []).filter(Boolean).join(", "), cast = (m.cast || []).filter(Boolean).slice(0, 3).join(", "), mins = parseInt(m.runtime || it.runtime, 10);
    // (the runtime sits on the facts line above, not here)
    return [dir ? "<span><b>Directed by</b> " + esc(dir) + "</span>" : "", cast ? "<span><b>Starring</b> " + esc(cast) + "</span>" : ""].filter(Boolean).join("");
  }
  function flipBox() {
    var b = $("box3d"); if (!b) return;
    b.classList.toggle("flipped"); sfx("flip"); sfx("creak");
  }


  function pickOne(list) { return list[Math.floor(Math.random() * list.length)]; }
  function shuffled(list) {
    var a = list.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  var moveClock = 0, moveStreak = 0, clerkReroll = false;
  // Two clerks share the counter. Their own picks come from the Letterboxd lists you give them (Front desk > Clerks & back room).
  var CLERKS = {
    day: { name: "DAVE", shift: "Day shift", face: ":)",
      lines: ["G'day. Here's what I'd take home tonight.", "Can't decide? Happens to the best of us. Try one of these.", "These three never come back with complaints.", "Grab one of these, mate. Can't go wrong."],
      own: ["One of my favourites. A beaut.", "Seen it a dozen times. Still a beaut.", "Took this home last weekend. Bring it back and tell me what you reckon."],
      safe: "Everyone's renting it this week. Can't go wrong.", near: function (g) { return "You were in " + g + ". This one's right next door."; }, wild: "Bit different, but a beaut.",
      back: ["Found a few things back there. Dusty, but they all play.", "Haven't been back there in a while. Look what turned up."],
      empty: "Back room's pretty bare at the moment, sorry." },
    night: { name: "GUS", shift: "Night shift", face: "-_-",
      lines: ["Oh. A customer. Fine, here.", "I mean, if you insist.", "Nobody asks me anything good. Prove me wrong.", "Here. And don't bring it back rewound halfway."],
      own: ["Nobody rents this. That's the point.", "I mean, if you insist. You will.", "This one's mine. Bring it back."],
      safe: "Popular. If that's your thing.", near: function (g) { return "More " + g + ". Predictable. I respect it."; }, wild: "I mean, if you insist.",
      back: ["Here's the good stuff. Don't tell Dave.", "The back room. Where the weird ones live."],
      empty: "Back room's empty. Someone stole the weird stuff." }
  };
  function shiftNow() { var h = new Date().getHours(); return h >= 6 && h < 18 ? "day" : "night"; }
  function clerkHead(text, who) {
    var C = CLERKS[who || shiftNow()];
    return '<div class="clerk-head"><div class="clerk-face" aria-hidden="true" data-who="' + (who || shiftNow()) + '">' + C.face + '</div><div class="ntag"><b>' + C.name + "</b><span>" + C.shift + "</span></div><p>" + esc(text) + "</p></div>";
  }
  var roleItems = { day: [], night: [], back: [] }, catalogChoices = [];
  function listPool(role) { return (roleItems[role] || []).filter(function (it) { return visible(it) && !isWatched(it.id); }); }
  function clerk(opening) {
    var who = shiftNow(), C = CLERKS[who];
    // only what's out on the floor; the back room stays in the back room
    var pool = items.filter(function (it) { return it.aisles.length && visible(it) && !isWatched(it.id); });
    if (pool.length < 3) pool = items.filter(function (it) { return it.aisles.length && visible(it); });
    if (!pool.length) return;
    var used = {};
    function take(list) { list = list.filter(function (x) { return !used[x.id]; }); var p = list.length ? pickOne(list.slice(0, 8)) : null; if (p) used[p.id] = 1; return p; }
    // the clerk's own pick comes from their lists; Gus will raid the back room if he has none
    var own = take(shuffled(listPool(who))) || (who === "night" ? take(shuffled(listPool("back"))) : null);
    var safe = own ? null : (take(pool.filter(function (it) { return it.aisles.indexOf("new") !== -1 || it.aisles.indexOf("staff") !== -1; })) || take(pool));
    var near = take(shuffled(pool.filter(function (it) { return (it.genres || []).indexOf(lastGenre) !== -1; }))) || take(pool);
    var wild = take(shuffled(pool.filter(function (it) { return (it.genres || []).indexOf(lastGenre) === -1; }))) || take(pool);
    var picks = [[C.name.charAt(0) + C.name.slice(1).toLowerCase() + "'s pick", own, own ? pickOne(C.own) + (own.fromList ? " (" + own.fromList + ")" : "") : ""],
                 ["A safe bet", safe, C.safe],
                 ["Something adjacent", near, C.near(lastGenre)],
                 ["A wildcard", wild, C.wild]].filter(function (p) { return p[1]; });
    sfx(clerkReroll ? "shuffle" : "bell");
    openModal('<div class="panel" role="dialog" aria-label="Ask the clerk">' + clerkHead(opening || pickOne(C.lines), who) + '<div class="picks">' +
      picks.map(function (p) {
        return '<button class="pick" data-m="open" data-id="' + esc(p[1].id) + '"><span class="why">' + p[0] + '</span><span class="pt">' +
          esc(p[1].name) + '</span><span class="pn">' + esc(p[2]) + (p[1].year ? " · " + p[1].year : "") + "</span></button>";
      }).join("") + '</div><div class="actions"><button class="btn" data-m="reroll">Ask again</button><button class="btn primary" data-m="double">Make it a double feature</button>' +
      '<button class="btn" data-m="backroom">Check the back room</button><button class="btn" data-m="close">Never mind</button></div></div>');
  }

  // ---------- the back room: you can't browse it, you have to ask ----------
  function backroomPool() {
    var pool = listPool("back"), fallback = false;
    if (pool.length < 4) {
      // no cult lists set up yet: the oldest odd stuff on the shelves will do
      fallback = true;
      pool = pool.concat(items.filter(function (it) {
        var g = it.genres || [];
        return it.type !== "series" && visible(it) && !isWatched(it.id) && it.year && it.year < 1995 &&
          (g.indexOf("Horror") !== -1 || g.indexOf("Sci-Fi") !== -1 || g.indexOf("Fantasy") !== -1 || g.indexOf("Thriller") !== -1);
      }));
    }
    // a different handful each day
    var r = rand(hash(new Date().toDateString()) || 7), a = pool.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return { list: a.slice(0, 8), fallback: fallback };
  }
  function backroomVisit() {
    var who = shiftNow();
    openModal('<div class="panel backroom" role="dialog" aria-label="The back room">' + clerkHead("Give me a sec, I'll go look.", who) +
      '<p class="rummage">*rummaging through boxes<i>…</i>*</p><div class="actions"><button class="btn" data-m="close">Never mind</button></div></div>');
    modal.view = "rummage";
    sfx("rummage");
    var view = modal.seq;
    setTimeout(function () { if (sameView(view)) { sfx("shhk"); backroomShelf(who); } }, 2600);
  }
  function backroomShelf(who, keep, focusIdx) {
    var C = CLERKS[who], got = keep ? { list: keep, fallback: false } : backroomPool();
    var tilts = [-2.5, 1.5, -1, 2, 1, -2, 2.5, -1.5];
    openModal('<div class="panel backroom" role="dialog" aria-label="The back room">' + clerkHead(keep ? "Find something else back there?" : got.list.length ? pickOne(C.back) : C.empty, who) +
      [got.list.slice(0, 4), got.list.slice(4, 8)].filter(function (row) { return row.length; }).map(function (row, r) {
        return '<div class="bk-shelf">' + row.map(function (it, i) {
          return '<button class="bk" data-m="open" data-id="' + esc(it.id) + '" style="--tilt:' + tilts[(r * 4 + i) % tilts.length] + 'deg">' + coverHTML(it) + '<span class="mt' + (it.name.length > 16 ? " mt-s" : "") + '">' + esc(it.name) + "</span></button>";
        }).join("") + "</div>";
      }).join("") +
      (got.fallback ? '<p class="note">These are the house picks. Got your own cult favourites? Put a list in the back room from the back office, under Clerks &amp; back room.</p>' : "") +
      '<div class="actions"><button class="btn" data-m="clerk">Back to the counter</button><button class="btn" data-m="close">Never mind</button></div></div>');
    modal.view = "backroom"; modal.who = who; modal.bkList = got.list;
    if (focusIdx) { modal.idx = Math.min(focusIdx, modal.els.length - 1); modalFocus(true); }
  }

  // ---------- which lists go where ----------
  var ROLE_LABEL = { aisle: "Shelf aisle", day: "Dave's picks", night: "Gus's picks", back: "Back room", off: "Hidden" };
  var ROLE_ORDER = ["aisle", "back", "night", "day", "off"];
  function listRole(key, name) {
    var set = prefs.listRoles || {};
    if (set[key]) return set[key];
    // whole words only: "difficult" and "pop culture" are not cult lists
    return /\b(cult|midnight|trash|grindhouse|b-movies?|b movies?|exploitation|weird|odd|obscure|video nast\w*|so bad|cursed)\b/i.test(name || "") ? "back" : "aisle";
  }
  var listsT = null;
  function listsPanel(idx) {
    var listButtons = catalogChoices.map(function (c, i) {
      var how = c.role === "off" ? "" : c.full ? " · no room for another aisle" : c.fail ? " · didn't answer, will try again" : typeof c.n === "number" ? " · " + c.n + (c.more ? "+" : "") + (c.n === 1 ? " tape" : " tapes") : "";
      return '<button class="btn" data-m="listrole" data-i="' + i + '"><span class="lab">' + esc(c.name) + '</span><span class="val">' + ROLE_LABEL[c.role] + how + "</span></button>";
    }).join("");
    openModal('<div class="panel lists" role="dialog" aria-label="Clerks and the back room">' +
      clerkHead(catalogChoices.length ? "Each list from your add-ons can be its own aisle, one of our picks, or hidden in the back room. Press OK to change." :
        account ? "No lists yet. Add some to Stremboxd and they'll turn up here." : "Sign in to Stremio first, then your lists will turn up here.") +
      '<ol class="steps"><li>Find lists on <b>letterboxd.com</b> (try searching lists for "cult" or "Criterion Closet") and copy their links</li>' +
      '<li>At <b>stremboxd.com/configure</b>, paste them under custom lists and install again</li>' +
      "<li>Come back here and choose who gets each list. Dave works days (6am to 6pm), Gus works nights</li></ol>" +
      '<div class="actions col">' + listButtons + '<button class="btn" data-m="refresh-lists">Look for new lists</button><button class="btn" data-m="office">Back to the back office</button></div></div>');
    modal.view = "lists";
    if (idx) { modal.idx = Math.min(idx, modal.els.length - 1); modalFocus(true); }
  }
  function cycleRole(i) {
    var c = catalogChoices[i]; if (!c) return;
    c.role = ROLE_ORDER[(ROLE_ORDER.indexOf(c.role) + 1) % ROLE_ORDER.length];
    prefs.listRoles = prefs.listRoles || {}; prefs.listRoles[c.key] = c.role; save("fnv-prefs", prefs);
    listsPanel(modal.idx);
    // restock once you've stopped pressing
    clearTimeout(listsT); listsT = setTimeout(function () { refreshAccount(false); }, 1800);
  }
  function returns() {
    sfx("shuffle");
    var list = watched.map(function (id) { return byId[id]; }).filter(Boolean);
    openModal('<div class="panel"><div class="clerk-head"><div class="clerk-face" aria-hidden="true">↩</div><p>' +
      (list.length ? "You've returned " + list.length + " tape" + (list.length === 1 ? "" : "s") + ". Pick one to pull back out." : "Nothing in the return slot yet. Mark a tape as watched and it lands here.") +
      '</p></div><div class="picks">' +
      list.slice(-6).reverse().map(function (it) {
        return '<button class="pick" data-m="open" data-id="' + esc(it.id) + '"><span class="why">Returned</span><span class="pt">' + esc(it.name) + '</span><span class="pn">' + (it.year || "") + "</span></button>";
      }).join("") + '</div><div class="actions"><button class="btn" data-m="close">Back to the aisles</button></div></div>');
  }

  // ---------- the letter board ----------
  var OSK_LAYERS = {
    abc: ["abcdefghij", "klmnopqrst", "uvwxyz'-.,", "1234567890"],
    sym: ["@._-/:&!?#", "+=()%$*;\"~", "<>[]{}|\\^`", "1234567890"]
  };
  var osk = null, oskLiveT = null;
  function useBoard() { return !(("ontouchstart" in window) && !window.tizen); }
  function oskField() { return osk && ($(osk.id) || null); }
  function oskLabel(el) {
    var lab = el.id && overlay.querySelector('label[for="' + el.id + '"]');
    return (el.id === "q" ? "SEARCH" : lab ? lab.textContent : (el.getAttribute("data-ph") || el.placeholder || "TYPE")).toUpperCase();
  }
  function openBoard(el) {
    if (!el.id) return editField(el);
    var ae = document.activeElement; if (ae && ae.blur) ae.blur();
    osk = { id: el.id, layer: "abc", caps: false, r: el.id === "q" && (prefs.recentSearches || []).length ? 1 : 0, c: 0,
            autocap: /storeName|memberName|wxPlace/.test(el.id), mask: el.type === "password",
            submit: el.getAttribute("data-submit") };
    drawBoard();
    document.body.classList.add("osk-open");
    sfx("press");
  }
  function closeBoard(silent) {
    if (!osk) return;
    clearTimeout(oskLiveT);
    osk = null; $("osk").hidden = true; $("osk").innerHTML = "";
    document.body.classList.remove("osk-open");
    if (!silent) sfx("close");
    if (modal) modalFocus(true);
  }
  function upperNow() {
    var el = oskField(), v = el ? el.value : "";
    return osk.caps || (osk.autocap && (!v || / $/.test(v)));
  }
  function drawBoard() {
    var el = oskField(); if (!el) return closeBoard(true);
    var up = upperNow(), rows = [], recent = el.id === "q" ? (prefs.recentSearches || []) : [];
    var html = '<div class="osk-in"><div class="osk-head"><span class="osk-sign">LETTER BOARD</span><div class="osk-vfd"><span class="osk-lbl">' + esc(oskLabel(el)) +
      '</span><b id="oskText"></b><i class="osk-caret">_</i></div></div>';
    if (recent.length) {
      html += '<div class="osk-recent"><span>RECENT</span>' + recent.map(function (t, i) { return '<button class="ok-key act chip" data-ok="recent" data-i="' + i + '">' + esc(t) + "</button>"; }).join("") + "</div>";
    }
    html += '<div class="osk-board">' + OSK_LAYERS[osk.layer].map(function (row) {
      return '<div class="osk-row">' + row.split("").map(function (ch) {
        var shown = /[a-z]/.test(ch) && up ? ch.toUpperCase() : ch;
        return '<button class="ok-key" data-ok="ch" data-ch="' + esc(ch) + '">' + esc(shown) + "</button>";
      }).join("") + "</div>";
    }).join("") +
      '<div class="osk-row">' +
        '<button class="ok-key act' + (osk.caps ? " on" : "") + '" data-ok="shift" style="flex-grow:1.4">⇧ Caps</button>' +
        '<button class="ok-key act" data-ok="layer" style="flex-grow:1.4">' + (osk.layer === "abc" ? "#+=" : "ABC") + "</button>" +
        '<button class="ok-key act" data-ok="space" style="flex-grow:3">Space</button>' +
        '<button class="ok-key act" data-ok="back" style="flex-grow:1.3">⌫</button>' +
        '<button class="ok-key act" data-ok="clear" style="flex-grow:1.3">Clear</button>' +
        '<button class="ok-key act" data-ok="native" style="flex-grow:1.6">TV keys</button>' +
        '<button class="ok-key act go" data-ok="done" style="flex-grow:2">' + (el.id === "q" ? "Search" : osk.submit ? "Save" : "Done") + "</button>" +
      "</div></div>" +
      '<div class="osk-hint"><span><i style="background:var(--red)"></i>delete</span><span><i style="background:#3fa45b"></i>space</span><span><i style="background:#4c8ff0"></i>done</span><span>BACK closes the board</span></div></div>';
    var box = $("osk"); box.innerHTML = html; box.hidden = false;
    // a grid of rows for the remote to move around
    osk.grid = [];
    if (recent.length) osk.grid.push(Array.prototype.slice.call(box.querySelectorAll(".osk-recent .ok-key")));
    Array.prototype.forEach.call(box.querySelectorAll(".osk-board .osk-row"), function (r) { osk.grid.push(Array.prototype.slice.call(r.querySelectorAll(".ok-key"))); });
    osk.r = Math.min(osk.r, osk.grid.length - 1); osk.c = Math.min(osk.c, osk.grid[osk.r].length - 1);
    showBoardText(); boardFocus();
  }
  function showBoardText() {
    var el = oskField(), t = $("oskText"); if (!el || !t) return;
    t.textContent = osk.mask ? el.value.replace(/./g, "•") : el.value;
  }
  function boardFocus() {
    Array.prototype.forEach.call($("osk").querySelectorAll(".ok-key.focused"), function (k) { k.classList.remove("focused"); });
    var k = osk.grid[osk.r] && osk.grid[osk.r][osk.c]; if (k) k.classList.add("focused");
  }
  function boardMove(dr, dc) {
    if (dc) { osk.c = Math.max(0, Math.min(osk.grid[osk.r].length - 1, osk.c + dc)); }
    else {
      var nr = osk.r + dr; if (nr < 0 || nr >= osk.grid.length) return;
      var cur = osk.grid[osk.r][osk.c].getBoundingClientRect(), cx = cur.left + cur.width / 2, best = 0, bd = Infinity;
      osk.grid[nr].forEach(function (k, i) { var b = k.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - cx); if (d < bd) { bd = d; best = i; } });
      osk.r = nr; osk.c = best;
    }
    boardFocus(); sfx("tick");
  }
  function boardType(ch) {
    var el = oskField(); if (!el) return;
    var max = parseInt(el.getAttribute("maxlength"), 10) || 200;
    if (el.value.length >= max) return;
    if (/[a-z]/.test(ch) && upperNow()) ch = ch.toUpperCase();
    el.value += ch; boardChanged();
    sfx("tap");
  }
  function boardChanged() {
    var el = oskField(); if (!el) return;
    showBoardText();
    // letters on the keys follow the case the next letter will be
    var up = upperNow();
    Array.prototype.forEach.call($("osk").querySelectorAll('.ok-key[data-ok="ch"]'), function (k) {
      var ch = k.getAttribute("data-ch"); if (/[a-z]/.test(ch)) k.textContent = up ? ch.toUpperCase() : ch;
    });
    // search shows results as you go
    if (el.id === "q") {
      clearTimeout(oskLiveT);
      if (el.value.trim().length >= 2) oskLiveT = setTimeout(function () { if (osk && $("q")) doSearch(true); }, 700);
    }
  }
  function boardDone() {
    var el = oskField(), sub = osk && osk.submit;
    closeBoard(true);
    if (!el || !modal) return;
    if (sub) { var btn = overlay.querySelector('button[data-m="' + sub + '"]'); if (btn) { modal.idx = modal.els.indexOf(btn); modalFocus(true); activateModal(btn); return; } }
    var i = modal.els.indexOf(el); if (i >= 0 && i < modal.els.length - 1) { modal.idx = i + 1; modalFocus(); }
  }
  function boardPress(k) {
    var what = k.getAttribute("data-ok"), el = oskField(); if (!el) return closeBoard(true);
    if (what === "ch") boardType(k.getAttribute("data-ch"));
    else if (what === "space") boardType(" ");
    else if (what === "back") { el.value = el.value.slice(0, -1); boardChanged(); sfx("tap"); }
    else if (what === "clear") { el.value = ""; boardChanged(); sfx("tap"); }
    else if (what === "shift") { osk.caps = !osk.caps; k.classList.toggle("on", osk.caps); boardChanged(); sfx("tap"); }
    else if (what === "layer") { osk.layer = osk.layer === "abc" ? "sym" : "abc"; drawBoard(); sfx("tap"); }
    else if (what === "native") { closeBoard(true); editField(el); }
    else if (what === "recent") { el.value = (prefs.recentSearches || [])[parseInt(k.getAttribute("data-i"), 10)] || ""; showBoardText(); boardDone(); }
    else if (what === "done") boardDone();
  }
  // returns true when the board used the key
  function boardKey(e) {
    var k = e.keyCode;
    if (k === KEY.LEFT) boardMove(0, -1);
    else if (k === KEY.RIGHT) boardMove(0, 1);
    else if (k === KEY.UP) boardMove(-1, 0);
    else if (k === KEY.DOWN) boardMove(1, 0);
    else if (k === KEY.OK) { var key = osk.grid[osk.r][osk.c]; if (key) boardPress(key); }
    else if (k === KEY.BACK || k === KEY.ESC) closeBoard();
    else if (k === KEY.RED || k === KEY.BKSP) boardPress($("osk").querySelector('[data-ok="back"]'));
    else if (k === KEY.GREEN) boardType(" ");
    else if (k === KEY.BLUE) boardDone();
    else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // a real keyboard, or the number keys on the remote
      var el = oskField(); if (!el) return true;
      var max = parseInt(el.getAttribute("maxlength"), 10) || 200;
      if (el.value.length < max) { el.value += e.key; boardChanged(); }
    }
    else return false;
    return true;
  }
  $("osk").addEventListener("click", function (e) {
    var k = e.target.closest(".ok-key"); if (!k || !osk) return;
    osk.grid.some(function (row, r) { var c = row.indexOf(k); if (c >= 0) { osk.r = r; osk.c = c; return true; } return false; });
    boardFocus(); boardPress(k);
  });
  function editField(el) {
    var ph = el.getAttribute("data-ph"); if (ph !== null) el.placeholder = ph;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    try { var n = el.value.length; el.setSelectionRange(n, n); } catch (e) {}
  }
  function activateModal(el) {
    var act = el.getAttribute("data-m"), id = el.getAttribute("data-id"), it = id && byId[id];
    if (act.indexOf("rw-") === 0) { rewindAct(act, el); return; }
    if (act === "input") { if (useBoard()) openBoard(el); else editField(el); return; }
    if (act === "close") { if (modal && modal.onBack === putBack) putBack(); else { sfx("close"); closeModal(); } }
    else if (act === "flip") flipBox();
    else if (act === "trailer" && it && modal.trailers) playTrailer(it, modal.trailers);
    else if (act === "hold" && it) {
      if (isHeld(it.id)) unholdIt(it); else holdIt(it);
      el.textContent = isHeld(it.id) ? "Take it off hold" : "Put it on hold";
      var slip = $("box3d") && $("box3d").querySelector(".face.front");
      if (slip) { var old = slip.querySelector(".hold-slip"); if (old) old.parentNode.removeChild(old); if (isHeld(it.id)) slip.insertAdjacentHTML("beforeend", holdSlip()); }
    }
    else if (act === "open" && it) {
      var fromBack = el.classList.contains("bk") && modal && modal.view === "backroom";
      if (fromBack) pickFrom = { rect: rectOf(el), back: { who: modal.who, list: modal.bkList, focus: modal.idx } };
      caseView(it, false, fromBack ? "backroom" : "");
    }
    else if (act === "rent" && it) {
      if (it.type === "series" && !el.getAttribute("data-vid") && !it.videoId) episodesView(it);
      else checkoutView(it, it.type === "series" ? (el.getAttribute("data-vid") || it.videoId) : it.id);
    }
    else if (act === "episodes" && it) episodesView(it);
    else if (act === "season" && it) episodesView(it, parseInt(el.getAttribute("data-s"), 10));
    else if (act === "ep" && it) checkoutView(it, el.getAttribute("data-vid"));
    else if (act === "askagain" && co) { delete copyCache[copyKey(co.it.type === "series" ? "series" : "movie", co.vid)]; checkoutView(co.it, co.vid); }
    else if (act === "playbest") playFromCheckout(0);
    else if (act === "copies") copiesView();
    else if (act === "copy") playFromCheckout(parseInt(el.getAttribute("data-i"), 10));
    else if (act === "resume") beginPlayback(parseInt(el.getAttribute("data-t"), 10));
    else if (act === "fromstart") beginPlayback(0);
    else if (act === "psettings") playerSettings(0);
    else if (act === "toggle-remux") { prefs.remux = prefs.remux === "avoid" ? "allow" : "avoid"; save("fnv-prefs", prefs); playerSettings(modal.idx); }
    else if (act === "pick-mode") { var modes = ["4k-sdr", "best", "1080"]; prefs.pick = modes[(modes.indexOf(prefs.pick) + 1) % 3]; save("fnv-prefs", prefs); playerSettings(modal.idx); }
    else if (act === "toggle-vhs") { prefs.vhs = !prefs.vhs; save("fnv-prefs", prefs); playerSettings(modal.idx); }
    else if (act === "toggle-previews") { prefs.previews = !prefs.previews; save("fnv-prefs", prefs); playerSettings(modal.idx); }
    else if (act === "audio-lang") { var al = ["en", "es", "fr", "de", "it", "pt", "ja", "ko", "hi", "ru", "zh", "nl"]; prefs.audioLang = al[(al.indexOf(prefs.audioLang || "en") + 1) % al.length]; save("fnv-prefs", prefs); playerSettings(modal.idx); }
    else if (act === "toggle-autonext") { var nm = ["auto", "ask", "off"]; prefs.nextEp = nm[(nm.indexOf(nextEpMode()) + 1) % 3]; save("fnv-prefs", prefs); playerSettings(modal.idx); }
    else if (act === "saveserver") {
      var raw = ($("serverUrl").value || "").trim(), srv = "";
      if (raw) {
        if (!/^https?:\/\//i.test(raw)) raw = "http://" + raw;
        var u = null; try { u = new URL(raw); } catch (e) {}
        if (!u || !/^https?:$/.test(u.protocol) || !u.hostname || u.username || u.password || (u.pathname && u.pathname !== "/") || u.search || u.hash) {
          toast("That doesn't look like a server address. Try something like http://192.168.1.20:11470", 5000); return;
        }
        srv = u.protocol + "//" + u.host;
        if (u.protocol === "http:" && !lanHost(u.hostname)) toast("Saved, but that server is outside your home network and the connection isn't encrypted.", 6000);
      }
      prefs.server = srv; save("fnv-prefs", prefs); if (!srv || lanHost(new URL(srv).hostname) || srv.indexOf("https:") === 0) toast(srv ? "Streaming server saved" : "Streaming server cleared"); clearCopyCache(); playerSettings(0);
    }
    else if (act === "reroll") { clerkReroll = true; clerk(); clerkReroll = false; }
    else if ((act === "uncw" || act === "recw") && it) {
      if (act === "uncw") dropFromCW(it); else undoDropCW(it);
      var keepF = lastStoreFocus; if (keepF) focus = { r: keepF.r, c: keepF.c };
      redrawShelves(); clampFocus(); lastStoreFocus = keepF ? { r: focus.r, c: focus.c } : keepF;
      sfx("tap"); caseView(it, true, modal && modal.from);
      var again = overlay.querySelector(act === "uncw" ? '[data-m="recw"]' : '[data-m="uncw"]');
      modal.idx = Math.max(0, modal.els.indexOf(again)); modalFocus(true);
    }
    else if (act === "watched" && it) {
      // goes by what the box shows: watched here, or watched according to your Stremio account
      var nowOn = !isWatched(id), wi = watched.indexOf(id);
      if (nowOn) { if (wi === -1) watched.push(id); }
      else { if (wi !== -1) watched.splice(wi, 1); it.seen = false; }
      syncWatched();
      save("fnv-watched", watched);
      markWatchedInStremio(it, nowOn);
      var keep = lastStoreFocus; if (keep) focus = { r: keep.r, c: keep.c };
      redrawShelves(); updateCounter(); lastStoreFocus = keep ? { r: focus.r, c: focus.c } : keep;
      sfx("tap"); caseView(it, true, modal && modal.from); modal.idx = Math.max(0, modal.els.indexOf(overlay.querySelector('[data-m="watched"]'))); modalFocus(true);
    } else if (act === "play" && it) launchStremio(it);
    else if (act === "email") emailSignIn();
    else if (act === "login") doEmailLogin();
    else if (act === "relink") linkSignIn();
    else if (act === "refresh") { closeModal(); refreshAccount(true); }
    else if (act === "signout") signOut();
    else if (act === "double") doubleFeature();
    else if (act === "unwrap" && it) {
      var w = $("blindBox"); if (w) w.innerHTML = coverHTML(it);
      sfx("tear");
      var det = overlay.querySelector(".details");
      if (det) det.innerHTML = '<p class="flip-hint">You got:</p><h3>' + esc(it.name) + '</h3><div class="facts">' +
        [it.year, (it.genres || [])[0], rating(it)].filter(Boolean).map(function (f) { return '<span class="chip">' + esc(f) + "</span>"; }).join("") + "</div>" +
        '<div class="actions col"><button class="btn primary" data-m="open" data-id="' + esc(it.id) + '">Take a look</button>' +
        '<button class="btn" data-m="rent" data-id="' + esc(it.id) + '">Rent it</button><button class="btn" data-m="close">Put it back</button></div>';
      refreshModalEls(); modal.idx = 0; modalFocus(true);
    }
    else if (act === "dosearch") doSearch();
    else if (act === "desk") frontDesk(0);
    else if (act === "office") backOffice(0);
    else if (act === "savenames") saveNames();
    else if (act === "toggle-sound") {
      audioReady();
      // Off → On → Quiet → Off
      if (!prefs.sound) { prefs.quiet = false; setSound(true); } else if (!prefs.quiet) { prefs.quiet = true; save("fnv-prefs", prefs); } else { prefs.quiet = false; setSound(false); }
      setVolume(); sfx("tap"); frontDesk(modal.idx);
    }
    else if (act === "toggle-calm") {
      var am = ["full", "calm", "light"]; prefs.atmos = am[(am.indexOf(prefs.atmos) + 1) % 3]; save("fnv-prefs", prefs); applyAtmos();
      if (isCalm()) { stopLandLoops(); var bol = $("wxBolt"); if (bol) bol.classList.remove("go"); }
      if (isLight()) { $("tvFrame").innerHTML = ""; clearTimeout(trailerTimer); tvCurrent = null; }
      frontDesk(modal.idx);
    }
    else if (act === "toggle-crt") { prefs.trailers = !prefs.trailers; save("fnv-prefs", prefs); if (!prefs.trailers) $("tvFrame").innerHTML = ""; backOffice(modal.idx); }
    else if (act === "account") accountPanel();
    else if (act === "checks") runChecks();
    else if (act === "staffinfo") staffInfo();
    else if (act === "backroom") backroomVisit();
    else if (act === "clerk") clerk();
    else if (act === "lists") listsPanel(0);
    else if (act === "listrole") cycleRole(parseInt(el.getAttribute("data-i"), 10));
    else if (act === "refresh-lists") { toast("Checking your add-ons for new lists…"); refreshAccount(false); }
    else if (act === "outside") outsidePanel(0);
    else if (act === "diag") diagnosticsPanel();
    else if (act === "wxsave") saveWxPlace();
    else if (act === "wx-mode") { prefs.wxMode = WX_MODES[(WX_MODES.indexOf(prefs.wxMode || "live") + 1) % WX_MODES.length]; save("fnv-prefs", prefs); if (prefs.wxMode === "live") refreshWeather(); outsidePanel(modal.idx); }
    else if (act === "deco-mode") { var dm = ["auto", "halloween", "xmas", "none"]; prefs.deco = dm[(dm.indexOf(prefs.deco || "auto") + 1) % dm.length]; save("fnv-prefs", prefs); outsidePanel(modal.idx); }
    else if (act === "door-mode") { var om2 = ["sunset", "clock", "skip"]; prefs.outside = om2[(om2.indexOf(prefs.outside || "sunset") + 1) % 3]; save("fnv-prefs", prefs); outsidePanel(modal.idx); }
    else if (act === "golook") { closeModal(); showLanding(true); }
    else if (act === "resetask") resetAsk();
    else if (act === "resetyes") resetTV();
    else if (act === "toggle-outside") { var om = ["sunset", "clock", "skip"]; prefs.outside = om[(om.indexOf(prefs.outside || "sunset") + 1) % 3]; save("fnv-prefs", prefs); frontDesk(modal.idx); }
  }
  function launchStremio(it) {
    var link = deepLink(it);
    try {
      if (window.tizen && tizen.application) {
        var ctrl = new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/view", link);
        // on the TV, never send this page off to a stremio:// link: if no app takes it, say so and stay put
        tizen.application.launchAppControl(ctrl, null, function () {}, function () { toast("Couldn't find the Stremio app on this TV.", 3500); });
        return;
      }
    } catch (e) { if (window.tizen) { toast("Couldn't find the Stremio app on this TV.", 3500); return; } }
    try { location.href = link; } catch (e) {}
  }

  function activateStore(el) {
    if (el.classList.contains("tape")) pickSrc = el;
    if (el.classList.contains("tape")) { var t = byId[el.getAttribute("data-id")]; if (!t) return; if (el.getAttribute("data-blind")) blindView(t); else caseView(t); return; }
    if (el.classList.contains("sign")) { if (focus.r + 1 < rows.length) move(1, 0); return; }
    var a = el.getAttribute("data-action");
    if (a && a !== "clerk") sfx("press");
    if (a === "clerk") clerk();
    else if (a === "returns") returns();
    else if (a === "account") accountPanel();
    else if (a === "search") searchPanel();
    else if (a === "desk") frontDesk(0);
    else if (a === "sound") { audioReady(); setSound(!prefs.sound); }
    else if (a === "trailers") { prefs.trailers = !prefs.trailers; save("fnv-prefs", prefs); updateCounter(); if (!prefs.trailers) $("tvFrame").innerHTML = ""; }
    else if (a === "rewind") rewindPanel();
  }

  // ---------- Rewind Night: choosing the year ----------
  // A VCR counter you wind with the arrows: left and right a year, up and down a decade, OK to go. Green takes you
  // straight back to tonight. Whichever year the dial rests on has its new releases fetched there and then.
  var rewindLast = store("fnv-rewind-last", 0, function (n) { return numIn(n, REWIND_MIN, 2100) ? n : 0; });
  var rwPick = 0, rwDwell = null;
  function rewindMax() { return new Date().getFullYear() - 2; }
  function rewindPanel() {
    var Y = new Date().getFullYear(), tv = isTV(), decs = "";
    rwPick = Math.max(REWIND_MIN, Math.min(rewindMax(), rewindY || rewindLast || Y - 30));
    for (var d = Math.floor(REWIND_MIN / 10) * 10; d <= rewindMax(); d += 10)
      decs += '<button class="rw-dec" data-m="rw-dec" data-d="' + d + '" data-y="' + Math.max(REWIND_MIN, Math.min(rewindMax(), d + 5)) + '">' + String(d).slice(2) + "s</button>";
    sfx("shuffle");
    openModal('<div class="panel rw-panel"><div class="rw-vcr"><div class="rw-top"><span>◀◀ REWIND NIGHT</span><span>' + (rewindY ? "NOW IN " + rewindY : "SET THE YEAR") + "</span></div>" +
      '<div class="rw-dial"><button class="rw-arrow" data-m="rw-prev" aria-label="A year earlier">◀</button><div class="rw-year" id="rwYear"></div><button class="rw-arrow" data-m="rw-next" aria-label="A year later">▶</button></div>' +
      '<div class="rw-decs" id="rwDecs">' + decs + '</div><div class="rw-tease" id="rwTease"></div></div>' +
      "<p>Set the store back to any year. Every aisle turns into what was on the shelves then.</p>" +
      '<div class="actions"><button class="btn primary" data-m="rw-go" id="rwGo"></button>' +
      (tv ? "" : (rewindY ? '<button class="btn" data-m="rw-off">Back to ' + Y + "</button>" : "") + '<button class="btn" data-m="close">Never mind</button>') + "</div>" +
      '<p class="rw-keys"><kbd>◀ ▶</kbd>a year<kbd>▲ ▼</kbd>ten years<kbd>OK</kbd>rewind' + (rewindY ? '<kbd class="g">GREEN</kbd>back to ' + Y : "") + "<kbd>BACK</kbd>never mind</p></div>");
    modal.view = "rewind";
    modal.keys = function (k) {
      if (k === KEY.LEFT) rwStep(-1); else if (k === KEY.RIGHT) rwStep(1); else if (k === KEY.UP) rwStep(10); else if (k === KEY.DOWN) rwStep(-10);
      else if (k === KEY.GREEN && rewindY) setRewind(0);
      else return false;
      return true;
    };
    rwShow(true);
  }
  function rwStep(n) {
    var y = Math.max(REWIND_MIN, Math.min(rewindMax(), rwPick + n));
    if (y === rwPick) return;
    rwPick = y; sfx("tick"); rwShow();
  }
  function rwShow(now) {
    var y = rwPick; if (!$("rwYear")) return;
    $("rwYear").textContent = String(y);
    $("rwGo").textContent = y === rewindY ? "Stay in " + y : "Rewind to " + y;
    Array.prototype.forEach.call($("rwDecs").children, function (b) { b.classList.toggle("on", +b.getAttribute("data-d") === Math.floor(y / 10) * 10); });
    modal.idx = Math.max(0, modal.els.indexOf($("rwGo"))); modalFocus(true);
    rwTease(y);
    clearTimeout(rwDwell);
    // rest on a year for a moment and its tapes are on their way before you press OK
    if (live && !onSample) rwDwell = setTimeout(function () {
      var v = modal && modal.seq;
      rewindStock(y).then(function () { if (sameView(v) && rwPick === y) rwTease(y, true); });
    }, now ? 0 : 280);
  }
  function rwTease(y, asked) {
    var el = $("rwTease"), pg = eraPager[y]; if (!el) return;
    el.textContent = !live || onSample ? "SAMPLE SHELVES · ONLY TAPES OUT BY " + y :
      pg && pg.tease.length ? "JUST IN · " + pg.tease.join(" · ").toUpperCase() : asked ? "THE DELIVERY'S RUNNING LATE · OK TO TRY ANYWAY" : "CHECKING THE STOCKROOM…";
  }
  function rewindAct(act, el) {
    if (act === "rw-prev") rwStep(-1);
    else if (act === "rw-next") rwStep(1);
    else if (act === "rw-dec") { var y = +el.getAttribute("data-y"); if (y && y !== rwPick) { rwPick = y; sfx("tick"); } rwShow(); }
    else if (act === "rw-off") setRewind(0);
    else if (act === "rw-go") setRewind(rwPick);
  }
  // The rewind itself: a blue VCR screen winds the year counter back (or forward to tonight) while the tapes arrive,
  // then you're standing at that year's New Releases wall.
  function setRewind(y) {
    var Y = new Date().getFullYear(), from = rewindY || Y, to = y || Y;
    clearTimeout(rwDwell);
    if (modal) closeModal();
    if (y === rewindY || rewinding) return;
    if (y) { rewindLast = y; save("fnv-rewind-last", y); }
    var back = to < from, dur = Math.max(650, Math.min(1400, 450 + Math.abs(from - to) * 22)), veil = $("rwVeil");
    veil.className = "rw-veil" + (back ? "" : " ff");
    veil.innerHTML = '<div class="rw-track"></div><div class="rw-osd"><span>' + (back ? "◀◀ REW" : "FF ▶▶") + "</span><span>" + (y ? "REWIND NIGHT" : "BACK TO TONIGHT") + '</span></div><div class="rw-count" id="rwCount">' + from + "</div>";
    veil.hidden = false; rewinding = true;
    whirr(dur / 1000);
    var t0 = Date.now(), done = false;
    var tick = setInterval(function () { var k = Math.min(1, (Date.now() - t0) / dur), c = $("rwCount"); if (c) c.textContent = String(Math.round(from + (to - from) * k)); }, 50);
    function finish() {
      if (done) return; done = true; clearInterval(tick);
      rewindY = y;
      if (y || !aisleList(aisle).length) aisle = "new";
      renderSigns(); renderShelves(); rebuildRows(); updateCounter(); updateOSD(); setBanner();
      var sr = rowKinds.indexOf("shelf");
      focus = { r: sr !== -1 ? sr : 0, c: 0 };
      clampFocus(); tvCurrent = null; applyFocus(true);
      veil.hidden = true; veil.innerHTML = ""; rewinding = false;
      sfx("clunk");
    }
    var ready = y ? rewindStock(y) : Promise.resolve();
    if (y) rewindRest(y);
    ready.then(function () { setTimeout(finish, Math.max(0, dur - (Date.now() - t0))); });
    setTimeout(finish, 4500);   // a slow delivery doesn't hold you at the blue screen: the tapes fill in when they land
  }

