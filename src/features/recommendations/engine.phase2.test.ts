import { makeGift, makeTrack, listener, vector } from '../../test/fixtures'
import {
  createRecommendationQueue,
  filterCandidates,
  rankCandidates,
  recommendTrack,
} from './engine'

const baseRequest = (tracks = [makeTrack('base')]) => ({
  tracks,
  target: vector({ peaceful: 82, romantic: 72, elegant: 70, energised: 42 }),
  stationName: 'Evaluation',
  frequency: 'EV.1',
  listener: listener(),
})

describe('phase two recommendation quality controls', () => {
  it('prevents a provisional track from beating a similarly matched reviewed track', () => {
    const reviewed = makeTrack('reviewed', {
      moods: vector({ peaceful: 81, romantic: 71, elegant: 69, energised: 42 }),
      curationStatus: 'reviewed',
      curationConfidence: 0.9,
    })
    const provisional = makeTrack('provisional', {
      moods: vector({ peaceful: 82, romantic: 72, elegant: 70, energised: 42 }),
      curationStatus: 'provisional',
      curationConfidence: 0.45,
    })
    const result = recommendTrack(baseRequest([provisional, reviewed]))
    expect(result.track.id).toBe('reviewed')
  })

  it('still permits a provisional track when it is the only active candidate', () => {
    const provisional = makeTrack('provisional', {
      curationStatus: 'provisional',
      curationConfidence: 0.35,
    })
    expect(recommendTrack(baseRequest([provisional])).track.id).toBe('provisional')
  })

  it('uses requested collections as a weak ranking signal', () => {
    const romantic = makeTrack('romantic', { collections: ['romantic-siti'] })
    const hidden = makeTrack('hidden', { collections: ['hidden-gems'] })
    const result = recommendTrack({
      ...baseRequest([romantic, hidden]),
      context: { preferredCollections: ['hidden-gems'] },
    })
    expect(result.track.id).toBe('hidden')
  })

  it('uses a preferred era without making it a hard filter', () => {
    const old = makeTrack('old', { era: '1990s classics', releaseYear: 1998, year: 1998 })
    const modern = makeTrack('modern', { era: 'recent releases', releaseYear: 2025, year: 2025 })
    const ranked = rankCandidates({
      ...baseRequest([old, modern]),
      context: { preferredEras: ['1990s classics'] },
    })
    expect(ranked[0]?.track.id).toBe('old')
    expect(ranked).toHaveLength(2)
  })

  it('honours a specific requested catalogue track', () => {
    const close = makeTrack('close', { moods: vector({ peaceful: 95 }) })
    const exact = makeTrack('exact', { moods: vector({ peaceful: 10 }) })
    const result = recommendTrack({
      ...baseRequest([close, exact]),
      context: { requestedTrackId: 'exact' },
    })
    expect(result.track.id).toBe('exact')
  })

  it('keeps primary-only profiles grounded in the configured artist', () => {
    const policy = makeGift().artistPolicy
    const primary = makeTrack('primary', { primaryArtistId: 'test-artist' })
    const secondary = makeTrack('secondary', { primaryArtistId: 'other-artist', artist: 'Other Artist' })
    const candidates = filterCandidates([secondary, primary], listener(), { artistPolicy: policy })
    expect(candidates.map((track) => track.id)).toEqual(['primary'])
  })

  it('allows configured featured-artist appearances in primary-only mode', () => {
    const policy = makeGift().artistPolicy
    const duet = makeTrack('duet', {
      primaryArtistId: 'other-artist',
      artist: 'Other Artist',
      featuredArtists: ['Test Artist'],
      featuredArtistIds: ['test-artist'],
      versionType: 'duet',
    })
    expect(filterCandidates([duet], listener(), { artistPolicy: policy })).toHaveLength(1)
  })

  it('strongly prefers the primary artist in primary-preferred mode', () => {
    const primary = makeTrack('primary', { primaryArtistId: 'test-artist' })
    const secondary = makeTrack('secondary', {
      primaryArtistId: 'other-artist',
      artist: 'Other Artist',
      moods: vector({ peaceful: 83, romantic: 73, elegant: 71, energised: 42 }),
    })
    const result = recommendTrack({
      ...baseRequest([secondary, primary]),
      context: {
        artistPolicy: {
          mode: 'primary-preferred',
          primaryArtistIds: ['test-artist'],
          allowFeaturedArtists: true,
          allowSecondaryCollection: true,
          secondaryCollectionId: 'malaysian-legends',
        },
      },
    })
    expect(result.track.id).toBe('primary')
  })

  it('excludes an explicitly rejected album', () => {
    const rejected = makeTrack('rejected', { album: 'Album A', albumId: 'album-a' })
    const available = makeTrack('available', { album: 'Album B', albumId: 'album-b' })
    const result = recommendTrack({
      ...baseRequest([rejected, available]),
      context: { excludedAlbumIds: ['album-a'] },
    })
    expect(result.track.id).toBe('available')
  })

  it('excludes tracks already used in the recommendation session', () => {
    const first = makeTrack('first')
    const second = makeTrack('second')
    const result = recommendTrack({
      ...baseRequest([first, second]),
      context: { sessionTrackIds: ['first'] },
    })
    expect(result.track.id).toBe('second')
  })

  it('creates a queue diversified across albums when alternatives are close', () => {
    const tracks = [
      makeTrack('a1', { album: 'A', albumId: 'a' }),
      makeTrack('a2', { album: 'A', albumId: 'a' }),
      makeTrack('a3', { album: 'A', albumId: 'a' }),
      makeTrack('b1', { album: 'B', albumId: 'b' }),
      makeTrack('c1', { album: 'C', albumId: 'c' }),
    ]
    const queue = createRecommendationQueue(baseRequest(tracks), 5)
    expect(new Set(queue.slice(0, 3).map((item) => item.track.albumId)).size).toBeGreaterThan(1)
  })

  it('favours deeper cuts when discovery is requested', () => {
    const familiar = makeTrack('familiar', { familiarity: 95 })
    const deep = makeTrack('deep', { familiarity: 15 })
    const ranked = rankCandidates({
      ...baseRequest([familiar, deep]),
      context: { noveltyPreference: 'novel', deepCut: true },
    })
    expect(ranked[0]?.track.id).toBe('deep')
  })

  it('favours the requested version type', () => {
    const studio = makeTrack('studio', { versionType: 'studio' })
    const duet = makeTrack('duet', { versionType: 'duet' })
    const result = recommendTrack({
      ...baseRequest([studio, duet]),
      context: { versionTypes: ['duet'] },
    })
    expect(result.track.id).toBe('duet')
  })
})
