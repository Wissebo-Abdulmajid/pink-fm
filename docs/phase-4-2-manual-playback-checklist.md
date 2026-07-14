# Phase 4.2 Manual Playback Checklist

Manual route: `#/g/siti/playback-test`

This route is hidden from normal navigation and uses the same profile-scoped catalogue and embedded player architecture as the radio experience. It does not expose or require a YouTube Data API key.

## Required manual checks

- Open the app at `/` and navigate directly to `#/g/siti/playback-test`.
- Accept embedded-player consent.
- Select a representative primary source.
- Confirm the YouTube player remains visible and at least 200 by 200 CSS pixels.
- Confirm YouTube controls and attribution are not covered or hidden.
- Press Play through the visible provider controls where the browser permits it.
- Confirm observed states: ready, playing, paused, ended.
- Use “Simulate primary-source failure”.
- Confirm the player attempts the backup source for the same track.
- Use “Test backup source only”.
- Confirm backup source metadata shows the correct video ID, authority and version.
- Use “Retune to nearest full song”.
- Confirm the UI states that the original frequency was unavailable and a closest full song is used where this occurs in the main radio flow.
- Repeat at 320px and 390px viewport widths.
- Repeat with 200% text zoom.
- Repeat with reduced motion enabled.
- Repeat with keyboard-only navigation.
- Repeat with consent denied and confirm external fallback remains available.

## Current Codex-environment status

- Real YouTube playback test: pending.
- Reason: `YOUTUBE_DATA_API_KEY` is not set and provider networking can be restricted in the Codex environment.
- Do not mark full real playback as passed until an actual browser can load YouTube provider scripts and play an accepted source.

## Acceptance rule

Only official or clearly authorised, embeddable, full-length YouTube sources from `public/gifts/siti/youtube-authorities.json` can satisfy the guaranteed radio path. Spotify embeds, Apple previews and external links do not count toward Phase 4.2 full-song coverage.
