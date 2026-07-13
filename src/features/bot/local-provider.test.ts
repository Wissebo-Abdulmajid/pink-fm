import { makeTrack, vector } from '../../test/fixtures'
import { LocalWisseBotProvider } from './local-provider'
import type { ConversationContext } from './types'

const provider = new LocalWisseBotProvider()
const context = (overrides: Partial<ConversationContext> = {}): ConversationContext => ({
  currentTarget: null,
  previousRecommendedTrack: makeTrack('previous', {
    intensity: 72,
    moods: vector({ romantic: 80, energised: 46 }),
  }),
  mostRecentRefinement: null,
  messages: [],
  lastInterpretations: [],
  lastRecommendations: [],
  rejectedTrackIds: [],
  activeArtistPolicy: null,
  pendingClarification: null,
  ...overrides,
})

describe('LocalWisseBotProvider', () => {
  it('keeps peaceful music gently awake when asked for not sleepy', async () => {
    const result = await provider.interpret('Peaceful but not sleepy', context())
    expect(result.target?.peaceful).toBeGreaterThan(80)
    expect(result.target?.energised).toBeGreaterThanOrEqual(48)
    expect(result.summary).toContain('rather than something sleepy')
  })

  it('refines the previous target with more energy', async () => {
    const previous = vector({ energised: 40 })
    const result = await provider.interpret('More energetic', context({ currentTarget: previous }))
    expect(result.target?.energised).toBeGreaterThan(previous.energised)
    expect(result.refinement).toBe('more energetic')
  })

  it('reduces intensity', async () => {
    const previous = vector({ dramatic: 78 })
    const result = await provider.interpret('Less intense', context({ currentTarget: previous }))
    expect(result.target?.dramatic).toBeLessThan(previous.dramatic)
    expect(result.constraints.maxIntensity).toBeLessThan(72)
  })

  it('combines romantic and cheerful dimensions', async () => {
    const result = await provider.interpret('Something romantic and cheerful', context())
    expect(result.target?.romantic).toBeGreaterThan(90)
    expect(result.target?.happy).toBeGreaterThan(90)
  })

  it('activates novelty mode for Surprise me', async () => {
    const result = await provider.interpret('Surprise me', context())
    expect(result.constraints.surprise).toBe(true)
    expect(result.constraints.noveltyPreference).toBe('novel')
  })

  it('asks one concise clarification for unrecognised input', async () => {
    const result = await provider.interpret('flibbertigibbet', context())
    expect(result.kind).toBe('clarification')
    expect(result.summary.split('.').length).toBeLessThanOrEqual(3)
  })

  it('never identifies itself as the configured artist', async () => {
    const result = await provider.interpret('Something elegant', context())
    expect(result.summary.toLowerCase()).not.toContain('siti')
    expect(result.summary.toLowerCase()).not.toContain('i am the artist')
  })
})
