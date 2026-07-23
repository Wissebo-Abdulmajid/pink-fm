import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { CANONICAL_TAP_URL } from './generate-nfc-qr.ts'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(`Release assertion failed: ${message}`)
}

const tapPath = resolve(root, 'public', 'tap', 'index.html')
assert(existsSync(tapPath), 'public/tap/index.html must exist')
const tap = read('public/tap/index.html')
assert(tap.includes("window.location.replace('../#/g/siti')"), 'tap JavaScript must replace history with ../#/g/siti')
assert(tap.includes('content="0; url=../#/g/siti"'), 'tap meta refresh must target ../#/g/siti')
assert(tap.includes('href="../#/g/siti"'), 'tap page must include an accessible fallback link')
assert(!/<script\b[^>]+src=/i.test(tap), 'tap page must not load an external script')
assert(!/(analytics|googletagmanager|google-analytics|youtube|spotify|music\.apple)/i.test(tap), 'tap page must not contain tracking or media-provider resources')

for (const base of ['https://example.test/tap/', 'https://example.test/pink-fm/tap/']) {
  const target = new URL('../#/g/siti', base)
  const expectedPath = base.includes('/pink-fm/') ? '/pink-fm/' : '/'
  assert(target.pathname === expectedPath && target.hash === '#/g/siti', `tap redirect must resolve correctly from ${base}`)
}

const pngPath = resolve(root, 'docs', 'nfc', 'pink-fm-tap-qr.png')
const svgPath = resolve(root, 'docs', 'nfc', 'pink-fm-tap-qr.svg')
assert(existsSync(pngPath) && existsSync(svgPath), 'both NFC QR print assets must exist')
const image = PNG.sync.read(readFileSync(pngPath))
const decoded = jsQR(Uint8ClampedArray.from(image.data), image.width, image.height, { inversionAttempts: 'dontInvert' })
assert(decoded?.data === CANONICAL_TAP_URL, 'PNG QR must decode to the exact canonical tap URL')

const router = read('src/app/router.tsx')
assert(router.includes('playbackTestRouteEnabled'), 'maintenance route must have an explicit release gate')
const serviceWorker = read('public/sw.js')
assert(serviceWorker.includes("url.origin !== self.location.origin"), 'service worker must reject cross-origin requests')
assert(serviceWorker.includes("url.pathname.endsWith('/tracks.json')"), 'track catalogue must use an explicit freshness policy')
assert(serviceWorker.includes("'tap/'"), 'service worker shell must preserve the permanent tap entry')

const manifest = JSON.parse(read('public/manifest.webmanifest')) as {
  start_url?: string
  scope?: string
  display?: string
}
assert(manifest.start_url === './#/g/siti', 'PWA start_url must open the Siti Pink FM profile')
assert(manifest.scope === './', 'PWA scope must stay relative to the deployed base')
assert(manifest.display === 'standalone', 'PWA display mode must remain standalone')
for (const [path, size] of [['public/icons/pink-fm-192.png', 192], ['public/icons/pink-fm-512.png', 512], ['public/icons/pink-fm-maskable-512.png', 512]] as const) {
  const icon = PNG.sync.read(readFileSync(resolve(root, path)))
  assert(icon.width === size && icon.height === size, `${path} must be ${size} × ${size}`)
}

const index = read('index.html')
assert(index.includes('rel="apple-touch-icon"'), 'document must include an Apple touch icon')
assert(index.includes('property="og:image"'), 'document must include an Open Graph preview image')
assert(!/(googletagmanager|google-analytics|plausible\.io|segment\.com)/i.test(index + tap), 'entry documents must not contain analytics')

console.log(`Release assertions passed. Canonical NFC URL: ${CANONICAL_TAP_URL}`)
