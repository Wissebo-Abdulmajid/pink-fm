import { Pause, Play, RotateCw } from 'lucide-react'
import type { PlaybackCapability, PlaybackState } from './playback-types'

export function PlayerControls({
  capability, state, onPlay, onPause, onRetry,
}: {
  capability: PlaybackCapability
  state: PlaybackState
  onPlay: () => void
  onPause: () => void
  onRetry: () => void
}) {
  if (state === 'failed') {
    return <button className="button player-control" type="button" onClick={onRetry}><RotateCw aria-hidden="true" /> Retry player</button>
  }
  if (!capability.canPlay) return null
  if (state === 'playing' && capability.canPause) {
    return <button className="button player-control" type="button" onClick={onPause}><Pause aria-hidden="true" /> Pause</button>
  }
  if (state === 'ready' || state === 'paused' || state === 'completed') {
    return <button className="button player-control" type="button" onClick={onPlay}><Play aria-hidden="true" /> {state === 'completed' ? 'Replay' : 'Play'}</button>
  }
  return null
}
