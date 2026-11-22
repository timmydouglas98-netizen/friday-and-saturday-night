  // ---------- the line between phones and the TV ----------
  // Slips travel through ntfy.sh, a free public relay that needs no account. Everything is scrambled first
  // (NaCl secretbox) with a key that only lives in the QR code, so the relay only ever carries gibberish.
  var RELAY_DEFAULT = "https://ntfy.sh";
  function relayBase() { try { return localStorage.getItem("snk-relay") || RELAY_DEFAULT; } catch (e) { return RELAY_DEFAULT; } }
  function b64(u8) { var s = ""; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64(str) {
    str = String(str).replace(/-/g, "+").replace(/_/g, "/"); while (str.length % 4) str += "=";
    var s = atob(str), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u;
  }
  function toBytes(str) { var s = unescape(encodeURIComponent(str)), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function fromBytes(u) { var s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return decodeURIComponent(escape(s)); }
  function seal(obj, key) {
    var nonce = nacl.randomBytes(24), box = nacl.secretbox(toBytes(JSON.stringify(obj)), nonce, key), out = new Uint8Array(24 + box.length);
    out.set(nonce); out.set(box, 24); return b64(out);
  }
  function unseal(str, key) {
    try { var u = unb64(str); if (u.length < 41) return null; var m = nacl.secretbox.open(u.subarray(24), u.subarray(0, 24), key); return m ? JSON.parse(fromBytes(m)) : null; } catch (e) { return null; }
  }
  function randomId(n) {
    var a = "abcdefghijklmnopqrstuvwxyz0123456789", s = "";
    while (s.length < n) { var u = nacl.randomBytes(n * 2); for (var i = 0; i < u.length && s.length < n; i++) if (u[i] < 252) s += a[u[i] % 36]; }
    return s;
  }
  function relaySend(topic, obj, key) {
    obj.ts = Date.now();
    return fetch(relayBase() + "/" + topic, { method: "POST", body: seal(obj, key) }).then(function (r) { if (!r.ok) { var e = new Error("relay " + r.status); e.status = r.status; throw e; } });
  }
  // keeps one listening connection open, and reopens it (catching up on anything missed) when it drops
  function relayListen(topic, key, onMsg, onState) {
    var es = null, seen = {}, seenOrder = [], last = Math.floor(Date.now() / 1000), dead = false, retry = null, delay = 5000;
    function open() {
      if (dead) return;
      try { es = new EventSource(relayBase() + "/" + topic + "/sse?since=" + last); } catch (e) { onState(false); retry = setTimeout(open, delay); delay = Math.min(40000, delay * 2); return; }
      es.onopen = function () { delay = 5000; onState(true); };
      es.onmessage = function (e) {
        var d; try { d = JSON.parse(e.data); } catch (x) { return; }
        if (!d || d.event !== "message" || !d.message || seen[d.id]) return;
        seen[d.id] = 1; seenOrder.push(d.id); if (seenOrder.length > 500) { delete seen[seenOrder.shift()]; }
        if (d.time) last = d.time;
        var m = unseal(d.message, key);
        // old slips left on the relay are ignored (ten minutes covers a phone whose clock runs a little off)
        if (m && typeof m === "object" && typeof m.ts === "number" && Math.abs(Date.now() - m.ts) < 600000) onMsg(m);
      };
      es.onerror = function () {
        onState(false); try { es.close(); } catch (x) {} clearTimeout(retry);
        var wait = Math.round(delay * (0.8 + Math.random() * 0.4));
        delay = Math.min(40000, delay * 2);
        retry = setTimeout(open, wait);
      };
    }
    open();
    return { close: function () { dead = true; clearTimeout(retry); if (es) try { es.close(); } catch (e) {} } };
  }
