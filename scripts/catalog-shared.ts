import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  catalogSourcesSchema,
  collectionsFileSchema,
  moodDimensionKeys,
  moodsFileSchema,
  trackSchema,
  tracksFileSchema,
  type CatalogSources,
  type CollectionsFile,
  type MoodDimension,
  type MoodsFile,
  type Track,
  type TracksFile,
} from '../src/config/schemas.ts'

export const projectRoot = fileURLToPath(new URL('..', import.meta.url))
export const giftsRoot = resolve(projectRoot, 'public', 'gifts')

export const profilePathFor = (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Invalid profile slug: ' + slug)
  }
  return resolve(giftsRoot, slug)
}

export const readJsonFile = (file: string): unknown => {
  if (!existsSync(file)) throw new Error('File not found: ' + file)
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown
  } catch (error) {
    throw new Error(
      'Malformed JSON in ' +
        file +
        ': ' +
        (error instanceof Error ? error.message : 'unknown parse error'),
      { cause: error },
    )
  }
}

export const writeJsonFile = (file: string, value: unknown) => {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

export type LoadedCatalog = {
  profilePath: string
  tracks: TracksFile
  moods: MoodsFile
  collections: CollectionsFile
  sources: CatalogSources
}

export const loadCatalog = (slug: string): LoadedCatalog => {
  const profilePath = profilePathFor(slug)
  return {
    profilePath,
    tracks: tracksFileSchema.parse(readJsonFile(resolve(profilePath, 'tracks.json'))),
    moods: moodsFileSchema.parse(readJsonFile(resolve(profilePath, 'moods.json'))),
    collections: collectionsFileSchema.parse(
      readJsonFile(resolve(profilePath, 'collections.json')),
    ),
    sources: catalogSourcesSchema.parse(
      readJsonFile(resolve(profilePath, 'catalog-sources.json')),
    ),
  }
}

export const normaliseText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .toLocaleLowerCase('en')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')

export const normaliseTitle = (value: string) => normaliseText(value)

export const normaliseProviderUrl = (value: string) => {
  if (!value) return ''
  const parsed = new URL(value)
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}

export const primaryRecordingKey = (track: Track) => {
  const title = normaliseTitle(track.title)
    .replace(/\b(remaster(?:ed)?|radio edit|single version)\b/g, '')
    .trim()
  return [
    title,
    track.primaryArtistId,
    track.versionType,
    track.featuredArtistIds.slice().sort().join(','),
  ].join('|')
}

export const providerUrls = (track: Track) =>
  Object.entries(track.officialLinks)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([provider, url]) => ({
      provider,
      url: normaliseProviderUrl(url),
    }))

export const primaryMoodFor = (track: Track): MoodDimension =>
  moodDimensionKeys
    .slice()
    .sort((left, right) => track.moods[right] - track.moods[left])[0] ?? 'peaceful'

export const countBy = <T>(values: T[], key: (value: T) => string) =>
  values.reduce<Record<string, number>>((counts, value) => {
    const label = key(value) || '(unspecified)'
    counts[label] = (counts[label] ?? 0) + 1
    return counts
  }, {})

export const sortedCounts = (counts: Record<string, number>) =>
  Object.entries(counts).sort(
    ([leftLabel, left], [rightLabel, right]) =>
      right - left || leftLabel.localeCompare(rightLabel),
  )

export const moodVectorKey = (track: Track) =>
  moodDimensionKeys.map((dimension) => track.moods[dimension]).join(',')

export const catalogueSemanticPayload = (
  tracks: Track[],
  collections: CollectionsFile['collections'],
) => ({
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

export const catalogueContentHash = (
  tracks: Track[],
  collections: CollectionsFile['collections'],
) =>
  createHash('sha256')
    .update(JSON.stringify(catalogueSemanticPayload(tracks, collections)))
    .digest('hex')

export const parseTrackRecords = (records: unknown[]) =>
  records.map((record, index) => {
    const result = trackSchema.safeParse(record)
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => {
          const path = issue.path.length ? issue.path.join('.') : 'track'
          return path + ': ' + issue.message
        })
        .join('; ')
      throw new Error('Invalid imported track at index ' + index + ': ' + details)
    }
    return result.data
  })

export const argumentValue = (name: string) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

export const hasArgument = (name: string) => process.argv.includes(name)
