const TRACK_ID = /^[A-Za-z0-9]{22}$/
const LOCALE_PREFIX = /^intl-[a-z]{2,5}(?:-[a-z]{2})?$/i

export type SpotifyEntityType = 'track' | 'album' | 'playlist' | 'artist' | 'invalid'

export type SpotifyUrlResult = {
  entityType: SpotifyEntityType
  id: string | null
  uri: string | null
}

export const parseSpotifyUrl = (value: string): SpotifyUrlResult => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || url.username || url.password) {
      return { entityType: 'invalid', id: null, uri: null }
    }
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] && LOCALE_PREFIX.test(parts[0])) parts.shift()
    if (parts.length !== 2) return { entityType: 'invalid', id: null, uri: null }
    const [entity, id] = parts
    if (!['track', 'album', 'playlist', 'artist'].includes(entity ?? '')) {
      return { entityType: 'invalid', id: null, uri: null }
    }
    if (!id || !TRACK_ID.test(id)) return { entityType: 'invalid', id: null, uri: null }
    const entityType = entity as Exclude<SpotifyEntityType, 'invalid'>
    return {
      entityType,
      id,
      uri: entityType === 'track' ? `spotify:track:${id}` : null,
    }
  } catch {
    return { entityType: 'invalid', id: null, uri: null }
  }
}

export const spotifyTrackUri = (value: string) => {
  const parsed = parseSpotifyUrl(value)
  return parsed.entityType === 'track' ? parsed.uri : null
}

export const isSpotifyTrackUrl = (value: string) => spotifyTrackUri(value) !== null
