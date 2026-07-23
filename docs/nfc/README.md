# Pink FM NFC and QR entry point

Canonical URL for both the NFC tag and backup QR:

`https://wissebo-abdulmajid.github.io/pink-fm/tap/`

The tag and QR must use that URL exactly, with no query string, tracking parameter, recipient name, or direct gift-route fragment. The lightweight `/tap/` page owns the permanent public entry point and currently forwards to the Siti profile.

## Print guidance

- Prefer `pink-fm-tap-qr.svg` for professional print and `pink-fm-tap-qr.png` for tools that require a bitmap.
- Print at least 30 × 30 mm; 35 × 35 mm or larger is preferred for a gift card.
- Preserve the supplied four-module quiet zone. Do not crop, round, recolour, place artwork over, or stretch the code.
- Keep the dark plum modules on a white or very light background. Do not print pink on pink.
- Use a matte finish when possible to reduce glare.

## Validation

The generator uses high error correction and decodes the generated PNG after writing it. Regenerate and validate with:

```powershell
npm.cmd run nfc:generate
npm.cmd run release:assert
```

Before attaching the QR or locking an NFC tag, scan the final physical print at close range and arm’s length in bright and dim light with at least two ordinary phone camera apps. Confirm the browser reaches the Siti Pink FM welcome screen.
