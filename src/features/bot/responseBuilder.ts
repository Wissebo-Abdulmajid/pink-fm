import type { RecommendationResult } from '../recommendations/engine'
import type { AssistantInterpretation, StructuredMusicRequest } from './types'

const curationNote = (result: RecommendationResult) => {
  if (result.track.curationStatus === 'provisional') {
    return 'This catalogue record is provisional, so its mood profile still needs editorial review.'
  }
  if (result.track.curationStatus === 'verified-metadata') {
    return 'Its identity and destination are verified; its mood profile is still awaiting full editorial review.'
  }
  return null
}

export const buildGroundedRecommendationResponse = (
  interpretation: AssistantInterpretation,
  result: RecommendationResult,
) => {
  const understood = `I tuned for ${interpretation.summary.replace(/[.]$/, '')}.`
  const why = result.primaryReasons.join(' ')
  const freshness = interpretation.request?.familiarity === 'discovery'
    ? 'I weighted this as a discovery rather than a familiar-first choice.'
    : interpretation.constraints.excludedTrackIds?.length
      ? 'I kept the rejected and recent choices out of this result.'
      : null
  return [understood, why, freshness, curationNote(result)].filter(Boolean).slice(0, 3).join(' ')
}

export const describeStructuredRequest = (request: StructuredMusicRequest) => ({
  requestedTrackId: request.requestedTrackId ?? null,
  requestedArtistIds: request.requestedArtistIds ?? [],
  strongestMoods: Object.entries(request.targetMoods)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3)
    .map(([mood, strength]) => ({ mood, strength })),
  excludedMoods: request.excludedMoods,
  energy: request.energy ?? null,
  intensity: request.intensity ?? null,
  familiarity: request.familiarity ?? 'balanced',
  era: request.era ?? null,
  collections: request.collectionIds ?? [],
  activities: request.activities ?? [],
  versions: request.versionTypes ?? [],
  exclusions: request.exclusions,
  confidence: request.confidence,
  evidence: request.evidence,
})
