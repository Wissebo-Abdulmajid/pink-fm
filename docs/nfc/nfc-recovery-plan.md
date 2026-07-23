# Pink FM NFC recovery plan

## Permanent address

The NFC tag and backup QR both point to:

`https://wissebo-abdulmajid.github.io/pink-fm/tap/`

Treat this as the permanent public address. The NFC tag should not point directly to a hash route, branch, commit, provider, or recipient-specific URL.

## Change the destination

The redirect lives in `public/tap/index.html`. Its three relative targets must continue to agree:

- `window.location.replace('../#/g/siti')`
- the meta-refresh target `../#/g/siti`
- the visible fallback link `../#/g/siti`

Change all three only when intentionally moving to another Pink FM profile. Keep the redirect relative so root and `/pink-fm/` builds continue to work. Run the release assertions and both base builds afterward. The NFC tag and QR do not need to change when only the redirect destination changes.

## Redeploy and verify

1. Make the redirect or application fix on the release branch through the normal reviewed workflow.
2. Run `npm.cmd run verify`.
3. Run the explicit `/pink-fm/` build and its post-build assertions.
4. Commit and push only after human review; use the repository’s existing GitHub Pages workflow.
5. Wait for the Pages workflow to finish successfully.
6. Open the canonical `/tap/` URL in a private window and on a device that previously used Pink FM.
7. Confirm the welcome screen, a full-song recommendation, and the update notice/reload path.
8. Recheck the backup QR without using a cached browser tab.

## Rewrite a writable tag

If the canonical address itself must change and the tag is still writable, use an NFC writing app to replace the URI NDEF record, read it back, and repeat the full physical test checklist before locking. Keep the old destination serving a recovery redirect for as long as practical.

If the tag is locked, it cannot be rewritten. Preserve or restore the old canonical page and redirect it to the current Pink FM destination instead. The printed QR remains a visible backup and can be replaced more easily than a locked tag.

## Repository-name warning

GitHub Pages project URLs include the repository name. Renaming `pink-fm` would change `/pink-fm/tap/` and break a locked tag and printed QR unless the old path remains available. Do not rename, transfer, or delete the repository casually. If a move is unavoidable, establish and test a durable redirect from the old canonical URL before changing repository settings.
