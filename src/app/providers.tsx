import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { moodDimensionKeys, type MoodPreset, type MoodVector, type PlaybackPreference, type ProfileBundle, type StreamingService } from '../config/schemas'
import type { RecommendationContext, RecommendationResult } from '../features/recommendations/engine'
import { markNotTodayUntil, recommendTrack } from '../features/recommendations/engine'
import { applyProfileTheme, clearProfileTheme } from '../features/profiles/theme'
import {
  appendPlaybackEvent,
  ListenerStorage,
  learnFromLovedTrack,
  type ListenerState,
  type SavedPreset,
} from '../lib/storage'
import { getTimeOfDay } from '../lib/time'
import { clamp } from '../lib/utils'
import { playUiSound, type UiSound } from '../features/player/sound-effects'
import { createPlaybackEvent, type PlaybackEventType } from '../features/player/playback-events'
import { selectPlaybackProvider } from '../features/player/provider-selection'
import type { PlaybackProviderId } from '../features/player/playback-types'

type TuneOptions = {
  stationName?: string
  frequency?: string
  moodId?: string
  context?: RecommendationContext
}

type ExperienceContextValue = {
  slug: string
  profile: ProfileBundle
  profileSource: 'network' | 'cache'
  listener: ListenerState
  currentMood: MoodPreset | null
  currentTarget: MoodVector | null
  recommendation: RecommendationResult | null
  previousRecommendation: RecommendationResult | null
  nextRecommendation: RecommendationResult | null
  tuneMood: (mood: MoodPreset) => RecommendationResult
  tuneTarget: (target: MoodVector, options?: TuneOptions) => RecommendationResult
  chooseAnother: () => RecommendationResult | null
  playNextRecommendation: () => RecommendationResult | null
  sameMoodDifferentEra: () => RecommendationResult | null
  differentAlbum: () => RecommendationResult | null
  toggleLove: () => void
  notToday: () => RecommendationResult | null
  moreLikeThis: () => void
  lessIntense: () => RecommendationResult | null
  moreEnergetic: () => RecommendationResult | null
  recordPlaybackEvent: (type: PlaybackEventType, trackId: string, provider: PlaybackProviderId) => void
  saveCurrentPreset: () => void
  clearHistory: () => void
  resetPreferences: () => void
  setStreamingService: (service: StreamingService) => void
  setPlaybackPreference: (preference: PlaybackPreference) => void
  setEmbedConsent: (consent: ListenerState['embedConsent']) => void
  setAllowOfficialAlternateVersions: (enabled: boolean) => void
  setAllowPreviewsWhenFullSongsUnavailable: (enabled: boolean) => void
  setSoundEffects: (enabled: boolean) => void
  setSoundVolume: (volume: number) => void
  setReducedMotion: (enabled: boolean) => void
  setHighContrast: (enabled: boolean) => void
  setSemanticMode: (mode: ListenerState['semanticMode']) => void
  playSound: (sound: UiSound) => void
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null)

const blendTarget = (current: MoodVector, target: MoodVector, strength: number): MoodVector =>
  Object.fromEntries(
    moodDimensionKeys.map((key) => [
      key,
      Math.round(current[key] * (1 - strength) + target[key] * strength),
    ]),
  ) as MoodVector

export const normaliseMoodTarget = (target: MoodVector): MoodVector =>
  Object.fromEntries(
    moodDimensionKeys.map((key) => {
      const value = target[key]
      return [key, Number.isFinite(value) ? Math.round(clamp(value)) : 50]
    }),
  ) as MoodVector

export function ExperienceProvider({
  slug,
  profile,
  profileSource,
  children,
}: {
  slug: string
  profile: ProfileBundle
  profileSource: 'network' | 'cache'
  children: ReactNode
}) {
  const storage = useMemo(
    () => new ListenerStorage(
      slug,
      profile.gift.defaultStreamingService,
      profile.gift.fullPlayback.allowOfficialAlternateVersions,
    ),
    [profile.gift.defaultStreamingService, profile.gift.fullPlayback.allowOfficialAlternateVersions, slug],
  )
  const listener = useSyncExternalStore(storage.subscribe, storage.getSnapshot, storage.getSnapshot)
  const [currentMood, setCurrentMood] = useState<MoodPreset | null>(null)
  const [currentTarget, setCurrentTarget] = useState<MoodVector | null>(listener.lastTarget)
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null)
  const recommendationRef = useRef<RecommendationResult | null>(null)
  const [previousRecommendation, setPreviousRecommendation] = useState<RecommendationResult | null>(null)
  const [nextRecommendation, setNextRecommendation] = useState<RecommendationResult | null>(null)

  useEffect(() => {
    applyProfileTheme(profile.gift)
    return clearProfileTheme
  }, [profile.gift])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', listener.reducedMotion)
    document.documentElement.classList.toggle('high-contrast', listener.highContrast)
  }, [listener.highContrast, listener.reducedMotion])

  const playSound = useCallback(
    (sound: UiSound) => {
      if (profile.gift.features.soundEffects && listener.soundEffects && listener.soundVolume > 0) {
        playUiSound(sound, listener.soundVolume / 100)
      }
    },
    [listener.soundEffects, listener.soundVolume, profile.gift.features.soundEffects],
  )

  const tuneTarget = useCallback(
    (target: MoodVector, options: TuneOptions = {}) => {
      const normalisedTarget = normaliseMoodTarget(target)
      const moodId = options.moodId ?? currentMood?.id ?? 'custom'
      const stationName = options.stationName ?? currentMood?.stationName ?? 'WisseBot Mix'
      const frequency = options.frequency ?? currentMood?.frequency ?? profile.gift.station.frequencyLabel
      const context = {
        timeOfDay: getTimeOfDay(),
        artistPolicy: profile.gift.artistPolicy,
        requireFullPlayback: true,
        allowOfficialAlternateVersions: listener.allowOfficialAlternateVersions,
        allowPreviewsWhenFullSongsUnavailable: listener.allowPreviewsWhenFullSongsUnavailable,
        rotationSeed: `day-${Math.floor(Date.now() / (1000 * 60 * 60 * 24))}`,
        ...(options.context ?? {}),
      }
      const result = recommendTrack({
        tracks: profile.tracks.tracks,
        target: normalisedTarget,
        stationName,
        frequency,
        listener: storage.getSnapshot(),
        context,
      })
      const historyEntry = {
        trackId: result.track.id,
        timestamp: Date.now(),
        moodId,
        stationName,
        target: normalisedTarget,
      }
      const snapshot = storage.getSnapshot()
      const queueContext: RecommendationContext = { ...context }
      delete queueContext.requestedTrackId
      const queued = recommendTrack({
        tracks: profile.tracks.tracks,
        target: normalisedTarget,
        stationName,
        frequency,
        listener: { ...snapshot, history: [historyEntry, ...snapshot.history].slice(0, 80) },
        context: {
          ...queueContext,
          excludedTrackIds: [result.track.id, ...(context.excludedTrackIds ?? [])],
          rotationSeed: `${context.rotationSeed ?? 'pink-fm'}-next`,
        },
      })
      setCurrentTarget(normalisedTarget)
      setPreviousRecommendation(recommendationRef.current)
      setRecommendation(result)
      recommendationRef.current = result
      setNextRecommendation(queued)
      const selectedProvider = selectPlaybackProvider(result.track, storage.getSnapshot().playbackPreference).provider
      storage.update((state) => ({
        ...state,
        lastTarget: normalisedTarget,
        history: [
          historyEntry,
          ...state.history,
        ].slice(0, 80),
        moodSelectionCounts: {
          ...state.moodSelectionCounts,
          [moodId]: (state.moodSelectionCounts[moodId] ?? 0) + 1,
        },
        favouriteStationCounts: {
          ...state.favouriteStationCounts,
          [stationName]: (state.favouriteStationCounts[stationName] ?? 0) + 1,
        },
        preferredMoods: blendTarget(state.preferredMoods, normalisedTarget, 0.025),
        completedOnboarding: true,
        playbackEvents: [
          createPlaybackEvent('recommended', result.track.id, selectedProvider),
          ...state.playbackEvents,
        ].slice(0, 240),
      }))
      playSound('confirm')
      return result
    },
    [
      currentMood,
      listener.allowOfficialAlternateVersions,
      listener.allowPreviewsWhenFullSongsUnavailable,
      playSound,
      profile.gift.artistPolicy,
      profile.gift.station.frequencyLabel,
      profile.tracks.tracks,
      storage,
    ],
  )

  const tuneMood = useCallback(
    (mood: MoodPreset) => {
      setCurrentMood(mood)
      return tuneTarget(mood.target, {
        stationName: mood.stationName,
        frequency: mood.frequency,
        moodId: mood.id,
        ...(mood.surprise
          ? { context: { surprise: true, noveltyPreference: 'novel' as const } }
          : {}),
      })
    },
    [tuneTarget],
  )

  const chooseAnother = useCallback(() => {
    if (!currentTarget) return null
    if (recommendation) {
      const provider = selectPlaybackProvider(recommendation.track, storage.getSnapshot().playbackPreference).provider
      storage.update((state) => appendPlaybackEvent(
        state,
        createPlaybackEvent('skipped', recommendation.track.id, provider),
      ))
    }
    return tuneTarget(currentTarget, currentMood?.surprise
      ? { context: { surprise: true, noveltyPreference: 'novel' } }
      : {})
  }, [currentMood?.surprise, currentTarget, recommendation, storage, tuneTarget])

  const playNextRecommendation = useCallback(() => {
    if (!currentTarget || !nextRecommendation) return null
    return tuneTarget(currentTarget, {
      stationName: nextRecommendation.stationName,
      frequency: nextRecommendation.frequency,
      context: { requestedTrackId: nextRecommendation.track.id },
    })
  }, [currentTarget, nextRecommendation, tuneTarget])

  const sameMoodDifferentEra = useCallback(() => {
    if (!currentTarget || !recommendation) return null
    return tuneTarget(currentTarget, { context: { excludedEras: [recommendation.track.era] } })
  }, [currentTarget, recommendation, tuneTarget])

  const differentAlbum = useCallback(() => {
    if (!currentTarget || !recommendation) return null
    return tuneTarget(currentTarget, {
      context: { excludedAlbumIds: recommendation.track.albumId ? [recommendation.track.albumId] : [] },
    })
  }, [currentTarget, recommendation, tuneTarget])

  const toggleLove = useCallback(() => {
    if (!recommendation) return
    storage.update((state) => learnFromLovedTrack(state, recommendation.track))
    playSound('click')
  }, [playSound, recommendation, storage])

  const notToday = useCallback(() => {
    if (!recommendation) return null
    storage.update((state) => ({
      ...state,
      notTodayUntil: {
        ...state.notTodayUntil,
        [recommendation.track.id]: markNotTodayUntil(),
      },
    }))
    playSound('static')
    return chooseAnother()
  }, [chooseAnother, playSound, recommendation, storage])

  const moreLikeThis = useCallback(() => {
    if (!recommendation) return
    const track = recommendation.track
    storage.update((state) => ({
      ...state,
      moreLikeTrackIds: {
        ...state.moreLikeTrackIds,
        [track.id]: (state.moreLikeTrackIds[track.id] ?? 0) + 1,
      },
      preferredMoods: blendTarget(state.preferredMoods, track.moods, 0.05),
    }))
    playSound('click')
  }, [playSound, recommendation, storage])

  const lessIntense = useCallback(() => {
    if (!currentTarget || !recommendation) return null
    const target = {
      ...currentTarget,
      dramatic: clamp(currentTarget.dramatic - 24),
      peaceful: clamp(currentTarget.peaceful + 12),
      energised: clamp(currentTarget.energised - 10),
    }
    return tuneTarget(target, {
      context: { maxIntensity: Math.max(25, recommendation.track.intensity - 16) },
    })
  }, [currentTarget, recommendation, tuneTarget])

  const moreEnergetic = useCallback(() => {
    if (!currentTarget) return null
    const target = {
      ...currentTarget,
      energised: clamp(currentTarget.energised + 24),
      happy: clamp(currentTarget.happy + 10),
      confident: clamp(currentTarget.confident + 8),
    }
    return tuneTarget(target, { context: { minEnergy: Math.max(40, target.energised - 24) } })
  }, [currentTarget, tuneTarget])

  const recordPlaybackEvent = useCallback(
    (type: PlaybackEventType, trackId: string, provider: PlaybackProviderId) => {
      storage.update((state) => appendPlaybackEvent(
        state,
        createPlaybackEvent(type, trackId, provider),
        type === 'playback-started'
          ? {
              trackId,
              timestamp: Date.now(),
              moodId: currentMood?.id ?? 'custom',
              stationName: recommendation?.stationName ?? 'Pink FM',
              target: currentTarget ?? state.lastTarget ?? state.preferredMoods,
            }
          : undefined,
      ))
    },
    [currentMood?.id, currentTarget, recommendation?.stationName, storage],
  )

  const saveCurrentPreset = useCallback(() => {
    if (!currentTarget) return
    const preset: SavedPreset = {
      id: `saved-${Date.now()}`,
      label: currentMood?.label ? `${currentMood.label} — fine tuned` : 'WisseBot mix',
      target: currentTarget,
    }
    storage.update((state) => ({ ...state, savedPresets: [preset, ...state.savedPresets].slice(0, 12) }))
    playSound('confirm')
  }, [currentMood, currentTarget, playSound, storage])

  const clearHistory = useCallback(() => {
    storage.update((state) => ({
      ...state,
      history: [],
      listeningHistory: [],
      playbackEvents: [],
      playCounts: {},
      moodSelectionCounts: {},
      favouriteStationCounts: {},
    }))
  }, [storage])

  const resetPreferences = useCallback(() => {
    storage.reset()
    setCurrentMood(null)
    setCurrentTarget(null)
    setRecommendation(null)
    recommendationRef.current = null
    setPreviousRecommendation(null)
    setNextRecommendation(null)
  }, [storage])

  const setStreamingService = useCallback(
    (service: StreamingService) => storage.update((state) => ({ ...state, selectedStreamingService: service })),
    [storage],
  )
  const setPlaybackPreference = useCallback(
    (playbackPreference: PlaybackPreference) => storage.update((state) => ({ ...state, playbackPreference })),
    [storage],
  )
  const setEmbedConsent = useCallback(
    (embedConsent: ListenerState['embedConsent']) => storage.update((state) => ({ ...state, embedConsent })),
    [storage],
  )
  const setAllowOfficialAlternateVersions = useCallback(
    (allowOfficialAlternateVersions: boolean) =>
      storage.update((state) => ({ ...state, allowOfficialAlternateVersions })),
    [storage],
  )
  const setAllowPreviewsWhenFullSongsUnavailable = useCallback(
    (allowPreviewsWhenFullSongsUnavailable: boolean) =>
      storage.update((state) => ({ ...state, allowPreviewsWhenFullSongsUnavailable })),
    [storage],
  )
  const setSoundEffects = useCallback(
    (enabled: boolean) => storage.update((state) => ({ ...state, soundEffects: enabled })),
    [storage],
  )
  const setSoundVolume = useCallback(
    (volume: number) => storage.update((state) => ({ ...state, soundVolume: clamp(Math.round(volume)) })),
    [storage],
  )
  const setReducedMotion = useCallback(
    (enabled: boolean) => storage.update((state) => ({ ...state, reducedMotion: enabled })),
    [storage],
  )
  const setHighContrast = useCallback(
    (enabled: boolean) => storage.update((state) => ({ ...state, highContrast: enabled })),
    [storage],
  )
  const setSemanticMode = useCallback(
    (mode: ListenerState['semanticMode']) => storage.update((state) => ({ ...state, semanticMode: mode })),
    [storage],
  )

  const value = useMemo<ExperienceContextValue>(
    () => ({
      slug,
      profile,
      profileSource,
      listener,
      currentMood,
      currentTarget,
      recommendation,
      previousRecommendation,
      nextRecommendation,
      tuneMood,
      tuneTarget,
      chooseAnother,
      playNextRecommendation,
      sameMoodDifferentEra,
      differentAlbum,
      toggleLove,
      notToday,
      moreLikeThis,
      lessIntense,
      moreEnergetic,
      recordPlaybackEvent,
      saveCurrentPreset,
      clearHistory,
      resetPreferences,
      setStreamingService,
      setPlaybackPreference,
      setEmbedConsent,
      setAllowOfficialAlternateVersions,
      setAllowPreviewsWhenFullSongsUnavailable,
      setSoundEffects,
      setSoundVolume,
      setReducedMotion,
      setHighContrast,
      setSemanticMode,
      playSound,
    }),
    [
      chooseAnother,
      clearHistory,
      currentMood,
      currentTarget,
      previousRecommendation,
      nextRecommendation,
      playNextRecommendation,
      sameMoodDifferentEra,
      differentAlbum,
      lessIntense,
      listener,
      recordPlaybackEvent,
      moreEnergetic,
      moreLikeThis,
      notToday,
      playSound,
      profile,
      profileSource,
      recommendation,
      resetPreferences,
      saveCurrentPreset,
      setHighContrast,
      setSemanticMode,
      setReducedMotion,
      setSoundEffects,
      setSoundVolume,
      setStreamingService,
      setPlaybackPreference,
      setEmbedConsent,
      setAllowOfficialAlternateVersions,
      setAllowPreviewsWhenFullSongsUnavailable,
      slug,
      toggleLove,
      tuneMood,
      tuneTarget,
    ],
  )

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>
}

export const useExperience = () => {
  const value = useContext(ExperienceContext)
  if (!value) throw new Error('useExperience must be used within ExperienceProvider')
  return value
}
