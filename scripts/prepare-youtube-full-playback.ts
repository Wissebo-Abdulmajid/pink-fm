import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  catalogSourcesSchema,
  tracksFileSchema,
  type CatalogSources,
  type FullPlaybackSource,
  type TracksFile,
} from '../src/config/schemas.ts'

type Candidate = {
  trackId: string
  sources: FullPlaybackSource[]
}

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const today = '2026-07-14'

const source = (
  _trackId: string,
  id: string,
  videoId: string,
  version: FullPlaybackSource['version'],
  authority: FullPlaybackSource['authority'],
  channelId: string,
  channelName: string,
  durationSeconds: number,
  priority: number,
  provenanceSourceId: string,
): FullPlaybackSource => ({
  id,
  provider: 'youtube',
  videoId,
  version,
  authority,
  channelId,
  channelName,
  verified: true,
  embeddable: true,
  fullLength: true,
  durationSeconds,
  expectedTrackDurationSeconds: null,
  regionNotes: [],
  verifiedAt: today,
  sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
  provenanceSourceId,
  priority,
})

const sitiChannel = {
  id: 'UCNq-mu-iXUmiAWyDOcJmZZg',
  name: 'Siti Nurhaliza',
  authority: 'artist-official' as const,
  provenance: 'youtube-siti-official',
}
const suriaChannel = {
  id: 'UCBd5pENmJrvi6PQq-2ndBhw',
  name: 'SuriaRecords (SRC)',
  authority: 'label-official' as const,
  provenance: 'youtube-suria-records',
}
const mvmChannel = {
  id: 'UCquIzvgQ4PxPDZqFXhuT_gw',
  name: 'MVM MUSIC',
  authority: 'licensed-broadcaster' as const,
  provenance: 'youtube-mvm-music',
}

const candidates: Candidate[] = [
  { trackId: 'cindai', sources: [
    source('cindai', 'cindai-official-mv', 'N2zJlMofr9Y', 'music-video', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 296, 1, sitiChannel.provenance),
    source('cindai', 'cindai-official-lyric-suria', 'InbmXtsF6vQ', 'official-audio', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 297, 2, suriaChannel.provenance),
  ] },
  { trackId: 'purnama-merindu', sources: [
    source('purnama-merindu', 'purnama-merindu-official-mv', 'q0VgfdlXfIc', 'music-video', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 267, 1, suriaChannel.provenance),
  ] },
  { trackId: 'bukan-cinta-biasa', sources: [
    source('bukan-cinta-biasa', 'bukan-cinta-biasa-official-mv', 'eZ4Q5KLeP3E', 'music-video', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 275, 1, sitiChannel.provenance),
  ] },
  { trackId: 'aku-cinta-padamu', sources: [
    source('aku-cinta-padamu', 'aku-cinta-padamu-official-lyric-suria', '2o3S1LqDr2U', 'official-audio', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 328, 1, suriaChannel.provenance),
    source('aku-cinta-padamu', 'aku-cinta-padamu-official-lyric-siti', 'ub-HuJ7cIro', 'official-audio', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 318, 2, sitiChannel.provenance),
  ] },
  { trackId: 'biarlah-rahsia', sources: [
    source('biarlah-rahsia', 'biarlah-rahsia-official-mv', 'cYjwS7sf4sI', 'music-video', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 258, 1, suriaChannel.provenance),
  ] },
  { trackId: 'anta-permana', sources: [
    source('anta-permana', 'anta-permana-official-mv', 'JZzPldJo4eM', 'music-video', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 207, 1, sitiChannel.provenance),
    source('anta-permana', 'anta-permana-official-live', 'BktXD2W1P3M', 'live', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 214, 2, sitiChannel.provenance),
  ] },
  { trackId: 'lebih-indah', sources: [
    source('lebih-indah', 'lebih-indah-official-video', '0NRnLJmQFBU', 'music-video', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 173, 1, sitiChannel.provenance),
    source('lebih-indah', 'lebih-indah-official-alt', 'x8GQC2miK0s', 'alternate', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 243, 2, sitiChannel.provenance),
  ] },
  { trackId: 'wajah-kekasih', sources: [
    source('wajah-kekasih', 'wajah-kekasih-official-ost', 'tzwXY-Womqc', 'music-video', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 340, 1, suriaChannel.provenance),
  ] },
  { trackId: 'kau-kekasihku', sources: [
    source('kau-kekasihku', 'kau-kekasihku-official-mv', '_i4MjPw7ar0', 'music-video', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 336, 1, suriaChannel.provenance),
  ] },
  { trackId: 'balqis', sources: [
    source('balqis', 'balqis-official-mv', 'D2cgyd6z6HU', 'music-video', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 308, 1, sitiChannel.provenance),
    source('balqis', 'balqis-official-lyric', '-NsuS_iPSPU', 'official-audio', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 277, 2, sitiChannel.provenance),
  ] },
  { trackId: 'jerat-percintaan', sources: [
    source('jerat-percintaan', 'jerat-percintaan-official-mv-siti', 'VvPbwCehrgQ', 'music-video', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 269, 1, sitiChannel.provenance),
    source('jerat-percintaan', 'jerat-percintaan-official-mv-suria', '_JWQkyQdko4', 'music-video', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 294, 2, suriaChannel.provenance),
  ] },
  { trackId: 'destinasi-cinta', sources: [
    source('destinasi-cinta', 'destinasi-cinta-youtube-topic', 'K-kzBAW3uSg', 'official-audio', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 205, 1, sitiChannel.provenance),
  ] },
  { trackId: 'nirmala', sources: [
    source('nirmala', 'nirmala-official-mv', '-AjZG2s7jnc', 'music-video', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 350, 1, sitiChannel.provenance),
    source('nirmala', 'nirmala-official-lyric-suria', '3fvm5KkOoLs', 'official-audio', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 339, 2, suriaChannel.provenance),
  ] },
  { trackId: 'percayalah', sources: [
    source('percayalah', 'percayalah-official-mv', 'pqj2-qRwwb8', 'music-video', sitiChannel.authority, sitiChannel.id, sitiChannel.name, 298, 1, sitiChannel.provenance),
    source('percayalah', 'percayalah-official-live-suria', 'AMnQDYCz9Os', 'live', suriaChannel.authority, suriaChannel.id, suriaChannel.name, 318, 2, suriaChannel.provenance),
  ] },
  { trackId: 'aku-bidadari-syurgamu', sources: [
    source('aku-bidadari-syurgamu', 'aku-bidadari-syurgamu-official-mv', 'JAGNmOlMdfQ', 'music-video', mvmChannel.authority, mvmChannel.id, mvmChannel.name, 263, 1, mvmChannel.provenance),
    source('aku-bidadari-syurgamu', 'aku-bidadari-syurgamu-official-audio', 'oA3FNjs_gpY', 'official-audio', mvmChannel.authority, mvmChannel.id, mvmChannel.name, 239, 2, mvmChannel.provenance),
  ] },
]

const args = new Set(process.argv.slice(2))
const slug = process.argv.find((arg) => arg.startsWith('--slug='))?.slice('--slug='.length) ?? 'siti'
const apply = args.has('--apply')

const tracksPath = resolve(projectRoot, 'public', 'gifts', slug, 'tracks.json')
if (!existsSync(tracksPath)) throw new Error(`Missing tracks file: ${tracksPath}`)

const parsed = tracksFileSchema.parse(JSON.parse(readFileSync(tracksPath, 'utf8')) as unknown)
const byTrackId = new Map(candidates.map((candidate) => [candidate.trackId, candidate.sources]))
const beforeFull = parsed.tracks.filter((track) => track.playbackCoverage === 'full-subscription-free').length
const provenanceRecords: CatalogSources['sources'] = [
  {
    id: 'youtube-siti-official',
    type: 'official-youtube-channel',
    provider: 'YouTube',
    url: 'https://www.youtube.com/channel/UCNq-mu-iXUmiAWyDOcJmZZg',
    checkedAt: today,
    notes: 'Reviewed artist-official YouTube channel used for full-song embedded playback candidates.',
  },
  {
    id: 'youtube-suria-records',
    type: 'official-youtube-channel',
    provider: 'YouTube',
    url: 'https://www.youtube.com/channel/UCBd5pENmJrvi6PQq-2ndBhw',
    checkedAt: today,
    notes: 'Reviewed label-official Suria Records YouTube channel used for full-song embedded playback candidates.',
  },
  {
    id: 'youtube-mvm-music',
    type: 'official-youtube-channel',
    provider: 'YouTube',
    url: 'https://www.youtube.com/channel/UCquIzvgQ4PxPDZqFXhuT_gw',
    checkedAt: today,
    notes: 'Reviewed licensed broadcaster channel used for full-song embedded playback candidates.',
  },
]

const next: TracksFile = {
  schemaVersion: 4,
  tracks: parsed.tracks.map((track) => {
    const sources = byTrackId.get(track.id)
    if (!sources) {
      return {
        ...track,
        playbackCoverage: track.officialLinks.appleMusic ? 'preview-only' : 'external-only',
        fullPlaybackSources: track.fullPlaybackSources ?? [],
      }
    }
    const primary = sources.find((item) => item.priority === 1) ?? sources[0]
    return {
      ...track,
      sourceIds: [...new Set([...track.sourceIds, ...sources.map((item) => item.provenanceSourceId)])],
      officialLinks: {
        ...track.officialLinks,
        youtube: track.officialLinks.youtube || primary?.sourceUrl || '',
      },
      playback: {
        ...track.playback,
        preferredProvider: 'youtube',
        youtube: primary
          ? { videoId: primary.videoId, verifiedOfficial: true as const, sourceId: primary.provenanceSourceId }
          : track.playback.youtube,
      },
      playbackCoverage: 'full-subscription-free',
      fullPlaybackSources: sources,
    }
  }),
}

const afterFull = next.tracks.filter((track) => track.playbackCoverage === 'full-subscription-free').length
const summary = {
  slug,
  apply,
  beforeFull,
  afterFull,
  candidates: candidates.length,
  twoSourceTracks: candidates.filter((candidate) => candidate.sources.length > 1).length,
}

console.log(JSON.stringify(summary, null, 2))

if (apply) {
  writeFileSync(tracksPath, `${JSON.stringify(next, null, 2)}\n`)
  const sourcesPath = resolve(projectRoot, 'public', 'gifts', slug, 'catalog-sources.json')
  const catalogSources = catalogSourcesSchema.parse(
    JSON.parse(readFileSync(sourcesPath, 'utf8')) as unknown,
  )
  const existingSourceIds = new Set(catalogSources.sources.map((item) => item.id))
  const mergedSources: CatalogSources = {
    ...catalogSources,
    lastFullAudit: today,
    sources: [
      ...catalogSources.sources,
      ...provenanceRecords.filter((item) => !existingSourceIds.has(item.id)),
    ],
  }
  writeFileSync(sourcesPath, `${JSON.stringify(mergedSources, null, 2)}\n`)
  console.log(`Updated ${tracksPath}`)
  console.log(`Updated ${sourcesPath}`)
} else {
  console.log('Dry run only. Re-run with --apply to write changes.')
}
