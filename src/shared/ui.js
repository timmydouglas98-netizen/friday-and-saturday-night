  // ---------- shared chrome: the clock and the remote-button hints look the same in every venue ----------
  // (the video store's own hint bar is the model: cream key caps with an inked edge, coloured dots for the coloured buttons)
  var UI = (function () {
    function clock(d) {
      d = d || new Date();
      var h = d.getHours(), m = d.getMinutes();
      // just the time: the shops are named for Friday and Saturday night, so a clock saying "Sunday" argues with them
      return ((h + 11) % 12 + 1) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " am" : " pm");
    }
    function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    // parts: [key, label]. key is the button as printed ("OK", "BACK", "◄ ►"), or r / g / y / b for a coloured button,
    // or "" for words alone.
    function hints(parts) {
      return parts.map(function (p) {
        var k = p[0], lab = e(p[1]);
        if (!k) return '<span class="fsn-h">' + lab + "</span>";
        if (/^[rgyb]$/.test(k)) return '<span class="fsn-h"><i class="fsn-ck ' + k + '"></i>' + lab + "</span>";
        return '<span class="fsn-h"><kbd>' + e(k) + "</kbd>" + lab + "</span>";
      }).join("");
    }
    var css = ".fsn-h{display:inline-block;margin:0 .9em;white-space:nowrap}" +
      ".fsn-h kbd{display:inline-block;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:700;font-size:.92em;line-height:1.15;color:#2a1c18;" +
      "background:#fff3d6;border:2px solid #2a1c18;border-radius:5px;padding:0 .35em;margin-right:.4em;text-shadow:none;box-shadow:0 2px 0 #2a1c18;vertical-align:.05em}" +
      ".fsn-ck{display:inline-block;width:.8em;height:.8em;border-radius:50%;border:2px solid #2a1c18;vertical-align:-.05em;margin-right:.4em}" +
      ".fsn-ck.r{background:#e2364a}.fsn-ck.g{background:#3fae5a}.fsn-ck.y{background:#f1c232}.fsn-ck.b{background:#3c78d8}";
    try { var st = document.createElement("style"); st.id = "fsn-ui"; st.textContent = css; (document.head || document.documentElement).appendChild(st); } catch (x) {}
    return { clock: clock, hints: hints };
  })();
