import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import QRCode from 'qrcode'

export const CANONICAL_TAP_URL = 'https://wissebo-abdulmajid.github.io/pink-fm/tap/'

const outputDirectory = resolve(process.cwd(), 'docs', 'nfc')
const svgPath = resolve(outputDirectory, 'pink-fm-tap-qr.svg')
const pngPath = resolve(outputDirectory, 'pink-fm-tap-qr.png')

const writeIfChanged = (path: string, data: string | Buffer) => {
  const next = Buffer.isBuffer(data) ? data : Buffer.from(data)
  if (existsSync(path) && readFileSync(path).equals(next)) return false
  writeFileSync(path, next)
  return true
}

const options = {
  errorCorrectionLevel: 'H' as const,
  margin: 4,
  width: 1600,
  color: { dark: '#2f1723', light: '#fffdfd' },
}

mkdirSync(outputDirectory, { recursive: true })
const [svg, png] = await Promise.all([
  QRCode.toString(CANONICAL_TAP_URL, { ...options, type: 'svg' }),
  QRCode.toBuffer(CANONICAL_TAP_URL, { ...options, type: 'png' }),
])

const image = PNG.sync.read(png)
const decoded = jsQR(Uint8ClampedArray.from(image.data), image.width, image.height, {
  inversionAttempts: 'dontInvert',
})
if (decoded?.data !== CANONICAL_TAP_URL) {
  throw new Error(`QR round-trip validation failed. Expected ${CANONICAL_TAP_URL}; decoded ${decoded?.data ?? 'nothing'}.`)
}

const changed = [writeIfChanged(svgPath, svg), writeIfChanged(pngPath, png)].filter(Boolean).length
console.log(`Pink FM NFC QR validated: ${decoded.data}`)
console.log(`${changed ? `Updated ${changed}` : 'No changes to'} print asset${changed === 1 ? '' : 's'}.`)
