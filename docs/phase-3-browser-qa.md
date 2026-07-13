# Phase 3 browser QA

Production-preview QA was run against both `/pink-fm/` repository hosting and `/` custom-domain hosting with the built application. The harness drives an ephemeral Chromium profile through the Chrome DevTools Protocol and writes machine-readable reports plus release screenshots.

## Final automated result

- GitHub Pages base (`/pink-fm/`): **24/24 checks passed**, zero unexpected console errors.
- Root custom-domain base (`/`): **24/24 checks passed**, zero unexpected console errors.
- Enhanced-model failure run: **24/24 checks passed**, zero unexpected console errors; the restricted QA network produced `Failed to fetch` after 6,298 ms and instant mode remained ready.

Covered scenarios:

- 320 × 760 and 390 × 844 mobile, 768 × 1024 tablet, and 1280 × 900 desktop layouts;
- zero horizontal overflow at ordinary size and at simulated 200% root text scaling;
- high-contrast and reduced-motion behaviour;
- 44 CSS-pixel minimum primary radio touch targets;
- touch mood selection and keyboard energy tuning;
- English, Malay, mixed-language, and long Malay WisseBot requests;
- opening WisseBot produced zero Hugging Face/model resource requests before consent;
- 142-track catalogue search and a long album/title result at 320 pixels;
- separate enhanced-model data removal control in Settings;
- cached offline profile reopening after a successful online load;
- stale embedding manifest, corrupt embedding index, missing semantic model, and missing gift profile fallbacks;
- refreshed welcome, mood, radio, WisseBot, desktop, and error screenshots.

## Defects found and corrected

1. The WisseBot release capture occurred during its 220 ms entrance animation, visually implying excessive transparency. The screenshot helper now waits 300 ms before capture.
2. Simulated 200% text scaling exposed 11 pixels of horizontal overflow from the skip link and radio display's intrinsic grid width. The skip link now has a viewport maximum and safe wrapping; the illuminated display clips decorative scale overflow and uses `minmax(0, 1fr)` for its title column. The rerun measured 320-pixel document width in a 320-pixel viewport.
3. Chromium 149/150 on this workstation repeatedly crashed its headless GPU process while sandboxing the Dawn/Graphite persistent cache. This occurred before the page or QA commands ran and was diagnosed from browser stderr. The successful root QA rerun used the harness's explicit local-only `QA_NO_SANDBOX=1` switch. The production application and deployed browser sandbox are not changed; the switch affects only the disposable local headless test process.

## Enhanced-model timing status

The Phase 3 final network could not retrieve the public model, so this run validates the bounded fallback rather than claiming new inference timings. The last successful fresh no-WebGPU browser measurement remains the Phase 2 evidence: 14,455 ms WASM initialisation, 81 ms first inference, and 32 ms repeat inference. Phase 3's cached Windows Node CPU holdout measured 1,189 ms model load, 18 ms first inference, and 6 ms repeat inference. Neither is a mobile-device claim.

## Evidence

- `docs/browser-qa-pages.json` — final `/pink-fm/` route, responsive, offline, and failure checks.
- `docs/browser-qa.json` — final `/` route and the same 24-check matrix.
- `docs/browser-qa-semantic.json` — restricted-network enhanced activation and bounded fallback.
- `docs/browser-qa-semantic-success-phase2.json` — preserved successful no-WebGPU/WASM timing evidence from the safety commit.
- `docs/screenshots/` — regenerated stable-state product captures.
- `docs/semantic-model-benchmark.md` — prior successful browser/WASM timing conditions.

NFC behaviour, installed PWA modes, real data saver/low power, phone memory pressure, physical screen readers, phone cases, and actual mobile model timing remain **REQUIRES PHYSICAL ACCEPTANCE TEST** items.
