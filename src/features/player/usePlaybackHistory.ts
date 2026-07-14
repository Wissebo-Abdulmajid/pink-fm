import { useExperience } from '../../app/providers'

export const usePlaybackHistory = () => {
  const { listener, profile } = useExperience()
  const lastStarted = listener.listeningHistory[0]
  return {
    events: listener.playbackEvents,
    previousPlayedTrack: lastStarted
      ? profile.tracks.tracks.find((track) => track.id === lastStarted.trackId) ?? null
      : null,
  }
}
