# Phase 4.1 Browser QA

Status: automated root and `/pink-fm/` browser QA passed.

## Required Coverage

The Phase 4.1 browser QA must cover both `/` and `/pink-fm/` production bases.

Required scenarios:

- Full YouTube source success
- Backup YouTube source success
- Primary and backup failure
- Region-style error simulation
- Embed-disabled simulation
- Offline messaging
- Slow connection
- Consent accepted
- Consent denied
- 320px mobile
- 390px mobile
- Tablet
- Desktop
- 200% text
- Keyboard operation
- Reduced motion
- Rapid track changes
- Player destroyed and recreated
- Returning from background
- Long song title
- Live-version label
- Replacement message

## Current Constraint

No physical Android or iPhone testing has been performed in this Codex environment. Physical-device playback and regional checks remain required before a final release declaration.

## Current Automated Status

- Root base `/`: passed, 29 checks, zero unexpected console errors.
- GitHub Pages base `/pink-fm/`: passed, 29 checks, zero unexpected console errors.
- Reports:
  - `docs/browser-qa.json`
  - `docs/browser-qa-pages.json`

## Provider Note

This Codex browser environment blocks direct YouTube provider script loads with `ERR_NETWORK_ACCESS_DENIED`. The automated QA therefore verifies the full-song YouTube radio shell, consent behavior, fallback link, provider-block handling and layout/accessibility states. It does not prove physical-device YouTube playback.
