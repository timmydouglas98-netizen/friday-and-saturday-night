// Simulation test suite for src/karaoke/clock.js.
// Run directly: node src/tests/test-clock.js (exit 0 on pass, non-zero on failure).
"use strict";

var fs = require("fs");
var path = require("path");

var clockPath = path.join(__dirname, "..", "karaoke", "clock.js");
var clockSrc = fs.readFileSync(clockPath, "utf8");

// Load exactly as src/build.py concatenates it inside app/bar.html's strict IIFE
var createPlaybackClock = new Function('"use strict";\n' + clockSrc + "\nreturn createPlaybackClock;")();

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

function assertNear(actual, expected, tol, msg) {
  assert(
    Math.abs(actual - expected) <= tol,
    msg + " (got " + actual.toFixed(4) + ", expected " + expected.toFixed(4) + " ± " + tol + ")"
  );
}

// Deterministic PRNG (Mulberry32) so tests are 100% reproducible
function makeRng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(arr) {
  var copy = arr.slice().sort(function (a, b) { return a - b; });
  var mid = Math.floor(copy.length / 2);
  return copy.length % 2 ? copy[mid] : (copy[mid - 1] + copy[mid]) * 0.5;
}

function rms(arr) {
  var sum = 0;
  for (var i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
  return Math.sqrt(sum / arr.length);
}

// 0. Basic ES5 syntax hygiene check on clock.js
(function testEs5Compatibility() {
  var codeOnly = clockSrc.replace(/\/\/.*$/gm, "");
  assert(!/\b(let|const|class)\b/.test(codeOnly), "clock.js uses no let/const/class declarations");
  assert(!/=>/.test(codeOnly), "clock.js uses no arrow functions");
  assert(!/\?\./.test(codeOnly), "clock.js uses no optional chaining");
  assert(codeOnly.indexOf("`") === -1, "clock.js uses no template literals");
})();

// 1. Noisy ±30ms reports at 75ms intervals over 30 seconds
(function testNoisyContinuousPlayback() {
  var nowMs = 1000;
  var c = createPlaybackClock({ now: function () { return nowMs; } });
  var rng = makeRng(42);

  c.report(0, { src: "YT.Player", state: 1, dur: 210 });

  var backwardSteps = 0;
  var prevTime = c.time();
  var errorsMs = [];

  var totalMs = 30000;
  var frameMs = 15;
  var reportEveryMs = 75;
  var nextReportAt = reportEveryMs;

  for (var elapsed = frameMs; elapsed <= totalMs; elapsed += frameMs) {
    nowMs = 1000 + elapsed;
    var trueSec = elapsed / 1000;

    if (elapsed >= nextReportAt) {
      var noiseSec = (rng() * 2 - 1) * 0.030;
      c.report(Math.max(0, trueSec + noiseSec), { src: "YT.Player", state: 1 });
      nextReportAt += reportEveryMs;
    }

    var curTime = c.time();
    if (curTime < prevTime - 1e-12) {
      backwardSteps++;
    }
    prevTime = curTime;

    if (elapsed >= 1000) {
      errorsMs.push((curTime - trueSec) * 1000);
    }
  }

  var medErr = median(errorsMs);
  var rmsErr = rms(errorsMs);
  var st = c.stats();

  assert(backwardSteps === 0, "Test 1: ZERO backward steps over 30s noisy playback (got " + backwardSteps + ")");
  assert(Math.abs(medErr) <= 5, "Test 1: median error within ±5ms (got " + medErr.toFixed(2) + "ms)");
  assert(rmsErr < 18, "Test 1: RMS error < 18ms (got " + rmsErr.toFixed(2) + "ms)");
  assert(st.clockSrc === "YT.Player", "Test 1: stats.clockSrc preserved");
  assert(st.reportIntervalMs === 75, "Test 1: stats.reportIntervalMs is 75ms (got " + st.reportIntervalMs + ")");
  assert(st.rmsJitterMs > 0, "Test 1: stats.rmsJitterMs computed (" + st.rmsJitterMs + "ms)");
})();

// 2. Single +120ms outlier spike among clean ticks
(function testSingleOutlierRejection() {
  var nowMs = 5000;
  var c = createPlaybackClock({ now: function () { return nowMs; } });

  c.report(10.0, { src: "YT.Player", state: 1 });
  for (var i = 1; i <= 6; i++) {
    nowMs += 75;
    c.report(10.0 + i * 0.075, { src: "YT.Player", state: 1 });
  }

  var maxRateAfterSpike = 0;

  // Inject a single +120ms outlier spike
  nowMs += 75;
  var trueT = 10.0 + 7 * 0.075;
  c.report(trueT + 0.120, { src: "YT.Player", state: 1 });
  maxRateAfterSpike = Math.max(maxRateAfterSpike, c.stats().rate);

  for (var j = 8; j <= 14; j++) {
    nowMs += 75;
    c.report(10.0 + j * 0.075, { src: "YT.Player", state: 1 });
    maxRateAfterSpike = Math.max(maxRateAfterSpike, c.stats().rate);
  }

  assert(
    maxRateAfterSpike <= 1.05,
    "Test 2: median-of-3 filter prevents rate spike > 1.05x on +120ms outlier (max rate = " + maxRateAfterSpike.toFixed(4) + ")"
  );
})();

// 3. Micro-stall (500ms of frozen reportedSec while state === 1)
(function testMicroStallFreezeAndRecovery() {
  var nowMs = 2000;
  var c = createPlaybackClock({ now: function () { return nowMs; } });

  c.report(14.5, { src: "YT.Player", state: 1 });
  for (var i = 1; i <= 5; i++) {
    nowMs += 100;
    c.report(14.5 + i * 0.1, { src: "YT.Player", state: 1 });
  }
  assertNear(c.time(), 15.0, 0.01, "Test 3: synced at 15.0s before stall");
  assert(c.stats().stalled === false, "Test 3: not stalled before stall");

  // 500ms of frozen reportedSec = 15.0 while state === 1 (every 50ms)
  var stalledAtTime = null;
  var frozenTimeCheck = true;
  for (var ms = 50; ms <= 500; ms += 50) {
    nowMs += 50;
    c.report(15.0, { src: "YT.Player", state: 1 });
    if (c.stats().stalled) {
      if (stalledAtTime === null) {
        stalledAtTime = c.time();
      } else if (Math.abs(c.time() - stalledAtTime) > 1e-6) {
        frozenTimeCheck = false;
      }
    }
  }

  assert(c.stats().stalled === true, "Test 3: clock enters stalled=true after >=350ms unchanged reportedSec");
  assert(frozenTimeCheck, "Test 3: clock time stays frozen while stalled");

  nowMs += 100;
  assertNear(c.time(), stalledAtTime, 1e-6, "Test 3: time() remains frozen between stalled reports");

  // Audio resumes from 15.08s and advances smoothly
  nowMs += 50;
  c.report(15.08, { src: "YT.Player", state: 1 });
  assert(c.stats().stalled === false, "Test 3: stalled clears as soon as reportedSec advances");

  var prev = c.time();
  var backAfterResume = 0;
  for (var k = 1; k <= 10; k++) {
    nowMs += 75;
    c.report(15.08 + k * 0.075, { src: "YT.Player", state: 1 });
    var cur = c.time();
    if (cur < prev - 1e-12) backAfterResume++;
    prev = cur;
  }
  assert(backAfterResume === 0, "Test 3: zero backward steps after stall recovery");
  assertNear(c.time(), 15.08 + 10 * 0.075, 0.025, "Test 3: clock tracks audio smoothly after stall recovery");
})();

// 4. Instant local pause() + stale state=1 report + resume()
(function testLocalPauseAndStalePlayingReport() {
  var nowMs = 3000;
  var c = createPlaybackClock({ now: function () { return nowMs; } });

  c.report(25.0, { src: "YT.Player", state: 1, dur: 180 });
  nowMs += 200;
  assertNear(c.time(), 25.2, 0.005, "Test 4: playing at 25.2s before pause");

  c.pause();
  var pausedAt = c.time();
  assert(c.stats().paused === true, "Test 4: stats.paused is true");
  assert(c.stats().state === 2, "Test 4: stats.state is 2");
  assertNear(pausedAt, 25.2, 0.001, "Test 4: freezes within 0ms at 25.2s");

  nowMs += 150;
  c.setState(1);
  c.report(25.35, { src: "YT.Player", state: 1, dur: 195 });
  assert(c.stats().paused === true, "Test 4: remains paused after stale state=1 report");
  assert(c.stats().state === 2, "Test 4: state stays 2 after stale setState(1)");
  assertNear(c.time(), pausedAt, 1e-6, "Test 4: clock stays frozen and ignores stale playing report");

  nowMs += 500;
  assertNear(c.time(), pausedAt, 1e-6, "Test 4: clock does not drift while paused");

  c.resume();
  assert(c.stats().paused === false, "Test 4: stats.paused is false after resume");
  assert(c.stats().state === 1, "Test 4: stats.state is 1 after resume");
  assertNear(c.time(), pausedAt, 1e-6, "Test 4: resumes from exact paused time");

  nowMs += 250;
  assertNear(c.time(), pausedAt + 0.25, 0.005, "Test 4: advances smoothly after resume");
})();

// 5. seekTo(90) + stale pre-seek reports at t=20
(function testSeekHoldAndSnap() {
  var nowMs = 4000;
  var c = createPlaybackClock({ now: function () { return nowMs; } });

  c.report(20.0, { src: "YT.Player", state: 1 });
  nowMs += 100;
  assertNear(c.time(), 20.1, 0.005, "Test 5: playing at 20.1s before seek");

  c.seekTo(90, false);
  assert(c.stats().seeking === true, "Test 5: stats.seeking is true after seekTo(90)");
  assertNear(c.time(), 90.0, 1e-6, "Test 5: time() holds at 90.0 immediately after seekTo");

  for (var i = 1; i <= 6; i++) {
    nowMs += 100;
    c.report(20.1 + i * 0.1, { src: "YT.Player", state: 1 });
    assert(c.stats().seeking === true, "Test 5: still seeking on stale report #" + i);
    assertNear(c.time(), 90.0, 1e-6, "Test 5: time() still held at 90.0 on stale report #" + i);
  }

  nowMs += 100;
  c.report(90.0, { src: "YT.Player", state: 3 });
  assert(c.stats().seeking === true, "Test 5: buffering report near target does not release seek early");
  assertNear(c.time(), 90.0, 1e-6, "Test 5: time() held at 90.0 during post-seek buffering");

  nowMs += 100;
  c.report(90.3, { src: "YT.Player", state: 1 });
  assert(c.stats().seeking === false, "Test 5: seeking clears when playing report near 90 arrives");
  assertNear(c.time(), 90.3, 1e-6, "Test 5: snaps cleanly to 90.3");

  nowMs += 200;
  assertNear(c.time(), 90.5, 0.005, "Test 5: advances cleanly from snapped seek position");

  // Blind seek sets seeking = null immediately
  c.seekTo(45, true);
  assert(c.stats().seeking === false, "Test 5: blind seek does not enter seeking hold");
  assertNear(c.time(), 45.0, 1e-6, "Test 5: blind seek jumps directly to target");
})();

// 6. Edge-triggered 100ms quantized player simulation (16ms rAF-like polling)
(function testEdgeTriggeredQuantizedPlayer() {
  var nowMs = 10000;
  var c = createPlaybackClock({ now: function () { return nowMs; } });

  // Simulate a 100ms quantized player polled every 16ms (not aligned to 100ms boundaries).
  // When getCurrentTime() ticks to a new 0.1s step, player sends edge:true with wallDelaySec;
  // on unchanged polls (every ~48ms), player sends edge:false heartbeat.
  var lastQuant = 0;
  var maxAbsErrMs = 0;
  var backwardSteps = 0;
  var prevTime = 0;

  c.report(0, { src: "YT.Player", state: 1, edge: true, wallDelaySec: 0 });

  var totalMs = 15000;
  var pollMs = 16;
  var pollCount = 0;

  for (var elapsed = pollMs; elapsed <= totalMs; elapsed += pollMs) {
    pollCount++;
    nowMs = 10000 + elapsed;
    var trueSec = elapsed / 1000;
    var quant = Math.floor(trueSec * 10 + 1e-9) / 10;

    if (quant > lastQuant + 1e-9) {
      // Edge caught up to 16ms after boundary; report with realistic 4ms transport delay
      c.report(quant, { src: "YT.Player", state: 1, edge: true, wallDelaySec: 0.004 });
      lastQuant = quant;
    } else if (pollCount % 3 === 0) {
      c.report(quant, { src: "YT.Player", state: 1, edge: false, wallDelaySec: 0.004 });
    }

    var curTime = c.time();
    if (curTime < prevTime - 1e-12) backwardSteps++;
    prevTime = curTime;

    if (elapsed >= 500) {
      var errMs = Math.abs(curTime - trueSec) * 1000;
      if (errMs > maxAbsErrMs) maxAbsErrMs = errMs;
    }
  }

  assert(backwardSteps === 0, "Test 6: ZERO backward steps in quantized edge-triggered mode");
  assert(
    maxAbsErrMs <= 15,
    "Test 6: edge-triggered reports track true audio time within ±15ms (max err = " + maxAbsErrMs.toFixed(2) + "ms)"
  );
})();

// 7. Buffering state freeze and reset()
(function testBufferingAndReset() {
  var nowMs = 8000;
  var c = createPlaybackClock({ now: function () { return nowMs; } });
  c.report(42.0, { src: "infoDelivery", state: 1 });
  nowMs += 300;
  c.setState(3); // buffering
  var bufTime = c.time();
  nowMs += 400;
  assertNear(c.time(), bufTime, 1e-6, "Test 7: setState(3) freezes clock immediately");

  c.reset();
  var st = c.stats();
  assert(c.time() === 0, "Test 7: reset() zeroes time()");
  assert(st.state === -1 && st.paused === false && st.stalled === false && st.seeking === false, "Test 7: reset() clears state flags");
  assert(st.clockSrc === "init" && st.rate === 1 && st.rmsJitterMs === 0, "Test 7: reset() clears stats");
})();

console.log("Playback clock tests: " + passed + " passed, " + failed + " failed.");
if (failed) process.exit(1);
