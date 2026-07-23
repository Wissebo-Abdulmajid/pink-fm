import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'

const canonicalUrl = 'https://wissebo-abdulmajid.github.io/pink-fm/tap/'

describe('permanent NFC entry point', () => {
  const tapPath = resolve(process.cwd(), 'public', 'tap', 'index.html')
  const tap = readFileSync(tapPath, 'utf8')

  it('ships a relative, history-replacing redirect with a no-JavaScript fallback', () => {
    expect(existsSync(tapPath)).toBe(true)
    expect(tap).toContain("window.location.replace('../#/g/siti')")
    expect(tap).toContain('content="0; url=../#/g/siti"')
    expect(tap).toContain('href="../#/g/siti"')
  })

  it.each([
    ['root', 'https://example.test/tap/', 'https://example.test/#/g/siti'],
    ['project', 'https://example.test/pink-fm/tap/', 'https://example.test/pink-fm/#/g/siti'],
  ])('resolves from a %s build', (_name, base, expected) => {
    expect(new URL('../#/g/siti', base).toString()).toBe(expected)
  })

  it('contains no tracking or media-provider script', () => {
    expect(tap).not.toMatch(/<script\b[^>]+src=/i)
    expect(tap).not.toMatch(/analytics|googletagmanager|google-analytics|youtube|spotify|music\.apple/i)
  })
})

describe('NFC backup QR', () => {
  it('round-trips the printed PNG to the exact canonical URL', () => {
    const png = PNG.sync.read(readFileSync(resolve(process.cwd(), 'docs', 'nfc', 'pink-fm-tap-qr.png')))
    const result = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' })
    expect(result?.data).toBe(canonicalUrl)
  })
})
