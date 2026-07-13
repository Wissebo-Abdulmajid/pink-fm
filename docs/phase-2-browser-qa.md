# Phase 2 browser QA

Production-preview QA completed on 13 July 2026 with Google Chrome on Windows. The automated harness drives the real built application through the Chrome DevTools Protocol and records screenshots plus machine-readable reports.

## Passed scenarios

- 320 × 760 and 390 × 844 mobile layouts, 768 × 1024 tablet, and 1280 × 900 desktop
- no horizontal overflow, including long catalogue titles at 320 pixels
- welcome, mood, radio, 142-track library search, missing-profile, and WisseBot flows
- mouse/touch preset selection and keyboard tuning-dial adjustment
- English, Bahasa Melayu, and mixed-language requests
- semantic opt-in disclosure and lightweight mode
- real no-WebGPU execution through the WASM backend
- slow/unavailable semantic fallback, corrupted index, and stale manifest
- reduced-motion media behaviour
- cached profile metadata while offline after a successful online load
- zero unexpected console errors

The real WASM run initialized in 14,455 ms, then measured 81 ms for its first semantic request and 32 ms for its repeat request. Full conditions are documented in `docs/semantic-model-benchmark.md`.

## Regression found and fixed

Keyboard adjustment of the energy dial initially produced fractional mood-vector values. The versioned storage schema correctly rejected them, which surfaced as a browser console error. Provider-boundary normalisation now clamps and rounds every mood dimension before recommendation or persistence, with regression tests.

Chrome can also expose `navigator.gpu` while no adapter is available. The semantic worker now performs a real adapter probe and goes directly to WASM when that probe fails. Three device-selection regression tests cover an available adapter, a `null` adapter, and a rejected probe.

## Evidence

- `docs/browser-qa.json`: deterministic, offline, failure-path, and responsive run
- `docs/browser-qa-semantic.json`: fresh-profile real semantic/WASM run
- `docs/browser-qa-pages.json`: final `/pink-fm/` repository-base build and hash-route run
- `docs/screenshots/`: refreshed welcome, mood, radio, WisseBot, and desktop captures

The deliberate stale/corrupt/missing-profile cases create expected network or application errors; the report distinguishes those from unexpected console errors. External provider playback, screen-reader output on physical phones, install banners on iOS/Android, NFC through final card material, and representative low-memory mobile performance remain physical-device acceptance work.
