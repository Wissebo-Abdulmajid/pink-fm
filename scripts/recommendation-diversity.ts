import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  giftSchema,
  moodDimensionKeys,
  type MoodDimension,
  type MoodVector,
  type Track,
} from '../src/config/schemas.ts'
import {
  rankCandidates,
  recommendTrack,
  weightedMoodSimilarity,
  type RecommendationContext,
} from '../src/features/recommendations/engine.ts'
import { createDefaultListenerState, type ListenerState } from '../src/lib/storage.ts'
import { loadCatalog, projectRoot, readJsonFile } from './catalog-shared.ts'

type ScenarioName =
  | 'clean'
  | 'favourites'
  | 'heavy-recent'
  | 'era-preference'
  | 'familiar'
  | 'discovery'
  | 'time-of-day'

type Selection = {
  scenario: ScenarioName
  iteration: number
  track: Track
  target: MoodVector
  matchPercentage: number
  moodSimilarity: number
  immediateRepeat: boolean
  unsuitable: boolean
}

const slugIndex = process.argv.indexOf('--slug')
const slug = slugIndex >= 0 ? process.argv[slugIndex + 1] ?? 'siti' : 'siti'
const iterationsIndex = process.argv.indexOf('--iterations')
const iterations = iterationsIndex >= 0 ? Number(process.argv[iterationsIndex + 1]) : 50
if (!Number.isInteger(iterations) || iterations < 50 || iterations > 500) {
  throw new Error('--iterations must be an integer from 50 to 500.')
}

const catalogue = loadCatalog(slug)
const gift = giftSchema.parse(readJsonFile(resolve(catalogue.profilePath, 'gift.json')))
const tracks = catalogue.tracks.tracks
const moods = catalogue.moods.moods.filter((mood) => !mood.surprise)
const eras = [...new Set(tracks.map((track) => track.era).filter(Boolean))].sort()
const timeValues = ['morning', 'daytime', 'evening', 'night'] as const
const scenarios: ScenarioName[] = [
  'clean',
  'favourites',
  'heavy-recent',
  'era-preference',
  'familiar',
  'discovery',
  'time-of-day',
]
const now = Date.UTC(2026, 6, 13, 12, 0, 0)

const stableNumber = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const variedTarget = (base: MoodVector, moodId: string, iteration: number): MoodVector =>
  Object.fromEntries(moodDimensionKeys.map((dimension, dimensionIndex) => {
    const seed = stableNumber(`${moodId}:${iteration}:${dimensionIndex}`)
    const variation = (seed % 17) - 8
    const scale = base[dimension] >= 75 ? 0.65 : 1
    return [dimension, Math.max(0, Math.min(100, Math.round(base[dimension] + variation * scale)))]
  })) as MoodVector

const baseContext = (): RecommendationContext => ({
  artistPolicy: gift.artistPolicy,
  now,
})

const topForMood = (target: MoodVector) => rankCandidates({
  tracks,
  target,
  stationName: 'Simulation',
  frequency: 'SIM',
  listener: createDefaultListenerState(gift.defaultStreamingService),
  context: baseContext(),
}).slice(0, 24).map((item) => item.track)

const scenarioState = (
  scenario: ScenarioName,
  iteration: number,
  target: MoodVector,
  topTracks: Track[],
): { listener: ListenerState; context: RecommendationContext } => {
  const listener = createDefaultListenerState(gift.defaultStreamingService)
  const context = baseContext()
  context.rotationSeed = `phase-3-${scenario}-${iteration}`
  if (scenario === 'clean') {
    context.timeOfDay = timeValues[iteration % timeValues.length] ?? 'daytime'
  }
  if (scenario === 'favourites') {
    const favourite = topTracks[(iteration * 7 + 3) % Math.max(1, topTracks.length)]
    if (favourite) {
      listener.lovedTrackIds = [favourite.id]
      listener.moreLikeTrackIds = { [favourite.id]: 2 }
    }
  }
  if (scenario === 'heavy-recent') {
    const rotated = [...topTracks.slice(0, 12)]
    const offset = iteration % Math.max(1, rotated.length)
    const recent = [...rotated.slice(offset), ...rotated.slice(0, offset)]
    listener.history = recent.map((track, index) => ({
      trackId: track.id,
      timestamp: now - index * 4 * 60 * 60 * 1000,
      moodId: 'simulation',
      stationName: 'Simulation',
      target,
    }))
    listener.playCounts = Object.fromEntries(recent.map((track, index) => [track.id, 8 - Math.min(7, index)]))
  }
  if (scenario === 'era-preference') {
    const era = eras[iteration % Math.max(1, eras.length)]
    if (era) {
      listener.preferredEras = { [era]: 6 }
      context.preferredEras = [era]
    }
  }
  if (scenario === 'familiar') {
    context.noveltyPreference = 'familiar'
  }
  if (scenario === 'discovery') {
    context.noveltyPreference = 'novel'
    context.surprise = true
    context.deepCut = true
  }
  if (scenario === 'time-of-day') {
    context.timeOfDay = timeValues[iteration % timeValues.length] ?? 'daytime'
  }
  return { listener, context }
}

const concentration = (values: string[]) => {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  const ranked = [...counts.entries()].sort((left, right) =>
    right[1] - left[1] || left[0].localeCompare(right[0]),
  )
  return {
    unique: ranked.length,
    top: ranked[0] ? { id: ranked[0][0], count: ranked[0][1], share: ranked[0][1] / values.length } : null,
    topFiveShare: ranked.slice(0, 5).reduce((sum, entry) => sum + entry[1], 0) / Math.max(1, values.length),
    ranked: ranked.map(([id, count]) => ({ id, count, share: count / values.length })),
  }
}

const moodReports = moods.map((mood) => {
  const selections: Selection[] = []
  const topTracks = topForMood(mood.target)
  for (const scenario of scenarios) {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const target = variedTarget(mood.target, `${mood.id}:${scenario}`, iteration)
      const { listener, context } = scenarioState(scenario, iteration, target, topTracks)
      const result = recommendTrack({
        tracks,
        target,
        stationName: mood.stationName,
        frequency: mood.frequency,
        listener,
        context,
      })
      const similarity = weightedMoodSimilarity(target, result.track.moods)
      selections.push({
        scenario,
        iteration,
        track: result.track,
        target,
        matchPercentage: result.matchPercentage,
        moodSimilarity: similarity,
        immediateRepeat: listener.history[0]?.trackId === result.track.id,
        unsuitable: result.track.moods[mood.id as MoodDimension] < 40 || similarity < 0.58,
      })
    }
  }
  const allTracks = concentration(selections.map((selection) => selection.track.id))
  const clean = selections.filter((selection) => selection.scenario === 'clean')
  const cleanTracks = concentration(clean.map((selection) => selection.track.id))
  const albums = concentration(selections.map((selection) => selection.track.albumId || selection.track.album))
  const cleanAlbums = concentration(clean.map((selection) => selection.track.albumId || selection.track.album))
  const eraConcentration = concentration(selections.map((selection) => selection.track.era))
  const credible = new Set(selections
    .filter((selection) =>
      selection.track.curationStatus === 'reviewed' &&
      selection.track.moods[mood.id as MoodDimension] >= 50 &&
      !selection.unsuitable,
    )
    .map((selection) => selection.track.id))
  const reviewed = selections.filter((selection) => selection.track.curationStatus === 'reviewed').length
  const warnings = [
    ...(credible.size < 12 ? [`Only ${credible.size} credible reviewed tracks surfaced (target: 12).`] : []),
    ...(cleanTracks.top && cleanTracks.top.share > 0.15
      ? [`Clean-profile top track concentration is ${(cleanTracks.top.share * 100).toFixed(1)}% (target: <=15%).`]
      : []),
    ...(cleanAlbums.top && cleanAlbums.top.share > 0.3
      ? [`Clean-profile top album concentration is ${(cleanAlbums.top.share * 100).toFixed(1)}% (target: <=30%).`]
      : []),
    ...(selections.some((selection) => selection.immediateRepeat)
      ? ['An immediate repeat occurred despite catalogue alternatives.']
      : []),
    ...(selections.some((selection) => selection.unsuitable)
      ? [`${selections.filter((selection) => selection.unsuitable).length} unsuitable selections were detected.`]
      : []),
  ]
  return {
    moodId: mood.id,
    label: mood.label,
    simulations: selections.length,
    scenarios: Object.fromEntries(scenarios.map((scenario) => {
      const selected = selections.filter((selection) => selection.scenario === scenario)
      return [scenario, {
        simulations: selected.length,
        uniqueTracks: new Set(selected.map((selection) => selection.track.id)).size,
        topTrackShare: concentration(selected.map((selection) => selection.track.id)).top?.share ?? 0,
      }]
    })),
    uniqueTracks: allTracks.unique,
    credibleReviewedUniqueTracks: credible.size,
    topTrack: allTracks.top,
    topFiveConcentration: allTracks.topFiveShare,
    cleanTopTrack: cleanTracks.top,
    cleanTopFiveConcentration: cleanTracks.topFiveShare,
    topAlbum: albums.top,
    cleanTopAlbum: cleanAlbums.top,
    topEra: eraConcentration.top,
    immediateRepeats: selections.filter((selection) => selection.immediateRepeat).length,
    unsuitableResults: selections.filter((selection) => selection.unsuitable).length,
    unsuitableExamples: selections
      .filter((selection) => selection.unsuitable)
      .slice(0, 10)
      .map((selection) => ({
        scenario: selection.scenario,
        iteration: selection.iteration,
        trackId: selection.track.id,
        title: selection.track.title,
        primaryMoodValue: selection.track.moods[mood.id as MoodDimension],
        moodSimilarity: selection.moodSimilarity,
        matchPercentage: selection.matchPercentage,
      })),
    curationDistribution: {
      reviewed,
      verifiedMetadata: selections.length - reviewed,
      reviewedShare: reviewed / selections.length,
    },
    meanMoodSimilarity: selections.reduce((sum, selection) => sum + selection.moodSimilarity, 0) / selections.length,
    warnings,
  }
})

const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  profile: slug,
  method: {
    simulationsPerScenario: iterations,
    scenarios,
    targetVariation: 'Deterministic +/-8-point multidimensional variation around each configured preset.',
    dailyRotation: 'A deterministic scenario seed models different calendar days; the same request remains stable within a day.',
    unsuitableDefinition: 'Primary mood annotation below 40 or weighted mood similarity below 0.58.',
    immediateRepeatDefinition: 'Selected track equals the most recent track supplied in simulated history.',
  },
  totals: {
    moods: moodReports.length,
    simulations: moodReports.reduce((sum, mood) => sum + mood.simulations, 0),
    warnings: moodReports.reduce((sum, mood) => sum + mood.warnings.length, 0),
    immediateRepeats: moodReports.reduce((sum, mood) => sum + mood.immediateRepeats, 0),
    unsuitableResults: moodReports.reduce((sum, mood) => sum + mood.unsuitableResults, 0),
  },
  moods: moodReports,
}
writeFileSync(
  resolve(projectRoot, 'docs', 'phase-3-recommendation-diversity.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)
const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const markdown = [
  '# Phase 3 recommendation diversity simulation',
  '',
  `Generated: ${report.createdAt}`,
  '',
  `${report.totals.simulations.toLocaleString()} deterministic simulations across ${report.totals.moods} listener-facing moods and seven scenario families.`,
  '',
  '| Mood | Unique | Credible reviewed | Clean top track | Clean top album | Repeats | Unsuitable | Reviewed |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...moodReports.map((mood) => `| ${mood.label} | ${mood.uniqueTracks} | ${mood.credibleReviewedUniqueTracks} | ${percent(mood.cleanTopTrack?.share ?? 0)} | ${percent(mood.cleanTopAlbum?.share ?? 0)} | ${mood.immediateRepeats} | ${mood.unsuitableResults} | ${percent(mood.curationDistribution.reviewedShare)} |`),
  '',
  '## Warnings',
  '',
  ...moodReports.flatMap((mood) => mood.warnings.map((warning) => `- **${mood.label}:** ${warning}`)),
  ...(moodReports.every((mood) => mood.warnings.length === 0) ? ['- None.'] : []),
  '',
].join('\n')
writeFileSync(resolve(projectRoot, 'docs', 'phase-3-recommendation-diversity.md'), markdown)
console.log(`Recommendation simulations: ${report.totals.simulations}`)
console.log(`Immediate repeats: ${report.totals.immediateRepeats}`)
console.log(`Unsuitable results: ${report.totals.unsuitableResults}`)
console.log(`Quality warnings: ${report.totals.warnings}`)
console.log('Report: docs/phase-3-recommendation-diversity.json')
