# Phase 4 baseline — in-site playback

Captured on 2026-07-14 before Phase 4 source changes.

## Repository state

- Branch: `feature/in-site-playback`
- Working tree: clean
- Profile route: unchanged (`#/g/siti`)
- Gift schema version: 1
- Track catalogue schema version: 2
- Listener storage schema version: 3

## Verification baseline

`npm.cmd run verify` passed in 57.8 seconds.

- ESLint: passed
- Strict TypeScript project build: passed
- Content validation: passed with the existing 142-artwork warning
- Catalogue audit: passed with 0 errors and 23 partial-album warnings
- Tests: 104 passed in 15 files
- Production build: passed

Initial production build measurements:

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| Main JavaScript | 338.31 kB | 104.92 kB |
| RadioPage chunk | 9.38 kB | 3.29 kB |
| Main CSS | 66.22 kB | 15.51 kB |
| Semantic worker | 602.30 kB | not reported |
| ONNX runtime WASM | 23,567.05 kB | 5,824.05 kB |

## Catalogue playback baseline

| Measure | Count |
| --- | ---: |
| Total tracks | 142 |
| Active tracks | 142 |
| Recommendation-ready reviewed tracks | 105 |
| Direct Spotify track URLs | 11 |
| Spotify album URLs | 1 |
| Tracks without Spotify URLs | 130 |
| Existing Apple Music links | 142 |
| Existing YouTube links/records | 0 |
| Existing embed records | 0 |

The single album-level Spotify destination is `aku-cinta-padamu`. It is not eligible for Spotify track embedding until a direct track URL is independently reviewed.

## Existing playback architecture

`src/features/player/PlaybackAction.tsx` is link-centred. It selects the listener's preferred outbound service, falling back to another configured official link. A legacy `embed` record can render one allow-listed iframe, but the catalogue contains no such records and there is no provider lifecycle, reusable controller, consent gate, state reporting, retry flow, or deterministic capability selection.

`src/pages/RadioPage.tsx` mounts `PlaybackAction` inside the recommendation card. Recommendation changes replace that component rather than driving a persistent radio-owned provider controller.

Playback history is inaccurate at baseline: displaying a recommendation writes it to `history`, while clicking an external provider link calls `markPlayed` and increments `playCounts`. Thus recommendations are treated as listening-history entries and outbound navigation is treated as an actual play.

The service worker uses cache namespace `pink-fm-v3`. It handles same-origin requests only and therefore does not deliberately cache third-party provider media, iframe pages, scripts, authentication, or cookies.

## Required Phase 4 correction

Phase 4 will introduce capability-aware adapters, explicit embed consent and provider preference, provider event semantics, a persistent player integrated into the radio casing, honest external/preview fallbacks, safe storage migration, catalogue preparation/audit tooling, and tests that distinguish recommendation, load, actual playback start, external opening, skip, failure, and reliable completion.
