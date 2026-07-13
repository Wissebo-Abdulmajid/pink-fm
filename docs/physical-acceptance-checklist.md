# Pink FM physical gift acceptance checklist

Print this page and complete it only after the final public URL is deployed. A simulated browser test is not a substitute for the items below.

Gift profile under test: `siti`

Primary candidate URL: `https://pinkfm.is-a.dev/#/g/siti`

Fallback URL: `https://Wissebo-Abdulmajid.github.io/pink-fm/#/g/siti`

Tester: ____________________  Date: ____________________  Build/commit: ____________________

Status vocabulary:

- `PASS` — tested on the named physical device and behaved correctly.
- `FAIL` — tested physically and a defect was observed; record it below.
- `REQUIRES PHYSICAL ACCEPTANCE TEST` — not yet tested on real hardware.

## Device matrix

| Physical target | Device / OS / browser | Status | Notes |
| --- | --- | --- | --- |
| Recent Android phone | ____________________ | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Older or mid-range Android phone | ____________________ | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| NFC-capable iPhone | ____________________ | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |

## First-open and connectivity

| Check | Status | Notes |
| --- | --- | --- |
| Open the NFC profile URL on Wi-Fi | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Open the NFC profile URL on mobile data | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Confirm welcome and instant WisseBot are usable before any model download | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Reopen after a successful online load while offline | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Confirm favourites/history and local recommendations remain available offline | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Confirm external playback explains that a network connection is needed | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Repeat in data-saver mode where supported | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Repeat in low-power mode | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Open in private/incognito mode and confirm degraded persistence is understandable | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Clear browser site data, reopen, and confirm a clean safe state | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |

## Enhanced understanding

| Check | Status | Notes |
| --- | --- | --- |
| Verify the model never downloads merely by opening WisseBot | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Verify approximate size, purpose and instant-mode alternative are shown | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Verify data-saver/slow-connection confirmation before download | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Complete the first model download on Wi-Fi | **REQUIRES PHYSICAL ACCEPTANCE TEST** | elapsed: __________ |
| Record model initialisation time | **REQUIRES PHYSICAL ACCEPTANCE TEST** | __________ seconds |
| Record first inference time | **REQUIRES PHYSICAL ACCEPTANCE TEST** | __________ ms |
| Record repeated inference time | **REQUIRES PHYSICAL ACCEPTANCE TEST** | __________ ms |
| Reopen and confirm cached model reuse where the browser retained it | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Interrupt/cancel a first download and retry safely | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Test with the model unavailable and confirm instant mode remains usable | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Test without WebGPU and confirm WASM or instant fallback | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Use “Remove enhanced understanding data”; confirm favourites/history remain | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |

## PWA and browser modes

| Check | Status | Notes |
| --- | --- | --- |
| Install the PWA on Android | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Add to Home Screen on iPhone | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Launch in installed standalone mode | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Launch in normal browser mode | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Confirm service-worker update notice and update flow | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |

## Layout, accessibility and interaction

| Check | Status | Notes |
| --- | --- | --- |
| Portrait and landscape rotation | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| 200% text zoom without lost controls or horizontal scrolling | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Largest device text-size setting | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Screen reader: TalkBack on Android | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Screen reader: VoiceOver on iPhone | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| External keyboard navigation, visible focus and Escape-close behaviour | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Reduced-motion operating-system setting | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| High-contrast Pink FM setting | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Touch targets and radio tuning dial with one hand | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Long Malay bot response and long track/album title | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |

## NFC and QR handoff

Keep the NFC tag writable until every item in this section passes.

| Check | Status | Notes |
| --- | --- | --- |
| Write only the final HTTPS URL as an NDEF URI record | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Android NFC tap with screen unlocked | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Android NFC tap with screen locked where supported | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| iPhone NFC tap with screen unlocked | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| iPhone NFC tap with screen locked where supported | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| NFC through the final card material | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| NFC through a common phone case | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Printed QR code opens the same profile route | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| QR code remains readable at final print size and ordinary indoor light | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Fallback GitHub Pages URL is retained in handoff records | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| Final domain, HTTPS and route are stable for at least 48 hours | **REQUIRES PHYSICAL ACCEPTANCE TEST** | ____________________ |
| NFC tag locked only after every URL/NFC/QR check passes | **REQUIRES PHYSICAL ACCEPTANCE TEST** | Do **not** lock early. |

## Failure log

| ID | Device / condition | Steps | Expected | Actual | Retest |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

Final physical acceptance: ☐ PASS ☐ FAIL ☐ **REQUIRES PHYSICAL ACCEPTANCE TEST**

Accepted by: ____________________  Date: ____________________
