import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const dist = resolve(root, 'dist')
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(`Built-release assertion failed: ${message}`)
}
const normaliseBase = (value?: string) => !value || value === '/'
  ? '/'
  : `/${value.replace(/^\/+|\/+$/g, '')}/`
const base = normaliseBase(process.env.VITE_BASE_PATH)

const tapPath = resolve(dist, 'tap', 'index.html')
assert(existsSync(tapPath), 'dist/tap/index.html must exist')
const tap = readFileSync(tapPath, 'utf8')
assert(tap.includes("window.location.replace('../#/g/siti')"), 'built tap redirect target must remain relative and exact')

const index = readFileSync(resolve(dist, 'index.html'), 'utf8')
assert(index.includes(`href="${base}manifest.webmanifest"`), `manifest path must honor base ${base}`)
assert(index.includes(`href="${base}icons/pink-fm-192.png"`), `Apple touch icon must honor base ${base}`)

const assetDirectory = resolve(dist, 'assets')
const files = readdirSync(assetDirectory)
assert(!files.some((file) => /PlaybackTestPage|playback-test/i.test(file)), 'production assets must omit the playback maintenance page')
const javascript = files
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(resolve(assetDirectory, file), 'utf8'))
  .join('\n')
assert(!javascript.includes('/playback-test'), 'production bundle must not expose the maintenance route')
assert(!files.some((file) => file.endsWith('.map')), 'production bundle must not contain source maps')

console.log(`Built-release assertions passed for base ${base}`)
