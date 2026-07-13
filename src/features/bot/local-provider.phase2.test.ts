import { makeGift, makeMood, makeTrack, vector } from '../../test/fixtures'
import { LocalWisseBotProvider } from './local-provider'
import type { BotCatalogue, ConversationContext, StructuredMusicRequest } from './types'

const previous = makeTrack('previous-song', {
  title: 'Previous Song',
  album: 'Previous Album',
  albumId: 'previous-album',
  era: '2000s evolution',
  releaseYear: 2004,
  year: 2004,
  intensity: 76,
  moods: vector({ romantic: 84, happy: 72, energised: 44, dramatic: 75 }),
})

const tracks = [
  makeTrack('purnama-merindu', {
    title: 'Purnama Merindu',
    album: 'Pancawarna',
    albumId: 'pancawarna',
    releaseYear: 1999,
    year: 1999,
    era: '1990s classics',
  }),
  makeTrack('cindai', {
    title: 'Cindai',
    album: 'Cindai',
    albumId: 'cindai',
    versionType: 'traditional',
    releaseYear: 1997,
    year: 1997,
    era: '1990s classics',
  }),
  makeTrack('aku', { title: 'Aku', releaseYear: 2012, year: 2012, era: '2010s contemporary' }),
  makeTrack('modern', { title: 'Modern Signal', releaseYear: 2024, year: 2024, era: 'recent releases' }),
  previous,
]

const gift = makeGift()
const catalogue: BotCatalogue = {
  tracks,
  collections: [
    {
      id: 'traditional-nusantara',
      label: 'Traditional and Nusantara',
      description: 'Traditional choices',
      active: true,
      kind: 'editorial',
      artistIds: ['test-artist'],
      semanticDescription: 'Traditional Malay character.',
      rankingWeight: 0.2,
    },
    {
      id: 'modern-siti',
      label: 'Modern Siti',
      description: 'Modern choices',
      active: true,
      kind: 'editorial',
      artistIds: ['test-artist'],
      semanticDescription: 'Modern catalogue choices.',
      rankingWeight: 0.2,
    },
  ],
  moods: [makeMood()],
  artistPolicy: gift.artistPolicy,
  primaryArtistName: gift.artist.name,
  primaryArtistId: gift.artist.slug,
}

const provider = new LocalWisseBotProvider(catalogue)

const context = (overrides: Partial<ConversationContext> = {}): ConversationContext => ({
  messages: [],
  lastInterpretations: [],
  lastRecommendations: [],
  currentTarget: null,
  rejectedTrackIds: [],
  activeArtistPolicy: gift.artistPolicy,
  pendingClarification: null,
  previousRecommendedTrack: previous,
  mostRecentRefinement: null,
  ...overrides,
})

describe('LocalWisseBotProvider phase two language and context', () => {
  it('understands Malay calmness without sleepiness', async () => {
    const result = await provider.interpret('nak lagu tenang tapi tak mengantuk', context())
    expect(result.kind).toBe('recommendation')
    expect(result.target?.peaceful).toBeGreaterThan(85)
    expect(result.target?.energised).toBeGreaterThanOrEqual(48)
    expect(result.constraints.minEnergy).toBe(35)
  })

  it('understands conversational Malay happiness', async () => {
    const result = await provider.interpret('saya nak rasa happy sikit', context())
    expect(result.target?.happy).toBeGreaterThan(90)
    expect(result.evidence).toContainEqual(expect.objectContaining({ concept: 'mood', value: 'happy' }))
  })

  it('combines English and Malay while respecting sadness negation', async () => {
    const result = await provider.interpret('something romantic tapi jangan sedih', context())
    expect(result.target?.romantic).toBeGreaterThan(90)
    expect(result.target?.happy).toBeGreaterThanOrEqual(72)
    expect(result.request?.excludedMoods).toContain('sad')
  })

  it('preserves the current mood when a mixed follow-up asks for more energy', async () => {
    const prior = (await provider.interpret('romantic and cheerful', context())).request
    expect(prior).not.toBeNull()
    const result = await provider.interpret(
      'yang macam tadi tapi lebih upbeat',
      context({ currentTarget: prior as StructuredMusicRequest }),
    )
    expect(result.request?.relationToPrevious).toBe('more-energetic')
    expect(result.target?.romantic).toBeGreaterThan(80)
    expect(result.target?.energised).toBeGreaterThan(prior?.targetMoods.energised ?? 0)
  })

  it('treats less romantic as a relative refinement', async () => {
    const prior: StructuredMusicRequest = {
      targetMoods: vector({ romantic: 92, happy: 76, elegant: 70 }),
      excludedMoods: [],
      exclusions: { trackIds: [], albumIds: [], artistIds: [] },
      surprise: false,
      confidence: 0.9,
      evidence: [],
    }
    const result = await provider.interpret('less romantic', context({ currentTarget: prior }))
    expect(result.target?.romantic).toBeLessThan(92)
    expect(result.target?.happy).toBe(76)
    expect(result.request?.excludedMoods).toContain('romantic')
  })

  it('resolves an exact configured title without inventing a song', async () => {
    const result = await provider.interpret('Please play Purnama Merindu', context())
    expect(result.kind).toBe('recommendation')
    expect(result.request?.requestedTrackId).toBe('purnama-merindu')
    expect(result.evidence).toContainEqual(expect.objectContaining({ source: 'entity-match' }))
  })

  it('recognises a Malay title request using bagi', async () => {
    const result = await provider.interpret('Please bagi Cindai', context())
    expect(result.kind).toBe('recommendation')
    expect(result.request?.requestedTrackId).toBe('cindai')
  })

  it('handles a reasonable title typo', async () => {
    const result = await provider.interpret('Play Purnma Merindu', context())
    expect(result.request?.requestedTrackId).toBe('purnama-merindu')
  })

  it('asks for confirmation when a fuzzy title is only moderately confident', async () => {
    const result = await provider.interpret('Play Purna Merin', context())
    expect(result.kind).toBe('clarification')
    expect(result.summary).toContain('Purnama Merindu')
  })

  it('does not overmatch a short ambiguous title fragment', async () => {
    const result = await provider.interpret('aku nak tenang', context())
    expect(result.request?.requestedTrackId).toBeUndefined()
    expect(result.target?.peaceful).toBeGreaterThan(85)
  })

  it('supports a traditional version request through data-driven collections', async () => {
    const result = await provider.interpret('nak lagu tradisional Siti', context())
    expect(result.request?.versionTypes).toContain('traditional')
    expect(result.request?.collectionIds).toContain('traditional-nusantara')
  })

  it('preserves mood while shifting to an older era', async () => {
    const prior: StructuredMusicRequest = {
      targetMoods: vector({ romantic: 91, happy: 80 }),
      excludedMoods: [],
      exclusions: { trackIds: [], albumIds: [], artistIds: [] },
      surprise: false,
      confidence: 0.9,
      evidence: [],
    }
    const result = await provider.interpret('like that but older', context({ currentTarget: prior }))
    expect(result.target?.romantic).toBeGreaterThan(85)
    expect(result.request?.era?.preferred).toContain('1990s classics')
  })

  it('excludes the previous track and album in follow-ups', async () => {
    const notTrack = await provider.interpret('not this song', context())
    expect(notTrack.request?.exclusions.trackIds).toContain(previous.id)
    const album = await provider.interpret('different album', context())
    expect(album.request?.exclusions.albumIds).toContain(previous.albumId)
  })

  it('clears conversational intent on start over', async () => {
    const result = await provider.interpret('mula semula', context())
    expect(result.resetContext).toBe(true)
    expect(result.kind).toBe('clarification')
  })

  it('asks a targeted question for an ambiguous power request', async () => {
    const result = await provider.interpret('Give me something powerful', context())
    expect(result.kind).toBe('conflict')
    expect(result.clarification?.choices).toHaveLength(3)
    expect(result.summary).toMatch(/vocals|energy|intensity/i)
  })

  it('refuses unsupported private facts and lyric generation', async () => {
    const privateResult = await provider.interpret('Tell me everything about Siti private life', context())
    const lyricResult = await provider.interpret('Give me the full lyrics to Cindai', context())
    expect(privateResult.kind).toBe('unsupported')
    expect(lyricResult.kind).toBe('unsupported')
    expect(lyricResult.summary).not.toContain('Cindai')
  })
})
