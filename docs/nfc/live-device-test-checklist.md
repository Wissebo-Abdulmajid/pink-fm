# Pink FM live-device test checklist

This checklist records tests that require the deployed site and real hardware. Automated browser emulation is useful but is not a substitute for these checks.

## NFC and QR

- [ ] iPhone NFC tap opens `https://wissebo-abdulmajid.github.io/pink-fm/tap/`.
- [ ] Android NFC tap opens the same URL.
- [ ] iPhone camera scans the printed QR.
- [ ] Android camera scans the printed QR.
- [ ] NFC works through the final gift material and from the intended tap location.
- [ ] QR scans in bright light, dim light, and at arm’s length.

## First visit

- [ ] A clean/private browser reaches the Siti welcome screen from `/tap/`.
- [ ] The welcome and mood-radio idea are understandable within a few seconds.
- [ ] Mood controls are comfortable to tap.
- [ ] No provider request appears before embedded-player consent.
- [ ] Accepting consent produces a full-song recommendation and an obvious Play action.
- [ ] Declining consent leaves the recommendation and safe external links usable.
- [ ] Back does not reveal a redundant redirect page.

## Returning and changing conditions

- [ ] Returning to the site preserves the chosen consent and preferences.
- [ ] Backgrounding and returning does not create duplicate players or overlapping audio.
- [ ] Airplane mode after one online visit preserves the application shell and cached profile.
- [ ] Restoring the connection removes the offline playback message.
- [ ] A deployed update shows “A fresh Pink FM edition is ready.”
- [ ] Reload is held while a song is playing and works after playback pauses.
- [ ] Reset Pink FM experience asks for confirmation and leaves the station usable.

## Display and accessibility

- [ ] iPhone safe areas and status bar do not cover controls.
- [ ] Android browser chrome does not cover controls.
- [ ] 320 CSS-pixel equivalent layout has no horizontal clipping.
- [ ] 390 CSS-pixel equivalent layout has no horizontal clipping.
- [ ] Tablet and desktop layouts remain coherent.
- [ ] 200% text size remains readable without losing actions.
- [ ] Reduced Motion removes decorative movement.
- [ ] Keyboard navigation, visible focus, dialog close and focus return work on a desktop browser.
- [ ] VoiceOver or TalkBack reads the welcome, mood buttons, Play action, errors and update notice sensibly.

Record the device models, OS/browser versions, date and any issue beside each completed check before locking the NFC tag.
