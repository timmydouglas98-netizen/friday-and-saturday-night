// Track-matching, description intro parsing, and two-point drift fit helpers for Saturday Night Karaoke.
// Pure ES5 (Chromium 69 / Samsung TV safe), strict-mode IIFE-safe.
// Concatenated inside app/bar.html's IIFE by src/build.py (where norm, cleanTitle, firstArtist exist),
// and also works standalone in Node.js for unit testing.

function parseDescIntroSec(desc) {
  if (!desc || typeof desc !== "string") return null;
  var lines = String(desc).split(/\r?\n/);
  var tsRe = /\b(\d+):(\d{2})(?::(\d{2}))?\b/;
  // only markers that mean "the singing starts here". A Chorus (or Bridge) chapter isn't the first vocal: the verse
  // before it may simply not be marked, so it's only used when it comes straight after an Intro chapter (below).
  var vocalRe = /\b(vocals?|verse(?:\s*\d+)?|lyrics?\s+(?:start|begin)s?|song\s+starts?|starts?|begins?|singing)\b/i;
  var introRe = /\b(intro|count[\s-]?in|countdown|music\s+intro|instrumental\s+intro)\b/i;
  var chapters = [];
  var i, line, m, sec;

  for (i = 0; i < lines.length; i++) {
    line = lines[i];
    m = tsRe.exec(line);
    if (!m) continue;
    if (m[3] !== undefined) {
      var h = +m[1], mm = +m[2], ss = +m[3];
      if (mm >= 60 || ss >= 60) continue;
      sec = h * 3600 + mm * 60 + ss;
    } else {
      var m1 = +m[1], s1 = +m[2];
      if (s1 >= 60) continue;
      sec = m1 * 60 + s1;
    }
    chapters.push({ sec: sec, line: line });
    // a chapter labelled just "Song" (e.g. "0:09 Song") marks the start too; "song" inside a sentence doesn't
    var label = line.replace(tsRe, "").replace(/[^a-z]+/gi, " ").trim().toLowerCase();
    if (sec > 0 && sec <= 60 && (vocalRe.test(line) || label === "song")) {
      return sec;
    }
  }

  for (i = 0; i < chapters.length - 1; i++) {
    if (chapters[i].sec === 0 && introRe.test(chapters[i].line)) {
      var nextSec = chapters[i + 1].sec;
      if (nextSec >= 2 && nextSec <= 35) {
        return nextSec;
      }
    }
  }

  return null;
}

function nearestDurDiff(vDur, candDurs) {
  if (!(vDur > 0)) return 0;
  if (typeof candDurs === "number") return candDurs > 0 ? Math.abs(vDur - candDurs) : 0;
  if (!Array.isArray(candDurs) || !candDurs.length) return 0;
  var best = 1e9;
  for (var i = 0; i < candDurs.length; i++) {
    var d = Math.abs(vDur - candDurs[i]);
    if (d < best) best = d;
  }
  return best < 1e8 ? best : 0;
}

function rankVideos(list, song, mode, candDurs) {
  var normFn = typeof norm === "function"
    ? norm
    : function (s) { return String(s || "").toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); };
  var cleanTitleFn = typeof cleanTitle === "function"
    ? cleanTitle
    : function (t) { return String(t || "").replace(/\s*\((?!I've).*?\)\s*/g, " ").replace(/^\.+/, "").trim() || String(t || ""); };
  var firstArtistFn = typeof firstArtist === "function"
    ? firstArtist
    : function (a) { return String(a || "").split(/\s+(?:&|feat\.?|ft\.?|with|and)\s+|,\s*/i)[0]; };

  var nt = normFn(song.t);
  var bad = mode === "back"
    ? /\b(cover|live|remix|reaction|tutorial|lesson|piano|guitar|slowed|sped|8d|nightcore|lower key|higher key|drum|bass only)\b/
    : /\b(cover|live|remix|reaction|tutorial|lesson|karaoke|instrumental|slowed|sped|8d|nightcore|lyrics?)\b/;
  var want = /\b(instrumental|karaoke|backing|minus one|no vocals)\b/;
  function low(x) { return String(x).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
  var artFull = low(song.a), art = low(firstArtistFn(song.a)), seen = {};
  var cleanT = low(cleanTitleFn(song.t));

  return (list || []).filter(function (v) {
    if (!v || seen[v.id]) return false;
    seen[v.id] = 1;
    return true;
  }).map(function (v) {
    var full = low(v.title), t = full.replace(cleanT, " ");
    var d = nearestDurDiff(v.dur, candDurs);
    var sc = d * 1.5 + (v.rank || 0) * 0.4;
    var ch = low(v.ch);
    var isTopic = / topic$/.test(ch) || /provided to youtube by/i.test(v.desc || "");
    var isArtistCh = (artFull && ch.indexOf(artFull) !== -1) || (art && ch.indexOf(art) !== -1);
    var isVevo = /\bvevo\b/.test(ch);
    var official = isTopic || isArtistCh || isVevo;

    if (bad.test(t)) sc += 40;
    if (mode === "back" && !want.test(t)) sc += 60;
    if (full.indexOf(cleanT) === -1 && full.indexOf(nt) === -1) sc += 30;

    if (mode === "band") {
      if (isTopic) sc -= 20;
      else if (isArtistCh && /official audio/.test(t)) sc -= 14;
      else if (isArtistCh || isVevo) sc -= 6;
    } else {
      if (official && /instrumental/.test(t)) sc -= 14;
      if (/official instrumental/.test(t)) sc -= 6;
      if (/\bkaraoke\b/.test(t) && !official) sc += 3;
      if (/\b(official|original|studio|album)\s+instrumental\b/.test(t) || /\b(stems?|multitrack)\b/.test(t)) sc -= 12;
      if (d > 0 && d <= 1.5) sc -= 4;
      if (!official && /\b(karaoke version|in the style of|made famous by|tribute)\b/.test(t)) sc += 6;
    }

    return {
      id: v.id,
      dur: v.dur || 0,
      d: d,
      sc: sc,
      official: official,
      ch: v.ch,
      introSec: parseDescIntroSec(v.desc)
    };
  }).sort(function (a, b) { return a.sc - b.sc; });
}

function fitTwoPointShift(pts, minSpanSec, maxSlope) {
  if (!Array.isArray(pts) || pts.length < 2) return null;
  var p1 = pts[0], p2 = pts[pts.length - 1];
  var span = p2.t - p1.t;
  var minSpan = minSpanSec || 30;
  var maxS = maxSlope || 0.05;
  if (span < minSpan) return null;
  var b = (p2.off - p1.off) / span;
  if (Math.abs(b) > maxS) return null;
  return {
    a: Math.round((p1.off - b * p1.t) * 1000) / 1000,
    b: Math.round(b * 100000) / 100000
  };
}

// Adds a timing anchor where the singer corrected the words (t: song time, off: the new offset, dir: +1 later / -1
// earlier). An anchor within 15 s of the last one replaces it: that's still the same correction being fine-tuned.
function addDriftPoint(pts, t, off, dir) {
  var out = Array.isArray(pts) ? pts.slice() : [];
  var pt = { t: t, off: off, dir: dir > 0 ? 1 : dir < 0 ? -1 : 0 };
  if (out.length && Math.abs(t - out[out.length - 1].t) <= 15) out[out.length - 1] = pt;
  else out.push(pt);
  return out;
}

// Tempo drift from the anchors, or null for "no drift: just a fixed offset". A backing track that runs slow or fast
// keeps needing nudges the same way; one nudge back against the previous one is an overshoot being corrected, not
// drift. So the fit uses the latest run of anchors whose offsets all move one way, and needs either two such steps
// in a row, or one step in the same direction as the nudge that set the run's first anchor.
function fitDriftShift(pts, minSpanSec, maxSlope) {
  if (!Array.isArray(pts) || pts.length < 2) return null;
  function sgn(x) { return x > 1e-9 ? 1 : x < -1e-9 ? -1 : 0; }
  var n = pts.length, s = sgn(pts[n - 1].off - pts[n - 2].off);
  if (!s) return null;
  var i = n - 2;
  while (i > 0 && sgn(pts[i].off - pts[i - 1].off) === s) i--;
  if (n - 1 - i < 2 && (pts[i].dir || 0) !== s) return null;
  return fitTwoPointShift(pts.slice(i), minSpanSec, maxSlope);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseDescIntroSec: parseDescIntroSec,
    nearestDurDiff: nearestDurDiff,
    rankVideos: rankVideos,
    fitTwoPointShift: fitTwoPointShift,
    addDriftPoint: addDriftPoint,
    fitDriftShift: fitDriftShift
  };
}
