  // ---------- pure decisions: no store state, no screen, no network ----------
  // These are the store's trickiest calls, kept apart so src/tests/test-store-logic.js can load this file on its own
  // and check them. Everything here takes what it needs as arguments.

  // A film's name and year boiled down for matching: case, punctuation and a leading "The"/"A"/"An" don't count.
  function titleKey(name, year) { return String(name || "").toLowerCase().replace(/^(the|a|an) /, "").replace(/[^a-z0-9]+/g, "") + "|" + (year || 0); }

  // The hold (from `holds`) that this tape answers to, or null. A hold matches by id first; failing that by title and
  // year, because the same film can carry a different id on an add-on's shelf (a Letterboxd or TMDB id rather than the
  // IMDb one) than on the shelf it was held from. A film never matches a series of the same name, and when either side
  // doesn't know the year, the title alone will do.
  function findHold(holds, id, it) {
    var i;
    for (i = 0; i < holds.length; i++) if (holds[i].id === id) return holds[i];
    if (!it || !it.name) return null;
    var k = titleKey(it.name, it.year), k0 = titleKey(it.name, 0);
    for (i = 0; i < holds.length; i++) {
      var h = holds[i];
      if ((h.type === "series") !== (it.type === "series")) continue;
      if (titleKey(h.name, h.year) === k || ((!h.year || !it.year) && titleKey(h.name, 0) === k0)) return h;
    }
    return null;
  }

  // Which of your add-ons' catalogs become lists in the store, in order, one entry each:
  //   { m: manifest, base: the add-on's address, c: the catalog, isLB: a Letterboxd add-on, tv: needs " · TV" }
  // The same list can turn up more than once (an add-on installed twice, which is what reconfiguring Stremboxd and
  // pressing Install again does, or one list added twice under another id), and it only gets one shelf. Cinemeta is
  // left out (it's the store's own stock), as is any add-on whose address `ok` rejects or catalog `usable` rejects.
  // A series list that shares its name with a movie list from the same add-on is marked `tv`, so the two can be told apart.
  function planAddonLists(addons, ok, usable) {
    var seen = {}, typeNames = {}, out = [];
    addons.forEach(function (ad) {
      var m = (ad && ad.manifest) || {};
      (m.catalogs || []).filter(usable).forEach(function (c) { var n = (m.id || "") + "|" + String(c.name || "").toLowerCase(); typeNames[n] = (typeNames[n] || 0) | (c.type === "series" ? 2 : 1); });
    });
    addons.forEach(function (ad) {
      var url = (ad && ad.transportUrl) || "", m = (ad && ad.manifest) || {};
      if (!ok(url) || /v3-cinemeta\.strem\.io/.test(url)) return;
      var base = url.replace(/\/manifest\.json.*$/, "");
      var isLB = /letterboxd|stremboxd/i.test(url + " " + (m.id || "") + " " + (m.name || ""));
      (m.catalogs || []).filter(usable).forEach(function (c) {
        var who = m.id || base, idKey = who + "|" + c.type + "|" + c.id, nameKey = who + "|" + c.type + "|" + String(c.name || c.id).toLowerCase().replace(/\s+/g, " ").trim();
        if (seen[idKey] || seen[nameKey]) return;
        seen[idKey] = seen[nameKey] = 1;
        out.push({ m: m, base: base, c: c, isLB: isLB, tv: c.type === "series" && typeNames[(m.id || "") + "|" + String(c.name || "").toLowerCase()] === 3 });
      });
    });
    return out;
  }

