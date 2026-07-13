# Pink FM Phase 3 release report

Recorded on 13 July 2026. This report separates automated evidence from work that still needs a physical phone or final NFC card.

## Checkpoint and final gates

- Phase 2 safety commit: `715fedaf3e829c8b1a92cb82fb38b9c7d647bbee`
- Tests before Phase 3: 96
- Tests after Phase 3: 104 across 15 files
- `VITE_BASE_PATH=/pink-fm/`: full `npm run verify` passed; production build passed
- `VITE_BASE_PATH=/`: full `npm run verify` passed; production build passed
- Content validation: one profile valid; one expected artwork warning
- Catalogue audit: zero structural errors; 23 editorial partial-album warnings

## Catalogue

- 142 active unique tracks across 38 albums/releases and six era labels
- 105 reviewed; 37 verified-metadata; zero provisional
- 12 data-driven collections
- 37/37 metadata-only records desk-inspected; zero mass promotions, deactivations, broken configured destinations, or unsupported editorial changes

The remaining 37 records require listening-based human editorial review before promotion. See `phase-3-catalogue-editorial-review.json`.

## Frozen hidden evaluation

Dataset hash: `bde67f3e6e5945920a8daabd37e071f71d0f55d1d1e95b5ae87eeb533b605465`; 650 isolated utterances plus 50 five-turn conversations (900 scored requests).

| Metric | Instant baseline | Final instant | Enhanced baseline | Final enhanced E5 |
| --- | ---: | ---: | ---: | ---: |
| Strict direct accuracy | 26.1% | 43.3% | 28.4% | 43.6% |
| Mood F1 | 39.9% | 49.2% | 43.3% | 50.3% |
| Negation | 0% | 100% | 0% | 100% |
| Clarification | 83.3% | 100% | 75.0% | 58.3% |
| Unsupported detection | 40.0% | 100% | 40.0% | 100% |
| Context follow-up | 21.6% | 78.4% | 24.0% | 79.2% |
| Hallucinated tracks / facts / lyrics | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

Instant direct group accuracy remains 32.0% English, 16.0% Malay, 34.0% mixed, 26.7% noisy, and 6.7% indirect. These strict holdout results are the principal language-quality limitation.

## Semantic model decision

The optional enhanced model remains `Xenova/multilingual-e5-small` q8. Exact required model assets measured 129.1 MiB; the consent UI retains a conservative 142 MB estimate. None of the three alternatives met the acceptable sub-80-MiB target. The closest, Granite 97M GBQ4 at 82.6 MiB, scored lower on mixed language and mood F1 and is a community conversion.

Cached Windows Node CPU timing for E5: 1,189 ms load, 18 ms first query, 6 ms repeat query. Preserved successful no-WebGPU Chrome timing: 14,455 ms WASM initialisation, 81 ms first request, 32 ms repeat request. Phase 3's final restricted-network browser run instead verified a bounded `Failed to fetch` fallback after 6,298 ms. No mobile timing claim is made.

## Recommendation diversity

3,150 simulations covered nine moods and seven history/preference/time scenarios. Each mood produced 23–42 credible reviewed choices; clean top-track concentration was 10–14%, clean top-album concentration 12–26%, with zero immediate repeats and zero deterministically unsuitable results.

## Production sizes

Final root build:

- initial JavaScript: 338.31 kB raw / 104.92 kB gzip
- WisseBot lazy chunk: 61.12 kB raw / 20.71 kB gzip
- network/cache helper lazy chunk: 3.94 kB raw / 1.77 kB gzip
- semantic worker: 602.30 kB raw, lazy
- ONNX WASM runtime: 23,567.05 kB raw / 5,824.05 kB gzip, lazy

Relative to the Phase 2 report, initial JavaScript increased about 1.32 kB raw / 0.43 kB gzip and the lazy WisseBot chunk increased about 16.93 kB raw / 5.75 kB gzip. The model remains external and never enters the initial bundle.

## Browser and physical status

Both root and repository-path previews passed 24/24 automated checks with zero unexpected console errors. The matrix includes 320/390/tablet/desktop, 200% text scaling, high contrast, reduced motion, touch, keyboard tuning, long content, offline reopening, no silent model request, and model/index/profile failures.

No physical phone was available. Every Android, iPhone, NFC, QR, installed-PWA, real data-saver/low-power, VoiceOver/TalkBack, and phone-performance item remains **REQUIRES PHYSICAL ACCEPTANCE TEST** in `physical-acceptance-checklist.md`. The NFC tag must remain writable and unlocked.
