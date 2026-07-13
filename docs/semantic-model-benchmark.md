# Semantic model benchmark

Recorded on 13 July 2026. These measurements describe this development machine and test browser; they are evidence, not a promise for every phone or network.

## Selected model

| Property | Value |
| --- | --- |
| Model | `Xenova/multilingual-e5-small` |
| Pinned revision | `761b726dd34fb83930e26aab4e9ac3899aa1fa78` |
| Runtime | `@huggingface/transformers` 4.2.0 |
| Quantisation | `q8` |
| Dimensions | 384 |
| Pooling | Mean pooling, L2 normalised |
| Estimated public model download | 148,897,792 bytes (142 MiB) |

This retrieval model was selected because Pink FM needs multilingual similarity and grounded catalogue retrieval, not unrestricted text generation. It covers English, Bahasa Melayu, and mixed-language paraphrases at a substantially narrower capability and browser cost than a generative chatbot. Exact rules remain authoritative for negation, corrections, entities, and conversational follow-ups.

The model ID, revision, dimensions, normalisation, and catalogue hash are locked in each profile embedding manifest. Content validation rejects a stale or mismatched index.

## Production bundle impact

Vite 8 production output after Phase 2:

| Asset | Raw | Gzip | Loading behaviour |
| --- | ---: | ---: | --- |
| Initial application JavaScript | 336.99 kB | 104.49 kB | Initial |
| WisseBot dialog chunk | 44.19 kB | 14.96 kB | Lazy |
| Semantic worker JavaScript | 602.30 kB | — | Lazy, after opt-in |
| ONNX WASM runtime | 23,567.05 kB | 5,824.05 kB | Lazy, when WASM is selected |
| Model resources | 142 MiB estimated | Provider-compressed artifacts | Downloaded only after explicit opt-in |

The Phase 1 initial JavaScript baseline was 335.50 kB raw and 104.56 kB gzip. Phase 2 therefore added 1.49 kB raw to the initial JavaScript while its gzip result decreased by 0.07 kB; the substantial semantic runtime remains outside the initial path. The final `/pink-fm/` base build differs only by base-path strings: 337.02 kB raw and 104.50 kB gzip.

## Browser benchmark

The production preview was exercised in a fresh temporary Google Chrome profile on Windows, at `390 × 844`, with GPU disabled to force the required no-WebGPU path. Chrome first exposed the WebGPU API without a usable adapter; Pink FM probed the adapter, selected WASM automatically, and kept the interface responsive.

| Measurement | Result |
| --- | ---: |
| Model/index ready, wall clock | 14,455 ms |
| First semantic request | 81 ms |
| Repeat semantic request | 32 ms |
| Runtime backend | WASM |
| Unexpected console errors | 0 |

The same run checked the opt-in disclosure, English/Malay/mixed lightweight interaction, corrupted and stale embedding handling, responsive layouts, reduced motion, offline cached profile data, and missing-profile handling. Its machine-readable timing evidence is preserved in `docs/browser-qa-semantic-success-phase2.json`. The current `docs/browser-qa-semantic.json` records the later Phase 3 restricted-network fallback instead of overwriting that successful timing claim.

## Build and evaluation measurements

Build-time CPU generation measured 12,994 ms for the first model load, 2,945 ms for 142 track descriptions, and 211 ms for 93 prototypes. The later cached Node CPU evaluation measured:

| Measurement | Result |
| --- | ---: |
| Cached model load | 1,213 ms |
| First query | 21 ms |
| Repeat query | 25 ms |
| Batch | 1,716 ms for 973 queries |
| Mean batch query | 1.764 ms |

Node values are not browser or mobile claims. See `public/gifts/siti/embeddings/benchmark.json` and `docs/bot-evaluation.json` for the source records.

## Failure and privacy behaviour

- Loading begins only after the listener accepts the disclosed 142 MiB estimate.
- “Continue with lightweight mode” skips the model entirely.
- WebGPU is selected only after a real adapter probe; unavailable or failed WebGPU falls back to WASM.
- Model, worker, timeout, corrupt-index, and stale-index failures leave deterministic multilingual parsing and the radio usable.
- Inference stays in the browser. The browser contacts Hugging Face/CDN origins for public model files on first use; Pink FM sends no message to an application backend or LLM service.
- The service worker does not cache or proxy third-party model artifacts. Browser/provider caching behaviour and storage eviction vary by device.

Representative mobile hardware and slow cellular networks still require field testing. The 142 MiB opt-in cost is the principal known limitation; lightweight mode is the default-safe alternative.
