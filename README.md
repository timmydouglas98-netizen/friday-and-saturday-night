# Friday & Saturday Night

**Friday Night Video** and **Saturday Night Karaoke** combined into one TizenOS / TizenBrew app for Samsung TVs — two doors on the same 90s strip mall.

## How it opens & switches venues

- **Boots straight into your last venue** (defaults to **Friday Night Video** on first run, so movie night has zero extra clicks).
- **Walk next door**: From outside Friday Night Video, press **Right** to walk next door to Saturday Night Karaoke. From outside the bar, press **Left** to walk back to the Video Store.
- **The Strip (`app/street.html`)**: Press **Back** from either storefront to step out onto the shared Strip Mall hub showing both buildings side by side. The shop you're at is lit and the other falls into shadow; one caption below the kerb says where OK will take you. Press **Back** twice from the Strip to exit the TV app.
- **One street, one sky**: The Strip and both storefronts are the same block from different spots — the video store under its mansard with its pole sign on the left, an alley, then the two-storey brick bar with its streetlight. Walking between them slides the scene the way you walk.
- **Time of day and weather are shared**: set them in Friday Night Video at the front desk → **Outside: weather & decorations** (painted dusk or follow the clock; live weather for your suburb or a pinned sky). The Strip and the bar read the same settings and forecast (`src/shared/world.js`), so it only rains in all three at once.

## What's inside

- **Shared code (`src/shared/`)**: fonts, the cel art kit, the venue bridge (switching, boot confirmation, walking transitions), `world.js` (time of day and weather) and `ui.js` (the clock and the key-cap button hints every venue uses).

- **Friday Night Video (`app/store.html`)**: The full 90s video store front-end for Stremio.
- **Saturday Night Karaoke (`app/bar.html`)**: The full karaoke bar with LRCLIB lyrics, YouTube backing tracks, bitmap karaoke lettering, duets, Sound Check, live `Info` timing overlay, and E2EE phone requests.
- **Unified Loader (`app/index.html`)**:
  - Caches each venue in **IndexedDB** and automatically clears legacy `fnv-store-cache` / `snk-bar-cache` entries from `localStorage` once on first run.
  - Caches `release.json` in `sessionStorage` for the session so venue switches stay instant when up to date while still picking up OTA updates for every venue.
  - Verifies both `APP_VERSION` and SHA-256 (when `crypto.subtle` is available), with independent per-venue rollback and quick-exit boot confirmation flushing.
- **Phone Songbook & Jukebox (`index.html`, `player.html`)**: Served from GitHub Pages at the repository root. `player.html` uses the official YouTube IFrame API (`YT.Player`) to poll playback time every 75 ms, falling back automatically to a plain iframe relay.

## Quick local test (on Mac / PC)

Unzip the folder and open **`app/index.html`** (or **`app/street.html`**, **`app/store.html`**, **`app/bar.html`**) in any browser, or serve the folder with `python3 -m http.server 8000` and visit `http://localhost:8000/app/`.

- **Arrow keys**: Navigate doors, shelves, songbook, and menus
- **Enter**: OK / select
- **Esc**: Back (steps outside, then to the Strip)
- **R / G / Y / B**: Coloured remote buttons
- **I**: Toggle the live timing overlay on stage (same as **Info** on the TV remote)

## YouTube Sound Check (calibrating TV / soundbar delay)

YouTube and the built-in Web Audio house band can have different audio latencies on a Samsung TV. To calibrate the YouTube path:

1. **Create a 60+ second click-track video** with a short click every **0.8 s** starting at **2.000 s** (for example with `ffmpeg`):
   ```bash
   python3 -c '
   import math, struct, wave
   sr, dur = 48000, 64
   n = sr * dur
   buf = [0] * n
   t = 2.0
   while t < dur - 0.1:
       s0 = int(round(t * sr))
       for i in range(int(0.025 * sr)):
           if s0 + i < n:
               env = math.exp(-i / (0.006 * sr))
               buf[s0 + i] = int(28000 * env * math.sin(2 * math.pi * 1760 * i / sr))
       t += 0.8
   with wave.open("click-track.wav", "wb") as w:
       w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
       w.writeframes(struct.pack("<" + "h" * n, *buf))
   ' && ffmpeg -f lavfi -i color=c=black:s=640x360:r=30 -i click-track.wav -c:v libx264 -tune stillimage -c:a aac -b:a 192k -shortest click-track.mp4
   ```
2. **Upload `click-track.mp4` to YouTube as Unlisted** and copy its 11-character video ID (or full YouTube URL).
3. **Enter it on the TV**: Ring the bell → **Sound check** → **YouTube click-track video ID** (or hardcode `CHECK_YT_ID` in `src/karaoke/app.js` and rebuild).
4. Run **YouTube sound check** and line the flashing lamp up with the click you hear.

## Putting it on your Samsung TV (TizenBrew)

1. Push this folder to a public GitHub repository (e.g., `your-username/friday-and-saturday-night`).
2. Update `REPO` in `src/loader/index.html` and `src/karaoke/app.js` if your repository name differs, then run `python3 src/build.py`.
3. Enable **GitHub Pages** (**Settings → Pages → Deploy from branch → `main` / `(root)`**) so `index.html` and `player.html` are live.
4. Build with `--ref-all v3` (or per-venue flags), commit, tag that commit with the same name (e.g., `v3`) and push the branch and the tag. A changed venue always needs a **new** tag name: TVs download each venue's files from the tag named in `release.json`.
5. In **TizenBrew**, add the GitHub module `your-username/friday-and-saturday-night` and launch **Friday & Saturday Night**.

## Shipping per-venue updates

Each venue has its own `ref`, `version` (read automatically from `APP_VERSION`), and `sha256` in `release.json`. `src/build.py` automatically runs the lyric timing test suite (`src/karaoke/test-lyrics.js`) and stops with an error if a venue's built hash changed without bumping its `APP_VERSION` or `--ref-*` flag:

```bash
python3 src/build.py --ref-karaoke v2
```

(Or `--ref-video v2`, `--ref-street v2`, or `--ref-all v2`.)
