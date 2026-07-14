import type { Track } from '../../../../config/schemas'
import { playbackCapabilities } from '../../provider-selection'
import type { PlaybackProviderAdapter } from '../../playback-types'

export class ExternalPlaybackAdapter implements PlaybackProviderAdapter {
  readonly id = 'external' as const
  readonly capability = playbackCapabilities.external
  canHandle(track: Track) { return Object.values(track.officialLinks).some(Boolean) }
  async mount() { /* No third-party resource is mounted. */ }
  async loadTrack() { /* External navigation remains a listener action. */ }
  async play() { throw new Error('External playback cannot be controlled by Pink FM.') }
  async pause() { throw new Error('External playback cannot be controlled by Pink FM.') }
  destroy() { /* Nothing to destroy. */ }
}
