# Phase 4.1 Baseline

Recorded: 2026-07-14

## Repository state

- Branch: `feature/full-song-coverage`
- Starting commit: `39b65303690af93e62b8717bd7fd18bfe84a155c`
- Working tree before Phase 4.1 edits: clean
- Main branch was not checked out.
- No merge, push, deployment, or commit was performed.

## Verification baseline

Command:

```powershell
npm.cmd run verify
```

Result: passed.

Baseline verification included:

- ESLint: passed
- Strict TypeScript: passed
- Content validation: passed with the existing artwork warning
- Catalogue audit: passed with 0 errors and 23 existing partial-album warnings
- Playback audit: passed structurally
- Tests: 137 passed across 20 files
- Production build: passed

## Existing catalogue and playback coverage

From the Phase 4 playback audit:

- Active tracks: 142
- Reviewed tracks: 105
- Direct Spotify track URLs: 11
- Spotify album-only URLs: 1
- Invalid Spotify URLs: 0
- Spotify embed playable tracks: 11
- Verified YouTube playable tracks: 0
- Apple preview tracks: 142
- External-only tracks: 0
- Tracks without destination: 0
- Previous in-site playable metric: 142 / 142, because Apple previews were counted

Phase 4.1 corrects this metric. Apple previews are not full-song playback and must not count toward the guaranteed full-song radio requirement.

## Current schema baseline

- Track file schema version: 3
- Existing playback object:
  - `preferredProvider`
  - `spotify`
  - `youtube`
  - `appleMusic`
- Existing `playback.youtube` only supports a manually verified `videoId`, `verifiedOfficial`, and `sourceId`.
- No `playbackCoverage` or `fullPlaybackSources` fields existed at baseline.

## Current provider architecture

Phase 4 introduced provider adapters under `src/features/player/`:

- `spotify-embed`
- `youtube-embed`
- `apple-preview`
- `external`

Automatic provider order at baseline:

1. Spotify Embed
2. Verified YouTube embed
3. Apple Music preview
4. External

Phase 4.1 changes the guaranteed radio path so YouTube full-song sources are primary for normal radio playback.

## Current playback-history format

Storage schema version at baseline: 4.

The existing event model distinguishes:

- `recommended`
- `player-loaded`
- `playback-started`
- `playback-paused`
- `playback-completed`
- `externally-opened`
- `skipped`
- `failed`

Only `playback-started` increments listening history and play counts. Recommendation display, iframe load, external opening, skip, and failure do not count as in-site listening.

## Baseline limitation

The committed Phase 4 candidate has a provider-compliant embedded player architecture, but it does not guarantee full-length subscription-free playback. It has zero verified full-song YouTube sources and relies on Apple preview coverage in the previous audit metric.
