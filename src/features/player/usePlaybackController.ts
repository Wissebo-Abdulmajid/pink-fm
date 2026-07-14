import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '../../config/schemas'
import { useExperience } from '../../app/providers'
import { selectPlaybackProvider } from './provider-selection'
import { AppleMusicPreviewAdapter } from './providers/apple/apple-adapter'
import { SpotifyPlaybackAdapter } from './providers/spotify/spotify-adapter'
import { YouTubePlaybackAdapter } from './providers/youtube/youtube-adapter'
import type { PlaybackProviderAdapter, PlaybackState } from './playback-types'

const makeAdapter = (
  provider: 'spotify-embed' | 'youtube-embed' | 'apple-preview',
  onState: (state: PlaybackState) => void,
) => provider === 'spotify-embed'
  ? new SpotifyPlaybackAdapter(onState)
  : provider === 'youtube-embed'
    ? new YouTubePlaybackAdapter(onState)
    : new AppleMusicPreviewAdapter(onState)

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
    const adapter = makeAdapter(effectiveProvider, handleState)
    adapterRef.current = adapter
    previousStateRef.current = 'idle'
    setError('')
    void adapter.mount(container).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'The embedded player could not be mounted.')
      handleState('failed')
    })
    return () => {
      adapter.destroy()
      if (adapterRef.current === adapter) adapterRef.current = null
    }
  }, [effectiveProvider, generation, handleState, listener.embedConsent, selection.provider])

  useEffect(() => {
    const adapter = adapterRef.current
    if (!adapter || listener.embedConsent !== 'allowed') return
    let current = true
    void adapter.loadTrack(track).catch((cause) => {
      if (!current) return
      setError(cause instanceof Error ? cause.message : 'The embedded player could not load this track.')
      handleState('failed')
    })
    return () => { current = false }
  }, [generation, handleState, listener.embedConsent, track])

  const play = useCallback(async () => {
    try { await adapterRef.current?.play() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Playback could not start.'); handleState('failed') }
  }, [handleState])
  const pause = useCallback(async () => {
    try { await adapterRef.current?.pause() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Playback could not pause.'); handleState('failed') }
  }, [handleState])
  const retry = useCallback(() => setGeneration((value) => value + 1), [])
  const reload = useCallback(() => {
    const adapter = adapterRef.current
    if (!adapter) return
    void adapter.loadTrack(track).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'The track could not be reloaded.')
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
