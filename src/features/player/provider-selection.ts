import type { Track } from '../../config/schemas'
import { appleMusicEmbedUrl } from './providers/apple/apple-url'
import { spotifyTrackUri } from './providers/spotify/spotify-url'
import { isYouTubeVideoId } from './providers/youtube/youtube-url'
import type { PlaybackCapability, PlaybackPreference, PlaybackProviderId, PlaybackSelection } from './playback-types'

export const playbackCapabilities: Record<PlaybackProviderId, PlaybackCapability> = {
  'spotify-embed': {
    provider: 'spotify-embed', playableInsideSite: true, canPlay: true, canPause: true,
    canLoadTrack: true, canReportState: true, canReportProgress: true, fullTrackExpected: false,
  },
  'youtube-embed': {
    provider: 'youtube-embed', playableInsideSite: true, canPlay: true, canPause: true,
    canLoadTrack: true, canReportState: true, canReportProgress: true, fullTrackExpected: true,
  },
  'apple-preview': {
    provider: 'apple-preview', playableInsideSite: true, canPlay: false, canPause: false,
    canLoadTrack: true, canReportState: false, canReportProgress: false, fullTrackExpected: false,
  },
  external: {
    provider: 'external', playableInsideSite: false, canPlay: false, canPause: false,
    canLoadTrack: false, canReportState: false, canReportProgress: false, fullTrackExpected: false,
  },
}

export const providerCanHandle = (provider: PlaybackProviderId, track: Track) => {
  if (provider === 'spotify-embed') return Boolean(spotifyTrackUri(track.officialLinks.spotify))
  if (provider === 'youtube-embed') {
    const youtube = track.playback.youtube
    return Boolean(youtube?.verifiedOfficial && youtube.sourceId && isYouTubeVideoId(youtube.videoId))
  }
  if (provider === 'apple-preview') {
    const url = track.playback.appleMusic?.url || track.officialLinks.appleMusic
    return Boolean(url && appleMusicEmbedUrl(url))
  }
  return Object.values(track.officialLinks).some(Boolean)
}

const automaticOrder: PlaybackProviderId[] = ['spotify-embed', 'youtube-embed', 'apple-preview', 'external']
const preferenceProvider: Record<Exclude<PlaybackPreference, 'automatic'>, PlaybackProviderId> = {
  spotify: 'spotify-embed', youtube: 'youtube-embed', apple: 'apple-preview',
}

export const selectPlaybackProvider = (
  track: Track,
  preference: PlaybackPreference = 'automatic',
): PlaybackSelection => {
  const preferred = preference === 'automatic' ? null : preferenceProvider[preference]
  const order = preferred
    ? [preferred, ...automaticOrder.filter((provider) => provider !== preferred)]
    : automaticOrder
  const provider = order.find((candidate) => providerCanHandle(candidate, track)) ?? 'external'
  return {
    provider,
    capability: playbackCapabilities[provider],
    reason: preferred === provider ? `Preferred ${preference} provider is available.` : `${provider} is the first available provider.`,
  }
}
