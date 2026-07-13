# Phase 3 semantic-model benchmark

Generated: 2026-07-13T16:49:17.308Z

The holdout was frozen before Phase 3 tuning. Timings below come from this Windows desktop under Node CPU and must not be represented as phone timings.

| Option | Download | EN | MS | Mixed | Mood F1 | Init | First | Repeat |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| current-e5-q8 | 129.1 MiB | 36.0% | 20.7% | 35.0% | 50.3% | 1189 ms | 18 ms | 6 ms |
| paraphrase-minilm-q8 | 129.1 MiB | 28.0% | 14.7% | 30.0% | 43.5% | 11694 ms | 24 ms | 5 ms |
| granite-97m-q8 | 117.5 MiB | 34.7% | 20.0% | 35.0% | 44.9% | 12236 ms | 32 ms | 5 ms |
| granite-97m-gbq4 | 82.6 MiB | 35.3% | 24.0% | 32.0% | 47.2% | 9842 ms | 20 ms | 7 ms |

All four runs preserved zero hallucinated catalogue tracks, zero unsupported factual claims, and zero lyric output. Negation accuracy was 100% because deterministic rules retain authority over semantic similarity.

## Selection

Pink FM retains `Xenova/multilingual-e5-small` q8 at revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, but only as optional **Enhanced Understanding**. No model is loaded when WisseBot opens. Instant deterministic and semantic-lite modes remain the default.

No candidate met the preferred 50 MiB or acceptable 80 MiB model-asset target. Granite GBQ4 came closest at 82.6 MiB, but its mixed-language direct accuracy (32.0% versus 35.0%) and mood F1 (47.2% versus 50.3%) were lower than E5, and it is a community conversion rather than the established current package. That trade-off was not strong enough to justify a production replacement.

The configured 142 MB consent wording is deliberately conservative. The exact E5 model, tokenizer and configuration assets requested by the benchmark totalled 135,392,674 bytes (129.1 MiB). The lazy WebAssembly runtime is separate and measured about 23.5 MB in the prior browser trace.

## Memory and timing limits

The benchmark measured process RSS deltas, not isolated model peak memory: MiniLM q8 added approximately 550 MiB, Granite q8 410 MiB, and Granite GBQ4 271 MiB to the Node process during their full 900-query evaluation runs. The current E5 comparator used the existing cached evaluator, which did not isolate an equivalent RSS delta. These figures include runtime and evaluation overhead and must not be quoted as browser memory requirements.

The current model's fresh no-WebGPU browser run from Phase 2 took 14,455 ms to initialise through WASM, followed by 81 ms and 32 ms for the first two requests. A representative phone has not yet been measured. Model download, initialisation, cache retention, and memory remain **REQUIRES PHYSICAL ACCEPTANCE TEST** items.

## Notes

- **current-e5-q8:** Phase 2 comparator; remains optional and is never loaded automatically.
- **paraphrase-minilm-q8:** Established browser-compatible multilingual sentence model; similar footprint to the current E5 model.
- **granite-97m-q8:** IBM Granite 97M multilingual R2 in standard int8-compatible Transformers.js packaging.
- **granite-97m-gbq4:** Community GBQ4 conversion of IBM Granite 97M; smallest technically compatible multilingual candidate found.

No model is selected by size alone. Pink FM retains instant mode as the default, and any enhanced model remains an explicit listener-approved download.
