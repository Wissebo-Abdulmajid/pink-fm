import {
  ListenerStorage,
  createDefaultListenerState,
  learnFromLovedTrack,
  migrateListenerState,
} from './storage'
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
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.lovedTrackIds).toContain('legacy-track')
    expect(migrated.soundEffects).toBe(false)
  })

  it('migrates version two into profile-scoped version three storage', () => {
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
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.lovedTrackIds).toContain('legacy-v2')
    expect(migrated.preferredCollections).toEqual({})
    expect(window.localStorage.getItem('pink-fm:listener:v3:migrated')).not.toBeNull()
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
    storage.reset()
    expect(storage.getSnapshot().lovedTrackIds).toEqual([])
    expect(window.localStorage.getItem('pink-fm:listener:v3:test')).toBeNull()
  })
})
