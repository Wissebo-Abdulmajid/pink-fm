import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { loadCatalog, writeJsonFile } from './catalog-shared.ts'
import { moodDimensionKeys, type MoodDimension, type Track } from '../src/config/schemas.ts'
import { parseSpotifyUrl } from '../src/features/player/providers/spotify/spotify-url.ts'
import { appleMusicEmbedUrl } from '../src/features/player/providers/apple/apple-url.ts'
import { isYouTubeVideoId } from '../src/features/player/providers/youtube/youtube-url.ts'

const args = process.argv.slice(2)
const slugIndex = args.indexOf('--slug')
const slug = slugIndex >= 0 ? args[slugIndex + 1] ?? 'siti' : 'siti'
const catalog = loadCatalog(slug)
const active = catalog.tracks.tracks.filter((track) => track.active)

const spotifyKind = (track: Track) => track.officialLinks.spotify
  ? parseSpotifyUrl(track.officialLinks.spotify).entityType
  : 'missing'
const spotifyPlayable = (track: Track) => spotifyKind(track) === 'track'
const youtubePlayable = (track: Track) => Boolean(
  track.playback.youtube?.verifiedOfficial &&
  track.playback.youtube.sourceId &&
  isYouTubeVideoId(track.playback.youtube.videoId) &&
  catalog.sources.sources.some((source) => source.id === track.playback.youtube?.sourceId),
)
const applePlayable = (track: Track) => Boolean(
  appleMusicEmbedUrl(track.playback.appleMusic?.url || track.officialLinks.appleMusic),
)
const inSite = (track: Track) => spotifyPlayable(track) || youtubePlayable(track) || applePlayable(track)
const anyDestination = (track: Track) => Object.values(track.officialLinks).some(Boolean)
const percent = (part: number, total: number) => total ? Number(((part / total) * 100).toFixed(1)) : 0

const coverage = (tracks: Track[]) => ({
  total: tracks.length,
  inSitePlayable: tracks.filter(inSite).length,
  percentage: percent(tracks.filter(inSite).length, tracks.length),
})
const groupCoverage = (keyFor: (track: Track) => string[]) => {
  const groups = new Map<string, Track[]>()
  active.forEach((track) => keyFor(track).forEach((key) => groups.set(key, [...(groups.get(key) ?? []), track])))
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, tracks]) => [key, coverage(tracks)]))
}

const reviewed = active.filter((track) => track.curationStatus === 'reviewed')
const recommendationMoodCoverage = Object.fromEntries(moodDimensionKeys.map((mood: MoodDimension) => {
  const candidates = reviewed.filter((track) => track.moods[mood] >= 60)
  return [mood, coverage(candidates)]
}))
const essentials = active.filter((track) => track.collections.includes('siti-essentials'))
const invalidSpotify = active.filter((track) => track.officialLinks.spotify && spotifyKind(track) === 'invalid')
const albumOnly = active.filter((track) => spotifyKind(track) === 'album')
const directSpotify = active.filter(spotifyPlayable)
const verifiedYouTube = active.filter(youtubePlayable)
const applePreview = active.filter(applePlayable)
const externalOnly = active.filter((track) => !inSite(track) && anyDestination(track))
const noDestination = active.filter((track) => !anyDestination(track))
const reviewedPlayable = reviewed.filter(inSite)

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  profile: slug,
  totals: {
    activeTracks: active.length,
    reviewedTracks: reviewed.length,
    directSpotifyTrackUrls: directSpotify.length,
    spotifyAlbumOnlyUrls: albumOnly.length,
    invalidSpotifyUrls: invalidSpotify.length,
    spotifyEmbedPlayableTracks: directSpotify.length,
    verifiedYouTubePlayableTracks: verifiedYouTube.length,
    applePreviewTracks: applePreview.length,
    externalOnlyTracks: externalOnly.length,
    tracksWithoutDestination: noDestination.length,
    inSitePlayableTracks: active.filter(inSite).length,
    inSitePlaybackPercentage: percent(active.filter(inSite).length, active.length),
    reviewedRecommendationReadyPercentage: percent(reviewedPlayable.length, reviewed.length),
    sitiEssentialsPercentage: percent(essentials.filter(inSite).length, essentials.length),
  },
  targets: {
    reviewedRecommendationReady80Percent: percent(reviewedPlayable.length, reviewed.length) >= 80,
    sitiEssentials90Percent: percent(essentials.filter(inSite).length, essentials.length) >= 90,
    twelvePlayableReviewedPerMood: Object.fromEntries(Object.entries(recommendationMoodCoverage).map(([mood, value]) => [mood, value.inSitePlayable >= 12])),
  },
  coverageByMood: recommendationMoodCoverage,
  coverageByCollection: groupCoverage((track) => track.collections),
  coverageByEra: groupCoverage((track) => [track.era || 'unknown']),
  coverageByRecommendationReadiness: {
    reviewed: coverage(reviewed),
    metadataVerified: coverage(active.filter((track) => track.curationStatus === 'verified-metadata')),
    provisional: coverage(active.filter((track) => track.curationStatus === 'provisional')),
  },
  gaps: {
    spotifyAlbumOnly: albumOnly.map((track) => ({ id: track.id, title: track.title, url: track.officialLinks.spotify })),
    invalidSpotify: invalidSpotify.map((track) => ({ id: track.id, title: track.title, url: track.officialLinks.spotify })),
    externalOnly: externalOnly.map((track) => ({ id: track.id, title: track.title })),
    withoutDestination: noDestination.map((track) => ({ id: track.id, title: track.title })),
    mostFrequentlyRecommendedWithoutInSitePlayback: [],
  },
}

writeJsonFile(resolve(process.cwd(), 'docs', 'phase-4-playback-audit.json'), report)
const rows = Object.entries(report.totals).map(([label, value]) => `| ${label} | ${value} |`).join('\n')
const moods = Object.entries(report.coverageByMood).map(([mood, value]) => `| ${mood} | ${value.inSitePlayable}/${value.total} | ${value.percentage}% | ${value.inSitePlayable >= 12 ? 'pass' : 'gap'} |`).join('\n')
writeFileSync(resolve(process.cwd(), 'docs', 'phase-4-playback-audit.md'),
  `# Phase 4 playback audit\n\nGenerated ${report.generatedAt}. Apple figures are preview-capable embeds, not universal full-track claims.\n\n` +
  `## Totals\n\n| Measure | Value |\n| --- | ---: |\n${rows}\n\n` +
  `## Reviewed coverage by mood\n\n| Mood | In site / eligible | Coverage | 12-track target |\n| --- | ---: | ---: | --- |\n${moods}\n\n` +
  `## Known Spotify gaps\n\n${report.gaps.spotifyAlbumOnly.map((item) => `- \`${item.id}\`: album link requires independently reviewed direct-track replacement`).join('\n') || '- None'}\n\n` +
  `No URLs were fabricated by this audit. Provider availability still varies by account, browser, region, cookies and blockers.\n`,
  'utf8')

console.log(`Pink FM playback audit: ${slug}`)
Object.entries(report.totals).forEach(([label, value]) => console.log(`${label}: ${value}`))
console.log('Reports: docs/phase-4-playback-audit.{json,md}')
