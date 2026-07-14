import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { catalogSourcesSchema, tracksFileSchema } from '../../config/schemas'
import { parseSpotifyUrl } from './providers/spotify/spotify-url'

const read = (path: string) => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as unknown

describe('catalogue playback integrity', () => {
  const tracks = tracksFileSchema.parse(read('public/gifts/siti/tracks.json')).tracks
  const sources = catalogSourcesSchema.parse(read('public/gifts/siti/catalog-sources.json'))

  it('derives every Spotify embed from a valid direct official track link', () => {
    const playable = tracks.filter((track) => parseSpotifyUrl(track.officialLinks.spotify).entityType === 'track')
    expect(playable).toHaveLength(11)
    playable.forEach((track) => expect(parseSpotifyUrl(track.officialLinks.spotify).uri).toMatch(/^spotify:track:/))
  })

  it('does not count Spotify album links as track playable', () => {
    const albumLinks = tracks.filter((track) => parseSpotifyUrl(track.officialLinks.spotify).entityType === 'album')
    expect(albumLinks.map((track) => track.id)).toEqual(['aku-cinta-padamu'])
    albumLinks.forEach((track) => expect(parseSpotifyUrl(track.officialLinks.spotify).uri).toBeNull())
  })

  it('requires official verification and source provenance for every YouTube record', () => {
    const sourceIds = new Set(sources.sources.map((source) => source.id))
    tracks.flatMap((track) => track.playback.youtube ? [track.playback.youtube] : []).forEach((youtube) => {
      expect(youtube.verifiedOfficial).toBe(true)
      expect(sourceIds.has(youtube.sourceId)).toBe(true)
    })
  })

  it('emits a structurally sound playback audit', () => {
    const audit = read('docs/phase-4-playback-audit.json') as { schemaVersion?: unknown; totals?: Record<string, unknown>; coverageByMood?: unknown }
    expect(audit.schemaVersion).toBe(1)
    expect(audit.totals?.activeTracks).toBe(142)
    expect(audit.totals?.spotifyEmbedPlayableTracks).toBe(11)
    expect(audit.coverageByMood).toBeTruthy()
  })
})
