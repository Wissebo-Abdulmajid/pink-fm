import { describe, expect, it } from 'vitest'
import type { Collection, Track } from '../../../config/schemas'
import { makeTrack } from '../../../test/fixtures'
import { SemanticLiteInterpreter } from './semanticLite'

const tracks: Track[] = [
  makeTrack('calm', {
    title: 'Quiet Harbour',
    semanticDescription: 'A calm unhurried selection with warmth and stillness.',
    moods: {
      peaceful: 94, happy: 45, romantic: 35, confident: 30, energised: 22,
      nostalgic: 48, elegant: 68, comforted: 86, dramatic: 14,
    },
  }),
  makeTrack('bright', {
    title: 'Bright Steps',
    semanticDescription: 'A buoyant upbeat selection with cheerful forward movement.',
    moods: {
      peaceful: 20, happy: 92, romantic: 30, confident: 72, energised: 91,
      nostalgic: 22, elegant: 45, comforted: 48, dramatic: 38,
    },
  }),
]

const collections: Collection[] = [{
  id: 'hidden-gems',
  label: 'Hidden Gems',
  description: 'Less familiar discoveries',
  active: true,
  kind: 'editorial',
  artistIds: ['siti-nurhaliza'],
  semanticDescription: 'Deep catalogue discoveries beyond familiar hits.',
  rankingWeight: 0.2,
}]

describe('semantic-lite interpreter', () => {
  it('retrieves indirect peaceful language without a model download', async () => {
    const result = await new SemanticLiteInterpreter(tracks, collections)
      .interpret('I need room to breathe and something unhurried')

    expect(result.prototypeMatches[0]).toMatchObject({
      kind: 'mood',
      payload: { mood: 'peaceful' },
    })
    expect(result.trackScores.calm).toBeGreaterThan(result.trackScores.bright ?? 0)
  })

  it('recognises informal Malay concept vocabulary', async () => {
    const result = await new SemanticLiteInterpreter(tracks, collections)
      .interpret('nak yang boleh temani dan pujuk hati')

    expect(result.prototypeMatches.some((match) => match.payload.mood === 'comforted')).toBe(true)
  })

  it('tolerates a reasonable typo through character features', async () => {
    const result = await new SemanticLiteInterpreter(tracks, collections)
      .interpret('somthing energatic and brite')

    expect(result.prototypeMatches.some((match) => match.payload.mood === 'energised')).toBe(true)
  })

  it('returns only configured catalogue IDs', async () => {
    const result = await new SemanticLiteInterpreter(tracks, collections)
      .interpret('a cheerful selection with movement')

    expect(Object.keys(result.trackScores).every((id) => tracks.some((track) => track.id === id))).toBe(true)
  })
})
