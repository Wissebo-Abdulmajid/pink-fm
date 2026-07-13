import type { Collection, MoodPreset, Track } from '../../config/schemas'
import type { BotCatalogue } from './types'
import { normaliseBotText, tokenise } from './language/normalise'

export type EntityKind = 'track' | 'album' | 'artist' | 'collection' | 'mood'

export type EntityMatch = {
  kind: EntityKind
  id: string
  label: string
  score: number
  exact: boolean
}

const levenshtein = (left: string, right: string) => {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        (previous[rightIndex - 1] ?? 0) +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        substitution,
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length] ?? Math.max(left.length, right.length)
}

export const normalisedEditSimilarity = (left: string, right: string) => {
  const a = normaliseBotText(left)
  const b = normaliseBotText(right)
  if (!a || !b) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

const jaccard = (left: string[], right: string[]) => {
  const a = new Set(left)
  const b = new Set(right)
  const intersection = [...a].filter((token) => b.has(token)).length
  const union = new Set([...a, ...b]).size
  return union ? intersection / union : 0
}

const bestWindowSimilarity = (message: string, label: string) => {
  const messageTokens = tokenise(message)
  const labelTokens = tokenise(label)
  if (labelTokens.length === 0 || messageTokens.length === 0) return 0
  if (messageTokens.length <= labelTokens.length) {
    return normalisedEditSimilarity(messageTokens.join(' '), labelTokens.join(' '))
  }
  let best = 0
  const minWindow = Math.max(1, labelTokens.length - 1)
  const maxWindow = Math.min(messageTokens.length, labelTokens.length + 1)
  for (let size = minWindow; size <= maxWindow; size += 1) {
    for (let index = 0; index <= messageTokens.length - size; index += 1) {
      const window = messageTokens.slice(index, index + size)
      const edit = normalisedEditSimilarity(window.join(' '), labelTokens.join(' '))
      const overlap = jaccard(window, labelTokens)
      // A single typo can remove a whole token from the Jaccard overlap even when
      // the title is otherwise unmistakable (for example, "Purnma Merindu").
      // Keep the conservative token score, but do not discard the stronger
      // character-level signal for multi-word catalogue entities.
      best = Math.max(best, edit, edit * 0.72 + overlap * 0.28)
    }
  }
  return best
}

const requestCue = (message: string) =>
  /\b(play|song|track|lagu|mainkan|put on|nak|want|choose|pilih|cari|find)\b/.test(message)

const scoreLabel = (
  message: string,
  label: string,
  kind: EntityKind,
  allowFuzzy = true,
) => {
  const query = normaliseBotText(message)
  const candidate = normaliseBotText(label)
  const candidateTokens = tokenise(candidate)
  if (!candidate || candidate.length < 2) return 0
  if (query === candidate) return 1
  const boundary = new RegExp(`(?:^|\\s)${candidate.replace(/ /g, '\\s+')}(?:$|\\s)`)
  if (boundary.test(query)) {
    if (candidateTokens.length >= 2) return 0.99
    if (candidate.length >= 5 && (kind !== 'track' || requestCue(query))) return 0.94
  }
  if (!allowFuzzy) return 0
  if (candidateTokens.length === 1 && !requestCue(query)) return 0
  const fuzzy = bestWindowSimilarity(query, candidate)
  const minimumLength = Math.min(query.length, candidate.length)
  if (minimumLength < 5) return 0
  return fuzzy
}

const bestUniqueLabels = <T>(items: T[], label: (item: T) => string) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = normaliseBotText(label(item))
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const trackMatches = (message: string, tracks: Track[], allowFuzzy: boolean): EntityMatch[] =>
  tracks
    .filter((track) => track.active)
    .map((track) => ({
      track,
      score: scoreLabel(message, track.title, 'track', allowFuzzy),
    }))
    .filter(({ score }) => score >= 0.68)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.track.isPrimaryVersion) - Number(left.track.isPrimaryVersion) ||
        right.track.curationConfidence - left.track.curationConfidence ||
        left.track.id.localeCompare(right.track.id),
    )
    .map(({ track, score }) => ({
      kind: 'track' as const,
      id: track.id,
      label: track.title,
      score,
      exact: score >= 0.98,
    }))

const albumMatches = (message: string, tracks: Track[], allowFuzzy: boolean): EntityMatch[] =>
  bestUniqueLabels(
    tracks.filter((track) => track.albumId && track.album),
    (track) => track.album,
  )
    .map((track) => ({ track, score: scoreLabel(message, track.album, 'album', allowFuzzy) }))
    .filter(({ score }) => score >= 0.72)
    .map(({ track, score }) => ({
      kind: 'album' as const,
      id: track.albumId,
      label: track.album,
      score,
      exact: score >= 0.98,
    }))

const artistMatches = (message: string, tracks: Track[], allowFuzzy: boolean): EntityMatch[] => {
  const artists = new Map<string, string>()
  for (const track of tracks) {
    artists.set(track.primaryArtistId, track.artist)
    track.featuredArtistIds.forEach((id, index) => {
      const name = track.featuredArtists[index]
      if (name) artists.set(id, name)
    })
  }
  return [...artists]
    .map(([id, label]) => ({ id, label, score: scoreLabel(message, label, 'artist', allowFuzzy) }))
    .filter(({ score }) => score >= 0.76)
    .map(({ id, label, score }) => ({
      kind: 'artist' as const,
      id,
      label,
      score,
      exact: score >= 0.98,
    }))
}

const simpleMatches = <T extends Collection | MoodPreset>(
  message: string,
  items: T[],
  kind: 'collection' | 'mood',
  allowFuzzy: boolean,
) =>
  items
    .map((item) => ({ item, score: scoreLabel(message, item.label, kind, allowFuzzy) }))
    .filter(({ score }) => score >= 0.76)
    .map(({ item, score }) => ({
      kind,
      id: item.id,
      label: item.label,
      score,
      exact: score >= 0.98,
    }))

export const matchCatalogueEntities = (
  message: string,
  catalogue: BotCatalogue | null,
  options: { allowFuzzy?: boolean } = {},
): EntityMatch[] => {
  if (!catalogue) return []
  const allowFuzzy = options.allowFuzzy ?? true
  return [
    ...trackMatches(message, catalogue.tracks, allowFuzzy),
    ...albumMatches(message, catalogue.tracks, allowFuzzy),
    ...artistMatches(message, catalogue.tracks, allowFuzzy),
    ...simpleMatches(message, catalogue.collections.filter((item) => item.active), 'collection', allowFuzzy),
    ...simpleMatches(message, catalogue.moods, 'mood', allowFuzzy),
  ].sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
}

export const bestEntityMatch = (
  message: string,
  catalogue: BotCatalogue | null,
  kind?: EntityKind,
) => matchCatalogueEntities(message, catalogue).find((match) => !kind || match.kind === kind)
