# Pink FM Phase 2 baseline

Captured on 13 July 2026 before Phase 2 source or content changes.

## Repository state

- Branch: `main`
- Existing gift profiles: 1 (`siti`)
- Existing active tracks: 12
- Existing test files: 6
- Existing tests: 27
- Node.js used locally: 24.15.0
- npm used locally: 11.12.1

The project was initialized but had not yet been committed or connected to a Git remote. All files were untracked at baseline; Phase 2 therefore preserves the workspace rather than relying on Git rollback.

## Baseline quality gate

`npm.cmd run verify` passed in 20.1 seconds:

- ESLint: passed
- Strict TypeScript: passed
- Content validation: passed with one profile and 12 expected missing-artwork warnings
- Vitest: 27/27 tests passed across 6 files
- Production build: passed
- Vite modules transformed: 1,899
- Initial entry JavaScript: 335.50 kB (104.56 kB gzip)
- Initial CSS: 47.29 kB (12.67 kB gzip)

## Baseline architecture relevant to migration

- Profile content consists of `gift.json`, `moods.json`, `tracks.json`, and `messages.json`, validated with strict Zod schemas.
- Track schema version is 1 and contains mood vectors, contexts, tempo, intensity, familiarity, links, and editorial copy.
- Listener storage schema version is 2.
- The recommendation engine is deterministic and content-based.
- WisseBot uses one local rule-based provider and short in-memory context.
- Profile routes use a hash router and the Siti NFC route is `#/g/siti`.

This document is intentionally a baseline record; measured Phase 2 results belong in the final implementation report.
