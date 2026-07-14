import { neutralMoodVector } from '../../config/constants'
import {
  moodDimensionKeys,
  type MoodDimension,
  type MoodVector,
  type TrackVersionType,
} from '../../config/schemas'
import { clamp } from '../../lib/utils'
import { matchCatalogueEntities, type EntityMatch } from './entityMatcher'
import { findPhrase, includesPhrase, normaliseBotText } from './language/normalise'
import {
  activities,
  ambiguousConcepts,
  followUpLanguage,
  moodLanguage,
  negators,
  requestLanguage,
  timeLanguage,
  unsupportedPatterns,
} from './language/resources'
import type {
  AssistantInterpretation,
  BotCatalogue,
  ClarificationState,
  ConversationContext,
  InterpretationEvidence,
  MusicAssistantProvider,
  StructuredMusicRequest,
} from './types'

export const moodSynonyms = moodLanguage

const moodDefaults: Record<MoodDimension, Partial<MoodVector>> = {
  peaceful: { peaceful: 92, comforted: 80, elegant: 68, energised: 20, dramatic: 20 },
  happy: { happy: 94, energised: 70, confident: 62, comforted: 62, dramatic: 28 },
  romantic: { romantic: 96, elegant: 76, comforted: 67, happy: 58 },
  confident: { confident: 96, energised: 75, elegant: 72, dramatic: 62 },
  energised: { energised: 97, happy: 78, confident: 80, peaceful: 22 },
  nostalgic: { nostalgic: 97, comforted: 76, romantic: 60, peaceful: 58 },
  elegant: { elegant: 97, confident: 72, peaceful: 58, romantic: 56 },
  comforted: { comforted: 97, peaceful: 82, happy: 52, dramatic: 20 },
  dramatic: { dramatic: 97, confident: 76, energised: 68, romantic: 62 },
}

const copyVector = (vector: MoodVector): MoodVector => ({ ...vector })

const isMoodVector = (value: StructuredMusicRequest | MoodVector): value is MoodVector =>
  !('targetMoods' in value)

const contextRequest = (context: ConversationContext): StructuredMusicRequest | null => {
  if (!context.currentTarget) return context.lastInterpretations.at(-1) ?? null
  if (!isMoodVector(context.currentTarget)) return context.currentTarget
  return {
    targetMoods: copyVector(context.currentTarget),
    excludedMoods: [],
    exclusions: {
      trackIds: [...context.rejectedTrackIds],
      albumIds: [],
      artistIds: [],
    },
    surprise: false,
    confidence: 0.9,
    evidence: [],
  }
}

const applyDefaults = (target: MoodVector, mood: MoodDimension) => {
  for (const [dimension, value] of Object.entries(moodDefaults[mood])) {
    const key = dimension as MoodDimension
    target[key] = Math.max(target[key], value ?? 0)
  }
}

const applyPartial = (target: MoodVector, partial: Partial<MoodVector>) => {
  Object.entries(partial).forEach(([key, value]) => {
    target[key as MoodDimension] = value ?? target[key as MoodDimension]
  })
}

const evidence = (
  concept: string,
  value: string,
  span: string,
  confidence = 0.96,
): InterpretationEvidence => ({
  source: 'exact-rule',
  concept,
  value,
  confidence,
  span,
})

const previousEvidence = (concept: string, value: string): InterpretationEvidence => ({
  source: 'previous-context',
  concept,
  value,
  confidence: 0.92,
})

const phraseIsNegated = (message: string, phrase: string) => {
  const index = message.indexOf(normaliseBotText(phrase))
  if (index < 0) return false
  const prefix = message.slice(Math.max(0, index - 36), index).trim()
  return negators.some((negator) =>
    new RegExp(`(?:^|\\s)${normaliseBotText(negator).replace(/ /g, '\\s+')}(?:\\s+(?:very|too|terlalu|sangat))?\\s*$`).test(prefix),
  )
}

const firstFollowUp = (message: string, id: keyof typeof followUpLanguage) =>
  findPhrase(message, followUpLanguage[id] ?? [])

const inferTime = (message: string) => {
  for (const [time, phrases] of Object.entries(timeLanguage)) {
    const phrase = findPhrase(message, phrases)
    if (phrase) return { time: time as keyof typeof timeLanguage, phrase }
  }
  return null
}

const moodLabel = (mood: MoodDimension) =>
  mood === 'energised' ? 'energetic' : mood === 'comforted' ? 'comforting' : mood

const eraValues = (catalogue: BotCatalogue | null, direction: 'older' | 'modern') => {
  if (!catalogue) return [direction]
  const values = new Set<string>()
  for (const track of catalogue.tracks) {
    const year = track.releaseYear ?? track.year
    if (!year || !track.era) continue
    if (direction === 'older' ? year <= 2009 : year >= 2016) values.add(track.era)
  }
  return [...values]
}

const collectionForConcept = (catalogue: BotCatalogue | null, concept: string) => {
  if (!catalogue) return undefined
  const terms: Record<string, string[]> = {
    traditional: ['traditional', 'nusantara'],
    duet: ['duet', 'collaboration'],
    festive: ['festive'],
    modern: ['modern'],
    familiar: ['essentials', 'classic'],
    discovery: ['hidden', 'gem'],
  }
  return catalogue.collections.find((collection) =>
    terms[concept]?.some((term) =>
      `${collection.id} ${collection.label}`.toLowerCase().includes(term),
    ),
  )?.id
}

const clarification = (
  question: string,
  choices: string[],
  reason: ClarificationState['reason'] = 'low-confidence',
): ClarificationState => ({
  question,
  reason,
  choices: choices.map((label, index) => ({
    id: `choice-${index + 1}`,
    label,
    message: label,
  })),
})

const resultFrom = (input: {
  kind: AssistantInterpretation['kind']
  request?: StructuredMusicRequest | null
  constraints?: AssistantInterpretation['constraints']
  summary: string
  matchedTerms?: string[]
  refinement?: string | null
  confidence?: number
  evidence?: InterpretationEvidence[]
  clarification?: ClarificationState | null
  resetContext?: boolean
}): AssistantInterpretation => ({
  kind: input.kind,
  request: input.request ?? null,
  target: input.request?.targetMoods ?? null,
  constraints: input.constraints ?? {},
  summary: input.summary,
  matchedTerms: input.matchedTerms ?? [],
  refinement: input.refinement ?? null,
  confidence: input.confidence ?? 0,
  evidence: input.evidence ?? [],
  clarification: input.clarification ?? null,
  mode: 'deterministic',
  ...(input.resetContext ? { resetContext: true } : {}),
})

const unsupportedResult = (): AssistantInterpretation =>
  resultFrom({
    kind: 'unsupported',
    summary:
      'I’m designed to guide your music experience. I can help with songs, eras, moods, activities and saved favourites, but I won’t invent lyrics, facts or private information.',
    confidence: 1,
  })

const generalClarification = (): AssistantInterpretation => {
  const state = clarification(
    'Which direction should I tune: calm, cheerful, romantic, powerful, or a surprise?',
    ['Calm and gently awake', 'Cheerful and upbeat', 'Romantic and warm', 'Surprise me'],
  )
  return resultFrom({
    kind: 'clarification',
    summary: state.question,
    confidence: 0.2,
    clarification: state,
  })
}

const describeRequest = (input: {
  moods: MoodDimension[]
  excluded: string[]
  activity?: string
  time?: string
  refinement?: string
  familiarity?: StructuredMusicRequest['familiarity']
  versionTypes?: TrackVersionType[]
  trackTitle?: string
}): string => {
  if (input.trackTitle) return `the catalogue track “${input.trackTitle}”.`
  if (input.refinement === 'not sleepy') {
    return 'calm music with gentle energy rather than something sleepy.'
  }
  const refinementCopy: Record<string, string> = {
    'more energetic': 'more energy while keeping the current mood in view.',
    calmer: 'a calmer, more comforting version of the current frequency.',
    'less intense': 'the same direction with a softer, less intense profile.',
    'more intense': 'greater emotional intensity while preserving the current mood.',
    similar: 'the shape of the last selection, with a fresh track.',
    different: 'a distinctly different choice without losing the requested mood.',
    another: 'another strong choice on the current frequency.',
    'different album': 'the current mood from a different album.',
    older: 'the current mood from an earlier era.',
    modern: 'the current mood with a more modern release preference.',
  }
  if (input.refinement) {
    const copy = refinementCopy[input.refinement]
    if (copy) return copy
  }
  const moodText = [...new Set(input.moods)].map(moodLabel)
  const joined = moodText.length > 1
    ? `${moodText.slice(0, -1).join(', ')} and ${moodText.at(-1)}`
    : moodText[0]
  const parts: string[] = []
  if (joined) parts.push(joined)
  if (input.versionTypes?.includes('traditional')) parts.push('traditional character')
  if (input.versionTypes?.includes('duet')) parts.push('a duet')
  if (input.familiarity === 'discovery') parts.push('a less familiar discovery')
  if (input.familiarity === 'familiar') parts.push('a familiar selection')
  let text = parts.length ? parts.join(' with ') : 'music for this moment'
  if (input.activity) text += ` for ${input.activity.replace(/-/g, ' ')}`
  if (input.time) text += ` at ${input.time}`
  if (input.excluded.length) text += ` while avoiding ${input.excluded.join(' and ')}`
  return `${text}.`
}

export class LocalWisseBotProvider implements MusicAssistantProvider {
  private readonly exactTrackLabels: Array<{
    id: string
    label: string
    normalised: string
    primary: boolean
    confidence: number
  }>

  constructor(private readonly catalogue: BotCatalogue | null = null) {
    this.exactTrackLabels = (catalogue?.tracks ?? [])
      .filter((track) => track.active)
      .map((track) => ({
        id: track.id,
        label: track.title,
        normalised: normaliseBotText(track.title),
        primary: track.isPrimaryVersion,
        confidence: track.curationConfidence,
      }))
      .sort(
        (left, right) =>
          Number(right.primary) - Number(left.primary) ||
          right.confidence - left.confidence ||
          left.id.localeCompare(right.id),
      )
  }

  private exactTrackMatch(message: string): EntityMatch | null {
    const query = ` ${normaliseBotText(message)} `
    const directBagiTitle = /\b(?:please\s+|tolong\s+)?bagi\s+(?!sesuatu\b|lagu\b|yang\b)\S+/.test(query)
    const hasTitleCue =
      /\b(play|song|track|lagu|mainkan|cari|find|search|tajuk)\b/.test(query) ||
      directBagiTitle
    const found = this.exactTrackLabels.find((entry) => {
      if (entry.normalised.length < 4) return false
      if (!entry.normalised.includes(' ') && !hasTitleCue) return false
      return query.includes(` ${entry.normalised} `)
    })
    return found
      ? { kind: 'track', id: found.id, label: found.label, score: 0.99, exact: true }
      : null
  }

  async interpret(
    rawMessage: string,
    context: ConversationContext,
  ): Promise<AssistantInterpretation> {
    const message = normaliseBotText(rawMessage)
    if (!message) return generalClarification()
    if (unsupportedPatterns.some((pattern) => pattern.test(message))) return unsupportedResult()

    const startOver = firstFollowUp(message, 'startOver')
    if (startOver) {
      const state = clarification(
        'Fresh frequency. How would you like the music to feel?',
        ['Calm and gently awake', 'Cheerful and upbeat', 'Romantic and warm', 'Surprise me'],
      )
      return resultFrom({
        kind: 'clarification',
        summary: state.question,
        matchedTerms: [startOver],
        confidence: 1,
        evidence: [evidence('conversation', 'reset', startOver)],
        clarification: state,
        resetContext: true,
      })
    }

    for (const [concept, ambiguity] of Object.entries(ambiguousConcepts)) {
      if (
        includesPhrase(message, concept) &&
        !/\b(vocal|vocals|vokal|energy|energetic|bertenaga|emotion|emotional|emosi|grand|dramatic|dramatik|intense|calm|tenang|reflective|reflektif)\b/.test(message)
      ) {
        const state = clarification(ambiguity.question, ambiguity.choices, 'ambiguous')
        return resultFrom({
          kind: 'conflict',
          summary: state.question,
          matchedTerms: [concept],
          confidence: 0.58,
          evidence: [evidence('ambiguous-concept', concept, concept, 0.58)],
          clarification: state,
        })
      }
    }

    const existing = contextRequest(context)
    const pattern = (expression: RegExp) => message.match(expression)?.[0]
    const similar = firstFollowUp(message, 'similar') ?? pattern(
      /\b(?:use|jadikan|make)\b.{0,24}\b(?:reference|rujukan)\b|\b(?:similar|same|matching|seakan|serupa|hampir sama)\b.{0,22}\b(?:character|feeling|mood|idea|rasa|pilihan|track|lagu)\b/,
    )
    const different = firstFollowUp(message, 'different')
    const another = firstFollowUp(message, 'another')
    const rejectTrack = firstFollowUp(message, 'rejectTrack') ?? pattern(
      /\b(?:do not|dont|not|exclude|reject|remove|take out|jangan|tolak|keluarkan)\b.{0,34}\b(?:track|song|title|selection|result|recommendation|lagu|pilihan)\b|\b(?:track|song|title|selection|lagu|pilihan)\b.{0,28}\b(?:dont|again|exclude|reject|remove|jangan|lagi|tolak)\b/,
    )
    const rejectAlbum = firstFollowUp(message, 'rejectAlbum') ?? pattern(
      /\b(?:not|exclude|avoid|different|another|switch|outside|move|choose from|do not draw from|jangan|bukan|tukar|berlainan|keluarkan|cari)\b.{0,36}\b(?:album|release)\b|\b(?:album|release)\b.{0,28}\b(?:not|again|different|another|switch|jangan|lain|berlainan|tukar)\b/,
    )
    const differentEra = firstFollowUp(message, 'differentEra')
    const moreEnergy = firstFollowUp(message, 'moreEnergy') ?? pattern(
      /\b(?:raise|increase|lift|more|upward|add|naikkan|tambah|lajukan|tenaga naik)\b.{0,30}\b(?:energy|momentum|movement|pace|pulse|tempo|gerak|rentak|tenaga|vibe)\b|\b(?:energy|momentum|movement|pace|pulse|tempo|gerak|rentak|tenaga)\b.{0,20}\b(?:up|higher|more|naik|bertambah)\b/,
    )
    const lessEnergy = firstFollowUp(message, 'lessEnergy') ?? pattern(
      /\b(?:less rush|settle|slow|calm|lower|kurang laju|tenangkan|perlahan)\b.{0,26}\b(?:pace|rush|energy|tempo|rentak|laju|vibe)?\b/,
    )
    const moreIntensity = firstFollowUp(message, 'moreIntensity')
    const lessIntensity = firstFollowUp(message, 'lessIntensity') ?? pattern(
      /\b(?:lower|pull|tone|dial|soften|gentler|easier|less|kurang|turunkan|lembut|jangan terlalu|jangan berat)\b.{0,34}\b(?:intensity|force|pressure|delivery|arc|emotion|emotional|tekanan|emosi|kuat|berat|dramatik)\b/,
    )
    const genericMoodComparative = /\b(more|less|lebih|kurang)\b/.test(message)
    const followUp = Boolean(
      similar || different || another || rejectTrack || rejectAlbum || differentEra ||
      moreEnergy || lessEnergy || moreIntensity || lessIntensity || genericMoodComparative,
    )

    let target = copyVector(
      followUp && existing
        ? existing.targetMoods
        : similar && context.previousRecommendedTrack
          ? context.previousRecommendedTrack.moods
          : neutralMoodVector,
    )
    const request: StructuredMusicRequest = {
      targetMoods: target,
      excludedMoods: followUp && existing ? [...existing.excludedMoods] : [],
      exclusions: {
        trackIds: [
          ...new Set([
            ...context.rejectedTrackIds,
            ...(followUp && existing ? existing.exclusions.trackIds : []),
          ]),
        ],
        albumIds: followUp && existing ? [...existing.exclusions.albumIds] : [],
        artistIds: followUp && existing ? [...existing.exclusions.artistIds] : [],
      },
      surprise: false,
      confidence: 0,
      evidence: [],
    }
    const constraints: AssistantInterpretation['constraints'] = {}
    const matchedTerms: string[] = []
    const matchedMoods: MoodDimension[] = []
    let refinement: string | null = null

    if (followUp && existing) {
      request.evidence.push(previousEvidence('target', 'preserved'))
    }
    if (similar && context.previousRecommendedTrack) {
      // The active conversational target is more recent than the last track's
      // raw profile. Use the track only when no structured target is available.
      if (!existing) {
        target = copyVector(context.previousRecommendedTrack.moods)
        request.targetMoods = target
      }
      request.relationToPrevious = 'similar'
      request.exclusions.trackIds.push(context.previousRecommendedTrack.id)
      request.evidence.push(previousEvidence('relation', 'similar'))
      matchedTerms.push(similar)
      refinement = 'similar'
    }

    const moodTerms = moodDimensionKeys
      .map((mood) => ({
        mood,
        term: moodLanguage[mood].find((phrase) => includesPhrase(message, phrase)),
      }))
      .filter((item): item is { mood: MoodDimension; term: string } => Boolean(item.term))
      .filter((item, _index, all) =>
        !all.some(
          (other) =>
            other.mood !== item.mood &&
            normaliseBotText(other.term).length > normaliseBotText(item.term).length &&
            normaliseBotText(other.term).includes(normaliseBotText(item.term)),
        ),
      )
    for (const { mood, term } of moodTerms) {
      matchedTerms.push(term)
      if (phraseIsNegated(message, term)) {
        target[mood] = clamp(target[mood] - (/\b(not very|not too|tak terlalu|jangan terlalu)\b/.test(message) ? 24 : 38))
        request.excludedMoods.push(mood)
        request.evidence.push(evidence('excluded-mood', mood, term))
        refinement = `less ${mood}`
      } else {
        applyDefaults(target, mood)
        matchedMoods.push(mood)
        request.evidence.push(evidence('mood', mood, term))
      }
    }

    let activity: string | undefined
    const activityMatch = activities
      .map((item) => ({ item, phrase: findPhrase(message, item.phrases) }))
      .filter((match): match is { item: (typeof activities)[number]; phrase: string } => Boolean(match.phrase))
      .sort((left, right) => normaliseBotText(right.phrase).length - normaliseBotText(left.phrase).length)[0]
    if (activityMatch) {
      activity = activityMatch.item.context
      applyPartial(target, activityMatch.item.moods)
      request.activities = [activityMatch.item.context]
      request.evidence.push(evidence('activity', activityMatch.item.context, activityMatch.phrase))
      constraints.activity = activityMatch.item.context
      matchedTerms.push(activityMatch.phrase)
    }

    const time = inferTime(message)
    if (time) {
      request.contexts = [time.time]
      request.evidence.push(evidence('time', time.time, time.phrase))
      constraints.timeOfDay = time.time
      matchedTerms.push(time.phrase)
    }

    const notSleepy = /\b(not sleepy|not too slow|dont make it sleepy|not send me to sleep|not put me to sleep|without becoming drowsy|rather than sleepy|avoid a lullaby|keep my eyes open|keeping the music awake|jangan mengantuk|tak mengantuk|tidak mengantuk|jangan terlalu perlahan|tak terlalu slow|jangan sampai mengantuk|mata kekal buka)\b/.test(message)
    if (notSleepy) {
      target.energised = Math.max(48, target.energised)
      target.happy = Math.max(52, target.happy)
      request.energy = { target: target.energised, direction: 'higher' }
      constraints.minEnergy = 35
      constraints.targetEnergy = target.energised
      request.evidence.push(evidence('energy-floor', 'gently-awake', 'not sleepy'))
      matchedTerms.push('not sleepy')
      refinement = 'not sleepy'
    }
    const avoidSad = /\b(not sad|no sadness|jangan sedih|tak sedih|tidak sedih)\b/.test(message)
    if (avoidSad) {
      target.happy = Math.max(72, target.happy)
      target.comforted = Math.max(66, target.comforted)
      target.dramatic = Math.min(38, target.dramatic)
      request.excludedMoods.push('sad')
      request.evidence.push(evidence('excluded-affect', 'sad', 'not sad'))
      matchedTerms.push('not sad')
    }

    const avoidDrama =
      /\b(?:avoid|exclude|without|nothing|keep|leave out|dial down|take out)\b.{0,42}\b(?:dramatic|drama|intense|intensity|sweeping|huge emotional|large emotional)\b/.test(message) ||
      /\b(?:dramatic|drama|intense|intensity)\b.{0,18}\b(?:out|away)\b/.test(message) ||
      /\b(?:jangan|tanpa|kurangkan|elak)\b.{0,42}\b(?:dramatik|drama|emosi yang terlalu besar|beban dramatik|emosi besar)\b/.test(message)
    if (avoidDrama) {
      request.evidence = request.evidence.filter(
        (item) => !(item.concept === 'mood' && item.value === 'dramatic'),
      )
      const dramaticIndex = matchedMoods.indexOf('dramatic')
      if (dramaticIndex >= 0) matchedMoods.splice(dramaticIndex, 1)
      target.dramatic = Math.min(30, target.dramatic)
      target.peaceful = Math.max(64, target.peaceful)
      request.excludedMoods.push('dramatic')
      request.intensity = { target: target.dramatic, direction: 'lower' }
      constraints.maxIntensity = Math.min(58, context.previousRecommendedTrack?.intensity ?? 58)
      request.evidence.push(evidence('excluded-mood', 'dramatic', 'avoid dramatic intensity'))
      matchedTerms.push('avoid dramatic intensity')
      refinement = 'less intense'
    }

    if (moreEnergy) {
      target.energised = clamp(target.energised + 28)
      target.happy = clamp(target.happy + 10)
      request.energy = { target: target.energised, direction: 'higher' }
      request.relationToPrevious = 'more-energetic'
      constraints.minEnergy = Math.max(40, target.energised - 22)
      constraints.targetEnergy = target.energised
      request.evidence.push(evidence('energy-direction', 'higher', moreEnergy))
      matchedTerms.push(moreEnergy)
      refinement = 'more energetic'
    }
    if (lessEnergy) {
      target.energised = clamp(target.energised - 24)
      target.peaceful = clamp(target.peaceful + 22)
      target.comforted = clamp(target.comforted + 14)
      request.energy = { target: target.energised, direction: 'lower' }
      request.relationToPrevious = 'less-energetic'
      constraints.maxEnergy = Math.min(75, target.energised + 20)
      constraints.targetEnergy = target.energised
      request.evidence.push(evidence('energy-direction', 'lower', lessEnergy))
      matchedTerms.push(lessEnergy)
      refinement = 'calmer'
    }
    if (moreIntensity) {
      target.dramatic = clamp(target.dramatic + 26)
      request.intensity = { target: target.dramatic, direction: 'higher' }
      request.relationToPrevious = 'more-intense'
      constraints.minIntensity = Math.max(35, target.dramatic - 22)
      constraints.targetIntensity = target.dramatic
      request.evidence.push(evidence('intensity-direction', 'higher', moreIntensity))
      matchedTerms.push(moreIntensity)
      refinement = 'more intense'
    }
    if (lessIntensity) {
      target.dramatic = clamp(target.dramatic - 28)
      target.peaceful = clamp(target.peaceful + 14)
      request.intensity = { target: target.dramatic, direction: 'lower' }
      request.relationToPrevious = 'less-intense'
      const previousIntensity = context.previousRecommendedTrack?.intensity ?? 68
      constraints.maxIntensity = Math.max(25, previousIntensity - 18)
      constraints.targetIntensity = target.dramatic
      request.evidence.push(evidence('intensity-direction', 'lower', lessIntensity))
      matchedTerms.push(lessIntensity)
      refinement = 'less intense'
    }

    if (different || another) {
      if (!similar) request.relationToPrevious = 'different'
      const previousId = context.previousRecommendedTrack?.id ?? context.lastRecommendations.at(-1)
      if (previousId) request.exclusions.trackIds.push(previousId)
      const phrase = different ?? another
      if (phrase) {
        request.evidence.push(evidence('relation', 'different', phrase))
        matchedTerms.push(phrase)
      }
      refinement = different ? 'different' : 'another'
    }
    if (rejectTrack) {
      const previousId = context.previousRecommendedTrack?.id ?? context.lastRecommendations.at(-1)
      if (previousId) request.exclusions.trackIds.push(previousId)
      request.relationToPrevious = 'different'
      request.evidence.push(evidence('track-exclusion', previousId ?? 'previous', rejectTrack))
      matchedTerms.push(rejectTrack)
      refinement = 'another'
    }
    if (rejectAlbum) {
      const albumId = context.previousRecommendedTrack?.albumId
      if (albumId) request.exclusions.albumIds.push(albumId)
      request.relationToPrevious = 'different'
      request.evidence.push(evidence('album-exclusion', albumId || 'previous', rejectAlbum))
      matchedTerms.push(rejectAlbum)
      refinement = 'different album'
    }
    if (differentEra) {
      const previousEra = context.previousRecommendedTrack?.era
      const preferred = this.catalogue
        ? [...new Set(this.catalogue.tracks.map((track) => track.era).filter((era) => era && era !== previousEra))]
        : []
      request.era = {
        ...(preferred.length ? { preferred } : {}),
        ...(previousEra ? { excluded: [previousEra] } : {}),
      }
      if (preferred.length) constraints.preferredEras = preferred
      if (previousEra) constraints.excludedEras = [previousEra]
      request.evidence.push(evidence('era-relation', 'different', differentEra))
      matchedTerms.push(differentEra)
      refinement = 'different era'
    }

    const surprise = findPhrase(message, requestLanguage.surprise)
    const familiar = findPhrase(message, requestLanguage.familiar)
    const discovery = findPhrase(message, requestLanguage.discovery)
    if (surprise) {
      request.surprise = true
      request.familiarity = 'discovery'
      constraints.surprise = true
      constraints.noveltyPreference = 'novel'
      request.evidence.push(evidence('novelty', 'surprise', surprise))
      matchedTerms.push(surprise)
      refinement = 'surprise'
    } else if (discovery) {
      request.familiarity = 'discovery'
      constraints.noveltyPreference = 'novel'
      constraints.deepCut = true
      request.evidence.push(evidence('familiarity', 'discovery', discovery))
      matchedTerms.push(discovery)
    } else if (familiar) {
      request.familiarity = 'familiar'
      constraints.noveltyPreference = 'familiar'
      request.evidence.push(evidence('familiarity', 'familiar', familiar))
      matchedTerms.push(familiar)
    }

    const older = findPhrase(message, requestLanguage.older)
    const modern = findPhrase(message, requestLanguage.modern)
    if (older || modern) {
      const direction = older ? 'older' : 'modern'
      const phrase = older ?? modern ?? direction
      const preferred = eraValues(this.catalogue, direction)
      request.era = { preferred }
      constraints.preferredEras = preferred
      request.evidence.push(evidence('era', direction, phrase))
      matchedTerms.push(phrase)
      refinement = direction
    }

    const versionRequests: Array<{ phrases: string[]; version: TrackVersionType; concept: string }> = [
      { phrases: requestLanguage.traditional, version: 'traditional', concept: 'traditional' },
      { phrases: requestLanguage.duet, version: 'duet', concept: 'duet' },
      { phrases: requestLanguage.festive, version: 'festive', concept: 'festive' },
    ]
    for (const item of versionRequests) {
      const phrase = findPhrase(message, item.phrases)
      if (!phrase) continue
      request.versionTypes = [...new Set([...(request.versionTypes ?? []), item.version])]
      constraints.versionTypes = request.versionTypes
      const collectionId = collectionForConcept(this.catalogue, item.concept)
      if (collectionId) request.collectionIds = [...new Set([...(request.collectionIds ?? []), collectionId])]
      request.evidence.push(evidence('version', item.version, phrase))
      matchedTerms.push(phrase)
    }
    const onlyFullSongs = /\b(?:only full songs?|full songs? only|play something that works here|don'?t open another app|no external apps?|inside pink fm|works here|lagu penuh sahaja|hanya lagu penuh|jangan buka app lain|tak mahu preview|no previews?)\b/.test(message)
    if (onlyFullSongs) {
      constraints.requireFullPlayback = true
      constraints.allowPreviewsWhenFullSongsUnavailable = false
      request.evidence.push(evidence('playback', 'full-song-only', 'full songs only'))
      matchedTerms.push('full songs only')
    }
    const noLiveVersions = /\b(?:no live versions?|studio version only|not live|jangan live|bukan live)\b/.test(message)
    if (noLiveVersions) {
      constraints.allowOfficialAlternateVersions = false
      request.evidence.push(evidence('playback-version', 'no-live', 'no live versions'))
      matchedTerms.push('no live versions')
    }
    const liveIsOkay = /\b(?:live version is okay|live is okay|official live is okay|boleh live|live pun boleh)\b/.test(message)
    if (liveIsOkay) {
      constraints.allowOfficialAlternateVersions = true
      request.evidence.push(evidence('playback-version', 'live-ok', 'live version is okay'))
      matchedTerms.push('live version is okay')
    }

    const hasHighPrecisionInterpretation = request.evidence.some(
      (item) => item.source === 'exact-rule',
    )
    const directBagiTitle = /\b(?:please\s+|tolong\s+)?bagi\s+(?!sesuatu\b|lagu\b|yang\b)\S+/.test(message)
    const explicitEntitySearch =
      /\b(play|mainkan|cari|find|search|album|called|titled|tajuk)\b/.test(message) ||
      directBagiTitle
    const titleNoun = /\b(song|track|lagu)\b/.test(message)
    const exactTrack = this.exactTrackMatch(rawMessage)
    const entities = exactTrack
      ? [exactTrack]
      : hasHighPrecisionInterpretation && !explicitEntitySearch
        ? []
        : matchCatalogueEntities(rawMessage, this.catalogue, {
            allowFuzzy: explicitEntitySearch || (titleNoun && !hasHighPrecisionInterpretation),
          })
    const trackEntity = entities.find((entity) => entity.kind === 'track')
    if (trackEntity && trackEntity.score < 0.88) {
      const state = clarification(
        `Did you mean “${trackEntity.label}”?`,
        [`Yes — ${trackEntity.label}`, 'No — search again'],
        'entity-confirmation',
      )
      return resultFrom({
        kind: 'clarification',
        summary: state.question,
        matchedTerms: [trackEntity.label],
        confidence: trackEntity.score,
        evidence: [{
          source: 'entity-match',
          concept: 'track',
          value: trackEntity.id,
          confidence: trackEntity.score,
          span: rawMessage,
        }],
        clarification: state,
      })
    }
    if (trackEntity && trackEntity.score >= 0.88) {
      request.requestedTrackId = trackEntity.id
      constraints.requestedTrackId = trackEntity.id
      request.evidence.push({
        source: 'entity-match',
        concept: 'track',
        value: trackEntity.id,
        confidence: trackEntity.score,
        span: trackEntity.label,
      })
      matchedTerms.push(trackEntity.label)
    }

    const artistEntity = entities.find((entity) => entity.kind === 'artist' && entity.score >= 0.88)
    if (artistEntity) {
      request.requestedArtistIds = [artistEntity.id]
      constraints.requestedArtistIds = [artistEntity.id]
      request.evidence.push({ source: 'entity-match', concept: 'artist', value: artistEntity.id, confidence: artistEntity.score, span: artistEntity.label })
    }
    const collectionEntity = entities.find((entity) => entity.kind === 'collection' && entity.score >= 0.86)
    if (collectionEntity) {
      request.collectionIds = [...new Set([...(request.collectionIds ?? []), collectionEntity.id])]
      constraints.preferredCollections = request.collectionIds
      request.evidence.push({ source: 'entity-match', concept: 'collection', value: collectionEntity.id, confidence: collectionEntity.score, span: collectionEntity.label })
    } else if (request.collectionIds?.length) {
      constraints.preferredCollections = request.collectionIds
    }
    const albumEntity = entities.find((entity) => entity.kind === 'album')
    if (albumEntity && albumEntity.score >= 0.9 && /\b(album|from|daripada|dari)\b/.test(message)) {
      request.preferredAlbumIds = [albumEntity.id]
      constraints.preferredAlbumIds = [albumEntity.id]
      request.evidence.push({ source: 'entity-match', concept: 'album', value: albumEntity.id, confidence: albumEntity.score, span: albumEntity.label })
    }

    request.exclusions.trackIds = [...new Set(request.exclusions.trackIds)]
    request.exclusions.albumIds = [...new Set(request.exclusions.albumIds)]
    request.exclusions.artistIds = [...new Set(request.exclusions.artistIds)]
    request.excludedMoods = [...new Set(request.excludedMoods)]
    constraints.excludedTrackIds = request.exclusions.trackIds
    constraints.excludedAlbumIds = request.exclusions.albumIds
    constraints.excludedArtistIds = request.exclusions.artistIds
    if (context.activeArtistPolicy) constraints.artistPolicy = context.activeArtistPolicy

    const useful = request.evidence.some((item) => item.source !== 'previous-context')
    if (!useful && similar) {
      const state = clarification(
        'I need a current song before I can match “like that.” Would you like to choose a starting mood?',
        ['Calm and gently awake', 'Cheerful and upbeat', 'Romantic and warm', 'Surprise me'],
      )
      return resultFrom({
        kind: 'clarification',
        summary: state.question,
        matchedTerms: [similar],
        confidence: 0.98,
        evidence: [evidence('missing-context', 'previous-track', similar)],
        clarification: state,
      })
    }
    if (!useful) return generalClarification()

    const confidenceValues = request.evidence
      .filter((item) => item.source !== 'previous-context')
      .map((item) => item.confidence)
    request.confidence = Math.min(
      0.99,
      confidenceValues.reduce((sum, value) => sum + value, 0) /
        Math.max(1, confidenceValues.length),
    )
    const trackTitle = trackEntity && trackEntity.score >= 0.88 ? trackEntity.label : undefined
    const summary = describeRequest({
      moods: matchedMoods,
      excluded: request.excludedMoods,
      ...(activity ? { activity } : {}),
      ...(time ? { time: time.time } : {}),
      ...(refinement ? { refinement } : {}),
      ...(request.familiarity ? { familiarity: request.familiarity } : {}),
      ...(request.versionTypes ? { versionTypes: request.versionTypes } : {}),
      ...(trackTitle ? { trackTitle } : {}),
    })

    return resultFrom({
      kind: 'recommendation',
      request,
      constraints,
      summary,
      matchedTerms: [...new Set(matchedTerms)],
      refinement,
      confidence: request.confidence,
      evidence: request.evidence,
    })
  }
}
