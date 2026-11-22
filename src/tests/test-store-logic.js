// The video store's pure decisions (src/video/js/00-logic.js): hold matching and which add-on lists become shelves.
// Run by src/build.py; or on its own: node src/tests/test-store-logic.js
"use strict";
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "video", "js", "00-logic.js"), "utf8");
const { titleKey, findHold, planAddonLists } = new Function(src + "\nreturn { titleKey, findHold, planAddonLists };")();

let passed = 0, failed = 0;
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) passed++;
  else { failed++; console.error("FAIL " + name + "\n  got:  " + g + "\n  want: " + w); }
}

// ---------- titleKey ----------
check("case and punctuation don't count", titleKey("Se7en!", 1995), titleKey("se7en", 1995));
check("a leading 'The' doesn't count", titleKey("The Matrix", 1999), titleKey("Matrix", 1999));
check("the year does", titleKey("Halloween", 1978) === titleKey("Halloween", 2018), false);

// ---------- findHold ----------
const scream = { id: "tt0117571", type: "movie", name: "Scream", year: 1996 };
const holds = [scream, { id: "tt0098936", type: "series", name: "Twin Peaks", year: 1990 }, { id: "tt0078748", type: "movie", name: "Alien", year: 0 }];
check("held by its own id", findHold(holds, "tt0117571", null), scream);
check("the same film under an add-on's id", findHold(holds, "tmdb:4232", { id: "tmdb:4232", type: "movie", name: "Scream", year: 1996 }), scream);
check("a remake with the same name isn't held", findHold(holds, "tmdb:646385", { id: "tmdb:646385", type: "movie", name: "Scream", year: 2022 }), null);
check("a series never answers to a film's hold", findHold(holds, "x", { id: "x", type: "series", name: "Scream", year: 1996 }), null);
check("a film never answers to a series' hold", findHold(holds, "y", { id: "y", type: "movie", name: "Twin Peaks", year: 1990 }), null);
check("no year on the hold: the title will do", findHold(holds, "lb:alien", { id: "lb:alien", type: "movie", name: "ALIEN", year: 1979 }).id, "tt0078748");
check("no year on the tape: the title will do", findHold(holds, "z", { id: "z", type: "movie", name: "Scream", year: 0 }), scream);
check("unknown id, nothing to go on", findHold(holds, "q", undefined), null);
check("nothing held", findHold([], "tt0117571", scream), null);

// ---------- planAddonLists ----------
const ok = (u) => /^https:/.test(u);
const usable = (c) => (c.type === "movie" || c.type === "series") && !(c.extra || []).some((e) => e.isRequired);
const sbx = (cfg, lists) => ({ transportUrl: "https://stremboxd.com/" + cfg + "/manifest.json", manifest: { id: "community.stremboxd", name: "Stremboxd",
  catalogs: [{ type: "movie", id: "letterboxd-popular", name: "Popular This Week" }].concat(lists.map(([i, n]) => ({ type: "movie", id: "letterboxd-list-" + i, name: n }))) } });
const names = (plan) => plan.map((e) => e.c.name + (e.tv ? " · TV" : ""));

check("Stremboxd installed twice: one shelf per list, lists from both copies kept",
  names(planAddonLists([sbx("old", [[1, "Halloween Picks"], [2, "Criterion"]]), sbx("new", [[1, "Halloween Picks"], [2, "Criterion"], [3, "Comfort Films"]])], ok, usable)),
  ["Popular This Week", "Halloween Picks", "Criterion", "Comfort Films"]);
check("the same list added twice under different ids",
  names(planAddonLists([sbx("a", [[1, "Criterion"], [9, "criterion"]])], ok, usable)), ["Popular This Week", "Criterion"]);
check("Letterboxd add-ons are recognised", planAddonLists([sbx("a", [])], ok, usable)[0].isLB, true);
const tmdb = { transportUrl: "https://tmdb.example.com/manifest.json", manifest: { id: "tmdb.addon", name: "TMDB",
  catalogs: [{ type: "movie", id: "pop", name: "Popular" }, { type: "series", id: "pop", name: "Popular" }, { type: "series", id: "airing", name: "Airing Today" },
    { type: "movie", id: "search", name: "Search", extra: [{ name: "search", isRequired: true }] }, { type: "channel", id: "ch", name: "Channels" }] } };
check("a TV list named like a movie list is marked; others aren't", names(planAddonLists([tmdb], ok, usable)), ["Popular", "Popular · TV", "Airing Today"]);
check("two different add-ons may both have a 'Popular'",
  names(planAddonLists([tmdb, { transportUrl: "https://other.example/manifest.json", manifest: { id: "other", catalogs: [{ type: "movie", id: "p", name: "Popular" }] } }], ok, usable)),
  ["Popular", "Popular · TV", "Airing Today", "Popular"]);
check("Cinemeta and rejected addresses are left out",
  planAddonLists([{ transportUrl: "https://v3-cinemeta.strem.io/manifest.json", manifest: { id: "com.linvo.cinemeta", catalogs: [{ type: "movie", id: "top", name: "Popular" }] } },
    { transportUrl: "http://evil.example/manifest.json", manifest: { id: "e", catalogs: [{ type: "movie", id: "x", name: "X" }] } }], ok, usable).length, 0);
check("an add-on with no manifest doesn't break anything", planAddonLists([{ transportUrl: "https://x.example/manifest.json" }, null], ok, usable).length, 0);
check("the add-on's address has its manifest path removed", planAddonLists([tmdb], ok, usable)[0].base, "https://tmdb.example.com");

console.log("Store logic tests: " + passed + " passed, " + failed + " failed.");
if (failed) process.exit(1);
