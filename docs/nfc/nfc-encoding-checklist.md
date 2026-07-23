# NFC encoding checklist

Use this checklist only after the live GitHub Pages release has passed the live-device checklist.

## Before writing

- [ ] Confirm the tag is an NDEF-compatible NFC Forum tag with enough capacity for one HTTPS URL.
- [ ] Confirm the canonical URL is exactly `https://wissebo-abdulmajid.github.io/pink-fm/tap/`.
- [ ] Confirm there is no query string, tracking parameter, recipient name, or `#/g/siti` fragment on the tag.
- [ ] Open the canonical URL in a private browser window and confirm it reaches the Pink FM welcome screen.
- [ ] Keep the tag writable for the first physical acceptance pass.

## Write and verify

- [ ] Write one URI/URL NDEF record using the canonical URL exactly.
- [ ] Read the tag back in the writing app and compare every character, including `https://` and the final `/`.
- [ ] Tap with NFC enabled on at least one iPhone and one Android phone if available.
- [ ] Test through the intended gift material and from the intended tap position.
- [ ] Confirm a tap opens the ordinary browser without requiring PWA installation.
- [ ] Confirm `/tap/` redirects once to `#/g/siti` and Back does not stop on a useless loading entry.
- [ ] Confirm the backup QR opens the exact same canonical URL.

## Before locking

- [ ] Complete the live-device checklist in `live-device-test-checklist.md`.
- [ ] Confirm the physical QR print scans in bright and dim light.
- [ ] Save the QR artwork and recovery plan somewhere separate from the gift.
- [ ] Lock the tag only after every acceptance check passes and only if permanent read-only encoding is desired.
- [ ] If there is any uncertainty, leave the tag writable.
