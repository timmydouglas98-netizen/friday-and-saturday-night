// Test suite for src/karaoke/track-match.js
// Run directly: node src/tests/test-track-match.js (exit 0 on pass, non-zero on failure).
"use strict";

var fs = require("fs");
var path = require("path");

var modPath = path.join(__dirname, "..", "karaoke", "track-match.js");
var modSrc = fs.readFileSync(modPath, "utf8");

function norm(s) {
  return String(s || "").toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function firstArtist(a) {
  return String(a || "").split(/\s+(?:&|feat\.?|ft\.?|with|and)\s+|,\s*/i)[0];
}
function cleanTitle(t) {
  return String(t || "").replace(/\s*\((?!I've).*?\)\s*/g, " ").replace(/^\.+/, "").trim() || String(t || "");
}

// Load inside strict IIFE context just like app/bar.html
var tm = new Function(
  "norm", "cleanTitle", "firstArtist",
  '"use strict";\n' + modSrc + "\nreturn { parseDescIntroSec: parseDescIntroSec, nearestDurDiff: nearestDurDiff, rankVideos: rankVideos, fitTwoPointShift: fitTwoPointShift, addDriftPoint: addDriftPoint, fitDriftShift: fitDriftShift };"
)(norm, cleanTitle, firstArtist);

var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("FAIL: " + msg);
  }
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, msg + " (got " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected) + ")");
}

function assertNear(actual, expected, tol, msg) {
  assert(
    typeof actual === "number" && Math.abs(actual - expected) <= tol,
    msg + " (got " + actual + ", expected " + expected + " +/- " + tol + ")"
  );
}

// 1. parseDescIntroSec tests
(function testParseDescIntroSec() {
  assertEq(
    tm.parseDescIntroSec("0:00 Intro\n0:12 Verse 1\n0:45 Chorus"),
    12,
    "chapter list with Verse 1"
  );
  assertEq(
    tm.parseDescIntroSec("0:08 Vocals\n1:02 Bridge"),
    8,
    "chapter list with Vocals"
  );
  assertEq(
    tm.parseDescIntroSec("0:10 Start\n0:50 Chorus"),
    10,
    "chapter list with Start"
  );
  assertEq(
    tm.parseDescIntroSec("0:09 Song\n1:15 Outro"),
    9,
    "chapter list with Song"
  );
  assertEq(
    tm.parseDescIntroSec("Official Instrumental\nLyrics start at 0:12\nEnjoy!"),
    12,
    "inline Lyrics start at 0:12"
  );
  assertEq(
    tm.parseDescIntroSec("0:00 Intro\n0:11 Main Theme\n0:45 Part B"),
    11,
    "0:00 Intro followed by 0:11 second chapter"
  );
  assertEq(
    tm.parseDescIntroSec("0:00 Count-in\n0:05 Let's go"),
    5,
    "0:00 Count-in followed by 0:05 second chapter"
  );
  assertEq(
    tm.parseDescIntroSec("0:00 Intro\n0:45 Part B"),
    null,
    "0:00 Intro followed by >35s chapter returns null"
  );
  assertEq(
    tm.parseDescIntroSec("Official music video. Subscribe for more hits!"),
    null,
    "non-chapter description returns null"
  );
  assertEq(
    tm.parseDescIntroSec(""),
    null,
    "empty description returns null"
  );
})();

// 2. nearestDurDiff & rankVideos tests
(function testRankVideos() {
  assertEq(tm.nearestDurDiff(200, [198, 205]), 2, "nearestDurDiff picks closest duration");
  assertEq(tm.nearestDurDiff(200, 203), 3, "nearestDurDiff handles single number");
  assertEq(tm.nearestDurDiff(0, [200]), 0, "nearestDurDiff returns 0 when vDur is 0");

  var song = { a: "The Killers", t: "Mr. Brightside" };

  // Back mode: studio/official instrumental beats karaoke version / in the style of
  var backList = [
    { id: "kar1", title: "Mr. Brightside (Karaoke Version)", ch: "Sing King", desc: "Lyrics start at 0:08", dur: 223, rank: 0 },
    { id: "kar2", title: "Mr. Brightside (In the Style of The Killers) Karaoke", ch: "Karaoke Hits", desc: "", dur: 223, rank: 1 },
    { id: "stu1", title: "Mr. Brightside (Studio Instrumental)", ch: "Island Records", desc: "0:00 Intro\n0:10 Verse 1", dur: 223, rank: 2 },
    { id: "off1", title: "Mr. Brightside (Official Instrumental)", ch: "The Killers", desc: "", dur: 222, rank: 3 }
  ];
  var rankedBack = tm.rankVideos(backList, song, "back", [222]);
  assertEq(rankedBack[0].id, "off1", "official instrumental on artist channel ranks first in back mode");
  assertEq(rankedBack[1].id, "stu1", "studio instrumental ranks ahead of karaoke covers");
  assertEq(rankedBack[1].introSec, 10, "introSec populated from description on ranked video");
  assertEq(rankedBack[2].id, "kar1", "karaoke version ranks below studio instrumental");
  assertEq(rankedBack[2].introSec, 8, "introSec populated for inline timestamp");
  assertEq(rankedBack[3].id, "kar2", "in the style of karaoke ranks last");

  // Tight duration match boost (-4) when d > 0 && d <= 1.5
  var tightList = [
    { id: "loose", title: "Mr. Brightside (Instrumental)", ch: "Generic Backing", desc: "", dur: 225, rank: 0 },
    { id: "tight", title: "Mr. Brightside (Instrumental)", ch: "Generic Backing", desc: "", dur: 223, rank: 0 }
  ];
  var rankedTight = tm.rankVideos(tightList, song, "back", [222]);
  assertEq(rankedTight[0].id, "tight", "tight duration match (d=1) beats looser match (d=3)");

  // Band mode: Topic tracks first
  var bandList = [
    { id: "vevo", title: "Mr. Brightside (Official Music Video)", ch: "TheKillersVEVO", desc: "", dur: 227, rank: 0 },
    { id: "art", title: "Mr. Brightside (Official Audio)", ch: "The Killers", desc: "", dur: 222, rank: 1 },
    { id: "topic", title: "Mr. Brightside", ch: "The Killers - Topic", desc: "Provided to YouTube by Universal", dur: 222, rank: 2 }
  ];
  var rankedBand = tm.rankVideos(bandList, song, "band", [222]);
  assertEq(rankedBand[0].id, "topic", "Topic track ranks first in band mode");
  assertEq(rankedBand[1].id, "art", "Official audio on artist channel ranks second in band mode");
  assertEq(rankedBand[2].id, "vevo", "VEVO music video ranks third in band mode");
})();

// 3. fitTwoPointShift tests
(function testFitTwoPointShift() {
  // Positive slope: +1.0s at t=10s, +3.0s at t=90s -> b = 0.025, a = 0.75
  var pos = tm.fitTwoPointShift([{ t: 10, off: 1.0 }, { t: 90, off: 3.0 }]);
  assert(pos !== null, "positive slope within bounds returns object");
  assertNear(pos.a, 0.75, 1e-6, "positive slope intercept a");
  assertNear(pos.b, 0.025, 1e-6, "positive slope b");

  // Negative slope: +5.0s at t=10s, +3.5s at t=90s -> b = -0.01875, a = 5.188
  var neg = tm.fitTwoPointShift([{ t: 10, off: 5.0 }, { t: 50, off: 4.25 }, { t: 90, off: 3.5 }]);
  assert(neg !== null, "negative slope within bounds returns object");
  assertNear(neg.a, 5.188, 1e-6, "negative slope intercept a");
  assertNear(neg.b, -0.01875, 1e-6, "negative slope b");

  // Short span (< 30s) -> null
  assertEq(
    tm.fitTwoPointShift([{ t: 10, off: 1.0 }, { t: 35, off: 1.5 }]),
    null,
    "span < 30s returns null"
  );

  // Excessive slope (> 0.05) -> null
  assertEq(
    tm.fitTwoPointShift([{ t: 10, off: 1.0 }, { t: 90, off: 6.0 }]),
    null,
    "slope > 0.05 returns null"
  );
  assertEq(
    tm.fitTwoPointShift([{ t: 10, off: 6.0 }, { t: 90, off: 1.0 }]),
    null,
    "negative slope < -0.05 returns null"
  );

  // Insufficient points -> null
  assertEq(tm.fitTwoPointShift([{ t: 10, off: 1.0 }]), null, "single point returns null");
})();

// 4. chapters: only real "singing starts here" markers
(function testChapterMarkers() {
  assertEq(tm.parseDescIntroSec("Karaoke version\n0:38 Chorus\n1:50 Bridge"), null, "a lone Chorus chapter isn't the first vocal");
  assertEq(tm.parseDescIntroSec("0:00 Intro\n0:21 Chorus\n1:10 Verse"), 21, "a Chorus straight after an Intro chapter still counts");
  assertEq(tm.parseDescIntroSec("Full song lyrics below\n0:30 Lyrics"), null, "a bare 'Lyrics' chapter isn't a start marker");
  assertEq(tm.parseDescIntroSec("Lyrics begin 0:14"), 14, "'Lyrics begin' is");
  assertEq(tm.parseDescIntroSec("Stream the song on Spotify! New single 1:23"), null, "promo text with a time isn't a marker");
  assertEq(tm.parseDescIntroSec("0:00 Intro\n0:12 Verse 1\n0:45 Chorus"), 12, "a marked verse still wins");
})();

// 5. drift: learned only while the nudges keep going one way
(function testDrift() {
  function run(steps) { var pts = []; steps.forEach(function (x) { pts = tm.addDriftPoint(pts, x[0], x[1], x[2]); }); return { pts: pts, fit: tm.fitDriftShift(pts, 45, 0.03) }; }
  // the case that used to go wrong: +0.5 s, then a -0.1 s trim a minute later, is an overshoot, not a slowing track
  assertEq(run([[20, 0.5, 1], [90, 0.4, -1]]).fit, null, "nudge then trim back: a fixed offset, no drift");
  var slow = run([[20, 0.3, 1], [80, 0.6, 1]]).fit;
  assert(slow && slow.b > 0, "two nudges the same way a minute apart: drift learned");
  var fast = run([[20, 0.5, 1], [80, 0.3, -1], [140, 0.1, -1]]).fit;
  assert(fast && fast.b < 0, "a track that keeps running fast: drift learned after two steps the same way");
  assertNear(fast.a + fast.b * 140, 0.1, 1e-3, "and it passes through the latest correction");
  assertEq(run([[20, 0.5, 1], [90, 0.4, -1], [150, 0.6, 1]]).fit, null, "zig-zag corrections: no drift");
  var later = run([[20, 0.5, 1], [90, 0.4, -1], [150, 0.6, 1], [210, 0.8, 1]]).fit;
  assert(later && later.b > 0, "then a steady run the same way: drift learned from that run only");
  assertNear(later.a + later.b * 90, 0.4, 1e-3, "the run starts at the trimmed anchor");
  var tweak = run([[20, 0.3, 1], [25, 0.2, -1]]);
  assertEq(tweak.pts.length, 1, "a fine-tune within 15 s replaces the anchor");
  assertEq(tweak.fit, null, "and alone gives no drift");
  var held = run([[20, 0.3, 1], [80, 0.6, 1], [85, 0.65, 1]]).fit;
  assert(held && held.b > 0, "a fine-tune of the latest anchor keeps the drift");
})();

console.log("track-match tests: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
