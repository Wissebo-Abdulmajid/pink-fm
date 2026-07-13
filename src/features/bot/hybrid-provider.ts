import { neutralMoodVector } from '../../config/constants'
import { moodDimensionKeys, type MoodDimension, type MoodVector } from '../../config/schemas'
import { LocalWisseBotProvider } from './local-provider'
import { normaliseBotText } from './language/normalise'
import { moodLanguage, negators } from './language/resources'
import type {
  AssistantInterpretation,
  BotCatalogue,
  ConversationContext,
  InterpretationEvidence,
  MusicAssistantProvider,
  SemanticInterpreter,
  StructuredMusicRequest,
} from './types'
import type { SemanticPrototypeMatch } from './semantic/semanticTypes'

const semanticEvidence = (match: SemanticPrototypeMatch): InterpretationEvidence => ({
  source: 'semantic-similarity',
  concept: match.kind,
  value: String(
    match.payload.mood ??
      match.payload.activity ??
      match.payload.intent ??
      match.payload.collectionId ??
      match.id,
  ),
  confidence: match.score,
})

const containsNegation = (message: string) => {
  const normalised = normaliseBotText(message)
  return negators.some((negator) =>
    new RegExp(`(?:^|\\s)${normaliseBotText(negator).replace(/ /g, '\\s+')}(?:$|\\s)`).test(
      normalised,
    ),
  )
}

const semanticMoodIsExplicitlyNegated = (
  message: string,
  match: SemanticPrototypeMatch,
) => {
  if (match.kind !== 'mood' || typeof match.payload.mood !== 'string') return false
  const phrases = moodLanguage[match.payload.mood as MoodDimension] ?? []
  const normalised = normaliseBotText(message)
  return phrases.some((phrase) => {
    const candidate = normaliseBotText(phrase)
    const index = normalised.indexOf(candidate)
    if (index < 0) return false
    const prefix = normalised.slice(Math.max(0, index - 32), index).trim()
    return negators.some((negator) =>
      new RegExp(`(?:^|\\s)${normaliseBotText(negator).replace(/ /g, '\\s+')}(?:\\s+(?:very|too|terlalu|sangat))?\\s*$`).test(prefix),
    )
  })
}

const canonicalPrompt = (match: SemanticPrototypeMatch) => {
  if (match.kind === 'mood' && typeof match.payload.mood === 'string') {
    return `something ${match.payload.mood}`
  }
  if (match.kind === 'activity' && typeof match.payload.activity === 'string') {
    return `music for ${match.payload.activity}`
  }
  if (match.kind === 'intent' && typeof match.payload.intent === 'string') {
    const prompts: Record<string, string> = {
      'more-energetic': 'more energetic',
      'less-intense': 'less intense',
      similar: 'more like the last song',
      different: 'something different',
      discovery: 'a hidden gem discovery',
      familiar: 'a familiar favourite',
      traditional: 'something traditional',
      modern: 'something modern',
    }
    return prompts[match.payload.intent]
  }
  return undefined
}

const mergeSemanticSignal = (
  deterministic: AssistantInterpretation,
  match: SemanticPrototypeMatch,
  trackScores: Record<string, number>,
): AssistantInterpretation => {
  if (!deterministic.request) return deterministic
  const semanticSignal = semanticEvidence(match)
  const exactMoods = deterministic.evidence
    .filter((item) => item.concept === 'mood' && item.source === 'exact-rule')
    .map((item) => item.value)
  const evidence = [
    ...deterministic.evidence,
    ...(match.kind !== 'mood' || exactMoods.includes(semanticSignal.value)
      ? [semanticSignal]
      : [{
          ...semanticSignal,
          concept: 'semantic-retrieval',
        }]),
  ]
  const request: StructuredMusicRequest = {
    ...deterministic.request,
    targetMoods: { ...deterministic.request.targetMoods },
    confidence: Math.min(0.99, Math.max(deterministic.confidence, match.score)),
    evidence,
  }
  if (
    match.kind === 'mood' &&
    typeof match.payload.mood === 'string' &&
    moodDimensionKeys.includes(match.payload.mood as MoodDimension) &&
    exactMoods.length === 0 &&
    !request.excludedMoods.includes(match.payload.mood)
  ) {
    const mood = match.payload.mood as MoodDimension
    const strength = typeof match.payload.strength === 'number' ? match.payload.strength : 86
    request.targetMoods[mood] = Math.max(request.targetMoods[mood], strength)
  }
  return {
    ...deterministic,
    request,
    target: request.targetMoods,
    confidence: request.confidence,
    evidence,
    constraints: {
      ...deterministic.constraints,
      semanticTrackScores: trackScores,
    },
    mode: 'hybrid',
  }
}

const defaultSemanticRequest = (
  match: SemanticPrototypeMatch,
  context: ConversationContext,
): StructuredMusicRequest => {
  const previous = context.currentTarget && 'targetMoods' in context.currentTarget
    ? context.currentTarget.targetMoods
    : context.currentTarget
  const targetMoods: MoodVector = previous ? { ...previous } : { ...neutralMoodVector }
  const mood = typeof match.payload.mood === 'string'
    ? match.payload.mood as MoodDimension
    : null
  if (mood && mood in targetMoods) targetMoods[mood] = 86
  return {
    targetMoods,
    excludedMoods: [],
    exclusions: {
      trackIds: [...context.rejectedTrackIds],
      albumIds: [],
      artistIds: [],
    },
    surprise: false,
    confidence: match.score,
    evidence: [semanticEvidence(match)],
  }
}

export class HybridWisseBotProvider implements MusicAssistantProvider {
  private semantic: SemanticInterpreter | null
  private readonly deterministic: LocalWisseBotProvider

  constructor(
    private readonly catalogue: BotCatalogue,
    semantic: SemanticInterpreter | null = null,
  ) {
    this.semantic = semantic
    this.deterministic = new LocalWisseBotProvider(catalogue)
  }

  setSemanticInterpreter(semantic: SemanticInterpreter | null) {
    this.semantic = semantic
  }

  async interpret(
    message: string,
    context: ConversationContext,
  ): Promise<AssistantInterpretation> {
    const deterministic = await this.deterministic.interpret(message, context)
    if (!this.semantic || deterministic.kind === 'unsupported' || deterministic.kind === 'conflict') {
      return deterministic
    }
    if (
      deterministic.kind === 'clarification' &&
      deterministic.evidence.some((item) =>
        item.source === 'exact-rule' || item.source === 'entity-match',
      )
    ) {
      return deterministic
    }

    try {
      const semantic = await this.semantic.interpret(message)
      const top = semantic.prototypeMatches[0]
      const second = semantic.prototypeMatches[1]
      if (!top) return deterministic

      if (deterministic.kind === 'recommendation') {
        return mergeSemanticSignal(deterministic, top, semantic.trackScores)
      }

      // Negation and entity substitutions remain deterministic-only. A semantic match may
      // retrieve tracks, but it is not allowed to reverse an explicit negative instruction.
      if (
        containsNegation(message) &&
        (deterministic.request?.excludedMoods.includes(String(top.payload.mood)) ||
          semanticMoodIsExplicitlyNegated(message, top))
      ) return deterministic

      const margin = top.score - (second?.score ?? 0)
      if (top.score < 0.8 || (margin < 0.015 && second?.kind === top.kind)) return deterministic
      const prompt = canonicalPrompt(top)
      if (prompt) {
        const resolved = await this.deterministic.interpret(prompt, context)
        if (resolved.kind === 'recommendation') {
          const merged = mergeSemanticSignal(resolved, top, semantic.trackScores)
          return {
            ...merged,
            summary: `I’m reading that as ${resolved.summary}`,
          }
        }
      }

      const request = defaultSemanticRequest(top, context)
      return {
        kind: 'recommendation',
        request,
        target: request.targetMoods,
        constraints: {
          semanticTrackScores: semantic.trackScores,
          artistPolicy: this.catalogue.artistPolicy,
          excludedTrackIds: request.exclusions.trackIds,
        },
        summary: 'I found a close catalogue-grounded interpretation of that request.',
        matchedTerms: [],
        refinement: null,
        confidence: request.confidence,
        evidence: request.evidence,
        clarification: null,
        mode: 'hybrid',
      }
    } catch {
      return deterministic
    }
  }
}
