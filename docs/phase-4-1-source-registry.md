# Phase 4.1 Source Registry

Recorded: 2026-07-14

Pink FM now requires a trusted YouTube channel registry before a YouTube video can count as guaranteed full-song radio playback.

Registry file:

`public/gifts/siti/youtube-authorities.json`

## Registered Channels

| Channel | Channel ID | Authority | Status |
| --- | --- | --- | --- |
| Siti Nurhaliza | `UCNq-mu-iXUmiAWyDOcJmZZg` | artist-official | active |
| SuriaRecords (SRC) | `UCBd5pENmJrvi6PQq-2ndBhw` | label-official | active |
| MVM MUSIC | `UCquIzvgQ4PxPDZqFXhuT_gw` | licensed-broadcaster | active |

## Enforcement

- `scripts/validate-content.ts` rejects full playback sources whose channel is not registered.
- `npm run youtube:verify -- --slug=siti` rejects unregistered channels, duplicate primary sources, Shorts, missing provenance and invalid source URLs.
- `npm run youtube:audit -- --slug=siti` reports full-song coverage separately from previews and external-only tracks.

## Current Curated Set

- Guaranteed full-subscription-free Siti tracks: 15
- Tracks with two or more full sources: 9
- Tracks with one full source: 6
- Gap to 80-track target: 65
- Gap to 100-track preferred target: 85

This registry does not trust channel names alone. Each stored source carries a channel ID, provenance source ID, verified date, duration evidence and source URL.
