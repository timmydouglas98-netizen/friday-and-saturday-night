  // ---------- painted store: ceiling, side aisles, carpet ----------
  function prep(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function quad(ctx, p) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]); ctx.closePath(); }

  // the store is painted like the lot outside: flat paint, a hard shadow tone, brown-black ink, no soft glows
  var INK_C = "#2a1c18";
  function drawCeiling() {
    var c = prep($("ceil")), ctx = c.ctx, w = c.w, h = c.h;
    var zN = 1.25, zF = 8, sN = 1 / zN, sF = 1 / zF, k = w * 0.2;
    function Y(z) { return h * (sN - 1 / z) / (sN - sF); }
    function X(x, z) { return w / 2 + x * k / z; }
    ctx.fillStyle = "#ddd1b8"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#cbbd9f"; ctx.fillRect(0, h * 0.5, w, h * 0.5);
    ctx.strokeStyle = "#9a8a6e"; ctx.lineWidth = 1.2;
    for (var x = -14; x <= 14; x++) { ctx.beginPath(); ctx.moveTo(X(x, zN), 0); ctx.lineTo(X(x, zF), h); ctx.stroke(); }
    for (var z = 2; z < zF; z++) { ctx.beginPath(); ctx.moveTo(0, Y(z)); ctx.lineTo(w, Y(z)); ctx.stroke(); }
    [[1.4, 1.9], [2.9, 3.5], [4.4, 5], [5.9, 6.5], [7.2, 7.7]].forEach(function (zz) {
      [-9, -4, 1, 6].forEach(function (x0) {
        var x1 = x0 + 0.15, x2 = x0 + 1.85, pad = 0.22;
        // a flat painted halo, then the tube panel, inked
        quad(ctx, [X(x1 - pad, zz[0] - .12), Y(zz[0] - .12), X(x2 + pad, zz[0] - .12), Y(zz[0] - .12), X(x2 + pad, zz[1] + .12), Y(zz[1] + .12), X(x1 - pad, zz[1] + .12), Y(zz[1] + .12)]);
        ctx.fillStyle = "#efe2bd"; ctx.fill();
        quad(ctx, [X(x1, zz[0]), Y(zz[0]), X(x2, zz[0]), Y(zz[0]), X(x2, zz[1]), Y(zz[1]), X(x1, zz[1]), Y(zz[1])]);
        ctx.fillStyle = "#fffbe8"; ctx.fill(); ctx.strokeStyle = INK_C; ctx.lineWidth = 1.4; ctx.stroke();
      });
    });
    ctx.fillStyle = INK_C; ctx.fillRect(0, h - 3, w, 3);
  }

  function drawSide(cv, mirror) {
    if (!cv.clientWidth) return;
    var c = prep(cv), ctx = c.ctx, w = c.w, h = c.h, r = rand(mirror ? 97 : 31);
    if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    var zN = 1, zF = 3.4, sN = 1, sF = 1 / zF;
    function X(z) { return w * (sN - 1 / z) / (sN - sF); }
    function T(z) { return h / 2 - (h / 2) * (zN / z); }
    function B(z) { return h / 2 + (h / 2) * (zN / z); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    ctx.fillStyle = "#c99441"; ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = "#1f2a5c"; ctx.fillRect(0, h / 2, w, h / 2);
    ctx.fillStyle = "#9a6a3e";
    quad(ctx, [X(zN), T(zN), X(zF), T(zF), X(zF), B(zF), X(zN), B(zN)]); ctx.fill();
    // Background painters simplify: a few chunky spines in a small palette, each inked, with one flat light band.
    var cols = ["#2c3a74", "#c4463a", "#e6c66a", "#3f7a5a", "#efe2c4", "#5a3f78"];
    [0, 0.5].forEach(function (f) {
      var t0 = f + 0.07, t1 = f + 0.44, last = -1;
      for (var z = zN; z < zF; ) {
        var dz = 0.07 + z * 0.02, z2 = Math.min(zF, z + dz), ci = (r() * cols.length) | 0;
        if (ci === last) ci = (ci + 1) % cols.length; last = ci;
        quad(ctx, [X(z), lerp(T(z), B(z), t0), X(z2), lerp(T(z2), B(z2), t0), X(z2), lerp(T(z2), B(z2), t1), X(z), lerp(T(z), B(z), t1)]);
        ctx.fillStyle = cols[ci]; ctx.fill(); ctx.strokeStyle = INK_C; ctx.lineWidth = z < 1.6 ? 2 : 1.2; ctx.stroke();
        // spine label: one cream tab per box, at the same height all along
        var lt = t0 + (t1 - t0) * 0.62, lb = t0 + (t1 - t0) * 0.76;
        if (z < 2.6) { quad(ctx, [X(z + dz * .2), lerp(T(z), B(z), lt), X(z2 - dz * .2), lerp(T(z2), B(z2), lt), X(z2 - dz * .2), lerp(T(z2), B(z2), lb), X(z + dz * .2), lerp(T(z), B(z), lb)]); ctx.fillStyle = "rgba(255,243,214,.7)"; ctx.fill(); }
        z = z2;
      }
      var l0 = f + 0.44, l1 = f + 0.5;
      quad(ctx, [X(zN), lerp(T(zN), B(zN), l0), X(zF), lerp(T(zF), B(zF), l0), X(zF), lerp(T(zF), B(zF), l1), X(zN), lerp(T(zN), B(zN), l1)]);
      ctx.fillStyle = "#6a4426"; ctx.fill(); ctx.strokeStyle = INK_C; ctx.lineWidth = 1.5; ctx.stroke();
    });
    // the near half of the aisle falls into shade: one hard-edged tone
    ctx.fillStyle = "rgba(30,14,6,.32)"; ctx.fillRect(0, 0, w * 0.42, h);
    ctx.strokeStyle = INK_C; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(zF), T(zF)); ctx.lineTo(X(zF), B(zF)); ctx.stroke();
  }

  // 90s commercial carpet: navy, with confetti
  function drawCarpet() {
    var c = prep($("carpet")), ctx = c.ctx, w = c.w, h = c.h, r = rand(7);
    ctx.fillStyle = "#1f2a5c"; ctx.fillRect(0, 0, w, h);
    var zN = 1, zF = 5, sN = 1, sF = 1 / zF, k = w * 0.3;
    var cols = ["#2f9aa0", "#c4407a", "#e8b23a", "#7fb0e0", "#5d3f96"];
    for (var i = 0; i < 1500; i++) {
      var z = zN + r() * (zF - zN), x = (r() - 0.5) * 2 * (w / 2) / k * z;
      var y = h * (1 / z - sF) / (sN - sF), sx = w / 2 + x * k / z, s = 6 / z + 1.2, kind = i % 3;
      ctx.fillStyle = ctx.strokeStyle = cols[(r() * cols.length) | 0];
      if (kind === 0) { ctx.beginPath(); ctx.moveTo(sx, y - s * .6); ctx.lineTo(sx + s * .7, y + s * .4); ctx.lineTo(sx - s * .7, y + s * .4); ctx.closePath(); ctx.fill(); }
      else if (kind === 1) { ctx.lineWidth = Math.max(1, s * .22); ctx.beginPath(); ctx.moveTo(sx - s, y); ctx.quadraticCurveTo(sx - s * .5, y - s * .5, sx, y); ctx.quadraticCurveTo(sx + s * .5, y + s * .5, sx + s, y); ctx.stroke(); }
      else ctx.fillRect(sx, y, s * .5, s * .35);
    }
    ctx.fillStyle = "rgba(10,6,20,.35)"; ctx.fillRect(0, 0, w, 10);
  }
  function drawStore() { drawCeiling(); drawSide($("sideL"), false); drawSide($("sideR"), true); drawCarpet(); }
  // the paper tooth laid over the whole painted store (made once, kept as an image)
  (function () {
    try {
      var cv = document.createElement("canvas"); cv.width = cv.height = 256;
      var g = cv.getContext("2d"), r = rand(4242);
      for (var i = 0; i < 18; i++) {
        g.fillStyle = r() < .5 ? "rgba(90,50,20,.014)" : "rgba(255,248,226,.02)";
        g.beginPath(); g.arc(r() * 256, r() * 256, 10 + r() * 34, 0, 6.2832); g.fill();
      }
      for (i = 0; i < 1600; i++) {
        g.fillStyle = r() < .55 ? "rgba(50,26,10," + (r() * .09).toFixed(3) + ")" : "rgba(255,248,230," + (r() * .1).toFixed(3) + ")";
        var s = .6 + r() * 1.6; g.fillRect(r() * 256, r() * 256, s, s);
      }
      document.documentElement.style.setProperty("--fnv-tooth", "url(" + cv.toDataURL("image/png") + ")");
    } catch (e) {}
  })();

  // ---- the clerks, drawn the same way as everything outside ----
  function clerkPortrait(who) {
    var I = ' stroke="#2a1c18" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
    if (who === "night") {
      // Gus: lanky, shaggy hair over one eye, band tee, deeply unimpressed
      return '<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#5d4f86"/><circle cx="50" cy="50" r="50" fill="#5d4f86"/>' +
        '<path d="M8,104 Q12,80 34,75 L66,75 Q88,80 92,104 Z" fill="#26232c"' + I + '/>' +
        '<path d="M44,86 L52,80 L49,88 L57,84" fill="none" stroke="#f0b93a" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M42,62 L42,77 Q50,81 58,77 L58,62 Z" fill="#e6c09a"' + I + '/>' +
        '<ellipse cx="50" cy="49" rx="19" ry="24" fill="#efcfae"' + I + '/>' +
        '<path d="M50,66 L56,65" fill="none"' + I + '/><path d="M51,51 Q48,57 51,58" fill="none" stroke="#2a1c18" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M55,49 L64,48" fill="none"' + I + '/><circle cx="59.5" cy="51" r="1.7" fill="#2a1c18"/>' +
        '<g class="cf-lid"><path d="M54,51 L65,50" fill="none"' + I + '/></g>' +
        '<path d="M29,52 Q24,26 46,21 Q70,16 73,40 Q75,51 70,60 L68,42 Q63,31 52,33 Q46,44 33,62 Z" fill="#1d1a22"' + I + '/>' +
        '<path d="M31,38 Q44,34 50,50 Q42,46 33,50 Z" fill="#1d1a22"' + I + '/><path d="M40,30 Q50,26 60,30" fill="none" stroke="#4a4458" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="70" cy="60" r="2.4" fill="#f0b93a" stroke="#2a1c18" stroke-width="1.2"/></svg>';
    }
    // Dave: round and friendly, store cap, red polo, a moustache he's proud of
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#f0b93a"/>' +
      '<path d="M8,104 Q12,80 34,75 L66,75 Q88,80 92,104 Z" fill="#c8352b"' + I + '/>' +
      '<path d="M40,75 L50,86 L44,90 Z M60,75 L50,86 L56,90 Z" fill="#f8eedb"' + I + '/><rect x="62" y="86" width="14" height="7" rx="1.5" fill="#f8eedb" stroke="#2a1c18" stroke-width="1.4"/>' +
      '<path d="M41,62 L41,77 Q50,82 59,77 L59,62 Z" fill="#dda57a"' + I + '/>' +
      '<ellipse cx="29" cy="51" rx="4" ry="6" fill="#eab68c"' + I + '/><ellipse cx="71" cy="51" rx="4" ry="6" fill="#eab68c"' + I + '/>' +
      '<ellipse cx="50" cy="51" rx="22" ry="23" fill="#eab68c"' + I + '/>' +
      '<ellipse cx="38" cy="58" rx="4" ry="2.4" fill="#e07a6a" opacity=".45"/><ellipse cx="62" cy="58" rx="4" ry="2.4" fill="#e07a6a" opacity=".45"/>' +
      '<circle cx="42" cy="50" r="2.3" fill="#2a1c18"/><circle cx="58" cy="50" r="2.3" fill="#2a1c18"/>' +
      '<g class="cf-lid"><path d="M38,50 L46,50 M54,50 L62,50" fill="none"' + I + '/></g>' +
      '<path d="M37,44 Q42,41 46,43 M54,43 Q58,41 63,44" fill="none"' + I + '/>' +
      '<path d="M50,51 Q46,57 50,58" fill="none" stroke="#2a1c18" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M39,62 Q50,56 61,62 Q56,66 50,63 Q44,66 39,62 Z" fill="#7a4a2a"' + I + '/>' +
      '<path d="M44,68 Q50,72 56,68" fill="none"' + I + '/>' +
      '<path d="M27,41 Q27,20 50,19 Q73,20 73,41 Z" fill="#1e3d93"' + I + '/>' +
      '<path d="M26,41 Q50,47 76,40 L82,44 Q52,54 23,45 Z" fill="#16307a"' + I + '/>' +
      '<circle cx="50" cy="30" r="5" fill="#f0b93a" stroke="#2a1c18" stroke-width="1.6"/></svg>';
  }
  var resizeT = null;
  window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(function () { drawStore(); applyFocus(true); }, 200); });

  // ---------- store sounds (made live with Web Audio, nothing to download) ----------
  var ac = null, hum = null;
  function audioReady() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ac = new AC();
    }
    if (ac.state === "suspended") ac.resume();
    return true;
  }
  // the mix: sound effects and room sound (hum, ambience) each have their own level, under one master
  var mix = null;
  function buses() {
    if (mix) return mix;
    var m = ac.createGain(); m.gain.value = prefs.quiet ? 0.45 : 1; m.connect(ac.destination);
    var fx = ac.createGain(); fx.gain.value = 0.9; fx.connect(m);
    var room = ac.createGain(); room.gain.value = 1; room.connect(m);
    mix = { master: m, fx: fx, room: room };
    return mix;
  }
  function setVolume() { if (mix) mix.master.gain.setTargetAtTime(prefs.quiet ? 0.45 : 1, ac.currentTime, 0.05); }
  // the room steps back while you're talking to the clerk
  function duckRoom(on) { if (mix) mix.room.gain.setTargetAtTime(on ? 0.4 : 1, ac.currentTime, 0.12); }
  var sharedNoise = null;
  function noiseBuffer(sec) {
    if (sec <= 8 && sharedNoise) return sharedNoise;
    if (sec <= 8) sec = 8;
    var b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (sec === 8) sharedNoise = b;
    return b;
  }
  // how many banks of tubes are on: all day, fewer after 10pm, just the night lights after closing
  function lightLevel() { var h = new Date().getHours(); return h < 6 ? 0.4 : h >= 22 ? 0.7 : 1; }
  function roomNoise(out, dur, type, freq, vol, delay, pan) {
    var t0 = ac.currentTime + (delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuffer(dur);
    var f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g);
    if (pan && ac.createStereoPanner) { var p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(out); } else g.connect(out);
    src.start(t0, Math.random() * Math.max(0, 7.8 - dur)); src.stop(t0 + dur + 0.05);
    return f;
  }
  // somebody else is in the store tonight
  var CUSTOMERS = [
    function door(out) { ptone(1318, 0, 0.9, 0.022, -0.6, out); ptone(1046, 0.28, 1.2, 0.022, -0.6, out); roomNoise(out, 0.5, "lowpass", 500, 0.03, 0.05, -0.6); },
    function phone(out) {
      for (var ring = 0; ring < 2; ring++) for (var i = 0; i < 18; i++) ptone(i % 2 ? 1180 : 1020, ring * 3 + i * 0.05, 0.05, 0.016, 0.55, out);
    },
    function till(out) { roomNoise(out, 0.3, "bandpass", 700, 0.05, 0, 0.3); ptone(2620, 0.22, 0.7, 0.022, 0.3, out); ptone(3930, 0.22, 0.45, 0.01, 0.3, out); },
    function rewinder(out) { var f = roomNoise(out, 1.6, "bandpass", 500, 0.025, 0, 0.4); f.frequency.linearRampToValueAtTime(1800, ac.currentTime + 1.5); roomNoise(out, 0.06, "lowpass", 900, 0.06, 1.6, 0.4); }
  ];
  function startHum(quietStart) {
    if (P || landingOn || !audioReady() || hum) return;
    var level = lightLevel(), wx = wxKind();
    // Australian mains run at 50 Hz, so fluorescent tubes buzz at 100 Hz.
    var out = ac.createGain(); out.gain.value = 0; out.connect(buses().room);
    out.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5);
    var tubes = ac.createGain(); tubes.gain.value = level; tubes.connect(out);
    var o1 = ac.createOscillator(); o1.type = "sine"; o1.frequency.value = 100;
    var g1 = ac.createGain(); g1.gain.value = 0.02; o1.connect(g1); g1.connect(tubes);
    var o2 = ac.createOscillator(); o2.type = "triangle"; o2.frequency.value = 200;
    var g2 = ac.createGain(); g2.gain.value = 0.006; o2.connect(g2); g2.connect(tubes);
    var n = ac.createBufferSource(); n.buffer = noiseBuffer(2); n.loop = true;
    var bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 5200; bp.Q.value = 0.8;
    var g3 = ac.createGain(); g3.gain.value = 0.006; n.connect(bp); bp.connect(g3); g3.connect(tubes);
    o1.start(); o2.start(); n.start();
    var nodes = [o1, o2, n], timers = [];
    // rain on the roof, muffled through the ceiling
    if (wx === "drizzle" || wx === "rain" || wx === "storm") {
      var rn = ac.createBufferSource(); rn.buffer = noiseBuffer(3); rn.loop = true;
      var rl = ac.createBiquadFilter(); rl.type = "lowpass"; rl.frequency.value = 650;
      var rg = ac.createGain(); rg.gain.value = wx === "drizzle" ? 0.03 : wx === "storm" ? 0.09 : 0.06;
      rn.connect(rl); rl.connect(rg); rg.connect(out); rn.start(); nodes.push(rn);
    }
    if (wx === "storm") (function rumble() {
      timers.push(setTimeout(function () { if (!hum) return; roomNoise(out, 3.5, "lowpass", 90, 0.22, 0, Math.random() - 0.5); rumble(); }, 15000 + Math.random() * 25000));
    })();
    (function customer() {
      timers.push(setTimeout(function () { if (!hum) return; pickOne(CUSTOMERS)(out); customer(); }, 150000 + Math.random() * 210000));
    })();
    hum = { out: out, tubes: tubes, nodes: nodes, timers: timers, wx: wx, level: level };
    if (!quietStart) chime();
  }
  // a bank of lights switching off: a clunk, and the hum drops
  function lightsClunk(level) {
    if (prefs.sound && ac && ac.state === "running") { burst(0.08, "lowpass", 260, 0.5); tone(70, 0, 0.18, 0.12, "triangle"); }
    if (hum) { hum.tubes.gain.setTargetAtTime(level, ac.currentTime, 0.08); hum.level = level; }
  }
  function stopHum() {
    if (!hum) return;
    var h = hum; hum = null;
    (h.timers || []).forEach(clearTimeout);
    h.out.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3);
    setTimeout(function () { h.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); }, 400);
  }
  function tone(freq, start, dur, vol, type) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    o.connect(g); g.connect(buses().fx); o.start(ac.currentTime + start); o.stop(ac.currentTime + start + dur + 0.05);
  }
  function chime() { tone(1318, 0, 0.9, 0.08); tone(1046, 0.28, 1.2, 0.08); }
  function burst(dur, type, freq, vol) {
    var s = ac.createBufferSource(); s.buffer = noiseBuffer(dur);
    var f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    var g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(buses().fx);
    s.start(ac.currentTime, Math.random() * Math.max(0, 7.8 - dur)); s.stop(ac.currentTime + dur + 0.05);
    return f;
  }
  function sfx(kind) {
    if (!prefs.sound || !ac || ac.state !== "running") return;
    if (kind === "tick") burst(0.03, "bandpass", 2600, 0.25);
    else if (kind === "clack") { burst(0.07, "lowpass", 900, 0.6); tone(150, 0, 0.12, 0.15, "triangle"); }
    else if (kind === "flip") { var f = burst(0.32, "bandpass", 600, 0.22); f.frequency.linearRampToValueAtTime(2400, ac.currentTime + 0.3); }
    else if (kind === "static") burst(0.24, "highpass", 1500, 0.05);
    else if (kind === "slide") { var sl = burst(0.5, "bandpass", 300, 0.2); sl.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.45); }
    else if (kind === "chime") chime();
    else if (kind === "tickfast") burst(0.018, "bandpass", 3400, 0.2);
    else if (kind === "press") burst(0.035, "bandpass", 2000, 0.14);
    else if (kind === "close") burst(0.05, "bandpass", 800, 0.16);
    else if (kind === "tap") { burst(0.025, "bandpass", 3200, 0.14); tone(1800, 0, 0.05, 0.025); }
    else if (kind === "bell") { tone(2210, 0, 1.1, 0.045); tone(5480, 0, 0.45, 0.012); tone(3310, 0.002, 0.7, 0.014); }
    else if (kind === "shuffle") later([0, 60, 125, 185], function (i) { burst(0.022, "bandpass", 1700 + i * 120, 0.18 - i * 0.03); });
    else if (kind === "double") { burst(0.05, "lowpass", 1100, 0.38); later([120], function () { burst(0.05, "lowpass", 1250, 0.3); }); }
    else if (kind === "rustle") later([0, 45, 110, 150, 230], function () { burst(0.02 + Math.random() * 0.03, "highpass", 3800 + Math.random() * 1500, 0.07); });
    else if (kind === "tear") { var tr = burst(0.3, "bandpass", 3200, 0.16); tr.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.28); burst(0.12, "highpass", 5000, 0.05); }
    else if (kind === "shhk") { var sh = burst(0.3, "bandpass", 1400, 0.14); sh.frequency.linearRampToValueAtTime(500, ac.currentTime + 0.28); later([380], function () { burst(0.04, "lowpass", 700, 0.35); }); }
    else if (kind === "receipt") {
      // a dot-matrix receipt printer, then the tear
      later([0, 45, 90, 135, 180, 225, 270, 315, 360], function () { burst(0.03, "bandpass", 2500, 0.06); });
      var pr = burst(0.42, "bandpass", 1800, 0.05); pr.frequency.linearRampToValueAtTime(2600, ac.currentTime + 0.4);
      later([520], function () { var t2 = burst(0.09, "highpass", 3500, 0.12); t2.frequency.linearRampToValueAtTime(6000, ac.currentTime + 0.08); });
    }
    else if (kind === "rummage") later([0, 380, 720, 1100, 1350, 1720, 2080], function (i) {
      if (i === 1 || i === 4) { var sc = burst(0.35, "bandpass", 500, 0.09); sc.frequency.linearRampToValueAtTime(1200, ac.currentTime + 0.3); }
      else if (i === 3 || i === 5) { burst(0.05, "lowpass", 1100, 0.22); later([70], function () { burst(0.04, "lowpass", 1300, 0.16); }); }
      else burst(0.12, "lowpass", 180, 0.28);
    });
    else if (kind === "shiftbell") { tone(1568, 0, 0.3, 0.04); tone(1319, 0.14, 0.3, 0.04); tone(1047, 0.28, 0.55, 0.04); }
    else if (kind === "clunk") { burst(0.06, "bandpass", 1200, 0.3); tone(120, 0, 0.12, 0.12, "triangle"); }
    else if (kind === "degauss") { tone(55, 0, 0.55, 0.1, "sawtooth"); tone(110, 0, 0.35, 0.05, "sawtooth"); burst(0.45, "lowpass", 320, 0.12); }
    else if (kind === "eject") {
      burst(0.06, "lowpass", 900, 0.4); tone(140, 0, 0.1, 0.12, "triangle");
      later([140], function () { var ej = burst(0.28, "bandpass", 900, 0.12); ej.frequency.linearRampToValueAtTime(320, ac.currentTime + 0.26); });
    }
    else if (kind === "ff") { var fw = burst(0.17, "bandpass", 900, 0.1); fw.frequency.linearRampToValueAtTime(2600, ac.currentTime + 0.16); }
    else if (kind === "rew") { var rw = burst(0.17, "bandpass", 2600, 0.1); rw.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.16); }
    else if (kind === "pclick") { burst(0.02, "highpass", 2500, 0.2); tone(900, 0, 0.03, 0.05); }
    else if (kind === "creak") later([0, 28, 60, 95, 135], function (i) { burst(0.014, "bandpass", 1100 + i * 90, 0.07); });
    else if (kind === "coin") { tone(3800, 0, 0.3, 0.035); tone(5200, 0, 0.2, 0.015); later([110], function () { tone(3400, 0, 0.35, 0.03); tone(4700, 0, 0.22, 0.012); }); }
  }
  function later(times, fn) { times.forEach(function (ms, i) { setTimeout(function () { if (ac && ac.state === "running" && prefs.sound) fn(i); }, ms); }); }
  function setSound(on) {
    prefs.sound = on; save("fnv-prefs", prefs); updateCounter();
    if (on) { startHum(); if (landingOn && !entering) startAmbience(); }
    else { stopHum(); stopAmbience(); }
  }

