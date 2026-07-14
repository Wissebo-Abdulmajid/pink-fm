# Phase 4.1 Release Report

Status: release candidate, not complete.

Phase 4.1 implemented the full-song eligibility model and guaranteed recommendation gate, but the curated source pool is currently 15 Siti tracks. This is enough to guarantee generated main-radio recommendations are full-subscription-free from the eligible pool, but it does not meet the 80-track curation target.

## Baseline

- Starting commit: `39b65303690af93e62b8717bd7fd18bfe84a155c`
- Branch: `feature/full-song-coverage`
- Baseline tests: 137 passing
- Baseline full-subscription-free YouTube coverage: 0
- Baseline Apple preview coverage: 142 preview-capable tracks

## Final Coverage

- Full-subscription-free Siti tracks: 15
- Exact studio / official-audio source count: 9
- Official music-video source count: 15
- Official live / alternate source count: 3
- Tracks with two or more sources: 9
- Tracks with one source: 6
- Preview-only tracks: 127
- External-only tracks: 0
- Unavailable tracks: 0
- Main-radio generated recommendation guarantee: 100%
- WisseBot guarantee: uses the shared `tuneTarget` full-song gate
- Gap to 80-track target: 65
- Gap to 100-track preferred target: 85

## Implemented

- Added `PlaybackCoverageClass`.
- Added `FullPlaybackSource`.
- Added `public/gifts/siti/youtube-authorities.json`.
- Added a strict `isRadioEligible(track)` gate.
- Applied the gate to app-level radio, queue, daily and WisseBot recommendation calls.
- Changed automatic provider selection to YouTube first for full-song sources.
- Kept Spotify and Apple as secondary/manual providers.
- Prevented Apple previews from satisfying full-song radio by default.
- Added listener settings for official alternate versions and preview fallback.
- Added local YouTube prepare, audit, verify and embed-check scripts.
- Updated validation to reject unregistered YouTube channels and bad full-source provenance.
- Updated playback history semantics without changing the Phase 4 listening signal.

## Quality Gates

- `npm.cmd run verify`: passed
- Final tests: 144 passing across 21 files
- ESLint: passed
- Strict TypeScript: passed
- Content validation: passed with the existing artwork warning
- Catalogue audit: passed with 0 errors and 23 existing partial-album warnings
- Full-song audit: passed structurally
- Local YouTube source verification: passed
- Root production build: passed
- `/pink-fm/` production build: passed
- Root browser QA: passed, 29 checks
- `/pink-fm/` browser QA: passed, 29 checks

## Bundle Snapshot

- Root main JS: 350.74 kB / 108.26 kB gzip
- Root CSS: 69.98 kB / 16.23 kB gzip
- Root lazy `EmbeddedRadioPlayer`: 17.03 kB / 5.34 kB gzip
- `/pink-fm/` main JS: 350.77 kB / 108.27 kB gzip
- `/pink-fm/` lazy `EmbeddedRadioPlayer`: 17.03 kB / 5.34 kB gzip

## Honest Limitations

- The curated full-song pool is 15 tracks, not 80 or 100.
- Physical Android/iPhone playback has not been performed.
- The Codex browser environment blocked YouTube provider scripts, so automated QA verified the full-song YouTube shell and fallback behavior but did not prove real YouTube playback.
- Regional YouTube availability cannot be guaranteed globally.
- YouTube source availability can change after deployment.
- No secondary Malaysian Legends pool has been populated in this phase.
- No music files, provider secrets, media proxies or unofficial audio sources were added.
