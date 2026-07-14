import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  tracksFileSchema,
  youtubeAuthoritiesFileSchema,
  type TracksFile,
} from '../src/config/schemas.ts'
import type {
  CatalogueVideoCandidate,
  DiscoveredYouTubeVideo,
  TrustedYouTubeAuthority,
} from '../src/features/recommendations/youtube-catalog-matching.ts'

export const projectRoot = fileURLToPath(new URL('..', import.meta.url))

export const todayIsoDate = () => new Date().toISOString().slice(0, 10)

export const parseSlug = (args = process.argv.slice(2)) =>
  args.find((arg) => arg.startsWith('--slug='))?.slice('--slug='.length) ?? 'siti'

export const hasFlag = (flag: string, args = process.argv.slice(2)) => args.includes(flag)

export const profileRoot = (slug: string) => resolve(projectRoot, 'public', 'gifts', slug)
export const docsRoot = () => resolve(projectRoot, 'docs')
export const cacheRoot = (slug: string) => resolve(projectRoot, '.cache', 'youtube', slug)

export const readJsonFile = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T

export const writeJsonFile = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export const loadTracksFile = (slug: string): TracksFile =>
  tracksFileSchema.parse(readJsonFile(resolve(profileRoot(slug), 'tracks.json')))

export const loadAuthorities = (slug: string): TrustedYouTubeAuthority[] =>
  youtubeAuthoritiesFileSchema.parse(
    readJsonFile(resolve(profileRoot(slug), 'youtube-authorities.json')),
  ).channels

export const discoveryCachePath = (slug: string) => resolve(cacheRoot(slug), 'discovered-videos.json')
export const discoverySummaryPath = (slug: string) => resolve(cacheRoot(slug), 'discovery-summary.json')
export const candidatesJsonPath = () => resolve(docsRoot(), 'phase-4-2-youtube-candidates.json')
export const candidatesMdPath = () => resolve(docsRoot(), 'phase-4-2-youtube-candidates.md')

export const loadDiscoveredVideos = (slug: string): DiscoveredYouTubeVideo[] => {
  const path = discoveryCachePath(slug)
  if (!existsSync(path)) return []
  return readJsonFile<DiscoveredYouTubeVideo[]>(path)
}

export const writeDiscoveredVideos = (slug: string, videos: DiscoveredYouTubeVideo[]) =>
  writeJsonFile(discoveryCachePath(slug), videos)

export const writeCandidateReports = (candidates: CatalogueVideoCandidate[]) => {
  writeJsonFile(candidatesJsonPath(), {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    candidates,
  })
  writeFileSync(
    candidatesMdPath(),
    [
      '# Phase 4.2 YouTube Candidate Review Queue',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Total candidates: ${candidates.length}`,
      '',
      '| Track | Candidate | Video | Channel | Duration | Confidence | Version | Status | Reason | Review |',
      '| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |',
      ...candidates.map((candidate) => [
        candidate.trackTitle,
        candidate.candidateTitle,
        `[${candidate.videoId}](${candidate.sourceUrl})`,
        `${candidate.channelName} (${candidate.channelId})`,
        candidate.durationSeconds ?? 'unknown',
        candidate.matchConfidence,
        candidate.versionClassification,
        candidate.reviewStatus,
        candidate.reason.replace(/\|/g, '/'),
        '`pending | accepted | rejected | alternate-version | duplicate | wrong-song | medley | preview | unavailable | needs-listening-review`',
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')),
      '',
      'Only `accepted` candidates with `exact-high-confidence` are eligible for automated application. Probable, ambiguous and rejected candidates remain review-only.',
      '',
    ].join('\n'),
  )
}

export const writeSourceAcquisitionReport = (input: {
  slug: string
  apiKeyPresent: boolean
  authorityCount: number
  discoveredVideoCount: number
  candidateCount: number
  autoAcceptedCount: number
  rejectedCount: number
  ambiguousCount: number
  apiCalls: number
  quotaEstimate: number
  notes: string[]
}) => {
  const path = resolve(docsRoot(), 'phase-4-2-source-acquisition.md')
  writeFileSync(
    path,
    [
      '# Phase 4.2 Source Acquisition',
      '',
      `Profile: ${input.slug}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      `- YouTube Data API key present: ${input.apiKeyPresent ? 'yes' : 'no'}`,
      `- Trusted active authorities: ${input.authorityCount}`,
      `- Discovered videos in cache: ${input.discoveredVideoCount}`,
      `- Candidate records: ${input.candidateCount}`,
      `- Automatically acceptable exact-high-confidence records: ${input.autoAcceptedCount}`,
      `- Rejected records: ${input.rejectedCount}`,
      `- Ambiguous records: ${input.ambiguousCount}`,
      `- API calls made in this run: ${input.apiCalls}`,
      `- Estimated quota units used in this run: ${input.quotaEstimate}`,
      '',
      '## Notes',
      '',
      ...input.notes.map((note) => `- ${note}`),
      '',
    ].join('\n'),
  )
  writeJsonFile(discoverySummaryPath(input.slug), input)
}
