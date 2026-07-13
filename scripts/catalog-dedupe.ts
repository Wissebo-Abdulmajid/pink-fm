import { resolve } from 'node:path'
import {
  argumentValue,
  hasArgument,
  loadCatalog,
  normaliseProviderUrl,
  primaryRecordingKey,
  providerUrls,
  writeJsonFile,
} from './catalog-shared.ts'
import { tracksFileSchema, type Track } from '../src/config/schemas.ts'

const statusScore: Record<Track['curationStatus'], number> = {
  reviewed: 3,
  'verified-metadata': 2,
  provisional: 1,
}

const preferenceScore = (track: Track) =>
  statusScore[track.curationStatus] * 100 +
  track.curationConfidence * 20 +
  (track.isPrimaryVersion ? 8 : 0) +
  Object.values(track.officialLinks).filter(Boolean).length * 3

const chooseWinner = (tracks: Track[]) =>
  tracks
    .slice()
    .sort(
      (left, right) =>
        preferenceScore(right) - preferenceScore(left) ||
        left.id.localeCompare(right.id),
    )[0]

const slug = argumentValue('--slug') ?? 'siti'
const catalog = loadCatalog(slug)
const tracks = catalog.tracks.tracks
const groups = new Map<string, Set<string>>()

for (const track of tracks) {
  const recordingKey = 'recording:' + primaryRecordingKey(track)
  groups.set(recordingKey, new Set([...(groups.get(recordingKey) ?? []), track.id]))
  for (const { provider, url } of providerUrls(track)) {
    const urlKey = 'url:' + provider + ':' + normaliseProviderUrl(url)
    groups.set(urlKey, new Set([...(groups.get(urlKey) ?? []), track.id]))
  }
}

const duplicateGroups = [...groups.entries()]
  .map(([key, ids]) => ({ key, ids: [...ids] }))
  .filter((group) => group.ids.length > 1)

const proposedRemovals = new Set<string>()
let unresolved = 0

console.log('Pink FM catalogue dedupe: ' + slug)
console.log('Tracks inspected: ' + tracks.length)
console.log('Duplicate groups: ' + duplicateGroups.length)

for (const group of duplicateGroups) {
  const candidates = group.ids
    .map((id) => tracks.find((track) => track.id === id))
    .filter((track): track is Track => Boolean(track))
  const winner = chooseWinner(candidates)
  if (!winner) continue
  const reviewed = candidates.filter((track) => track.curationStatus === 'reviewed')
  if (reviewed.length > 1 && group.key.startsWith('recording:')) {
    unresolved += 1
    console.log('REVIEW ' + group.key + ' -> ' + group.ids.join(', '))
    continue
  }
  console.log(
    'KEEP ' +
      winner.id +
      ' (' +
      group.key +
      '), remove ' +
      candidates
        .filter((track) => track.id !== winner.id)
        .map((track) => track.id)
        .join(', '),
  )
  candidates
    .filter((track) => track.id !== winner.id)
    .forEach((track) => proposedRemovals.add(track.id))
}

console.log('Proposed removals: ' + proposedRemovals.size)
console.log('Unresolved reviewed conflicts: ' + unresolved)

if (!hasArgument('--apply')) {
  console.log('Dry run only. Re-run with --apply to remove unambiguous duplicates.')
} else if (unresolved > 0) {
  throw new Error('Refusing to apply while reviewed duplicate conflicts remain.')
} else {
  const output = tracksFileSchema.parse({
    schemaVersion: 2,
    tracks: tracks.filter((track) => !proposedRemovals.has(track.id)),
  })
  const tracksPath = resolve(catalog.profilePath, 'tracks.json')
  writeJsonFile(tracksPath, output)
  console.log('Applied dedupe: ' + output.tracks.length + ' tracks remain.')
}
