import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  argumentValue,
  countBy,
  hasArgument,
  loadCatalog,
  moodVectorKey,
  normaliseProviderUrl,
  normaliseTitle,
  primaryMoodFor,
  primaryRecordingKey,
  providerUrls,
  sortedCounts,
  writeJsonFile,
  type LoadedCatalog,
} from './catalog-shared.ts'
import {
  moodDimensionKeys,
  type MoodDimension,
  type MoodVector,
  type Track,
} from '../src/config/schemas.ts'

export type AuditProblem = {
  level: 'error' | 'warning'
  code: string
  message: string
  trackIds?: string[]
}

export type CatalogAuditReport = {
  generatedAt: string
  slug: string
  totals: {
    unique: number
    active: number
    recommendationReady: number
    reviewed: number
    verifiedMetadata: number
    provisional: number
    albums: number
  }
  byEra: Record<string, number>
  byAlbum: Record<string, number>
  byVersionType: Record<string, number>
  byCollection: Record<string, number>
  byPrimaryMood: Record<string, number>
  missingLinks: string[]
  missingProvenance: string[]
  likelyNeverRanks: string[]
  remoteLinkWarnings: string[]
  problems: AuditProblem[]
}

const add = (
  problems: AuditProblem[],
  level: AuditProblem['level'],
  code: string,
  message: string,
  trackIds?: string[],
) => {
  problems.push({
    level,
    code,
    message,
    ...(trackIds ? { trackIds } : {}),
  })
}

const inspectDuplicateGroups = (
  tracks: Track[],
  keyFor: (track: Track) => string,
) => {
  const groups = new Map<string, Track[]>()
  for (const track of tracks) {
    const key = keyFor(track)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), track])
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1)
}

const activeSources = (catalog: LoadedCatalog) =>
  new Set(catalog.sources.sources.map((source) => source.id))

const moodSimilarity = (target: MoodVector, candidate: MoodVector) => {
  const distance = moodDimensionKeys.reduce(
    (total, dimension) =>
      total + Math.abs(target[dimension] - candidate[dimension]) / 100,
    0,
  )
  return Math.max(0, 1 - distance / moodDimensionKeys.length)
}

export const auditCatalog = (
  slug: string,
  catalog: LoadedCatalog = loadCatalog(slug),
): CatalogAuditReport => {
  const problems: AuditProblem[] = []
  const tracks = catalog.tracks.tracks
  const active = tracks.filter((track) => track.active)
  const reviewed = active.filter((track) => track.curationStatus === 'reviewed')
  const verifiedMetadata = active.filter(
    (track) => track.curationStatus === 'verified-metadata',
  )
  const provisional = active.filter((track) => track.curationStatus === 'provisional')
  const recommendationReady = active.filter(
    (track) =>
      track.curationStatus === 'reviewed' &&
      track.curationConfidence >= 0.75 &&
      track.semanticDescription.trim().length > 0,
  )
  const sourceIds = activeSources(catalog)
  const collectionIds = new Set(
    catalog.collections.collections.map((collection) => collection.id),
  )

  const missingLinks = active
    .filter(
      (track) =>
        !Object.values(track.officialLinks).some(Boolean) && !track.embed.url,
    )
    .map((track) => track.id)
  const missingProvenance = active
    .filter((track) => track.sourceIds.length === 0)
    .map((track) => track.id)

  if (active.length === 0) {
    add(problems, 'error', 'no-active-tracks', 'No active tracks are available.')
  }
  if (slug === 'siti' && active.length < 80) {
    add(
      problems,
      'error',
      'catalogue-below-launch-minimum',
      'The Siti catalogue has ' + active.length + ' active tracks; at least 80 are required.',
    )
  }
  if (slug === 'siti' && recommendationReady.length < 60) {
    add(
      problems,
      'error',
      'insufficient-reviewed-coverage',
      'Only ' +
        recommendationReady.length +
        ' tracks are recommendation-ready; at least 60 are required.',
    )
  }

  for (const id of missingLinks) {
    const track = tracks.find((candidate) => candidate.id === id)
    add(
      problems,
      track?.curationStatus === 'provisional' ? 'warning' : 'error',
      'missing-destination',
      id + ' has no official destination or approved embed.',
      [id],
    )
  }

  for (const track of active) {
    if (track.sourceIds.length === 0) {
      add(
        problems,
        track.curationStatus === 'provisional' ? 'warning' : 'error',
        'missing-provenance',
        track.id + ' has no sourceIds.',
        [track.id],
      )
    }
    for (const sourceId of track.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        add(
          problems,
          'error',
          'unknown-source',
          track.id + ' references unknown source ' + sourceId + '.',
          [track.id],
        )
      }
    }
    const verification = catalog.sources.trackVerification[track.id]
    if (!verification) {
      add(
        problems,
        track.curationStatus === 'provisional' ? 'warning' : 'error',
        'missing-verification-record',
        track.id + ' has no trackVerification entry.',
        [track.id],
      )
    }
    for (const collectionId of track.collections) {
      if (!collectionIds.has(collectionId)) {
        add(
          problems,
          'error',
          'unknown-collection',
          track.id + ' references unknown collection ' + collectionId + '.',
          [track.id],
        )
      }
    }
  }

  for (const [recording, duplicates] of inspectDuplicateGroups(
    active,
    primaryRecordingKey,
  )) {
    add(
      problems,
      'error',
      'duplicate-primary-recording',
      'Likely duplicate primary recording ' +
        recording +
        ': ' +
        duplicates.map((track) => track.id).join(', '),
      duplicates.map((track) => track.id),
    )
  }

  const providerEntries = new Map<string, string[]>()
  for (const track of active) {
    for (const { provider, url } of providerUrls(track)) {
      const key = provider + ':' + normaliseProviderUrl(url)
      providerEntries.set(key, [...(providerEntries.get(key) ?? []), track.id])
    }
  }
  for (const [url, ids] of providerEntries) {
    if (ids.length > 1) {
      add(
        problems,
        'error',
        'duplicate-provider-url',
        'Duplicate provider URL ' + url + ': ' + ids.join(', '),
        ids,
      )
    }
  }

  for (const [title, titleTracks] of inspectDuplicateGroups(active, (track) =>
    normaliseTitle(track.title),
  )) {
    if (new Set(titleTracks.map((track) => track.versionType)).size > 1) {
      add(
        problems,
        'warning',
        'multiple-title-versions',
        'Multiple intentional versions of ' +
          title +
          ': ' +
          titleTracks.map((track) => track.id).join(', '),
        titleTracks.map((track) => track.id),
      )
    }
  }

  for (const [vector, vectorTracks] of inspectDuplicateGroups(active, moodVectorKey)) {
    if (vectorTracks.length >= 4) {
      add(
        problems,
        'warning',
        'identical-mood-vectors',
        vectorTracks.length +
          ' tracks share mood vector ' +
          vector +
          ': ' +
          vectorTracks.map((track) => track.id).join(', '),
        vectorTracks.map((track) => track.id),
      )
    }
  }

  for (const [albumId, coverage] of Object.entries(
    catalog.sources.releaseCoverage,
  )) {
    const included = coverage.includedTrackIds.filter((id) =>
      active.some((track) => track.id === id),
    ).length
    if (included < coverage.expectedTrackCount) {
      add(
        problems,
        'warning',
        'partial-album-coverage',
        coverage.album +
          ' includes ' +
          included +
          ' of ' +
          coverage.expectedTrackCount +
          ' source tracks (' +
          albumId +
          ').',
      )
    }
  }

  const likelyNeverRanks = active
    .filter((track) => {
      const bestMoodFit = Math.max(
        ...catalog.moods.moods.map((mood) =>
          moodSimilarity(mood.target, track.moods),
        ),
      )
      return (
        track.curationStatus !== 'provisional' &&
        (bestMoodFit < 0.52 || track.curationConfidence < 0.45)
      )
    })
    .map((track) => track.id)
  for (const id of likelyNeverRanks) {
    add(
      problems,
      'warning',
      'unlikely-to-rank',
      id + ' has weak fit across all configured mood presets.',
      [id],
    )
  }

  const reviewedMoodCoverage = countBy(reviewed, (track) => primaryMoodFor(track))
  const coreMoods: MoodDimension[] = [
    'peaceful',
    'happy',
    'romantic',
    'confident',
    'energised',
    'nostalgic',
    'elegant',
    'comforted',
    'dramatic',
  ]
  for (const mood of coreMoods) {
    if ((reviewedMoodCoverage[mood] ?? 0) < 3) {
      add(
        problems,
        'warning',
        'weak-reviewed-mood-coverage',
        mood +
          ' has only ' +
          (reviewedMoodCoverage[mood] ?? 0) +
          ' reviewed primary-mood tracks.',
      )
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    slug,
    totals: {
      unique: tracks.length,
      active: active.length,
      recommendationReady: recommendationReady.length,
      reviewed: reviewed.length,
      verifiedMetadata: verifiedMetadata.length,
      provisional: provisional.length,
      albums: new Set(active.map((track) => track.album).filter(Boolean)).size,
    },
    byEra: countBy(active, (track) => track.era),
    byAlbum: countBy(active, (track) => track.album),
    byVersionType: countBy(active, (track) => track.versionType),
    byCollection: countBy(
      active.flatMap((track) =>
        track.collections.map((collection) => ({ collection })),
      ),
      (entry) => entry.collection,
    ),
    byPrimaryMood: countBy(active, (track) => primaryMoodFor(track)),
    missingLinks,
    missingProvenance,
    likelyNeverRanks,
    remoteLinkWarnings: [],
    problems,
  }
}

const printCounts = (heading: string, counts: Record<string, number>) => {
  console.log('\n' + heading)
  for (const [label, count] of sortedCounts(counts)) {
    console.log('  ' + label + ': ' + count)
  }
}

const checkRemoteLinks = async (tracks: Track[]) => {
  const failures: string[] = []
  const destinations = tracks.flatMap((track) =>
    providerUrls(track).map(({ provider, url }) => ({ track, provider, url })),
  )
  const check = async ({ track, provider, url }: (typeof destinations)[number]) => {
    try {
      let response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      })
      if (response.status === 403 || response.status === 405) {
        response = await fetch(url, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          redirect: 'follow',
          signal: AbortSignal.timeout(12_000),
        })
      }
      if (response.status >= 400) {
        failures.push(track.id + '.' + provider + ': HTTP ' + response.status)
      }
    } catch (error) {
      failures.push(
        track.id +
          '.' +
          provider +
          ': ' +
          (error instanceof Error ? error.message : 'request failed'),
      )
    }
  }
  for (let index = 0; index < destinations.length; index += 8) {
    await Promise.all(destinations.slice(index, index + 8).map(check))
  }
  return failures
}

const main = async () => {
  const slug = argumentValue('--slug') ?? 'siti'
  const catalog = loadCatalog(slug)
  const report = auditCatalog(slug, catalog)

  console.log('Pink FM catalogue audit: ' + slug)
  Object.entries(report.totals).forEach(([label, value]) =>
    console.log(label + ': ' + value),
  )
  printCounts('Eras', report.byEra)
  printCounts('Albums', report.byAlbum)
  printCounts('Version types', report.byVersionType)
  printCounts('Collections', report.byCollection)
  printCounts('Primary moods', report.byPrimaryMood)

  report.problems.forEach((problem) => {
    const prefix = problem.level === 'error' ? 'ERROR' : 'WARN '
    console.log(prefix + ' [' + problem.code + '] ' + problem.message)
  })

  if (hasArgument('--check-links')) {
    const failures = await checkRemoteLinks(catalog.tracks.tracks)
    report.remoteLinkWarnings = failures
    failures.forEach((failure) =>
      console.log('WARN  [remote-link-check] ' + failure),
    )
    console.log('Remote link warnings: ' + failures.length)
  }

  const output = argumentValue('--json')
  if (output) {
    const outputPath = resolve(process.cwd(), output)
    writeJsonFile(outputPath, report)
    console.log('Wrote JSON report: ' + outputPath)
  }

  const errors = report.problems.filter((problem) => problem.level === 'error')
  const warnings = report.problems.length - errors.length
  console.log(
    '\nCatalogue audit finished: ' +
      errors.length +
      ' error(s), ' +
      warnings +
      ' warning(s).',
  )
  if (errors.length > 0) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
