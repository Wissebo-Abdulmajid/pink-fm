import {
  cacheRoot,
  loadAuthorities,
  loadDiscoveredVideos,
  parseSlug,
  writeDiscoveredVideos,
  writeJsonFile,
  writeSourceAcquisitionReport,
} from './youtube-acquisition-tools.ts'
import type { DiscoveredYouTubeVideo } from '../src/features/recommendations/youtube-catalog-matching.ts'

type YouTubeChannelsResponse = {
  items?: Array<{ id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }>
  error?: { message?: string }
}

type YouTubePlaylistItemsResponse = {
  nextPageToken?: string
  items?: Array<{ contentDetails?: { videoId?: string } }>
  error?: { message?: string }
}

type YouTubeVideosResponse = {
  items?: Array<{
    id: string
    snippet?: { title?: string; channelId?: string; channelTitle?: string }
    contentDetails?: { duration?: string }
    status?: { embeddable?: boolean; privacyStatus?: string }
  }>
  error?: { message?: string }
}

const slug = parseSlug()
const apiKey = process.env.YOUTUBE_DATA_API_KEY
const authorities = loadAuthorities(slug).filter((authority) => authority.active)
const cached = loadDiscoveredVideos(slug)
let apiCalls = 0
let quotaEstimate = 0

const parseIsoDuration = (value: string | undefined) => {
  if (!value) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value)
  if (!match) return null
  const [, hours = '0', minutes = '0', seconds = '0'] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

const fetchJson = async <T>(url: URL): Promise<T> => {
  const response = await fetch(url)
  apiCalls += 1
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`)
  const payload = await response.json() as T
  const maybeError = payload as { error?: { message?: string } }
  if (maybeError.error) throw new Error(maybeError.error.message ?? 'YouTube API error')
  return payload
}

const youtubeApi = (path: string, params: Record<string, string>) => {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set('key', apiKey ?? '')
  return url
}

const getUploadsPlaylistId = async (channelId: string) => {
  quotaEstimate += 1
  const payload = await fetchJson<YouTubeChannelsResponse>(youtubeApi('channels', {
    part: 'contentDetails',
    id: channelId,
  }))
  return payload.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null
}

const getPlaylistVideoIds = async (playlistId: string, maxPages: number) => {
  const videoIds: string[] = []
  let pageToken = ''
  for (let page = 0; page < maxPages; page += 1) {
    quotaEstimate += 1
    const payload = await fetchJson<YouTubePlaylistItemsResponse>(youtubeApi('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    }))
    for (const item of payload.items ?? []) {
      const videoId = item.contentDetails?.videoId
      if (videoId) videoIds.push(videoId)
    }
    if (!payload.nextPageToken) break
    pageToken = payload.nextPageToken
  }
  return videoIds
}

const getVideos = async (videoIds: string[]) => {
  const videos: DiscoveredYouTubeVideo[] = []
  for (let index = 0; index < videoIds.length; index += 50) {
    const ids = videoIds.slice(index, index + 50)
    if (ids.length === 0) continue
    quotaEstimate += 1
    const payload = await fetchJson<YouTubeVideosResponse>(youtubeApi('videos', {
      part: 'snippet,contentDetails,status',
      id: ids.join(','),
    }))
    for (const item of payload.items ?? []) {
      const title = item.snippet?.title ?? ''
      const channelId = item.snippet?.channelId ?? ''
      const channelName = item.snippet?.channelTitle ?? ''
      videos.push({
        videoId: item.id,
        title,
        channelId,
        channelName,
        durationSeconds: parseIsoDuration(item.contentDetails?.duration),
        embeddable: item.status?.embeddable === true,
        public: item.status?.privacyStatus === 'public',
        sourceUrl: `https://www.youtube.com/watch?v=${item.id}`,
      })
    }
  }
  return videos
}

if (!apiKey) {
  writeSourceAcquisitionReport({
    slug,
    apiKeyPresent: false,
    authorityCount: authorities.length,
    discoveredVideoCount: cached.length,
    candidateCount: 0,
    autoAcceptedCount: 0,
    rejectedCount: 0,
    ambiguousCount: 0,
    apiCalls,
    quotaEstimate,
    notes: [
      'YOUTUBE_DATA_API_KEY is not set; live trusted-channel enumeration was skipped.',
      `Existing cache location: ${cacheRoot(slug)}`,
      'Set the key locally and re-run `npm.cmd run youtube:discover -- --slug=siti` to enumerate uploads.',
    ],
  })
  console.log('YOUTUBE_DATA_API_KEY is not set; discovery skipped.')
  process.exit(0)
}

const maxPagesArg = process.argv.find((arg) => arg.startsWith('--max-pages='))?.slice('--max-pages='.length)
const maxPages = maxPagesArg ? Math.max(1, Number(maxPagesArg)) : 8
const allVideos = new Map(cached.map((video) => [video.videoId, video]))
const errors: string[] = []

for (const authority of authorities) {
  try {
    const uploads = await getUploadsPlaylistId(authority.channelId)
    if (!uploads) {
      errors.push(`${authority.name}: uploads playlist not found`)
      continue
    }
    const videoIds = await getPlaylistVideoIds(uploads, maxPages)
    const videos = await getVideos(videoIds)
    for (const video of videos) allVideos.set(video.videoId, video)
  } catch (error) {
    errors.push(`${authority.name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const discovered = [...allVideos.values()].sort((left, right) => left.videoId.localeCompare(right.videoId))
writeDiscoveredVideos(slug, discovered)
writeJsonFile(`${cacheRoot(slug)}\\discovery-errors.json`, errors)
writeSourceAcquisitionReport({
  slug,
  apiKeyPresent: true,
  authorityCount: authorities.length,
  discoveredVideoCount: discovered.length,
  candidateCount: 0,
  autoAcceptedCount: 0,
  rejectedCount: 0,
  ambiguousCount: 0,
  apiCalls,
  quotaEstimate,
  notes: [
    `Enumerated uploads from ${authorities.length} trusted authorities.`,
    `Max playlist pages per channel: ${maxPages}.`,
    errors.length ? `${errors.length} channel(s) reported errors; see .cache/youtube/${slug}/discovery-errors.json.` : 'No channel errors reported.',
  ],
})

console.log(JSON.stringify({ slug, discoveredVideos: discovered.length, apiCalls, quotaEstimate, errors }, null, 2))
