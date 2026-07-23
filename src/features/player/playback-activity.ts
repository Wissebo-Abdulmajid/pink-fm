export const PLAYBACK_ACTIVITY_EVENT = 'pink-fm:playback-activity'

export const announcePlaybackActivity = (playing: boolean) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PLAYBACK_ACTIVITY_EVENT, { detail: { playing } }))
}

export const playbackActivityFromEvent = (event: Event) =>
  event instanceof CustomEvent &&
  typeof (event.detail as { playing?: unknown } | null)?.playing === 'boolean'
    ? (event.detail as { playing: boolean }).playing
    : false
