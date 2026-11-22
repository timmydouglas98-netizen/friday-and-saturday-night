  // ---------- the shared street: one time of day and one sky for the Strip, the video store and the bar ----------
  // The video store owns the settings (its front desk "Outside" panel) and fetches the weather. The Strip and the bar
  // read the same saved settings and forecast, so all three show the same light and the same weather. The logic here
  // mirrors outsideMode() and wxKind() in the video store; keep them in step.
  var WORLD = (function () {
    function lj(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
    function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function prefs() { var p = lj("fnv-prefs", {}); return p && typeof p === "object" ? p : {}; }
    function wxNow() { var w = lj("fnv-wx", null); return w && typeof w.t === "number" && typeof w.key === "string" ? w : null; }
    function placeKey(p) { return p && typeof p.lat === "number" && typeof p.lon === "number" ? p.lat.toFixed(2) + "," + p.lon.toFixed(2) : ""; }
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
    // time of day: a painted dusk unless the store is set to follow the clock (then real sunrise and sunset when known)
    function mode() {
      var p = prefs();
      if (p.outside !== "clock") return "sunset";
      var now = new Date(), m = now.getHours() * 60 + now.getMinutes(), w = wxNow();
      var sun = w && w.rise != null && w.set != null && Date.now() - w.t < 7 * 864e5 ? w : null;
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
    // weather: pinned in the store's settings, or the live forecast when it's fresh (clear skies otherwise)
    function weather() {
      var p = prefs(), m = p.wxMode || "live";
      if (m !== "live") return m;
      var w = wxNow();
      if (w && w.key === placeKey(p.wxPlace) && Date.now() - w.t < 3 * 3600 * 1000) return codeKind(w.code, w.precip);
      return "clear";
    }
    function look() { return outLook(mode(), weather()); }
    // the forecast goes stale while you never visit the video store: top it up here too (only once a place is known)
    var busy = false;
    function refresh(done) {
      var p = prefs(), w = wxNow(), key = placeKey(p.wxPlace);
      if (busy || !key || (w && w.key === key && Date.now() - w.t < 20 * 60 * 1000)) return;
      busy = true;
      var x = new XMLHttpRequest(), url = "https://api.open-meteo.com/v1/forecast?latitude=" + p.wxPlace.lat + "&longitude=" + p.wxPlace.lon +
        "&current=weather_code,precipitation,cloud_cover,wind_speed_10m&daily=sunrise,sunset&forecast_days=1&timezone=auto";
      function mins(iso) { var m = /T(\d\d):(\d\d)/.exec(iso || ""); return m ? +m[1] * 60 + +m[2] : null; }
      try {
        x.open("GET", url, true); x.timeout = 8000;
        x.onload = function () {
          busy = false;
          try {
            var j = JSON.parse(x.responseText), c = j.current || {}, d = j.daily || {};
            var before = weather() + "|" + mode();
            lset("fnv-wx", { t: Date.now(), code: c.weather_code, precip: c.precipitation, cloud: c.cloud_cover, wind: c.wind_speed_10m, key: key,
              rise: mins((d.sunrise || [])[0]), set: mins((d.sunset || [])[0]) });
            if (done && weather() + "|" + mode() !== before) done();
          } catch (e) {}
        };
        x.onerror = x.ontimeout = function () { busy = false; };
        x.send();
      } catch (e) { busy = false; }
    }
    return { mode: mode, weather: weather, look: look, refresh: refresh };
  })();
