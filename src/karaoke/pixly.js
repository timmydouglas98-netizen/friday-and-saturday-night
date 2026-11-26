  // ---------- the stage screen's lettering: chunky bitmap type, the way the old karaoke machines drew it ----------
  // Lines are lettered on a tiny 384×216 screen (one dot = 5×5 TV pixels), in a Helvetica-style face with the
  // smoothing taken out, a dark outline and a drop shadow, then blown up without blurring. The colour wipes
  // across the letters dot by dot (or syllable-by-syllable when ELRC syllable marks are present) as the line is sung.
  var PIX = { W: 384, H: 216, P: 5, FAM: 'SNKPix, Arimo, "Helvetica Neue", Helvetica, Arial, sans-serif' };
  var PIXCOL = { cur: [242, 240, 236], next: [172, 170, 194], sung: [236, 186, 72], line: [58, 56, 64], shadow: [14, 12, 22], lit: [236, 186, 72], unlit: [70, 64, 84],
    p1: [96, 172, 255], p2: [255, 112, 180], both: [236, 186, 72], dim: [150, 148, 170], bgCur: [158, 156, 180] };
  function blendCol(a, b, f) { return [Math.round(a[0] * (1 - f) + b[0] * f), Math.round(a[1] * (1 - f) + b[1] * f), Math.round(a[2] * (1 - f) + b[2] * f)]; }
  // mask → letters, a one-dot outline round them, and a shadow one dot down and to the right; fillAt(x, y) picks each pixel's colour
  function pixPaint(mask, w, h, fillAt, haloCol) {
    var img = new ImageData(w, h), d = img.data, n = w * h, ink = new Uint8Array(n), x, y, i;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (mask[i]) { ink[i] = 2; continue; }
      var near = false;
      for (var dy = -1; dy <= 1 && !near; dy++) for (var dx = -1; dx <= 1; dx++) {
        var yy = y + dy, xx = x + dx; if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
        if (mask[yy * w + xx]) { near = true; break; }
      }
      if (near) ink[i] = 1;
    }
    for (y = h - 1; y >= 1; y--) for (x = w - 1; x >= 1; x--) { i = y * w + x; if (!ink[i] && ink[i - w - 1] && ink[i - w - 1] < 3) ink[i] = 3; }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x; var k = ink[i]; if (!k) continue;
        var c = k === 2 ? fillAt(x, y) : k === 1 ? (haloCol ? blendCol(PIXCOL.line, haloCol, 0.22) : PIXCOL.line) : PIXCOL.shadow, o = i * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = k === 3 ? 190 : 255;
      }
    }
    return img;
  }
  function pixMask(t, w, h) { var px = t.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); for (var i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] > 118 ? 1 : 0; return m; }
  function PixLyrics(display) {
    var dctx = display.getContext("2d"), page = null, lastKey = "", shown = null, maxWidths = [];
    var frame = document.createElement("canvas"), fctx = frame.getContext("2d");
    function noSmooth(c) { c.imageSmoothingEnabled = false; c.webkitImageSmoothingEnabled = false; c.mozImageSmoothingEnabled = false; }
    function layout(ctx, words, maxW) {
      var sp = ctx.measureText(" ").width, rows = [], row = [], w = 0;
      words.forEach(function (wd) {
        var ww = ctx.measureText(wd.w).width;
        if (row.length && w + sp + ww > maxW) { rows.push({ words: row, w: w }); row = []; w = 0; }
        row.push({ wd: wd, ww: ww }); w += (row.length > 1 ? sp : 0) + ww;
      });
      if (row.length) rows.push({ words: row, w: w });
      return { rows: rows, sp: sp };
    }
    this.resetMonotonic = function () { maxWidths = []; lastKey = ""; };
    // label: { text, col } shown small above the line (who sings it, in a duet); sungCol: the colour of the wipe
    this.setPage = function (cur, next, big, label, sungCol) {
      if (!cur) { page = null; lastKey = ""; maxWidths = []; this.clear(); return; }
      var size = big ? 22 : 19, rowH = big ? 27 : 24, maxW = PIX.W - 24, gap = 7;
      var tmp = document.createElement("canvas"), t = tmp.getContext("2d");
      tmp.width = PIX.W; tmp.height = 10; t.font = "bold " + size + "px " + PIX.FAM;
      var A = layout(t, cur.words, maxW), B = next ? layout(t, next.text.split(/\s+/).map(function (w) { return { w: w }; }), maxW) : { rows: [] };
      if (B.rows.length > 2) B.rows = B.rows.slice(0, 2);
      var labH = label ? 14 : 0, nRows = A.rows.length + B.rows.length, h = labH + nRows * rowH + (B.rows.length ? gap : 0) + 4;
      tmp.width = PIX.W; tmp.height = h; t.font = "bold " + size + "px " + PIX.FAM; t.textBaseline = "alphabetic"; t.fillStyle = "#fff";
      var rowsInfo = [], rects = [], bgZones = [], y = 2, base = Math.round(rowH * 0.74);
      if (label) {
        t.font = "bold 11px " + PIX.FAM; t.fillText(label.text, Math.round((PIX.W - t.measureText(label.text).width) / 2), y + 10);
        for (var ly = y; ly < y + labH; ly++) rowsInfo[ly] = "lab";
        y += labH; t.font = "bold " + size + "px " + PIX.FAM;
      }
      function put(L, isCur) {
        L.rows.forEach(function (r, ri) {
          var x = Math.round((PIX.W - r.w) / 2), x0 = x;
          r.words.forEach(function (it, k) {
            if (k) x += L.sp;
            var xi = Math.round(x), x1 = Math.round(x + it.ww) + 1;
            t.fillText(it.wd.w, xi, y + base);
            if (isCur) {
              if (it.wd.segs && it.wd.segs.length > 1) {
                var accTxt = "", prevX = xi;
                for (var si = 0; si < it.wd.segs.length; si++) {
                  var sg = it.wd.segs[si];
                  accTxt += sg.txt;
                  var sx1 = si === it.wd.segs.length - 1 ? x1 : Math.min(x1, Math.round(x + t.measureText(accTxt).width));
                  rects.push({ row: ri, x0: prevX, x1: Math.max(prevX + 1, sx1), a: sg.a, b: sg.b, bg: !!it.wd.bg });
                  prevX = sx1;
                }
              } else {
                rects.push({ row: ri, x0: xi, x1: x1, a: it.wd.a, b: it.wd.b, bg: !!it.wd.bg });
              }
              if (it.wd.bg) bgZones.push({ x0: xi - 1, x1: x1 + 1, y0: y, y1: y + rowH });
            }
            x += it.ww;
          });
          for (var yy = y; yy < y + rowH; yy++) rowsInfo[yy] = isCur ? "cur" : "next";
          if (isCur) r.box = { x0: x0 - 2, x1: Math.round(x0 + r.w) + 3, y0: y, y1: y + rowH };
          y += rowH;
        });
      }
      put(A, true); if (B.rows.length) { y += gap; put(B, false); }
      var mask = pixMask(t, PIX.W, h), sc = sungCol || PIXCOL.sung, lc = label ? label.col : sc, bgSung = blendCol(sc, PIXCOL.dim, 0.45);
      function isBg(xx, yy) {
        for (var bi = 0; bi < bgZones.length; bi++) {
          var z = bgZones[bi];
          if (yy >= z.y0 && yy < z.y1 && xx >= z.x0 && xx <= z.x1) return true;
        }
        return false;
      }
      var baseC = document.createElement("canvas"), sungC = document.createElement("canvas");
      baseC.width = sungC.width = PIX.W; baseC.height = sungC.height = h;
      baseC.getContext("2d").putImageData(pixPaint(mask, PIX.W, h, function (xx, yy) { var r = rowsInfo[yy]; return r === "cur" ? (isBg(xx, yy) ? PIXCOL.bgCur : PIXCOL.cur) : r === "lab" ? lc : PIXCOL.next; }), 0, 0);
      sungC.getContext("2d").putImageData(pixPaint(mask, PIX.W, h, function (xx, yy) { var r = rowsInfo[yy]; return r === "cur" ? (isBg(xx, yy) ? bgSung : sc) : r === "lab" ? lc : PIXCOL.next; }, sc), 0, 0);
      // the block sits in the lower half of the screen, lifted when it runs long
      var top = Math.max(84, Math.min(PIX.H - 14 - h, 150 - Math.round(h / 2)));
      page = { base: baseC, sung: sungC, h: h, top: top, rows: A.rows, rects: rects };
      maxWidths = [];
      lastKey = "";
    };
    this.clear = function () { if (shown) { dctx.clearRect(0, shown[0], display.width, shown[1]); shown = null; } lastKey = ""; };
    // tl: song time for the words; lit: count-in lamps still on (0–4), or -1 for none; vis: show the page at all
    this.draw = function (tl, lit, vis) {
      if (!page || !vis) { if (shown) this.clear(); return; }
      var widths = page.rows.map(function (r, ri) {
        var w = 0;
        for (var k = 0; k < page.rects.length; k++) {
          var q = page.rects[k]; if (q.row !== ri) continue;
          if (tl >= q.b) w = q.x1 - r.box.x0; else { if (tl > q.a && q.b > q.a) w = Math.round(q.x0 - r.box.x0 + (q.x1 - q.x0) * (tl - q.a) / (q.b - q.a)); break; }
        }
        // Keep highlight monotonic during normal playback (reset only on line change, seek, or nudge)
        if (maxWidths[ri] != null && w < maxWidths[ri]) w = maxWidths[ri];
        maxWidths[ri] = w;
        return w;
      });
      var key = widths.join(",") + "|" + lit;
      if (key === lastKey) return; lastKey = key;
      var top = page.top - 13, h = page.h + 13;
      if (frame.width !== PIX.W || frame.height !== h) { frame.width = PIX.W; frame.height = h; } else fctx.clearRect(0, 0, PIX.W, h); noSmooth(fctx);
      fctx.drawImage(page.base, 0, 13);
      page.rows.forEach(function (r, ri) {
        var w = Math.min(widths[ri], r.box.x1 - r.box.x0); if (w <= 0) return;
        fctx.drawImage(page.sung, r.box.x0, r.box.y0, w, r.box.y1 - r.box.y0, r.box.x0, r.box.y0 + 13, w, r.box.y1 - r.box.y0);
      });
      if (lit >= 0) for (var i = 0; i < 4; i++) {
        var x = PIX.W / 2 - 34 + i * 18;
        fctx.fillStyle = "rgb(" + PIXCOL.shadow + ")"; fctx.fillRect(x + 1, 3, 10, 9);
        fctx.fillStyle = "rgb(" + PIXCOL.line + ")"; fctx.fillRect(x - 1, 1, 10, 9);
        fctx.fillStyle = "rgb(" + (i < lit ? PIXCOL.lit : PIXCOL.unlit) + ")"; fctx.fillRect(x, 2, 8, 7);
      }
      // the display canvas holds the dots at 1:1 (CSS scales it up, pixelated); older builds used a 1920-wide canvas
      var s = display.width / PIX.W;
      if (shown) dctx.clearRect(0, shown[0], display.width, shown[1]);
      noSmooth(dctx);
      dctx.drawImage(frame, 0, 0, PIX.W, h, 0, top * s, PIX.W * s, h * s);
      shown = [top * s, h * s];
    };
  }

  // a whole screen of bitmap lettering: the countdown between singers
  // lines: [{ t, size, col, gap }]; ring: { left, of } draws a ring of dots round the last line, one going out each second
  function pixCard(display, lines, ring) {
    var ctx = display.getContext("2d"), tmp = document.createElement("canvas"), t = tmp.getContext("2d"), maxW = PIX.W - 24;
    tmp.width = PIX.W; tmp.height = PIX.H;
    var rows = [], total = 0;
    lines.forEach(function (L) {
      t.font = "bold " + L.size + "px " + PIX.FAM;
      var txt = L.t; while (txt.length > 3 && t.measureText(txt).width > maxW) txt = txt.slice(0, -2).replace(/\s+$/, "") + "…";
      var h = Math.round(L.size * 1.3); rows.push({ L: L, txt: txt, h: h }); total += h + (L.gap || 0);
    });
    var y = Math.round((PIX.H - total) / 2) - (ring ? 6 : 0), cols = [], ringC = null;
    rows.forEach(function (r) {
      y += r.L.gap || 0; r.y = y;
      t.font = "bold " + r.L.size + "px " + PIX.FAM; t.fillStyle = "#fff"; t.textBaseline = "alphabetic";
      t.fillText(r.txt, Math.round((PIX.W - t.measureText(r.txt).width) / 2), y + Math.round(r.h * .78));
      for (var yy = y; yy < y + r.h; yy++) cols[yy] = r.L.col;
      ringC = { x: PIX.W / 2, y: y + r.h / 2 + 1 };
      y += r.h;
    });
    var img = pixPaint(pixMask(t, PIX.W, PIX.H), PIX.W, PIX.H, function (xx, yy) { return cols[yy] || PIXCOL.cur; });
    t.clearRect(0, 0, PIX.W, PIX.H); t.putImageData(img, 0, 0);
    if (ring && ringC) {
      var n = 15, R = 27;
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + i / n * Math.PI * 2, x = Math.round(ringC.x + Math.cos(a) * R) - 2, yy2 = Math.round(ringC.y + Math.sin(a) * R) - 2, on = i < ring.left;
        t.fillStyle = "rgb(" + PIXCOL.shadow + ")"; t.fillRect(x + 1, yy2 + 1, 6, 6);
        t.fillStyle = "rgb(" + PIXCOL.line + ")"; t.fillRect(x - 1, yy2 - 1, 6, 6);
        t.fillStyle = "rgb(" + (on ? PIXCOL.lit : PIXCOL.unlit) + ")"; t.fillRect(x, yy2, 4, 4);
      }
    }
    var s = display.width / PIX.W;
    ctx.clearRect(0, 0, display.width, display.height);
    ctx.imageSmoothingEnabled = false; ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, PIX.W, PIX.H, 0, 0, PIX.W * s, PIX.H * s);
    return rows.map(function (r) { return { y: r.y * PIX.P, h: r.h * PIX.P }; });
  }
