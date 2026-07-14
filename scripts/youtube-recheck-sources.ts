import { loadAuthorities, loadTracksFile, parseSlug } from './youtube-acquisition-tools.ts'

const slug = parseSlug()
const tracks = loadTracksFile(slug).tracks.filter((track) => track.active)
const authorities = loadAuthorities(slug).filter((authority) => authority.active)
const trustedChannels = new Set(authorities.map((authority) => authority.channelId))
const problems: string[] = []
const sourceVideoIds = new Set<string>()

for (const track of tracks) {
  const sourceIds = new Set<string>()
  for (const source of track.fullPlaybackSources) {
    if (!trustedChannels.has(source.channelId)) {
      problems.push(`${track.id}/${source.id}: channel is not trusted: ${source.channelId}`)
    }
    if (sourceIds.has(source.id)) problems.push(`${track.id}/${source.id}: duplicate source id`)
    sourceIds.add(source.id)
    if (sourceVideoIds.has(`${track.id}:${source.videoId}`)) {
      problems.push(`${track.id}/${source.id}: duplicate video id on same track`)
    }
    sourceVideoIds.add(`${track.id}:${source.videoId}`)
    if (source.fullLength && (source.durationSeconds ?? 0) < 120) {
      problems.push(`${track.id}/${source.id}: duration is not sufficient for full-song evidence`)
    }
    if (source.priority === 1 && !source.embeddable) {
      problems.push(`${track.id}/${source.id}: primary source is not embeddable`)
    }
  }
}

if (process.env.YOUTUBE_DATA_API_KEY) {
  console.log('YOUTUBE_DATA_API_KEY is present; use youtube:discover to refresh live channel/video status before applying new records.')
} else {
  console.log('YOUTUBE_DATA_API_KEY is not set; live source recheck skipped.')
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`ERROR ${problem}`)
  process.exitCode = 1
} else {
  console.log(`YouTube source recheck passed for ${slug}: ${tracks.length} active tracks inspected.`)
}
