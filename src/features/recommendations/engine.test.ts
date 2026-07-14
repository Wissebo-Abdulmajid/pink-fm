import {
  deterministicTieBreak,
  noveltyScore,
  rankCandidates,
  recommendTrack,
} from './engine'
import { listener, makeTrack, vector } from '../../test/fixtures'

const request = (overrides: Partial<Parameters<typeof recommendTrack>[0]> = {}) => ({
  tracks: [
    makeTrack('calm', { moods: vector({ peaceful: 96, comforted: 86, energised: 20 }) }),
    makeTrack('loud', { moods: vector({ peaceful: 18, energised: 95, dramatic: 90 }) }),
  ],
  target: vector({ peaceful: 95, comforted: 85, energised: 18 }),
  stationName: 'Velvet Calm',
  frequency: '88.4',
  listener: listener(),
  ...overrides,
})

describe('recommendation engine', () => {
  it('ranks the highest mood match first', () => {
    expect(recommendTrack(request()).track.id).toBe('calm')
  })

  it('penalises a very recently played track', () => {
    const now = Date.now()
    const result = recommendTrack(
      request({
        tracks: [
          makeTrack('recent', { moods: vector({ peaceful: 95, comforted: 84 }) }),
          makeTrack('fresh', { moods: vector({ peaceful: 92, comforted: 82 }) }),
        ],
        listener: listener({
          history: [
            {
              trackId: 'recent',
              timestamp: now,
              moodId: 'peaceful',
              stationName: 'Velvet Calm',
              target: vector({ peaceful: 95 }),
            },
          ],
        }),
        context: { now },
      }),
    )
    expect(result.track.id).toBe('fresh')
  })

  it('applies the configured favourite boost', () => {
    const plain = makeTrack('plain', { moods: vector({ peaceful: 84 }) })
    const loved = makeTrack('loved', { moods: vector({ peaceful: 83 }) })
    const ranked = rankCandidates(
      request({ tracks: [plain, loved], listener: listener({ lovedTrackIds: ['loved'] }) }),
    )
    expect(ranked[0]?.track.id).toBe('loved')
    expect(ranked[0]?.contributions.affinity).toBeGreaterThan(0)
  })

  it('increases the novelty contribution for Surprise me', () => {
    const track = makeTrack('unknown', { familiarity: 10 })
    expect(noveltyScore(track, listener(), true)).toBeGreaterThan(
      noveltyScore(track, listener(), false),
    )
  })

  it('excludes inactive tracks', () => {
    const inactive = makeTrack('perfect-inactive', {
      active: false,
      moods: vector({ peaceful: 100, comforted: 100 }),
    })
    expect(recommendTrack(request({ tracks: [inactive, makeTrack('active')] })).track.id).toBe(
      'active',
    )
  })

  it('keeps the guaranteed radio queue on full-subscription-free tracks', () => {
    const preview = makeTrack('preview-best-match', {
      moods: vector({ peaceful: 100, comforted: 100 }),
      playbackCoverage: 'preview-only',
      fullPlaybackSources: [],
    })
    const full = makeTrack('full-second-match', {
      moods: vector({ peaceful: 88, comforted: 80 }),
    })
    const result = recommendTrack(request({
      tracks: [preview, full],
      context: { requireFullPlayback: true },
    }))
    expect(result.track.id).toBe('full-second-match')
  })

  it('allows previews only when the explicit fallback setting is enabled', () => {
    const preview = makeTrack('preview-only', {
      playbackCoverage: 'preview-only',
      fullPlaybackSources: [],
    })
    expect(() => recommendTrack(request({
      tracks: [preview],
      context: { requireFullPlayback: true },
    }))).toThrow(/No active tracks/)
    expect(recommendTrack(request({
      tracks: [preview],
      context: {
        requireFullPlayback: true,
        allowPreviewsWhenFullSongsUnavailable: true,
      },
    })).track.id).toBe('preview-only')
  })

  it('builds explanations from matched mood dimensions', () => {
    const result = recommendTrack(request())
    expect(result.matchedMoods).toContain('peaceful')
    expect(result.primaryReasons[0]).toMatch(/peaceful|comforting/)
  })

  it('uses deterministic tie-breaking', () => {
    const target = vector()
    expect(deterministicTieBreak('a', target)).toBe(deterministicTieBreak('a', target))
    expect(deterministicTieBreak('a', target, 'day-1')).toBe(
      deterministicTieBreak('a', target, 'day-1'),
    )
    expect(deterministicTieBreak('a', target, 'day-1')).not.toBe(
      deterministicTieBreak('a', target, 'day-2'),
    )
    const first = recommendTrack(
      request({ tracks: [makeTrack('z'), makeTrack('a')], target }),
    ).track.id
    const second = recommendTrack(
      request({ tracks: [makeTrack('a'), makeTrack('z')], target }),
    ).track.id
    expect(second).toBe(first)
  })

  it('rotates close clean-profile choices by day without overriding learned favourites', () => {
    const tracks = Array.from({ length: 8 }, (_, index) => makeTrack(`choice-${index}`, {
      album: `Album ${index}`,
      albumId: `album-${index}`,
      moods: vector({ peaceful: 91 - index, comforted: 82 - index }),
    }))
    const dayOne = recommendTrack(request({ tracks, context: { rotationSeed: 'day-1' } }))
    const dayOneAgain = recommendTrack(request({ tracks, context: { rotationSeed: 'day-1' } }))
    const acrossDays = new Set(Array.from({ length: 8 }, (_, index) =>
      recommendTrack(request({ tracks, context: { rotationSeed: `day-${index}` } })).track.id,
    ))

    expect(dayOneAgain.track.id).toBe(dayOne.track.id)
    expect(acrossDays.size).toBeGreaterThan(3)
    expect(recommendTrack(request({
      tracks,
      listener: listener({ lovedTrackIds: ['choice-7'] }),
      context: { rotationSeed: 'day-1' },
    })).track.id).toBe('choice-7')
  })
})
