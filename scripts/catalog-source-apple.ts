import { resolve } from 'node:path'
import { argumentValue, writeJsonFile } from './catalog-shared.ts'

type AppleResult = {
  wrapperType?: string
  artistId?: number
  artistName?: string
  collectionId?: number
  collectionName?: string
  collectionViewUrl?: string
  trackId?: number
  trackName?: string
  trackViewUrl?: string
  releaseDate?: string
  primaryGenreName?: string
  trackCount?: number
  trackNumber?: number
  discNumber?: number
}

type AppleResponse = {
  resultCount: number
  results: AppleResult[]
}

const artistId = argumentValue('--artist-id') ?? '102288156'
const country = argumentValue('--country') ?? 'my'
const outputArgument = argumentValue('--output')
const releaseIds = (argumentValue('--release-ids') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

if (!outputArgument) {
  throw new Error(
    'Usage: tsx scripts/catalog-source-apple.ts --artist-id <id> --release-ids <ids> --output <file>',
  )
}
if (releaseIds.length === 0) {
  throw new Error('At least one explicit --release-ids value is required.')
}

const request = async (url: string) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Pink-FM-Catalog-Audit/2.0' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('Apple catalogue request failed: HTTP ' + response.status)
  return (await response.json()) as AppleResponse
}

const artistLookupUrl =
  'https://itunes.apple.com/lookup?id=' +
  encodeURIComponent(artistId) +
  '&entity=album&limit=200&country=' +
  encodeURIComponent(country)
const artistResponse = await request(artistLookupUrl)
const artist = artistResponse.results.find((result) => result.wrapperType === 'artist')
const albums = new Map(
  artistResponse.results
    .filter(
      (result) =>
        result.wrapperType === 'collection' && result.collectionId !== undefined,
    )
    .map((result) => [String(result.collectionId), result]),
)

const releases = []
for (let index = 0; index < releaseIds.length; index += 5) {
  const batch = releaseIds.slice(index, index + 5)
  const loaded = await Promise.all(
    batch.map(async (releaseId) => {
      const url =
        'https://itunes.apple.com/lookup?id=' +
        encodeURIComponent(releaseId) +
        '&entity=song&country=' +
        encodeURIComponent(country)
      const response = await request(url)
      const album =
        response.results.find((result) => result.wrapperType === 'collection') ??
        albums.get(releaseId)
      if (!album) throw new Error('Release not found in Apple response: ' + releaseId)
      const tracks = response.results
        .filter(
          (result) =>
            result.wrapperType === 'track' &&
            result.trackId !== undefined &&
            result.trackName &&
            result.trackViewUrl,
        )
        .map((track) => ({
          trackId: track.trackId,
          title: track.trackName,
          artist: track.artistName ?? artist?.artistName ?? '',
          collectionId: track.collectionId ?? album.collectionId,
          album: track.collectionName ?? album.collectionName ?? '',
          releaseDate: track.releaseDate ?? album.releaseDate ?? null,
          genre: track.primaryGenreName ?? album.primaryGenreName ?? '',
          trackNumber: track.trackNumber ?? null,
          discNumber: track.discNumber ?? null,
          officialAppleMusicUrl: track.trackViewUrl,
        }))
      return {
        collectionId: album.collectionId,
        album: album.collectionName ?? '',
        releaseDate: album.releaseDate ?? null,
        trackCount: album.trackCount ?? tracks.length,
        genre: album.primaryGenreName ?? '',
        officialAppleMusicUrl: album.collectionViewUrl ?? '',
        tracks,
      }
    }),
  )
  releases.push(...loaded)
}

const snapshot = {
  schemaVersion: 1,
  fetchedAt: new Date().toISOString(),
  provider: 'Apple Music / iTunes Search API',
  artist: {
    id: Number(artistId),
    name: artist?.artistName ?? 'Siti Nurhaliza',
    officialArtistUrl: 'https://music.apple.com/my/artist/siti-nurhaliza/' + artistId,
  },
  request: {
    country,
    releaseIds,
  },
  releases,
}

const output = resolve(process.cwd(), outputArgument)
writeJsonFile(output, snapshot)
console.log('Apple catalogue snapshot written: ' + output)
console.log('Releases: ' + releases.length)
console.log(
  'Tracks: ' +
    releases.reduce((total, release) => total + release.tracks.length, 0),
)
