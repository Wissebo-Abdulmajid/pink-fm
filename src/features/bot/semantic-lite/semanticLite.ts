import type { Collection, MoodDimension, Track } from '../../../config/schemas'
import { moodDimensionKeys } from '../../../config/schemas'
import { normaliseBotText } from '../language/normalise'
import {
  activities,
  followUpLanguage,
  moodLanguage,
  requestLanguage,
  timeLanguage,
} from '../language/resources'
import { flattenedSemanticPrototypes } from '../semantic/prototypes'
import type {
  SemanticInterpretationResult,
  SemanticPrototypeKind,
  SemanticPrototypeMatch,
} from '../semantic/semanticTypes'
import type { SemanticInterpreter } from '../types'

type FeatureVector = Map<string, number>

type ConceptDocument = {
  id: string
  kind: SemanticPrototypeKind
  payload: Record<string, string | number | boolean>
  vector: FeatureVector
}

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'bagi', 'but', 'dan', 'dengan', 'for',
  'give', 'i', 'ini', 'itu', 'lagu', 'me', 'music', 'my', 'nak', 'of', 'on', 'please',
  'saya', 'something', 'the', 'to', 'untuk', 'want', 'yang',
])

const conceptualVocabulary: Record<MoodDimension, string[]> = {
  peaceful: [
    'breathe', 'breathing', 'ease', 'easygoing', 'hushed', 'quiet', 'settle', 'settled',
    'still', 'stillness', 'unhurried', 'unwind', 'lapang', 'reda', 'redup', 'senyap',
  ],
  happy: [
    'bounce', 'buoyant', 'delight', 'good news', 'grin', 'lighthearted', 'optimistic', 'smile',
    'sunshine', 'suka', 'senyum', 'ringan hati', 'naik mood',
  ],
  romantic: [
    'affection', 'beloved', 'devotion', 'fond', 'heartfelt', 'intimate', 'tenderness',
    'sayang', 'rindu', 'jiwang', 'hati berbunga',
  ],
  confident: [
    'commanding', 'fearless', 'grounded', 'proud', 'ready', 'resolute', 'self assured',
    'stand tall', 'mantap', 'tabah', 'teguh', 'berdiri kuat',
  ],
  energised: [
    'momentum', 'movement', 'pep', 'pulse', 'spark', 'speed', 'spring', 'wake', 'awake',
    'gerak', 'laju', 'segar', 'naikkan tenaga', 'tak mengantuk',
  ],
  nostalgic: [
    'earlier days', 'memory lane', 'remember', 'reminisce', 'retro', 'yesteryear',
    'dulu dulu', 'imbau', 'teringat', 'zaman sekolah',
  ],
  elegant: [
    'cultivated', 'dignified', 'finesse', 'luxurious', 'polished', 'poised', 'tasteful',
    'eksklusif', 'kemas', 'sofistikated', 'berseri',
  ],
  comforted: [
    'company', 'consoling', 'embrace', 'held', 'home', 'nurturing', 'reassure', 'support',
    'peluk', 'temani', 'pujuk', 'lega', 'rasa ditemani',
  ],
  dramatic: [
    'cinematic', 'climax', 'goosebumps', 'huge', 'majestic', 'towering', 'weighty',
    'meremang', 'kemuncak', 'penuh perasaan', 'berat emosi',
  ],
}

const lightweightIntentVocabulary: Record<string, string[]> = {
  'more-energetic': ['pick up pace', 'raise tempo', 'more movement', 'naikkan tempo', 'tambah tenaga'],
  'less-intense': ['take edge off', 'dial it down', 'ease pressure', 'kurangkan berat', 'jangan berat sangat'],
  similar: ['same character', 'keep that feeling', 'continue this vibe', 'kekalkan rasa', 'lebih kurang begitu'],
  different: ['change direction', 'switch it up', 'fresh direction', 'tukar suasana', 'lari sikit'],
  discovery: ['unfamiliar corner', 'beyond the hits', 'surprise discovery', 'jarang orang pilih', 'bukan biasa biasa'],
  familiar: ['know by heart', 'recognisable one', 'comfort pick', 'selalu dengar', 'mudah kenal'],
  traditional: ['heritage sound', 'roots music', 'cultural rhythm', 'rentak warisan', 'bunyi tradisi'],
  modern: ['current sound', 'present day', 'fresh production', 'bunyi semasa', 'zaman sekarang'],
}

const add = (vector: FeatureVector, feature: string, weight: number) => {
  vector.set(feature, (vector.get(feature) ?? 0) + weight)
}

const stemMalay = (token: string) => {
  if (token.length < 6) return token
  let value = token
  for (const prefix of ['meng', 'meny', 'men', 'mem', 'ber', 'ter', 'per', 'pen', 'di', 'ke']) {
    if (value.startsWith(prefix) && value.length - prefix.length >= 4) {
      value = value.slice(prefix.length)
      break
    }
  }
  for (const suffix of ['annya', 'kan', 'nya', 'lah']) {
    if (value.endsWith(suffix) && value.length - suffix.length >= 4) {
      value = value.slice(0, -suffix.length)
      break
    }
  }
  return value
}

const charNgrams = (token: string) => {
  const padded = `^${token}$`
  const grams: string[] = []
  for (let index = 0; index <= padded.length - 3; index += 1) {
    grams.push(padded.slice(index, index + 3))
  }
  return grams
}

const phraseMatchesFuzzily = (normalised: string, phrase: string) => {
  const candidate = normaliseBotText(phrase)
  if (!candidate) return false
  if (` ${normalised} `.includes(` ${candidate} `)) return true
  if (candidate.includes(' ') || candidate.length < 5) return false
  const target = new Set(charNgrams(candidate))
  return normalised.split(' ').some((token) => {
    if (Math.abs(token.length - candidate.length) > 2 || token.length < 4) return false
    const grams = new Set(charNgrams(token))
    const overlap = [...target].filter((gram) => grams.has(gram)).length
    return (2 * overlap) / Math.max(1, target.size + grams.size) >= 0.72
  })
}

const conceptFeatures = (normalised: string) => {
  const concepts: string[] = []
  for (const mood of moodDimensionKeys) {
    if ([...moodLanguage[mood], ...conceptualVocabulary[mood]].some((phrase) => phraseMatchesFuzzily(normalised, phrase))) {
      concepts.push(`concept:mood:${mood}`)
    }
  }
  for (const activity of activities) {
    if (activity.phrases.some((phrase) => phraseMatchesFuzzily(normalised, phrase))) {
      concepts.push(`concept:activity:${activity.id}`)
    }
  }
  for (const [intent, phrases] of Object.entries(lightweightIntentVocabulary)) {
    if (phrases.some((phrase) => phraseMatchesFuzzily(normalised, phrase))) {
      concepts.push(`concept:intent:${intent}`)
    }
  }
  return concepts
}

const vectorise = (value: string): FeatureVector => {
  const normalised = normaliseBotText(value)
  const vector: FeatureVector = new Map()
  const tokens = normalised
    .split(' ')
    .filter(Boolean)
    .map(stemMalay)

  for (const token of tokens) {
    if (!stopWords.has(token)) add(vector, `word:${token}`, 2.4)
    if (token.length >= 4) {
      for (const gram of charNgrams(token)) add(vector, `tri:${gram}`, 0.32)
    }
  }
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index]
    const right = tokens[index + 1]
    if (left && right && (!stopWords.has(left) || !stopWords.has(right))) {
      add(vector, `pair:${left}_${right}`, 1.1)
    }
  }
  for (const concept of conceptFeatures(normalised)) add(vector, concept, 5.5)
  return vector
}

const cosine = (left: FeatureVector, right: FeatureVector) => {
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (const value of left.values()) leftMagnitude += value * value
  for (const [feature, value] of right) {
    rightMagnitude += value * value
    dot += value * (left.get(feature) ?? 0)
  }
  if (!leftMagnitude || !rightMagnitude) return 0
  return dot / Math.sqrt(leftMagnitude * rightMagnitude)
}

const conceptKey = (document: Pick<ConceptDocument, 'kind' | 'payload' | 'id'>) =>
  `${document.kind}:${String(
    document.payload.mood ??
      document.payload.activity ??
      document.payload.intent ??
      document.payload.collectionId ??
      document.id,
  )}`

const calibrate = (raw: number, hasSharedConcept: boolean) => {
  if (hasSharedConcept) return Math.min(0.96, 0.84 + raw * 0.14)
  return Math.min(0.9, 0.54 + raw * 0.5)
}

const trackText = (track: Track) => [
  track.title,
  track.album,
  track.semanticDescription,
  track.editorialNote,
  ...track.genres,
  ...track.tags,
  ...track.collections,
  ...track.contexts,
  ...track.useCases,
  ...track.vocalCharacter,
  ...track.instrumentalCharacter,
].join(' ')

const trackMoodAffinity = (query: FeatureVector, track: Track) => {
  const requested = moodDimensionKeys.filter((mood) => query.has(`concept:mood:${mood}`))
  if (!requested.length) return 0
  return requested.reduce((sum, mood) => sum + track.moods[mood] / 100, 0) / requested.length
}

const scoreTrack = (query: FeatureVector, track: Track, vector: FeatureVector) => {
  const lexical = cosine(query, vector)
  const mood = trackMoodAffinity(query, track)
  const combined = lexical * 0.58 + mood * 0.42
  return combined >= 0.18 ? Math.min(0.96, combined) : 0
}

const prototypeDocuments = () => {
  const documents = flattenedSemanticPrototypes().map((prototype) => ({
    id: prototype.id,
    kind: prototype.kind,
    payload: prototype.payload,
    vector: vectorise(prototype.text),
  }))

  for (const mood of moodDimensionKeys) {
    documents.push({
      id: `lite-mood-${mood}`,
      kind: 'mood',
      payload: { mood, strength: 82 },
      vector: vectorise([...moodLanguage[mood], ...conceptualVocabulary[mood]].join(' ')),
    })
  }
  for (const activity of activities) {
    documents.push({
      id: `lite-activity-${activity.id}`,
      kind: 'activity',
      payload: { activity: activity.id },
      vector: vectorise(activity.phrases.join(' ')),
    })
  }
  for (const [intent, phrases] of Object.entries(lightweightIntentVocabulary)) {
    documents.push({
      id: `lite-intent-${intent}`,
      kind: 'intent',
      payload: { intent },
      vector: vectorise(phrases.join(' ')),
    })
  }
  return documents
}

/**
 * Level 2 understanding: a tiny, synchronous retrieval layer built from local
 * profile text and editable language resources. It downloads no model, emits
 * no prose, and can only return catalogue IDs and configured concepts.
 */
export class SemanticLiteInterpreter implements SemanticInterpreter {
  private readonly concepts: ConceptDocument[]
  private readonly tracks: Array<{ track: Track; vector: FeatureVector }>

  constructor(tracks: Track[], collections: Collection[]) {
    this.concepts = [
      ...prototypeDocuments(),
      ...collections.filter((collection) => collection.active).map((collection) => ({
        id: `collection-${collection.id}`,
        kind: 'collection' as const,
        payload: { collectionId: collection.id },
        vector: vectorise(`${collection.label} ${collection.description} ${collection.semanticDescription}`),
      })),
    ]
    this.tracks = tracks
      .filter((track) => track.active)
      .map((track) => ({ track, vector: vectorise(trackText(track)) }))
  }

  async interpret(message: string): Promise<SemanticInterpretationResult> {
    const started = performance.now()
    const query = vectorise(message)
    const queryConcepts = new Set([...query.keys()].filter((feature) => feature.startsWith('concept:')))
    const grouped = new Map<string, SemanticPrototypeMatch>()

    for (const document of this.concepts) {
      const raw = cosine(query, document.vector)
      const sharedConcept = [...queryConcepts].some((feature) => document.vector.has(feature))
      const score = calibrate(raw, sharedConcept)
      if (score < 0.68) continue
      const key = conceptKey(document)
      const previous = grouped.get(key)
      if (!previous || previous.score < score) {
        grouped.set(key, {
          id: document.id,
          kind: document.kind,
          payload: document.payload,
          score,
        })
      }
    }

    const trackScores = Object.fromEntries(
      this.tracks
        .map(({ track, vector }) => [track.id, scoreTrack(query, track, vector)] as const)
        .filter(([, score]) => score > 0),
    )

    return {
      prototypeMatches: [...grouped.values()]
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
        .slice(0, 8),
      trackScores,
      durationMs: performance.now() - started,
    }
  }
}

export const instantModeVocabulary = {
  moods: moodLanguage,
  activities,
  followUps: followUpLanguage,
  requests: requestLanguage,
  times: timeLanguage,
}
