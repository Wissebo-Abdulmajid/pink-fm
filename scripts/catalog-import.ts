import { extname, resolve } from 'node:path'
import {
  argumentValue,
  hasArgument,
  normaliseProviderUrl,
  parseTrackRecords,
  primaryRecordingKey,
  profilePathFor,
  providerUrls,
  readJsonFile,
  writeJsonFile,
} from './catalog-shared.ts'
import {
  tracksFileSchema,
  type Track,
  type TracksFile,
} from '../src/config/schemas.ts'

const usage =
  'Usage: npm run catalog:import -- --slug <slug> --input <csv-or-json> [--apply] (legacy alias: --file)'

const parseCsv = (source: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? ''
    const next = source[index + 1]
    if (character === '"' && quoted && next === '"') {
      field += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      row.push(field)
      field = ''
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
    } else {
      field += character
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  if (rows.length < 2) return []
  const headers = rows[0]?.map((header) => header.trim()) ?? []
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
  )
}

const jsonField = (value: string, fallback: unknown) => {
  if (!value.trim()) return fallback
  return JSON.parse(value) as unknown
}

const csvRecordToTrack = (record: Record<string, string>) => ({
  ...record,
  year: record.year ? Number(record.year) : null,
  releaseYear: record.releaseYear ? Number(record.releaseYear) : null,
  releaseDate: record.releaseDate || null,
  active: record.active ? record.active.toLowerCase() !== 'false' : true,
  isPrimaryVersion:
    record.isPrimaryVersion
      ? record.isPrimaryVersion.toLowerCase() !== 'false'
      : true,
  curationConfidence: Number(record.curationConfidence || 0.6),
  intensity: Number(record.intensity || 50),
  familiarity: Number(record.familiarity || 50),
  featuredArtists: jsonField(record.featuredArtists ?? '', []),
  featuredArtistIds: jsonField(record.featuredArtistIds ?? '', []),
  languages: jsonField(record.languages ?? '', ['other']),
  genres: jsonField(record.genres ?? '', []),
  collections: jsonField(record.collections ?? '', []),
  contexts: jsonField(record.contexts ?? '', []),
  tags: jsonField(record.tags ?? '', []),
  moods: jsonField(record.moods ?? '', {}),
  emotionalArc: jsonField(
    record.emotionalArc ?? '',
    { opening: '', middle: '', ending: '' },
  ),
  vocalCharacter: jsonField(record.vocalCharacter ?? '', []),
  instrumentalCharacter: jsonField(record.instrumentalCharacter ?? '', []),
  useCases: jsonField(record.useCases ?? '', []),
  avoidWhen: jsonField(record.avoidWhen ?? '', []),
  sourceIds: jsonField(record.sourceIds ?? '', []),
  officialLinks: {
    youtube: record.youtube ?? '',
    spotify: record.spotify ?? '',
    appleMusic: record.appleMusic ?? '',
  },
  embed: {
    provider: record.embedProvider || 'none',
    url: record.embedUrl || null,
  },
  playback: jsonField(record.playback ?? '', {
    preferredProvider: 'automatic',
    spotify: null,
    youtube: null,
    appleMusic: null,
  }),
  artwork: record.artwork || null,
})

const loadImportRecords = async (file: string): Promise<unknown[]> => {
  if (extname(file).toLowerCase() === '.csv') {
    const { readFileSync } = await import('node:fs')
    return parseCsv(readFileSync(file, 'utf8')).map(csvRecordToTrack)
  }
  const raw = readJsonFile(file)
  if (Array.isArray(raw)) return raw as unknown[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { tracks?: unknown }).tracks)) {
    return (raw as { tracks: unknown[] }).tracks
  }
  throw new Error('JSON import must be an array or an object containing a tracks array.')
}

const protectedEditorialFields: Array<keyof Track> = [
  'moods',
  'contexts',
  'tempoClass',
  'intensity',
  'familiarity',
  'editorialNote',
  'curationStatus',
  'curationConfidence',
]

const mergeTrack = (existing: Track, incoming: Track) => {
  const merged = { ...existing, ...incoming }
  if (existing.curationStatus === 'reviewed') {
    for (const field of protectedEditorialFields) {
      Object.assign(merged, { [field]: existing[field] })
    }
    merged.tags = [...new Set([...existing.tags, ...incoming.tags])]
    merged.collections = incoming.collections
    if (
      existing.semanticDescription &&
      existing.semanticDescription !== existing.editorialNote
    ) {
      merged.semanticDescription = existing.semanticDescription
    }
    if (Object.values(existing.emotionalArc).some(Boolean)) {
      merged.emotionalArc = existing.emotionalArc
    }
    if (existing.vocalCharacter.length > 0) {
      merged.vocalCharacter = existing.vocalCharacter
    }
    if (existing.instrumentalCharacter.length > 0) {
      merged.instrumentalCharacter = existing.instrumentalCharacter
    }
    if (existing.avoidWhen.length > 0) merged.avoidWhen = existing.avoidWhen
  }
  merged.sourceIds = [...new Set([...existing.sourceIds, ...incoming.sourceIds])].sort()
  return merged
}

const duplicateProblems = (tracks: Track[]) => {
  const problems: string[] = []
  const recordings = new Map<string, string>()
  const urls = new Map<string, string>()
  for (const track of tracks) {
    const recording = primaryRecordingKey(track)
    const previousRecording = recordings.get(recording)
    if (previousRecording && previousRecording !== track.id) {
      problems.push(
        'Likely duplicate primary recording: ' + previousRecording + ' and ' + track.id,
      )
    } else {
      recordings.set(recording, track.id)
    }
    for (const { provider, url } of providerUrls(track)) {
      const key = provider + ':' + normaliseProviderUrl(url)
      const previousUrl = urls.get(key)
      if (previousUrl && previousUrl !== track.id) {
        problems.push('Duplicate ' + provider + ' URL: ' + previousUrl + ' and ' + track.id)
      } else {
        urls.set(key, track.id)
      }
    }
  }
  return problems
}

const run = async () => {
  const slug = argumentValue('--slug')
  const fileArgument = argumentValue('--input') ?? argumentValue('--file')
  if (!slug || !fileArgument) throw new Error(usage)

  const profilePath = profilePathFor(slug)
  const tracksPath = resolve(profilePath, 'tracks.json')
  const existing = tracksFileSchema.parse(readJsonFile(tracksPath))
  const importPath = resolve(process.cwd(), fileArgument)
  const incoming = parseTrackRecords(await loadImportRecords(importPath))

  const byId = new Map(existing.tracks.map((track) => [track.id, track]))
  const additions: string[] = []
  const updates: string[] = []
  const unchanged: string[] = []

  for (const track of incoming) {
    const previous = byId.get(track.id)
    if (!previous) {
      byId.set(track.id, track)
      additions.push(track.id)
      continue
    }
    const merged = mergeTrack(previous, track)
    if (JSON.stringify(previous) === JSON.stringify(merged)) unchanged.push(track.id)
    else updates.push(track.id)
    byId.set(track.id, merged)
  }

  const output: TracksFile = {
    schemaVersion: 4,
    tracks: [...byId.values()],
  }
  const validated = tracksFileSchema.parse(output)
  const duplicates = duplicateProblems(validated.tracks)

  console.log('Catalogue import report for ' + slug)
  console.log('Source: ' + importPath)
  console.log('Existing: ' + existing.tracks.length)
  console.log('Incoming: ' + incoming.length)
  console.log('Additions: ' + additions.length)
  console.log('Updates: ' + updates.length)
  console.log('Unchanged: ' + unchanged.length)
  additions.forEach((id) => console.log('  ADD ' + id))
  updates.forEach((id) => console.log('  UPDATE ' + id))
  duplicates.forEach((problem) => console.error('  CONFLICT ' + problem))

  if (duplicates.length > 0) {
    throw new Error(
      'Import was not applied because duplicate recordings or destinations require review.',
    )
  }
  if (!hasArgument('--apply')) {
    console.log('Dry run only. Re-run with --apply after reviewing this report.')
    return
  }
  writeJsonFile(tracksPath, validated)
  console.log('Applied ' + validated.tracks.length + ' validated tracks to ' + tracksPath)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
