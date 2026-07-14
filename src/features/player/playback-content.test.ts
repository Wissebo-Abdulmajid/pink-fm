import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { catalogSourcesSchema, tracksFileSchema, youtubeAuthoritiesFileSchema } from '../../config/schemas'
import { parseSpotifyUrl } from './providers/spotify/spotify-url'
import { isRadioEligible } from '../recommendations/full-playback'

const read = (path: string) => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as unknown

describe('catalogue playback integrity', () => {
  const tracks = tracksFileSchema.parse(read('public/gifts/siti/tracks.json')).tracks
  const sources = catalogSourcesSchema.parse(read('public/gifts/siti/catalog-sources.json'))
  const authorities = youtubeAuthoritiesFileSchema.parse(read('public/gifts/siti/youtube-authorities.json'))

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
    const channelIds = new Set(authorities.channels.map((channel) => channel.channelId))
    tracks.flatMap((track) => track.playback.youtube ? [track.playback.youtube] : []).forEach((youtube) => {
      expect(youtube.verifiedOfficial).toBe(true)
      expect(sourceIds.has(youtube.sourceId)).toBe(true)
    })
    tracks.flatMap((track) => track.fullPlaybackSources).forEach((source) => {
      expect(source.provider).toBe('youtube')
      expect(source.verified).toBe(true)
      expect(source.embeddable).toBe(true)
      expect(source.fullLength).toBe(true)
      expect(sourceIds.has(source.provenanceSourceId)).toBe(true)
      expect(channelIds.has(source.channelId)).toBe(true)
    })
  })

  it('counts only full-subscription-free tracks as guaranteed radio coverage', () => {
    const full = tracks.filter((track) => isRadioEligible(track))
    expect(full).toHaveLength(15)
    expect(tracks.filter((track) => track.playbackCoverage === 'preview-only')).toHaveLength(127)
    expect(full.every((track) => track.fullPlaybackSources.some((source) => source.priority === 1))).toBe(true)
  })

  it('emits a structurally sound playback audit', () => {
    const audit = read('docs/phase-4-playback-audit.json') as { schemaVersion?: unknown; totals?: Record<string, unknown>; coverageByMood?: unknown }
    expect(audit.schemaVersion).toBe(1)
    expect(audit.totals?.activeTracks).toBe(142)
    expect(audit.totals?.spotifyEmbedPlayableTracks).toBe(11)
    expect(audit.coverageByMood).toBeTruthy()
  })
})
