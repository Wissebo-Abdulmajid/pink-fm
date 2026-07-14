import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  tracksFileSchema,
  youtubeAuthoritiesFileSchema,
  type FullPlaybackSource,
} from '../src/config/schemas.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const slug = process.argv.find((arg) => arg.startsWith('--slug='))?.slice('--slug='.length) ?? 'siti'
const profileRoot = resolve(projectRoot, 'public', 'gifts', slug)
const tracks = tracksFileSchema.parse(
  JSON.parse(readFileSync(resolve(profileRoot, 'tracks.json'), 'utf8')) as unknown,
).tracks
const authorities = youtubeAuthoritiesFileSchema.parse(
  JSON.parse(readFileSync(resolve(profileRoot, 'youtube-authorities.json'), 'utf8')) as unknown,
)

const activeChannels = new Set(
  authorities.channels.filter((channel) => channel.active).map((channel) => channel.channelId),
)
const problems: string[] = []
const primaryVideoIds = new Map<string, string>()

const videoIdFromUrl = (source: FullPlaybackSource) => {
  const url = new URL(source.sourceUrl)
  return url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v')
}

for (const track of tracks) {
  const primarySources = track.fullPlaybackSources.filter((source) => source.priority === 1)
  if (primarySources.length > 1) problems.push(`${track.id}: more than one primary source`)
  for (const source of track.fullPlaybackSources) {
    if (!activeChannels.has(source.channelId)) {
      problems.push(`${track.id}/${source.id}: channel ${source.channelId} is not in the trusted registry`)
    }
    if (videoIdFromUrl(source) !== source.videoId) {
      problems.push(`${track.id}/${source.id}: sourceUrl video id does not match videoId`)
    }
    if (source.sourceUrl.includes('/shorts/')) {
      problems.push(`${track.id}/${source.id}: Shorts are not allowed`)
    }
    if (!source.provenanceSourceId) {
      problems.push(`${track.id}/${source.id}: missing provenanceSourceId`)
    }
    if (source.fullLength && (source.durationSeconds ?? 0) < 120) {
      problems.push(`${track.id}/${source.id}: duration evidence is too short for full-song playback`)
    }
    if (source.verified && source.fullLength && !source.embeddable) {
      problems.push(`${track.id}/${source.id}: verified full source is not embeddable`)
    }
    if (source.priority === 1) {
      const previous = primaryVideoIds.get(source.videoId)
      if (previous) problems.push(`${track.id}/${source.id}: primary video is already used by ${previous}`)
      primaryVideoIds.set(source.videoId, track.id)
    }
  }
  if (track.playbackCoverage === 'full-subscription-free') {
    const usable = track.fullPlaybackSources.some(
      (source) => source.verified && source.embeddable && source.fullLength,
    )
    if (!usable) problems.push(`${track.id}: full-subscription-free without a usable full source`)
  }
}

if (process.env.YOUTUBE_DATA_API_KEY) {
  console.log('YOUTUBE_DATA_API_KEY is present; this local verifier does not print or commit it.')
} else {
  console.log('YOUTUBE_DATA_API_KEY is not set; skipped optional live YouTube Data API checks.')
}

if (problems.length > 0) {
  problems.forEach((problem) => console.error(`ERROR ${problem}`))
  console.error(`YouTube source verification failed: ${problems.length} problem(s).`)
  process.exitCode = 1
} else {
  console.log(`YouTube source verification passed for ${slug}.`)
}
