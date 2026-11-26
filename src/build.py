#!/usr/bin/env python3
"""Builds the unified Friday & Saturday Night TizenBrew app from src/.

Produces:
  - app/index.html   (unified TizenBrew loader with IndexedDB cache & SHA-256 + APP_VERSION checks)
  - app/street.html  (the shared Strip Mall hub connecting both venues)
  - app/store.html   (Friday Night Video)
  - app/bar.html     (Saturday Night Karaoke)
  - index.html       (Karaoke phone songbook, served from GitHub Pages root)
  - player.html      (YouTube jukebox wrapper, served from GitHub Pages root)
  - release.json     (updated with parsed APP_VERSIONs, preserved per-venue refs, and SHA-256 hashes)

Also runs the lyric timing test suite (src/karaoke/test-lyrics.js) via Node or macOS jsc, and the state-logic
suites in src/tests/ (loader rollback, add-on list de-duplication, hold matching) via Node,
and refuses to write a changed venue hash under an unchanged ref + version.

Optional flags to bump individual venue release refs independently:
  python3 src/build.py --ref-karaoke v2
  python3 src/build.py --ref-video v2
  python3 src/build.py --ref-street v2
  python3 src/build.py --ref-all v2
"""
import argparse
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent


def read(rel):
    return (HERE / rel).read_text(encoding="utf-8")


INCLUDE_RE = re.compile(r"^.*@@INCLUDE ([\w./-]+)@@.*\n", re.M)


def assemble(rel, depth=0):
    """Reads a source file and swaps each `@@INCLUDE path@@` line for that file's text, exactly as written.

    The video store's source is split this way (src/video/style.css, body.html and js/*.js); the pieces join back
    into the same single page the store has always been."""
    if depth > 4:
        raise RuntimeError(f"Includes nested too deeply at {rel}")

    def expand(m):
        inc = m.group(1)
        if not (HERE / inc).exists():
            raise RuntimeError(f"{rel} includes {inc}, which doesn't exist")
        return assemble(inc, depth + 1)

    return INCLUDE_RE.sub(expand, read(rel))


def sha256_hex(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(src, marker, value, label):
    cnt = src.count(marker)
    if cnt != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence of {marker!r}, found {cnt}")
    return src.replace(marker, value, 1)


def extract_version(src, label):
    m = re.search(r'var\s+APP_VERSION\s*=\s*"([^"]+)"', src)
    if not m:
        raise RuntimeError(f"{label}: could not find APP_VERSION")
    return m.group(1)


def run_tests():
    # the lyric timing suite runs under Node or macOS jsc; the state-logic suites in src/tests/ need Node
    run_test(HERE / "karaoke" / "test-lyrics.js", "Lyric test suite", allow_jsc=True)
    for t in sorted((HERE / "tests").glob("test-*.js")):
        run_test(t, t.stem, allow_jsc=False)


def run_test(test_file, label, allow_jsc):
    if not test_file.exists():
        return
    runner = shutil.which("node")
    if not runner and allow_jsc:
        jsc = pathlib.Path("/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc")
        if jsc.exists():
            runner = str(jsc)
    if not runner:
        print(f"Warning: no JavaScript runner found; skipping {test_file.relative_to(ROOT)}", file=sys.stderr)
        return
    r = subprocess.run([runner, str(test_file.relative_to(ROOT))], cwd=str(ROOT), capture_output=True, text=True)
    if r.stdout:
        print(r.stdout.strip())
    if r.returncode != 0:
        if r.stderr:
            print(r.stderr.strip(), file=sys.stderr)
        raise RuntimeError(f"{label} failed ({runner})")


def main():
    ap = argparse.ArgumentParser(description="Build Friday & Saturday Night")
    ap.add_argument("--ref-all", help="Set release.json ref for all venues")
    ap.add_argument("--ref-street", help="Set release.json ref for street only")
    ap.add_argument("--ref-video", help="Set release.json ref for video only")
    ap.add_argument("--ref-karaoke", help="Set release.json ref for karaoke only")
    ap.add_argument("--skip-tests", action="store_true", help="Skip running src/karaoke/test-lyrics.js")
    args = ap.parse_args()

    if not args.skip_tests:
        run_tests()

    fonts_css = read("shared/fonts.css")
    art_kit_js = read("shared/art-kit.js")
    venue_bridge_js = read("shared/venue-bridge.js")
    world_js = read("shared/world.js")
    ui_js = read("shared/ui.js")

    (ROOT / "app").mkdir(parents=True, exist_ok=True)

    # 1. Unified loader (app/index.html)
    loader = replace_once(read("loader/index.html"), "/* @@SHARED_FONTS@@ */", fonts_css, "loader/index.html")

    # 2. Shared Strip Mall hub (app/street.html)
    street_src = read("street/street.html")
    street_ver = extract_version(street_src, "street/street.html")
    street = replace_once(street_src, "/* @@SHARED_FONTS@@ */", fonts_css, "street/street.html")
    street = replace_once(street, "/* @@SHARED_VENUE_BRIDGE@@ */", venue_bridge_js, "street/street.html")
    street = replace_once(street, "/* @@SHARED_ART_KIT@@ */", art_kit_js, "street/street.html")
    street = replace_once(street, "/* @@SHARED_WORLD@@ */", world_js, "street/street.html")
    street = replace_once(street, "/* @@SHARED_UI@@ */", ui_js, "street/street.html")

    # 3. Friday Night Video (app/store.html)
    store_src = assemble("video/store.html")
    video_ver = extract_version(store_src, "video/store.html")
    store = replace_once(store_src, "/* @@SHARED_FONTS@@ */", fonts_css, "video/store.html")
    store = replace_once(store, "/* @@SHARED_VENUE_BRIDGE@@ */", venue_bridge_js, "video/store.html")
    store = replace_once(store, "/* @@SHARED_ART_KIT@@ */", art_kit_js, "video/store.html")

    # 4. Saturday Night Karaoke (app/bar.html)
    karaoke_app = read("karaoke/app.js")
    karaoke_ver = extract_version(karaoke_app, "karaoke/app.js")
    vendor_bar = (
        "<script>\n"
        "/* tweetnacl-js (public domain) and qrcode-generator (MIT, Kazuhiko Arase) */\n"
        + read("karaoke/vendor-nacl.js")
        + "\n"
        + read("karaoke/vendor-qrcode.js")
        + "\n</script>\n"
    )
    bar = (
        '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n'
        "<title>Saturday Night Karaoke</title>\n"
        '<style id="snk-fonts">\n' + fonts_css + "</style>\n"
        "<style>\n" + read("karaoke/font-pix.css") + read("karaoke/style.css") + "\n</style>\n"
        "<body>\n" + read("karaoke/body.html") + "\n" + vendor_bar
        + '<script>\n(function () {\n"use strict";\n'
        + venue_bridge_js
        + "\n// ===== shared art kit =====\n" + art_kit_js
        + "\n// ===== shared street (time of day, weather) and chrome =====\n" + world_js + "\n" + ui_js
        + "\n// ===== the bar's own art =====\n" + read("karaoke/art.js")
        + "\n// ===== the songbook =====\n" + read("karaoke/book.js")
        + "\n" + read("karaoke/relay.js")
        + "\n" + read("karaoke/pixly.js")
        + "\n// ===== lyrics parser & pace estimator =====\n" + read("karaoke/lyrics.js")
        + "\n// ===== filtered PLL playback clock =====\n" + read("karaoke/clock.js")
        + "\n// ===== instrumental / chapter track matcher =====\n" + read("karaoke/track-match.js")
        + "\n// ===== the bar =====\n" + karaoke_app
        + "\n})();\n</script>\n</body>\n</html>\n"
    )

    # 5. Karaoke phone songbook (index.html at repo root for GitHub Pages)
    phone = (
        read("karaoke/phone.html")
        + "<script>\n/* tweetnacl-js (public domain) */\n"
        + read("karaoke/vendor-nacl.js")
        + "\n</script>\n<script>\n(function () {\n\"use strict\";\n"
        + read("karaoke/book.js")
        + "\n" + read("karaoke/relay.js")
        + "\n" + read("karaoke/phone.js")
        + "\n})();\n</script>\n</body>\n</html>\n"
    )

    # 6. YouTube jukebox wrapper (player.html at repo root for GitHub Pages)
    player = read("karaoke/player.html")

    # 7. Validate release.json integrity: stop if a venue's hash changed without bumping ref or version
    rel_path = ROOT / "release.json"
    prev = json.loads(rel_path.read_text(encoding="utf-8")) if rel_path.exists() else {}
    prev_venues = prev.get("venues", {}) if isinstance(prev.get("venues"), dict) else {}
    default_ref = args.ref_all or prev.get("ref", "v1")

    def venue_ref(name, cli_val):
        if cli_val:
            return cli_val
        if args.ref_all:
            return args.ref_all
        return (prev_venues.get(name) or {}).get("ref", default_ref)

    next_venues = {
        "street": {"ref": venue_ref("street", args.ref_street), "version": street_ver, "sha256": sha256_hex(street)},
        "video": {"ref": venue_ref("video", args.ref_video), "version": video_ver, "sha256": sha256_hex(store)},
        "karaoke": {"ref": venue_ref("karaoke", args.ref_karaoke), "version": karaoke_ver, "sha256": sha256_hex(bar)},
    }

    stale = []
    for vname, cur_info in next_venues.items():
        old_info = prev_venues.get(vname)
        if not isinstance(old_info, dict):
            continue
        if old_info.get("sha256") and old_info.get("sha256") != cur_info["sha256"]:
            if old_info.get("ref") == cur_info["ref"] and old_info.get("version") == cur_info["version"]:
                stale.append(f"{vname} (ref={cur_info['ref']}, version={cur_info['version']})")
    if stale:
        raise RuntimeError(
            "Venue hash changed without bumping APP_VERSION or --ref-<venue>: "
            + ", ".join(stale)
            + ". Bump APP_VERSION and/or pass --ref-<venue> / --ref-all."
        )

    # Write built files & manifest
    # nothing goes out with a marker still in it (a shared file or a store piece that never got swapped in)
    for name, content in (("app/index.html", loader), ("app/street.html", street), ("app/store.html", store), ("app/bar.html", bar)):
        left = re.findall(r"@@(?:SHARED_[A-Z_]+|INCLUDE [\w./-]+)@@", content)
        if left:
            raise RuntimeError(f"{name} still has unreplaced markers: {', '.join(sorted(set(left)))}")
    (ROOT / "app" / "index.html").write_text(loader, encoding="utf-8")
    (ROOT / "app" / "street.html").write_text(street, encoding="utf-8")
    (ROOT / "app" / "store.html").write_text(store, encoding="utf-8")
    (ROOT / "app" / "bar.html").write_text(bar, encoding="utf-8")
    (ROOT / "index.html").write_text(phone, encoding="utf-8")
    (ROOT / "player.html").write_text(player, encoding="utf-8")

    rel = {
        "ref": default_ref,
        "version": street_ver,
        "venues": next_venues,
        "note": "Per-venue release manifest. Run python3 src/build.py (optionally with --ref-video / --ref-karaoke / --ref-street / --ref-all) to rebuild and refresh versions & sha256 hashes.",
    }
    rel_path.write_text(json.dumps(rel, indent=2) + "\n", encoding="utf-8")

    for name, content in [
        ("app/index.html", loader),
        ("app/street.html", street),
        ("app/store.html", store),
        ("app/bar.html", bar),
        ("index.html", phone),
        ("player.html", player),
    ]:
        print(f"Built {name:16s} {len(content):>7,d} bytes  sha256={sha256_hex(content)[:12]}…")
    print(f"Versions: street={street_ver}  video={video_ver}  karaoke={karaoke_ver}")


if __name__ == "__main__":
    main()
