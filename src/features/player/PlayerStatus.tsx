import type { PlaybackProviderId, PlaybackState } from './playback-types'

const providerLabels: Record<PlaybackProviderId, string> = {
  'spotify-embed': 'Playback provided by Spotify',
  'youtube-embed': 'Playback via official YouTube source',
  'apple-preview': 'Preview provided by Apple Music',
  external: 'External listening destination',
}

const stateLabels: Record<PlaybackState, string> = {
  idle: 'Your next frequency is ready',
  'awaiting-consent': 'Waiting for your embedded-player choice',
  loading: 'Loading the selected provider…',
  ready: 'Your next frequency is ready',
  playing: 'Playing inside Pink FM',
  paused: 'Playback paused',
  completed: 'Playback completed',
  failed: 'That frequency is unavailable here. Retuning to another full song.',
  'external-only': 'Embedded players are turned off',
}

export function PlayerStatus({ provider, state, error }: { provider: PlaybackProviderId; state: PlaybackState; error?: string }) {
  return (
    <div className="player-status">
      <strong>{providerLabels[provider]}</strong>
      <span role="status" aria-live="polite" aria-atomic="true">{error || stateLabels[state]}</span>
    </div>
  )
}
