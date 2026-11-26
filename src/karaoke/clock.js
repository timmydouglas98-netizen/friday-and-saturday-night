// Playback clock for Saturday Night Karaoke (ES5 / Chromium 69 / Samsung TV safe).
// Concatenated directly inside app/bar.html's IIFE by src/build.py.
// Exposes createPlaybackClock(opts) with monotonic prediction, median-of-3 outlier rejection,
// symmetric damped PLL rate control, edge-triggered sample handling, and micro-stall freezing.

function createPlaybackClock(opts) {
  opts = opts || {};
  var nowFn = typeof opts.now === "function"
    ? opts.now
    : function () { return performance.now(); };

  var SNAP_THRESHOLD = 0.25;   // seconds: snap immediately when |diff| > 0.25s
  var PLL_TAU = 0.45;          // seconds: symmetric damped PLL time constant
  var RATE_MIN = 0.85;
  var RATE_MAX = 1.18;
  var STALL_EPS = 0.002;       // seconds: unchanged threshold for micro-stall detection
  var STALL_MS = 350;          // ms: freeze clock if reportedSec unchanged this long while playing
  var SEEK_TOL = 2.5;          // seconds: accept post-seek report within this window of target
  var SEEK_TIMEOUT_MS = 2500;  // ms: release seek hold if no matching report arrives in time
  var JITTER_WINDOW = 20;      // samples for RMS jitter readout

  var t0, at, rate, state, paused, stalled, seeking, dur;
  var clockSrc, lastReportAt, reportIntervalMs, lastCorrMs;
  var diffBuf, jitterBuf, lastReported, lastReportedChangeAt;
  var hasSynced, lastTime;

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function median3(buf) {
    var n = buf.length;
    if (n === 0) return 0;
    if (n === 1) return buf[0];
    if (n === 2) return (buf[0] + buf[1]) * 0.5;
    var a = buf[0], b = buf[1], c = buf[2];
    if (a > b) { var t1 = a; a = b; b = t1; }
    if (b > c) { var t2 = b; b = c; c = t2; }
    if (a > b) { var t3 = a; a = b; b = t3; }
    return b;
  }

  function computeRmsJitterMs() {
    var n = jitterBuf.length;
    if (!n) return 0;
    var sumSq = 0;
    for (var i = 0; i < n; i++) {
      sumSq += jitterBuf[i] * jitterBuf[i];
    }
    return Math.round(Math.sqrt(sumSq / n) * 10000) / 10;
  }

  function rawTime(now) {
    if (seeking) return seeking.target;
    if (state === 1 && !paused && !stalled) {
      var dt = (now - at) / 1000;
      if (dt < 0) dt = 0;
      var t = t0 + dt * rate;
      if (t < lastTime) t = lastTime;
      lastTime = t;
      return t;
    }
    return t0;
  }

  function reset() {
    var now = nowFn();
    t0 = 0;
    at = now;
    rate = 1;
    state = -1;
    paused = false;
    stalled = false;
    seeking = null;
    dur = 0;
    clockSrc = "init";
    lastReportAt = 0;
    reportIntervalMs = 0;
    lastCorrMs = 0;
    diffBuf = [];
    jitterBuf = [];
    lastReported = null;
    lastReportedChangeAt = now;
    hasSynced = false;
    lastTime = 0;
  }

  function setState(st) {
    if (typeof st !== "number" || isNaN(st)) return;
    if (paused && st === 1) return;
    if (st === state) return;
    var now = nowFn();
    if (state === 1 && !stalled) {
      t0 = rawTime(now);
      at = now;
      rate = 1;
    }
    state = st;
    if (st === 1) {
      at = now;
      rate = 1;
      stalled = false;
      lastReportedChangeAt = now;
    } else {
      at = now;
      rate = 1;
      stalled = false;
    }
  }

  function pause() {
    var now = nowFn();
    t0 = rawTime(now);
    at = now;
    rate = 1;
    state = 2;
    paused = true;
    stalled = false;
  }

  function resume() {
    var now = nowFn();
    paused = false;
    state = 1;
    at = now;
    rate = 1;
    stalled = false;
    lastReportedChangeAt = now;
  }

  function seekTo(targetSec, blind) {
    var now = nowFn();
    var target = typeof targetSec === "number" && isFinite(targetSec) ? Math.max(0, targetSec) : 0;
    t0 = target;
    at = now;
    rate = 1;
    lastTime = target;
    stalled = false;
    diffBuf = [];
    lastReported = null;
    lastReportedChangeAt = now;
    seeking = blind ? null : { target: target, at: now };
  }

  function report(reportedSec, ropts) {
    ropts = ropts || {};
    if (typeof ropts.dur === "number" && isFinite(ropts.dur) && ropts.dur > 0) {
      dur = ropts.dur;
    }
    if (paused) return;
    if (typeof reportedSec !== "number" || isNaN(reportedSec) || !isFinite(reportedSec)) return;

    var now = nowFn();
    if (lastReportAt > 0) {
      reportIntervalMs = Math.round(now - lastReportAt);
    }
    lastReportAt = now;

    if (typeof ropts.src === "string" && ropts.src) {
      clockSrc = ropts.src;
    }

    var repState = typeof ropts.state === "number" && !isNaN(ropts.state) ? ropts.state : state;
    var wallDelay = typeof ropts.wallDelaySec === "number" && isFinite(ropts.wallDelaySec)
      ? clamp(ropts.wallDelaySec, 0, 0.5)
      : 0;
    var adjReported = repState === 1 ? reportedSec + wallDelay : reportedSec;
    if (adjReported < 0) adjReported = 0;

    // Seek hold: keep time() at target until a playing report arrives within 2.5s of target
    // or the 2.5s timeout elapses, then snap cleanly.
    if (seeking) {
      var nearTarget = repState === 1 && Math.abs(adjReported - seeking.target) < SEEK_TOL;
      var timedOut = (now - seeking.at) >= SEEK_TIMEOUT_MS;
      if (nearTarget || timedOut) {
        if (typeof ropts.state === "number") {
          state = ropts.state;
        }
        seeking = null;
        t0 = adjReported;
        at = now;
        rate = 1;
        lastTime = t0;
        lastCorrMs = 0;
        stalled = false;
        hasSynced = true;
        diffBuf = [];
        lastReported = reportedSec;
        lastReportedChangeAt = now;
      }
      return;
    }

    if (typeof ropts.state === "number") {
      setState(ropts.state);
    }

    // If not playing, only sync on initial report or large external jump.
    if (state !== 1) {
      var nonPlayDiff = adjReported - t0;
      lastCorrMs = Math.round(nonPlayDiff * 1000);
      if (!hasSynced || Math.abs(nonPlayDiff) > SNAP_THRESHOLD) {
        t0 = adjReported;
        at = now;
        rate = 1;
        lastTime = t0;
        hasSynced = true;
        diffBuf = [];
      }
      lastReported = reportedSec;
      lastReportedChangeAt = now;
      return;
    }

    // Micro-stall detection while playing (state === 1)
    var unchanged = lastReported !== null && Math.abs(reportedSec - lastReported) < STALL_EPS;
    if (unchanged) {
      if (!stalled && (now - lastReportedChangeAt) >= STALL_MS) {
        t0 = rawTime(now);
        at = now;
        rate = 1;
        stalled = true;
        diffBuf = [];
      }
      return;
    }

    // reportedSec has advanced (or this is the very first report)
    var wasStalled = stalled;
    lastReported = reportedSec;
    lastReportedChangeAt = now;
    if (wasStalled) {
      stalled = false;
      at = now;
      rate = 1;
      diffBuf = [];
    }

    // Heartbeat / non-edge sample when already synced: ignore for PLL so quantized ticks don't bias the clock
    if (ropts.edge === false && hasSynced && !wasStalled) {
      return;
    }

    var predicted = rawTime(now);
    var diff = adjReported - predicted;
    lastCorrMs = Math.round(diff * 1000);

    // Initial sync or large recovery jump (|diff| > 0.25s)
    if (!hasSynced || Math.abs(diff) > SNAP_THRESHOLD) {
      t0 = adjReported;
      at = now;
      rate = 1;
      lastTime = t0;
      hasSynced = true;
      diffBuf = [];
      return;
    }

    // Record jitter sample for stats
    jitterBuf.push(diff);
    if (jitterBuf.length > JITTER_WINDOW) {
      jitterBuf.shift();
    }

    // Median-of-3 outlier filter on small diffs
    diffBuf.push(diff);
    if (diffBuf.length > 3) {
      diffBuf.shift();
    }
    var filteredDiff = median3(diffBuf);

    // Symmetric damped PLL rate control (zero backward steps, zero median bias)
    t0 = predicted;
    at = now;
    lastTime = t0;
    rate = clamp(1 + filteredDiff / PLL_TAU, RATE_MIN, RATE_MAX);
  }

  function time() {
    return rawTime(nowFn());
  }

  function stats() {
    return {
      clockSrc: clockSrc,
      reportIntervalMs: reportIntervalMs,
      lastCorrMs: lastCorrMs,
      rmsJitterMs: computeRmsJitterMs(),
      rate: rate,
      stalled: stalled,
      state: state,
      paused: paused,
      seeking: !!seeking
    };
  }

  reset();

  return {
    time: time,
    report: report,
    setState: setState,
    pause: pause,
    resume: resume,
    seekTo: seekTo,
    reset: reset,
    stats: stats
  };
}
