# Pink FM final release report

Date: 23 July 2026 (Asia/Kuala_Lumpur)  
Branch: `release/nfc-gift-hardening`  
Starting commit: `4256ebf Merge full-song Pink FM playback release`  
Canonical NFC and QR URL: `https://wissebo-abdulmajid.github.io/pink-fm/tap/`

## Release decision

The code-side release gates pass. The permanent tag should only be made read-only after the physical iPhone, Android and printed-QR checks in `docs/nfc/live-device-test-checklist.md` are completed.

No commit, push, merge or deployment was performed.

The working tree was not clean at the initial baseline: the first audit command refreshed only the generated timestamp in `docs/phase-4-playback-audit.json` and `docs/phase-4-playback-audit.md`. The catalogue measurements were unchanged. All later release work remains uncommitted for review.

## Final measurements

| Gate | Result |
| --- | --- |
| Active catalogue | PASS — 142 tracks |
| Guaranteed full-subscription-free catalogue | PASS — 66 tracks |
| Full-song recommendation guarantee | PASS — 100% |
| Automated tests | PASS — 169/169 across 27 files |
| ESLint | PASS |
| TypeScript | PASS |
| Content validation | PASS — no errors; the existing abstract-art fallback warning remains for 142 tracks |
| Catalogue audit | PASS — no errors; 23 existing partial-album coverage warnings |
| YouTube source validation | PASS — static validation; optional live Data API check skipped because no key was configured |
| Root production build | PASS |
| `/pink-fm/` production build | PASS |
| Root browser journey | PASS — 37 checks, zero unexpected console errors |
| `/pink-fm/` served-build smoke test | PASS — app, `/tap/`, manifest and service worker returned their distinct expected assets |
| QR round-trip decode | PASS — exact canonical URL |
| Production playback-test route | PASS — omitted from the production route and bundle |
| Patch whitespace validation | PASS |

The full Chromium journey against the `/pink-fm/` preview was attempted again after the passing project-base build. Chrome exited before page assertions because its local GPU persistent-cache files were locked (`GPU process isn't usable`). This is a host-browser failure, not an application assertion failure. Base-specific build assertions and HTTP smoke checks passed; the same application code completed the full 37-check root-base browser journey.

## Permanent NFC entry and QR

- `public/tap/index.html` redirects with `window.location.replace('../#/g/siti')` and has a short meta-refresh and visible fallback link.
- The relative target resolves correctly from both `/tap/` and `/pink-fm/tap/`.
- The page contains no analytics, external scripts, provider resources, recipient identifiers or secrets.
- Build assertions reject the wrong target, external tracking scripts, missing files or incorrect base paths.
- `docs/nfc/pink-fm-tap-qr.svg` and `.png` use high error correction, a four-module quiet zone, dark-on-light contrast and print-safe dimensions.
- Generation decodes the PNG and compares its content byte-for-byte with the canonical URL.

## Service-worker and update safety

- Cache namespace advanced to the new release version and obsolete Pink FM caches are removed during activation.
- Only same-origin application-shell and static resources are cached.
- YouTube, Spotify, Apple and other cross-origin media or iframe documents are never intercepted or cached.
- Profile data is network-first; `tracks.json` explicitly requests fresh data and only uses its cached copy as an offline fallback.
- `/tap/` is part of the same-origin shell and remains available through cache replacement.
- The update notice reads “A fresh Pink FM edition is ready.” and offers Reload.
- Reload is held while playback is active, preventing a song from being interrupted or a refresh loop from forming.
- Initial service-worker control is distinguished from a later update, preventing a first-visit reload.
- Automated tests cover old-cache cleanup, provider exclusion, update readiness and playback-safe reload behavior.

## Production and playback cleanup

- `#/g/siti/playback-test` is available only in development or when `VITE_ENABLE_PLAYBACK_TESTS=true`; it and its chunk are absent from normal production builds.
- Recipient-facing pages no longer expose source IDs, channel IDs, internal IDs, audit language, stack traces, API language or provider simulation controls.
- The main radio requires an eligible verified full-song source and never promotes a preview-only fallback.
- Runtime fallback remains: primary official full source, backup for the track, allowed official alternate, nearest eligible Siti track, then a controlled unavailable state.
- Failures use calm language and offer Retry and Another Frequency; no external automatic redirect occurs.
- Embed creation is consent-gated. Declining consent keeps recommendations and safe external links usable.
- Rapid recommendation changes dispose of the previous player, and failed playback is not recorded as a completed listen.

## First run, settings and privacy

- `/tap/` resolves to the Siti welcome, followed by a short mood choice, a full-song recommendation and a clear primary Play action.
- WisseBot remains discoverable but secondary to the radio.
- Profile configuration controls recipient display, creator credit, welcome copy, theme, default playback and official alternate behavior.
- Settings can change playback preference and embedded-player consent, allow or disable official alternate versions, clear listening history, or reset the profile experience.
- Clear and reset actions require confirmation. Reset removes only versioned listener state for the selected profile and preserves catalogue data, application caches, and other profiles.
- No analytics or advertising code was added. Listening history remains local. Provider embeds load only after consent, external links use safe relationships, and unsafe protocols and raw track HTML are rejected by existing validation/rendering boundaries.
- Source scans found no committed credential value or client secret. Production sourcemaps are absent.

`npm audit` still reports four high-severity transitive advisories in the existing `@huggingface/transformers` Node dependency chain (`onnxruntime-node`/`adm-zip` and `sharp`). The installed Transformers release is the current published version and npm reports no available fix. These packages support local build/model tooling and are not exposed as server code by this static GitHub Pages application, but the advisories should be reviewed when upstream releases fixes.

## Accessibility and mobile result

- Automated Chromium QA passed keyboard operation, focusable controls, 44-pixel touch targets, 320- and 390-pixel layouts, tablet and desktop layouts, 200% text zoom, reduced motion, long titles and long explanations.
- The player iframe has a meaningful title; update and failure messages use restrained status semantics.
- Primary action and focus colors were strengthened to pass text/focus contrast without changing the established design.
- Existing safe-area padding and wrapping preserve the iPhone layout and long Malay or Arabic strings.
- Physical VoiceOver, TalkBack, iPhone safe-area and real NFC-launch checks remain on the live-device checklist; none are claimed as completed.

## Files changed

Entry, PWA and generated assets:

- `index.html`
- `public/tap/index.html`
- `public/manifest.webmanifest`
- `public/offline.html`
- `public/sw.js`
- `public/pink-fm-preview.png`
- `docs/nfc/pink-fm-tap-qr.svg`
- `docs/nfc/pink-fm-tap-qr.png`

Build, validation and QA:

- `package.json`, `package-lock.json`
- `scripts/assert-release.ts`
- `scripts/assert-built-release.ts`
- `scripts/generate-nfc-qr.ts`
- `scripts/generate-share-image.ts`
- `scripts/browser-qa.mjs`
- `src/release-assets.test.ts`
- `src/service-worker.test.ts`
- `src/app/router.test.ts`
- `src/hooks/useServiceWorker.test.ts`
- `src/features/player/usePlaybackController.test.ts`
- existing playback, provider and storage tests
- refreshed browser QA report and screenshots
- refreshed generated playback-audit timestamps

Application behavior and presentation:

- routing and environment typing under `src/app/`
- service-worker update handling under `src/hooks/`
- player selection, adapters, controls and activity tracking under `src/features/player/`
- listener storage and profile-scoped reset under `src/lib/`
- About, Library, Settings and not-found pages
- profile error and update feedback components
- global and radio styles

Release documentation:

- `docs/final-release-baseline.md`
- `docs/final-release-report.md`
- `docs/nfc/README.md`
- `docs/nfc/nfc-encoding-checklist.md`
- `docs/nfc/nfc-recovery-plan.md`
- `docs/nfc/live-device-test-checklist.md`

## Remaining physical checks

1. Scan the writable NFC tag with at least one real iPhone and one real Android phone.
2. Print both QR formats at the documented sizes and scan them in bright, dim and angled conditions.
3. Verify first visit, consent accepted and declined, real playback, background/foreground return and audio interruption on each phone.
4. Verify offline reopening and the update notice on deployed HTTPS content.
5. Check VoiceOver and TalkBack focus, announcements and external-link wording.
6. Complete the live deployment verification before locking the tag; keep it writable until every check passes.

## Exact review commands

Run from the repository root in PowerShell:

```powershell
git branch --show-current
git status --short
git diff --check
git diff
npm.cmd run youtube:audit -- --slug=siti
npm.cmd run verify
$env:VITE_BASE_PATH='/pink-fm/'
npm.cmd run build
npm.cmd run nfc:generate
npm.cmd run release:assert
```

To review the project-base browser journey in two PowerShell windows:

```powershell
$env:VITE_BASE_PATH='/pink-fm/'
npm.cmd run preview -- --host 127.0.0.1 --port 4174
```

```powershell
$env:QA_BASE_URL='http://127.0.0.1:4174/pink-fm'
npm.cmd run qa:browser
```

After deployment is explicitly approved and performed by a human, follow `docs/nfc/live-device-test-checklist.md` and `docs/nfc/nfc-encoding-checklist.md`. Do not encode a repository URL or `#/g/siti` directly; encode only the canonical `/tap/` URL.
