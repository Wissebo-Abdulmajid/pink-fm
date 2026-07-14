# Phase 4 browser QA

## Automated matrix

The production browser harness covers both root and `/pink-fm/` base paths; 320 px and 390 px phones; 768 px tablet; 1280 px desktop; 200% root text; reduced motion; keyboard tuning; touch presets; long Malay/catalogue titles; consent accepted and denied; no provider request before consent; Spotify embed success or an honest blocked-provider fallback; rapid recommendation changes; offline cached reopening and the offline music message; missing profiles; semantic failure; service-worker behavior; touch-target size; horizontal overflow; and unexpected console errors.

Run after the corresponding production build and preview:

```powershell
npm.cmd run qa:browser
$env:QA_BASE_URL='http://127.0.0.1:4173/pink-fm'; npm.cmd run qa:browser
```

Machine-readable results are written to `docs/browser-qa.json` and `docs/browser-qa-pages.json`. Screenshots are refreshed under `docs/screenshots/`.

## Interpretation

A headless result verifies application behavior and layout, not provider universality. Spotify’s signed-in/signed-out and preview/full behavior belongs to Spotify. Cookie blocking, regional availability and extensions can prevent an otherwise valid embed; Pink FM must show Retry and an external fallback instead of redirecting or claiming playback.

## Physical tests still required

- Signed-in and signed-out Spotify on desktop Chrome, Edge, Firefox and Safari.
- A real iPhone/Safari and Android/Chrome at 320–390 CSS-pixel widths.
- Third-party cookies restricted in real browser settings.
- Spotify unavailable in the tester’s region and a content-blocking extension.
- Screen-reader reading order and focus behavior on VoiceOver and TalkBack.
- Real touch operation, network handoff, and NFC launch on physical devices.

No physical Android or iPhone result is claimed by the automated harness.
