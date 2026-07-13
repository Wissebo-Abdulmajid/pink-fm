import type { AssistantInterpretation } from '../types'

export type EvaluationExpected = {
  kind: 'recommendation' | 'clarification' | 'conflict' | 'unsupported'
  moods?: string[]
  excludedMoods?: string[]
  activity?: string
  time?: string
  familiarity?: string
  relation?: string
  versionTypes?: string[]
  era?: 'older' | 'modern'
  requestedTrackId?: string
}

export type EvaluationUtterance = {
  id: string
  utterance: string
  category: string
  expected: EvaluationExpected
}

export type EvaluationSequence = {
  id: string
  turns: Array<{ utterance: string; expected: EvaluationExpected }>
}

export type EvaluationScore = {
  kindCorrect: boolean
  intentCorrect: boolean
  expectedMoods: string[]
  interpretedMoods: string[]
  negationRelevant: boolean
  negationCorrect: boolean
  entityRelevant: boolean
  entityCorrect: boolean
  clarificationRelevant: boolean
  clarificationCorrect: boolean
  unsupportedRelevant: boolean
  unsupportedCorrect: boolean
}

const hasEvidence = (
  interpretation: AssistantInterpretation,
  concept: string,
  expected?: string,
) =>
  interpretation.evidence.some(
    (item) => item.concept === concept && (expected === undefined || item.value === expected),
  )

export const interpretedMoodLabels = (interpretation: AssistantInterpretation) => [
  ...new Set(
    interpretation.evidence
      .filter((item) => item.concept === 'mood')
      .map((item) => item.value),
  ),
]

const kindMatches = (expected: EvaluationExpected['kind'], actual: AssistantInterpretation['kind']) =>
  expected === actual ||
  (expected === 'conflict' && (actual === 'conflict' || actual === 'clarification'))

export const scoreInterpretation = (
  utterance: string,
  expected: EvaluationExpected,
  interpretation: AssistantInterpretation,
): EvaluationScore => {
  const request = interpretation.request
  const checks: boolean[] = []
  if (expected.relation) checks.push(request?.relationToPrevious === expected.relation)
  if (expected.activity) checks.push(request?.activities?.includes(expected.activity) ?? false)
  if (expected.time) checks.push(request?.contexts?.includes(expected.time) ?? false)
  if (expected.familiarity) checks.push(request?.familiarity === expected.familiarity)
  if (expected.versionTypes?.length) {
    checks.push(expected.versionTypes.every((value) => request?.versionTypes?.includes(value as never)))
  }
  if (expected.era) checks.push(hasEvidence(interpretation, 'era', expected.era))
  if (expected.requestedTrackId) checks.push(request?.requestedTrackId === expected.requestedTrackId)
  const expectedMoods = expected.moods ?? []
  const interpretedMoods = interpretedMoodLabels(interpretation)
  if (expectedMoods.length) {
    checks.push(expectedMoods.every((mood) => interpretedMoods.includes(mood)))
  }

  const normalised = utterance.toLocaleLowerCase('en')
  const negationRelevant = Boolean(
    expected.excludedMoods?.length ||
    /\b(not|without|less|dont|jangan|tak|tidak|kurang)\b/.test(normalised),
  )
  let negationCorrect = true
  if (negationRelevant) {
    negationCorrect = (expected.excludedMoods ?? []).every((mood) =>
      request?.excludedMoods.includes(mood),
    )
    if (/not sleepy|tak mengantuk|tidak mengantuk/.test(normalised)) {
      negationCorrect = negationCorrect && (request?.targetMoods.energised ?? 0) >= 48
    }
    if (/less intense|kurang dramatik/.test(normalised)) {
      negationCorrect = negationCorrect && request?.intensity?.direction === 'lower'
    }
  }

  const entityRelevant = Boolean(expected.requestedTrackId)
  const clarificationRelevant = expected.kind === 'clarification' || expected.kind === 'conflict'
  const unsupportedRelevant = expected.kind === 'unsupported'
  return {
    kindCorrect: kindMatches(expected.kind, interpretation.kind),
    intentCorrect: kindMatches(expected.kind, interpretation.kind) && checks.every(Boolean),
    expectedMoods,
    interpretedMoods,
    negationRelevant,
    negationCorrect,
    entityRelevant,
    entityCorrect: !entityRelevant || request?.requestedTrackId === expected.requestedTrackId,
    clarificationRelevant,
    clarificationCorrect:
      !clarificationRelevant || ['clarification', 'conflict'].includes(interpretation.kind),
    unsupportedRelevant,
    unsupportedCorrect: !unsupportedRelevant || interpretation.kind === 'unsupported',
  }
}
