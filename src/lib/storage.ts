import { z } from 'zod'
import { STORAGE_SCHEMA_VERSION } from '../config/constants'
import {
  moodVectorSchema,
  playbackPreferenceSchema,
  streamingServiceSchema,
  type MoodVector,
  type StreamingService,
  type Track,
} from '../config/schemas'
import type { PlaybackEventRecord } from '../features/player/playback-events'

const playbackProviderIdSchema = z.enum(['spotify-embed', 'youtube-embed', 'apple-preview', 'external'])
const playbackEventTypeSchema = z.enum([
  'recommended', 'player-loaded', 'playback-started', 'playback-paused',
  'playback-completed', 'externally-opened', 'skipped', 'failed',
])
const playbackEventRecordSchema = z.strictObject({
  id: z.string(),
  type: playbackEventTypeSchema,
  trackId: z.string(),
  provider: playbackProviderIdSchema,
  timestamp: z.number().int().nonnegative(),
})

const historyEntrySchema = z.strictObject({
  trackId: z.string(),
  timestamp: z.number().int().nonnegative(),
  moodId: z.string(),
  stationName: z.string(),
  target: moodVectorSchema,
})

const savedPresetSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  target: moodVectorSchema,
})

export const listenerStateSchema = z.strictObject({
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  lovedTrackIds: z.array(z.string()),
  notTodayUntil: z.record(z.string(), z.number()),
  moreLikeTrackIds: z.record(z.string(), z.number().int().nonnegative()),
  savedPresets: z.array(savedPresetSchema),
  history: z.array(historyEntrySchema),
  listeningHistory: z.array(historyEntrySchema),
  playbackEvents: z.array(playbackEventRecordSchema),
  playCounts: z.record(z.string(), z.number().int().nonnegative()),
  moodSelectionCounts: z.record(z.string(), z.number().int().nonnegative()),
  preferredEras: z.record(z.string(), z.number()),
  preferredCollections: z.record(z.string(), z.number()),
  preferredVersionTypes: z.record(z.string(), z.number()),
  preferredArtistIds: z.record(z.string(), z.number()),
  preferredLanguages: z.record(z.string(), z.number()),
  preferredMoods: moodVectorSchema,
  soundEffects: z.boolean(),
  soundVolume: z.number().int().min(0).max(100),
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  selectedStreamingService: streamingServiceSchema,
  playbackPreference: playbackPreferenceSchema,
  embedConsent: z.enum(['ask', 'allowed', 'external-only']),
  allowOfficialAlternateVersions: z.boolean(),
  allowPreviewsWhenFullSongsUnavailable: z.boolean(),
  completedOnboarding: z.boolean(),
  favouriteStationCounts: z.record(z.string(), z.number().int().nonnegative()),
  lastTarget: moodVectorSchema.nullable(),
  semanticMode: z.enum(['ask', 'enhanced', 'lightweight']),
})

export type HistoryEntry = z.infer<typeof historyEntrySchema>
export type SavedPreset = z.infer<typeof savedPresetSchema>
export type ListenerState = z.infer<typeof listenerStateSchema>

export const createDefaultListenerState = (
  streamingService: StreamingService = 'spotify',
  allowOfficialAlternateVersions = true,
): ListenerState => ({
  schemaVersion: STORAGE_SCHEMA_VERSION,
  lovedTrackIds: [],
  notTodayUntil: {},
  moreLikeTrackIds: {},
  savedPresets: [],
  history: [],
  listeningHistory: [],
  playbackEvents: [],
  playCounts: {},
  moodSelectionCounts: {},
  preferredEras: {},
  preferredCollections: {},
  preferredVersionTypes: {},
  preferredArtistIds: {},
  preferredLanguages: {},
  preferredMoods: {
    peaceful: 50,
    happy: 50,
    romantic: 50,
    confident: 50,
    energised: 50,
    nostalgic: 50,
    elegant: 50,
    comforted: 50,
    dramatic: 50,
  },
  soundEffects: true,
  soundVolume: 32,
  reducedMotion: false,
  highContrast: false,
  selectedStreamingService: streamingService,
  playbackPreference: 'automatic',
  embedConsent: 'ask',
  allowOfficialAlternateVersions,
  allowPreviewsWhenFullSongsUnavailable: false,
  completedOnboarding: false,
  favouriteStationCounts: {},
  lastTarget: null,
  semanticMode: 'ask',
})

type LegacyState = {
  schemaVersion?: number
  favourites?: unknown
  lovedTrackIds?: unknown
  history?: unknown
  soundEffects?: unknown
  reducedMotion?: unknown
  selectedStreamingService?: unknown
}

export const migrateListenerState = (
  raw: unknown,
  streamingService: StreamingService = 'spotify',
  allowOfficialAlternateVersions = true,
): ListenerState => {
  const current = listenerStateSchema.safeParse(raw)
  if (current.success) return current.data

  if (!raw || typeof raw !== 'object') return createDefaultListenerState(streamingService, allowOfficialAlternateVersions)
  const legacy = raw as LegacyState
  if (legacy.schemaVersion === 2 || legacy.schemaVersion === 3) {
    const defaults = createDefaultListenerState(streamingService, allowOfficialAlternateVersions)
    const versionTwo = raw as Record<string, unknown>
    const migrated = {
      ...versionTwo,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      preferredCollections: versionTwo.preferredCollections ?? {},
      preferredVersionTypes: versionTwo.preferredVersionTypes ?? {},
      preferredArtistIds: versionTwo.preferredArtistIds ?? {},
      preferredLanguages: versionTwo.preferredLanguages ?? {},
      semanticMode: versionTwo.semanticMode ?? 'ask',
      listeningHistory: versionTwo.listeningHistory ?? [],
      playbackEvents: versionTwo.playbackEvents ?? [],
      playbackPreference: versionTwo.playbackPreference ?? 'automatic',
      embedConsent: versionTwo.embedConsent ?? 'ask',
      allowOfficialAlternateVersions: versionTwo.allowOfficialAlternateVersions ?? defaults.allowOfficialAlternateVersions,
      allowPreviewsWhenFullSongsUnavailable: versionTwo.allowPreviewsWhenFullSongsUnavailable ?? false,
    }
    const result = listenerStateSchema.safeParse(migrated)
    return result.success ? result.data : defaults
  }
  if (legacy.schemaVersion !== 1) return createDefaultListenerState(streamingService, allowOfficialAlternateVersions)

  const defaults = createDefaultListenerState(streamingService, allowOfficialAlternateVersions)
  const loved = Array.isArray(legacy.lovedTrackIds)
    ? legacy.lovedTrackIds
    : Array.isArray(legacy.favourites)
      ? legacy.favourites
      : []
  const candidate: ListenerState = {
    ...defaults,
    lovedTrackIds: loved.filter((value): value is string => typeof value === 'string'),
    history: Array.isArray(legacy.history)
      ? legacy.history
          .filter(
            (entry): entry is { trackId: string; timestamp: number } =>
              Boolean(entry) &&
              typeof entry === 'object' &&
              typeof (entry as { trackId?: unknown }).trackId === 'string' &&
              typeof (entry as { timestamp?: unknown }).timestamp === 'number',
          )
          .map((entry) => ({
            trackId: entry.trackId,
            timestamp: entry.timestamp,
            moodId: 'unknown',
            stationName: 'Previous station',
            target: defaults.preferredMoods,
          }))
      : [],
    soundEffects:
      typeof legacy.soundEffects === 'boolean' ? legacy.soundEffects : defaults.soundEffects,
    reducedMotion:
      typeof legacy.reducedMotion === 'boolean' ? legacy.reducedMotion : defaults.reducedMotion,
    selectedStreamingService: streamingServiceSchema.safeParse(legacy.selectedStreamingService)
      .success
      ? (legacy.selectedStreamingService as StreamingService)
      : defaults.selectedStreamingService,
  }
  return listenerStateSchema.parse(candidate)
}

const canUseStorage = () => typeof window !== 'undefined' && 'localStorage' in window

export class ListenerStorage {
  private readonly key: string
  private readonly eventName: string
  private snapshot: ListenerState

  constructor(
    slug: string,
    private readonly defaultService: StreamingService = 'spotify',
    private readonly defaultAllowOfficialAlternateVersions = true,
  ) {
    this.key = `pink-fm:listener:v${STORAGE_SCHEMA_VERSION}:${slug}`
    this.eventName = `pink-fm:storage:${slug}`
    this.snapshot = this.read()
  }

  private read() {
    if (!canUseStorage()) return createDefaultListenerState(this.defaultService, this.defaultAllowOfficialAlternateVersions)
    try {
      const value = window.localStorage.getItem(this.key)
      if (value) return migrateListenerState(JSON.parse(value) as unknown, this.defaultService, this.defaultAllowOfficialAlternateVersions)
      const slug = this.key.split(':').at(-1) ?? ''
      for (const version of [3, 2, 1]) {
        const legacyKey = `pink-fm:listener:v${version}:${slug}`
        const legacyValue = window.localStorage.getItem(legacyKey)
        if (!legacyValue) continue
        const migrated = migrateListenerState(
          JSON.parse(legacyValue) as unknown,
          this.defaultService,
          this.defaultAllowOfficialAlternateVersions,
        )
        window.localStorage.setItem(this.key, JSON.stringify(migrated))
        return migrated
      }
      return createDefaultListenerState(this.defaultService, this.defaultAllowOfficialAlternateVersions)
    } catch {
      return createDefaultListenerState(this.defaultService, this.defaultAllowOfficialAlternateVersions)
    }
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener: () => void) => {
    if (!canUseStorage()) return () => undefined
    const onCustom = () => {
      this.snapshot = this.read()
      listener()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === this.key) onCustom()
    }
    window.addEventListener(this.eventName, onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(this.eventName, onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }

  update(updater: (previous: ListenerState) => ListenerState) {
    const next = listenerStateSchema.parse(updater(this.snapshot))
    this.snapshot = next
    if (canUseStorage()) {
      try {
        window.localStorage.setItem(this.key, JSON.stringify(next))
      } catch {
        // Keep an in-memory session when persistent browser storage is unavailable.
      }
      window.dispatchEvent(new Event(this.eventName))
    }
    return next
  }

  reset() {
    this.snapshot = createDefaultListenerState(this.defaultService, this.defaultAllowOfficialAlternateVersions)
    if (canUseStorage()) {
      try {
        const slug = this.key.split(':').at(-1) ?? ''
        for (const version of [STORAGE_SCHEMA_VERSION, 3, 2, 1]) {
          window.localStorage.removeItem(`pink-fm:listener:v${version}:${slug}`)
        }
      } catch {
        // Reset the in-memory state even when persistent storage cannot be changed.
      }
      window.dispatchEvent(new Event(this.eventName))
    }
    return this.snapshot
  }
}

export const appendPlaybackEvent = (
  state: ListenerState,
  event: PlaybackEventRecord,
  historyEntry?: HistoryEntry,
): ListenerState => ({
  ...state,
  playbackEvents: [event, ...state.playbackEvents].slice(0, 240),
  playCounts: event.type === 'playback-started'
    ? { ...state.playCounts, [event.trackId]: (state.playCounts[event.trackId] ?? 0) + 1 }
    : state.playCounts,
  listeningHistory: event.type === 'playback-started' && historyEntry
    ? [historyEntry, ...state.listeningHistory].slice(0, 80)
    : state.listeningHistory,
})

const blendMoodPreference = (current: MoodVector, track: Track, strength = 0.08): MoodVector =>
  Object.fromEntries(
    Object.entries(current).map(([key, value]) => [
      key,
      Math.round(value * (1 - strength) + track.moods[key as keyof MoodVector] * strength),
    ]),
  ) as MoodVector

const incrementAffinities = (
  current: Record<string, number>,
  values: string[],
) =>
  values.reduce<Record<string, number>>(
    (next, value) => ({ ...next, [value]: (next[value] ?? 0) + 1 }),
    current,
  )

export const learnFromLovedTrack = (state: ListenerState, track: Track): ListenerState => ({
  ...state,
  lovedTrackIds: state.lovedTrackIds.includes(track.id)
    ? state.lovedTrackIds.filter((id) => id !== track.id)
    : [...state.lovedTrackIds, track.id],
  preferredMoods: state.lovedTrackIds.includes(track.id)
    ? state.preferredMoods
    : blendMoodPreference(state.preferredMoods, track),
  preferredEras: track.era
    ? { ...state.preferredEras, [track.era]: (state.preferredEras[track.era] ?? 0) + 1 }
    : state.preferredEras,
  preferredCollections: state.lovedTrackIds.includes(track.id)
    ? state.preferredCollections
    : incrementAffinities(state.preferredCollections, track.collections),
  preferredVersionTypes: state.lovedTrackIds.includes(track.id)
    ? state.preferredVersionTypes
    : incrementAffinities(state.preferredVersionTypes, [track.versionType]),
  preferredArtistIds: state.lovedTrackIds.includes(track.id)
    ? state.preferredArtistIds
    : incrementAffinities(state.preferredArtistIds, [track.primaryArtistId]),
  preferredLanguages: state.lovedTrackIds.includes(track.id)
    ? state.preferredLanguages
    : incrementAffinities(state.preferredLanguages, track.languages),
})
