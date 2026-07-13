import { NOT_TODAY_TTL_MS, RECOMMENDATION_WEIGHTS } from '../../config/constants'
import {
  moodDimensionKeys,
  type ArtistPolicy,
  type MoodDimension,
  type MoodVector,
  type Track,
  type TrackVersionType,
} from '../../config/schemas'
import type { ListenerState } from '../../lib/storage'

export type RecommendationContext = {
  activity?: string
  activities?: string[]
  timeOfDay?: 'morning' | 'daytime' | 'evening' | 'night'
  surprise?: boolean
  minEnergy?: number
  maxEnergy?: number
  targetEnergy?: number
  minIntensity?: number
  maxIntensity?: number
  targetIntensity?: number
  preferredTempo?: Track['tempoClass']
  noveltyPreference?: 'familiar' | 'novel'
  preferredEras?: string[]
  excludedEras?: string[]
  preferredCollections?: string[]
  preferredAlbumIds?: string[]
  versionTypes?: TrackVersionType[]
  excludedTrackIds?: string[]
  excludedAlbumIds?: string[]
  excludedArtistIds?: string[]
  requestedTrackId?: string
  requestedArtistIds?: string[]
  semanticTrackScores?: Record<string, number>
  artistPolicy?: ArtistPolicy
  sessionTrackIds?: string[]
  deepCut?: boolean
  rotationSeed?: string
  now?: number
}

export type RecommendationRequest = {
  tracks: Track[]
  target: MoodVector
  stationName: string
  frequency: string
  listener: ListenerState
  context?: RecommendationContext
}

export type RecommendationResult = {
  track: Track
  score: number
  matchPercentage: number
  primaryReasons: string[]
  matchedMoods: string[]
  stationName: string
  frequency: string
}

export type ScoreContributions = {
  mood: number
  semantic: number
  context: number
  energy: number
  intensity: number
  preference: number
  era: number
  collection: number
  novelty: number
  affinity: number
  time: number
  artist: number
  version: number
  recentPenalty: number
  curationPenalty: number
  artistPolicyPenalty: number
  tieBreak: number
}

export type RankedCandidate = RecommendationResult & {
  contributions: ScoreContributions
  baseScore: number
}

export const normaliseMoodVector = (vector: MoodVector): Record<MoodDimension, number> =>
  Object.fromEntries(
    moodDimensionKeys.map((dimension) => [dimension, vector[dimension] / 100]),
  ) as Record<MoodDimension, number>

export const weightedMoodSimilarity = (
  target: MoodVector,
  candidate: MoodVector,
  dimensionWeights: Partial<Record<MoodDimension, number>> = {},
) => {
  let distance = 0
  let totalWeight = 0
  for (const dimension of moodDimensionKeys) {
    const targetStrength = target[dimension] / 100
    const emphasis = dimensionWeights[dimension] ?? (0.65 + targetStrength * 0.7)
    distance += (Math.abs(target[dimension] - candidate[dimension]) / 100) * emphasis
    totalWeight += emphasis
  }
  return Math.max(0, Math.min(1, 1 - distance / totalWeight))
}

const requestedActivities = (context: RecommendationContext) =>
  [...new Set([context.activity, ...(context.activities ?? [])].filter(Boolean) as string[])]

export const contextScore = (track: Track, context: RecommendationContext = {}) => {
  const requested = [...requestedActivities(context), context.preferredTempo].filter(
    Boolean,
  ) as string[]
  if (requested.length === 0) return 0.5
  const matches = requested.filter(
    (value) =>
      track.contexts.includes(value) ||
      track.useCases.includes(value) ||
      track.tempoClass === value,
  ).length
  return 0.2 + 0.8 * (matches / requested.length)
}

const boundedAffinity = (counts: Record<string, number>, values: string[], divisor = 5) => {
  if (values.length === 0) return 0
  return Math.min(1, Math.max(...values.map((value) => counts[value] ?? 0)) / divisor)
}

export const preferenceScore = (track: Track, listener: ListenerState) => {
  const moodAffinity = weightedMoodSimilarity(listener.preferredMoods, track.moods)
  const eraAffinity = track.era
    ? boundedAffinity(listener.preferredEras, [track.era])
    : 0
  const collectionAffinity = boundedAffinity(
    listener.preferredCollections,
    track.collections,
  )
  const versionAffinity = boundedAffinity(listener.preferredVersionTypes, [track.versionType])
  const languageAffinity = boundedAffinity(listener.preferredLanguages, track.languages)
  return (
    moodAffinity * 0.62 +
    eraAffinity * 0.14 +
    collectionAffinity * 0.1 +
    versionAffinity * 0.07 +
    languageAffinity * 0.07
  )
}

export const recentPlayPenalty = (
  track: Track,
  listener: ListenerState,
  now = Date.now(),
) => {
  const recentEntries = listener.history.slice(0, 12)
  const position = recentEntries.findIndex((entry) => entry.trackId === track.id)
  if (position < 0) return 0
  const age = now - (recentEntries[position]?.timestamp ?? now)
  const ageFactor = Math.max(0, 1 - age / (1000 * 60 * 60 * 24 * 3))
  const positionFactor = Math.max(0.2, 1 - position * 0.09)
  return ageFactor * positionFactor
}

export const noveltyScore = (
  track: Track,
  listener: ListenerState,
  surprise = false,
  preference?: RecommendationContext['noveltyPreference'],
) => {
  const inherentNovelty = 1 - track.familiarity / 100
  const playPenalty = Math.min(0.7, (listener.playCounts[track.id] ?? 0) * 0.12)
  const value = Math.max(0, inherentNovelty - playPenalty)
  if (preference === 'familiar') {
    return Math.max(0, track.familiarity / 100 - playPenalty * 0.35)
  }
  return Math.min(1, surprise || preference === 'novel' ? value * 1.65 + 0.12 : value)
}

export const favouriteBoost = (track: Track, listener: ListenerState) => {
  if (listener.lovedTrackIds.includes(track.id)) return 1
  return Math.min(0.85, (listener.moreLikeTrackIds[track.id] ?? 0) * 0.22)
}

export const timeSuitabilityScore = (
  track: Track,
  timeOfDay: RecommendationContext['timeOfDay'],
) => {
  if (!timeOfDay) return 0.5
  if (track.contexts.includes(timeOfDay) || track.useCases.includes(timeOfDay)) return 1
  const compatible: Record<NonNullable<RecommendationContext['timeOfDay']>, string[]> = {
    morning: ['daytime', 'cooking', 'getting-ready'],
    daytime: ['morning', 'cooking', 'driving', 'celebration'],
    evening: ['night', 'relaxing', 'date-night', 'reflecting'],
    night: ['evening', 'relaxing', 'reflecting'],
  }
  return [...track.contexts, ...track.useCases].some((item) =>
    compatible[timeOfDay].includes(item),
  )
    ? 0.75
    : 0.3
}

const directionalScore = (actual: number, target: number | undefined) =>
  target === undefined ? 0.5 : Math.max(0, 1 - Math.abs(actual - target) / 100)

const collectionScore = (track: Track, context: RecommendationContext) => {
  if (context.preferredAlbumIds?.length) {
    return context.preferredAlbumIds.includes(track.albumId) ? 1 : 0.05
  }
  const requested = context.preferredCollections ?? []
  if (requested.length === 0) return 0.5
  return track.collections.some((collection) => requested.includes(collection)) ? 1 : 0.1
}

const eraRequestScore = (track: Track, context: RecommendationContext) => {
  const preferred = context.preferredEras ?? []
  if (preferred.length === 0) return 0.5
  return preferred.includes(track.era) ? 1 : 0.12
}

const artistScore = (track: Track, context: RecommendationContext, listener: ListenerState) => {
  const requested = context.requestedArtistIds ?? []
  if (requested.length > 0) {
    return requested.includes(track.primaryArtistId) ||
      track.featuredArtistIds.some((artist) => requested.includes(artist))
      ? 1
      : 0
  }
  const primary = context.artistPolicy?.primaryArtistIds ?? []
  if (primary.includes(track.primaryArtistId)) return 1
  if (track.featuredArtistIds.some((artist) => primary.includes(artist))) return 0.82
  const learned = listener.preferredArtistIds[track.primaryArtistId] ?? 0
  return primary.length === 0 ? Math.min(1, 0.55 + learned * 0.08) : 0.2
}

const versionScore = (track: Track, context: RecommendationContext, listener: ListenerState) => {
  if (context.versionTypes?.length) return context.versionTypes.includes(track.versionType) ? 1 : 0
  const learned = listener.preferredVersionTypes[track.versionType] ?? 0
  return Math.min(1, (track.isPrimaryVersion ? 0.72 : 0.5) + learned * 0.06)
}

export const curationPenalty = (track: Track) => {
  const statusPenalty = RECOMMENDATION_WEIGHTS.curationPenalty[track.curationStatus]
  const confidencePenalty = (1 - track.curationConfidence) * 0.055
  return statusPenalty + confidencePenalty
}

const artistPolicyPenalty = (track: Track, context: RecommendationContext) => {
  const policy = context.artistPolicy
  if (!policy || policy.mode !== 'primary-preferred' || context.requestedArtistIds?.length) return 0
  if (policy.primaryArtistIds.includes(track.primaryArtistId)) return 0
  if (
    policy.allowFeaturedArtists &&
    track.featuredArtistIds.some((artist) => policy.primaryArtistIds.includes(artist))
  ) {
    return RECOMMENDATION_WEIGHTS.secondaryArtistPenalty * 0.35
  }
  return RECOMMENDATION_WEIGHTS.secondaryArtistPenalty
}

const stableHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4_294_967_295
}

export const deterministicTieBreak = (
  trackId: string,
  target: MoodVector,
  rotationSeed?: string,
) => {
  const fingerprint = moodDimensionKeys.map((key) => target[key]).join('-')
  return stableHash(`${trackId}:${fingerprint}:${rotationSeed ?? 'stable'}`) * 0.000001
}

const hasLearnedRankingSignals = (listener: ListenerState) =>
  listener.history.length > 0 ||
  listener.lovedTrackIds.length > 0 ||
  Object.keys(listener.moreLikeTrackIds).length > 0 ||
  Object.keys(listener.preferredEras).length > 0 ||
  Object.keys(listener.preferredCollections).length > 0 ||
  Object.keys(listener.preferredVersionTypes).length > 0

const applyDailyRotation = (
  ranked: RankedCandidate[],
  request: RecommendationRequest,
) => {
  const seed = request.context?.rotationSeed
  const first = ranked[0]
  if (
    !seed ||
    !first ||
    request.context?.requestedTrackId ||
    hasLearnedRankingSignals(request.listener)
  ) return ranked

  const primaryMood = moodDimensionKeys
    .slice()
    .sort((left, right) => request.target[right] - request.target[left])[0] ?? 'peaceful'
  const eligible = ranked
    .filter((candidate) =>
      candidate.baseScore >= first.baseScore - RECOMMENDATION_WEIGHTS.dailyRotationTolerance &&
      candidate.matchPercentage >= first.matchPercentage - 8 &&
      candidate.track.moods[primaryMood] >= 45,
    )
    .slice(0, 24)
  if (eligible.length < 2) return ranked

  const byAlbum = new Map<string, RankedCandidate[]>()
  for (const candidate of eligible) {
    const album = candidate.track.albumId || candidate.track.album || candidate.track.id
    byAlbum.set(album, [...(byAlbum.get(album) ?? []), candidate])
  }
  const albums = [...byAlbum.entries()].sort(([left], [right]) => left.localeCompare(right))
  const fingerprint = moodDimensionKeys.map((key) => request.target[key]).join('-')
  const sequence = seed.match(/(\d+)$/)?.[1]
  const sequenceNumber = sequence === undefined ? null : Number(sequence)
  const albumOffset = Math.floor(stableHash(`album:${fingerprint}`) * albums.length)
  const albumIndex = Number.isSafeInteger(sequenceNumber)
    ? (albumOffset + (sequenceNumber ?? 0)) % albums.length
    : Math.min(
        albums.length - 1,
        Math.floor(stableHash(`album:${seed}:${fingerprint}`) * albums.length),
      )
  const albumCandidates = albums[albumIndex]?.[1] ?? eligible
  const trackIndex = Math.min(
    albumCandidates.length - 1,
    Math.floor(stableHash(`track:${seed}:${fingerprint}`) * albumCandidates.length),
  )
  const selected = albumCandidates[trackIndex]
  if (!selected || selected === first) return ranked
  return [selected, ...ranked.filter((candidate) => candidate !== selected)]
}

const followsArtistPolicy = (track: Track, policy: ArtistPolicy | undefined) => {
  if (!policy || policy.mode !== 'primary-only') return true
  if (policy.primaryArtistIds.includes(track.primaryArtistId)) return true
  return (
    policy.allowFeaturedArtists &&
    track.featuredArtistIds.some((artist) => policy.primaryArtistIds.includes(artist))
  )
}

const passesHardFilters = (
  track: Track,
  listener: ListenerState,
  context: RecommendationContext,
  now: number,
) => {
  if (!track.active) return false
  if ((listener.notTodayUntil[track.id] ?? 0) > now) return false
  if (context.excludedTrackIds?.includes(track.id)) return false
  if (context.sessionTrackIds?.includes(track.id)) return false
  if (context.excludedAlbumIds?.includes(track.albumId)) return false
  if (context.excludedArtistIds?.includes(track.primaryArtistId)) return false
  if (!followsArtistPolicy(track, context.artistPolicy)) return false
  if (context.requestedArtistIds?.length) {
    const matchesArtist =
      context.requestedArtistIds.includes(track.primaryArtistId) ||
      track.featuredArtistIds.some((artist) => context.requestedArtistIds?.includes(artist))
    if (!matchesArtist) return false
  }
  return true
}

const passesSoftFilters = (track: Track, context: RecommendationContext) => {
  if (context.minEnergy !== undefined && track.moods.energised < context.minEnergy) return false
  if (context.maxEnergy !== undefined && track.moods.energised > context.maxEnergy) return false
  if (context.minIntensity !== undefined && track.intensity < context.minIntensity) return false
  if (context.maxIntensity !== undefined && track.intensity > context.maxIntensity) return false
  if (context.excludedEras?.includes(track.era)) return false
  if (context.versionTypes?.length && !context.versionTypes.includes(track.versionType)) return false
  return true
}

export const filterCandidates = (
  tracks: Track[],
  listener: ListenerState,
  context: RecommendationContext = {},
) => {
  const now = context.now ?? Date.now()
  if (context.requestedTrackId) {
    const requested = tracks.find(
      (track) => track.active && track.id === context.requestedTrackId && followsArtistPolicy(track, context.artistPolicy),
    )
    return requested ? [requested] : []
  }
  const hardFiltered = tracks.filter((track) => passesHardFilters(track, listener, context, now))
  const constrained = hardFiltered.filter((track) => passesSoftFilters(track, context))
  if (constrained.length > 0) return constrained
  if (hardFiltered.length > 0) return hardFiltered

  // A long session may exhaust every unseen candidate. Preserve explicit artist/album/track
  // exclusions, but allow prior session tracks again before declaring the catalogue empty.
  const withoutSession = { ...context, sessionTrackIds: [] }
  return tracks.filter((track) => passesHardFilters(track, listener, withoutSession, now))
}

const humanMood = (mood: MoodDimension) =>
  mood === 'energised' ? 'energetic' : mood === 'comforted' ? 'comforting' : mood

export const matchedMoodDimensions = (target: MoodVector, track: Track) =>
  moodDimensionKeys
    .filter((dimension) => target[dimension] >= 55)
    .map((dimension) => ({
      dimension,
      strength: Math.min(target[dimension], track.moods[dimension]),
      distance: Math.abs(target[dimension] - track.moods[dimension]),
    }))
    .filter(({ distance }) => distance <= 32)
    .sort((a, b) => b.strength - a.strength || a.distance - b.distance)
    .map(({ dimension }) => dimension)

export const recommendationExplanation = (
  track: Track,
  target: MoodVector,
  contributions: ScoreContributions,
  context: RecommendationContext = {},
) => {
  const matched = matchedMoodDimensions(target, track)
  const lead = matched.slice(0, 2).map(humanMood)
  const reasons: string[] = []
  if (lead.length > 0) {
    reasons.push(
      `Selected for its ${lead.length > 1 ? `${lead[0]} and ${lead[1]}` : lead[0]} profile${
        track.moods.energised >= 45 && target.peaceful >= 65
          ? ', with enough energy to remain uplifting.'
          : '.'
      }`,
    )
  } else {
    reasons.push('Selected as the closest balanced match across the requested mood dimensions.')
  }
  const activities = requestedActivities(context)
  const matchedActivity = activities.find(
    (activity) => track.contexts.includes(activity) || track.useCases.includes(activity),
  )
  if (matchedActivity) {
    reasons.push(`Its profile is also suited to ${matchedActivity.replace(/-/g, ' ')}.`)
  } else if (context.preferredCollections?.some((id) => track.collections.includes(id))) {
    reasons.push('It belongs to the requested catalogue collection.')
  } else if (context.surprise && contributions.novelty >= RECOMMENDATION_WEIGHTS.novelty * 0.55) {
    reasons.push('It brings a less familiar colour while preserving a strong overall match.')
  } else if (contributions.affinity >= RECOMMENDATION_WEIGHTS.affinity * 0.6) {
    reasons.push('Your positive listening feedback gave it a measured extra lift.')
  } else if ((context.semanticTrackScores?.[track.id] ?? 0) >= 0.72) {
    reasons.push('Its catalogue description closely matches the words in your request.')
  }
  return reasons.slice(0, 2)
}

export const scoreTrack = (
  track: Track,
  request: RecommendationRequest,
): RankedCandidate => {
  const context = request.context ?? {}
  const moodSimilarity = weightedMoodSimilarity(request.target, track.moods)
  const hasSemanticSignal = context.semanticTrackScores !== undefined
  const semanticSimilarity = Math.max(0, Math.min(1, context.semanticTrackScores?.[track.id] ?? 0))
  const moodWeight = hasSemanticSignal
    ? RECOMMENDATION_WEIGHTS.mood
    : RECOMMENDATION_WEIGHTS.mood + RECOMMENDATION_WEIGHTS.semantic
  const energyTarget = context.targetEnergy ?? request.target.energised
  const intensityTarget = context.targetIntensity ?? request.target.dramatic
  const contributions: ScoreContributions = {
    mood: moodSimilarity * moodWeight,
    semantic: semanticSimilarity * (hasSemanticSignal ? RECOMMENDATION_WEIGHTS.semantic : 0),
    context: contextScore(track, context) * RECOMMENDATION_WEIGHTS.context,
    energy: directionalScore(track.moods.energised, energyTarget) * RECOMMENDATION_WEIGHTS.energy,
    intensity: directionalScore(track.intensity, intensityTarget) * RECOMMENDATION_WEIGHTS.intensity,
    preference: preferenceScore(track, request.listener) * RECOMMENDATION_WEIGHTS.preference,
    era: eraRequestScore(track, context) * RECOMMENDATION_WEIGHTS.era,
    collection: collectionScore(track, context) * RECOMMENDATION_WEIGHTS.collection,
    novelty:
      noveltyScore(track, request.listener, context.surprise, context.noveltyPreference) *
      RECOMMENDATION_WEIGHTS.novelty,
    affinity: favouriteBoost(track, request.listener) * RECOMMENDATION_WEIGHTS.affinity,
    time: timeSuitabilityScore(track, context.timeOfDay) * RECOMMENDATION_WEIGHTS.time,
    artist: artistScore(track, context, request.listener) * RECOMMENDATION_WEIGHTS.artist,
    version: versionScore(track, context, request.listener) * RECOMMENDATION_WEIGHTS.version,
    recentPenalty:
      recentPlayPenalty(track, request.listener, context.now) *
      RECOMMENDATION_WEIGHTS.recentPenalty,
    curationPenalty: curationPenalty(track),
    artistPolicyPenalty: artistPolicyPenalty(track, context),
    tieBreak: deterministicTieBreak(track.id, request.target, context.rotationSeed),
  }
  if (context.deepCut && track.familiarity <= 45) contributions.novelty += 0.025
  const baseScore =
    contributions.mood +
    contributions.semantic +
    contributions.context +
    contributions.energy +
    contributions.intensity +
    contributions.preference +
    contributions.era +
    contributions.collection +
    contributions.novelty +
    contributions.affinity +
    contributions.time +
    contributions.artist +
    contributions.version -
    contributions.recentPenalty -
    contributions.curationPenalty -
    contributions.artistPolicyPenalty +
    contributions.tieBreak
  const matchedMoods = matchedMoodDimensions(request.target, track)
  return {
    track,
    score: baseScore,
    baseScore,
    matchPercentage: Math.max(
      1,
      Math.min(99, Math.round(moodSimilarity * 74 + Math.max(0, baseScore) * 26)),
    ),
    primaryReasons: recommendationExplanation(track, request.target, contributions, context),
    matchedMoods,
    stationName: request.stationName,
    frequency: request.frequency,
    contributions,
  }
}

const diversityPenalty = (candidate: RankedCandidate, selected: RankedCandidate[]) => {
  const sameAlbum = selected.filter(
    (item) => candidate.track.albumId && item.track.albumId === candidate.track.albumId,
  ).length
  const sameEra = selected.filter((item) => item.track.era === candidate.track.era).length
  const sameVersion = selected.filter(
    (item) => item.track.versionType === candidate.track.versionType,
  ).length
  return (
    sameAlbum * RECOMMENDATION_WEIGHTS.albumRepetitionPenalty +
    Math.max(0, sameEra - 1) * 0.012 +
    Math.max(0, sameVersion - 2) * 0.006
  )
}

export const diversityRerank = (ranked: RankedCandidate[], limit = ranked.length) => {
  const remaining = [...ranked]
  const selected: RankedCandidate[] = []
  while (remaining.length > 0 && selected.length < limit) {
    remaining.sort((a, b) => {
      const adjustedA = a.baseScore - diversityPenalty(a, selected)
      const adjustedB = b.baseScore - diversityPenalty(b, selected)
      return adjustedB - adjustedA || a.track.id.localeCompare(b.track.id)
    })
    const next = remaining.shift()
    if (!next) break
    const adjustedScore = next.baseScore - diversityPenalty(next, selected)
    selected.push({ ...next, score: adjustedScore })
  }
  return selected
}

export const rankCandidates = (
  request: RecommendationRequest,
  limit?: number,
): RankedCandidate[] => {
  const candidates = filterCandidates(request.tracks, request.listener, request.context)
  let ranked = candidates
    .map((track) => scoreTrack(track, request))
    .sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id))

  ranked = applyDailyRotation(ranked, request)

  const lastTrackId = request.listener.history[0]?.trackId
  if (
    ranked.length > 1 &&
    ranked[0]?.track.id === lastTrackId &&
    (ranked[1]?.score ?? -Infinity) >= (ranked[0]?.score ?? 0) - 0.08
  ) {
    const first = ranked[0]
    const second = ranked[1]
    if (first && second) {
      ranked[0] = second
      ranked[1] = first
    }
  }
  if (limit === 1) return ranked.slice(0, 1)
  return diversityRerank(ranked, limit ?? ranked.length)
}

export const createRecommendationQueue = (
  request: RecommendationRequest,
  size = 8,
): RecommendationResult[] =>
  rankCandidates(request, size)
    .map(({ track, score, matchPercentage, primaryReasons, matchedMoods, stationName, frequency }) => ({
      track,
      score,
      matchPercentage,
      primaryReasons,
      matchedMoods,
      stationName,
      frequency,
    }))

export const recommendTrack = (request: RecommendationRequest): RecommendationResult => {
  const result = rankCandidates(request, 1)[0]
  if (!result) throw new Error('No active tracks are available for recommendation.')
  return {
    track: result.track,
    score: result.score,
    matchPercentage: result.matchPercentage,
    primaryReasons: result.primaryReasons,
    matchedMoods: result.matchedMoods,
    stationName: result.stationName,
    frequency: result.frequency,
  }
}

export const markNotTodayUntil = (now = Date.now()) => now + NOT_TODAY_TTL_MS
