import { makeGift, makeMood, makeTrack, vector } from '../../test/fixtures'
import { HybridWisseBotProvider } from './hybrid-provider'
import type {
  BotCatalogue,
  ConversationContext,
  SemanticInterpreter,
} from './types'

const gift = makeGift()
const catalogue: BotCatalogue = {
  tracks: [
    makeTrack('calm', { semanticDescription: 'A quiet reflective song with gentle warmth.' }),
    makeTrack('bright', { semanticDescription: 'A cheerful energetic song for active moments.' }),
  ],
  collections: [],
  moods: [makeMood()],
  artistPolicy: gift.artistPolicy,
  primaryArtistName: gift.artist.name,
  primaryArtistId: gift.artist.slug,
}

const context = (overrides: Partial<ConversationContext> = {}): ConversationContext => ({
  messages: [],
  lastInterpretations: [],
  lastRecommendations: [],
  currentTarget: null,
  rejectedTrackIds: [],
  activeArtistPolicy: gift.artistPolicy,
  pendingClarification: null,
  previousRecommendedTrack: null,
  mostRecentRefinement: null,
  ...overrides,
})

const semantic = (overrides: Partial<Awaited<ReturnType<SemanticInterpreter['interpret']>>> = {}): SemanticInterpreter => ({
  interpret: async () => ({
    prototypeMatches: [
      { id: 'mood-peaceful', kind: 'mood', score: 0.91, payload: { mood: 'peaceful', strength: 82 } },
    ],
    trackScores: { calm: 0.92, bright: 0.54 },
    durationMs: 12,
    ...overrides,
  }),
})

describe('HybridWisseBotProvider', () => {
  it('uses a high-confidence semantic prototype for an indirect request', async () => {
    const provider = new HybridWisseBotProvider(catalogue, semantic())
    const result = await provider.interpret('I need a softer landing after a long day', context())
    expect(result.kind).toBe('recommendation')
    expect(result.mode).toBe('hybrid')
    expect(result.target?.peaceful).toBeGreaterThan(80)
    expect(result.constraints.semanticTrackScores?.calm).toBe(0.92)
  })

  it('keeps exact deterministic moods authoritative while adding retrieval scores', async () => {
    const provider = new HybridWisseBotProvider(
      catalogue,
      semantic({
        prototypeMatches: [
          { id: 'mood-dramatic', kind: 'mood', score: 0.9, payload: { mood: 'dramatic' } },
        ],
      }),
    )
    const result = await provider.interpret('something romantic and cheerful', context())
    expect(result.target?.romantic).toBeGreaterThan(90)
    expect(result.target?.happy).toBeGreaterThan(90)
    expect(result.evidence.filter((item) => item.concept === 'mood').map((item) => item.value)).not.toContain('dramatic')
    expect(result.evidence).toContainEqual(expect.objectContaining({ concept: 'semantic-retrieval' }))
  })

  it('falls back cleanly when semantic inference fails', async () => {
    const failing: SemanticInterpreter = { interpret: async () => { throw new Error('offline') } }
    const provider = new HybridWisseBotProvider(catalogue, failing)
    const result = await provider.interpret('tenang tapi tak mengantuk', context())
    expect(result.kind).toBe('recommendation')
    expect(result.mode).toBe('deterministic')
    expect(result.target?.energised).toBeGreaterThanOrEqual(48)
  })

  it('does not let semantic similarity reverse negation', async () => {
    const provider = new HybridWisseBotProvider(
      catalogue,
      semantic({
        prototypeMatches: [
          { id: 'mood-dramatic', kind: 'mood', score: 0.98, payload: { mood: 'dramatic' } },
        ],
      }),
    )
    const result = await provider.interpret('romantic but not dramatic', context())
    expect(result.request?.excludedMoods).toContain('dramatic')
    expect(result.target?.dramatic).toBeLessThan(50)
  })

  it('keeps low-confidence semantic input as a clarification', async () => {
    const provider = new HybridWisseBotProvider(
      catalogue,
      semantic({
        prototypeMatches: [
          { id: 'mood-peaceful', kind: 'mood', score: 0.62, payload: { mood: 'peaceful' } },
          { id: 'mood-happy', kind: 'mood', score: 0.61, payload: { mood: 'happy' } },
        ],
      }),
    )
    const result = await provider.interpret('hmm maybe something', context())
    expect(result.kind).toBe('clarification')
    expect(result.clarification?.choices.length).toBeGreaterThan(1)
  })

  it('does not override a targeted missing-context clarification', async () => {
    const provider = new HybridWisseBotProvider(catalogue, semantic())
    const result = await provider.interpret('more like the last song', context())
    expect(result.kind).toBe('clarification')
    expect(result.summary).toMatch(/current song|starting mood/i)
  })

  it('preserves previous romance while applying a semantic-assisted energy refinement', async () => {
    const provider = new HybridWisseBotProvider(catalogue, semantic())
    const previous = {
      targetMoods: vector({ romantic: 94, happy: 82, energised: 40 }),
      excludedMoods: [],
      exclusions: { trackIds: [], albumIds: [], artistIds: [] },
      surprise: false,
      confidence: 0.9,
      evidence: [],
    }
    const result = await provider.interpret('more energetic', context({ currentTarget: previous }))
    expect(result.target?.romantic).toBe(94)
    expect(result.target?.energised).toBeGreaterThan(40)
    expect(result.request?.relationToPrevious).toBe('more-energetic')
  })
})
