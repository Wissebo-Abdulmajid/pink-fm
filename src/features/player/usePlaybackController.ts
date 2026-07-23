import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '../../config/schemas'
import { useExperience } from '../../app/providers'
import { selectPlaybackProvider } from './provider-selection'
import { AppleMusicPreviewAdapter } from './providers/apple/apple-adapter'
import { SpotifyPlaybackAdapter } from './providers/spotify/spotify-adapter'
import { YouTubePlaybackAdapter } from './providers/youtube/youtube-adapter'
import type { PlaybackProviderAdapter, PlaybackState } from './playback-types'
import { announcePlaybackActivity } from './playback-activity'

const makeAdapter = (
  provider: 'spotify-embed' | 'youtube-embed' | 'apple-preview',
  onState: (state: PlaybackState) => void,
  allowOfficialAlternateVersions: boolean,
) => provider === 'spotify-embed'
  ? new SpotifyPlaybackAdapter(onState)
  : provider === 'youtube-embed'
    ? new YouTubePlaybackAdapter(onState, allowOfficialAlternateVersions)
    : new AppleMusicPreviewAdapter(onState)

export const friendlyPlaybackError = () =>
  'This player could not tune in. Try again or choose another frequency.'

const withTimeout = <T,>(promise: Promise<T>, message: string, timeoutMs = 9_000) =>
  new Promise<T>((resolve, reject: (reason: Error) => void) => {
    const timer = window.setTimeout(() => {
      const error = new Error(message)
      reject(error)
    }, timeoutMs)
    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      })
  })

export const usePlaybackController = (track: Track) => {
  const { listener, recordPlaybackEvent } = useExperience()
  const selection = useMemo(
    () => selectPlaybackProvider(track, track.playback.preferredProvider === 'automatic'
      ? listener.playbackPreference
      : track.playback.preferredProvider),
    [listener.playbackPreference, track],
  )
  const effectiveProvider = listener.embedConsent === 'external-only' ? 'external' : selection.provider
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<PlaybackProviderAdapter | null>(null)
  const trackRef = useRef(track)
  const eventCallbackRef = useRef(recordPlaybackEvent)
  const previousStateRef = useRef<PlaybackState>('idle')
  const [state, setState] = useState<PlaybackState>(
    listener.embedConsent === 'ask' && selection.provider !== 'external' ? 'awaiting-consent' : 'idle',
  )
  const [error, setError] = useState('')
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    trackRef.current = track
    eventCallbackRef.current = recordPlaybackEvent
  }, [recordPlaybackEvent, track])

  const handleState = useCallback((next: PlaybackState) => {
    const previous = previousStateRef.current
    previousStateRef.current = next
    setState(next)
    announcePlaybackActivity(next === 'playing')
    const current = trackRef.current
    if (next === 'ready' && previous !== 'ready') eventCallbackRef.current('player-loaded', current.id, effectiveProvider)
    if (next === 'playing' && previous !== 'playing') eventCallbackRef.current('playback-started', current.id, effectiveProvider)
    if (next === 'paused' && previous === 'playing') eventCallbackRef.current('playback-paused', current.id, effectiveProvider)
    if (next === 'completed' && previous !== 'completed') eventCallbackRef.current('playback-completed', current.id, effectiveProvider)
    if (next === 'failed' && previous !== 'failed') eventCallbackRef.current('failed', current.id, effectiveProvider)
  }, [effectiveProvider])

  useEffect(() => {
    if (listener.embedConsent === 'ask' && selection.provider !== 'external') {
      return
    }
    if (effectiveProvider === 'external') {
      return
    }
    const container = containerRef.current
    if (!container) return
    const adapter = makeAdapter(effectiveProvider, handleState, listener.allowOfficialAlternateVersions)
    adapterRef.current = adapter
    previousStateRef.current = 'idle'
    setError('')
    void adapter.mount(container).catch((cause) => {
      void cause
      setError(friendlyPlaybackError())
      handleState('failed')
    })
    return () => {
      adapter.destroy()
      announcePlaybackActivity(false)
      if (adapterRef.current === adapter) adapterRef.current = null
    }
  }, [effectiveProvider, generation, handleState, listener.allowOfficialAlternateVersions, listener.embedConsent, selection.provider])

  useEffect(() => {
    const adapter = adapterRef.current
    if (!adapter || listener.embedConsent !== 'allowed') return
    let current = true
    void withTimeout(
      adapter.loadTrack(track),
      'The embedded player did not respond. That frequency is unavailable here.',
    ).catch((cause) => {
      if (!current) return
      void cause
      setError(friendlyPlaybackError())
      handleState('failed')
    })
    return () => { current = false }
  }, [generation, handleState, listener.embedConsent, track])

  const play = useCallback(async () => {
    try {
      if (!adapterRef.current) throw new Error('Player unavailable')
      await adapterRef.current.play()
    } catch {
      setError(friendlyPlaybackError())
      handleState('failed')
    }
  }, [handleState])
  const pause = useCallback(async () => {
    try {
      if (!adapterRef.current) throw new Error('Player unavailable')
      await adapterRef.current.pause()
    } catch {
      setError(friendlyPlaybackError())
      handleState('failed')
    }
  }, [handleState])
  const retry = useCallback(() => {
    setError('')
    setGeneration((value) => value + 1)
  }, [])
  const reload = useCallback(() => {
    const adapter = adapterRef.current
    if (!adapter) return
    void withTimeout(
      adapter.loadTrack(track),
      'The embedded player did not respond. That frequency is unavailable here.',
    ).catch((cause) => {
      void cause
      setError(friendlyPlaybackError())
      handleState('failed')
    })
  }, [handleState, track])

  const presentedState: PlaybackState = listener.embedConsent === 'ask' && selection.provider !== 'external'
    ? 'awaiting-consent'
    : effectiveProvider === 'external'
      ? 'external-only'
      : state

  return {
    selection: { ...selection, provider: effectiveProvider }, containerRef, state: presentedState, error,
    play, pause, retry, reload,
  }
}
