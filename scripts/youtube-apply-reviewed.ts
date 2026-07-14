import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  candidatesJsonPath,
  hasFlag,
  loadTracksFile,
  parseSlug,
  profileRoot,
  readJsonFile,
  todayIsoDate,
} from './youtube-acquisition-tools.ts'
import {
  candidateCanBeApplied,
  candidateToFullPlaybackSource,
  type CatalogueVideoCandidate,
} from '../src/features/recommendations/youtube-catalog-matching.ts'
import {
  catalogSourcesSchema,
  tracksFileSchema,
  type CatalogSources,
  type TracksFile,
} from '../src/config/schemas.ts'

type CandidateFile = {
  candidates: CatalogueVideoCandidate[]
}

const slug = parseSlug()
const apply = hasFlag('--apply')
const candidatesPath = candidatesJsonPath()
if (!existsSync(candidatesPath)) {
  throw new Error('Missing docs/phase-4-2-youtube-candidates.json. Run youtube:match first.')
}

const tracksPath = resolve(profileRoot(slug), 'tracks.json')
const sourcesPath = resolve(profileRoot(slug), 'catalog-sources.json')
const tracksFile = loadTracksFile(slug)
const candidates = readJsonFile<CandidateFile>(candidatesPath).candidates
const applicable = candidates.filter(candidateCanBeApplied)
const byTrackId = new Map<string, CatalogueVideoCandidate[]>()
const versionPriority = (candidate: CatalogueVideoCandidate) => {
  if (candidate.versionClassification === 'official-music-video') return 0
  if (candidate.versionClassification === 'official-audio' || candidate.versionClassification === 'youtube-topic') return 1
  if (candidate.versionClassification === 'official-lyric-video') return 2
  return 3
}

for (const candidate of applicable) {
  byTrackId.set(candidate.trackId, [...(byTrackId.get(candidate.trackId) ?? []), candidate])
}

const today = todayIsoDate()
let addedSources = 0
const nextTracks: TracksFile = {
  schemaVersion: 4,
  tracks: tracksFile.tracks.map((track) => {
    const additions = byTrackId.get(track.id) ?? []
    if (additions.length === 0) return track
    const existingVideoIds = new Set(track.fullPlaybackSources.map((source) => source.videoId))
    const newSources = additions
      .filter((candidate) => !existingVideoIds.has(candidate.videoId))
      .sort((left, right) =>
        versionPriority(left) - versionPriority(right) ||
        (right.durationSeconds ?? 0) - (left.durationSeconds ?? 0) ||
        left.videoId.localeCompare(right.videoId)
      )
      .slice(0, Math.max(0, 8 - track.fullPlaybackSources.length))
      .map((candidate, index) => candidateToFullPlaybackSource({
        ...candidate,
        proposedPriority: track.fullPlaybackSources.length + index + 1,
      }, today))
    if (newSources.length === 0) return track
    addedSources += newSources.length
    const sources = [...track.fullPlaybackSources, ...newSources]
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
      .map((source, index) => ({ ...source, priority: index + 1 }))
    const primary = sources[0]
    return {
      ...track,
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
      sourceIds: [...new Set([...track.sourceIds, ...sources.map((source) => source.provenanceSourceId)])],
    }
  }),
}

const parsed = tracksFileSchema.parse(nextTracks)

let nextSources: CatalogSources | null = null
if (existsSync(sourcesPath)) {
  const current = catalogSourcesSchema.parse(JSON.parse(readFileSync(sourcesPath, 'utf8')) as unknown)
  const sourceIds = new Set(current.sources.map((source) => source.id))
  const authorityRecords = applicable
    .filter((candidate) => !sourceIds.has(candidate.provenanceSourceId))
    .map((candidate) => ({
      id: candidate.provenanceSourceId,
      type: 'official-youtube-channel',
      provider: 'YouTube',
      url: `https://www.youtube.com/channel/${candidate.channelId}`,
      checkedAt: today,
      notes: `Trusted ${candidate.authority} source used for Phase 4.2 full-song playback acquisition.`,
    }))
  const uniqueAuthorityRecords = [...new Map(authorityRecords.map((record) => [record.id, record])).values()]
  nextSources = catalogSourcesSchema.parse({
    ...current,
    lastFullAudit: today,
    sources: [...current.sources, ...uniqueAuthorityRecords],
  })
}

const beforeFull = tracksFile.tracks.filter((track) => track.playbackCoverage === 'full-subscription-free').length
const afterFull = parsed.tracks.filter((track) => track.playbackCoverage === 'full-subscription-free').length
const summary = {
  slug,
  apply,
  applicableCandidates: applicable.length,
  addedSources,
  beforeFull,
  afterFull,
  newFullTracks: afterFull - beforeFull,
}

console.log(JSON.stringify(summary, null, 2))

if (apply) {
  writeFileSync(tracksPath, `${JSON.stringify(parsed, null, 2)}\n`)
  if (nextSources) writeFileSync(sourcesPath, `${JSON.stringify(nextSources, null, 2)}\n`)
  console.log(`Updated ${tracksPath}`)
  if (nextSources) console.log(`Updated ${sourcesPath}`)
} else {
  console.log('Dry run only. Re-run with --apply to write accepted candidates.')
}
