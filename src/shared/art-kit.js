  function rand(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function hx(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hexOf(a) {
    var s = "#";
    for (var i = 0; i < 3; i++) { var v = Math.max(0, Math.min(255, Math.round(a[i]))); s += (v < 16 ? "0" : "") + v.toString(16); }
    return s;
  }
  function cmix(a, b, t) { var x = hx(a), y = hx(b); return hexOf([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function cmul(a, b, k) { var x = hx(a), y = hx(b); k = k || 1; return hexOf([x[0] * y[0] / 255 * k, x[1] * y[1] / 255 * k, x[2] * y[2] / 255 * k]); }

  var LIGHT = {
    day:    { sun: "#fff8ea", amb: "#aeb8da", top: "#f4f6ff", haze: "#c3d7ea", warm: 0, lx: -1, ly: -1,
              sky: [[0, "#2c6fc4"], [.38, "#5597dc"], [.72, "#97c2e8"], [1, "#d0e4ee"]], ovc: ["#7d889a", "#b3bbc7"],
              cloud: ["#9aa5cb", "#c3cce6", "#f2f5ff", "#ffffff"] },
    golden: { sun: "#ffd6a0", amb: "#9f98c4", top: "#ffe4c6", haze: "#ecc1a4", warm: 0, lx: -1, ly: -.45,
              sky: [[0, "#36639f"], [.36, "#7596c8"], [.64, "#d9b8a4"], [.86, "#ffc48a"], [1, "#ffdba4"]], ovc: ["#88808f", "#c3aaa3"],
              cloud: ["#957c9e", "#c49fae", "#ffdcbe", "#fff3df"] },
    sunset: { sun: "#eeb1aa", amb: "#857eb4", top: "#d9b2c8", haze: "#c38aa2", warm: .85, lx: -1, ly: .4,
              sky: [[0, "#1d2558"], [.26, "#3b3c7a"], [.5, "#81538a"], [.68, "#cf7883"], [.84, "#f4a46b"], [1, "#ffd08d"]], ovc: ["#3c385a", "#82667e"],
              cloud: ["#3c2f5f", "#5a4478", "#875b87", "#f39a76"] },
    night:  { sun: "#7682bc", amb: "#46508a", top: "#6670ac", haze: "#323a6c", warm: 1, lx: .25, ly: -1,
              sky: [[0, "#050820"], [.4, "#0e1646"], [.72, "#1c2257"], [.9, "#332c5f"], [1, "#553c65"]], ovc: ["#0e1025", "#28263e"],
              cloud: ["#0f132e", "#181e47", "#252d5e", "#444f88"] }
  };
  var OVC = { clear: 0, cloudy: .22, overcast: .55, drizzle: .55, rain: .66, storm: .8, fog: .5, snow: .55 };
  function outLook(mode, wx) {
    var L = LIGHT[mode], ovc = OVC[wx] || 0, heavy = ovc > .3, storm = wx === "storm";
    var P = { mode: mode, wx: wx, ovc: ovc, heavy: heavy, storm: storm, wet: wx === "drizzle" || wx === "rain" || storm,
      snow: wx === "snow", fog: wx === "fog", warm: L.warm, lit: L.warm > 0, night: mode === "night", lx: L.lx, ly: L.ly };
    var dull = cmix(L.amb, "#ffffff", mode === "night" ? .1 : .32);
    P.sun = heavy ? cmix(L.sun, dull, .82) : ovc ? cmix(L.sun, dull, .3) : L.sun;
    P.amb = heavy ? cmix(L.amb, dull, .3) : L.amb;
    P.top = heavy ? cmix(L.top, dull, .7) : L.top;
    P.haze = heavy ? cmix(L.haze, L.ovc[1], .75) : L.haze;
    if (heavy) { P.lx = -.2; P.ly = -1; }
    var sky = L.sky;
    if (heavy) sky = [[0, L.ovc[0]], [.6, cmix(L.ovc[0], L.ovc[1], .55)], [1, L.ovc[1]]];
    else if (ovc) sky = sky.map(function (s) { return [s[0], cmix(s[1], L.ovc[1], .25)]; });
    P.cloud = heavy ? [cmul(L.ovc[0], "#9a9aae"), L.ovc[0], cmix(L.ovc[0], L.ovc[1], .5), cmix(L.ovc[1], "#ffffff", mode === "night" ? .05 : .18)] : L.cloud;
    if (storm) {
      // a storm darkens the day; at night it is already dark, so it only greys a little (the cars and lot must still read)
      var dk = mode === "night" ? "#dcdaea" : "#b6b4cc";
      P.sun = cmul(P.sun, dk); P.amb = cmul(P.amb, dk); P.top = cmul(P.top, dk); P.haze = cmul(P.haze, dk);
      var dsk = mode === "night" ? "#d4d2e4" : "#a8a6c0";
      sky = sky.map(function (s) { return [s[0], cmul(s[1], dsk)]; });
      P.cloud = P.cloud.map(function (c) { return cmul(c, dsk); });
    }
    if (wx === "snow" && mode !== "night") { P.haze = cmix(P.haze, "#e8ecf4", .35); }
    P.sky = sky;
    P.ink = "#2a1c18";
    return P;
  }
  function Lc(P, base) { return cmul(base, P.sun); }                  // facing the light
  function Sc(P, base) { return cmul(base, P.amb); }                  // turned away, or under a roof
  function Tc(P, base) { return cmul(base, P.top); }                  // facing the sky
  function Mc(P, base) { return cmix(Lc(P, base), Tc(P, base), .5); } // ground and roofs
  function Wc(P, base, k) { return cmix(Sc(P, base), cmul(base, "#ffd391"), (k == null ? .7 : k) * P.warm); } // in the shop light
  function Hz(P, col, d) { if (P.fog) d = Math.min(.9, d * 1.75 + .1); return cmix(col, P.haze, d); }
  function wetC(P, col) { return P.wet ? cmul(col, "#8c8da6") : col; }

  // ---- little SVG writers (the background is assembled as SVG, then painted into a canvas) ----
  function n1(v) { return Math.round(v * 10) / 10; }
  function R(x, y, w, h, f, ex) { return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + f + '"' + (ex || "") + "/>"; }
  function Pt(d, f, ex) { return '<path d="' + d + '" fill="' + f + '"' + (ex || "") + "/>"; }
  function Pg(pts, f, ex) {
    var s = [];
    for (var i = 0; i < pts.length; i += 2) s.push(n1(pts[i]) + "," + n1(pts[i + 1]));
    return '<polygon points="' + s.join(" ") + '" fill="' + f + '"' + (ex || "") + "/>";
  }
  function Ln(x1, y1, x2, y2, c, w, ex) { return '<line x1="' + n1(x1) + '" y1="' + n1(y1) + '" x2="' + n1(x2) + '" y2="' + n1(y2) + '" stroke="' + c + '" stroke-width="' + w + '"' + (ex || "") + "/>"; }
  function El(cx, cy, rx, ry, f, ex) { return '<ellipse cx="' + n1(cx) + '" cy="' + n1(cy) + '" rx="' + n1(rx) + '" ry="' + n1(ry) + '" fill="' + f + '"' + (ex || "") + "/>"; }
  function Ci(cx, cy, r, f, ex) { return '<circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(r) + '" fill="' + f + '"' + (ex || "") + "/>"; }
  function op(a) { return ' fill-opacity="' + a + '"'; }
  // a scalloped blob: leafy clumps, cloud puffs, shrubs
  function blobD(cx, cy, rx, ry, r, lobes, amp) {
    var pts = [], ph = r() * 6.2832, i;
    for (i = 0; i < lobes; i++) {
      var a = ph + i / lobes * 6.2832, k = 1 + (r() - .5) * amp;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    var d = "M" + n1(pts[0][0]) + "," + n1(pts[0][1]);
    for (i = 0; i < lobes; i++) {
      var p = pts[i], q = pts[(i + 1) % lobes], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, b = .2 + r() * .14;
      d += " Q" + n1(mx + (mx - cx) * b) + "," + n1(my + (my - cy) * b) + " " + n1(q[0]) + "," + n1(q[1]);
    }
    return d + "Z";
  }
  var clipN = 0;
  // cel-painted mass: a lit crescent on the side facing the light, body tone, then a hard shadow tone
  // on the far side. shapes(fill) draws the silhouette in one colour; cols = [deep, shade, body, lit]
  function celMass(shapes, box, cols, lx, ly, k, shadeCut) {
    var id = "cm" + (clipN++), o = '<clipPath id="' + id + '">' + shapes("#000") + "</clipPath>";
    o += '<g clip-path="url(#' + id + ')">' + R(box[0], box[1], box[2], box[3], cols[3]);
    o += '<g transform="translate(' + n1(-lx * k) + "," + n1(-ly * k) + ')">' + shapes(cols[2]) + "</g>";
    if (shadeCut) o += shadeCut;
    return o + "</g>";
  }


  function skySVG(P) {
    var st = P.sky.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join("");
    var o = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 1920 1080"><defs>' +
      '<linearGradient id="k" x1="0" y1="0" x2="0" y2="640" gradientUnits="userSpaceOnUse">' + st + "</linearGradient>" +
      '<radialGradient id="g"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".8"/><stop offset=".45" stop-color="#ffb47a" stop-opacity=".28"/><stop offset="1" stop-color="#ff9a68" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="c"><stop offset="0" stop-color="#ff9f7a" stop-opacity=".45"/><stop offset="1" stop-color="#ff9f7a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="n"><stop offset="0" stop-color="#8a5a7a" stop-opacity=".55"/><stop offset="1" stop-color="#8a5a7a" stop-opacity="0"/></radialGradient>' +
      '</defs><rect width="1920" height="1080" fill="url(#k)"/>';
    if (P.heavy) {
      if (P.mode === "night") o += El(900, 640, 1300, 200, "url(#n)", ' opacity=".6"');
      return o + "</svg>";
    }
    if (P.mode === "sunset") {
      // the sun has just gone behind the far trees; banded glow the way a BG painter would lay it in
      o += El(300, 610, 1100, 360, "url(#g)") + El(1500, 620, 700, 150, "url(#c)", ' opacity=".7"');
      o += Ci(300, 604, 150, "#ffd79a", op(".16")) + Ci(300, 604, 104, "#ffdca0", op(".22")) + Ci(300, 604, 72, "#ffe6b4", op(".35"));
      o += Ci(300, 604, 50, "#fff0c8");
    } else if (P.mode === "golden") {
      o += El(330, 470, 900, 420, "url(#g)");
      o += Ci(330, 470, 130, "#fff0c8", op(".14")) + Ci(330, 470, 88, "#fff2cc", op(".22")) + Ci(330, 470, 58, "#fff6d8", op(".4"));
      o += Ci(330, 470, 40, "#fffbea");
    } else if (P.mode === "night") {
      o += El(960, 650, 1300, 210, "url(#n)");
    }
    return o + "</svg>";
  }

  // ---- the cloud level: tiles every 1920px so it can drift forever ----
  function cumulus(x, by, w, h, r, cols, lx, ly) {
    var bumps = Math.max(3, Math.round(w / (h * .85))), puffs = [], i;
    for (i = 0; i < bumps; i++) {
      var t = (i + .5) / bumps, bell = Math.sin(Math.PI * t), rr = h * (.3 + .42 * bell) * (.85 + r() * .3);
      puffs.push([x + t * w + (r() - .5) * w / bumps * .5, by - rr * .5 - h * .28 * bell, rr]);
    }
    var seeds = puffs.map(function () { return Math.floor(r() * 1e6) + 1; });
    function shapes(f) {
      var s = "";
      for (var j = 0; j < puffs.length; j++) { var q = puffs[j]; s += Pt(blobD(q[0], q[1], q[2], q[2] * .9, rand(seeds[j]), 9, .16), f); }
      return s + El(x + w / 2, by - h * .1, w / 2, h * .17, f);
    }
    var cut;
    if (ly > 0) { // lit from below: the tops fall into shadow
      cut = Pt("M" + n1(x - h) + "," + n1(by - h * 2) + " L" + n1(x + w + h) + "," + n1(by - h * 2) + " L" + n1(x + w + h) + "," + n1(by - h * .62) + wave(x + w + h, x - h, by - h * .62, h * .12, r) + " Z", cols[1]);
    } else {
      cut = Pt("M" + n1(x - h) + "," + n1(by - h * .34) + wave(x - h, x + w + h, by - h * .34, h * .1, r) + " L" + n1(x + w + h) + "," + n1(by + h) + " L" + n1(x - h) + "," + n1(by + h) + " Z", cols[1]) +
        Pt("M" + n1(x - h) + "," + n1(by - h * .04) + wave(x - h, x + w + h, by - h * .04, h * .07, r) + " L" + n1(x + w + h) + "," + n1(by + h) + " L" + n1(x - h) + "," + n1(by + h) + " Z", cols[0]);
    }
    return celMass(shapes, [x - h, by - h * 2.2, w + 2 * h, h * 3.4], cols, lx, ly, h * .1, cut);
  }
  function wave(x0, x1, y, amp, r) {
    var d = "", n = Math.max(2, Math.round(Math.abs(x1 - x0) / 70)), dx = (x1 - x0) / n;
    for (var i = 0; i < n; i++) { var xa = x0 + dx * (i + .5), xb = x0 + dx * (i + 1); d += " Q" + n1(xa) + "," + n1(y + (r() < .5 ? -amp : amp) * (.5 + r())) + " " + n1(xb) + "," + n1(y); }
    return d;
  }
  function streak(x, y, w, t, r, cols, lx, ly) {
    // a long flat stratus band
    var n = Math.max(4, Math.round(w / (t * 1.6))), segs = [], seeds = [];
    for (var i = 0; i < n; i++) {
      var u = (i + .5) / n, bell = Math.pow(Math.sin(Math.PI * u), .7);
      segs.push([x + u * w + (r() - .5) * t, y - t * .25 * bell + (r() - .5) * t * .4, (w / n) * (.7 + r() * .5) + t * .6, t * (.35 + .75 * bell) * (.8 + r() * .4)]);
      seeds.push(Math.floor(r() * 1e6) + 1);
    }
    function shapes(f) { return segs.map(function (s, j) { return Pt(blobD(s[0], s[1], s[2] * .62, s[3], rand(seeds[j]), 8, .14), f); }).join("") + El(x + w / 2, y + t * .3, w * .5, t * .26, f); }
    // the shadow edge follows the band's own rise and fall, puff by puff, instead of a ruler line across the middle
    var pts = segs.map(function (s) { return [s[0], s[1] + (ly > 0 ? s[3] * .34 : -s[3] * .1)]; }).sort(function (a, b) { return a[0] - b[0]; });
    var xl = x - t * 2, xr = x + w + t * 2, edge = "";
    for (var k = 0; k < pts.length; k++) {
      var nx = k + 1 < pts.length ? (pts[k][0] + pts[k + 1][0]) / 2 : xr, ny = k + 1 < pts.length ? (pts[k][1] + pts[k + 1][1]) / 2 : pts[k][1];
      edge += " Q" + n1(pts[k][0]) + "," + n1(pts[k][1] + (k % 2 ? 1 : -1) * t * .06) + " " + n1(nx) + "," + n1(ny);
    }
    var cut;
    if (ly > 0) cut = Pt("M" + n1(xl) + "," + n1(y - t * 3) + " L" + n1(xr) + "," + n1(y - t * 3) + " L" + n1(xr) + "," + n1(pts[pts.length - 1][1]) + revEdge(pts, xl, t) + " Z", cols[1]);
    else cut = Pt("M" + n1(xl) + "," + n1(pts[0][1]) + edge + " L" + n1(xr) + "," + n1(y + t * 3) + " L" + n1(xl) + "," + n1(y + t * 3) + " Z", cols[1]);
    return celMass(shapes, [x - t * 2, y - t * 3, w + t * 4, t * 6], cols, lx, ly, t * .28, cut);
  }
  function revEdge(pts, xl, t) {
    var d = "";
    for (var k = pts.length - 1; k >= 0; k--) {
      var nx = k > 0 ? (pts[k][0] + pts[k - 1][0]) / 2 : xl, ny = k > 0 ? (pts[k][1] + pts[k - 1][1]) / 2 : pts[k][1];
      d += " Q" + n1(pts[k][0]) + "," + n1(pts[k][1] + (k % 2 ? 1 : -1) * t * .06) + " " + n1(nx) + "," + n1(ny);
    }
    return d;
  }
  function cloudsSVG(P) {
    clipN = 0;
    var r = rand(P.heavy ? 91 : P.ovc ? 53 : 37), c = P.cloud, lx = P.lx, ly = P.ly, s = "", i;
    if (P.heavy) {
      // a full deck: a flat ceiling with rows of heavy puffs hanging under it, darker toward the bottom
      var deck = P.wet || P.storm ? 470 : P.fog ? 380 : 430;
      s += Pt("M0,0 L1920,0 L1920," + (deck - 160) + wave(1920, 0, deck - 160, 22, r) + " Z", c[1]);
      for (var row = 0; row < 3; row++) {
        var y = 170 + row * (deck - 170) / 2.1;
        var tones = [cmix(c[0], c[1], .5 - row * .15), cmix(c[1], c[0], row * .25), cmix(c[2], c[1], row * .3), cmix(c[3], c[2], .45 + row * .2)];
        for (var x = -160 + row * 140; x < 1920; x += 340 + r() * 160) s += cumulus(x, y, 420 + r() * 260, 120 + r() * 50 + row * 12, r, tones, lx, ly);
      }
    } else if (P.mode === "sunset") {
      var bands = [[20, 230, 600, 46], [720, 160, 720, 38], [1260, 312, 620, 48], [360, 404, 520, 32], [1000, 466, 440, 24]];
      bands.forEach(function (b) { s += streak(b[0], b[1], b[2], b[3], r, c, lx, ly); });
      if (P.ovc) for (i = 0; i < 4; i++) s += streak(r() * 1700, 140 + r() * 320, 300 + r() * 300, 10 + r() * 6, r, c, lx, ly);
    } else if (P.mode === "night") {
      [[160, 220, 560, 22], [1040, 150, 640, 18], [700, 380, 460, 16]].forEach(function (b) { s += streak(b[0], b[1], b[2], b[3], r, c, lx, ly); });
      if (P.ovc) for (i = 0; i < 4; i++) s += streak(r() * 1700, 120 + r() * 300, 300 + r() * 300, 12 + r() * 6, r, c, lx, ly);
    } else {
      var cu = [[90, 300, 330, 92], [740, 220, 260, 74], [1240, 330, 420, 110], [1700, 190, 230, 64], [430, 470, 210, 52]];
      cu.forEach(function (q) { s += cumulus(q[0], q[1], q[2], q[3], r, c, lx, ly); });
      s += streak(980, 120, 420, 9, r, c, lx, ly) + streak(160, 140, 300, 8, r, c, lx, ly);
      if (P.ovc) for (i = 0; i < 4; i++) s += cumulus(r() * 1800, 200 + r() * 260, 200 + r() * 200, 60 + r() * 40, r, c, lx, ly);
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="640" viewBox="0 0 1920 640">' +
      "<g>" + s + '</g><g transform="translate(-1920,0)">' + s + '</g><g transform="translate(1920,0)">' + s + "</g></svg>";
  }

  var OB = {
    stucco: "#d7bd94", mansard: "#7a513a", cap: "#e6dccb", trim: "#ece3d0", soffit: "#4c3b33", column: "#dfc8a3",
    bronze: "#4f3e32", brick: "#a05c45", concrete: "#cbc3b4", asphalt: "#64646b", road: "#55555d", stripe: "#efe9da",
    grass: "#82994f", fence: "#a7895f", leaf: "#4e7740", oak: "#476d3b", wood: "#6c5643", steel: "#8f929d", roof: "#686570",
    siding: "#dad3bf", hbrick: "#a76a4e", snow: "#f3f6fb"
  };

  function smear(cx, y0, w, len, col, a, r) {
    var o = "";
    for (var y = y0; y < y0 + len; y += 5) {
      var t = (y - y0) / len, ww = w * (1 - t * .55) * (.6 + r() * .5);
      if (r() < .18) continue;
      o += R(cx - ww / 2 + (r() - .5) * w * .25, y, ww, 2.6, col, op((a * (1 - t)).toFixed(3)));
    }
    return o;
  }

  var INK = "#2a1c18";
  function ink(w, c) { return ' stroke="' + (c || INK) + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round" stroke-linecap="round"'; }
  function Tx(x, y, size, txt, fill, ex, fam) {
    return '<text x="' + n1(x) + '" y="' + n1(y) + '" text-anchor="middle" font-family="' + (fam || "Caprasimo, Cooper Black, Georgia, serif") + '" font-size="' + size + '" fill="' + fill + '"' + (ex || "") + ">" + txt + "</text>";
  }
  var OSW = "Oswald, Arial Narrow, sans-serif", YT = "Caprasimo, Cooper Black, Georgia, serif";
  // a painted glow: hard-edged rings of light, the way they were laid in on a cel
  // A pale lamp colour laid thinly over a dusk sky reads as grey smoke, not light; so the outer rings of a pale glow
  // are a warmer, stronger version of it and only the core keeps the lamp's own cream.
  function pale(col) { var c = hx(col), mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return mn > 160 && mx - mn < 90; }
  function halo(cx, cy, rx, ry, col, a, cls) {
    var outer = col, mid = col;
    var k = [.26, .38, .6];
    // a lamp's glow is tighter and brighter than a neon's wash
    if (pale(col)) { outer = cmix(col, "#ff8a3d", .6); mid = cmix(col, "#ffb04a", .35); rx *= .7; ry *= .7; k = [.2, .42, .85]; }
    return '<g' + (cls ? ' class="' + cls + '"' : "") + ">" + El(cx, cy, rx, ry, outer, op((a * k[0]).toFixed(3))) + El(cx, cy, rx * .7, ry * .7, mid, op((a * k[1]).toFixed(3))) + El(cx, cy, rx * .42, ry * .42, col, op((a * k[2]).toFixed(3))) + "</g>";
  }
  function rhalo(x, y, w, h, pad, col, a) {
    var o = "";
    for (var i = 2; i >= 1; i--) o += '<rect x="' + n1(x - pad * i) + '" y="' + n1(y - pad * i) + '" width="' + n1(w + pad * i * 2) + '" height="' + n1(h + pad * i * 2) + '" rx="' + n1(pad * i * 2) + '" fill="' + (i === 2 && pale(col) ? cmix(col, "#ff8a3d", .5) : col) + '"' + op((a * (i === 2 ? .1 : .16)).toFixed(3)) + "/>";
    return o;
  }


  var texTile = null;
  function paintTile() {
    var c = document.createElement("canvas"); c.width = c.height = 256;
    var g = c.getContext("2d"), img = g.createImageData(256, 256), d = img.data, oct = [[4, .5, 11], [8, .32, 23], [32, .18, 37]], grids = [], r = rand(997);
    oct.forEach(function (o) { var a = [], q = rand(o[2]); for (var i = 0; i < o[0] * o[0]; i++) a.push(q()); grids.push(a); });
    for (var y = 0; y < 256; y++) for (var x = 0; x < 256; x++) {
      var v = 0;
      for (var k = 0; k < oct.length; k++) {
        var n = oct[k][0], gx = x / 256 * n, gy = y / 256 * n, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0, G = grids[k];
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        var x1 = (x0 + 1) % n, y1 = (y0 + 1) % n, a = G[y0 * n + x0], b = G[y0 * n + x1], cc = G[y1 * n + x0], dd = G[y1 * n + x1];
        v += (a + (b - a) * fx + (cc - a) * fy + (a - b - cc + dd) * fx * fy) * oct[k][1];
      }
      var j = (y * 256 + x) * 4, val = 128 + (v - .5) * 120 + (r() - .5) * 34;
      d[j] = d[j + 1] = d[j + 2] = val; d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function texturize(cv, a, masked, groundFade) {
    try {
      var g = cv.getContext("2d"), w = cv.width, h = cv.height, t = document.createElement("canvas"); t.width = w; t.height = h;
      var tg = t.getContext("2d");
      tg.fillStyle = tg.createPattern(texTile || (texTile = paintTile()), "repeat"); tg.fillRect(0, 0, w, h);
      if (masked) { tg.globalCompositeOperation = "destination-in"; tg.drawImage(cv, 0, 0); }
      if (groundFade) {
        // the blacktop takes the texture lightly: on a bright TV a full-strength tooth reads as blotches
        var fade = tg.createLinearGradient(0, 0, 0, h);
        fade.addColorStop(0, "rgba(0,0,0,1)"); fade.addColorStop(.6, "rgba(0,0,0,1)"); fade.addColorStop(.7, "rgba(0,0,0,.45)"); fade.addColorStop(1, "rgba(0,0,0,.32)");
        tg.globalCompositeOperation = "destination-in"; tg.fillStyle = fade; tg.fillRect(0, 0, w, h);
      }
      g.save(); g.globalAlpha = a; g.globalCompositeOperation = "overlay"; g.drawImage(t, 0, 0); g.restore();
      t.width = t.height = 0;
    } catch (e) {}
  }
  function svgToCanvas(svg, cv, ok, done) {
    var img = new Image(), url = null;
    function fin(good) {
      if (url) try { URL.revokeObjectURL(url); } catch (e) {}
      if (!ok()) return;
      if (good) try { var g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); } catch (e) { good = false; }
      done(good);
    }
    img.onload = function () { fin(true); };
    img.onerror = function () { fin(false); };
    try { url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); img.src = url; }
    catch (e) { url = null; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }
  }

  function dropTile(size, n, lmin, lmax, w, amin, amax, seed) {
    var r = rand(seed), out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">';
    for (var i = 0; i < n; i++) {
      var x = r() * size, len = lmin + r() * (lmax - lmin), y = r() * (size - len), a = (amin + r() * (amax - amin)).toFixed(2);
      out += '<path d="M' + x.toFixed(1) + "," + y.toFixed(1) + " L" + (x + w * .5).toFixed(1) + "," + (y + len).toFixed(1) + " L" + (x - w * .5).toFixed(1) + "," + (y + len).toFixed(1) + 'Z" fill="#e4ecff" fill-opacity="' + a + '"/>';
    }
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out + "</svg>") + '")';
  }

  var grainURL = "";
  function grainTexture() {
    if (grainURL) return grainURL;
    try {
      var c = document.createElement("canvas"); c.width = c.height = 256;
      var g = c.getContext("2d"), img = g.createImageData(256, 256), d = img.data;
      for (var i = 0; i < d.length; i += 4) { var v = Math.random() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.random() * Math.random() * 120; }
      g.putImageData(img, 0, 0); grainURL = c.toDataURL("image/png");
    } catch (e) { grainURL = ""; }
    return grainURL;
  }

  // ===== Friday Night Video's building, shared by the store, the Strip and the bar =====
  function Ic(P, base, cool) { return cmix(cmul(base, "#787e94"), cmul(base, cool ? "#f2fbff" : "#fff3dc", 1.05), P.warm); }
  function snowCap(P, x, y, w, t) {
    if (!P.snow) return "";
    var r = rand(Math.round(x * 7 + y)), d = "M" + n1(x - 2) + "," + n1(y + 1), n = Math.max(2, Math.round(w / 18));
    for (var i = 0; i <= n; i++) d += " L" + n1(x - 2 + (w + 4) * i / n) + "," + n1(y - t * (.6 + r() * .6));
    d += " L" + n1(x + w + 2) + "," + n1(y + 1) + " Q" + n1(x + w * .5) + "," + n1(y + t * .7) + " " + n1(x - 2) + "," + n1(y + 1) + "Z";
    return Pt(d, Tc(P, OB.snow)) + Pt("M" + n1(x) + "," + n1(y + 1) + " Q" + n1(x + w * .5) + "," + n1(y + t * .7) + " " + n1(x + w) + "," + n1(y + 1) + "Z", Sc(P, OB.snow), op(".7"));
  }
  function roofUnit(P, x, y, w, h) {
    var o = R(x, y, w, h, Lc(P, "#b9bcc2")) + R(x + w * .62, y, w * .38, h, Sc(P, "#b9bcc2")) + R(x, y, w, 4, Tc(P, "#d9dbe0"));
    for (var i = 1; i < 5; i++) o += R(x + 4, y + 6 + i * (h - 8) / 5, w * .55, 1.4, Sc(P, "#8a8d96"), op(".7"));
    return o + snowCap(P, x, y, w, 7);
  }
  function column(P, x) {
    var o = Pg([x - 7, 461, x, 461, x, 692, x - 7, 692], Sc(P, OB.column)) + R(x, 461, 24, 231, Lc(P, OB.column));
    o += R(x + 17, 461, 7, 231, cmix(Lc(P, OB.column), Sc(P, OB.column), .45));
    if (P.mode === "day" || P.mode === "golden") o += Pg([x, 461, x + 24, 461, x + 24, 498, x, 516], Sc(P, OB.column), op(".85"));
    else o += R(x, 461, 24, 231, Sc(P, OB.column), op(P.night ? ".55" : ".35"));
    if (P.lit) o += R(x, 600, 24, 92, "#ffcf87", op((.18 * P.warm).toFixed(2)));
    return o + R(x - 7, 684, 31, 8, Sc(P, "#bfb4a2"));
  }
  function glassOver(P, x, y, w, h, seed) {
    var r = rand(seed), o = "", day = P.mode === "day" || P.mode === "golden";
    var refl = day ? cmix(P.sky[1][1], "#ffffff", .25) : P.night ? "#4b5690" : cmix(P.sky[2][1], "#ffffff", .1);
    o += R(x, y, w, h, refl, op(day ? (P.heavy ? ".42" : ".5") : P.lit ? ".1" : ".3"));
    // the two diagonal glints every cel painter puts on glass
    var a = x + w * (.18 + r() * .2), g = day ? ".42" : ".12";
    o += Pg([a, y, a + 34, y, a - 30, y + h, a - 64, y + h], "#ffffff", op(g)) + Pg([a + 46, y, a + 56, y, a - 8, y + h, a - 18, y + h], "#ffffff", op(g));
    return o;
  }
  function videoInterior(P, x, y, w, h, seed) {
    var r = rand(seed), o = "", wallc = Ic(P, "#efe0bc");
    o += R(x, y, w, h, wallc) + R(x, y, w, 12, Ic(P, "#cdbf9c"));
    for (var fx = x + 20; fx < x + w - 30; fx += 92) o += R(fx, y + 4, 56, 5, P.lit ? "#fffef2" : Ic(P, "#dcdcd0"));
    for (var row = 0; row < 3; row++) {
      var ry = y + 30 + row * 30;
      if (ry + 22 > y + h - 34) break;
      o += R(x, ry + 22, w, 4, Ic(P, "#8a6440"));
      for (var sx = x + 2; sx < x + w - 4; sx += 5 + (r() < .2 ? 2 : 0)) o += R(sx, ry + (r() < .3 ? 2 : 0), 4, 22 - (r() < .3 ? 2 : 0), Ic(P, cmix(SPINES[Math.floor(r() * SPINES.length)], "#d9c9a6", .3)));
    }
    // a gondola of new releases facing out
    o += R(x, y + h - 30, w, 30, Ic(P, "#a7744a"));
    for (sx = x + 4; sx < x + w - 14; sx += 15) o += R(sx, y + h - 27, 12, 18, Ic(P, SPINES[Math.floor(r() * SPINES.length)])) + R(sx + 2, y + h - 22, 8, 3, Ic(P, "#f4efe0"), op(".7"));
    return o;
  }
  function glassPoster(P, x, y, w, h, kind) {
    var o = "", t = function (c) { return Wc(P, c, .45); };
    if (kind === 0) { // a sci-fi one-sheet: a ringed planet over a red title band
      o += R(x, y, w, h, t("#1d2a5c")) + Ci(x + w * .55, y + h * .4, w * .28, t("#e98a3a")) + El(x + w * .55, y + h * .42, w * .46, w * .08, "none", ' stroke="' + t("#f7d488") + '" stroke-width="2"');
      o += Ci(x + w * .2, y + h * .15, 1.4, t("#ffffff")) + Ci(x + w * .8, y + h * .2, 1.2, t("#ffffff")) + R(x, y + h * .74, w, h * .12, t("#c4313d"));
    } else if (kind === 1) { // a creature feature
      o += R(x, y, w, h, t("#14161c")) + Ci(x + w * .5, y + h * .38, w * .3, t("#9fdc5a")) + Ci(x + w * .5, y + h * .38, w * .11, t("#14161c"));
      for (var i = 0; i < 5; i++) o += R(x + w * (.12 + i * .17), y + h * .66, 3, 6 + i % 3 * 5, t("#c4313d"));
      o += R(x + w * .1, y + h * .82, w * .8, 4, t("#e8e2d0"));
    } else if (kind === 2) { // an action picture
      o += R(x, y, w, h, t("#e8762c")) + Pg([x + w * .5, y + h * .1, x + w * .62, y + h * .38, x + w * .92, y + h * .4, x + w * .66, y + h * .56, x + w * .76, y + h * .84, x + w * .5, y + h * .66, x + w * .24, y + h * .84, x + w * .34, y + h * .56, x + w * .08, y + h * .4, x + w * .38, y + h * .38], t("#ffd84d"));
      o += R(x + w * .1, y + h * .86, w * .8, 5, t("#1b1b22"));
    }
    return R(x - 2, y - 2, w + 4, h + 4, t("#f2ede0")) + o;
  }
  function bulkhead(P, x, y, w) {
    var o = R(x, y, w, 30, Wc(P, OB.brick, .35)), m = cmix(Wc(P, OB.brick, .35), "#e8dccb", .3);
    for (var row = 0; row < 4; row++) { o += R(x, y + row * 7.5, w, 1.2, m, op(".7")); for (var bx = x + (row % 2 ? 0 : 9); bx < x + w; bx += 18) o += R(bx, y + row * 7.5, 1.2, 7.5, m, op(".6")); }
    return o + R(x, y, w, 3, Sc(P, OB.brick), op(".6"));
  }
  function sodaMachine(P, x, y) {
    var h = 692 - y, body = "#c63a33", o = "";
    o += R(x, y, 62, h, Wc(P, body, .4)) + R(x + 46, y, 16, h, Sc(P, body));
    o += R(x + 6, y + 8, 36, 74, P.lit ? "#fff0d6" : Wc(P, "#e9e2d2", .4));
    o += Pt("M" + (x + 6) + "," + (y + 54) + " Q" + (x + 24) + "," + (y + 40) + " " + (x + 42) + "," + (y + 56) + " L" + (x + 42) + "," + (y + 64) + " Q" + (x + 24) + "," + (y + 50) + " " + (x + 6) + "," + (y + 62) + "Z", P.lit ? "#e0443a" : Wc(P, body, .4));
    for (var i = 0; i < 4; i++) o += R(x + 8 + i * 8, y + 14, 6, 9, P.lit ? ["#e0443a", "#2f6fc4", "#f2c13a", "#3c9a5a"][i] : Sc(P, "#888888"));
    o += R(x + 44, y + 20, 10, 40, Sc(P, "#2a2a30")) + R(x + 8, y + 96, 34, 14, Sc(P, "#2a2224"));
    return o;
  }
  function returnsBox(P, x, by) {
    var b = "#2f5cad", o = El(x + 22, by, 30, 4, Sc(P, "#1a1820"), op(".4"));
    o += Pt("M" + x + "," + by + " L" + x + "," + (by - 58) + " Q" + x + "," + (by - 70) + " " + (x + 22) + "," + (by - 70) + " Q" + (x + 44) + "," + (by - 70) + " " + (x + 44) + "," + (by - 58) + " L" + (x + 44) + "," + by + "Z", Wc(P, b, .5));
    o += Pt("M" + (x + 28) + "," + by + " L" + (x + 28) + "," + (by - 69) + " Q" + (x + 44) + "," + (by - 66) + " " + (x + 44) + "," + (by - 58) + " L" + (x + 44) + "," + by + "Z", Sc(P, b));
    o += R(x + 8, by - 52, 28, 6, "#15131c") + R(x + 6, by - 30, 32, 12, Wc(P, "#f1eee6", .4));
    return o + snowCap(P, x + 2, by - 70, 40, 6);
  }
  function videoFront(P) {
    var o = "", fr = Sc(P, OB.bronze), frL = Lc(P, OB.bronze);
    // a drinks machine glowing under the walkway
    o += sodaMachine(P, 898, 548);
    // left window
    o += R(964, 490, 288, 172, fr) + videoInterior(P, 970, 496, 276, 160, 3);
    o += R(990, 504, 110, 16, Ic(P, "#c4313d")) + R(990, 520, 110, 3, Ic(P, "#8a2230"));
    o += glassPoster(P, 1172, 512, 52, 78, 0) + glassPoster(P, 980, 566, 50, 74, 2);
    // a cardboard standee: a space ranger, arms folded
    var sd = Ic(P, "#5a7fb8"), sdl = Ic(P, "#e8d6b0");
    o += R(1112, 586, 34, 66, sd) + Ci(1129, 578, 13, sdl) + Pt("M1114,574 a15,15 0 0 1 30,0 l0,-4 a15,13 0 0 0 -30,0z", Ic(P, "#d8d8e0")) + R(1110, 604, 38, 8, Ic(P, "#e2b33c"));
    o += glassOver(P, 970, 496, 276, 160, 5) + R(1106, 490, 6, 172, fr) + R(964, 490, 288, 3, frL, op(".6"));
    // the door bay: transom glass over the door opening
    o += R(1250, 490, 104, 202, fr) + videoInterior(P, 1258, 498, 88, 64, 9) + glassOver(P, 1258, 498, 88, 64, 11) + R(1250, 562, 104, 8, fr);
    o += R(1258, 570, 88, 122, Ic(P, "#efe0bc")) + R(1258, 570, 88, 10, Ic(P, "#d9c6a0"));
    for (var sx = 1262; sx < 1344; sx += 5) o += R(sx, 596, 4, 22, Ic(P, SPINES[(sx * 7) % SPINES.length]));
    o += R(1258, 618, 88, 4, Ic(P, "#8a6440")) + R(1258, 650, 88, 42, Ic(P, "#b4a07a")) + R(1272, 640, 60, 52, Ic(P, "#7a4c34")) + R(1272, 640, 60, 5, Ic(P, "#a8764e"));
    // right window
    o += R(1350, 490, 292, 172, fr) + videoInterior(P, 1356, 496, 280, 160, 7);
    o += glassPoster(P, 1560, 510, 54, 80, 1);
    // a customer browsing, back to us
    var cu = Ic(P, "#4a5a7a"), sk = Ic(P, "#c99a78");
    o += Pt("M1528,656 L1530,606 Q1532,592 1546,590 L1566,590 Q1580,592 1582,606 L1584,656 Z", cu) + Ci(1556, 578, 12, Ic(P, "#5a3a2a")) + R(1550, 588, 12, 4, sk);
    o += glassOver(P, 1356, 496, 280, 160, 13) + R(1492, 490, 6, 172, fr) + R(1350, 490, 292, 3, frL, op(".6"));
    o += bulkhead(P, 964, 662, 288) + bulkhead(P, 1350, 662, 292);
    // the returns box by the door
    o += returnsBox(P, 1362, 708);
    return o;
  }
  // Friday Night Video's building as seen from its own car park: the master drawing. The Strip and the bar's doorstep
  // draw this same building, scaled into place, so the store looks the same from every side of the street.
  function videoBuilding(P) {
    var o = "", r = rand(19), X0 = 868, X1 = 1666, i, x, y;
    // rooftop air-conditioners peeking over the mansard
    o += roofUnit(P, 1064, 306, 80, 36) + roofUnit(P, 1480, 314, 62, 28) + R(1196, 318, 8, 24, Sc(P, OB.steel)) + R(1193, 315, 14, 5, Lc(P, OB.steel));
    // the left end of the building, turning away from us
    o += Pg([848, 366, 868, 340, 868, 692, 848, 686], cmul(Sc(P, OB.stucco), "#e2e2ea"));
    o += Pg([846, 366, 868, 340, 868, 348, 846, 372], Sc(P, OB.cap));
    // coping, then the shingled mansard
    o += R(X0 - 8, 338, X1 - X0 + 16, 10, Tc(P, OB.cap)) + R(X0 - 8, 347, X1 - X0 + 16, 3, Sc(P, OB.cap));
    var mL = Mc(P, OB.mansard), mS = cmix(mL, Sc(P, OB.mansard), .55), mD = Sc(P, OB.mansard), mH = cmix(mL, Tc(P, "#c49a76"), .35);
    o += R(X0 - 6, 350, X1 - X0 + 12, 101, mL);
    for (y = 358; y < 450; y += 10) {
      o += R(X0 - 6, y - 1, X1 - X0 + 12, 3.2, mD, op(".7")) + R(X0 - 6, y + 2.2, X1 - X0 + 12, 1.2, mH, op(".35"));
      for (x = X0 - 6 + ((y / 10) % 2 ? 0 : 14); x < X1; x += 26 + r() * 10) {
        o += R(x, y + 2, 1.2, 8, mS, op(".35"));
        var q = r(); if (q < .12) o += R(x + 2, y + 2, 18, 8, mH, op(".5")); else if (q < .2) o += R(x + 2, y + 2, 18, 8, mD, op(".35"));
      }
    }
    o += R(X0 - 6, 350, X1 - X0 + 12, 7, mD, op(".75"));
    if (P.snow) o += R(X0 - 8, 330, X1 - X0 + 16, 10, Tc(P, OB.snow)) + snowCap(P, X0 - 6, 352, X1 - X0 + 12, 7);
    // fascia board and the deep shade under the overhang
    o += R(X0 - 8, 450, X1 - X0 + 16, 11, Lc(P, OB.trim)) + R(X0 - 8, 459, X1 - X0 + 16, 2.5, Sc(P, OB.trim));
    o += R(X0, 461, X1 - X0, 19, Sc(P, OB.soffit));
    var wall = cmix(Wc(P, OB.stucco, .5), Sc(P, OB.stucco), .35);
    o += R(X0, 480, X1 - X0, 212, wall);
    // recessed cans in the soffit, and the little pools they throw (lit from dusk on)
    for (x = 960; x < X1; x += 150) {
      o += El(x, 470, 9, 2.6, P.lit ? "#fff3cf" : Sc(P, "#d8d0c0"));
      if (P.lit) o += Pg([x - 9, 472, x + 9, 472, x + 34, 692, x - 34, 692], "#ffe2a6", op((.07 * P.warm).toFixed(3)));
    }
    o += videoFront(P);
    [868, 1640].forEach(function (cx) { o += column(P, cx); });
    return o;
  }
  function waterTower(P, cx, cy) {
    var dist = .32, body = "#d9dee4", lit = Hz(P, Lc(P, body), dist), shd = Hz(P, Sc(P, body), dist), leg = Hz(P, Sc(P, "#8a909c"), dist), o = "";
    o += Ln(cx - 46, cy + 22, cx - 62, 360, leg, 5) + Ln(cx + 46, cy + 22, cx + 62, 360, leg, 5) + Ln(cx - 16, cy + 30, cx - 20, 360, leg, 4) + Ln(cx + 16, cy + 30, cx + 20, 360, leg, 4);
    o += Ln(cx - 56, cy + 62, cx + 56, cy + 62, leg, 2.4) + Ln(cx - 58, cy + 62, cx + 18, cy + 92, leg, 1.6) + Ln(cx + 58, cy + 62, cx - 18, cy + 92, leg, 1.6);
    o += Ln(cx, cy + 30, cx, 360, leg, 6);
    var tank = "M" + (cx - 64) + "," + cy + " Q" + (cx - 64) + "," + (cy - 34) + " " + cx + "," + (cy - 36) + " Q" + (cx + 64) + "," + (cy - 34) + " " + (cx + 64) + "," + cy + " Q" + (cx + 60) + "," + (cy + 32) + " " + cx + "," + (cy + 34) + " Q" + (cx - 60) + "," + (cy + 32) + " " + (cx - 64) + "," + cy + "Z";
    o += Pt(tank, shd);
    var lx = P.lx < 0 ? -1 : 1;
    o += Pt("M" + (cx + lx * 64) + "," + cy + " Q" + (cx + lx * 64) + "," + (cy - 34) + " " + cx + "," + (cy - 36) + " Q" + (cx + lx * 14) + "," + cy + " " + cx + "," + (cy + 34) + " Q" + (cx + lx * 60) + "," + (cy + 32) + " " + (cx + lx * 64) + "," + cy + "Z", lit);
    o += Pg([cx - 54, cy - 22, cx, cy - 58, cx + 54, cy - 22], shd) + Pg([cx + 54 * lx, cy - 22, cx, cy - 58, cx + 4 * lx, cy - 22], lit, op(".85"));
    o += R(cx - 1.5, cy - 70, 3, 14, leg);
    o += Ln(cx - 66, cy + 4, cx + 66, cy + 4, leg, 2) + Ln(cx - 66, cy - 6, cx + 66, cy - 6, leg, 1);
    return o + snowCap(P, cx - 44, cy - 30, 88, 8);
  }
  // the edge of town behind the shops, as the store's car park sees it: a far line of trees, a few roofs, no towers
  function suburbBand(P, base) {
    var r = rand(7), o = "", x, w, hh, d;
    var far = Hz(P, Sc(P, "#4f6a48"), .7), far2 = Hz(P, Sc(P, "#486642"), .52), roofc = Hz(P, Sc(P, OB.roof), .45), wall = Hz(P, Sc(P, OB.siding), .4);
    d = "M-10," + base + " L-10," + (base - 70); x = -10;
    while (x < 1930) { w = 40 + r() * 70; hh = 14 + r() * 30; d += " Q" + n1(x + w * .5) + "," + n1(base - 70 - hh) + " " + n1(x + w) + "," + n1(base - 70 + (r() - .5) * 10); x += w; }
    o += Pt(d + " L1930," + base + " Z", far);
    // a few houses at the edge of town, their windows lit after dark
    [[20, 150, 120], [180, 110, 86], [1010, 130, 96], [1620, 150, 110]].forEach(function (h) {
      var hx0 = h[0], hw = h[1], top = base - h[2];
      o += R(hx0, top, hw, h[2], wall) + Pg([hx0 - 10, top + 4, hx0 + hw * .5, top - hw * .32, hx0 + hw + 10, top + 4], roofc);
      if (P.lit) [.25, .62].forEach(function (f) { if (r() < .75) o += R(hx0 + hw * f, top + 22, 16, 20, "#ffd88a", op(".75")); });
    });
    d = "M-10," + base + " L-10," + (base - 30); x = -10;
    while (x < 1930) { w = 60 + r() * 90; hh = 10 + r() * 26; d += " Q" + n1(x + w * .5) + "," + n1(base - 30 - hh) + " " + n1(x + w) + "," + n1(base - 30 + (r() - .5) * 8); x += w; }
    o += Pt(d + " L1930," + base + " Z", far2);
    return o;
  }
