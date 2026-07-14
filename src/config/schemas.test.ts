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

  it('rejects a Spotify album URL presented as track playback data', () => {
    const track = makeTrack('album-playback')
    expect(tracksFileSchema.safeParse({
      schemaVersion: 3,
      tracks: [{ ...track, playback: { ...track.playback, spotify: { url: 'https://open.spotify.com/album/5hYW2hAwvsaifyiNxDVVKC', entityType: 'track' } } }],
    }).success).toBe(false)
  })

  it('rejects unverified or unprovenanced YouTube playback records', () => {
    const track = makeTrack('youtube-schema')
    const candidate = { ...track, playback: { ...track.playback, youtube: { videoId: 'AbCdEfGhI_1', verifiedOfficial: false, sourceId: '' } } }
    expect(tracksFileSchema.safeParse({ schemaVersion: 3, tracks: [candidate] }).success).toBe(false)
  })

  it('rejects unsupported Apple embed hosts', () => {
    const track = makeTrack('apple-schema')
    const candidate = { ...track, playback: { ...track.playback, appleMusic: { url: 'https://music.apple.com/my/album/test/1?i=2', embedUrl: 'https://example.com/embed/1', playbackType: 'preview-or-external' } } }
    expect(tracksFileSchema.safeParse({ schemaVersion: 3, tracks: [candidate] }).success).toBe(false)
  })
})
