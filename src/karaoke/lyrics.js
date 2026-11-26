  // ---------- lyrics parser, per-song syllable pace estimator & candidate picker ----------
  function firstArtist(a) { return String(a || "").split(/\s+(?:&|feat\.?|ft\.?|with|and)\s+|,\s*/i)[0]; }
  function cleanTitle(t) { return String(t || "").replace(/\s*\((?!I've).*?\)\s*/g, " ").replace(/^\.+/, "").trim() || String(t || ""); }

  var SYL_EXC = {
    people: 2, rhythm: 2, being: 2, seeing: 2, going: 2, doing: 2, trying: 2, flying: 2, crying: 2, dying: 2, lying: 2,
    created: 3, create: 2, every: 2, evening: 2, different: 2, business: 2, fire: 2, hour: 2, choir: 2, quiet: 2,
    poem: 2, poet: 2, real: 1, beautiful: 3, heaven: 2, seven: 2, eleven: 3, someone: 2, somewhere: 2, forever: 3,
    believe: 2, angel: 2, little: 2, bottle: 2, trouble: 2, candle: 2, middle: 2
  };

  var FUNC_WORDS = {
    a: 1, an: 1, the: 1, to: 1, of: 1, in: 1, on: 1, at: 1, for: 1, and: 1, or: 1, but: 1,
    is: 1, it: 1, my: 1, your: 1, you: 1, i: 1, we: 1, he: 1, she: 1, they: 1, so: 1,
    as: 1, by: 1, be: 1, me: 1
  };

  var HOLD_WORDS = {
    ooh: 1, aah: 1, yeah: 1, whoa: 1, oh: 1, hey: 1, la: 1
  };

  function countSyllables(word) {
    var w = String(word || "").toLowerCase().replace(/[^a-zà-öø-ÿ']/g, "").replace(/'/g, "");
    if (!w) return 1;
    if (SYL_EXC[w]) return SYL_EXC[w];
    if (w.length <= 2) return 1;
    var core = w, extra = 0;
    // Consonant + "le" at end adds a syllable (e.g. "simple", "purple", "table")
    if (/[^aeiouyà-öø-ÿ]le$/.test(core) && core.length > 3) {
      extra++;
      core = core.slice(0, -2);
    } else if (/[^aeiouyà-öø-ÿtd]ed$/.test(core) && core.length > 3) {
      // Silent "-ed" after consonants other than t or d (e.g. "smiled", "strengthened", "walked")
      core = core.slice(0, -2);
    } else if (/[^laeiouyà-öø-ÿ]e$/.test(core) && core.length > 2) {
      // Silent trailing "-e"
      core = core.slice(0, -1);
    }
    if (!core) core = w;
    var groups = core.match(/[aeiouyà-öø-ÿ]+/g);
    var n = (groups ? groups.length : 0) + extra;
    // Common vowel hiatus pairs that span two syllables
    if (/ia|io|ua/.test(core)) n++;
    if (/eo/.test(core) && core !== "peopl") n++;
    return Math.max(1, n);
  }

  // Flag tokens inside (...) as backing vocals so they can be drawn dimmer and weighted lightly
  function tagBackingWords(words) {
    var depth = 0;
    return words.map(function (w) {
      var opens = (w.match(/\(/g) || []).length, closes = (w.match(/\)/g) || []).length;
      var inBg = depth > 0 || (opens > 0 && w.charAt(0) === "(");
      depth = Math.max(0, depth + opens - closes);
      return { w: w, bg: inBg };
    });
  }

  function isAllBackingText(txt) {
    var ws = String(txt || "").trim().split(/\s+/);
    if (!ws.length || !ws[0]) return false;
    var tagged = tagBackingWords(ws);
    for (var i = 0; i < tagged.length; i++) {
      if (!tagged[i].bg) return false;
    }
    return true;
  }

  // Detect non-sung credit, metadata, section header, instrumental, and separator lines
  function isNonSungLine(txt) {
    var t = String(txt || "").trim();
    if (!t) return true;
    if (/^[♪♫♬♩\s\-—–_*•·.=~|/\\]+$/.test(t)) return true;
    if (/^\[[^\]]{1,40}\]$/.test(t)) return true;
    if (/^[\(\[\-—–~\s]*(?:instrumental|interlude|guitar\s+solo|piano\s+solo|music\s+only|纯音乐|间奏|前奏|尾奏)[\)\]\-—–~\s.!]*$/i.test(t)) return true;
    if (/纯音乐/.test(t)) return true;
    if (/^(?:lyrics?|words?|music|composer|composed|producer|produced|arranged|arranger|written|writer|vocals?|mixed|mixing|mastered|mastering|recorded|recording|engineered|engineer|performed|performer|artist|singer|album|title|song|copyright|published|publisher)\s*(?:by\b|:|：)/i.test(t)) return true;
    if (/^(?:作词|作詞|作曲|编曲|編曲|制作人|製作人|混音|母带|录音|监制|词曲)\s*(?:[:：]|$|\s+\S)/.test(t)) return true;
    if (/^(?:演唱|歌手|出品|词|詞|曲)\s*[:：]/.test(t)) return true;
    return false;
  }

  function parseLRC(txt) {
    var out = [], offsetMs = 0, rawLines = String(txt || "").split(/\r?\n/);
    // Pass 1: read [offset:±ms] regardless of where it appears in the file
    for (var oi = 0; oi < rawLines.length; oi++) {
      var om = /^\s*\[offset:\s*([+-]?\d+(?:\.\d+)?)\s*\]\s*$/i.exec(rawLines[oi]);
      if (om) offsetMs = parseFloat(om[1]) || 0;
    }
    // Pass 2: parse timed rows and inline word timestamps with offset applied
    rawLines.forEach(function (row) {
      if (/^\s*\[offset:/i.test(row)) return;
      var re = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g, m, times = [], last = 0;
      while ((m = re.exec(row))) { times.push(+m[1] * 60 + parseFloat(m[2].replace(":", "."))); last = re.lastIndex; }
      if (!times.length) return;
      var rest = row.slice(last), text = rest.replace(/<\d+:\d+(?:[.:]\d+)?>/g, "").replace(/\s+/g, " ").trim();
      var wtRes = times.length === 1 ? wordTimes(rest, offsetMs / 1000) : null;
      times.forEach(function (t) {
        var adj = Math.max(0, t - offsetMs / 1000);
        out.push({ t: adj, text: text, wt: wtRes && wtRes.ok ? wtRes : null, wtRejected: !!(wtRes && wtRes.rejected) });
      });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    out.offsetMs = offsetMs;
    return out;
  }

  // Parse inline <mm:ss.xx> word/syllable timestamps, preserving sub-word segments and rejecting out-of-order marks
  function wordTimes(rest, offsetSec) {
    var off = offsetSec || 0;
    var re = /<(\d+):(\d+(?:[.:]\d+)?)>/g, m, marks = [];
    while ((m = re.exec(rest))) {
      var t = Math.max(0, +m[1] * 60 + parseFloat(m[2].replace(":", ".")) - off);
      marks.push({ t: t, at: m.index, after: re.lastIndex });
    }
    if (marks.length < 2) return null;
    for (var k = 1; k < marks.length; k++) {
      if (marks[k].t < marks[k - 1].t - 0.01) return { ok: false, rejected: true };
    }
    var words = [], cur = null, curSeg = null, mi = -1, endT = null;
    for (var i = 0; i < rest.length; i++) {
      if (mi + 1 < marks.length && i === marks[mi + 1].at) {
        mi++;
        if (cur) {
          curSeg = null;
          cur._end = marks[mi].t;
        }
        i = marks[mi].after - 1;
        continue;
      }
      var ch = rest.charAt(i);
      if (/\s/.test(ch)) { cur = null; curSeg = null; continue; }
      if (!cur) {
        cur = { w: "", a: mi >= 0 ? marks[mi].t : null, _segs: [], _end: null };
        words.push(cur);
      }
      if (!curSeg) {
        curSeg = { txt: "", a: mi >= 0 ? marks[mi].t : null };
        cur._segs.push(curSeg);
        cur._end = null;
      }
      cur.w += ch;
      curSeg.txt += ch;
    }
    if (marks.length && marks[marks.length - 1].after >= rest.replace(/\s+$/, "").length) endT = marks[marks.length - 1].t;
    if (!words.length || words.some(function (w) { return w.a == null; })) return { ok: false, rejected: true };
    var cleanWords = words.map(function (w, idx) {
      var nextA = idx + 1 < words.length ? words[idx + 1].a : endT;
      var wordEnd = w._end != null ? w._end : nextA;
      var obj = { w: w.w, a: w.a };
      if (w._end != null) obj.end = w._end;
      if (w._segs.length > 1) {
        obj.segs = w._segs.map(function (s, si) {
          var sb = si + 1 < w._segs.length ? w._segs[si + 1].a : wordEnd;
          return { txt: s.txt, a: s.a, b: sb != null ? Math.max(s.a + 0.01, sb) : null };
        });
      }
      return obj;
    });
    return { ok: true, words: cleanWords, end: endT };
  }

  function percentile(arr, p) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var idx = (s.length - 1) * p;
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return s[lo];
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
  }

  // Convert timed rows into lines with section-aware pace estimation, prosody weighting, and zero overlap
  function buildLines(raw, dur) {
    var out = [], exactSamples = [], lineRates = [], mismatches = 0;
    var offsetMs = raw && typeof raw.offsetMs === "number" ? raw.offsetMs : 0;
    var rawArr = raw || [];

    // Collect all raw timestamps (including empty, credit, and metadata rows) as nextT upper bounds
    var allTimes = [];
    for (var ti = 0; ti < rawArr.length; ti++) {
      allTimes.push(rawArr[ti].t);
    }

    // Pre-pass: filter non-sung credit/metadata lines and merge simultaneous-timestamp rows (within 0.05s)
    var merged = [];
    for (var ri = 0; ri < rawArr.length; ri++) {
      var r = rawArr[ri];
      if (isNonSungLine(r.text)) continue;
      var trimmed = String(r.text).replace(/\s+/g, " ").trim();
      var entry = {
        t: r.t,
        maxT: r.t,
        text: trimmed,
        wt: r.wt || null,
        wtRejected: !!r.wtRejected,
        extraBg: null
      };
      if (merged.length > 0 && Math.abs(entry.t - merged[merged.length - 1].t) <= 0.05) {
        var prev = merged[merged.length - 1];
        var prevBg = isAllBackingText(prev.text);
        var curBg = isAllBackingText(entry.text);
        if (curBg && !prevBg) {
          prev.maxT = Math.max(prev.maxT, entry.t);
          if (prev.wt) {
            prev.extraBg = (prev.extraBg ? prev.extraBg + " " : "") + entry.text;
          } else {
            prev.text = prev.text + " " + entry.text;
          }
          continue;
        }
        if (prevBg && !curBg) {
          var bgTxt = prev.text;
          prev.t = Math.min(prev.t, entry.t);
          prev.maxT = Math.max(prev.maxT, entry.t);
          prev.wt = entry.wt;
          prev.wtRejected = entry.wtRejected;
          if (entry.wt) {
            prev.text = entry.text;
            prev.extraBg = (prev.extraBg ? prev.extraBg + " " : "") + bgTxt;
          } else {
            prev.text = entry.text + " " + bgTxt;
          }
          continue;
        }
        if (prevBg && curBg) {
          prev.maxT = Math.max(prev.maxT, entry.t);
          prev.text = prev.text + " " + entry.text;
          prev.wt = null;
          continue;
        }
        // Two non-parenthetical lines sharing a timestamp
        if (prev.text.toLowerCase() === entry.text.toLowerCase()) {
          prev.maxT = Math.max(prev.maxT, entry.t);
          continue;
        }
        if (!prev.wt && !entry.wt) {
          prev.maxT = Math.max(prev.maxT, entry.t);
          prev.text = prev.text + " / " + entry.text;
          continue;
        }
        // If either has exact word timings, keep both and offset the second cleanly
        entry.t = prev.t + 0.5;
        entry.maxT = entry.t;
      }
      merged.push(entry);
    }

    // Pass 1: validate word-timed rows, split into sections (>= 5.0s gap), and collect global + section pace samples
    var items = [];
    var sections = [];
    var curSecId = -1;
    for (var i = 0; i < merged.length; i++) {
      var row = merged[i];
      if (i === 0 || (row.t - merged[i - 1].t) >= 5.0) {
        curSecId++;
        sections.push({ rates: [] });
      }
      var words = row.text.split(/\s+/);
      var nextT = null;
      for (var j = 0; j < allTimes.length; j++) {
        if (allTimes[j] > row.maxT + 0.001) { nextT = allTimes[j]; break; }
      }
      if (i + 1 < merged.length && merged[i + 1].t > row.t + 0.001) {
        if (nextT == null || merged[i + 1].t < nextT) nextT = merged[i + 1].t;
      }
      var tagged = tagBackingWords(words);
      var hasMain = tagged.some(function (x) { return !x.bg; });
      var effSyl = 0;
      tagged.forEach(function (x) { effSyl += (x.bg && hasMain) ? 0.35 : countSyllables(x.w); });
      effSyl = Math.max(1, effSyl);

      var validWt = null;
      if (row.wtRejected) {
        mismatches++;
      } else if (row.wt && row.wt.words) {
        var W = row.wt.words;
        if (W.length !== words.length) {
          mismatches++;
        } else {
          var bad = false;
          var firstA = W[0].a;
          var lastW = W[W.length - 1];
          var lastMarkA = (lastW.segs && lastW.segs.length) ? lastW.segs[lastW.segs.length - 1].a : lastW.a;
          if (firstA < row.t - 1.5) bad = true;
          if (nextT != null && firstA > nextT + 0.5) bad = true;
          if (nextT != null && lastMarkA > nextT + 1.0) bad = true;
          for (var k = 1; k < W.length; k++) {
            if (W[k].a < W[k - 1].a - 0.01) { bad = true; break; }
          }
          if (!bad) {
            for (var wk = 0; wk < W.length; wk++) {
              if (W[wk].segs && W[wk].segs.length > 1) {
                for (var sk = 1; sk < W[wk].segs.length; sk++) {
                  if (W[wk].segs[sk].a < W[wk].segs[sk - 1].a - 0.01) { bad = true; break; }
                }
                if (bad) break;
              }
            }
          }
          if (row.wt.end != null && row.wt.end < lastMarkA - 0.01) bad = true;
          if (bad) {
            mismatches++;
          } else {
            validWt = row.wt;
            var span = (row.wt.end || (lastMarkA + 0.25)) - firstA;
            if (span > 0.2 && effSyl >= 2) {
              var ep = span / effSyl;
              if (ep >= 0.10 && ep <= 0.80) exactSamples.push(ep);
            }
          }
        }
      }

      // Compute (gap - breath) / syllables for every estimated line with a next line
      if (!validWt && nextT != null && effSyl >= 2) {
        var gap = nextT - row.t;
        if (gap > 0.25) {
          var rate = (gap - 0.25) / effSyl;
          if (rate > 0.05) {
            lineRates.push(rate);
            sections[curSecId].rates.push(rate);
          }
        }
      }

      items.push({ row: row, words: words, tagged: tagged, hasMain: hasMain, effSyl: effSyl, nextT: nextT, validWt: validWt, secId: curSecId });
    }

    // Learn global song pace: median of exact lines if available, else 25th percentile across all lines
    var rawPace = exactSamples.length >= 2 ? percentile(exactSamples, 0.5)
      : lineRates.length >= 2 ? percentile(lineRates, 0.25)
      : exactSamples.length ? exactSamples[0]
      : lineRates.length ? lineRates[0]
      : 0.26;
    var globalPace = Math.max(0.12, Math.min(0.65, rawPace));

    // Compute per-section blended pace for sections with >= 3 estimated lines that have a next line
    var sectionPaces = sections.map(function (sec) {
      if (sec.rates.length >= 3) {
        var localPace = percentile(sec.rates, 0.25);
        return Math.max(0.11, Math.min(0.68, 0.65 * localPace + 0.35 * globalPace));
      }
      return globalPace;
    });

    // Pass 2: build timed word entries
    var exactCount = 0, estCount = 0;
    items.forEach(function (it) {
      var row = it.row, tagged = it.tagged, nextT = it.nextT;
      var linePace = sectionPaces[it.secId];
      var capEnd = nextT != null
        ? Math.max(row.t + 0.05, nextT - 0.04)
        : Math.min(dur || (row.t + 8), row.t + 8);
      if (nextT != null && capEnd >= nextT) capEnd = Math.max(row.t + 0.02, nextT - 0.01);

      if (it.validWt) {
        exactCount++;
        var W = it.validWt.words;
        var startT = Math.min(row.t, W[0].a);
        var lastWObj = W[W.length - 1];
        var lastRefA = (lastWObj.segs && lastWObj.segs.length) ? lastWObj.segs[lastWObj.segs.length - 1].a : lastWObj.a;
        var defaultLastEnd = lastRefA + Math.max(0.28, countSyllables(lastWObj.w) * linePace);
        var lastEnd = it.validWt.end != null ? it.validWt.end : defaultLastEnd;
        if (nextT != null) lastEnd = Math.min(lastEnd, capEnd);
        lastEnd = Math.max(lastRefA + 0.05, lastEnd);
        if (nextT != null && lastEnd > nextT - 0.01) lastEnd = Math.max(lastRefA + 0.02, nextT - 0.01);
        var builtWords = W.map(function (x, k) {
          var nextWA = k + 1 < W.length ? W[k + 1].a : lastEnd;
          var rawB = x.end != null ? Math.min(x.end, nextWA) : nextWA;
          var wb = Math.max(x.a + 0.03, Math.min(rawB, lastEnd));
          var wObj = { w: x.w, a: x.a, b: wb, bg: tagged[k].bg };
          if (x.segs && x.segs.length > 1) {
            wObj.segs = x.segs.map(function (s, si) {
              var sb = si + 1 < x.segs.length ? x.segs[si + 1].a : wb;
              return { txt: s.txt, a: s.a, b: Math.max(s.a + 0.01, Math.min(sb, wb)) };
            });
          }
          return wObj;
        });
        var finalText = row.text;
        if (row.extraBg) {
          var bgWs = row.extraBg.split(/\s+/);
          var bgSpan = Math.min(0.6, Math.max(0.15, (capEnd - lastEnd)));
          var bgStart = lastEnd;
          var bgStep = bgSpan / bgWs.length;
          bgWs.forEach(function (bw, bi) {
            builtWords.push({ w: bw, a: bgStart + bi * bgStep, b: bgStart + (bi + 1) * bgStep, bg: true });
          });
          lastEnd = Math.min(capEnd, bgStart + bgSpan);
          finalText = finalText + " " + row.extraBg;
        }
        out.push({
          t: startT,
          end: lastEnd,
          text: finalText,
          exact: true,
          words: builtWords
        });
        return;
      }

      estCount++;
      var commaCount = 0;
      var weights = tagged.map(function (x, k) {
        var isLast = k === tagged.length - 1;
        var hasPause = !isLast && /[,;:—–-]$/.test(x.w);
        var hasPunct = /[,;:—–\-!?.]$/.test(x.w);
        if (hasPause) commaCount++;
        var base;
        if (x.bg && it.hasMain) {
          base = 0.35;
        } else {
          base = countSyllables(x.w);
          var cleanW = String(x.w || "").toLowerCase().replace(/[^a-zà-öø-ÿ']/g, "").replace(/'/g, "");
          if (!isLast && !hasPunct && FUNC_WORDS[cleanW]) {
            base = base * 0.78;
          } else if (HOLD_WORDS[cleanW] || /^(?:oo+h|aa+h|yea+h|whoa+|oh+|hey+|la+)$/.test(cleanW)) {
            base = base * 1.45;
          }
        }
        return base + (isLast ? 0.45 : 0) + (hasPause ? 0.45 : 0);
      });
      var totalW = 0;
      weights.forEach(function (v) { totalW += v; });

      var pacedLen = it.effSyl * linePace + 0.22 + commaCount * 0.14;
      var end = Math.min(row.t + pacedLen, capEnd);
      if (nextT != null) {
        end = Math.max(Math.min(capEnd, row.t + 0.12), Math.min(end, capEnd));
      } else {
        end = Math.max(row.t + 0.4, end);
      }
      var durLine = Math.max(0.05, end - row.t), acc = 0;
      out.push({
        t: row.t,
        end: end,
        text: row.text,
        exact: false,
        words: tagged.map(function (x, k) {
          var a = row.t + durLine * acc / totalW;
          acc += weights[k];
          var b = row.t + durLine * acc / totalW;
          return { w: x.w, a: a, b: Math.max(a + 0.02, b), bg: x.bg };
        })
      });
    });

    out.meta = {
      pace: Math.round(globalPace * 1000) / 1000,
      exactCount: exactCount,
      estCount: estCount,
      mismatches: mismatches,
      offsetMs: offsetMs,
      sectionPaces: sectionPaces.map(function (p) { return Math.round(p * 1000) / 1000; })
    };
    return out;
  }

  function plainRows(txt, dur) {
    var rows = String(txt || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^\[.*\]$/.test(x); });
    if (!rows.length) return [];
    var a = (dur || 180) * 0.07, b = (dur || 180) * 0.95;
    return rows.map(function (x, i) { return { t: a + (b - a) * i / rows.length, text: x }; });
  }

  // House song exact note timings: 8 melody notes per 2-bar phrase at 0.45s intervals (last note ends at +3.55s)
  var BAR_S = 2.4, HOUSE_DUR = 20 * BAR_S;
  function houseLinesList(hostName) {
    var h = hostName || (typeof HOST !== "undefined" ? HOST : "Rhonda");
    return [
      { text: "Neon humming, rain on the glass",        slots: [0, 2, 4, 5, 6, 7] },
      { text: "Pull up a stool, let the long week pass", slots: [0, 0.5, 1, 2, 3, 4, 5, 6, 7] },
      { text: h + "'s got your name on a slip",          slots: [0, 2, 3, 4, 5, 6, 7] },
      { text: "Clear your throat and loosen your grip",  slots: [0, 1, 2, 3, 4, 6, 7] },
      { text: "It's Saturday night, so sing it loud",    slots: [0, 1, 3, 4, 5, 6, 7] },
      { text: "Off-key heroes, we're your crowd",        slots: [0, 2, 4, 5, 6] },
      { text: "One more song before we go",              slots: [0, 1, 2, 4, 6, 7] },
      { text: "Saturday night, don't take it slow",      slots: [0, 2, 4, 5, 6, 7] }
    ];
  }
  function houseLyrics(hostName) {
    var rows = houseLinesList(hostName).map(function (item, i) {
      var at = 2 * BAR_S + i * 2 * BAR_S;
      var ws = item.text.split(/\s+/);
      var wtWords = ws.map(function (w, k) { return { w: w, a: at + item.slots[k] * 0.45 }; });
      return { t: at, text: item.text, wt: { ok: true, words: wtWords, end: at + 7 * 0.45 + 0.40 } };
    }).concat([{ t: 18 * BAR_S - 0.6, text: "" }]);
    var lines = buildLines(rows, HOUSE_DUR);
    return { id: "house", dur: HOUSE_DUR, synced: true, exact: true, lines: lines, meta: lines.meta };
  }

  // Keep all matching LRCLIB candidates so we can match against whichever tape actually plays
  function filterLyricCandidates(list, song) {
    var ntFull = norm(song.t), naFull = norm(song.a);
    var ntClean = norm(cleanTitle(song.t)), naFirst = norm(firstArtist(song.a));
    function has(x) { return x && !x.instrumental && (x.syncedLyrics || x.plainLyrics) && x.duration > 30; }
    function titleMatch(t, nt) { return !!nt && (t === nt || t.indexOf(nt) === 0 || nt.indexOf(t) === 0); }
    function artistMatch(a, na) { return !!na && (a.indexOf(na) !== -1 || na.indexOf(a) !== -1); }
    var ok = (list || []).filter(function (x) {
      if (!has(x)) return false;
      var t = norm(x.trackName), a = norm(x.artistName);
      var tm = titleMatch(t, ntFull) || titleMatch(t, ntClean);
      var am = artistMatch(a, naFull) || artistMatch(a, naFirst);
      return tm && am;
    });
    if (!ok.length) ok = (list || []).filter(function (x) { return has(x) && (norm(x.trackName).indexOf(ntFull) !== -1 || norm(x.trackName).indexOf(ntClean) !== -1); });
    if (!ok.length) return [];
    var live = /\b(live|demo|remix|acoustic|karaoke|instrumental|version|edit)\b/;
    var rawNt = String(song.t || "").toLowerCase();
    var studio = ok.filter(function (x) {
      var rawTrack = String(x.trackName || "").toLowerCase().replace(rawNt, "");
      return !live.test(rawTrack) && !/\blive\b/.test(String(x.albumName || "").toLowerCase());
    });
    if (studio.length) ok = studio;
    var synced = ok.filter(function (x) { return !!x.syncedLyrics; });
    var pool = synced.length ? synced : ok;
    var seen = {};
    return pool.filter(function (x) {
      var k = x.id != null ? "id:" + x.id : x.duration + "|" + (x.syncedLyrics || x.plainLyrics).length;
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    }).map(function (x) {
      return {
        id: x.id,
        duration: x.duration,
        syncedLyrics: x.syncedLyrics || "",
        plainLyrics: x.plainLyrics || "",
        trackName: x.trackName || "",
        artistName: x.artistName || "",
        hasWordTimes: !!(x.syncedLyrics && /<\d+:\d+(?:[.:]\d+)?>/.test(x.syncedLyrics))
      };
    });
  }

  function buildCandidate(cand) {
    if (!cand) return null;
    var lines = buildLines(cand.syncedLyrics ? parseLRC(cand.syncedLyrics) : plainRows(cand.plainLyrics, cand.duration), cand.duration);
    if (!lines.length) return null;
    return {
      id: cand.id,
      dur: cand.duration,
      synced: !!cand.syncedLyrics,
      exact: lines.some(function (l) { return l.exact; }),
      lines: lines,
      meta: lines.meta
    };
  }

  function pickBestLyric(candidates, targetDur) {
    if (!candidates || !candidates.length) return null;
    var synced = candidates.filter(function (x) { return !!x.syncedLyrics; });
    var pool = synced.length ? synced : candidates;
    var best = null;
    if (typeof targetDur === "number" && targetDur > 10) {
      var sorted = pool.slice().sort(function (a, b) {
        var da = Math.abs(a.duration - targetDur), db = Math.abs(b.duration - targetDur);
        if (Math.abs(da - db) <= 1.5 && a.hasWordTimes !== b.hasWordTimes) return a.hasWordTimes ? -1 : 1;
        return da - db;
      });
      best = sorted[0];
    } else {
      var bestN = -1;
      pool.forEach(function (x) {
        var n = 0;
        candidates.forEach(function (y) { if (Math.abs(y.duration - x.duration) <= 2) n++; });
        if (n > bestN) { bestN = n; best = x; }
      });
      var exact = pool.filter(function (x) { return x.hasWordTimes && Math.abs(x.duration - best.duration) <= 2; });
      if (exact.length) best = exact[0];
    }
    return buildCandidate(best);
  }
