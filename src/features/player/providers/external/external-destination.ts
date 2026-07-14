import type { Track } from '../../../../config/schemas'
import type { StreamingService } from '../../../../config/schemas'
import type { PlaybackProviderId } from '../../playback-types'

export const selectExternalDestination = (track: Track, provider: PlaybackProviderId, externalPreference?: StreamingService) => {
  const preferred = provider === 'spotify-embed' ? 'spotify'
    : provider === 'youtube-embed' ? 'youtube'
      : provider === 'apple-preview' ? 'appleMusic'
        : externalPreference ?? null
  if (preferred && track.officialLinks[preferred]) {
    return { service: preferred, url: track.officialLinks[preferred] }
  }
  const fallback = (['spotify', 'youtube', 'appleMusic'] as const)
    .find((service) => Boolean(track.officialLinks[service]))
  return fallback ? { service: fallback, url: track.officialLinks[fallback] } : null
}
