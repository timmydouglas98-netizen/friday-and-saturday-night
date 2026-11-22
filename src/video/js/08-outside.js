  // =====================================================================
  // ---------- outside the store: a late-90s TV-cartoon strip mall ----------
  // Shot like a cel set-up. The background is painted once into canvases (sky, a cloud level that
  // drifts, and the main BG painting), the way a background artist works on board. Everything that
  // moves or lights up is an inked cel laid over it, timed on twos and threes. A film-transfer pass
  // (grain, gate weave, the odd fleck of dust) sits on top.
  // =====================================================================
  var landingOn = false, entering = false, passerT = null, amb = null;
  // how bright the artificial lights are, how many stars, how strong the neon
  var OUT_MODES = {
    sunset: { lights: .8, stars: .55, neon: 1 },
    night:  { lights: 1, stars: 1, neon: 1 },
    golden: { lights: 0, stars: 0, neon: .85 },
    day:    { lights: 0, stars: 0, neon: .55 }
  };
  function outsideMode() {
    if (prefs.outside !== "clock") return "sunset";
    var now = new Date(), m = now.getHours() * 60 + now.getMinutes();
    // the real sunrise and sunset where you are (from the weather service), good for a week
    var sun = typeof wxNow !== "undefined" && wxNow && wxNow.rise != null && wxNow.set != null && Date.now() - wxNow.t < 7 * 864e5 ? wxNow : null;
    if (sun) {
      if (m < sun.rise - 30 || m >= sun.set + 45) return "night";
      if (m < sun.rise + 60) return "golden";
      if (m < sun.set - 90) return "day";
      if (m < sun.set - 15) return "golden";
      return "sunset";
    }
    var h = m / 60;
    return h >= 6 && h < 16 ? "day" : h >= 16 && h < 18 ? "golden" : h >= 18 && h < 21 ? "sunset" : "night";
  }
  function isWindy() {
    var wx = wxKind();
    if (wx === "storm") return true;
    return (prefs.wxMode || "live") === "live" && !!(wxNow && wxNow.wind >= 25 && Date.now() - wxNow.t < 3 * 3600 * 1000);
  }
  function storeClosed() { var h = new Date().getHours(); return h < 6; }

  // ---- the colour script: one light setting per time of day, then weather on top ----
  /* @@SHARED_ART_KIT@@ */
  // sun: what faces the light gets multiplied by; amb: the shadow side; top: surfaces facing the sky
  // ---- the sky: airbrushed gradient, the sun or a city glow, painted at half size ----
  // ---- the background painting ----
  var HZ = 600, VPX = 700;
  // where a line running straight back from the camera lands at another depth (perspective, eased for a painted look)
  function persp(x, y0, y1) { var k = (y1 - HZ) / (y0 - HZ); return VPX + (x - VPX) * (1 + (k - 1) * .3); }
  var SPINES = ["#c4313d", "#1e3d93", "#f2efe6", "#1b1b22", "#e2b33c", "#2f7a52", "#6b3f8c", "#d96b2b", "#3b8bc4", "#e7e2d2", "#8f2a52", "#0f2c5c"];
  // interiors light themselves at night and sit in gloom behind the glass by day
  // a leafy canopy: a dark mass, then clumps each with a hard-edged light side (cel shading)
  function canopy(P, cx, cy, rx, ry, seed, base, dist, n) {
    var r = rand(seed), o = "", cl = [], lx = P.lx, ly = P.ly;
    var deep = Hz(P, cmul(Sc(P, base), "#c8c8d6"), dist), shd = Hz(P, Sc(P, base), dist), mid = Hz(P, cmix(Sc(P, base), Lc(P, base), .5), dist), lit = Hz(P, Lc(P, base), dist);
    if (P.night) { mid = Hz(P, cmix(Sc(P, base), Lc(P, base), .35), dist); }
    o += Pt(blobD(cx, cy, rx, ry, r, 15, .22), deep);
    n = n || 9;
    for (var i = 0; i < n; i++) {
      var a = r() * 6.2832, d = Math.sqrt(r()) * .62;
      cl.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d * .9 - ry * .08, (rx + ry) * .5 * (.3 + r() * .14)]);
    }
    cl.sort(function (a, b) { return a[1] - b[1]; });
    cl.forEach(function (c) {
      o += Pt(blobD(c[0], c[1], c[2], c[2] * .86, r, 9, .3), shd);
      o += Pt(blobD(c[0] + lx * c[2] * .2, c[1] + ly * c[2] * .2, c[2] * .74, c[2] * .62, r, 8, .3), mid);
      if (r() < .75) o += Pt(blobD(c[0] + lx * c[2] * .38, c[1] + ly * c[2] * .38, c[2] * .36, c[2] * .28, r, 6, .35), lit);
      if (P.snow && c[1] < cy) o += Pt(blobD(c[0] + lx * c[2] * .2, c[1] - c[2] * .52, c[2] * .55, c[2] * .2, r, 7, .3), Tc(P, OB.snow), op(".9"));
    });
    return o;
  }
  function trunk(P, x, top, bot, w, dist) {
    var c = Hz(P, Sc(P, "#5b4636"), dist);
    return Pg([x - w * .5, bot, x - w * .32, top, x + w * .32, top, x + w * .5, bot], c) + Pg([x - w * .5, bot, x - w * .32, top, x - w * .05, top, x - w * .12, bot], Hz(P, Lc(P, "#6b5442"), dist), op(".7"));
  }

  function farBand(P) {
    var r = rand(7), o = "", x, d;
    var far = Hz(P, Sc(P, "#4f6a48"), .7), far2 = Hz(P, Sc(P, "#486642"), .52), farL = Hz(P, Lc(P, "#58744b"), .55);
    d = "M-10,615 L-10,556"; x = -10;
    while (x < 1930) { var w = 40 + r() * 70, hh = 14 + r() * 30; d += " Q" + n1(x + w * .5) + "," + n1(556 - hh) + " " + n1(x + w) + "," + n1(556 + (r() - .5) * 10); x += w; }
    o += Pt(d + " L1930,615 Z", far);
    // a couple of far roofs and a line of poles running off toward town
    [[470, 572, 70], [610, 578, 56], [1180, 566, 80]].forEach(function (h) {
      o += Pg([h[0], h[1], h[0] + h[2] * .5, h[1] - h[2] * .28, h[0] + h[2], h[1], h[0] + h[2], h[1] + 20, h[0], h[1] + 20], Hz(P, Sc(P, OB.roof), .6));
    });
    for (var i = 0; i < 5; i++) { var px = 420 + i * 60, ph = 64 - i * 9; o += R(px, 590 - ph, 2.4, ph, Hz(P, Sc(P, OB.wood), .6)) + R(px - 7, 590 - ph + 3, 16, 1.6, Hz(P, Sc(P, OB.wood), .6)); }
    d = "M-10,620 L-10,586"; x = -10;
    while (x < 1930) { var w2 = 60 + r() * 90, h2 = 10 + r() * 26; d += " Q" + n1(x + w2 * .5) + "," + n1(586 - h2) + " " + n1(x + w2) + "," + n1(586 + (r() - .5) * 8); x += w2; }
    o += Pt(d + " L1930,620 Z", far2);
    // light catching the tops of the nearer far trees
    if (!P.heavy && !P.night) { x = 30; while (x < 1900) { o += Pt(blobD(x, 568 + r() * 10, 22 + r() * 16, 8, r, 6, .3), farL, op(".55")); x += 90 + r() * 140; } }
    // the water tower over the rooftops
    o += waterTower(P, 1752, 262);
    return o;
  }

  function backyards(P) {
    var o = "", r = rand(29), wall;
    // trees behind the houses
    o += trunk(P, 300, 480, 600, 26, .18) + canopy(P, 300, 452, 150, 118, 41, OB.oak, .2, 12);
    o += trunk(P, 880, 470, 600, 24, .2) + canopy(P, 880, 430, 120, 112, 43, OB.leaf, .22, 10);
    o += canopy(P, -10, 500, 90, 96, 47, OB.oak, .24, 7);
    o += canopy(P, 610, 488, 76, 70, 53, OB.leaf, .26, 6);
    // a two-storey house on the left (its upstairs windows light up at night)
    wall = Hz(P, Lc(P, OB.siding), .18);
    o += R(40, 462, 210, 140, wall) + R(196, 462, 54, 140, Hz(P, Sc(P, OB.siding), .18));
    for (var y = 470; y < 600; y += 9) o += R(40, y, 210, 1.4, Hz(P, Sc(P, OB.siding), .2), op(".5"));
    o += roof(P, [26, 466, 70, 420, 220, 420, 264, 466], .18, 3);
    o += R(206, 396, 18, 30, Hz(P, Sc(P, OB.hbrick), .18)) + R(204, 393, 22, 5, Hz(P, Sc(P, OB.hbrick), .25));
    o += houseWin(P, 106, 488, 36, 40) + houseWin(P, 182, 488, 36, 40);
    // TV aerial on the ridge
    var ae = Hz(P, Sc(P, "#3a3a44"), .2);
    o += Ln(110, 420, 110, 368, ae, 2) + Ln(92, 380, 128, 380, ae, 1.6) + Ln(96, 390, 124, 390, ae, 1.6) + Ln(100, 372, 120, 372, ae, 1.4) + Ln(110, 368, 132, 352, ae, 1.2);
    o += snowCap(P, 30, 420, 230, 9);
    // a low ranch house with a satellite dish
    wall = Hz(P, Lc(P, OB.hbrick), .2);
    o += R(330, 548, 240, 54, wall);
    o += roof(P, [316, 552, 360, 516, 540, 516, 584, 552], .2, 5);
    o += Pt("M528,516 a13,13 0 0 1 22,-14 l-6,14z", Hz(P, Lc(P, "#d8d8dc"), .2)) + Ln(540, 509, 548, 498, Hz(P, Sc(P, "#55555e"), .2), 1.6);
    o += snowCap(P, 336, 516, 228, 8);
    // basketball hoop on the garage
    o += R(608, 524, 4, 64, Hz(P, Sc(P, OB.steel), .22)) + R(588, 516, 44, 28, Hz(P, Lc(P, "#f4f2ec"), .2)) + R(602, 526, 16, 10, "none", ' stroke="' + Hz(P, Sc(P, "#c2402e"), .2) + '" stroke-width="1.6"') + El(610, 545, 10, 2.6, "none", ' stroke="' + Hz(P, Lc(P, "#e0662e"), .2) + '" stroke-width="2"');
    // a two-storey house behind the sign
    wall = Hz(P, Lc(P, "#cfd6cf"), .2);
    o += R(668, 458, 210, 144, wall) + R(668, 458, 30, 144, Hz(P, Sc(P, "#cfd6cf"), .2));
    o += roof(P, [654, 462, 694, 424, 852, 424, 892, 462], .2, 7);
    o += houseWin(P, 684, 478, 34, 38) + houseWin(P, 794, 478, 34, 38);
    o += snowCap(P, 660, 424, 228, 8);
    // the privacy fence along the back of the lot
    o += fence(P, -10, 872, 584, 642);
    // grass and weeds at its foot
    o += R(-10, 636, 890, 14, wetC(P, Mc(P, OB.grass)));
    for (var i = 0; i < 120; i++) { var gx = r() * 880, gy = 640 + r() * 9; o += Ln(gx, gy, gx + (r() - .5) * 5, gy - 6 - r() * 8, Sc(P, OB.grass), 1.6); }
    return o;
  }
  function roof(P, pts, dist, seed) {
    var id = "rf" + (clipN++), r = rand(seed), base = Hz(P, Mc(P, OB.roof), dist), dark = Hz(P, Sc(P, OB.roof), dist), lite = Hz(P, Tc(P, "#8e8a96"), dist);
    var minY = Math.min(pts[1], pts[3], pts[5], pts[7]), maxY = Math.max(pts[1], pts[3], pts[5], pts[7]), minX = Math.min(pts[0], pts[6]), maxX = Math.max(pts[0], pts[6]);
    var o = '<clipPath id="' + id + '">' + Pg(pts, "#000") + "</clipPath>" + Pg(pts, base) + '<g clip-path="url(#' + id + ')">';
    for (var y = minY + 5; y < maxY; y += 6) {
      o += R(minX, y, maxX - minX, 1.4, dark, op(".55"));
      for (var x = minX + (y % 12 ? 0 : 7); x < maxX; x += 13 + r() * 6) o += R(x, y + 1.4, 1, 4.6, dark, op(".35"));
    }
    o += R(minX, minY, maxX - minX, 3, lite, op(".7")) + "</g>";
    o += R(minX, maxY - 1, maxX - minX, 4, Hz(P, Lc(P, "#e9e4d6"), dist)) + R(minX + 6, maxY + 3, maxX - minX - 12, 5, Hz(P, Sc(P, "#3a3640"), dist), op(".45"));
    return o;
  }
  function houseWin(P, x, y, w, h) {
    // painted dark; the cel layer lights them one by one as the evening goes on
    var trim = Hz(P, Lc(P, "#f1eee4"), .2), glass = P.mode === "day" || P.mode === "golden" ? Hz(P, cmix(Lc(P, "#7f9cbc"), "#ffffff", .2), .2) : Hz(P, Sc(P, "#3c4766"), .15);
    return R(x - 4, y - 4, w + 8, h + 8, trim) + R(x, y, w, h, glass) + R(x + w / 2 - 1, y, 2, h, trim) + R(x, y + h / 2 - 1, w, 2, trim) +
      R(x - 12, y - 4, 8, h + 8, Hz(P, Sc(P, "#3f5a4a"), .18)) + R(x + w + 4, y - 4, 8, h + 8, Hz(P, Sc(P, "#3f5a4a"), .18));
  }
  function fence(P, x0, x1, top, bot) {
    var r = rand(61), o = "", base = OB.fence, lit = Lc(P, base), sh = Sc(P, base), mid = cmix(lit, sh, .35);
    if (P.mode === "sunset" || P.night || P.heavy) lit = cmix(lit, sh, .45);
    o += R(x0, top, x1 - x0, bot - top, lit);
    for (var x = x0; x < x1; x += 9) {
      var t = r(), col = t < .3 ? cmix(lit, sh, .18) : t < .45 ? cmix(lit, "#ffffff", .06) : lit;
      o += R(x, top + 2, 8.2, bot - top - 2, col) + R(x + 8.2, top + 2, .9, bot - top - 2, sh, op(".7"));
      o += Pg([x, top + 2, x + 2.4, top - 1, x + 5.8, top - 1, x + 8.2, top + 2], col);
      if (r() < .25) o += Ln(x + 2 + r() * 4, top + 8 + r() * 20, x + 2 + r() * 4, top + 30 + r() * 24, sh, .8, ' stroke-opacity=".45"');
      if (r() < .08) o += El(x + 4, top + 12 + r() * 40, 1.6, 2.4, sh, op(".6"));
    }
    for (x = x0 + 30; x < x1; x += 72) o += R(x, top - 3, 10, bot - top + 3, mid) + R(x + 8, top - 3, 2, bot - top + 3, sh);
    // dappled shade from the trees on the other side
    if (!P.heavy && P.mode !== "night") {
      [[210, 600, 70, 16], [330, 594, 90, 13], [420, 612, 46, 10], [800, 600, 80, 15], [880, 616, 40, 9], [40, 606, 60, 12]].forEach(function (s) { o += Pt(blobD(s[0], s[1], s[2], s[3], r, 9, .4), sh, op(".55")); });
    }
    o += R(x0, bot - 8, x1 - x0, 8, sh, op(".35"));
    if (P.snow) o += snowCap(P, x0, top - 1, x1 - x0, 6);
    return o;
  }

  function lotGround(P) {
    var r = rand(71), o = "", near = wetC(P, Mc(P, OB.asphalt)), far = Hz(P, wetC(P, Mc(P, OB.asphalt)), .22);
    if (P.snow) { near = cmix(Mc(P, OB.snow), Mc(P, OB.asphalt), .18); far = Hz(P, Tc(P, OB.snow), .15); }
    o += '<defs><linearGradient id="lot" x1="0" y1="640" x2="0" y2="960" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="' + far + '"/><stop offset="1" stop-color="' + cmul(near, "#e8e8ee") + '"/></linearGradient></defs>';
    o += R(-10, 646, 1940, 300, "url(#lot)");
    var dk = cmul(near, "#8a8a94"), lt = cmix(near, "#ffffff", .14);
    // patches, cracks sealed with tar, and the gravel showing through
    o += Pg([520, 760, 700, 754, 712, 790, 530, 798], cmix(near, dk, .35), op(".5")) + Pg([1300, 880, 1480, 872, 1500, 916, 1310, 924], cmix(near, lt, .5), op(".5"));
    for (var i = 0; i < 14; i++) {
      var x = r() * 1900, y = 660 + r() * 270, d = "M" + n1(x) + "," + n1(y);
      for (var k = 0; k < 5; k++) { x += 14 + r() * 26; y += (r() - .5) * 12; d += " L" + n1(x) + "," + n1(y); }
      o += '<path d="' + d + '" stroke="' + cmul(near, "#5a5a66") + '" stroke-width="' + n1(1.4 + (y - 640) / 160) + '" fill="none" stroke-opacity=".55" stroke-linejoin="round"/>';
    }
    if (!P.snow) for (i = 0; i < 520; i++) { var sx = r() * 1920, sy = 648 + r() * 292, s = .8 + (sy - 640) / 170; o += R(sx, sy, s, s * .7, r() < .5 ? lt : dk, op(".28")); }
    else [[760, 30], [820, 46], [880, 36], [905, 52]].forEach(function (t) { var ty = t[0]; o += '<path d="M-10,' + ty + " Q700," + (ty + t[1]) + " 1930," + (ty - 14) + '" stroke="' + cmix(near, Mc(P, OB.asphalt), .45) + '" stroke-width="' + n1(3 + (ty - 700) / 40) + '" fill="none" stroke-opacity=".45"/>'; });
    return o;
  }

  function building(P) {
    return videoBuilding(P) + karaokeNeighbour(P) + sidewalk(P) + iceChest(P, 790, 706);
  }
  function iceChest(P, x, by) {
    var o = El(x + 30, by + 2, 40, 5, Sc(P, "#1a1820"), op(".35")), body = "#eef1f2";
    o += R(x, by - 66, 60, 66, Lc(P, body)) + R(x + 40, by - 66, 20, 66, Sc(P, body)) + R(x - 2, by - 72, 64, 8, Tc(P, "#dfe5ea"));
    o += R(x + 4, by - 52, 52, 22, Lc(P, "#2d62b3")) + R(x + 40, by - 52, 16, 22, Sc(P, "#2d62b3"));
    for (var i = 0; i < 6; i++) o += R(x + 2 + i * 10, by - 64, 6, 2, Tc(P, "#ffffff"), op(".8"));
    return o + R(x + 26, by - 26, 8, 8, Sc(P, "#8f8f96")) + snowCap(P, x - 2, by - 72, 64, 7);
  }
  // next door, across the alley: the corner of the bar, two storeys of brick with its neon board and striped awning
  // (the same building you see from the bar's own doorstep and on the Strip)
  function karaokeNeighbour(P) {
    var o = "", X0 = 1712, x, y, rr = rand(71);
    o += R(1666, 462, 46, 230, Hz(P, Sc(P, "#3a3648"), .15));
    for (x = 1668; x < 1710; x += 12) o += R(x, 600, 10, 92, Sc(P, OB.fence)) + R(x, 600, 3, 92, Lc(P, OB.fence), op(".5"));
    o += R(1676, 652, 30, 40, Sc(P, "#3f6a4a")) + R(1673, 648, 36, 6, Lc(P, "#557f52"));
    var bL = cmix(Wc(P, OB.brick, .35), Sc(P, OB.brick), .5), bD = Sc(P, "#7c4636"), bH = Lc(P, "#b8705a");
    o += R(X0, 236, 230, 456, bL);
    for (y = 244; y < 692; y += 14) {
      o += R(X0, y, 230, 1.6, bD, op(".5"));
      for (x = X0 + ((y / 14) % 2 ? 0 : 20); x < 1942; x += 40) { o += R(x, y, 1.6, 14, bD, op(".4")); if (rr() < .1) o += R(x + 2, y + 2, 36, 11, bH, op(".35")); }
    }
    o += R(X0 - 10, 218, 240, 20, Tc(P, OB.cap)) + R(X0 - 10, 236, 240, 5, Sc(P, OB.cap)) + R(X0 - 4, 241, 236, 8, Sc(P, "#5a3a30"));
    var lamp = P.lit, wx = 1774;
    o += R(wx - 8, 274, 96, 124, Lc(P, OB.trim)) + R(wx, 282, 80, 108, lamp ? "#f2c56b" : Sc(P, "#2e3448"));
    if (lamp) o += Pg([wx, 282, wx + 34, 282, wx + 22, 390, wx, 390], "#b9475a", op(".85")) + Pg([wx + 80, 282, wx + 50, 282, wx + 60, 390, wx + 80, 390], "#b9475a", op(".85"));
    else o += Pg([wx, 282, wx + 50, 282, wx, 340], "#55607c", op(".5"));
    o += R(wx, 334, 80, 4, Lc(P, OB.trim)) + R(wx + 38, 282, 4, 108, Lc(P, OB.trim)) + R(wx - 12, 398, 104, 8, Tc(P, OB.cap));
    o += '<rect x="1738" y="426" width="240" height="104" rx="8" fill="' + Sc(P, "#2a2230") + '"/>' + R(1742, 426, 236, 5, Tc(P, "#55505e"));
    for (x = 1722; x < 1950; x += 43) {
      var c = Math.round((x - 1722) / 43) % 2 ? cmix(Mc(P, "#efe3c8"), "#e8d6b4", .6) : cmix(Mc(P, "#a8323e"), "#a8323e", .6);
      o += Pg([x + 8, 548, x + 51, 548, x + 43, 588, x, 588], c) + El(x + 21.5, 588, 21.5, 8, c);
    }
    o += R(1718, 544, 230, 6, Sc(P, "#5a3a30"));
    o += R(1740, 610, 210, 82, Sc(P, "#3a2a22")) + R(1748, 618, 200, 74, Ic(P, "#f0b860")) + R(1748, 618, 200, 74, "#7a2f3a", op(".5"));
    [[1786, 1], [1846, .9], [1906, 1.04]].forEach(function (h) { o += Ci(h[0], 656, 12 * h[1], "#2a1622", op(".85")) + Pt("M" + (h[0] - 24 * h[1]) + ",692 Q" + h[0] + ",664 " + (h[0] + 24 * h[1]) + ",692 Z", "#2a1622", op(".85")); });
    return o;
  }

  function sidewalk(P) {
    var o = "", r = rand(83), top = Tc(P, OB.concrete), shd = Sc(P, OB.concrete);
    if (P.snow) { top = Tc(P, OB.snow); shd = Sc(P, OB.snow); }
    top = wetC(P, top);
    o += Pg([776, 692, 1930, 692, 1930, 728, 772, 728], top);
    o += R(776, 692, 1154, P.mode === "day" || P.mode === "golden" ? 18 : 10, shd, op(".75"));
    // expansion joints, running back toward the vanishing point
    for (var x = 830; x < 1930; x += 96) o += Ln(x, 692, persp(x, 692, 728), 728, cmul(top, "#9a96a0"), 1.2, ' stroke-opacity=".6"');
    // the curb: fire-lane red in front of the door, plain concrete elsewhere
    o += R(772, 728, 1158, 3, cmix(top, "#ffffff", .2)) + R(772, 731, 1158, 10, Sc(P, OB.concrete));
    o += R(1196, 731, 230, 10, Wc(P, "#b9473b", .25));
    // light from the windows thrown across the walk and out onto the lot (painted flat, the cel way)
    if (P.lit) {
      var a = (.16 * P.warm).toFixed(3), a2 = (.1 * P.warm).toFixed(3);
      [[970, 1246], [1356, 1636], [1748, 1930]].forEach(function (w) {
        o += Pg([w[0], 692, w[1], 692, persp(w[1], 692, 728), 728, persp(w[0], 692, 728), 728], "#ffe3a8", op(a));
        o += Pg([persp(w[0], 692, 741), 741, persp(w[1], 692, 741), 741, persp(w[1], 692, 812) + 30, 812, persp(w[0], 692, 812) - 30, 812], "#ffd896", op(a2));
      });
    }
    return o;
  }

  function stripe(P, x0, y0, y1, a) {
    var x1 = persp(x0, y0, y1), w0 = 3 + (y0 - 600) / 60, w1 = 3 + (y1 - 600) / 60, c = P.snow ? cmix(Tc(P, OB.stripe), Mc(P, OB.asphalt), .2) : wetC(P, Tc(P, OB.stripe));
    return Pg([x0 - w0 / 2, y0, x0 + w0 / 2, y0, x1 + w1 / 2, y1, x1 - w1 / 2, y1], c, op(a || ".78"));
  }
  function wheelStop(P, cx, y, w) {
    return R(cx - w / 2, y, w, 7, Tc(P, "#cfc8ba")) + R(cx - w / 2, y + 7, w, 4, Sc(P, "#cfc8ba"));
  }
  function lotFront(P) {
    var o = "", r = rand(97), i, x;
    // stalls along the shopfronts, and a hatched no-parking bay at the door
    [880, 1050, 1220, 1390, 1560, 1730, 1900].forEach(function (x0) { o += stripe(P, x0, 742, 868); });
    for (i = 0; i < 5; i++) { var hx0 = 1246 + i * 28; o += Pg([hx0, 744, hx0 + 4, 744, persp(hx0 + 4, 744, 866) - 46, 866, persp(hx0, 744, 866) - 46, 866], wetC(P, Tc(P, "#e9c445")), op(P.snow ? ".12" : ".22")); }
    [965, 1135, 1475, 1645].forEach(function (cx) { o += wheelStop(P, cx, 746, 92); });
    // stalls along the fence
    [40, 200, 360, 520, 680].forEach(function (x0) { o += stripe(P, x0, 652, 726, ".7"); });
    [120, 440, 600].forEach(function (cx) { o += wheelStop(P, cx, 654, 60); });
    // oil stains where cars sit all day
    [[965, 812], [1135, 806], [1475, 810], [440, 690], [1645, 816]].forEach(function (s) { o += Pt(blobD(s[0], s[1], 34, 7, r, 8, .4), "#1a1a22", op(P.snow ? ".05" : ".22")); });
    if (P.wet) o += wetLot(P);
    // the parked cars, seen from behind
    var cc = eraCars(rewindYear());
    o += carRear(P, 122, 728, 136, 104, "wagon", cc[0]);
    o += carRear(P, 965, 852, 170, 132, "sedan", cc[1]);
    o += carRear(P, 1792, 858, 208, 192, "pickup", cc[2]);
    o += cart(P, 1568, 846);
    return o;
  }
  // On Rewind Night the car park is repainted in the colours people drove that decade
  function eraCars(ry) {
    return !ry ? ["#cbb489", "#2f4f8d", "#8c2b28"] : ry < 1980 ? ["#b08d3c", "#5d7a3a", "#7a4a2a"] : ry < 1990 ? ["#cdb38a", "#7a1f2b", "#2f3f6d"] :
      ry < 2000 ? ["#cbb489", "#2f4f8d", "#8c2b28"] : ry < 2010 ? ["#b9bec6", "#27304a", "#8c2b28"] : ["#e8e8e6", "#3c3f46", "#b9bec6"];
  }
  // what the reader board says the store rents, by era
  function eraFormat(ry) { return ry < 1978 ? "8MM & 16MM FOR HIRE" : ry < 1986 ? "VHS & BETA RENTALS" : ry < 1998 ? "BE KIND · REWIND" : ry < 2007 ? "NOW RENTING DVD" : "DVD & BLU-RAY"; }
  function carRear(P, cx, gy, w, h, kind, base) {
    var o = "", L = Lc(P, base), S = Sc(P, base), x0 = cx - w / 2, x1 = cx + w / 2, glass = P.mode === "day" || P.mode === "golden" ? Lc(P, "#3c4a5e") : Sc(P, "#3c4a5e");
    var tire = Sc(P, "#232229"), split = cx + w * (P.lx < 0 ? .16 : -.16);
    o += El(cx, gy + 2, w * .58, h * .07, "#14121a", op(".35"));
    o += R(x0 + w * .04, gy - h * .17, w * .16, h * .17, tire) + R(x1 - w * .2, gy - h * .17, w * .16, h * .17, tire);
    var roofTop = gy - h, beltY = gy - h * (kind === "pickup" ? .52 : .56), lidY = gy - h * (kind === "pickup" ? .5 : .62);
    var cabIn = kind === "pickup" ? w * .12 : w * .14;
    // Seen straight from behind, the way the background painters drew parked cars: no side panels to fight the
    // perspective, just the body, the cabin, wheels peeking out below and the door mirrors sticking out either side.
    // small door mirrors on short stalks, just outside the cabin
    var mir = Sc(P, base), my = lidY - h * .11, mw = w * .045, mh = h * .065;
    [[x0 + cabIn, -1], [x1 - cabIn, 1]].forEach(function (m) {
      var ex = m[0] + m[1] * w * .02, ox = ex + m[1] * mw;
      o += Ln(m[0] + m[1] * w * .03, lidY - h * .02, ex, my + mh * .6, mir, 2.4);
      o += '<rect x="' + n1(Math.min(ex, ox)) + '" y="' + n1(my) + '" width="' + n1(mw) + '" height="' + n1(mh) + '" rx="' + n1(mh * .3) + '" fill="' + mir + '"/>';
    });
    // greenhouse
    o += Pg([x0 + cabIn, lidY, x0 + cabIn + w * .07, roofTop + h * .06, x1 - cabIn - w * .07, roofTop + h * .06, x1 - cabIn, lidY], S);
    o += Pg([x0 + cabIn, lidY, x0 + cabIn + w * .07, roofTop + h * .06, split, roofTop + h * .06, split, lidY], L);
    var gi = kind === "pickup" ? h * .08 : 0;
    o += Pg([x0 + cabIn + w * .05, lidY - h * .03 - gi, x0 + cabIn + w * .1, roofTop + h * .12, x1 - cabIn - w * .1, roofTop + h * .12, x1 - cabIn - w * .05, lidY - h * .03 - gi], glass);
    o += Pg([cx - w * .1, roofTop + h * .12, cx - w * .04, roofTop + h * .12, cx - w * .2, lidY - h * .04 - gi, cx - w * .26, lidY - h * .04 - gi], "#ffffff", op(P.lit ? ".12" : ".35"));
    o += R(x0 + cabIn + w * .07, roofTop + h * .03, w - 2 * cabIn - w * .14, h * .05, Tc(P, base));
    // body
    if (kind === "pickup") { o += R(x0, lidY - h * .04, w, h * .04, Tc(P, base)); }
    o += Pt("M" + n1(x0) + "," + n1(gy - h * .14) + " L" + n1(x0) + "," + n1(lidY + h * .04) + " Q" + n1(x0) + "," + n1(lidY) + " " + n1(x0 + w * .05) + "," + n1(lidY) + " L" + n1(x1 - w * .05) + "," + n1(lidY) + " Q" + n1(x1) + "," + n1(lidY) + " " + n1(x1) + "," + n1(lidY + h * .04) + " L" + n1(x1) + "," + n1(gy - h * .14) + "Z", S);
    o += Pt("M" + n1(x0) + "," + n1(gy - h * .14) + " L" + n1(x0) + "," + n1(lidY + h * .04) + " Q" + n1(x0) + "," + n1(lidY) + " " + n1(x0 + w * .05) + "," + n1(lidY) + " L" + n1(split) + "," + n1(lidY) + " L" + n1(split) + "," + n1(gy - h * .14) + "Z", L);
    o += R(x0, lidY, w, h * .025, Tc(P, base), op(".8"));
    if (kind === "wagon") { o += R(x0 + w * .14, lidY + h * .08, w * .72, h * .2, Sc(P, "#7a4a2a")) + R(x0 + w * .14, lidY + h * .08, w * .72, 2, Lc(P, "#a8764a")); for (var g = 0; g < 4; g++) o += R(x0 + w * .16, lidY + h * (.11 + g * .045), w * .68, 1, Sc(P, "#5a341e"), op(".7")); }
    if (kind === "pickup") { o += R(x0 + w * .1, lidY + h * .1, w * .8, 2, S, op(".6")) + R(x0 + w * .1, lidY + h * .3, w * .8, 2, S, op(".6")) + R(cx - w * .12, lidY + h * .06, w * .24, h * .03, Sc(P, "#cfcfd4")); }
    // tail lights, plate, bumper
    var tl = P.lit ? "#c8303a" : Lc(P, "#b02a30"), tlh = kind === "pickup" ? h * .28 : h * .13;
    o += R(x0 + w * .02, lidY + h * .05, w * .1, tlh, tl) + R(x1 - w * .12, lidY + h * .05, w * .1, tlh, Sc(P, "#b02a30")) + R(x0 + w * .02, lidY + h * .05 + tlh * .66, w * .1, tlh * .34, Lc(P, "#e8a33a"));
    o += R(cx - w * .12, gy - h * .29, w * .24, h * .1, Lc(P, "#ebe6d6")) + R(cx - w * .09, gy - h * .255, w * .18, h * .03, Sc(P, "#2d4a8a"));
    o += '<rect x="' + n1(x0 - 2) + '" y="' + n1(gy - h * .15) + '" width="' + n1(w + 4) + '" height="' + n1(h * .08) + '" rx="' + n1(h * .03) + '" fill="' + (kind === "pickup" ? Lc(P, "#cfd0d6") : Sc(P, "#2e2c33")) + '"/>' + R(x0 + 2, gy - h * .15, w - 4, 2, Tc(P, "#ffffff"), op(".4"));
    // a hard highlight along the top of the trunk, the way the cel painters picked out chrome and paint
    o += R(x0 + w * .06, lidY + h * .02, w * .5, 2, "#ffffff", op(P.lit ? ".12" : ".3"));
    if (P.snow) o += snowCap(P, x0 + cabIn + w * .07, roofTop + h * .03, w - 2 * cabIn - w * .14, 7) + snowCap(P, x0, lidY, w, 6);
    if (P.wet) o += R(x0 + w * .06, roofTop + h * .045, w * .5, 2, "#ffffff", op(".35"));
    return o;
  }
  function cart(P, x, gy) {
    var c = P.night ? Sc(P, OB.steel) : Lc(P, OB.steel), o = El(x + 30, gy + 2, 40, 5, "#14121a", op(".28")), st = ' stroke="' + c + '" stroke-width="2" fill="none"';
    o += '<path d="M' + x + "," + (gy - 50) + " L" + (x + 64) + "," + (gy - 50) + " L" + (x + 58) + "," + (gy - 20) + " L" + (x + 8) + "," + (gy - 20) + 'Z"' + st + "/>";
    for (var i = 1; i < 6; i++) o += Ln(x + i * 10.6, gy - 50, x + 4 + i * 9, gy - 20, c, 1, ' stroke-opacity=".8"');
    o += Ln(x + 2, gy - 38, x + 61, gy - 38, c, 1) + Ln(x - 8, gy - 60, x + 2, gy - 50, c, 2.4) + Ln(x - 12, gy - 60, x - 2, gy - 60, Lc(P, "#c4313d"), 4);
    o += Ln(x + 10, gy - 20, x + 12, gy - 4, c, 2) + Ln(x + 56, gy - 20, x + 54, gy - 4, c, 2) + Ci(x + 12, gy - 3, 3, Sc(P, "#222")) + Ci(x + 54, gy - 3, 3, Sc(P, "#222"));
    return o;
  }
  function wetLot(P) {
    // rain on the blacktop: the sky's colour lying in the puddles, and lights smeared into tall streaks
    var o = "", r = rand(101), sky = cmix(P.sky[P.sky.length - 1][1], "#ffffff", .1);
    [[300, 700, 120], [760, 780, 160], [1300, 900, 190], [560, 900, 140], [1700, 712, 90], [120, 850, 110]].forEach(function (p) { o += Pt(blobD(p[0], p[1], p[2], p[2] * .08, r, 10, .35), sky, op(".3")); });
    if (P.lit) {
      var warm = "#ffd38c";
      [[1108, 744, 110, 120], [1494, 744, 120, 120], [1784, 744, 100, 110], [930, 744, 22, 70], [440, 760, 30, 150]].forEach(function (s) { o += smear(s[0], s[1], s[2], s[3], warm, .3, r); });
    }
    return o;
  }

  // a light smeared down wet ground: a column of broken horizontal strokes, thinning as it goes
  function signPosts(P) {
    var o = "", r = rand(113), post = "#5d606c", fr = "#2c2832";
    // the planted island the sign stands in
    var cTop = Tc(P, OB.concrete), cS = Sc(P, OB.concrete);
    o += Pg([548, 904, 836, 898, 852, 922, 532, 930], P.snow ? Tc(P, OB.snow) : wetC(P, Mc(P, "#6b5a46"))) + Pg([532, 930, 852, 922, 852, 932, 532, 940], cS) + Pg([532, 928, 852, 920, 852, 923, 532, 931], cTop);
    for (var i = 0; i < 6; i++) o += Pt(blobD(560 + i * 50 + r() * 10, 908 - i * .8, 26, 13, r, 9, .3), Sc(P, "#3f6a4a")) + Pt(blobD(556 + i * 50 + r() * 10, 903 - i * .8, 14, 6, r, 7, .3), Lc(P, "#557f52"), op(".9"));
    // posts
    [632, 744].forEach(function (x) { o += R(x, 330, 20, 588, Sc(P, post)) + R(x, 330, 7, 588, Lc(P, post)) + R(x - 3, 906, 26, 10, Sc(P, "#4a4c56")); });
    // the cabinet (its glowing face is on the cel level) and the reader board frame
    o += '<rect x="518" y="124" width="342" height="202" rx="12" fill="' + Sc(P, fr) + '"/>' + '<rect x="518" y="124" width="342" height="8" rx="4" fill="' + Tc(P, "#55505e") + '"/>';
    o += R(560, 324, 258, 10, Sc(P, fr));
    o += '<rect x="542" y="334" width="294" height="106" rx="4" fill="' + Sc(P, fr) + '"/>' + R(542, 334, 294, 4, Tc(P, "#55505e"));
    o += snowCap(P, 520, 126, 338, 10) + snowCap(P, 544, 335, 290, 7);
    return o;
  }
  function streetPole(P) {
    var o = "", c = OB.steel;
    o += R(296, 236, 11, 712, Sc(P, c)) + R(296, 236, 4, 712, Lc(P, c)) + R(290, 938, 23, 10, Sc(P, "#6d6f78"));
    o += '<path d="M301,250 Q330,226 452,232" stroke="' + Sc(P, c) + '" stroke-width="8" fill="none"/>' + '<path d="M301,247 Q330,223 450,229" stroke="' + Lc(P, c) + '" stroke-width="2.5" fill="none"/>';
    o += Pt("M440,226 Q480,218 512,232 Q506,244 470,246 L440,240 Z", Sc(P, "#7c7f8a")) + Pt("M440,226 Q480,218 512,232 L470,234 L440,232 Z", Lc(P, "#9a9da8"));
    o += snowCap(P, 300, 236, 150, 5);
    return o;
  }
  function frontStrip(P) {
    var o = "", r = rand(127), top = P.snow ? Tc(P, OB.snow) : wetC(P, Tc(P, OB.concrete)), face = Sc(P, OB.concrete);
    var road = P.snow ? cmix(Mc(P, OB.snow), Mc(P, OB.road), .35) : wetC(P, Mc(P, OB.road));
    o += Pg([-10, 936, 1930, 930, 1930, 954, -10, 958], top) + Pg([-10, 958, 1930, 954, 1930, 964, -10, 968], face) + Pg([-10, 968, 1930, 964, 1930, 968, -10, 972], cmul(road, "#77778a"));
    for (var x = 60; x < 1930; x += 150) o += Ln(x, 936 - x * .003, x - 8, 957 - x * .002, cmul(top, "#a29ea8"), 1.2, ' stroke-opacity=".6"');
    o += '<defs><linearGradient id="road" x1="0" y1="964" x2="0" y2="1080" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="' + cmix(road, P.haze, .08) + '"/><stop offset="1" stop-color="' + cmul(road, "#d0d0da") + '"/></linearGradient></defs>';
    o += Pg([-10, 968, 1930, 964, 1930, 1090, -10, 1090], "url(#road)");
    if (!P.snow) for (var i = 0; i < 260; i++) { var sx = r() * 1920, sy = 970 + r() * 110, s = 1.2 + (sy - 960) / 80; o += R(sx, sy, s, s * .6, r() < .5 ? cmix(road, "#ffffff", .12) : cmul(road, "#8888a0"), op(".3")); }
    else [1004, 1018, 1068, 1080].forEach(function (ty) { o += '<path d="M-10,' + ty + " L1930," + (ty - 4) + '" stroke="' + cmix(road, Mc(P, OB.road), .65) + '" stroke-width="9" fill="none" stroke-opacity=".6"/>'; });
    o += Pg([700, 1012, 900, 1006, 920, 1026, 712, 1032], cmul(road, "#8a8a9a"), op(".4"));
    // the double yellow, worn
    var y1 = P.snow ? cmix(Lc(P, "#e2b93b"), Tc(P, OB.snow), .6) : wetC(P, Lc(P, "#e2b93b"));
    o += Pg([-10, 1040, 1930, 1036, 1930, 1041, -10, 1045], y1, op(".9")) + Pg([-10, 1051, 1930, 1047, 1930, 1052, -10, 1056], y1, op(".9"));
    o += El(1320, 1064, 44, 8, cmul(road, "#77778a")) + El(1320, 1063, 38, 6, cmul(road, "#9a9aaa"), op(".6"));
    o += R(1150, 959, 90, 7, "#1a1820", op(".8"));
    o += hydrant(P, 472, 948);
    if (P.wet && P.lit) {
      // the pole sign and the shop windows smeared down the wet road
      o += smear(690, 974, 150, 100, "#fff1cf", .26, r) + smear(690, 978, 90, 80, "#e2504a", .2, r);
    }
    return o;
  }
  function hydrant(P, x, by) {
    var b = "#c8362e", o = El(x, by + 2, 22, 4, "#14121a", op(".35"));
    o += R(x - 11, by - 40, 22, 40, Lc(P, b)) + R(x + 2, by - 40, 9, 40, Sc(P, b)) + Pt("M" + (x - 12) + "," + (by - 40) + " Q" + x + "," + (by - 58) + " " + (x + 12) + "," + (by - 40) + "Z", Lc(P, b));
    o += R(x - 18, by - 30, 36, 9, Lc(P, "#d8d8dc")) + R(x + 6, by - 30, 12, 9, Sc(P, "#d8d8dc")) + R(x - 14, by - 4, 28, 5, Sc(P, b)) + Ci(x, by - 53, 3, Sc(P, "#d8d8dc"));
    return o + snowCap(P, x - 11, by - 48, 22, 5);
  }
  function utilityPole(P) {
    var o = "", w = OB.wood, wl = Lc(P, w), ws = Sc(P, w), wire = cmul(Sc(P, "#2a2630"), "#d8d8e4");
    // the lines, sagging off toward the next pole beyond the shops
    [[16, 100, 1930, 214, 160], [146, 100, 1930, 226, 150], [60, 100, 1930, 238, 172], [30, 146, 1930, 286, 120], [120, 146, 1930, 298, 112]].forEach(function (l) {
      o += '<path d="M' + l[0] + "," + l[1] + " Q" + n1((l[0] + l[2]) / 2) + "," + n1((l[1] + l[3]) / 2 + l[4]) + " " + l[2] + "," + l[3] + '" stroke="' + wire + '" stroke-width="2" fill="none"/>';
    });
    // a few grackles on the line (they go home after dark)
    if (!P.night && !P.wet && !P.snow) {
      var bird = Sc(P, "#1d1b26");
      [[1020, 246], [1046, 249], [1300, 245], [1324, 243]].forEach(function (b, i) {
        var t = (b[0] - 146) / (1930 - 146), y = (1 - t) * (1 - t) * 100 + 2 * (1 - t) * t * (163 + 150) + t * t * 226 - 2;
        o += Pt("M" + b[0] + "," + n1(y) + " q-4,-2 -6,-9 q2,-4 6,-3 q3,-3 6,0 l5,1 l-5,2 q2,6 -2,9 l6,4 l-7,-2z", bird) + Ln(b[0], y, b[0] + (i % 2 ? 8 : -7), y + 12, bird, 1.6);
      });
    }
    o += R(54, -20, 30, 990, ws) + R(54, -20, 14, 990, wl);
    for (var y = 40; y < 940; y += 50) o += Ln(58 + (y % 100 ? 4 : 0), y, 58 + (y % 100 ? 4 : 0), y + 28, Sc(P, "#3f3228"), 1, ' stroke-opacity=".5"');
    for (y = 300; y < 860; y += 70) o += R(y % 140 ? 50 : 84, y, 6, 3, Sc(P, OB.steel));
    o += R(-6, 102, 170, 12, ws) + R(-6, 102, 170, 4, wl) + R(14, 148, 134, 10, ws) + R(14, 148, 134, 3, wl);
    o += Ln(68, 140, 10, 114, ws, 3) + Ln(70, 140, 150, 114, ws, 3);
    [16, 60, 120, 146].forEach(function (x) { o += R(x - 4, 90, 8, 12, Lc(P, "#7aa0a8")) + R(x - 5, 92, 10, 2.5, Sc(P, "#5a7c84")); });
    [30, 120].forEach(function (x) { o += R(x - 4, 136, 8, 12, Lc(P, "#7aa0a8")); });
    o += R(86, 172, 30, 64, Lc(P, "#9ca1a8")) + R(104, 172, 12, 64, Sc(P, "#9ca1a8")) + R(84, 170, 34, 5, Tc(P, "#c4c8ce")) + R(96, 162, 5, 9, Sc(P, "#5a5a62"));
    o += Ln(100, 172, 90, 150, wire, 1.6) + Ln(84, 200, 68, 200, ws, 4);
    o += snowCap(P, -6, 102, 170, 5) + snowCap(P, 14, 148, 134, 4);
    return o;
  }

  function plateSVG(P) {
    clipN = 0;
    var body = farBand(P) + backyards(P) + lotGround(P) + building(P) + lotFront(P) + signPosts(P) + streetPole(P) + frontStrip(P) + utilityPole(P);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">' + body + "</svg>";
  }
  // ---- the cel levels: inked, flat-painted, laid over the background ----
  function backCels(P) {
    // stars (little painted crosses and dots), the moon, a shooting star
    var r = rand(5), s = "";
    for (var i = 0; i < 70; i++) {
      var x = r() * 1920, y = r() * 420, big = r() < .14, d = (r() * 2.4).toFixed(2), c = r() < .2 ? "#ffe9c4" : "#f4f6ff";
      if (big) s += '<path d="M' + n1(x) + "," + n1(y - 6) + " L" + n1(x + 1.4) + "," + n1(y - 1.4) + " L" + n1(x + 6) + "," + n1(y) + " L" + n1(x + 1.4) + "," + n1(y + 1.4) + " L" + n1(x) + "," + n1(y + 6) + " L" + n1(x - 1.4) + "," + n1(y + 1.4) + " L" + n1(x - 6) + "," + n1(y) + " L" + n1(x - 1.4) + "," + n1(y - 1.4) + 'Z" fill="' + c + '" style="animation-delay:-' + d + 's"/>';
      else s += Ci(x, y, .9 + r() * 1.1, c, ' style="animation-delay:-' + d + 's"');
    }
    var mo = OUT_MODES[P.mode].stars;
    var o = mo && !P.heavy ? '<g class="o-stars" opacity="' + (P.ovc ? mo * .5 : mo) + '">' + s + "</g>" : "";
    o += '<g class="o-moon" id="oMoon" opacity="' + (P.heavy ? 0 : P.mode === "night" ? 1 : P.mode === "sunset" ? .75 : 0) + '">' + Ci(1540, 150, 58, "#fff6d8", op(".045")) + Ci(1540, 150, 42, "#fff6d8", op(".05")) +
      Ci(1540, 150, 30, P.mode === "night" ? "#2a3266" : "#6a5a8a", op(".45")) + '<path id="oMoonLit" fill="#fff4cf"/></g>';
    o += '<g class="o-shoot" id="oShoot"><path d="M0,0 L74,-26 L76,-23 Z" fill="#fffbe6"/></g>';
    return o;
  }
  function midCels() {
    // a forked bolt, drawn, for the two frames the sky goes white
    var bolt = "M0,0 L-18,64 L4,62 L-26,150 L-6,146 L-40,250 L8,128 L-12,132 L18,52 L-2,54 L14,0 Z";
    return '<g id="oBolt" class="o-bolt"><path d="' + bolt + '" fill="#b9c8ff" fill-opacity=".35" stroke="#b9c8ff" stroke-opacity=".3" stroke-width="16" stroke-linejoin="round"/>' +
      '<path d="M-14,132 L-60,180 L-70,226 M-26,150 L-4,200" stroke="#dfe6ff" stroke-width="3" fill="none" stroke-linejoin="round"/>' +
      '<path d="' + bolt + '" fill="#fbfcff" stroke="#c9d6ff" stroke-width="2.5" stroke-linejoin="round"/></g>';
  }

  function frontCels(P) {
    var o = "", lit = P.lit, day = P.mode === "day" || P.mode === "golden", L = OUT_MODES[P.mode];
    // upstairs windows lighting up across the back fence (one has the TV on)
    [[106, 488, 36, 40], [182, 488, 36, 40], [684, 478, 34, 38], [794, 478, 34, 38]].forEach(function (w, i) {
      var c = i === 2 ? "#9fc4ff" : "#ffd88a", g = '<g class="o-hw' + (i === 2 ? " o-tv" : "") + '">';
      var pw = w[2] / 2 - 1, ph = w[3] / 2 - 1;
      g += R(w[0], w[1], pw, ph, c) + R(w[0] + pw + 2, w[1], pw, ph, c) + R(w[0], w[1] + ph + 2, pw, ph, c) + R(w[0] + pw + 2, w[1] + ph + 2, pw, ph, c);
      g += R(w[0] + 2, w[1] + ph + 4, pw - 4, 4, "#ffffff", op(".25"));
      o += lit ? g + "</g>" : "";
    });
    if (lit) o += '<g class="o-beacon">' + Ci(1752, 192, 10, "#ff3b3b", op(".25")) + Ci(1752, 192, 4, "#ff5a4a") + "</g>";

    // the store's channel-letter sign on the mansard
    var letter = lit ? "#ff5b48" : Lc(P, "#cf3a2e"), rim = lit ? "#ffe9b8" : Lc(P, "#f3e2b9");
    if (lit) o += '<text id="oFasciaHalo" x="1262" y="430" text-anchor="middle" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="62" fill="none" stroke="#ff6a4d" stroke-opacity="' + (.22 * L.lights).toFixed(2) + '" stroke-width="18" stroke-linejoin="round"></text>';
    o += '<text id="oFasciaSh" x="1266" y="436" text-anchor="middle" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="62" fill="' + Sc(P, "#3a2418") + '" fill-opacity=".55"></text>';
    o += '<text id="oFascia" x="1262" y="430" text-anchor="middle" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="62" fill="' + letter + '" stroke="' + rim + '" stroke-width="3" paint-order="stroke"></text>';
    // the bar's neon next door, running off the edge of the picture
    var barNm = "Saturday Night Karaoke";
    try { var sp = JSON.parse(localStorage.getItem("snk-prefs") || "{}"); if (sp && typeof sp.barName === "string" && sp.barName.trim()) barNm = sp.barName.trim().slice(0, 40); } catch (e) {}
    var bw = barNm.replace(/\s+/g, " ").split(" "), bLast = bw.length > 1 ? bw.pop() : bw[0], bFirst = bw.length && bw[0] !== bLast ? bw.join(" ") : "";
    function tube(x, y, size, txt, col, fam, ex) {
      var a = ' x="' + x + '" y="' + y + '" font-family="' + fam + '" font-size="' + size + '"' + (ex || ""), t = esc(txt);
      return (lit ? "<text" + a + ' fill="none" stroke="' + col + '" stroke-width="' + n1(size * .3) + '" stroke-opacity=".16" stroke-linejoin="round">' + t + "</text>" : "") +
        "<text" + a + ' fill="' + (lit ? cmix(col, "#ffffff", .78) : cmix(col, "#3a3048", .45)) + '" stroke="' + col + '" stroke-width="' + n1(Math.max(1.2, size * .045)) + '">' + t + "</text>";
    }
    o += '<g class="o-barneon">' + (bFirst ? tube(1756, 468, 36, bFirst, "#ff5fa2", "Caprasimo, Cooper Black, Georgia, serif") : "") +
      tube(1756, bFirst ? 516 : 494, bFirst ? 42 : 52, bLast.toUpperCase(), "#62e8de", "Oswald, Arial Narrow, sans-serif", ' font-weight="600" letter-spacing="7"') + "</g>";

    // little painted lettering
    o += Tx(1045, 516, 12, "NEW RELEASES", Ic(P, "#fff3d8"), ' font-weight="600" letter-spacing="1.5"', OSW);
    o += Tx(1384, 687, 9, "RETURNS", Wc(P, "#2f5cad", .5), ' font-weight="700" textLength="28" lengthAdjust="spacingAndGlyphs"', OSW);
    o += Tx(820, 672, 19, "ICE", Lc(P, "#ffffff"), "");
    o += Tx(1311, 739.5, 8.5, "FIRE  LANE  ·  NO  PARKING", Wc(P, "#f6efe2", .3), ' font-weight="600" letter-spacing="2"', OSW);

    // the drinks machine glowing in the walkway
    if (lit) o += '<g class="o-vend">' + rhalo(904, 556, 38, 74, 7, "#ffd9b0", .45 * L.lights) + El(930, 700, 50, 7, "#ffcf9a", op((.18 * L.lights).toFixed(2))) + "</g>";

    o += clerkWindow(P);
    // the OPEN sign in the right window
    var nOp = L.neon;
    // the sign's black backboard hangs in the window whether the tubes are lit or stuttering; only the neon flickers
    o += '<rect x="1374" y="508" width="112" height="46" rx="6" fill="#1c0a16" fill-opacity=".82"/>' +
      '<path d="M1384,508 L1392,496 M1476,508 L1468,496" stroke="#1c0a16" stroke-opacity=".6" stroke-width="1.2"/>';
    o += '<g class="o-neon" opacity="' + nOp + '">' + (lit ? halo(1430, 532, 110, 52, "#ff4f86", .5) : halo(1430, 532, 70, 34, "#ff4f86", .25)) +
      '<rect x="1378" y="512" width="104" height="38" rx="12" fill="none" stroke="#ff3d7a" stroke-width="4"/>' +
      '<rect x="1378" y="512" width="104" height="38" rx="12" fill="none" stroke="#ffd2e0" stroke-width="1.3"/>' +
      '<text id="oOpen" x="1430" y="541" text-anchor="middle" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="25" fill="#ffd3e2" stroke="#ff2d6f" stroke-width="2.2" paint-order="stroke" letter-spacing="1">OPEN</text></g>';
    o += decoCels(P);

    // the front door (it swings in when you press OK)
    var gl = day ? cmix(P.sky[1][1], "#ffffff", .3) : P.night ? "#4b5690" : cmix(P.sky[2][1], "#ffffff", .1), fr = Lc(P, OB.bronze);
    o += '<g id="oDoor">' + R(1258, 570, 88, 122, gl, op(day ? ".38" : ".1")) +
      Pg([1278, 572, 1296, 572, 1266, 690, 1258, 690, 1258, 650], "#ffffff", op(day ? ".35" : ".1")) + Pg([1306, 572, 1312, 572, 1282, 690, 1276, 690], "#ffffff", op(day ? ".3" : ".08")) +
      '<rect x="1261" y="573" width="82" height="116" fill="none" stroke="' + fr + '" stroke-width="7"/>' +
      '<rect x="1257.5" y="569.5" width="89" height="123" fill="none"' + ink(1.6) + "/>" +
      R(1264, 626, 76, 7, Lc(P, "#c9c6c0")) + R(1264, 631, 76, 2, Sc(P, "#8a8680")) +
      '<rect x="1272" y="584" width="60" height="16" rx="3" fill="#ffd84d"' + ink(1) + "/>" +
      '<text x="1302" y="595.5" text-anchor="middle" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="8.6" fill="#7a1f1f" textLength="52" lengthAdjust="spacingAndGlyphs">Be Kind · Rewind</text>' +
      Tx(1302, 648, 7, "OPEN 10AM – MIDNIGHT", lit ? "#fff7e6" : "#f4f0e6", ' font-weight="600" textLength="62" lengthAdjust="spacingAndGlyphs"', OSW) + Tx(1302, 658, 6.5, "7 DAYS", lit ? "#fff7e6" : "#f4f0e6", ' font-weight="600" letter-spacing="1"', OSW) +
      '<g class="o-deco-x">' + wreath(1302, 610) + "</g></g>";

    o += catSit(P);
    if (P.wet) o += wetCels(P);
    o += poleSignCels(P);
    o += streetLightCels(P);
    o += islandCels(P);
    o += catWalk(P);
    o += leavesCels(P);
    o += passerCel(P);
    if (lit) o += batsCels();
    return o;
  }

  // Dave works days, Gus works nights; whoever's on is behind the counter, seen through the glass
  function clerkWindow(P) {
    var who = shiftNow(), day = P.mode === "day" || P.mode === "golden";
    // painted as if seen through the glass: the window's reflection is mixed into every colour, ink included
    var refl = day ? cmix(P.sky[1][1], "#ffffff", .25) : P.night ? "#4b5690" : cmix(P.sky[2][1], "#ffffff", .1), ga = day ? (P.heavy ? .22 : .26) : P.lit ? .08 : .22;
    var ic = function (c) { return cmix(Ic(P, c), refl, ga); }, gInk = cmix(INK, refl, ga * .55);
    var gk = function (w) { return ' stroke="' + gInk + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"'; }, I = gk(1.5);
    // everything inside stays inside the glass, and behind the returns box that stands in front of the window
    var o = '<clipPath id="ckGlass"><path clip-rule="evenodd" d="M1356,496 H1636 V656 H1356 Z M1358,634 H1410 V660 H1358 Z"/></clipPath><g class="o-clerk" clip-path="url(#ckGlass)">';
    // the counter, with the till on it
    var body = "";
    if (who === "day") {
      body += '<path d="M1388,606 Q1390,590 1402,588 L1422,588 Q1434,590 1436,606 Z" fill="' + ic("#c8352b") + '"' + I + "/>";
      body += '<path d="M1406,588 L1412,596 L1418,588 Z" fill="' + ic("#f8eedb") + '"' + gk(1) + "/>";
      body += '<ellipse cx="1412" cy="577" rx="10" ry="11" fill="' + ic("#eab68c") + '"' + I + "/>";
      body += '<path d="M1401,573 Q1401,563 1412,562 Q1423,563 1423,573 Z" fill="' + ic("#1e3d93") + '"' + I + '/><path d="M1400,573 Q1412,577 1425,572 L1428,575 Q1412,581 1399,576 Z" fill="' + ic("#16307a") + '"' + gk(1) + "/>";
      body += '<path d="M1406,583 Q1412,580 1418,583 Q1415,585 1412,584 Q1409,585 1406,583 Z" fill="' + ic("#7a4a2a") + '"/>';
      body += '<g class="ck-eyes"><circle cx="1408" cy="577" r="1.2" fill="' + gInk + '"/><circle cx="1416" cy="577" r="1.2" fill="' + gInk + '"/></g>';
      // a wave now and then
      body += '<g class="ck-wave"><path d="M1434,596 L1444,580" stroke="' + gInk + '" stroke-width="5" stroke-linecap="round"/><path d="M1434,596 L1444,580" stroke="' + ic("#c8352b") + '" stroke-width="3" stroke-linecap="round"/><circle cx="1445" cy="577" r="3.4" fill="' + ic("#eab68c") + '"' + gk(1) + "/></g>";
    } else {
      body += '<path d="M1390,606 Q1392,591 1403,589 L1421,589 Q1432,591 1434,606 Z" fill="' + ic("#26232c") + '"' + I + "/>";
      body += '<ellipse cx="1412" cy="577" rx="9" ry="11.5" fill="' + ic("#efcfae") + '"' + I + "/>";
      body += '<path d="M1402,580 Q1399,565 1411,563 Q1424,562 1423,575 Q1423,582 1420,585 L1419,575 Q1414,569 1408,571 Q1405,577 1403,586 Z" fill="' + ic("#1d1a22") + '"' + I + "/>";
      body += '<g class="ck-eyes"><path d="M1413,578 L1418,578" stroke="' + gInk + '" stroke-width="1.4"/></g>';
      // nose in a magazine; the page turns now and then
      body += '<rect x="1399" y="590" width="26" height="16" fill="' + ic("#e2b33c") + '"' + I + '/><rect x="1402" y="593" width="9" height="10" fill="' + ic("#c4313d") + '"/>';
      body += '<g class="ck-page"><rect x="1412" y="590" width="13" height="16" fill="' + ic("#f4efe0") + '"' + gk(1) + "/></g>";
    }
    o += body;
    o += '<rect x="1366" y="604" width="136" height="50" fill="' + ic("#8d5c37") + '"' + I + '/><rect x="1366" y="604" width="136" height="5" fill="' + ic("#c49a6a") + '"' + gk(1) + "/>";
    o += '<path d="M1462,604 L1464,588 L1494,588 L1496,604 Z" fill="' + ic("#8a8d96") + '"' + I + '/><rect x="1468" y="591" width="14" height="5" fill="' + (P.lit ? "#57ff86" : ic("#3a6a48")) + '"/>';
    // the window's own glints carry on across them (same streaks the background painting uses)
    var gr = rand(13), gx = 1356 + 280 * (.18 + gr() * .2), gy = 496, gh = 160, ga2 = day ? ".42" : ".12";
    o += '<clipPath id="ckClip"><rect x="1360" y="560" width="146" height="94"/></clipPath><g clip-path="url(#ckClip)">' +
      Pg([gx, gy, gx + 34, gy, gx - 30, gy + gh, gx - 64, gy + gh], "#ffffff", op(ga2)) + Pg([gx + 46, gy, gx + 56, gy, gx - 8, gy + gh, gx - 18, gy + gh], "#ffffff", op(ga2)) + "</g>";
    return o + "</g>";
  }
  function poleSignCels(P) {
    var o = "", lit = P.lit, L = OUT_MODES[P.mode], face = lit ? "#fff6de" : Lc(P, "#f4eedd"), band = lit ? "#e0413f" : Lc(P, "#c4313d");
    if (lit) o += '<g class="o-glowsign">' + rhalo(532, 138, 314, 174, 16, "#fff2c8", .55 * L.lights) + rhalo(552, 344, 274, 86, 10, "#fff2c8", .45 * L.lights) + "</g>";
    o += '<rect x="532" y="138" width="314" height="174" rx="6" fill="' + face + '"/>';
    if (!lit) o += '<rect x="532" y="138" width="314" height="174" rx="6" fill="' + Sc(P, "#f4eedd") + '" fill-opacity=".35"/>' + Pg([532, 312, 846, 138, 846, 312], Sc(P, "#f4eedd"), op(".25"));
    o += '<path d="M532,168 L532,144 Q532,138 538,138 L840,138 Q846,138 846,144 L846,168 Z" fill="' + band + '"/>';
    o += '<text x="689" y="159" text-anchor="middle" font-family="' + OSW + '" font-weight="600" font-size="15" letter-spacing="3" fill="#fff8ea" textLength="282" lengthAdjust="spacingAndGlyphs" id="oBand">MOVIES · TV · LATE NIGHT</text>';
    o += '<text id="oName1" x="689" y="216" text-anchor="middle" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="31" fill="' + (lit ? "#1e3d93" : Lc(P, "#1e3d93")) + '">FRIDAY NIGHT</text>';
    o += '<text id="oName2" x="689" y="288" text-anchor="middle" font-family="Caprasimo, Cooper Black, Georgia, serif" font-size="62" fill="' + band + '" stroke="' + INK + '" stroke-width="2.2" paint-order="stroke">VIDEO</text>';
    o += Ln(540, 306, 838, 306, lit ? "#e7dcc0" : Sc(P, "#e7dcc0"), 1.4);
    // the reader board with its changeable letters
    var rb = lit ? "#fffaf0" : Lc(P, "#f6f3ea");
    o += R(552, 344, 274, 86, rb) + Ln(556, 372, 822, 372, lit ? "#ddd4c2" : Sc(P, "#d8d2c4"), 2) + Ln(556, 401, 822, 401, lit ? "#ddd4c2" : Sc(P, "#d8d2c4"), 2);
    if (!lit) o += Pg([552, 430, 826, 344, 826, 430], Sc(P, "#f6f3ea"), op(".22"));
    var mq = lit ? "#17131c" : Lc(P, "#17131c");
    o += '<text id="oMq1" x="689" y="366" text-anchor="middle" font-family="' + OSW + '" font-weight="600" font-size="21" letter-spacing="2" fill="' + mq + '">NEW THIS WEEK</text>';
    o += '<text id="oMq2" x="689" y="395" text-anchor="middle" font-family="' + OSW + '" font-weight="600" font-size="21" letter-spacing="2" fill="' + mq + '">OPEN TIL MIDNIGHT</text>';
    o += '<text id="oMq3" x="689" y="423" text-anchor="middle" font-family="' + OSW + '" font-weight="600" font-size="18" letter-spacing="2" fill="' + (lit ? "#c4313d" : Lc(P, "#c4313d")) + '">BE KIND · REWIND</text>';
    o += signDeco(P);
    return o;
  }
  function streetLightCels(P) {
    if (!P.lit) return "";
    var a = OUT_MODES[P.mode].lights, c = "#ffcb78";
    var o = '<g class="o-street">';
    o += Pg([452, 246, 496, 246, 610, 916, 330, 922], c, op((.045 * a).toFixed(3)));
    o += El(470, 906, 210, 36, c, op((.08 * a).toFixed(3))) + El(470, 906, 110, 19, "#ffe1a6", op((.1 * a).toFixed(3)));
    o += El(474, 241, 58, 22, "#ffd892", op((.16 * a).toFixed(3))) + El(474, 241, 40, 13, "#ffe6b0", op((.28 * a).toFixed(3))) + El(474, 240, 30, 6, "#fff4d4") + "</g>";
    if (!P.wet) {
      o += '<g class="o-moths" transform="translate(474,270)">';
      [["a", -18, 2], ["b", 20, -8], ["c", 4, 18], ["d", -10, -14], ["e", 30, 10]].forEach(function (m) {
        o += '<g class="moth ' + m[0] + '"><g transform="translate(' + m[1] + "," + m[2] + ')"><g class="mw">' +
          '<path d="M0,0 C-3,-7 -10,-8 -10,-2 C-10,3 -4,3 0,0 Z M0,0 C3,-7 10,-8 10,-2 C10,3 4,3 0,0 Z" fill="#fff4d8" stroke="#6a5a3a" stroke-width=".8"/>' +
          '<ellipse cx="0" cy="0" rx="1.4" ry="3.4" fill="#7a6a48"/></g></g></g>';
      });
      o += "</g>";
    }
    return o;
  }
  function islandCels(P) {
    // a crepe myrtle in the sign's planter, and some ornamental grass; both lean in the wind
    var r = rand(131), bark = Lc(P, "#a58670"), barkS = Sc(P, "#a58670"), o = '<g class="o-sway1">';
    var stems = "M572,912 Q566,872 550,842 M578,912 Q588,870 604,840 M575,912 Q574,866 576,834";
    o += '<path d="' + stems + '" fill="none"' + ink(6.4) + "/>" + '<path d="' + stems + '" fill="none" stroke="' + bark + '" stroke-width="3.6" stroke-linecap="round"/>';
    o += '<path d="M580,910 Q590,870 605,842" fill="none" stroke="' + barkS + '" stroke-width="1.4"/>';
    var leaf = "#567f45", clumps = [[528, 818, 36], [560, 792, 44], [600, 784, 42], [632, 812, 36], [548, 836, 30], [606, 836, 32], [580, 808, 40]];
    clumps.forEach(function (c) { o += Pt(blobD(c[0], c[1], c[2], c[2] * .78, r, 10, .28), Sc(P, leaf), ink(2)); });
    clumps.forEach(function (c) { o += Pt(blobD(c[0] + P.lx * c[2] * .2, c[1] + P.ly * c[2] * .22, c[2] * .66, c[2] * .5, r, 8, .3), cmix(Sc(P, leaf), Lc(P, leaf), P.night ? .35 : .75)); });
    if (!P.night && !P.snow) for (var i = 0; i < 12; i++) o += Ci(530 + r() * 92, 776 + r() * 50, 3 + r() * 2.4, Lc(P, "#e98bb2"), ink(.8));
    if (P.snow) clumps.forEach(function (c) { o += Pt(blobD(c[0], c[1] - c[2] * .5, c[2] * .6, c[2] * .22, r, 7, .3), Tc(P, OB.snow)); });
    o += "</g><g class=\"o-sway2\">";
    var gs = "", gl = "";
    for (var g = 0; g < 16; g++) { var gx = 770 + g * 4.5, tip = gx + (g - 8) * 3.2 + (g % 3 - 1) * 4; gs += "M" + n1(gx) + ",916 Q" + n1(gx + (tip - gx) * .2) + ",890 " + n1(tip) + "," + (870 + (g % 4) * 6) + " "; }
    o += '<path d="' + gs + '" fill="none"' + ink(3.6) + '/><path d="' + gs + '" fill="none" stroke="' + cmix(Lc(P, "#b7ad72"), Sc(P, "#b7ad72"), .3) + '" stroke-width="1.8" stroke-linecap="round"/>';
    return o + "</g>";
  }

  // ---- the stray cat: sitting on the returns box, or wandering past on a four-drawing walk ----
  function catSit(P) {
    var fur = P.night ? "#262236" : Lc(P, "#2e2a38"), shd = Sc(P, "#22202c"), eyes = P.lit ? '<g class="cat-eyes">' + El(1378, 610, 1.8, 1.4, "#d6f25a") + El(1386, 610, 1.8, 1.4, "#d6f25a") + "</g>" : "";
    return '<g class="o-cat-sit"><path class="cat-tail" d="M1392,636 C1404,636 1410,626 1404,614" fill="none" stroke="' + INK + '" stroke-width="5.6" stroke-linecap="round"/>' +
      '<path d="M1392,636 C1404,636 1410,626 1404,614" fill="none" stroke="' + fur + '" stroke-width="3.2" stroke-linecap="round" class="cat-tail"/>' +
      '<path d="M1372,638 Q1370,622 1378,616 L1390,616 Q1398,626 1396,638 Z" fill="' + fur + '"' + ink(1.6) + "/>" +
      '<path d="M1386,618 Q1394,626 1394,638 L1388,638 Z" fill="' + shd + '"/>' +
      '<path d="M1374,606 L1374,598 L1379,603 L1385,603 L1390,598 L1390,606 Q1390,615 1382,615 Q1374,615 1374,606 Z" fill="' + fur + '"' + ink(1.6) + "/>" + eyes +
      '<g class="cat-blink"><path d="M1376,610 L1380,610 M1384,610 L1388,610" stroke="' + INK + '" stroke-width="1.2"/></g></g>';
  }
  function catFrame(P, legs) {
    var fur = P.night ? "#262236" : Lc(P, "#2e2a38"), shd = Sc(P, "#22202c");
    var o = '<path d="' + legs + '" fill="none" stroke="' + INK + '" stroke-width="4.6" stroke-linecap="round"/><path d="' + legs + '" fill="none" stroke="' + fur + '" stroke-width="2.4" stroke-linecap="round"/>';
    return o;
  }
  function catWalk(P) {
    var fur = P.night ? "#262236" : Lc(P, "#2e2a38"), shd = Sc(P, "#22202c");
    var frames = [
      "M-8,-14 L-12,0 M-2,-14 L2,0 M22,-14 L18,0 M28,-14 L32,0",
      "M-8,-14 L-8,0 M-2,-14 L-4,0 M22,-14 L24,0 M28,-14 L26,0",
      "M-8,-14 L-4,0 M-2,-14 L-8,0 M22,-14 L28,0 M28,-14 L22,0",
      "M-8,-14 L-6,0 M-2,-14 L0,0 M22,-14 L20,0 M28,-14 L30,0"
    ];
    var o = '<g class="o-cat-walk"><g class="cat-bob">';
    frames.forEach(function (f, i) { o += '<g class="cw cw' + i + '">' + catFrame(P, f) + "</g>"; });
    o += '<path d="M30,-18 C42,-20 46,-30 40,-38" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M30,-18 C42,-20 46,-30 40,-38" fill="none" stroke="' + fur + '" stroke-width="2.8" stroke-linecap="round"/>';
    o += '<path d="M-10,-16 Q-12,-26 0,-26 L24,-26 Q34,-24 32,-14 Q30,-10 22,-10 L-4,-10 Q-10,-10 -10,-16 Z" fill="' + fur + '"' + ink(1.6) + "/>";
    o += '<path d="M-4,-11 L24,-11 Q30,-12 31,-15 L31,-12 Q28,-9 22,-9 L-4,-9 Z" fill="' + shd + '"/>';
    o += '<path d="M-22,-24 L-22,-33 L-17,-28 L-11,-28 L-6,-33 L-6,-24 Q-6,-16 -14,-16 Q-22,-16 -22,-24 Z" fill="' + fur + '"' + ink(1.6) + "/>";
    if (P.lit) o += '<g class="cat-eyes">' + El(-18, -24, 1.6, 1.2, "#d6f25a") + El(-11, -24, 1.6, 1.2, "#d6f25a") + "</g>";
    return o + "</g></g>";
  }

  function leavesCels(P) {
    var cols = ["#c8733a", "#a85a28", "#d98a3c", "#b8692e", "#9a8a3a", "#c8733a"], o = '<g class="o-leaves">';
    [760, 812, 860, 730, 900, 790].forEach(function (y, i) {
      o += '<g style="animation-delay:-' + (i * 1.3).toFixed(1) + 's"><path d="M0,' + y + ' q6,-7 12,0 q-6,7 -12,0 Z" fill="' + Lc(P, cols[i]) + '"' + ink(1) + "/></g>";
    });
    return o + "</g>";
  }

  // ---- the car that drives past now and then: a boxy 90s sedan, on twos ----
  function passerCel(P) {
    var body = "#3f8f8a", bl = Lc(P, body), bs = Sc(P, body), bt = Tc(P, cmix(body, "#ffffff", .25)), lit = P.lit;
    var glass = P.mode === "day" || P.mode === "golden" ? Lc(P, "#43546a") : Sc(P, "#43546a"), chrome = Lc(P, "#d6d8de");
    var s = '<g transform="translate(0,1050)">';
    s += El(300, 4, 300, 12, "#100e16", op(".4"));
    if (lit) s += '<g class="o-beam">' + Pg([590, -62, 1020, -110, 1060, -4, 600, -40], "#fff6cc", op(".16")) + Pg([590, -60, 900, -86, 930, -24, 598, -44], "#fff6cc", op(".16")) + "</g>";
    var shape = "M8,-36 L10,-74 Q12,-92 30,-96 L120,-104 L176,-156 Q184,-162 196,-162 L352,-162 Q364,-162 372,-156 L438,-106 L560,-98 Q588,-96 592,-80 L596,-40 Q596,-24 584,-22 L20,-22 Q8,-22 8,-36 Z";
    s += '<path d="' + shape + '" fill="' + bl + '"/>';
    s += '<path d="M10,-62 L596,-56 L596,-40 Q596,-24 584,-22 L20,-22 Q8,-22 8,-36 Z" fill="' + bs + '"/>';
    s += '<path d="M14,-88 Q20,-96 40,-98 L560,-92" fill="none" stroke="' + bt + '" stroke-width="5" stroke-linecap="round"/>';
    s += '<path d="' + shape + '" fill="none"' + ink(2.4) + "/>";
    s += '<path d="M184,-150 Q190,-155 200,-155 L268,-155 L268,-108 L134,-106 Z M280,-155 L350,-155 Q360,-155 366,-150 L420,-108 L280,-108 Z" fill="' + glass + '"' + ink(1.8) + "/>";
    s += Pg([200, -155, 214, -155, 172, -107, 158, -107], "#ffffff", op(".35")) + Pg([300, -155, 320, -155, 290, -108, 270, -108], "#ffffff", op(".25"));
    s += '<path d="M312,-108 Q308,-138 326,-140 Q344,-140 342,-118 L340,-108 Z" fill="' + (lit ? "#1a1824" : Sc(P, "#3a2e2a")) + '" fill-opacity=".85"/>';
    s += Ln(274, -152, 274, -40, INK, 1.6) + Ln(430, -100, 434, -40, INK, 1.4) + Ln(126, -100, 122, -42, INK, 1.4);
    s += R(296, -88, 22, 5, chrome) + R(458, -84, 22, 5, chrome);
    s += '<path d="M2,-44 L2,-30 Q2,-20 14,-20 L46,-20 L46,-44 Z M600,-46 L600,-30 Q600,-20 590,-20 L556,-20 L556,-46 Z" fill="' + chrome + '"' + ink(1.6) + "/>";
    s += '<rect x="580" y="-82" width="14" height="14" rx="2" fill="' + (lit ? "#fff7d6" : Lc(P, "#f1ead2")) + '"' + ink(1.2) + "/>" + '<rect x="6" y="-82" width="10" height="16" rx="2" fill="' + (lit ? "#ff4a4a" : Lc(P, "#b8272e")) + '"' + ink(1.2) + "/>";
    if (lit) s += El(8, -74, 22, 14, "#ff3a3a", op(".25")) + El(592, -74, 28, 18, "#fff3c0", op(".3"));
    [[128, 0], [470, 0]].forEach(function (w) {
      s += Pt("M" + (w[0] - 58) + ",-22 Q" + (w[0] - 56) + ",-82 " + w[0] + ",-84 Q" + (w[0] + 56) + ",-82 " + (w[0] + 58) + ",-22 Z", "#18161e");
      s += '<g transform="translate(' + w[0] + ',-20)">' + Ci(0, 0, 40, "#1c1a22", ink(2)) + Ci(0, 0, 25, chrome, ink(1.4)) +
        '<g class="hub">' + [0, 60, 120, 180, 240, 300].map(function (a) { return '<rect x="-3" y="-21" width="6" height="10" rx="3" fill="' + Sc(P, "#5e6070") + '" transform="rotate(' + a + ')"/>'; }).join("") + "</g>" +
        Ci(0, 0, 9, Lc(P, "#eceef2"), ink(1)) + Ci(0, 0, 3, Sc(P, "#8a8c96")) + "</g>";
    });
    s += "</g>";
    return '<g id="oPasser"><g class="o-pass">' + s + "</g></g>";
  }

  // ---- seasonal dressing ----
  var XMAS_COLS = ["#ff4b4b", "#3ddc84", "#ffd84d", "#4da3ff", "#ff8a3d"];
  function lightString(x0, x1, y, segs, sag, per, lit) {
    var w = (x1 - x0) / segs, wire = "M" + x0 + "," + y, bulbs = "", n = 0;
    for (var i = 0; i < segs; i++) {
      var a = x0 + i * w;
      wire += " Q" + n1(a + w / 2) + "," + (y + sag * 2) + " " + n1(a + w) + "," + y;
      for (var j = 1; j <= per; j++) {
        var t = j / (per + 1), bx = a + w * t, by = y + 2 * t * (1 - t) * sag * 2, col = XMAS_COLS[n % XMAS_COLS.length];
        bulbs += '<g class="xb t' + (n % 3 + 1) + '">' + (lit ? Ci(bx, by + 6, 11, col, op(".28")) : "") + R(bx - 1.6, by, 3.2, 3, INK) + El(bx, by + 7, 3.4, 5, col, ink(.8)) + "</g>";
        n++;
      }
    }
    return '<path d="' + wire + '" stroke="#1d2a1d" stroke-width="1.6" fill="none"/>' + bulbs;
  }
  function wreath(cx, cy) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="14" fill="none" stroke="' + INK + '" stroke-width="10.5"/><circle cx="' + cx + '" cy="' + cy + '" r="14" fill="none" stroke="#2f7a3a" stroke-width="8"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="14" fill="none" stroke="#5aa35e" stroke-width="3" stroke-dasharray="3 5"/>' +
      Ci(cx - 9, cy - 10, 2.4, "#e23b3b") + Ci(cx + 10, cy - 7, 2.4, "#e23b3b") + Ci(cx + 7, cy + 10, 2.4, "#e23b3b") +
      '<path d="M' + cx + "," + (cy + 14) + " l-10,-6 0,12 Z M" + cx + "," + (cy + 14) + ' l10,-6 0,12 Z" fill="#d42c3a"' + ink(1) + "/>";
  }
  function pumpkin(P, x, y, sc) {
    var face = P.lit ? "#ffd34d" : "#7a3d14";
    return '<g transform="translate(' + x + "," + y + ") scale(" + sc + ')">' + (P.lit ? '<g class="o-candle">' + El(0, -2, 40, 26, "#ffb347", op(".2")) + El(0, -2, 26, 18, "#ffb347", op(".25")) + "</g>" : "") +
      El(0, 0, 19, 13, Lc(P, "#e2701c"), ink(1.6)) + '<path d="M-6,-12 Q-9,0 -6,12 M6,-12 Q9,0 6,12" fill="none" stroke="' + Sc(P, "#b9530f") + '" stroke-width="1.4"/>' +
      '<path d="M-1,-12 Q0,-19 4,-20" stroke="#4a6b2a" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path class="o-face" fill="' + face + '" d="M-11,-4 L-7,-9 L-3,-4 Z M3,-4 L7,-9 L11,-4 Z M-11,2 L-8,5 L-5,2 L-2,5 L1,2 L4,5 L7,2 L10,2 Q0,11 -11,2 Z"/></g>';
  }
  function decoCels(P) {
    var o = '<g class="o-deco-x">' + lightString(870, 1924, 462, 12, 9, 4, P.lit);
    // a little tree in the left window
    o += Pg([1074, 590, 1056, 622, 1092, 622], "#2f7a3a", ink(1.4)) + Pg([1074, 606, 1050, 646, 1098, 646], "#2f7a3a", ink(1.4)) + R(1070, 646, 8, 8, "#6b4a2a") +
      '<path d="M1074,582 l2.6,5.4 5.8,.6 -4.4,3.8 1.4,5.8 -5.4,-3 -5.4,3 1.4,-5.8 -4.4,-3.8 5.8,-.6 Z" fill="#ffd84d"' + ink(.8) + "/>" +
      Ci(1066, 616, 2.4, "#ff4b4b") + Ci(1082, 628, 2.4, "#4da3ff") + Ci(1062, 638, 2.4, "#ffd84d") + Ci(1086, 640, 2.4, "#ff4b4b") + "</g>";
    o += '<g class="o-deco-h">' + pumpkin(P, 1226, 714, 1.15) + pumpkin(P, 1196, 720, .85) + pumpkin(P, 1430, 716, 1) +
      // a paper ghost in the window
      '<path d="M1056,640 L1056,600 Q1056,580 1074,580 Q1092,580 1092,600 L1092,640 L1086,634 L1080,640 L1074,634 L1068,640 L1062,634 Z" fill="#f4f1ff"' + ink(1.4) + "/>" +
      El(1067, 600, 3, 5, INK) + El(1081, 600, 3, 5, INK) + El(1074, 614, 4, 5, INK) + "</g>";
    return o;
  }
  function signDeco(P) {
    var web = "M846,138 L780,140 M846,138 L794,172 M846,138 L816,190 M846,138 L844,200 M820,139 Q824,154 814,158 Q826,166 830,174 Q836,172 845,177 M800,140 Q808,162 802,170 Q814,182 819,187 Q830,190 844,194";
    var o = '<g class="o-deco-h"><path d="' + web + '" stroke="#f4f1ff" stroke-opacity=".65" stroke-width="1.2" fill="none"/>' +
      '<g class="spider"><line x1="858" y1="130" x2="858" y2="210" stroke="#f4f1ff" stroke-opacity=".5" stroke-width="1"/>' +
      '<path d="M852,210 l-5,-4 M852,213 l-6,1 M864,210 l5,-4 M864,213 l6,1" stroke="#1a1426" stroke-width="1.6"/><circle cx="858" cy="213" r="4.6" fill="#1a1426"/></g></g>';
    o += '<g class="o-deco-x">' + lightString(522, 856, 128, 5, 8, 3, P.lit) +
      '<g transform="translate(530,128) rotate(-16)"><path d="M-28,4 Q-10,-38 22,-30 Q34,-24 36,-8 Q26,-18 22,-12 Q26,-4 26,4 Z" fill="#d42c3a"' + ink(2) + "/>" +
      '<rect x="-32" y="0" width="62" height="11" rx="5.5" fill="#f6f3ea"' + ink(2) + '/><circle cx="37" cy="-8" r="6" fill="#f6f3ea"' + ink(2) + "/></g></g>";
    return o;
  }
  function batsCels() {
    var up = '<path d="M0,0 C-4,-8 -10,-12 -18,-12 C-14,-6 -14,-2 -16,2 C-10,0 -6,1 -4,4 C-2,2 2,2 4,4 C6,1 10,0 16,2 C14,-2 14,-6 18,-12 C10,-12 4,-8 0,0 Z" fill="#1a1426"/>';
    var dn = '<path d="M0,0 C-4,2 -10,6 -16,12 C-12,6 -10,4 -12,2 C-8,2 -6,2 -4,4 C-2,2 2,2 4,4 C6,2 8,2 12,2 C10,4 12,6 16,12 C10,6 4,2 0,0 Z" fill="#1a1426"/>';
    function bat(cls, y, sc) { return '<g class="bat ' + cls + '"><g transform="translate(0,' + y + ") scale(" + sc + ')"><g class="bw1">' + up + '</g><g class="bw2">' + dn + "</g></g></g>"; }
    return '<g class="o-bats">' + bat("b1", 210, 1.3) + bat("b2", 300, 1) + bat("b3", 150, .8) + "</g>";
  }
  function wetCels(P) {
    // splashes: little crowns that pop on the blacktop, and shimmer across the reflections
    var r = rand(149), o = '<g class="o-wetg">', spots = [];
    for (var i = 0; i < 18; i++) spots.push([40 + r() * 1840, 700 + r() * 370]);
    spots.forEach(function (s, i) {
      var sc = .6 + (s[1] - 700) / 300;
      o += '<g transform="translate(' + n1(s[0]) + "," + n1(s[1]) + ") scale(" + n1(sc) + ')"><g class="o-rip" style="animation-delay:-' + (r() * 1.2).toFixed(2) + 's">' +
        '<path d="M-7,0 L-9,-6 M-3,-1 L-3,-9 M3,-1 L4,-9 M7,0 L9,-6" stroke="#dfe7ff" stroke-width="1.4" stroke-linecap="round"/>' + El(0, 0, 9, 2.4, "none", ' stroke="#dfe7ff" stroke-width="1.2"') + "</g></g>";
    });
    if (P.lit) [[1108, 750, 100], [1494, 750, 110], [1784, 750, 90], [690, 980, 120]].forEach(function (s, i) {
      o += '<g class="o-refl" style="animation-delay:-' + (i * .37).toFixed(2) + 's">';
      for (var k = 0; k < 4; k++) o += R(s[0] - s[2] * .4 + r() * s[2] * .3, s[1] + k * 22 + r() * 8, s[2] * (.3 + r() * .3), 2, "#fff0c8", op(".45"));
      o += "</g>";
    });
    return o + "</g>";
  }


  // moon phase from the date: 0 new, .5 full; drawn lit on the side you'd see from where you are
  function moonPhase() { var p = ((Date.now() / 864e5 - 10962.7597) / 29.530588853) % 1; return p < 0 ? p + 1 : p; }
  function southern() {
    var p = prefs.wxPlace; if (p && typeof p.lat === "number") return p.lat < 0;
    return /^(Australia|Pacific\/Auckland|Antarctica|America\/(Argentina|Santiago|Sao_Paulo|Montevideo)|Africa\/(Johannesburg|Maputo))/.test(deviceZone());
  }
  function moonPath(cx, cy, r, p) {
    var waxing = p < 0.5, k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r;
    // lit limb on the right while waxing (northern view); the terminator bulges in or out
    var limb = waxing ? 1 : 0, term = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
    return "M" + cx + "," + (cy - r) + " A" + r + "," + r + " 0 0 " + limb + " " + cx + "," + (cy + r) + " A" + rx.toFixed(2) + "," + r + " 0 0 " + term + " " + cx + "," + (cy - r) + " Z";
  }

  // ---- painting the background into its canvases ----
  // a gouache tooth: soft blotches and fine grit, centred on mid-grey so 'overlay' keeps the colour
  var outKey = "", celKey = "", paintGen = 0, outReady = false;
  function paintBackdrop(P) {
    var gen = ++paintGen, left = 3, land = $("land");
    function ok() { return gen === paintGen && !!$("oPlate"); }
    function one() { if (--left) return; outReady = true; revealLanding(); }
    svgToCanvas(skySVG(P), $("oSkyC"), ok, function () { texturize($("oSkyC"), .3, false); one(); });
    svgToCanvas(cloudsSVG(P), $("oCloudA"), ok, function () {
      var a = $("oCloudA"); texturize(a, .45, true);
      try { var g = $("oCloudB").getContext("2d"); g.clearRect(0, 0, 1920, 640); g.drawImage(a, 0, 0); } catch (e) {}
      one();
    });
    svgToCanvas(plateSVG(P), $("oPlate"), ok, function () { texturize($("oPlate"), .42, true, true); one(); });
  }
  // the signs are lettered in web fonts; the fade-up waits for them (or 2.5 seconds, whichever comes first)
  var fontsReady = false;
  (function () {
    function done() { if (fontsReady) return; fontsReady = true; if (landingOn) revealLanding(); }
    try {
      if (document.fonts && document.fonts.load) {
        Promise.all([document.fonts.load("40px Caprasimo"), document.fonts.load("600 20px Oswald")]).then(done, done);
        setTimeout(done, 2500);
        return;
      }
    } catch (e) {}
    done();
  })();
  function revealLanding() {
    var land = $("land");
    if (!outReady || !fontsReady || land.classList.contains("o-ready")) return;
    // fade up from black, like the top of an act
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (landingOn || entering) land.classList.add("o-ready"); }); });
  }
  function stageHTML() {
    var ns = ' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"';
    return '<div class="land-cam" id="landCam"><div class="land-stage" id="landStage"><div class="land-weave">' +
      '<canvas id="oSkyC" class="lw-sky" width="960" height="540"></canvas>' +
      '<svg id="oBack" class="lw-l"' + ns + ' aria-hidden="true"></svg>' +
      '<div class="lw-pan"><canvas id="oCloudA" width="1920" height="640"></canvas><canvas id="oCloudB" width="1920" height="640"></canvas></div>' +
      '<svg id="oMid" class="lw-l"' + ns + ' aria-hidden="true"></svg>' +
      '<canvas id="oPlate" class="lw-l" width="1920" height="1080"></canvas>' +
      '<svg id="oSvg" class="lw-l"' + ns + ' role="img" aria-label="The outside of the video store, drawn like a 90s cartoon"></svg>' +
      "</div></div></div>";
  }
  function fitStage() {
    var st = $("landStage"); if (!st) return;
    var w = window.innerWidth || 1920, h = window.innerHeight || 1080, portrait = w / h < 1.2;
    var s = portrait ? Math.min(w / 1920 * 1.5, h / 1080) : Math.max(w / 1920, h / 1080);
    // held upright, frame the shop (its door is near x 1150) rather than shrinking the whole street to a strip;
    // the sky and the road carry on above and below in their own colours
    var tx = portrait ? Math.max(w - 1920 * s, Math.min(0, w / 2 - 1150 * s)) : (w - 1920 * s) / 2;
    st.style.transform = "translate(" + tx.toFixed(1) + "px," + ((h - 1080 * s) / 2).toFixed(1) + "px) scale(" + s.toFixed(5) + ")";
  }

  // ---- weather cels: rain drawn as streaks on a three-drawing cycle, snow as soft flakes ----
  function snowTile(size, n, seed) {
    var r = rand(seed), out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">';
    for (var i = 0; i < n; i++) {
      var x = (6 + r() * (size - 12)).toFixed(1), y = (6 + r() * (size - 12)).toFixed(1), rr = 1.6 + r() * 2.8;
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + rr.toFixed(1) + '" fill="#ffffff" fill-opacity="' + (.6 + r() * .4).toFixed(2) + '"/>' +
        '<circle cx="' + (+x + rr * .3).toFixed(1) + '" cy="' + (+y + rr * .3).toFixed(1) + '" r="' + (rr * .6).toFixed(1) + '" fill="#c9d4ee" fill-opacity=".5"/>';
    }
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out + "</svg>") + '")';
  }
  var wxTiles = false;
  function paintWxTiles() {
    if (wxTiles) return; wxTiles = true;
    var near = document.querySelector("#landWx .near i"), far = document.querySelector("#landWx .far i"), sn = document.querySelector("#landWx .wx-snow i");
    if (near) near.style.backgroundImage = dropTile(320, 22, 26, 52, 2.2, .3, .6, 31);
    if (far) far.style.backgroundImage = dropTile(220, 40, 12, 26, 1.4, .22, .5, 57);
    if (sn) sn.style.backgroundImage = snowTile(260, 30, 77);
    var gr = $("landGrain"); if (gr && !gr.style.backgroundImage) gr.style.backgroundImage = "url(" + grainTexture() + ")";
  }
  // ---- the film: now and then a fleck of dust or a hair rides through the gate for a frame or two ----
  var dustT = null;
  function filmDust() {
    clearTimeout(dustT);
    if (!landingOn || isCalm()) return;
    dustT = setTimeout(function () {
      var box = $("landDust");
      if (box && landingOn && !entering) {
        var n = Math.random() < .3 ? 2 : 1;
        for (var i = 0; i < n; i++) {
          var el = box.children[i], k = Math.random(), sz = 2 + Math.random() * 5;
          el.className = k < .55 ? "dk" : k < .85 ? "wt" : "hair";
          el.style.left = (Math.random() * 96 + 2).toFixed(1) + "%"; el.style.top = (Math.random() * 90 + 4).toFixed(1) + "%";
          el.style.width = el.className === "hair" ? "" : sz.toFixed(1) + "px"; el.style.height = el.className === "hair" ? "" : (sz * (.6 + Math.random() * .6)).toFixed(1) + "px";
          el.style.transform = "rotate(" + (Math.random() * 360 | 0) + "deg)";
        }
        setTimeout(function () { for (var j = 0; j < box.children.length; j++) box.children[j].className = ""; }, 84 + (Math.random() < .5 ? 84 : 0));
      }
      filmDust();
    }, 900 + Math.random() * 2600);
  }

  function fitText(id, text, maxW, perChar) {
    var el = $(id); if (!el) return;
    el.textContent = text;
    if (text.length * perChar > maxW) { el.setAttribute("textLength", maxW); el.setAttribute("lengthAdjust", "spacingAndGlyphs"); }
    else { el.removeAttribute("textLength"); el.removeAttribute("lengthAdjust"); }
  }
  function updateLanding() {
    var land = $("land"), mk = outsideMode(), wx = wxKind(), P = outLook(mk, wx), lit = P.lit, wet = P.wet;
    if (!$("landStage")) { $("landZoom").innerHTML = stageHTML(); outKey = celKey = ""; outReady = false; }
    fitStage();
    paintWxTiles();
    var ry = rewindYear(), lk = mk + "|" + wx + "|" + ry;
    if (outKey !== lk) { outKey = lk; paintBackdrop(P); }
    if (celKey !== lk + shiftNow()) {
      celKey = lk + shiftNow();
      $("oBack").innerHTML = backCels(P); $("oMid").innerHTML = midCels(); $("oSvg").innerHTML = frontCels(P);
      var cw = land.querySelector(".o-cat-walk"); if (cw) { cw.style.animation = "none"; void cw.getBoundingClientRect(); cw.style.animation = ""; }
    }
    revealLanding();
    land.setAttribute("data-mode", mk); land.setAttribute("data-wx", wx); land.setAttribute("data-wet", wet ? "1" : "0");
    land.setAttribute("data-lit", lit ? "1" : "0"); land.setAttribute("data-deco", decoKind());
    land.style.setProperty("--o-s0", P.sky[0][1]); land.style.setProperty("--o-road", cmul(OB.road, P.amb));
    var hr = new Date().getHours(), windy = isWindy();
    land.setAttribute("data-windy", windy ? "1" : "0");
    // upstairs windows over the back fence: most lit in the evening, fewer as it gets late (a different few each night)
    var frac = !lit ? 0 : hr >= 23 ? 0.35 : hr >= 22 ? 0.55 : hr >= 17 ? 0.85 : hr < 1 ? 0.2 : hr < 6 ? 0.1 : 0.4, dayKey = new Date().toDateString();
    Array.prototype.forEach.call(land.querySelectorAll(".o-hw"), function (w, i) { w.classList.toggle("off", (hash("w" + i * 7919 + "|" + dayKey) % 997) / 997 >= frac); });
    var mp = $("oMoonLit"); if (mp) { mp.setAttribute("d", moonPath(1540, 150, 30, moonPhase())); mp.setAttribute("transform", southern() ? "matrix(-1 0 0 1 3080 0)" : ""); }
    if (amb && (amb.wx !== wx || amb.mode !== mk || amb.windy !== windy)) { stopAmbience(); startAmbience(); }
    if (landingOn && wx !== lastWx) { lastWx = wx; landLoops(); }
    refreshWeather();
    // the signs carry the store's name
    var words = prefs.storeName.trim().split(/\s+/), last = words.length > 1 ? words.pop() : words[0];
    var first = words.length && words[0] !== last ? words.join(" ") : "";
    fitText("oName1", first.toUpperCase(), 290, 23);
    fitText("oName2", last.toUpperCase(), 292, 46);
    $("oName2").setAttribute("y", first ? "288" : "262");
    ["oFascia", "oFasciaSh", "oFasciaHalo"].forEach(function (id) { fitText(id, prefs.storeName, 610, 34); });
    var closed = storeClosed();
    var top = aisleList("new")[0];
    var nm = top ? top.name.toUpperCase() : "";
    if (nm.length > 22) nm = nm.slice(0, 21) + "…";
    fitText("oMq1", closed ? "SORRY, WE'RE CLOSED" : (nm ? "NEW: " + nm : "NEW THIS WEEK"), 262, 13);
    fitText("oMq2", ry ? "REWIND NIGHT · " + ry : closed ? "NIGHT DROP OPEN" : (season ? season.aisle.toUpperCase() : "OPEN TIL MIDNIGHT"), 262, 13);
    fitText("oMq3", ry ? eraFormat(ry) : "BE KIND · REWIND", 262, 11);
    var ob = $("oBand"); if (ob) ob.textContent = ry ? "REWIND NIGHT · IT'S " + ry : "MOVIES · TV · LATE NIGHT";
    var on = $("oOpen");
    if (on.getAttribute("data-w") !== (closed ? "c" : "o")) {
      while (on.firstChild) on.removeChild(on.firstChild);
      if (closed) { on.textContent = "CLOSED"; on.setAttribute("font-size", "19"); }
      else {
        // one tired letter in the OPEN sign
        on.setAttribute("font-size", "25");
        on.appendChild(document.createTextNode("OP"));
        var bad = document.createElementNS("http://www.w3.org/2000/svg", "tspan"); bad.setAttribute("class", "n-bad"); bad.textContent = "E";
        on.appendChild(bad); on.appendChild(document.createTextNode("N"));
      }
      on.setAttribute("data-w", closed ? "c" : "o");
    }
    // the same clock as the Strip and the bar: "11:21 am" (no weekday: the shops are named for Friday and Saturday)
    var d = new Date(), h = d.getHours(), m = d.getMinutes(), days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    $("landClock").textContent = ry ? "8:00 pm · " + ry : ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " am" : " pm");
    // the same key-cap hints as the Strip and the bar's doorstep
    var tap = ("ontouchstart" in window) && !window.tizen;
    $("landPress").innerHTML = '<span class="fsn-h"><kbd>' + (tap ? "TAP" : "OK") + "</kbd>" + (ry ? "step back into " + ry : closed ? "sneak in" : "go inside") + "</span>" +
      '<span class="fsn-h" id="goKaraoke" style="cursor:pointer;pointer-events:auto"><kbd>►</kbd>karaoke next door</span>' + (tap ? "" : '<span class="fsn-h"><kbd>BACK</kbd>the street</span>');
    var gk = $("goKaraoke"); if (gk) gk.addEventListener("click", function (ev) { ev.stopPropagation(); FSN.go("karaoke"); });
  }

  // ---- live weather from Open-Meteo (free, no account) ----
  var wxNow = store("fnv-wx", null, function (w) { return numIn(w.t, 0, 1e13) && typeof w.key === "string" ? w : null; }), wxBusy = false;
  var WX_MODES = ["live", "clear", "drizzle", "rain", "storm", "fog", "snow"];
  var WX_WORDS = { clear: "clear skies", cloudy: "a few clouds", overcast: "grey and overcast", drizzle: "drizzle", rain: "rain", storm: "a thunderstorm", fog: "fog", snow: "snow" };
  var WX_TONE = { day: { sky: "#9aa4b4", cloud: "#cdd2dc" }, golden: { sky: "#9b8f98", cloud: "#bcaeb3" }, sunset: { sky: "#5b4d6c", cloud: "#7d6880" }, night: { sky: "#14162a", cloud: "#2b2c42" } };
  function codeKind(code, precip) {
    if (code == null) return "clear";
    if (code >= 95) return "storm";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if (code >= 51 && code <= 57) return "drizzle";
    if (code === 45 || code === 48) return "fog";
    if (code === 3) return "overcast";
    if (code === 2) return "cloudy";
    return "clear";
  }
  function placeKey(p) { return p ? p.lat.toFixed(2) + "," + p.lon.toFixed(2) : ""; }
  function wxKind() {
    var m = prefs.wxMode || "live";
    if (m !== "live") return m;
    if (wxNow && wxNow.key === placeKey(prefs.wxPlace) && Date.now() - wxNow.t < 3 * 3600 * 1000) return codeKind(wxNow.code, wxNow.precip);
    return "clear";
  }
  function deviceZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } }
  function geocode(name) {
    var tz = deviceZone();
    return getJSON("https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=" + encodeURIComponent(name), 8000).then(function (j) {
      var rs = j.results || [], pick = rs.filter(function (r) { return r.timezone === tz; })[0] || rs[0];
      return pick ? { name: pick.name, admin: pick.admin1 || pick.country || "", lat: pick.latitude, lon: pick.longitude } : null;
    });
  }
  function ensurePlace() {
    if (prefs.wxPlace) return Promise.resolve(prefs.wxPlace);
    var city = (deviceZone().split("/").pop() || "").replace(/_/g, " ");
    if (!city || /^UTC|GMT/.test(city)) return Promise.resolve(null);
    return geocode(city).then(function (p) { if (p) { p.auto = true; prefs.wxPlace = p; save("fnv-prefs", prefs); } return p; });
  }
  var wxFailAt = 0;
  function refreshWeather(force) {
    // checked even when the weather is pinned, for the real sunrise and sunset times
    if (wxBusy) return;
    if (!force && wxFailAt && Date.now() - wxFailAt < 10 * 60 * 1000) return;
    if (!force && wxNow && wxNow.key === placeKey(prefs.wxPlace) && Date.now() - wxNow.t < 20 * 60 * 1000) return;
    wxBusy = true;
    ensurePlace().then(function (p) {
      if (!p) { wxFailAt = Date.now(); return; }
      return getJSON("https://api.open-meteo.com/v1/forecast?latitude=" + p.lat + "&longitude=" + p.lon + "&current=weather_code,precipitation,cloud_cover,wind_speed_10m&daily=sunrise,sunset&forecast_days=1&timezone=auto", 8000).then(function (j) {
        var c = j.current || {}, d = j.daily || {};
        function mins(iso) { var m = /T(\d\d):(\d\d)/.exec(iso || ""); return m ? +m[1] * 60 + +m[2] : null; }
        wxNow = { t: Date.now(), code: c.weather_code, precip: c.precipitation, cloud: c.cloud_cover, wind: c.wind_speed_10m, key: placeKey(p),
                  rise: mins((d.sunrise || [])[0]), set: mins((d.sunset || [])[0]) };
        save("fnv-wx", wxNow); wxFailAt = 0;
        if (landingOn) updateLanding();
        if (modal && modal.view === "outside") outsidePanel(modal.idx);
      });
    }).catch(function () { wxFailAt = Date.now(); }).then(function () { wxBusy = false; });
  }
  function decoKind() {
    var d = prefs.deco || "auto";
    if (d !== "auto") return d;
    var m = new Date().getMonth();
    return m === 9 ? "halloween" : m === 11 ? "xmas" : "none";
  }

  // ---- things that happen now and then while you're outside ----
  var neonT = null, boltT = null, lastWx = "";
  function landLoops() {
    clearTimeout(neonT); clearTimeout(boltT);
    if (!landingOn) return;
    if (isCalm()) return;
    neonT = setTimeout(function stutter() {
      if (!landingOn) return;
      var g = document.querySelector("#oSvg .o-neon");
      if (g) { g.classList.remove("stutter"); void g.getBoundingClientRect(); g.classList.add("stutter"); }
      if (amb && ac) { var f = burst(0.35, "bandpass", 2400, 0.035); tone(100, 0, 0.32, 0.018, "sawtooth"); }
      neonT = setTimeout(stutter, 4000 + Math.random() * 9000);
    }, 2500 + Math.random() * 4000);
    if (wxKind() === "storm") boltT = setTimeout(function strike() {
      if (!landingOn) return;
      var el = $("wxBolt");
      if (el) { el.classList.remove("go"); void el.offsetWidth; el.classList.add("go"); }
      var bo = $("oBolt");
      // over the houses it can reach down behind the trees; over the shops it stops at the roofline
      var low = Math.random() < .45, bx = low ? 150 + Math.random() * 320 : 960 + Math.random() * 820, by = low ? 120 + Math.random() * 40 : 84 + Math.random() * 16, bs = low ? 1.75 : 1;
      if (bo) { bo.setAttribute("transform", "translate(" + (bx | 0) + "," + (by | 0) + ") scale(" + (Math.random() < .5 ? -bs : bs) + "," + bs + ")"); bo.classList.remove("go"); void bo.getBoundingClientRect(); bo.classList.add("go"); }
      if (amb && ac) setTimeout(function () { if (!amb) return; burst(4, "lowpass", 110, 0.4); burst(1.4, "lowpass", 380, 0.14); }, 500 + Math.random() * 1600);
      boltT = setTimeout(strike, 6000 + Math.random() * 10000);
    }, 2500 + Math.random() * 4000);
  }
  var shootT = null;
  function shootingStars() {
    clearTimeout(shootT);
    if (isCalm()) return;
    shootT = setTimeout(function () {
      if (!landingOn) return;
      var land = $("land"), g = $("oShoot");
      if (g && outsideMode() === "night" && land.getAttribute("data-wx") === "clear") {
        g.setAttribute("transform", "translate(" + (500 + Math.random() * 1200).toFixed(0) + "," + (60 + Math.random() * 200).toFixed(0) + ")");
        g.classList.remove("go"); void g.getBoundingClientRect(); g.classList.add("go");
      }
      shootingStars();
    }, 20000 + Math.random() * 40000);
  }
  function stopLandLoops() { clearTimeout(neonT); clearTimeout(boltT); clearTimeout(shootT); clearTimeout(dustT); }
  // a soft sound routed through the ambience bus, optionally panned
  function ptone(freq, start, dur, vol, pan, dest, glide) {
    var o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + start;
    o.type = "sine"; o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.linearRampToValueAtTime(freq * glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.04, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var node = g;
    if (ac.createStereoPanner) { var p = ac.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); node = p; }
    o.connect(g); node.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function landStatus(text) { var el = $("landStatus"); if (el) el.textContent = text; }
  function passBy() {
    clearTimeout(passerT);
    if (!landingOn) return;
    var g = $("oPasser");
    if (g) {
      g.classList.remove("drive"); void g.getBoundingClientRect(); g.classList.add("drive");
      if (!g.getAttribute("data-wired")) { g.setAttribute("data-wired", "1"); g.addEventListener("animationend", function () { g.classList.remove("drive"); }); }
      if (prefs.sound && ac && ac.state === "running" && amb) carPass();
    }
    passerT = setTimeout(passBy, 16000 + Math.random() * 20000);
  }
  function carPass() {
    // the car is on screen from about 1.5s to 5.7s of its 7s drive; loudest and brightest as it passes the middle
    var t0 = ac.currentTime, src = ac.createBufferSource(); src.buffer = noiseBuffer(7);
    var lp = ac.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(220, t0); lp.frequency.linearRampToValueAtTime(620, t0 + 3.6); lp.frequency.linearRampToValueAtTime(240, t0 + 6.4);
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + 1.4);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 3.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 6.8);
    src.connect(lp); lp.connect(g);
    if (ac.createStereoPanner) { var pn = ac.createStereoPanner(); pn.pan.setValueAtTime(-1, t0 + 1.2); pn.pan.linearRampToValueAtTime(1, t0 + 6); g.connect(pn); pn.connect(amb.out); }
    else g.connect(amb.out);
    src.start(t0); src.stop(t0 + 7);
    // tyres on a wet road
    if (amb.wx === "drizzle" || amb.wx === "rain" || amb.wx === "storm") {
      var ws = ac.createBufferSource(); ws.buffer = noiseBuffer(7);
      var whp = ac.createBiquadFilter(); whp.type = "highpass"; whp.frequency.value = 2200;
      var wg = ac.createGain(); wg.gain.setValueAtTime(0.0001, t0); wg.gain.exponentialRampToValueAtTime(0.012, t0 + 1.6); wg.gain.exponentialRampToValueAtTime(0.09, t0 + 3.6); wg.gain.exponentialRampToValueAtTime(0.0001, t0 + 6.6);
      ws.connect(whp); whp.connect(wg);
      if (ac.createStereoPanner) { var wpn = ac.createStereoPanner(); wpn.pan.setValueAtTime(-1, t0 + 1.2); wpn.pan.linearRampToValueAtTime(1, t0 + 6); wg.connect(wpn); wpn.connect(amb.out); } else wg.connect(amb.out);
      ws.start(t0, 0.5); ws.stop(t0 + 7);
    }
  }
  // a tram bell a few streets away
  function tramBell(out) {
    var pan = Math.random() * 1.2 - 0.6;
    [0, 0.32].forEach(function (d) { ptone(1250, d, 0.9, 0.012, pan, out); ptone(3120, d, 0.45, 0.004, pan, out); ptone(1870, d, 0.6, 0.003, pan, out); });
  }
  // a dog somewhere down the street: woof, woof
  function dogBark(out) {
    var pan = Math.random() < 0.5 ? -0.7 : 0.65, n = 2 + (Math.random() * 2 | 0);
    for (var i = 0; i < n; i++) {
      var t0 = ac.currentTime + i * 0.32, o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(420, t0); o.frequency.exponentialRampToValueAtTime(240, t0 + 0.13);
      lp.type = "lowpass"; lp.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.022, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.connect(lp); lp.connect(g);
      if (ac.createStereoPanner) { var p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(out); } else g.connect(out);
      o.start(t0); o.stop(t0 + 0.2);
      roomNoise(out, 0.12, "bandpass", 700, 0.012, i * 0.32, pan);
    }
  }
  // the pole sign creaking in the wind
  function signCreak(out) {
    var t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), bp = ac.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.setValueAtTime(190, t0); o.frequency.linearRampToValueAtTime(150, t0 + 0.6);
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.012, t0 + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    o.connect(bp); bp.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.75);
  }
  // summer evening cicadas: a buzzing chorus that swells and fades, left and right
  function cicadas(out, timers, nodes) {
    [-0.6, 0.55].forEach(function (pan, i) {
      var n = ac.createBufferSource(); n.buffer = noiseBuffer(8); n.loop = true;
      var bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 4500 + i * 600; bp.Q.value = 7;
      var am = ac.createGain(); am.gain.value = 0.5;
      var lfo = ac.createOscillator(); lfo.frequency.value = 90 + i * 14; var lg = ac.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
      var sw = ac.createGain(); sw.gain.value = 0.002;
      n.connect(bp); bp.connect(am); am.connect(sw);
      if (ac.createStereoPanner) { var p = ac.createStereoPanner(); p.pan.value = pan; sw.connect(p); p.connect(out); } else sw.connect(out);
      n.start(ac.currentTime, Math.random() * 4); lfo.start(); nodes.push(n, lfo);
      (function swell() {
        timers.push(setTimeout(function () {
          if (!amb) return;
          sw.gain.setTargetAtTime(0.03 + Math.random() * 0.02, ac.currentTime, 1.2);
          timers.push(setTimeout(function () { if (amb) sw.gain.setTargetAtTime(0.003, ac.currentTime, 1.4); }, 2500 + Math.random() * 3000));
          swell();
        }, 5000 + Math.random() * 6000 + i * 1500));
      })();
    });
  }
  function startAmbience() {
    if (!prefs.sound || amb || !audioReady()) return;
    var mode = outsideMode(), wx = wxKind(), wet = wx === "drizzle" || wx === "rain" || wx === "storm", night = mode === "night" || mode === "sunset";
    var out = ac.createGain(); out.gain.value = 0; out.connect(buses().room);
    out.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5);
    var nodes = [];
    // distant traffic
    var n = ac.createBufferSource(); n.buffer = noiseBuffer(2); n.loop = true;
    var lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 240;
    var g = ac.createGain(); g.gain.value = 0.05; n.connect(lp); lp.connect(g); g.connect(out); n.start(); nodes.push(n);
    // rain on the lot
    if (wet) {
      var rn = ac.createBufferSource(); rn.buffer = noiseBuffer(3); rn.loop = true;
      var hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 450;
      var rl = ac.createBiquadFilter(); rl.type = "lowpass"; rl.frequency.value = wx === "drizzle" ? 1800 : 2800;
      var rg = ac.createGain(); rg.gain.value = wx === "drizzle" ? 0.022 : wx === "storm" ? 0.085 : 0.055;
      rn.connect(hp); hp.connect(rl); rl.connect(rg); rg.connect(out); rn.start(); nodes.push(rn);
    }
    // the neon sign's hum
    if (mode !== "day") {
      var nb = ac.createOscillator(); nb.type = "sawtooth"; nb.frequency.value = 100;
      var bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 3;
      var ng = ac.createGain(); ng.gain.value = 0.004; nb.connect(bp); bp.connect(ng); ng.connect(out); nb.start(); nodes.push(nb);
    }
    var timers = [], month = new Date().getMonth(), summer = month === 11 || month === 0 || month === 1, hour = new Date().getHours();
    var windy = isWindy();
    // summer evenings belong to the cicadas; the crickets take over once it's properly dark
    var cicadaTime = summer && !wet && (mode === "golden" || mode === "sunset");
    if (cicadaTime) cicadas(out, timers, nodes);
    // crickets, left and right (they go quiet in the rain)
    var iv = mode === "day" || wet || wx === "snow" || cicadaTime ? null : setInterval(function () {
      if (!amb || Math.random() < 0.35) return;
      var f = 4300 + Math.random() * 500, pan = Math.random() * 1.4 - 0.7, k = 3 + (Math.random() * 2 | 0);
      for (var i = 0; i < k; i++) ptone(f, i * 0.048, 0.028, 0.014, pan, out);
    }, 640);
    // a boobook owl somewhere down the street
    var owlT = null;
    if (night && !wet) (function owl() {
      owlT = setTimeout(function () {
        if (!amb) return;
        var pan = Math.random() < 0.5 ? -0.5 : 0.45, reps = 2 + (Math.random() * 3 | 0);
        for (var r = 0; r < reps; r++) { ptone(590, r * 1.15, 0.2, 0.022, pan, out, 0.94); ptone(480, r * 1.15 + 0.3, 0.26, 0.02, pan, out, 0.93); }
        owl();
      }, 14000 + Math.random() * 30000);
    })();
    // trams a few streets over (until about midnight), dogs in the evening, the sign creaking when it's windy
    (function trams() { timers.push(setTimeout(function () { if (!amb) return; var h = new Date().getHours(); if (h >= 6 || h < 1) tramBell(out); trams(); }, 40000 + Math.random() * 60000)); })();
    if (mode !== "day" && !wet) (function dogs() { timers.push(setTimeout(function () { if (!amb) return; dogBark(out); dogs(); }, 70000 + Math.random() * 90000)); })();
    if (windy) (function creaks() { timers.push(setTimeout(function () { if (!amb) return; signCreak(out); creaks(); }, 8000 + Math.random() * 12000)); })();
    // drips off the awning
    var dripIv = wet ? setInterval(function () { if (amb && Math.random() < 0.6) ptone(2200 + Math.random() * 1800, 0, 0.05, 0.012, Math.random() * 1.2 - 0.6, out, 0.7); }, 380) : null;
    amb = { out: out, nodes: nodes, iv: iv, owlT: function () { return owlT; }, dripIv: dripIv, wx: wx, mode: mode, windy: windy, timers: timers };
  }
  function stopAmbience() {
    if (!amb) return;
    var a = amb; amb = null; clearInterval(a.iv); clearInterval(a.dripIv); clearTimeout(a.owlT()); (a.timers || []).forEach(clearTimeout);
    try { a.out.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3); } catch (e) {}
    setTimeout(function () { a.nodes.forEach(function (x) { try { x.stop(); } catch (e) {} }); }, 400);
  }
  function showLanding(force) {
    if (prefs.outside === "skip" && !force) return false;
    landingOn = true; entering = false;
    clearTimeout(passerT);
    var pg0 = $("oPasser"); if (pg0) pg0.classList.remove("drive");
    var land = $("land"); land.hidden = false; land.className = "land";
    irisOff();
    if (!isCalm()) land.classList.add("cam-in");
    updateLanding();
    // the stray cat turns up about half the time: sitting on the returns box, or wandering past
    var cr = Math.random(), wetNow = land.getAttribute("data-wet") === "1";
    land.setAttribute("data-cat", wetNow ? "none" : cr < 0.3 ? "sit" : cr < 0.5 ? "walk" : "none");
    var cw = land.querySelector(".o-cat-walk"); if (cw) { cw.style.animation = "none"; void cw.getBoundingClientRect(); cw.style.animation = ""; }
    // at dusk the streetlight flickers on a moment after you arrive
    if (outsideMode() === "sunset") {
      land.classList.add("lamp-off");
      setTimeout(function () {
        if (!landingOn) return;
        land.classList.remove("lamp-off"); land.classList.add("lamp-warm");
        if (amb && ac) { tone(100, 0, 1.6, 0.012, "sawtooth"); burst(0.08, "highpass", 3000, 0.04); later([310, 760], function () { burst(0.06, "highpass", 3000, 0.035); }); }
        setTimeout(function () { land.classList.remove("lamp-warm"); }, 2700);
      }, 1800 + Math.random() * 1500);
    }
    stopHum(); $("tvFrame").innerHTML = ""; clearTimeout(trailerTimer);
    startAmbience();
    passerT = setTimeout(passBy, 2500);
    lastWx = wxKind(); landLoops(); shootingStars(); filmDust();
    return true;
  }
  // a stepped iris: a black card with a round hole, redrawn a dozen times a second (a handful of repaints, not a smooth animation)
  function irisMax(cx, cy) { var W = window.innerWidth, H = window.innerHeight; return Math.sqrt(Math.pow(Math.max(cx, W - cx), 2) + Math.pow(Math.max(cy, H - cy), 2)) + 4; }
  function irisRun(cx, cy, from, to, ms, done) {
    var el = $("iris"), steps = Math.max(2, Math.round(ms / 83)), i = 0;
    el.classList.add("on");
    function paint(rad) {
      el.style.background = rad <= 0.5 ? "#0b0710" : "radial-gradient(circle at " + Math.round(cx) + "px " + Math.round(cy) + "px, rgba(11,7,16,0) " + Math.round(rad) + "px, #0b0710 " + Math.round(rad + 1.5) + "px)";
    }
    (function step() {
      var t = i / steps, e = t * t * (3 - 2 * t);
      paint(from + (to - from) * e);
      if (i++ < steps) setTimeout(step, 83); else if (done) done();
    })();
  }
  function irisOff() { var el = $("iris"); el.classList.remove("on"); el.style.background = ""; }
  function enterStore() {
    if (!landingOn || entering) return;
    entering = true;
    var land = $("land"), door = $("oDoor"), zoom = $("landZoom"), cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    land.classList.remove("cam-in");
    try {
      var r = door.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      zoom.style.transformOrigin = cx + "px " + cy + "px";
    } catch (e) {}
    land.classList.add("door-open");
    sfx("chime");
    function inside() {
      landingOn = false; entering = false; clearTimeout(passerT); stopLandLoops();
      var pg1 = $("oPasser"); if (pg1) pg1.classList.remove("drive");
      land.hidden = true; land.className = "land"; zoom.style.transformOrigin = "";
      stopAmbience();
      if (prefs.sound) startHum();
      lastInput = Date.now(); tvCurrent = null; applyFocus(true); noteShown(aisle);
      refreshLibraryQuietly(10 * 60000);   // been a while: pick up anything you watched elsewhere
    }
    if (isCalm()) { setTimeout(inside, 300); return; }
    setTimeout(function () { land.classList.add("entering"); }, 240);
    setTimeout(function () {
      irisRun(cx, cy, irisMax(cx, cy), 0, 500, function () {
        inside();
        setTimeout(function () {
          var mx = window.innerWidth / 2, my = window.innerHeight / 2;
          irisRun(mx, my, 0, irisMax(mx, my), 500, irisOff);
        }, 170);
      });
    }, 620);
  }
  function goOutside() {
    if (showLanding()) return;
    // the front door is skipped, so Back from the shelves would close the app: ask for a second press, as outside does
    if (Date.now() - backArmed < 3000) { try { tizen.application.getCurrentApplication().exit(); } catch (x) {} }
    else { backArmed = Date.now(); toast("Press Back again to close the store", 3000); }
  }
  $("land").addEventListener("animationend", function (e) { if (e.target && e.target.id === "landCam") $("land").classList.remove("cam-in"); });
  $("land").addEventListener("click", function () { if (prefs.sound && !amb) startAmbience(); enterStore(); });
  setInterval(function () { if (landingOn && !entering) updateLanding(); }, 30000);
  window.addEventListener("resize", function () { if (landingOn && !entering) { fitStage(); updateLanding(); } });

