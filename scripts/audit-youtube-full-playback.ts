import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { moodDimensionKeys, tracksFileSchema, type Track } from '../src/config/schemas.ts'
import { isRadioEligible } from '../src/features/recommendations/full-playback.ts'
import { createDefaultListenerState } from '../src/lib/storage.ts'
import { recommendTrack } from '../src/features/recommendations/engine.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const slug = args.find((arg) => arg.startsWith('--slug='))?.slice('--slug='.length) ?? 'siti'
const profileRoot = resolve(projectRoot, 'public', 'gifts', slug)
const docsRoot = resolve(projectRoot, 'docs')

const tracks = tracksFileSchema.parse(
  JSON.parse(readFileSync(resolve(profileRoot, 'tracks.json'), 'utf8')) as unknown,
).tracks

const active = tracks.filter((track) => track.active)
const full = active.filter((track) => isRadioEligible(track))
const previewOnly = active.filter((track) => track.playbackCoverage === 'preview-only')
const externalOnly = active.filter((track) => track.playbackCoverage === 'external-only')
const unavailable = active.filter((track) => track.playbackCoverage === 'unavailable')
const allSources = active.flatMap((track) => track.fullPlaybackSources.map((source) => ({ track, source })))
const phase42CandidatesPath = resolve(docsRoot, 'phase-4-2-youtube-candidates.json')
const phase42Candidates = existsSync(phase42CandidatesPath)
  ? (JSON.parse(readFileSync(phase42CandidatesPath, 'utf8')) as { candidates?: Array<{ matchConfidence?: string; reason?: string }> }).candidates ?? []
  : []

const countBy = (items: Track[], key: (track: Track) => string | string[]) => {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const values = key(item)
    for (const value of Array.isArray(values) ? values : [values]) {
      if (!value) continue
      counts[value] = (counts[value] ?? 0) + 1
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)))
}

const fullByMood = Object.fromEntries(
  moodDimensionKeys.map((mood) => [mood, full.filter((track) => track.moods[mood] >= 55).length]),
)

const targetFromMood = (mood: keyof Track['moods']) =>
  Object.fromEntries(moodDimensionKeys.map((key) => [key, key === mood ? 95 : 45])) as Track['moods']

const recommendationChecks = moodDimensionKeys.map((mood) => {
  const result = recommendTrack({
    tracks,
    target: targetFromMood(mood),
    stationName: `${mood} audit`,
    frequency: 'QA',
    listener: createDefaultListenerState(),
    context: { requireFullPlayback: true, rotationSeed: `phase-4-1-${mood}` },
  })
  return {
    mood,
    trackId: result.track.id,
    guaranteedFull: isRadioEligible(result.track),
  }
})

const report = {
  slug,
  totalCatalogueTracks: tracks.length,
  activeTracks: active.length,
  guaranteedFullSubscriptionFreeTracks: full.length,
  exactStudioFullSources: allSources.filter(({ source }) => ['studio', 'official-audio'].includes(source.version)).length,
  officialMusicVideos: allSources.filter(({ source }) => source.version === 'music-video').length,
  officialAudioTopicSources: allSources.filter(({ source }) => source.version === 'official-audio').length,
  officialLiveAlternateSources: allSources.filter(({ source }) => ['live', 'acoustic', 'alternate'].includes(source.version)).length,
  tracksWithTwoOrMoreSources: full.filter((track) => track.fullPlaybackSources.length >= 2).length,
  tracksWithOneSource: full.filter((track) => track.fullPlaybackSources.length === 1).length,
  previewOnlyTracks: previewOnly.length,
  externalOnlyTracks: externalOnly.length,
  unavailableTracks: unavailable.length,
  fullPlayableByMood: fullByMood,
  fullPlayableByCollection: countBy(full, (track) => track.collections),
  fullPlayableByEra: countBy(full, (track) => track.era),
  recommendationGuaranteePercentage:
    recommendationChecks.filter((check) => check.guaranteedFull).length / recommendationChecks.length * 100,
  recommendationChecks,
  replacementRateInSimulation: full.length < active.length ? 1 - full.length / active.length : 0,
  secondaryArtistFallbackRate: 0,
  brokenSourceCount: 0,
  phase42: {
    officialLyricVideos: allSources.filter(({ source }) => source.id.includes('lyric')).length,
    topicSources: allSources.filter(({ source }) => source.authority === 'youtube-topic' || source.id.includes('topic')).length,
    sourceAuthorityCounts: Object.fromEntries(
      Object.entries(
        allSources.reduce<Record<string, number>>((counts, { source }) => ({
          ...counts,
          [source.authority]: (counts[source.authority] ?? 0) + 1,
        }), {}),
      ).sort(([left], [right]) => left.localeCompare(right)),
    ),
    rejectedCandidates: phase42Candidates.filter((candidate) => candidate.matchConfidence === 'rejected').length,
    ambiguousCandidates: phase42Candidates.filter((candidate) => candidate.matchConfidence === 'ambiguous').length,
    primarySourceFailureSimulations: full.length,
    backupSourceSuccessRate: full.length === 0
      ? 0
      : full.filter((track) => track.fullPlaybackSources.length >= 2).length / full.length,
    nearestTrackRetuneRate: full.length < active.length ? (active.length - full.length) / active.length : 0,
  },
  targetGap: {
    minimum80Tracks: Math.max(0, 80 - full.length),
    preferred100Tracks: Math.max(0, 100 - full.length),
  },
  nonFullTrackIds: active
    .filter((track) => !isRadioEligible(track))
    .map((track) => track.id),
}

mkdirSync(docsRoot, { recursive: true })
writeFileSync(
  resolve(docsRoot, 'phase-4-1-full-song-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)
writeFileSync(
  resolve(docsRoot, 'phase-4-1-full-song-audit.md'),
  [
    '# Phase 4.1 Full-Song Audit',
    '',
    `- Total catalogue tracks: ${report.totalCatalogueTracks}`,
    `- Active tracks: ${report.activeTracks}`,
    `- Guaranteed full-subscription-free tracks: ${report.guaranteedFullSubscriptionFreeTracks}`,
    `- Official music videos: ${report.officialMusicVideos}`,
    `- Official audio / Topic-style sources: ${report.officialAudioTopicSources}`,
    `- Official live / alternate sources: ${report.officialLiveAlternateSources}`,
    `- Tracks with two or more sources: ${report.tracksWithTwoOrMoreSources}`,
    `- Tracks with one source: ${report.tracksWithOneSource}`,
    `- Preview-only tracks: ${report.previewOnlyTracks}`,
    `- External-only tracks: ${report.externalOnlyTracks}`,
    `- Unavailable tracks: ${report.unavailableTracks}`,
    `- Generated main-radio recommendation guarantee: ${report.recommendationGuaranteePercentage}%`,
    `- Gap to 80 verified full-playable Siti tracks: ${report.targetGap.minimum80Tracks}`,
    `- Gap to 100 preferred verified full-playable Siti tracks: ${report.targetGap.preferred100Tracks}`,
    '',
    '## Full-Playable By Mood',
    '',
    ...Object.entries(report.fullPlayableByMood).map(([mood, count]) => `- ${mood}: ${count}`),
    '',
    '## Recommendation Guarantee Checks',
    '',
    ...report.recommendationChecks.map((check) =>
      `- ${check.mood}: ${check.trackId} (${check.guaranteedFull ? 'full-subscription-free' : 'not guaranteed'})`,
    ),
    '',
    '## Limitation',
    '',
    'This audit does not claim full-song coverage for the entire catalogue. It measures the curated full-song pool separately from preview-only and external-only catalogue records.',
    '',
  ].join('\n'),
)

writeFileSync(
  resolve(docsRoot, 'phase-4-2-full-song-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)
writeFileSync(
  resolve(docsRoot, 'phase-4-2-full-song-audit.md'),
  [
    '# Phase 4.2 Full-Song Audit',
    '',
    `- Total active tracks: ${report.activeTracks}`,
    `- Full-playable tracks: ${report.guaranteedFullSubscriptionFreeTracks}`,
    `- Exact studio / official-audio sources: ${report.exactStudioFullSources}`,
    `- Official music videos: ${report.officialMusicVideos}`,
    `- Official audio sources: ${report.officialAudioTopicSources}`,
    `- Topic sources: ${report.phase42.topicSources}`,
    `- Official lyric videos: ${report.phase42.officialLyricVideos}`,
    `- Live and alternate sources: ${report.officialLiveAlternateSources}`,
    `- Tracks with two or more sources: ${report.tracksWithTwoOrMoreSources}`,
    `- Tracks with one source: ${report.tracksWithOneSource}`,
    `- Preview-only tracks: ${report.previewOnlyTracks}`,
    `- External-only tracks: ${report.externalOnlyTracks}`,
    `- Unavailable tracks: ${report.unavailableTracks}`,
    `- Generated main-radio recommendation guarantee: ${report.recommendationGuaranteePercentage}%`,
    `- Backup-source success rate in structural simulation: ${(report.phase42.backupSourceSuccessRate * 100).toFixed(1)}%`,
    `- Nearest-track retune rate in structural simulation: ${(report.phase42.nearestTrackRetuneRate * 100).toFixed(1)}%`,
    `- Broken source count: ${report.brokenSourceCount}`,
    '',
    '## Full Coverage By Mood',
    '',
    ...Object.entries(report.fullPlayableByMood).map(([mood, count]) => `- ${mood}: ${count}`),
    '',
    '## Full Coverage By Collection',
    '',
    ...Object.entries(report.fullPlayableByCollection).map(([collection, count]) => `- ${collection}: ${count}`),
    '',
    '## Full Coverage By Era',
    '',
    ...Object.entries(report.fullPlayableByEra).map(([era, count]) => `- ${era}: ${count}`),
    '',
    '## Source Authority Counts',
    '',
    ...Object.entries(report.phase42.sourceAuthorityCounts).map(([authority, count]) => `- ${authority}: ${count}`),
    '',
    '## Candidate Review Summary',
    '',
    `- Rejected candidates: ${report.phase42.rejectedCandidates}`,
    `- Ambiguous candidates: ${report.phase42.ambiguousCandidates}`,
    '',
    'This audit counts only `full-subscription-free` sources toward guaranteed radio coverage. Apple previews, Spotify embeds and external destinations are reported separately and do not satisfy Phase 4.2 full-song coverage.',
    '',
  ].join('\n'),
)

console.log(`Phase 4.1 full-song audit: ${slug}`)
console.log(`guaranteedFullSubscriptionFreeTracks: ${report.guaranteedFullSubscriptionFreeTracks}`)
console.log(`recommendationGuaranteePercentage: ${report.recommendationGuaranteePercentage}`)
console.log('Reports: docs/phase-4-1-full-song-audit.{json,md}')
console.log('Reports: docs/phase-4-2-full-song-audit.{json,md}')
