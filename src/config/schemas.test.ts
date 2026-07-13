import { giftSchema, moodsFileSchema, tracksFileSchema } from './schemas'
import { makeGift, makeMood, makeTrack } from '../test/fixtures'

describe('profile configuration schemas', () => {
  it('accepts a valid gift profile', () => {
    expect(giftSchema.safeParse(makeGift()).success).toBe(true)
  })

  it('rejects mood values outside zero to one hundred', () => {
    const mood = makeMood()
    const invalid = {
      schemaVersion: 1,
      moods: [{ ...mood, target: { ...mood.target, peaceful: 101 } }],
    }
    expect(moodsFileSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects duplicate track IDs', () => {
    const result = tracksFileSchema.safeParse({
      schemaVersion: 1,
      tracks: [makeTrack('same'), makeTrack('same')],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.message).toContain('Duplicate track id')
  })
})
