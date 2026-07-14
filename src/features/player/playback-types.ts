import type { Track } from '../../config/schemas'

export type PlaybackProviderId =
  | 'spotify-embed'
  | 'youtube-embed'
  | 'apple-preview'
  | 'external'

export type PlaybackPreference = 'automatic' | 'spotify' | 'youtube' | 'apple'

export type PlaybackCapability = {
  provider: PlaybackProviderId
  playableInsideSite: boolean
  canPlay: boolean
  canPause: boolean
  canLoadTrack: boolean
  canReportState: boolean
  canReportProgress: boolean
  fullTrackExpected: boolean
}

export type PlaybackState =
  | 'idle'
  | 'awaiting-consent'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'external-only'

export interface PlaybackProviderAdapter {
  readonly id: PlaybackProviderId
  readonly capability: PlaybackCapability
  canHandle(track: Track): boolean
  mount(container: HTMLElement): Promise<void>
  loadTrack(track: Track): Promise<void>
  play(): Promise<void>
  pause(): Promise<void>
  destroy(): void
}

export type PlaybackSelection = {
  provider: PlaybackProviderId
  capability: PlaybackCapability
  reason: string
}
