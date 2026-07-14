import type { PlaybackProviderId } from './playback-types'

export type PlaybackEventType =
  | 'recommended'
  | 'player-loaded'
  | 'playback-started'
  | 'playback-paused'
  | 'playback-completed'
  | 'externally-opened'
  | 'skipped'
  | 'failed'

export type PlaybackEventRecord = {
  id: string
  type: PlaybackEventType
  trackId: string
  provider: PlaybackProviderId
  timestamp: number
}

export const createPlaybackEvent = (
  type: PlaybackEventType,
  trackId: string,
  provider: PlaybackProviderId,
): PlaybackEventRecord => ({
  id: `${timestampId()}-${trackId}-${type}`,
  type,
  trackId,
  provider,
  timestamp: Date.now(),
})

const timestampId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
