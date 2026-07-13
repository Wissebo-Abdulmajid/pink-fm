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

  it('builds explanations from matched mood dimensions', () => {
    const result = recommendTrack(request())
    expect(result.matchedMoods).toContain('peaceful')
    expect(result.primaryReasons[0]).toMatch(/peaceful|comforting/)
  })

  it('uses deterministic tie-breaking', () => {
    const target = vector()
    expect(deterministicTieBreak('a', target)).toBe(deterministicTieBreak('a', target))
    const first = recommendTrack(
      request({ tracks: [makeTrack('z'), makeTrack('a')], target }),
    ).track.id
    const second = recommendTrack(
      request({ tracks: [makeTrack('a'), makeTrack('z')], target }),
    ).track.id
    expect(second).toBe(first)
  })
})
