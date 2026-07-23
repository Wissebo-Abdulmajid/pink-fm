import {
  ListenerStorage,
  appendPlaybackEvent,
  createDefaultListenerState,
  learnFromLovedTrack,
  migrateListenerState,
} from './storage'
import { createPlaybackEvent } from '../features/player/playback-events'
import { makeTrack } from '../test/fixtures'

describe('listener storage', () => {
  it('safely resets invalid stored JSON', () => {
    window.localStorage.setItem('pink-fm:listener:v2:test', '{not-json')
    expect(new ListenerStorage('test').getSnapshot()).toEqual(createDefaultListenerState('spotify'))
  })

  it('persists preferences across repository instances', () => {
    const first = new ListenerStorage('test')
    first.update((state) => ({ ...state, lovedTrackIds: ['track-a'] }))
    expect(new ListenerStorage('test').getSnapshot().lovedTrackIds).toEqual(['track-a'])
  })

  it('migrates version one favourites and settings', () => {
    const migrated = migrateListenerState({
      schemaVersion: 1,
      favourites: ['legacy-track'],
      soundEffects: false,
    })
    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.lovedTrackIds).toContain('legacy-track')
    expect(migrated.soundEffects).toBe(false)
  })

  it('migrates version two into profile-scoped version four storage', () => {
    const versionTwo = {
      ...createDefaultListenerState('spotify'),
      schemaVersion: 2,
      lovedTrackIds: ['legacy-v2'],
    }
    delete (versionTwo as Partial<typeof versionTwo>).preferredCollections
    delete (versionTwo as Partial<typeof versionTwo>).preferredVersionTypes
    delete (versionTwo as Partial<typeof versionTwo>).preferredArtistIds
    delete (versionTwo as Partial<typeof versionTwo>).preferredLanguages
    delete (versionTwo as Partial<typeof versionTwo>).semanticMode
    window.localStorage.setItem('pink-fm:listener:v2:migrated', JSON.stringify(versionTwo))
    const migrated = new ListenerStorage('migrated').getSnapshot()
    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.lovedTrackIds).toContain('legacy-v2')
    expect(migrated.preferredCollections).toEqual({})
    expect(window.localStorage.getItem('pink-fm:listener:v4:migrated')).not.toBeNull()
  })

  it('learns weak collection, version, artist and language affinities from love feedback', () => {
    const track = makeTrack('affinity', {
      collections: ['hidden-gems', 'modern-siti'],
      versionType: 'duet',
      primaryArtistId: 'test-artist',
      languages: ['ms', 'en'],
    })
    const learned = learnFromLovedTrack(createDefaultListenerState('spotify'), track)
    expect(learned.preferredCollections).toEqual({ 'hidden-gems': 1, 'modern-siti': 1 })
    expect(learned.preferredVersionTypes.duet).toBe(1)
    expect(learned.preferredArtistIds['test-artist']).toBe(1)
    expect(learned.preferredLanguages).toEqual({ ms: 1, en: 1 })
  })

  it('persists the semantic-mode choice per gift profile', () => {
    const storage = new ListenerStorage('semantic')
    storage.update((state) => ({ ...state, semanticMode: 'lightweight' }))
    expect(new ListenerStorage('semantic').getSnapshot().semanticMode).toBe('lightweight')
    expect(new ListenerStorage('other-profile').getSnapshot().semanticMode).toBe('ask')
  })

  it('clears saved data', () => {
    const storage = new ListenerStorage('test')
    storage.update((state) => ({ ...state, lovedTrackIds: ['track-a'] }))
    window.localStorage.setItem('pink-fm:listener:v2:test', JSON.stringify({ schemaVersion: 2 }))
    window.localStorage.setItem('pink-fm:listener:v1:test', JSON.stringify({ schemaVersion: 1 }))
    window.localStorage.setItem('unrelated-key', 'keep')
    storage.reset()
    expect(storage.getSnapshot().lovedTrackIds).toEqual([])
    expect(window.localStorage.getItem('pink-fm:listener:v4:test')).toBeNull()
    expect(window.localStorage.getItem('pink-fm:listener:v2:test')).toBeNull()
    expect(window.localStorage.getItem('pink-fm:listener:v1:test')).toBeNull()
    expect(window.localStorage.getItem('unrelated-key')).toBe('keep')
  })

  it('uses the profile alternate-version policy as the first-run default', () => {
    expect(new ListenerStorage('no-alternates', 'spotify', false).getSnapshot().allowOfficialAlternateVersions).toBe(false)
  })

  it('resets only the selected profile and leaves caches and other profiles alone', () => {
    const storage = new ListenerStorage('selected-profile')
    new ListenerStorage('other-profile').update((state) => ({ ...state, lovedTrackIds: ['keep-me'] }))
    storage.update((state) => ({ ...state, lovedTrackIds: ['remove-me'] }))
    storage.reset()
    expect(new ListenerStorage('other-profile').getSnapshot().lovedTrackIds).toEqual(['keep-me'])
  })

  it('does not count recommendations, iframe loads, external opens or failures as plays', () => {
    const initial = createDefaultListenerState('spotify')
    const types = ['recommended', 'player-loaded', 'externally-opened', 'failed'] as const
    const result = types.reduce(
      (state, type) => appendPlaybackEvent(state, createPlaybackEvent(type, 'track-a', 'spotify-embed')),
      initial,
    )
    expect(result.playCounts['track-a']).toBeUndefined()
    expect(result.playbackEvents).toHaveLength(4)
  })

  it('increments actual listening only when playback starts', () => {
    const initial = createDefaultListenerState('spotify')
    const historyEntry = { trackId: 'track-a', timestamp: 1, moodId: 'calm', stationName: 'Calm', target: initial.preferredMoods }
    const result = appendPlaybackEvent(initial, createPlaybackEvent('playback-started', 'track-a', 'spotify-embed'), historyEntry)
    expect(result.playCounts['track-a']).toBe(1)
    expect(result.listeningHistory[0]?.trackId).toBe('track-a')
  })

  it('records skips without incrementing play count', () => {
    const result = appendPlaybackEvent(
      createDefaultListenerState('spotify'),
      createPlaybackEvent('skipped', 'track-a', 'apple-preview'),
    )
    expect(result.playbackEvents[0]?.type).toBe('skipped')
    expect(result.playCounts['track-a']).toBeUndefined()
  })
})
