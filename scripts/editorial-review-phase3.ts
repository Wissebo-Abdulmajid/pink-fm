import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { moodDimensionKeys, type StreamingService } from '../src/config/schemas.ts'
import { loadCatalog, projectRoot } from './catalog-shared.ts'

type LinkResult = {
  provider: StreamingService
  url: string
  status: number | null
  reachable: boolean
  method: 'HEAD' | 'GET' | 'not-checked'
  note: string
}

const slugIndex = process.argv.indexOf('--slug')
const slug = slugIndex >= 0 ? process.argv[slugIndex + 1] ?? 'siti' : 'siti'
const checkLinks = process.argv.includes('--check-links')
const catalogue = loadCatalog(slug)
const metadataOnly = catalogue.tracks.tracks.filter(
  (track) => track.active && track.curationStatus === 'verified-metadata',
)
const sourceIds = new Set(catalogue.sources.sources.map((source) => source.id))

const checkLink = async (
  provider: StreamingService,
  url: string,
): Promise<LinkResult> => {
  if (!checkLinks) {
    return {
      provider,
      url,
      status: null,
      reachable: false,
      method: 'not-checked',
      note: 'Network check not requested.',
    }
  }
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
        ...(method === 'GET' ? { headers: { Range: 'bytes=0-0' } } : {}),
      })
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        await response.body?.cancel()
        return {
          provider,
          url,
          status: response.status,
          reachable: true,
          method,
          note: 'Provider endpoint responded successfully. This does not guarantee playback availability in every region.',
        }
      }
      if (method === 'GET') {
        return {
          provider,
          url,
          status: response.status,
          reachable: false,
          method,
          note: `Provider returned HTTP ${response.status}.`,
        }
      }
    } catch (error) {
      if (method === 'GET') {
        return {
          provider,
          url,
          status: null,
          reachable: false,
          method,
          note: error instanceof Error ? error.message : 'Link request failed.',
        }
      }
    }
  }
  return {
    provider,
    url,
    status: null,
    reachable: false,
    method: 'GET',
    note: 'Link request failed.',
  }
}

const records = []
for (let index = 0; index < metadataOnly.length; index += 1) {
  const track = metadataOnly[index]
  if (!track) continue
  const links = Object.entries(track.officialLinks)
    .filter((entry): entry is [StreamingService, string] => Boolean(entry[1]))
  const linkResults = await Promise.all(links.map(([provider, url]) => checkLink(provider, url)))
  const verification = catalogue.sources.trackVerification[track.id]
  const dominantMoods = moodDimensionKeys
    .map((mood) => ({ mood, value: track.moods[mood] }))
    .sort((left, right) => right.value - left.value || left.mood.localeCompare(right.mood))
    .slice(0, 3)
  const structuralIssues = [
    ...(!track.album ? ['missing album'] : []),
    ...(!track.releaseYear ? ['missing release year'] : []),
    ...(!track.era ? ['missing era'] : []),
    ...(!track.collections.length ? ['missing collection'] : []),
    ...(!track.contexts.length ? ['missing context'] : []),
    ...(!track.editorialNote.trim() ? ['missing editorial explanation'] : []),
    ...(!track.semanticDescription.trim() ? ['missing semantic description'] : []),
    ...(!verification ? ['missing provenance record'] : []),
    ...(track.sourceIds.some((id) => !sourceIds.has(id)) ? ['unknown provenance source'] : []),
    ...(!links.length ? ['missing official destination'] : []),
  ]
  const unreachableLinks = linkResults.filter((link) => checkLinks && !link.reachable)
  records.push({
    id: track.id,
    title: track.title,
    album: track.album,
    releaseYear: track.releaseYear,
    era: track.era,
    versionType: track.versionType,
    featuredArtists: track.featuredArtists,
    languages: track.languages,
    genres: track.genres,
    intensity: track.intensity,
    energyAnnotation: track.moods.energised,
    familiarity: track.familiarity,
    dominantMoods,
    collections: track.collections,
    contexts: track.contexts,
    useCases: track.useCases,
    editorialNote: track.editorialNote,
    semanticDescription: track.semanticDescription,
    provenance: {
      trackSourceIds: track.sourceIds,
      verificationSourceIds: verification?.sourceIds ?? [],
      verifiedAt: verification?.verifiedAt ?? null,
      complete: Boolean(
        verification &&
        verification.sourceIds.length &&
        track.sourceIds.every((id) => verification.sourceIds.includes(id)),
      ),
    },
    linkResults,
    structuralIssues,
    decision: 'retain-verified-metadata',
    decisionReason: structuralIssues.length || unreachableLinks.length
      ? 'Objective metadata or destination follow-up is still required.'
      : 'Metadata and provenance passed desk review, but no independent listening review was available to justify a reviewed emotional profile.',
  })
  process.stdout.write(`\rEditorial desk review: ${index + 1}/${metadataOnly.length}`)
}
process.stdout.write('\n')

const unreachable = records.flatMap((record) =>
  record.linkResults.filter((link) => checkLinks && !link.reachable).map((link) => ({
    trackId: record.id,
    title: record.title,
    ...link,
  })),
)
const structural = records.filter((record) => record.structuralIssues.length)
const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  profile: slug,
  scope: {
    activeTracks: catalogue.tracks.tracks.filter((track) => track.active).length,
    reviewedBefore: catalogue.tracks.tracks.filter((track) => track.active && track.curationStatus === 'reviewed').length,
    metadataOnlyInspected: metadataOnly.length,
  },
  method: {
    inspectedFields: [
      'mood vector', 'intensity', 'energy annotation', 'familiarity', 'era', 'collections',
      'contexts', 'editorial explanation', 'semantic description', 'version identity',
      'official destination', 'provenance',
    ],
    linkChecksPerformed: checkLinks,
    limitation: 'No audio listening session or rights-holder editorial notes were available. Subjective annotations were therefore not promoted solely from metadata.',
  },
  outcome: {
    promotedToReviewed: [],
    retainedMetadataOnly: records.map((record) => record.id),
    correctedTracks: [],
    deactivatedTracks: [],
    linksChanged: [],
    moodVectorsChanged: [],
    collectionMembershipsChanged: [],
    unreachableDestinations: unreachable,
    recordsWithStructuralIssues: structural.map((record) => ({
      id: record.id,
      issues: record.structuralIssues,
    })),
  },
  records,
}

writeFileSync(
  resolve(projectRoot, 'docs', 'phase-3-catalogue-editorial-review.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)
const markdown = [
  '# Phase 3 catalogue editorial desk review',
  '',
  `Generated: ${report.createdAt}`,
  '',
  `- Active catalogue: ${report.scope.activeTracks}`,
  `- Already reviewed: ${report.scope.reviewedBefore}`,
  `- Metadata-only records inspected: ${report.scope.metadataOnlyInspected}`,
  `- Promoted: ${report.outcome.promotedToReviewed.length}`,
  `- Retained metadata-only: ${report.outcome.retainedMetadataOnly.length}`,
  `- Unreachable destinations: ${report.outcome.unreachableDestinations.length}`,
  `- Structural issues: ${report.outcome.recordsWithStructuralIssues.length}`,
  '',
  'No record was mass-promoted. Metadata, provenance and destinations can be checked without listening; a human listening review is still required before claiming that the remaining subjective mood profiles are fully reviewed.',
  '',
  'The machine-readable report lists the inspection result and decision for every metadata-only track.',
  '',
].join('\n')
writeFileSync(resolve(projectRoot, 'docs', 'phase-3-catalogue-editorial-review.md'), markdown)
console.log('Editorial report: docs/phase-3-catalogue-editorial-review.json')
