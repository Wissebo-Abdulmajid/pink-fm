# Phase 4.2 Browser QA

## Automated browser QA

- Root build browser QA: passed.
- Report: `docs/browser-qa.json`.
- Checks passed: 29.
- Unexpected console errors: 0.
- `/pink-fm/` build: passed.
- `/pink-fm/` browser QA: blocked by local Chromium launch failure after the Pages build.

Commands run:

- `npm.cmd run build`
- `npm.cmd run qa:browser`
- `npm.cmd run build -- --base=/pink-fm/`
- `$env:QA_BASE_URL='http://127.0.0.1:4174/pink-fm'; npm.cmd run qa:browser`

The first Pages QA attempt used an already-running root-base preview server and correctly failed on `/pink-fm/assets/...` 404s. A fresh `/pink-fm/` preview was then started on port 4174 and responded with HTTP 200. Subsequent Pages QA attempts failed before app checks began because Chromium/Edge repeatedly crashed during GPU persistent-cache initialization.

## Manual playback route

Route: `#/g/siti/playback-test`

Coverage:

- Representative verified primary and backup sources are listed from the active catalogue.
- The route uses the real embedded player path and normal consent state.
- Primary-source failure simulation uses a controlled invalid YouTube ID and a real backup source when available.
- Retune testing selects the next verified full-song Siti track from the current catalogue.

## Current real-provider status

- Real YouTube playback: pending.
- Physical phone tests: not performed.
- YouTube Data API live source acquisition: not performed because `YOUTUBE_DATA_API_KEY` is not set.
- Pages browser QA app assertions: not completed because the browser process crashed before navigation checks could run.

Do not treat this as passed real playback until a browser outside restricted Codex networking proves that at least one accepted source reaches ready/playing/paused states.
