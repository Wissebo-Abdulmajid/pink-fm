import { useEffect, useState } from 'react'
import type { Track } from '../../config/schemas'
import { useExperience } from '../../app/providers'
import { PlaybackConsent } from './PlaybackConsent'
import { PlaybackFallback } from './PlaybackFallback'
import { PlayerControls } from './PlayerControls'
import { PlayerShell } from './PlayerShell'
import { PlayerStatus } from './PlayerStatus'
import { usePlaybackController } from './usePlaybackController'
import { AppleMusicPreview } from './providers/apple/AppleMusicPreview'
import { ExternalPlaybackFallback } from './providers/external/ExternalPlaybackFallback'
import { SpotifyEmbedPlayer } from './providers/spotify/SpotifyEmbedPlayer'
import { YouTubeEmbedPlayer } from './providers/youtube/YouTubeEmbedPlayer'
import { RecommendationQueue } from './RecommendationQueue'

export function EmbeddedRadioPlayer({ track, station }: { track: Track; station: string }) {
  const { listener, setEmbedConsent, recordPlaybackEvent } = useExperience()
  const controller = usePlaybackController(track)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)

  useEffect(() => {
    const update = (event: Event) => setOnline(event.type === 'online')
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  const provider = controller.selection.provider
  const viewport = listener.embedConsent === 'allowed' && provider !== 'external'
    ? provider === 'spotify-embed'
      ? <SpotifyEmbedPlayer containerRef={controller.containerRef} />
      : provider === 'youtube-embed'
        ? <YouTubeEmbedPlayer containerRef={controller.containerRef} />
        : <AppleMusicPreview containerRef={controller.containerRef} />
    : null

  return (
    <PlayerShell track={track} station={station}>
      {listener.embedConsent === 'ask' && controller.selection.capability.playableInsideSite ? (
        <PlaybackConsent
          onAllow={() => setEmbedConsent('allowed')}
          onExternalOnly={() => setEmbedConsent('external-only')}
        />
      ) : (
        <>
          <PlayerStatus provider={provider} state={controller.state} error={controller.error} />
          {viewport}
          <PlayerControls
            capability={controller.selection.capability}
            state={controller.state}
            onPlay={() => void controller.play()}
            onPause={() => void controller.pause()}
            onRetry={controller.retry}
          />
        </>
      )}
      <ExternalPlaybackFallback
        track={track}
        provider={provider}
        externalPreference={listener.selectedStreamingService}
        onOpen={() => recordPlaybackEvent('externally-opened', track.id, provider)}
      />
      <RecommendationQueue
        onReplay={controller.reload}
        replayAvailable={controller.selection.capability.canLoadTrack && controller.selection.capability.canPlay}
      />
      <PlaybackFallback offline={!online} />
    </PlayerShell>
  )
}

export default EmbeddedRadioPlayer
