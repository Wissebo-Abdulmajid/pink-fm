import { ExternalLink } from 'lucide-react'
import type { StreamingService, Track } from '../../../../config/schemas'
import type { PlaybackProviderId } from '../../playback-types'
import { selectExternalDestination } from './external-destination'

const providerName: Record<string, string> = {
  spotify: 'Spotify', youtube: 'YouTube', appleMusic: 'Apple Music',
}

export function ExternalPlaybackFallback({
  track,
  provider,
  onOpen,
  externalPreference,
}: {
  track: Track
  provider: PlaybackProviderId
  onOpen: () => void
  externalPreference?: StreamingService
}) {
  const destination = selectExternalDestination(track, provider, externalPreference)
  if (!destination) return <p className="playback-unavailable" role="status">No official listening destination is available.</p>
  return (
    <a
      className="playback-external-link"
      href={destination.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
    >
      Open in {providerName[destination.service]} <ExternalLink size={15} aria-hidden="true" />
    </a>
  )
}
