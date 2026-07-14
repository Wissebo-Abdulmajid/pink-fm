# Phase 4.2 Release Report

## Summary

Phase 4.2 completed a conservative YouTube trusted-channel acquisition review for the Siti profile. The temporary local `YOUTUBE_DATA_API_KEY` was used before this report was written; it was not printed, persisted, committed or added to project files.

The review accepted only clear full-length, embeddable, official trusted-channel uploads with matching track identity and recorded provenance. It did not force the requested 60-track target. The final audited result is 54 guaranteed full-subscription-free tracks, leaving a gap of 6 tracks to the 60-track milestone.

## Candidate Review

- Candidate records reviewed: 1,852
- Accepted exact official candidates: 72
- Accepted candidate tracks: 49
- New full-playable tracks added: 39
- Wrong song: 1,269
- Medley / compilation: 329
- Needs listening review: 95
- Duplicate / lower-priority backup: 46
- Preview / short duration: 29
- Alternate / live / acoustic version: 12
- Pending candidates: 0

Accepted sources came only from the registered active authorities in `public/gifts/siti/youtube-authorities.json`:

- `UCNq-mu-iXUmiAWyDOcJmZZg` — Siti Nurhaliza — artist-official
- `UCBd5pENmJrvi6PQq-2ndBhw` — SuriaRecords (SRC) — label-official
- `UCquIzvgQ4PxPDZqFXhuT_gw` — MVM MUSIC — licensed-broadcaster

## Final Audited Coverage

- Total active tracks: 142
- Full-playable tracks: 54
- Preview-only tracks: 88
- New active YouTube source count: 72
- Total full-playback sources: 96
- Tracks with two or more sources: 36
- Tracks with one source: 18
- Official music videos: 55
- Official audio / lyric-video sources: 38
- Live and alternate sources: 3
- Broken source count: 0
- Target gap to 60 full-playable tracks: 6
- Target gap to 80 full-playable tracks: 26
- Target gap to 100 full-playable tracks: 46

## Coverage by Mood

- peaceful: 27
- happy: 25
- romantic: 39
- confident: 41
- energised: 22
- nostalgic: 44
- elegant: 52
- comforted: 41
- dramatic: 45

## Coverage by Collection

- comfort-calm: 2
- duets-collaborations: 2
- elegant-evenings: 20
- festive-frequency: 4
- hidden-gems: 10
- joyful-upbeat: 14
- modern-siti: 2
- nostalgic-classics: 51
- powerful-vocals: 14
- romantic-siti: 27
- siti-essentials: 17
- traditional-nusantara: 12

## Source Authority Counts

- artist-official: 70
- label-official: 24
- licensed-broadcaster: 2

## QA Status

- `npm.cmd run youtube:apply-reviewed -- --slug=siti --apply`: passed; added 72 sources and raised full coverage from 15 to 54 tracks.
- `npm.cmd run youtube:recheck -- --slug=siti`: passed.
- `npm.cmd run youtube:verify -- --slug=siti`: passed.
- `npm.cmd run youtube:audit -- --slug=siti`: passed.
- `npm.cmd run verify`: passed with the existing artwork fallback and partial-album coverage warnings.
- `npm.cmd run build`: passed for `/`.
- `VITE_BASE_PATH=/pink-fm/ npm.cmd run build`: passed for `/pink-fm/`.

## Guarantee Status

- Main radio recommendation guarantee: 100% in structural audit.
- WisseBot guarantee: preserved through the existing full-song recommendation context.
- Queue guarantee: preserved through the existing full-song recommendation context.
- Preview fallback default: off.
- No automatic external navigation: preserved.
- No music files hosted: preserved.
- No provider credential committed: preserved.
- No untrusted upload activated: preserved.

## Honest Limitations

The 60-track full-song target was not reached. The remaining gap is intentional: candidates with wrong identity, compilation/medley structure, unclear labels, live/alternate versions, short duration, duplicate evidence or listening-review uncertainty were not accepted merely to improve the count.

Real YouTube playback can still vary by region, account, cookies, blockers and YouTube policy changes. The local structural verifier confirms trusted channels, embeddability flags, durations, full-length flags, provenance and source URL consistency; it does not guarantee future real-world playback availability.
