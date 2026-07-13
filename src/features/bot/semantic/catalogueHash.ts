import type { Collection, Track } from '../../../config/schemas'

export const semanticCataloguePayload = (tracks: Track[], collections: Collection[]) => ({
  tracks: tracks
    .filter((track) => track.active)
    .map((track) => ({
      id: track.id,
      title: track.title,
      album: track.album,
      artist: track.artist,
      languages: track.languages,
      collections: track.collections,
      semanticDescription: track.semanticDescription,
      vocalCharacter: track.vocalCharacter,
      instrumentalCharacter: track.instrumentalCharacter,
      useCases: track.useCases,
    }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  collections: collections
    .filter((collection) => collection.active)
    .map((collection) => ({
      id: collection.id,
      semanticDescription: collection.semanticDescription,
    }))
    .sort((left, right) => left.id.localeCompare(right.id)),
})

export const browserCatalogueContentHash = async (
  tracks: Track[],
  collections: Collection[],
) => {
  const bytes = new TextEncoder().encode(
    JSON.stringify(semanticCataloguePayload(tracks, collections)),
  )
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
