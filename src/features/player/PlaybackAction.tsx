import { ExternalLink, Music2, WifiOff } from 'lucide-react'
import { useExperience } from '../../app/providers'
import type { StreamingService, Track } from '../../config/schemas'
import { isAllowedEmbed } from '../../lib/assets'

const serviceNames: Record<StreamingService, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  appleMusic: 'Apple Music',
}

export function PlaybackAction({ track }: { track: Track }) {
  const { listener, markPlayed, profile } = useExperience()
  const preferred = listener.selectedStreamingService
  const alternatives = Object.entries(track.officialLinks) as [StreamingService, string][]
  const selected = track.officialLinks[preferred]
    ? ([preferred, track.officialLinks[preferred]] as const)
    : alternatives.find(([, link]) => Boolean(link))
  const embedAllowed = isAllowedEmbed(track.embed.provider, track.embed.url)

  return (
    <div className="playback-panel">
      {embedAllowed && track.embed.url && (
        <div className="embed-player">
          <iframe
            title={`${track.title} official ${track.embed.provider} player`}
            src={track.embed.url}
            loading="lazy"
            allow="encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <p>Audio is provided by {serviceNames[track.embed.provider as StreamingService] ?? track.embed.provider}; Pink FM does not host it.</p>
        </div>
      )}
      {selected ? (
        <a
          className="button playback-button"
          href={selected[1]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => markPlayed(track.id)}
        >
          <Music2 size={19} aria-hidden="true" />
          {profile.messages.radio.playOn} {serviceNames[selected[0]]}
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      ) : !embedAllowed ? (
        <div className="playback-unavailable" role="status">
          <WifiOff size={18} aria-hidden="true" />
          <span>{profile.messages.radio.noLink}</span>
        </div>
      ) : null}
      <small className="playback-disclaimer">Opens the configured official destination. Playback may require internet access.</small>
    </div>
  )
}
