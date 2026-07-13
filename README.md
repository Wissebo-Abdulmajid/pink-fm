# Pink FM

Pink FM is a mobile-first, installable retro mood-radio gift. The listener chooses how they want the music to feel, receives a catalogue-grounded recommendation, and can refine the station in English, Bahasa Melayu, or conversational English-Malay with WisseBot.

The default `siti` edition is centred on Siti Nurhaliza. Pink FM stores no music or lyrics: playback always goes to a configured official streaming destination. The application remains a static, profile-driven PWA that can be hosted entirely on GitHub Pages.

> Pink FM is an independent personal project and is not affiliated with or endorsed by the featured artist or streaming services.

## Current edition

The Phase 3 Siti catalogue audit records:

| Measure | Count |
| --- | ---: |
| Unique active tracks | 142 |
| Reviewed and recommendation-ready | 105 |
| Verified metadata, awaiting full emotional review | 37 |
| Provisional | 0 |
| Albums and distinct releases represented | 38 |
| Data-driven collections | 12 |
| Catalogue eras | 6 |

The catalogue spans 1990s classics through recent releases, traditional recordings, studio material, duets, collaborations, selected festive music, and singles. It is intentionally curated rather than a claim of complete discography coverage. Phase 3 desk-reviewed every one of the 37 metadata-only records, including provenance and configured destinations, but did not misrepresent that work as a listening review: 105 remain fully reviewed and 37 remain `verified-metadata`. See `docs/phase-3-catalogue-editorial-review.md` and run `npm run catalog:audit -- --slug siti` for the current distribution.

The consolidated automated evidence and remaining physical work are in `docs/phase-3-release-report.md`.

## Screenshots

These captures are refreshed from the production preview by `npm run qa:browser`.

| Welcome | Mood presets |
| --- | --- |
| ![Pink FM welcome screen at mobile width](docs/screenshots/welcome-mobile.png) | ![Pink FM tactile mood presets at mobile width](docs/screenshots/mood-mobile.png) |

| Radio | WisseBot |
| --- | --- |
| ![Pink FM retro radio at mobile width](docs/screenshots/radio-mobile.png) | ![WisseBot local guide dialog at mobile width](docs/screenshots/wissebot-mobile.png) |

![Pink FM radio at desktop width](docs/screenshots/radio-desktop.png)

The final automated browser matrix and its physical-device boundaries are recorded in `docs/phase-3-browser-qa.md`.

## Technology

- React 19, strict TypeScript, and Vite 8
- Tailwind CSS 4 through the official Vite plugin plus a custom physical-radio design layer
- React Router hash routing
- Zod runtime validation and backward-compatible content migration
- Lucide React icons
- Fraunces Variable and Manrope Variable, self-hosted through npm
- `@huggingface/transformers` for an opt-in browser-side multilingual embedding model
- A dedicated semantic Web Worker and compact precomputed catalogue embeddings
- Vitest, jsdom, React Testing Library, and user-event
- ESLint flat configuration
- A manually controlled service worker and web app manifest

There is no server runtime, database, registration, analytics, external LLM, paid API, or browser secret.

## Local installation

Requirements: an active LTS Node.js release, npm, and Git.

```bash
git clone https://github.com/Wissebo-Abdulmajid/pink-fm.git
cd pink-fm
npm ci
npm run dev
```

Open the local URL printed by Vite and use `#/g/siti`. On Windows, if PowerShell blocks `npm.ps1`, substitute `npm.cmd` for `npm`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite development mode |
| `npm run build` | Type-check and create `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run strict TypeScript checks |
| `npm run test` | Run all Vitest tests once |
| `npm run content:validate` | Validate every deployed gift profile, provenance, collections, and embedding freshness |
| `npm run gift:create -- --slug <slug> --artist "<artist>" --station "<station>"` | Create a profile from `_template` |
| `npm run catalog:import -- --slug <slug> --input <file> --dry-run` | Validate and preview a prepared CSV/JSON import |
| `npm run catalog:import -- --slug <slug> --input <file> --apply` | Explicitly apply a validated import |
| `npm run catalog:audit -- --slug <slug>` | Report scale, coverage, provenance, duplicates, and editorial warnings |
| `npm run catalog:coverage -- --slug <slug>` | Print mood, era, collection, album, and curation coverage |
| `npm run catalog:dedupe -- --slug <slug>` | Detect likely duplicate recordings and provider URLs |
| `npm run catalog:editorial-review` | Re-run the Phase 3 metadata/provenance desk review and destination checks |
| `npm run recommendations:simulate` | Run 3,150 recommendation-diversity simulations across all user-facing moods |
| `npm run bot:embeddings -- --slug <slug>` | Regenerate matching model/index/binary embeddings |
| `npm run bot:evaluation:generate` | Recreate the deterministic evaluation corpus |
| `npm run bot:evaluate` | Run the real lightweight and semantic evaluation pipelines |
| `npm run bot:hidden:generate` | Recreate the separately frozen Phase 3 holdout (do not use during tuning) |
| `npm run bot:hidden:evaluate` | Evaluate instant mode on the frozen holdout |
| `npm run bot:hidden:evaluate:enhanced` | Evaluate the retained optional E5 layer on the frozen holdout |
| `npm run bot:benchmark` | Benchmark the four recorded multilingual model candidates (large downloads) |
| `npm run icons:generate` | Recreate original Pink FM PNG icons |
| `npm run qa:browser` | Exercise the production preview and refresh screenshots |
| `npm run verify` | Run lint, types, content validation, catalogue audit, tests, and production build |

The Apple catalogue-source preparation commands are maintenance tools, not runtime dependencies. They consume a saved provider response and a curator-reviewed selection; the production app never scrapes a streaming service.

## Architecture

```mermaid
flowchart TD
  URL["NFC / QR hash URL"] --> Loader["Profile loader + Zod migration"]
  JSON["Gift JSON + provenance + collections"] --> Loader
  Loader --> UI["Reusable React routes"]
  Loader --> Theme["Runtime CSS theme tokens"]

  Message["Listener message"] --> Normalise["Text normalisation"]
  Normalise --> Rules["Level 1: deterministic multilingual rules"]
  Rules --> Lite["Level 2: catalogue-aware semantic-lite retrieval"]
  Lite --> Entities["Grounded entity + fuzzy-title matching"]
  Entities --> Semantic["Level 3: opt-in semantic Web Worker"]
  Embeddings["Versioned precomputed embeddings"] --> Semantic
  Semantic --> Context["Conversation-context resolution"]
  Context --> Confidence["Confidence + conflict analysis"]
  Confidence --> Request["StructuredMusicRequest"]

  Preset["Mood preset"] --> Engine["Deterministic recommendation scoring"]
  Request --> Engine
  Storage["Versioned profile-scoped localStorage"] --> Engine
  Engine --> Response["Evidence-backed response templates"]
  Response --> Links["Configured official destinations"]
  Response --> Storage

  SW["Manual service worker"] --> UI
  SW --> JSON
  SW --> Embeddings
```

The important boundaries are explicit:

1. Rule-based parsing owns negation, comparisons, corrections, and precise commands.
2. Semantic-lite interpretation adds no-download vocabulary, character n-gram, fuzzy, and catalogue signals synchronously.
3. Full semantic interpretation recognises indirect paraphrases and retrieves similar prototypes/tracks; it cannot reverse exact rules and is never required.
4. Catalogue retrieval returns IDs that exist in the active profile.
5. Recommendation scoring ranks only validated candidates.
6. Response rendering uses structured evidence and verified profile metadata, not unrestricted generation.

## Gift-profile format

Every profile lives in `public/gifts/<slug>/`:

```text
gift.json                 station, artist policy, recipient, assistant, creator, theme, features
moods.json                named target vectors and station frequencies
tracks.json               catalogue metadata, editorial vectors, contexts, curation state
collections.json          data-driven collections and weak ranking weights
messages.json             editable interface and assistant copy
catalog-sources.json      source registry and per-track verification audit
embeddings/manifest.json  model, revision, dimensions, content hash, and binary metadata
embeddings/index.json     grounded track/prototype offsets
embeddings/*.bin          normalised float32 catalogue and prototype vectors
assets/                   profile-owned permitted media
```

Schemas in `src/config/schemas.ts` are shared by browser loading, CLI validation, imports, audits, and tests. Version-one track records migrate safely to the extended version-two shape. Invalid content shows a controlled configuration screen rather than rendering partial data.

## Curation levels and provenance

Every track has one explicit status:

- `reviewed`: identity, destination, release information, and subjective recommendation profile have been reviewed; no ranking penalty.
- `verified-metadata`: identity and official destination are verified, but emotional curation still needs a full pass; modest ranking penalty.
- `provisional`: credible but incomplete; visible as provisional and strongly penalised in mood ranking.

`curationConfidence` is an editorial confidence value, not scientific certainty. Mood annotations, semantic descriptions, emotional arcs, vocal/instrumental character, use cases, and `avoidWhen` guidance are subjective recommendation metadata.

The Siti edition records every track's `sourceIds` and verification date in `catalog-sources.json`. Its provider snapshot is retained under `catalog/import/` so catalogue preparation is reproducible without live scraping. The main references audited on 13 July 2026 were the official [Apple Music artist page](https://music.apple.com/my/artist/siti-nurhaliza/102288156), [Spotify artist page](https://open.spotify.com/artist/5d0bxRte3J74ZXyEGRL8uU), and [Spotify editorial artist playlist](https://open.spotify.com/playlist/37i9dQZF1DWSW97Ajf5E1t), plus individual provider release pages registered in the source file.

Provider digital release dates can differ from original physical release dates. Keep `null` when a value is uncertain and never infer an album, date, credit, or official URL from a search snippet.

## Importing and maintaining tracks

Prepare CSV or JSON records deliberately; do not make a live scraper part of the build.

```bash
npm run catalog:import -- --slug siti --input catalog/import/new-records.json --dry-run
npm run catalog:import -- --slug siti --input catalog/import/new-records.json --apply
npm run catalog:dedupe -- --slug siti
npm run catalog:audit -- --slug siti --json docs/catalog-audit.json
npm run catalog:coverage -- --slug siti
npm run bot:embeddings -- --slug siti
npm run content:validate
```

The importer normalises only for comparison, preserves display punctuation and accents, detects likely duplicate titles and provider URLs, refuses malformed records, and does not overwrite reviewed emotional metadata without an explicit decision. `--dry-run` is the default-safe workflow; applying changes requires `--apply`.

The audit fails on structural errors and reports editorial matters as warnings: partial album representation, weak mood areas, suspicious identical vectors, missing provenance, tracks unlikely to rank, duplicate primary recordings, malformed URLs, and missing destinations. Remote `HEAD` checks are optional via `--check-links` because provider anti-bot responses and transient networks should not make ordinary CI nondeterministic.

After any semantic description, track ID, collection, or model change, regenerate embeddings. `content:validate` recomputes the catalogue hash and fails stale manifests with the exact `npm run bot:embeddings` instruction.

## Recommendation engine

The recommender is deterministic, content-based, and explainable. Source weights currently allocate:

- 45% mood-vector similarity
- 10% semantic catalogue retrieval when available
- 6% activity/context suitability
- 5% desired energy and 4% desired intensity
- 8% learned listener preference
- 6% novelty
- 5% positive-feedback/favourite affinity
- 3% time suitability and 3% artist policy
- 2.5% era and 2.5% collection affinity
- 1% version preference

Recent-track, same-album, secondary-artist, and curation-confidence penalties are applied separately. A provisional candidate cannot casually outrank a closely matching reviewed track. Primary-artist policy is data-driven and defaults to `primary-only` for the Siti profile.

Diversity reranking prevents a recommendation queue from collapsing into one album when similarly suitable alternatives exist. Clean profiles use a stable daily rotation among close-quality, mood-credible candidates; learned signals such as a favourite still take precedence. Session requests support another choice, something different, another era, more energy, less intensity, a deeper cut, a familiar favourite, a duet, something traditional, or something modern.

Phase 3 ran 3,150 deterministic simulations: 50 runs for each of nine user-facing moods across clean history, favourites, heavy recent listening, era preference, familiarity, discovery, and time-of-day scenarios. Every mood produced 23–42 credible reviewed choices, clean-profile top-track concentration stayed at 10–14%, top-album concentration stayed at 12–26%, and the run found zero immediate repeats or unsuitable results. This is a software simulation, not a substitute for subjective listening review. The complete per-mood evidence is in `docs/phase-3-recommendation-diversity.md`.

Explanations are derived from actual score contributions and structured request evidence. Technical details are tucked behind “Why this recommendation?” rather than dominating the radio display.

## WisseBot hybrid understanding

WisseBot now has three independently useful levels:

1. **Instant deterministic understanding** owns explicit moods, negation, comparison, activities, time, era, versions, exclusions, and conversation corrections.
2. **Local semantic-lite retrieval** adds no-download fuzzy vocabulary, approximate title/album/collection matching, character n-gram similarity, and catalogue signals.
3. **Enhanced multilingual embeddings** run in a dedicated worker only after explicit listener approval and help with more indirect or unusual phrasing.

Levels 1 and 2 are the default experience and are ready immediately. They provide the following without the full semantic model:

- English, Bahasa Melayu, conversational Malay, and common English-Malay code-switching
- exact multilingual synonym resources kept in editable data modules
- negation such as “not sleepy,” “jangan sedih,” and “tak terlalu slow”
- comparative refinements and active-target preservation
- activity and time context
- familiar/discovery, traditional/modern, era, collection, duet, and artist constraints
- fuzzy title, album, artist, collection, and mood entity matching with guarded thresholds
- focused clarification for moderate matches or ambiguous concepts
- bounded profile-scoped conversation context and a visible new-request action

Every interpretation becomes a `StructuredMusicRequest` with confidence and evidence sources (`exact-rule`, `entity-match`, `semantic-similarity`, `previous-context`, `user-preference`, or `default-assumption`). Free-form user text is never sent directly to the recommender.

Response copy is assembled from the structured interpretation, selected track metadata, score contributions, and configured patterns. Unsupported requests about lyrics, private life, speculative facts, diagnosis, or capabilities are redirected without a generated factual answer.

### Optional enhanced semantic model

The chosen model is `Xenova/multilingual-e5-small`, revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, with quantised `q8` weights, mean pooling, L2 normalisation, and 384-dimensional embeddings. It was selected for multilingual coverage, compact retrieval-oriented representations, Transformers.js compatibility, and materially smaller browser cost than a text-generation model.

The model is not in the initial application bundle. Opening WisseBot does not download it silently: Pink FM discloses a conservative estimated 142 MB first-use download and requires a fresh in-session approval. Exact benchmarked model/tokenizer/config assets totalled 129.1 MiB (135.4 MB); the WebAssembly runtime is a separate lazy dependency and was about 23.5 MB in the Phase 2 browser trace. Inference runs in a dedicated worker, prefers WebGPU where supported, falls back to WASM, times out safely, and can be cancelled or disabled.

Before activation, the dialog checks online state, effective connection type, data-saver preference, and an exact-revision Cache Storage signal where the browser exposes them. Missing Network Information APIs are benign. An uncached model on data saver or 2G requires a second confirmation. Offline activation is disabled unless the required model appears cached, while instant mode remains available.

Build-time measurements on the development machine were 12,994 ms for the first downloaded CPU model load, 2,945 ms for 142 track embeddings, and 211 ms for 93 prototypes. The final cached Node CPU holdout loaded in 1,189 ms; its first and repeat test queries measured 18 ms and 6 ms. In a fresh headless Chrome profile with WebGPU unavailable, the Phase 2 WASM path initialized in 14,455 ms and measured 81 ms then 32 ms for two browser requests. These are environment-specific diagnostics, not mobile promises. Real mid-range-phone time and peak memory remain physical acceptance work.

Phase 3 also benchmarked three alternatives on the frozen holdout:

| Model | Required assets | English | Malay | Mixed | Mood F1 | Node CPU init |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current multilingual E5 q8 | 129.1 MiB | 36.0% | 20.7% | 35.0% | 50.3% | 1,189 ms cached |
| Multilingual MiniLM q8 | 129.1 MiB | 28.0% | 14.7% | 30.0% | 43.5% | 11,694 ms |
| Granite 97M q8 | 117.5 MiB | 34.7% | 20.0% | 35.0% | 44.9% | 12,236 ms |
| Granite 97M community GBQ4 | 82.6 MiB | 35.3% | 24.0% | 32.0% | 47.2% | 9,842 ms |

No candidate met the preferred 50 MiB or acceptable 80 MiB target. The 82.6 MiB community conversion was closest but had lower mixed-language and mood performance and adds conversion provenance risk. Pink FM therefore retains E5 only as optional **Enhanced Understanding** and keeps instant mode as the default. See `docs/phase-3-model-benchmark.md` for methodology, grounding counts, memory observations, and limitations.

### Instant fallback and model storage

The listener can choose “Continue with instant mode,” select instant-only in Settings, or disable `features.semanticUnderstanding` in profile JSON. Deterministic multilingual parsing, catalogue entity matching, recommendations, favourites, history, and every radio screen continue to work. A failed worker/model/index reports its state and falls back without making the main radio unusable.

The Pink FM service worker controls only same-origin app shell, profile JSON, assets, and compact precomputed embeddings. Third-party model requests are not intercepted. Transformers.js and the browser may use Cache Storage and ordinary HTTP caching; retention is best-effort and browser eviction remains possible. **Remove enhanced understanding data** deletes exact model-revision entries found in Cache Storage without touching favourites, history, or preferences, but cannot promise removal from an opaque browser HTTP cache. A changed model revision is treated as a new download and still requires consent.

## Bot evaluation

The checked-in corpus contains 335 English, 285 Malay, 185 mixed-language, 100 typo/noisy, 50 unsupported/adversarial cases, and 100 multi-turn sequences containing 300 turns. It covers mood combinations, negation, comparisons, activities, time, era, traditional/modern, discovery, title typos, corrections, rejections, nonsense, lyric requests, and attempts to elicit invented facts.

```bash
npm run bot:evaluation:generate
npm run bot:evaluate
```

The evaluator runs the real providers and recommendation engine. It reports intent/kind accuracy, multi-label mood precision/recall/F1, negation, entities, clarification, unsupported requests, context follow-ups, grounding, and measured inference time. Two hard metrics must remain zero: hallucinated catalogue IDs and unsupported factual claims emitted by response templates. Evaluation results are evidence, not a claim that all natural language is solved; ambiguous colloquial phrasing remains an ongoing editorial area.

### Frozen Phase 3 holdout

Phase 3 generated a separate holdout before inspecting failures or changing parser rules. Its SHA-256 content hash is `bde67f3e6e5945920a8daabd37e071f71d0f55d1d1e95b5ae87eeb533b605465`. It contains 150 new English, 150 Malay, 100 mixed-language, 75 typo-heavy, 75 indirect/figurative, 50 genuinely ambiguous, and 50 unsupported requests, plus 50 five-turn conversations. The first 30 conversations are explicit manual-acceptance scripts. Clarification is scored separately and is not counted as direct understanding unless clarification was the labelled outcome.

| Frozen metric | Untouched instant baseline | Untouched enhanced baseline | Final instant | Final enhanced E5 |
| --- | ---: | ---: | ---: | ---: |
| Strict direct accuracy | 26.1% | 28.4% | 43.3% | 43.6% |
| Mood multi-label F1 | 39.9% | 43.3% | 49.2% | 50.3% |
| Negation accuracy | 0% | 0% | 100% | 100% |
| Clarification appropriateness | 83.3% | 75.0% | 100% | 58.3% |
| Unsupported-request detection | 40.0% | 40.0% | 100% | 100% |
| Context-follow-up accuracy | 21.6% | 24.0% | 78.4% | 79.2% |
| Hallucinated catalogue tracks | 0 | 0 | 0 | 0 |
| Unsupported factual claims | 0 | 0 | 0 | 0 |
| Lyrics emitted | 0 | 0 | 0 | 0 |

The final instant group scores were English 32.0%, Malay 16.0%, mixed 34.0%, noisy 26.7%, and indirect 6.7% under the deliberately strict direct metric. Those lower language scores are a real limitation, not hidden by the excellent safety metrics. Moderate fuzzy-title matches intentionally ask for confirmation, so the evaluator's 16.7% exact entity score includes some specification-compliant confirmations labelled as misses. Full failures and classifications are retained in `docs/phase-3-hidden-final-instant.json`; the enhanced counterpart is `docs/phase-3-hidden-final-enhanced.json`.

## Adding another artist edition

```bash
npm run gift:create -- --slug adele --artist "Adele" --station "Velvet FM"
```

The command validates the slug, copies `_template`, updates profile identity, and prints `#/g/adele`. It refuses an existing directory unless `--force` is explicit.

Then:

1. Edit `gift.json`, including artist policy and semantic settings.
2. Replace the fictional template demo record with verified catalogue entries.
3. Register every source and per-track verification in `catalog-sources.json`.
4. Curate subjective mood/semantic metadata and collections.
5. Add only permitted images under `assets/`.
6. Add verified official HTTPS destinations.
7. Generate profile embeddings.
8. Run the validator, catalogue audit, tests, and production build.

No React component, recommendation function, or route needs modification. Multiple editions coexist at `#/g/siti`, `#/g/adele`, and `#/g/maher-zain`.

## Optional secondary artists

`gift.json` supports `primary-only`, `primary-preferred`, and `multi-artist` policies. The Siti profile defines a disabled `malaysian-legends` collection and keeps `allowSecondaryCollection: false`; no secondary catalogue is populated in this phase.

To enable one later, add independently verified secondary-artist tracks and provenance, add their artist IDs to a data-driven collection, change the policy deliberately, regenerate embeddings, and rerun all audits. The UI reads the selected track's configured artist, and primary-preferred mode applies a penalty so a secondary artist does not silently replace a suitable primary-artist result.

## Copyright and music-link policy

Do not commit music, lyrics, karaoke files, fan uploads, scraped media, unlicensed cover art, or private messages. Verify title and credit metadata against official artist, label, or licensed streaming pages. An external URL is labelled official only when its registered provenance supports that description.

The MIT licence applies to application code only. It does not grant rights to artist names, music, artwork, streaming trademarks, or user-supplied profile media.

## PWA and offline behaviour

The manifest uses original Pink FM icons and a relative scope/start URL. The service worker registers only in production:

- profile JSON and same-origin embedding metadata/binaries: network first with cached fallback;
- same-origin scripts, styles, icons, and profile assets: stale while revalidate;
- navigation: network first with cached shell/offline fallback;
- third-party players, music, and model hosting: never intercepted.

An update banner appears when a worker waits. After one successful online load, the interface can reopen cached catalogue metadata, local preferences, library history, and deterministic recommendations offline. External playback and a first-time semantic-model download may require connectivity.

The Phase 3 shell cache is versioned `pink-fm-v3`; activation removes only outdated `pink-fm-*` caches. It deliberately leaves browser/Transformers model caches alone. Updating the application refreshes shell/profile resources under the normal strategies, while changing the configured model revision requires a separately consented model retrieval.

## GitHub Pages deployment

The app works before a custom domain is approved.

### Phase A: fallback address

1. Create a public repository named `pink-fm` under `Wissebo-Abdulmajid`.
2. Add the remote, commit, and push `main`:

   ```bash
   git branch -M main
   git remote add origin https://github.com/Wissebo-Abdulmajid/pink-fm.git
   git add .
   git commit -m "Finalise Pink FM Phase 3"
   git push -u origin main
   ```

3. In **Settings → Pages**, choose **GitHub Actions** as the source.
4. The workflow runs `npm ci`, derives `/<repository-name>/` unless repository variable `VITE_BASE_PATH` exists, runs `npm run verify`, uploads `dist`, and deploys with minimum permissions.
5. Test `https://Wissebo-Abdulmajid.github.io/pink-fm/#/g/siti`.

Hash routing preserves direct NFC routes without server rewrites. Substitute the real owner/repository if those names change.

## Free `.is-a.dev` alias

`.is-a.dev` is a better fit than `.js.org` for this personal developer-built project. Preferred candidate: `pinkfm.is-a.dev`; alternatives are `wissebot.is-a.dev`, `pink-radio.is-a.dev`, and `tune-with-wisse.is-a.dev`, subject to availability.

The workflow below was rechecked on 13 July 2026 against the official [registration repository](https://github.com/is-a-dev/register), [domain structure](https://docs.is-a.dev/domain-structure/), and [GitHub Pages guide](https://docs.is-a.dev/guides/github-pages/). Recheck them before submitting; maintainers explicitly review pull requests and may change rules.

1. Deploy and verify the GitHub Pages fallback.
2. Fork `is-a-dev/register` yourself.
3. Create `domains/pinkfm.json` using the current required owner fields and `"CNAME": "Wissebo-Abdulmajid.github.io"`.
4. Submit the pull request manually and respond to reviewers. Do not submit an unauthorised automated or low-quality generated PR.
5. Wait for merge and DNS publication.
6. Only then add `pinkfm.is-a.dev` under repository **Settings → Pages → Custom domain**.
7. If GitHub requires domain verification, follow the current guide for its separate hostname TXT file and PR.
8. Set repository variable `VITE_BASE_PATH=/` and trigger a new deployment.
9. Enable **Enforce HTTPS** when the certificate is ready.
10. Test both the custom domain and fallback route.

A free community subdomain is controlled by its operators and cannot be guaranteed forever. Preserve the GitHub Pages URL as the fallback.

## NFC and QR handoff

The NFC tag stores only the final URL; it does not store Pink FM.

Preferred after approval:

```text
https://pinkfm.is-a.dev/#/g/siti
```

Fallback:

```text
https://Wissebo-Abdulmajid.github.io/pink-fm/#/g/siti
```

1. Complete deployment and select the final stable URL.
2. Open the exact URL on multiple iOS and Android phones and confirm the `siti` profile.
3. Write one NDEF URI record containing only that URL to an NTAG215 card.
4. Print a QR code containing the same URL.
5. Test NFC through the finished card material and common phone cases.
6. Keep the tag writable during testing and domain approval.
7. Lock it only after the exact domain and hash route are proven stable.

Use the printable `docs/physical-acceptance-checklist.md` for the actual handoff. Automated desktop checks are not evidence that NFC, installed-PWA behaviour, low-power/data-saver operation, iOS background constraints, phone cases, or screen readers work on the recipient's hardware. Every such item remains marked **REQUIRES PHYSICAL ACCEPTANCE TEST** until a person records device, OS, browser, network, result, and notes.

Card copy:

```text
Front
PINK FM
TAP TO TUNE IN

Back
Choose how you want to feel.
Let your frequency find the music.

NFC + QR ACCESS
```

Do not place credentials or private data in the URL. An unusual slug provides obscurity, not authentication: public static files and a public repository can be inspected.

## Privacy limitations

Favourites, feedback, settings, affinities, history, and conversation preferences use a versioned `localStorage` layer scoped by gift slug. Version-one and version-two state migrate to version three; malformed data resets safely. Browser storage is not encrypted and clearing site data removes it.

The opt-in semantic message is processed locally in the worker; it is not sent to Pink FM or an LLM service. The browser may contact Hugging Face/CDN origins to obtain public model files on first use. Other people with access to the same browser profile may inspect local storage.

Static hosting is public. `recipient.showName` affects display, not access. Never commit confidential recipient copy.

## Accessibility

Pink FM uses landmarks, ordered headings, native controls, visible focus, minimum 44-pixel targets, keyboard-operable tuning controls, screen-reader recommendation announcements, and a focus-trapped dialog with Escape restoration. Recommendation/curation states use text as well as colour. Reduced motion follows both the operating-system preference and local setting. There is no autoplay.

Primary flows should be retested with keyboard only, 200% zoom, screen-reader navigation, reduced motion, high contrast, 320-pixel width, and long translated/title content whenever UI structure changes.

## Testing

`npm run verify` is the deterministic release gate. It covers schemas and migration, controlled profile errors, scale/coverage invariants, ranking and diversity, curation/artist penalties, grounding, multilingual parsing, negation, contextual follow-ups, fuzzy entities, explicit semantic consent, cancellation/cache handling, semantic failure, embedding corruption/staleness, local-storage migration, accessibility-focused component flows, feedback, catalogue search, and honest playback states.

`npm run bot:evaluate` and `npm run bot:benchmark` are separate, heavier quality runs because the public models are large. The checked-in reports record exact revisions and environments. `npm run recommendations:simulate` exercises diversity separately. Browser QA verifies feature splitting, no silent download, opt-in disclosure, instant fallback, 320/390/tablet/desktop reflow, 200% text scaling, high contrast, 44-pixel radio targets, touch/keyboard flows, offline profile reopening, stale/corrupt indexes, service-worker behaviour, and console errors.

## Troubleshooting

- **Profile configuration error:** run `npm run content:validate`; both UI and CLI report exact paths.
- **Stale embeddings:** run `npm run bot:embeddings -- --slug <slug>`, then validate again.
- **Catalogue audit errors:** fix duplicate IDs/URLs, missing provenance, unsafe links, or inconsistent collections before editing warnings.
- **Enhanced understanding unavailable:** choose instant mode; the radio, semantic-lite retrieval, and deterministic rules remain functional.
- **Large model is downloading:** WisseBot shows progress and a Cancel action. First-use cost is not part of the initial app bundle.
- **Remove enhanced data found nothing:** Cache Storage may already be empty or the browser may hold opaque HTTP-cache entries that a static app cannot enumerate; this does not affect Pink FM preferences.
- **Wrong Pages styling or assets:** verify the workflow-derived base and remove an incorrect `VITE_BASE_PATH` for repository-path hosting.
- **Old content after deploy:** reload online once. Profile JSON is network-first and the update banner handles a waiting shell.
- **No playback destination:** add at least one verified HTTPS service URL; Pink FM does not render pretend controls.
- **Service-worker confusion in development:** registration is production-only. Unregister an older worker if a production build previously used the same origin.
- **Chromium headless Dawn/Graphite cache crash on Windows:** this is a local QA-process failure before the page loads. Close stale headless processes first; if the exact sandboxed cache race persists, rerun only the disposable local harness with `QA_NO_SANDBOX=1`. Never use that flag for ordinary browsing or deployment.
- **PowerShell blocks npm:** use `npm.cmd` or adjust your trusted local policy yourself.

## Known limitations

- Emotional annotations are editorial and subjective; the 37 `verified-metadata` tracks still need a full human-quality listening review.
- Frozen-holdout direct understanding remains weakest for indirect requests and informal Malay. Instant mode clarifies conservatively; enhanced mode improves retrieval but is optional and still not a general chatbot.
- A structural URL check cannot guarantee future availability, regional access, account requirements, or provider behaviour.
- Model cache persistence, first-use time, and memory depend on browser, storage pressure, connection, and hardware; no phone-performance claim is made from desktop Node or headless Chrome timings.
- Precomputed embeddings understand catalogue descriptions; they do not verify historical facts or translate lyrics.
- Static hosting provides no authentication, cross-device sync, or secure private messaging.
- External music playback requires the provider and may require internet access.

## Creator and licence

Designed and engineered by **WISSEBO ABDULMAJID**.

Source code is available under the MIT licence. Artist names, music, streaming marks, artwork, trademarks, and profile-owner media remain with their respective owners and are not relicensed by this repository.
