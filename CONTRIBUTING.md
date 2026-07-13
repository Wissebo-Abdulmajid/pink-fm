# Contributing to Pink FM

Pink FM keeps reusable application logic separate from gift-specific content. Small, focused changes with tests are welcome.

## Set up

Use the active LTS release of Node.js and npm. From the project root:

```bash
npm ci
npm run verify
```

PowerShell users whose execution policy blocks `npm.ps1` can run the same commands with `npm.cmd`.

## Change guidelines

- Keep TypeScript strict and avoid `any`.
- Do not put artist names, recipient details, theme colours or catalogue entries in React components.
- Add or update pure-function tests when recommendation or WisseBot behaviour changes.
- Keep deterministic rules authoritative for negation, corrections and catalogue entities. Semantic similarity may enrich retrieval but must never create a title or factual claim.
- Keep semantic inference lazy and worker-based; do not add model weights to the initial application bundle.
- Use semantic HTML, visible focus, 44-pixel touch targets and reduced-motion-safe effects.
- Do not add external analytics, client secrets, copyrighted audio, lyrics or scraped streaming metadata.
- Add only images and media that you own or are licensed to redistribute.
- Keep third-party playback truthful: link to or embed an approved official destination; never imply Pink FM hosts audio.

## Profile contributions

Run `npm run gift:create -- --slug <slug> --artist "<artist>" --station "<station>"`, replace the demo record, register provenance, add verified official HTTPS links and run `npm run content:validate`. A profile directory name and `gift.json` slug must match.

Use `reviewed` only after metadata, destination, and emotional profile have received a deliberate review. Use `verified-metadata` when identity and official destination are sound but subjective curation is incomplete. Do not raise confidence simply to satisfy a count target.

Before committing catalogue changes:

```bash
npm run catalog:import -- --slug <slug> --input <prepared-file> --dry-run
npm run catalog:dedupe -- --slug <slug>
npm run catalog:audit -- --slug <slug>
npm run catalog:coverage -- --slug <slug>
npm run bot:embeddings -- --slug <slug>
npm run content:validate
```

The import source must be a carefully prepared CSV or JSON snapshot. Do not add a live scraper as a build or runtime dependency.

## Pull requests

Before opening a pull request:

1. Run `npm run verify`.
2. When bot behaviour changes, run `npm run bot:evaluate` and report real metric changes.
3. Test the welcome, mood, radio, WisseBot, library and settings flows with keyboard only.
4. Test at 320 CSS pixels and one desktop width, including reduced motion and lightweight semantic fallback.
5. Describe content provenance, curation-state decisions, and media permissions.

The MIT licence covers source code only. It does not grant rights to artist names, music, trademarks, profile-owner images or other user-supplied media.
