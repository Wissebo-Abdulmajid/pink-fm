import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { loadCatalog, writeJsonFile } from './catalog-shared.ts'
import { parseSpotifyUrl } from '../src/features/player/providers/spotify/spotify-url.ts'

const args = process.argv.slice(2)
const valueFor = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
const slug = valueFor('--slug') ?? 'siti'
const apply = args.includes('--apply')
if (apply && args.includes('--dry-run')) throw new Error('Choose either --dry-run or --apply, not both.')

const catalog = loadCatalog(slug)
const active = catalog.tracks.tracks.filter((track) => track.active)
const rows = active.map((track) => {
  const url = track.officialLinks.spotify
  const parsed = url ? parseSpotifyUrl(url) : { entityType: 'invalid' as const, id: null, uri: null }
  return {
    trackId: track.id,
    title: track.title,
    reviewed: track.curationStatus === 'reviewed',
    spotifyUrl: url,
    classification: url ? parsed.entityType : 'missing',
    spotifyUri: parsed.uri,
    action: parsed.entityType === 'album' ? 'replace-with-reviewed-direct-track-url' : 'none',
  }
})

const count = (classification: string) => rows.filter((row) => row.classification === classification).length
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  profile: slug,
  mode: apply ? 'apply' : 'dry-run',
  totals: {
    active: rows.length,
    track: count('track'),
    album: count('album'),
    playlist: count('playlist'),
    artist: count('artist'),
    invalid: count('invalid'),
    missing: count('missing'),
  },
  records: rows,
}

const docsRoot = resolve(process.cwd(), 'docs')
writeJsonFile(resolve(docsRoot, 'phase-4-playback-preparation.json'), report)
writeFileSync(
  resolve(docsRoot, 'phase-4-playback-preparation.md'),
  `# Phase 4 playback preparation\n\nGenerated ${report.generatedAt} in **${report.mode}** mode.\n\n` +
  `| Measure | Count |\n| --- | ---: |\n` +
  Object.entries(report.totals).map(([label, value]) => `| ${label} | ${value} |`).join('\n') +
  `\n\n## Direct-track replacements required\n\n` +
  (rows.filter((row) => row.action !== 'none').map((row) => `- \`${row.trackId}\`: ${row.spotifyUrl}`).join('\n') || '- None') +
  `\n\nNo destination URL was fabricated or replaced.\n`,
  'utf8',
)

if (apply) {
  // Parsing performs only the documented backward-compatible schema migration.
  // Existing reviewed destinations and editorial data are preserved byte-for-value.
  writeJsonFile(resolve(catalog.profilePath, 'tracks.json'), catalog.tracks)
}

console.log(`Pink FM playback preparation: ${slug} (${report.mode})`)
Object.entries(report.totals).forEach(([label, value]) => console.log(`${label}: ${value}`))
console.log('Reports: docs/phase-4-playback-preparation.{json,md}')
if (!apply) console.log('No catalogue changes made. Re-run with --apply to persist schema migration defaults.')
