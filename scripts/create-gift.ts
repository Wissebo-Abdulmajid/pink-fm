import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  catalogSourcesSchema,
  collectionsFileSchema,
  giftSchema,
  tracksFileSchema,
} from '../src/config/schemas.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const giftsRoot = resolve(projectRoot, 'public', 'gifts')
const templatePath = resolve(giftsRoot, '_template')

const args = process.argv.slice(2)
const valueFor = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const slugArgument = valueFor('--slug')
const artistArgument = valueFor('--artist')
const stationArgument = valueFor('--station')
const force = args.includes('--force')

const fail = (message: string): never => {
  console.error(`Gift profile was not created: ${message}`)
  console.error('Usage: npm run gift:create -- --slug <slug> --artist "<artist>" --station "<station>" [--force]')
  process.exit(1)
}

if (!slugArgument || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugArgument)) {
  fail('Provide a lowercase slug containing letters, numbers and single hyphens.')
}
if (!artistArgument?.trim()) fail('Provide a non-empty --artist value.')
if (!stationArgument?.trim()) fail('Provide a non-empty --station value.')
if (!existsSync(templatePath)) fail(`Template directory is missing: ${templatePath}`)

const slug = slugArgument as string
const artist = artistArgument as string
const station = stationArgument as string

const targetPath = resolve(giftsRoot, slug)
if (existsSync(targetPath) && !force) {
  fail(`public/gifts/${slug} already exists. Pass --force to replace it.`)
}
if (existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true })
mkdirSync(giftsRoot, { recursive: true })
cpSync(templatePath, targetPath, { recursive: true })

const artistSlug = artist
  .trim()
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'featured-artist'

const giftPath = resolve(targetPath, 'gift.json')
const gift = giftSchema.parse(JSON.parse(readFileSync(giftPath, 'utf8')) as unknown)
gift.slug = slug
gift.station.name = station.trim()
gift.station.shortName = station.trim().slice(0, 30)
gift.artist.name = artist.trim()
gift.artist.shortName = artist.trim().split(/\s+/)[0] ?? artist.trim()
gift.artist.slug = artistSlug
gift.artistPolicy.primaryArtistIds = [artistSlug]
writeFileSync(giftPath, `${JSON.stringify(gift, null, 2)}\n`, 'utf8')

const tracksPath = resolve(targetPath, 'tracks.json')
const tracks = tracksFileSchema.parse(JSON.parse(readFileSync(tracksPath, 'utf8')) as unknown)
tracks.tracks = tracks.tracks.map((track) => ({
  ...track,
  artist: artist.trim(),
  primaryArtistId: artistSlug,
}))
writeFileSync(tracksPath, `${JSON.stringify(tracks, null, 2)}\n`, 'utf8')

const collectionsPath = resolve(targetPath, 'collections.json')
const collections = collectionsFileSchema.parse(
  JSON.parse(readFileSync(collectionsPath, 'utf8')) as unknown,
)
collections.collections = collections.collections.map((collection) => ({
  ...collection,
  artistIds:
    collection.kind === 'secondary-artist' ? collection.artistIds : [artistSlug],
}))
writeFileSync(collectionsPath, `${JSON.stringify(collections, null, 2)}\n`, 'utf8')

const sourcesPath = resolve(targetPath, 'catalog-sources.json')
const sources = catalogSourcesSchema.parse(
  JSON.parse(readFileSync(sourcesPath, 'utf8')) as unknown,
)
const today = new Date().toISOString().slice(0, 10)
sources.lastFullAudit = today
sources.sources = sources.sources.map((source) => ({
  ...source,
  checkedAt: today,
}))
sources.trackVerification = Object.fromEntries(
  Object.entries(sources.trackVerification).map(([trackId, verification]) => [
    trackId,
    { ...verification, verifiedAt: today },
  ]),
)
writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, 'utf8')

console.log(`Gift profile created: public/gifts/${slug}`)
console.log(`Artist: ${artist.trim()}`)
console.log(`Station: ${station.trim()}`)
console.log(`Route: #/g/${slug}`)
console.log('\nNext:')
console.log('1. Edit gift.json')
console.log('2. Add verified records to tracks.json')
console.log('3. Replace catalog-sources.json placeholders with official provenance')
console.log('4. Review collections.json and add permitted artwork to assets/')
console.log(`5. Run npm run bot:embeddings -- --slug ${slug}`)
console.log('6. Run npm run content:validate')
