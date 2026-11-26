// Automated test suite for src/karaoke/lyrics.js (works in both Node.js and macOS jsc)
var _readText = typeof readFile === "function"
  ? readFile
  : function (p) { return require("fs").readFileSync(p, "utf8"); };
var _log = typeof print === "function" ? print : console.log;

var HOST = "Rhonda";
function norm(s) {
  return String(s || "").toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

eval(_readText("src/karaoke/lyrics.js"));

var passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; _log("FAIL: " + msg); }
}
function assertNear(a, b, tol, msg) {
  assert(Math.abs(a - b) <= tol, msg + " (got " + a + ", expected " + b + " ± " + tol + ")");
}

// 1. [offset:±ms] parsing anywhere in the file (§8.1)
(function testOffset() {
  var lrc = "[offset:+500]\n[00:10.00]Hello world\n[00:12.00]<00:12.00>Word <00:12.50>two <00:13.00>";
  var rows = parseLRC(lrc);
  assert(rows.offsetMs === 500, "offsetMs parsed as +500");
  assertNear(rows[0].t, 9.5, 0.001, "positive offset makes lyrics appear sooner (10.0 - 0.5 = 9.5)");
  assertNear(rows[1].t, 11.5, 0.001, "second line shifted by offset");
  assertNear(rows[1].wt.words[0].a, 11.5, 0.001, "inline word mark shifted by offset");
  assertNear(rows[1].wt.words[1].a, 12.0, 0.001, "second inline word mark shifted by offset");
  assertNear(rows[1].wt.end, 12.5, 0.001, "inline end mark shifted by offset");

  var neg = parseLRC("[offset:-300]\n[00:05.00]Later line");
  assertNear(neg[0].t, 5.3, 0.001, "negative offset delays lyrics (5.0 + 0.3 = 5.3)");

  // Trailing [offset:] at bottom of file must still apply to earlier lines
  var trailing = parseLRC("[00:10.00]First line\n[00:14.00]Second line\n[offset:+400]");
  assertNear(trailing[0].t, 9.6, 0.001, "trailing [offset:+400] shifts earlier line 0");
  assertNear(trailing[1].t, 13.6, 0.001, "trailing [offset:+400] shifts earlier line 1");
})();

// 2. Fast consecutive lines must never overlap (§8.2)
(function testNoOverlap() {
  var lrc = "[00:01.00]Hey\n[00:01.35]Ho\n[00:01.70]Let's go\n[00:02.10]Now";
  var lines = buildLines(parseLRC(lrc), 60);
  for (var i = 0; i < lines.length - 1; i++) {
    assert(lines[i].end < lines[i + 1].t, "line " + i + " end (" + lines[i].end + ") < next start (" + lines[i + 1].t + ")");
  }
})();

// 3. Out-of-order and out-of-bounds word marks rejected & counted (§8.3, §8.5)
(function testBadWordMarks() {
  var lrc = "[00:10.00]<00:10.50>Bad <00:10.20>order\n[00:14.00]<00:14.00>Good <00:14.50>line <00:15.20>\n[00:18.00]<00:25.00>Way <00:25.50>late\n[00:20.00]Next line";
  var lines = buildLines(parseLRC(lrc), 60);
  assert(lines[0].exact === false, "out-of-order word marks fall back to estimated");
  assert(lines[1].exact === true, "valid word-timed line stays exact");
  assert(lines[2].exact === false, "out-of-bounds word marks fall back to estimated");
  assert(lines.meta.mismatches === 2, "mismatches count recorded as 2 (got " + lines.meta.mismatches + ")");
})();

// 4. Parenthetical backing vocals tagged and weighted lightly (§8.4)
(function testBackingVocals() {
  var lrc = "[00:10.00]Sing it loud (ooh yeah)\n[00:13.00]Next line";
  var lines = buildLines(parseLRC(lrc), 60);
  var ws = lines[0].words;
  assert(ws[0].bg === false && ws[1].bg === false && ws[2].bg === false, "main words not bg");
  assert(ws[3].bg === true && ws[4].bg === true, "parenthetical words tagged bg=true");
  var mainSpan = ws[2].b - ws[0].a;
  var bgSpan = ws[4].b - ws[3].a;
  assert(bgSpan < mainSpan * 0.6, "backing vocals take smaller share than main vocal words");
})();

// 5. Syllable counter accuracy on tricky songbook words
(function testSyllables() {
  var cases = [
    ["people", 2],
    ["being", 2],
    ["smiled", 1],
    ["created", 3],
    ["strengthened", 2],
    ["rhythm", 2],
    ["walked", 1],
    ["wanted", 2],
    ["little", 2]
  ];
  cases.forEach(function (c) {
    assert(countSyllables(c[0]) === c[1], "countSyllables(" + c[0] + ") === " + c[1] + " (got " + countSyllables(c[0]) + ")");
  });
})();

// 6. Fast, medium, AND slow ballad pace estimation without stretching into breaks (§7.1-7.4)
(function testPaceAcrossTempos() {
  function fmtT(sec) {
    var m = Math.floor(sec / 60), s = (sec % 60).toFixed(2);
    return "[" + (m < 10 ? "0" : "") + m + ":" + (s.length < 5 ? "0" : "") + s + "]";
  }
  [0.18, 0.26, 0.32, 0.40, 0.48].forEach(function (truePace) {
    var verse = [
      "Take my hand and walk with me",
      "Through the rain and past the sea",
      "Hold me close and say my name",
      "Every night it feels the same",
      "Turn the light down nice and low",
      "Sing the song we used to know",
      "Stay right here until the dawn",
      "Wait until the night is gone"
    ]; // each line is 7 syllables
    var t = 10.0, rows = [];
    verse.forEach(function (txt, idx) {
      rows.push(fmtT(t) + txt);
      t += 7 * truePace + 0.30;
      if (idx === 3) t += 12.0; // 12s instrumental break in the middle
    });
    rows.push(fmtT(t + 4) + "Outro line");
    var lines = buildLines(parseLRC(rows.join("\n")), 180);
    assertNear(lines.meta.pace, truePace, 0.03, "learned pace for truePace=" + truePace);
    var breakLineLen = lines[3].end - lines[3].t;
    assert(breakLineLen < 7 * truePace + 0.8, "line before 12s break not stretched (pace=" + truePace + ", len=" + breakLineLen.toFixed(2) + "s)");
    assert(breakLineLen > 7 * truePace - 0.3, "slow/fast line before break not cut short (pace=" + truePace + ", len=" + breakLineLen.toFixed(2) + "s)");
  });

  // Word-timed lines teach pace to untimed lines (§7.4)
  var mixed = [
    "[00:10.00]<00:10.00>One <00:10.40>two <00:10.80>three <00:11.20>four <00:11.60>",
    "[00:13.00]<00:13.00>Five <00:13.40>six <00:13.80>seven <00:14.20>eight <00:14.60>",
    "[00:20.00]Untimed four words here",
    "[00:35.00]End"
  ].join("\n");
  var ml = buildLines(parseLRC(mixed), 60);
  assertNear(ml.meta.pace, 0.37, 0.08, "pace learned from exact lines");
  assert(ml.meta.exactCount === 2 && ml.meta.estCount === 2, "exactCount and estCount tracked");
})();

// 7. House song exact 8-note timings (§9)
(function testHouseSong() {
  var h = houseLyrics("Rhonda");
  assert(h.exact === true, "houseLyrics is exact");
  assert(h.lines.length === 8, "houseLyrics has 8 lines");
  assertNear(h.lines[0].t, 4.8, 0.001, "house line 0 starts at 4.8s");
  assertNear(h.lines[0].end, 8.35, 0.001, "house line 0 ends at 8.35s matching 8th synth note");
  assertNear(h.lines[0].words[0].a, 4.8, 0.001, "word 0 ('Neon') at note 0");
  assertNear(h.lines[0].words[1].a, 4.8 + 2 * 0.45, 0.001, "word 1 ('humming,') at note 2");
  assertNear(h.lines[0].words[5].a, 4.8 + 7 * 0.45, 0.001, "last word ('glass') at note 7");
})();

// 8. Candidate filtering and duration-aware picking (§6.1-6.2)
(function testCandidatePicking() {
  var song = { t: "Dance Monkey", a: "Tones and I" };
  var list = [
    { id: 101, trackName: "Dance Monkey", artistName: "Tones and I", duration: 209, syncedLyrics: "[00:01.00]Short" },
    { id: 102, trackName: "Dance Monkey", artistName: "Tones and I", duration: 214, syncedLyrics: "[00:01.00]Long" },
    { id: 103, trackName: "Dance Monkey (Live)", artistName: "Tones and I", duration: 214, syncedLyrics: "[00:01.00]Live" }
  ];
  var cands = filterLyricCandidates(list, song);
  assert(cands.length === 2, "studio candidates kept, live filtered out");
  var pick214 = pickBestLyric(cands, 214.2);
  assert(pick214.id === 102, "picks candidate 102 closest to 214.2s tape");
  var pick209 = pickBestLyric(cands, 209.0);
  assert(pick209.id === 101, "picks candidate 101 closest to 209.0s tape");
})();

// 9. True sub-word ELRC syllable segments (word.segs) & bad sub-word rejection
(function testSubWordELRC() {
  var lrc = [
    "[00:10.00]<00:10.00>Ev<00:10.22>ery<00:10.45>bod<00:10.68>y <00:11.00>sing<00:11.60>",
    "[00:14.00]<00:14.00>Bad<00:13.80>syl <00:14.50>word<00:15.00>",
    "[00:16.00]<00:16.00>Over<00:22.00>shoot <00:22.50>late",
    "[00:18.00]Next line"
  ].join("\n");
  var lines = buildLines(parseLRC(lrc), 60);
  assert(lines[0].exact === true, "sub-word ELRC line is exact");
  var w0 = lines[0].words[0], w1 = lines[0].words[1];
  assert(w0.w === "Everybody", "sub-word ELRC preserves full word text");
  assertNear(w0.a, 10.00, 0.001, "word 0 start a=10.00");
  assertNear(w0.b, 11.00, 0.001, "word 0 end b=11.00");
  assert(w0.bg === false, "word 0 keeps bg flag");
  assert(w0.segs && w0.segs.length === 4, "Everybody has 4 syllable segments");
  assert(w0.segs[0].txt === "Ev" && w0.segs[1].txt === "ery" && w0.segs[2].txt === "bod" && w0.segs[3].txt === "y", "segment texts match syllables");
  assertNear(w0.segs[0].a, 10.00, 0.001, "seg 0 a=10.00");
  assertNear(w0.segs[0].b, 10.22, 0.001, "seg 0 b=10.22");
  assertNear(w0.segs[1].a, 10.22, 0.001, "seg 1 a=10.22");
  assertNear(w0.segs[1].b, 10.45, 0.001, "seg 1 b=10.45");
  assertNear(w0.segs[2].a, 10.45, 0.001, "seg 2 a=10.45");
  assertNear(w0.segs[2].b, 10.68, 0.001, "seg 2 b=10.68");
  assertNear(w0.segs[3].a, 10.68, 0.001, "seg 3 a=10.68");
  assertNear(w0.segs[3].b, 11.00, 0.001, "seg 3 b=11.00");
  assert(w1.w === "sing" && !w1.segs, "plain word without internal marks has no segs");
  assertNear(w1.a, 11.00, 0.001, "word 1 a=11.00");
  assertNear(w1.b, 11.60, 0.001, "word 1 b=11.60");
  assert(lines[1].exact === false, "out-of-order sub-word mark rejected");
  assert(lines[2].exact === false, "out-of-bounds sub-word mark rejected");
  assert(lines.meta.mismatches === 2, "sub-word rejections increment mismatches to 2");
})();

// 10. Section-aware local + global pace estimation on multi-tempo song (slow verse + 8s break + fast chorus)
(function testMultiTempoSections() {
  function fmtT(sec) {
    var m = Math.floor(sec / 60), s = (sec % 60).toFixed(2);
    return "[" + (m < 10 ? "0" : "") + m + ":" + (s.length < 5 ? "0" : "") + s + "]";
  }
  var slowVerse = [
    "Hold my hand inside the dark",
    "Watch the embers lose their spark",
    "Shadows falling on the floor",
    "Softly knocking at the door"
  ]; // 7 syl each, 0.46 s/syl
  var fastChorus = [
    "Run right through the city light",
    "Turn it up and dance all night",
    "Hands up high we touch the sky",
    "Feel the rhythm flying by"
  ]; // 7 syl each, 0.18 s/syl
  var t = 10.0, rows = [];
  slowVerse.forEach(function (txt) {
    rows.push(fmtT(t) + txt);
    t += 7 * 0.46 + 0.25;
  });
  t += 8.0; // 8s instrumental break (>= 5.0s section boundary)
  fastChorus.forEach(function (txt) {
    rows.push(fmtT(t) + txt);
    t += 7 * 0.18 + 0.25;
  });
  rows.push(fmtT(t + 6.0) + "Final fade");
  var lines = buildLines(parseLRC(rows.join("\n")), 120);
  var slowLen = lines[3].end - lines[3].t; // last verse line before 8s break
  var fastLen = lines[7].end - lines[7].t; // last chorus line before 6s break
  assert(slowLen > 2.4, "slow ballad verse line gets slower local pace (len=" + slowLen.toFixed(2) + "s)");
  assert(fastLen < 1.8, "fast chorus line gets faster local pace (len=" + fastLen.toFixed(2) + "s)");
  assert(slowLen > fastLen * 1.4, "section-aware pace clearly separates ballad verse from fast chorus (" + slowLen.toFixed(2) + "s vs " + fastLen.toFixed(2) + "s)");
  assert(lines.meta.sectionPaces && lines.meta.sectionPaces.length >= 2, "sectionPaces metadata populated");
  assert(lines.meta.sectionPaces[0] > lines.meta.sectionPaces[1] + 0.10, "section 0 pace (" + lines.meta.sectionPaces[0] + ") > section 1 pace (" + lines.meta.sectionPaces[1] + ")");
})();

// 11. Prosody-weighted word timing (function words shorter, interjections & final words held longer)
(function testProsodyWeighting() {
  var lrc = "[00:10.00]Take the night and feel oh yeah\n[00:14.00]Next line";
  var lines = buildLines(parseLRC(lrc), 60);
  var ws = lines[0].words;
  // ws: 0=Take(1.0), 1=the(0.78), 2=night(1.0), 3=and(0.78), 4=feel(1.0), 5=oh(1.45), 6=yeah(1.45+0.45)
  var dTake = ws[0].b - ws[0].a;
  var dThe = ws[1].b - ws[1].a;
  var dNight = ws[2].b - ws[2].a;
  var dAnd = ws[3].b - ws[3].a;
  var dOh = ws[5].b - ws[5].a;
  var dYeah = ws[6].b - ws[6].a;
  assert(dThe < dTake * 0.85, "unstressed function word 'the' shorter than stressed 'Take'");
  assert(dAnd < dNight * 0.85, "unstressed function word 'and' shorter than stressed 'night'");
  assertNear(dThe / dTake, 0.78, 0.02, "function word weight ratio is ~0.78x");
  assert(dOh > dTake * 1.25, "interjection 'oh' gets natural hold weight > content word");
  assert(dYeah > dOh, "final interjection 'yeah' gets both interjection and final-word hold weight");

  // Function word at end of line or with punctuation must NOT be shrunk to 0.78x
  var lrc2 = "[00:10.00]Walk with, stay with me\n[00:14.00]End";
  var l2 = buildLines(parseLRC(lrc2), 60)[0].words;
  var dWalk = l2[0].b - l2[0].a;
  var dMe = l2[4].b - l2[4].a;
  assert(dMe > dWalk, "final function word 'me' is NOT shrunk and receives final hold weight");
})();

// 12. Simultaneous-timestamp line merging (lead + parenthetical backing & dual non-parenthetical)
(function testSimultaneousMerging() {
  var lrc = [
    "[00:10.00]Sing it loud",
    "[00:10.02](ooh yeah)",
    "[00:14.00](hey now)",
    "[00:14.00]Dance all night",
    "[00:18.00]Lead line one",
    "[00:18.01]Lead line two",
    "[00:22.00]Closing line"
  ].join("\n");
  var lines = buildLines(parseLRC(lrc), 60);
  assert(lines.length === 4, "simultaneous lines merged cleanly without skipped lines (got " + lines.length + ")");
  assert(lines[0].text === "Sing it loud (ooh yeah)", "backing line merged onto lead line");
  assert(lines[0].words[0].bg === false && lines[0].words[2].bg === false, "lead words remain bg=false");
  assert(lines[0].words[3].bg === true && lines[0].words[4].bg === true, "merged backing words tagged bg=true");
  assert(lines[1].text === "Dance all night (hey now)", "reversed backing+lead order puts lead first and backing as bg=true");
  assert(lines[1].words[0].bg === false && lines[1].words[3].bg === true && lines[1].words[4].bg === true, "reversed merge tags backing words bg=true");
  assert(lines[2].text.indexOf("Lead line one") !== -1 && lines[2].text.indexOf("Lead line two") !== -1, "both non-parenthetical simultaneous lines preserved");
  for (var i = 0; i < lines.length - 1; i++) {
    assert(lines[i].end < lines[i + 1].t, "merged lines never overlap (line " + i + ")");
  }
})();

// 13. Credit & metadata line filtering while preserving nextT upper bound
(function testCreditAndMetadataFiltering() {
  var lrc = [
    "[00:00.50]Lyrics by: Max Martin",
    "[00:01.20]Composer: Shellback",
    "[00:02.00]Producer: Ryan Tedder",
    "[00:02.50]Arranged by: Greg Kurstin",
    "[00:03.00]Written by: Adele Adkins",
    "[00:03.50]作词：方文山",
    "[00:04.00]作曲：周杰伦",
    "[00:04.50]编曲：钟兴民",
    "[00:05.00][Verse 1]",
    "[00:06.00]---",
    "[00:06.50]***",
    "[00:07.00]...",
    "[00:10.00]First real sung line",
    "[00:13.00]Second sung line before break",
    "[00:15.20]Instrumental",
    "[00:16.00]纯音乐",
    "[00:25.00][Chorus]",
    "[00:26.00]Third real sung line"
  ].join("\n");
  var lines = buildLines(parseLRC(lrc), 60);
  assert(lines.length === 3, "only the 3 sung lines remain after credit/metadata filtering (got " + lines.length + ")");
  assert(lines[0].text === "First real sung line", "line 0 is first sung line");
  assert(lines[1].text === "Second sung line before break", "line 1 is second sung line");
  assert(lines[2].text === "Third real sung line", "line 2 is third sung line");
  assert(lines[1].end < 15.20, "filtered Instrumental timestamp (15.20s) still caps preceding sung line end (got " + lines[1].end.toFixed(2) + "s)");
})();

_log("Lyrics tests: " + passed + " passed, " + failed + " failed.");
if (failed > 0) throw new Error("Lyrics test suite failed (" + failed + " failures)");
