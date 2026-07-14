# Phase 4 release report — in-site playback

Date: 2026-07-14  
Branch: `feature/in-site-playback`  
Status: release candidate; one external-provider acceptance gate remains physically unverified.

## Outcome

Pink FM now keeps recommendations on `RadioPage` and loads an authorised provider inside the retro-radio casing after consent. Provider choice is deterministic and capability-aware, controller instances persist across recommendations, autoplay is never assumed, external navigation is secondary, and actual playback starts are distinct from recommendation display and outbound clicks.

The implementation quality gates pass. The headless environment denied the official Spotify script with `ERR_NETWORK_ACCESS_DENIED`; Pink FM correctly exposed failure, Retry, and “Open in Spotify” for the real reviewed Cindai recommendation. Because no Spotify iframe could load in this environment, Phase 4 is not represented as universally complete until the real-provider physical matrix is performed.

## Baseline and final gates

| Measure | Baseline | Final |
| --- | ---: | ---: |
| Test files | 15 | 20 |
| Tests | 104 | 137 |
| Main JS | 338.31 kB / 104.92 kB gzip | 344.87 kB / 106.85 kB gzip (root) |
| RadioPage | 9.38 kB / 3.29 kB gzip | 8.16 kB / 2.80 kB gzip |
| Lazy embedded-player chunk | none | 15.86 kB / 4.98 kB gzip |
| Main CSS | 66.22 kB / 15.51 kB gzip | 69.67 kB / 16.17 kB gzip |

Main JS changed by +6.56 kB raw / +1.93 kB gzip. Player/provider code is lazy and does not enter the initial page bundle. The `/pink-fm/` build measured 344.90 kB / 106.86 kB gzip for main JS and 15.86 kB / 4.97 kB gzip for the lazy player.

`npm.cmd run verify` passed: ESLint, strict TypeScript, content validation, catalogue audit, playback audit, 137 tests and root production build. Root and `/pink-fm/` builds passed independently. Both base paths passed 29 browser checks with zero unexpected console errors.

## Catalogue playback coverage

| Measure | Result |
| --- | ---: |
| Active tracks | 142 |
| Reviewed/recommendation-ready | 105 |
| Direct Spotify track URLs / Spotify embeds | 11 |
| Spotify album-only URLs | 1 |
| Invalid Spotify URLs | 0 |
| Verified official YouTube records | 0 |
| Apple preview-capable tracks | 142 |
| External-only tracks | 0 |
| Tracks without a destination | 0 |
| In-site preview/embed coverage | 142 / 142 (100%) |
| Reviewed recommendation-ready coverage | 105 / 105 (100%) |
| Siti Essentials coverage | 26 / 26 (100%) |

Apple coverage means an official preview-capable iframe boundary, not guaranteed full-track playback. No YouTube URL was added without a manually verified official upload. The one album-level Spotify gap is `aku-cinta-padamu`; it was preserved and was not counted as track-playable. No links were corrected or fabricated in this phase.

Reviewed in-site coverage by mood (tracks with that mood score at least 60): peaceful 39/39, happy 47/47, romantic 68/68, confident 67/67, energised 41/41, nostalgic 69/69, elegant 99/99, comforted 58/58, dramatic 72/72. Every main mood exceeds the 12-track target.

## Provider architecture

- Spotify: exact-host/path parser, URI derivation, consent-gated singleton/recoverable iFrame API loader, reusable/destroyable controller, real load/play/pause/state/progress capability, secondary official link, no OAuth or Web Playback SDK.
- YouTube: exact video-ID validation, required `verifiedOfficial: true` and source provenance, consent-gated singleton IFrame API, visible standard video, reusable cue/play/pause controller, no search or API key.
- Apple: validated official host, derived embed hostname, visible native preview controls, no fake custom play/pause, no MusicKit tokens.
- External: official destination only, opened-event semantics, never automatic navigation.
- Queue: current, prepared next and previous actually-started track; next, another, replay preparation, different era and different album actions remain on the radio.

## Playback history and consent

Listener storage is now version 4 and migrates versions 1–3 without destroying favourites or history. Recommendation rotation remains separate from listening history. `playback-started` alone increments play counts; loaded, recommended, external, failed and skipped events do not. Reliable provider completion can record `playback-completed`.

The profile-scoped consent states are ask, allowed and external-only. No provider script is requested before allow. Settings exposes consent and Automatic/Spotify/YouTube/Apple playback preference. Denial preserves recommendations, queue, feedback, favourites, WisseBot and official links. No analytics was added.

## Browser QA

Root `/` and GitHub Pages `/pink-fm/` each passed 29 headless Chromium checks: 320/390/768/1280 widths; 200% text; reduced motion; high contrast; keyboard and touch; 44 px player/radio targets; consent accept/deny; no pre-consent provider request; real Cindai Spotify selection; blocked-provider fallback; rapid changes with one persistent shell; long titles; offline cache and honest music message; missing profile; semantic failures; and no horizontal overflow.

Spotify iframe result in this environment: **blocked before iframe creation** by network policy. This is a passed failure-path test, not a playback-success claim.

Physical tests still required:

- Spotify signed in and signed out.
- Desktop Chrome, Edge, Firefox and Safari with normal and restricted third-party cookies.
- Actual iPhone/Safari and Android/Chrome, including NFC launch.
- Spotify unavailable in region and a real embed-blocking extension.
- VoiceOver and TalkBack focus/reading order.
- Confirm at least one real Spotify iframe loads and starts after a user gesture.

## Service worker, assets and security

The cache namespace is `pink-fm-v4`. Only same-origin app/profile assets are handled. Provider scripts, iframe pages, media, authentication and cookies are excluded by the same-origin boundary. Repository scans found no hosted music file extensions and no committed client/developer/access-token assignments. Existing NFC/profile routes were not changed. Main was not checked out, merged, pushed or deployed.

## Files added

- Playback shell, consent, controls, status, fallback, queue, controller/history hooks, events/types and provider selection under `src/features/player/`.
- Spotify, YouTube, Apple and external provider implementations under `src/features/player/providers/`.
- Provider, content, history, consent and lifecycle tests.
- `scripts/prepare-in-site-playback.ts` and `scripts/audit-playback-coverage.ts`.
- Phase 4 baseline, architecture, preparation, audit, browser QA and release documents.

## Files materially changed

- `src/pages/RadioPage.tsx`, `SettingsPage.tsx` and `LibraryPage.tsx`.
- `src/app/providers.tsx`, `src/lib/storage.ts`, `src/config/schemas.ts` and `src/config/constants.ts`.
- `src/styles/radio.css`, `public/sw.js`, `package.json`, `README.md`.
- Catalogue import/preparation/dedupe/content-validation tools and the template/current track schema versions.
- Browser QA harness, machine-readable reports and refreshed screenshots.

## Working tree

The feature branch is intentionally uncommitted and therefore not clean. `git status --short` lists the Phase 4 source, test, documentation, report and screenshot changes. No unrelated branch operation was performed.

## Exact substantive commands executed

```powershell
git branch --show-current
git status --short
npm.cmd run verify
npm.cmd run content:validate
npm.cmd run playback:prepare -- --slug siti --dry-run
npm.cmd run playback:audit -- --slug siti
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
$env:VITE_BASE_PATH='/'; npm.cmd run build
$env:VITE_BASE_PATH='/pink-fm/'; npm.cmd run build
$env:QA_NO_SANDBOX='1'; npm.cmd run qa:browser
$env:QA_NO_SANDBOX='1'; $env:QA_BASE_URL='http://127.0.0.1:4173/pink-fm'; npm.cmd run qa:browser
```

The first browser attempt without `QA_NO_SANDBOX` hit the documented disposable Windows Chromium GPU-cache race before app load. The no-sandbox flag was used only for the local headless harness. Subsequent app runs passed.

## Remaining editorial work

- Independently review a direct Spotify track URL for `aku-cinta-padamu`.
- Add YouTube data only when an official upload and provenance can be manually confirmed.
- Complete the 37 metadata-only tracks’ subjective listening review separately from playback coverage.
- Run the physical/provider matrix above; do not change coverage data merely to satisfy a target.
