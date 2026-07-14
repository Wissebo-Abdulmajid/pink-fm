import { parseSpotifyUrl, spotifyTrackUri } from './spotify-url'

const id = '5hYW2hAwvsaifyiNxDVVKC'

describe('Spotify track URL parsing', () => {
  it.each([
    [`https://open.spotify.com/track/${id}`, `spotify:track:${id}`],
    [`https://open.spotify.com/track/${id}?si=VALUE`, `spotify:track:${id}`],
    [`https://open.spotify.com/intl-ms/track/${id}`, `spotify:track:${id}`],
  ])('accepts %s', (url, uri) => expect(spotifyTrackUri(url)).toBe(uri))

  it.each([
    [`https://open.spotify.com/album/${id}`, 'album'],
    [`https://open.spotify.com/playlist/${id}`, 'playlist'],
    [`https://open.spotify.com/artist/${id}`, 'artist'],
  ])('classifies but does not play %s', (url, kind) => {
    expect(parseSpotifyUrl(url).entityType).toBe(kind)
    expect(spotifyTrackUri(url)).toBeNull()
  })

  it.each([
    `https://example.com/track/${id}`,
    'javascript:alert(1)',
    'https://open.spotify.com/track/short',
    `https://open.spotify.com.evil.test/track/${id}`,
  ])('rejects unsafe or malformed URL %s', (url) => expect(spotifyTrackUri(url)).toBeNull())
})
