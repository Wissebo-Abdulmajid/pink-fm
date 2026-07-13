import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { env, pipeline } from '@huggingface/transformers'
import {
  collectionsFileSchema,
  embeddingManifestSchema,
  giftSchema,
  moodsFileSchema,
  tracksFileSchema,
  type MoodDimension,
  type Track,
} from '../src/config/schemas.ts'
import { HybridWisseBotProvider } from '../src/features/bot/hybrid-provider.ts'
import { LocalWisseBotProvider } from '../src/features/bot/local-provider.ts'
import { buildGroundedRecommendationResponse } from '../src/features/bot/responseBuilder.ts'
import { SemanticLiteInterpreter } from '../src/features/bot/semantic-lite/semanticLite.ts'
import type {
  AssistantInterpretation,
  BotCatalogue,
  ConversationContext,
  MusicAssistantProvider,
  SemanticInterpreter,
} from '../src/features/bot/types.ts'
import type {
  EmbeddingIndex,
  SemanticInterpretationResult,
  SemanticPrototypeMatch,
} from '../src/features/bot/semantic/semanticTypes.ts'
import { flattenedSemanticPrototypes } from '../src/features/bot/semantic/prototypes.ts'
import { recommendTrack } from '../src/features/recommendations/engine.ts'
import { createDefaultListenerState } from '../src/lib/storage.ts'
import type {
  HiddenConversation,
  HiddenExpected,
  HiddenUtterance,
} from './generate-hidden-evaluation.ts'
import {
  argumentValue,
  hasArgument,
  profilePathFor,
  projectRoot,
  readJsonFile,
  writeJsonFile,
} from './catalog-shared.ts'

type HiddenDataset = {
  schemaVersion: 1
  contentHash: string
  utterances: HiddenUtterance[]
  conversations: HiddenConversation[]
  counts: Record<string, number>
}

type FeatureExtractor = {
  (
    text: string | string[],
    options: { pooling: 'mean' | 'cls'; normalize: true },
  ): Promise<{ data: Float32Array; dims: number[] }>
  dispose: () => Promise<void>
}

type EvaluationScore = {
  passed: boolean
  kindCorrect: boolean
  moodExpected: number
  moodMatched: number
  moodExtra: number
  negationRelevant: boolean
  negationCorrect: boolean
  entityRelevant: boolean
  entityCorrect: boolean
  clarificationRelevant: boolean
  clarificationCorrect: boolean
  unsupportedRelevant: boolean
  unsupportedCorrect: boolean
  followUpRelevant: boolean
  followUpCorrect: boolean
  checks: Record<string, boolean>
}

type Aggregate = {
  total: number
  passed: number
  kindCorrect: number
  moodExpected: number
  moodMatched: number
  moodExtra: number
}

const slug = argumentValue('--slug') ?? 'siti'
const enhancedCurrent = hasArgument('--enhanced-current')
const instantLite = hasArgument('--instant-lite')
const benchmarkModelId = argumentValue('--benchmark-model')
const benchmarkRevision = argumentValue('--model-revision') ?? 'main'
const benchmarkDtype = argumentValue('--model-dtype') ?? 'q8'
const benchmarkPooling = (argumentValue('--model-pooling') ?? 'mean') as 'mean' | 'cls'
const benchmarkLabel = argumentValue('--model-label') ?? benchmarkModelId ?? 'candidate'
const benchmarkQueryPrefix = argumentValue('--query-prefix') ?? ''
const benchmarkPassagePrefix = argumentValue('--passage-prefix') ?? ''
const benchmarkDownloadBytes = Number(argumentValue('--download-bytes') ?? 0)
const isBenchmarkModel = Boolean(benchmarkModelId)
const datasetPath = resolve(projectRoot, 'evaluation', 'hidden', 'holdout.json')
const outputArgument = argumentValue('--output') ?? (
  isBenchmarkModel
    ? `docs/phase-3-model-${benchmarkLabel.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.json`
    : enhancedCurrent
    ? 'docs/phase-3-hidden-baseline-enhanced.json'
    : instantLite
      ? 'docs/phase-3-hidden-final-instant.json'
      : 'docs/phase-3-hidden-baseline-instant.json'
)
const outputPath = resolve(projectRoot, outputArgument)
const dataset = readJsonFile(datasetPath) as HiddenDataset
const profilePath = profilePathFor(slug)
const gift = giftSchema.parse(readJsonFile(resolve(profilePath, 'gift.json')))
const trackFile = tracksFileSchema.parse(readJsonFile(resolve(profilePath, 'tracks.json')))
const moodFile = moodsFileSchema.parse(readJsonFile(resolve(profilePath, 'moods.json')))
const collectionFile = collectionsFileSchema.parse(readJsonFile(resolve(profilePath, 'collections.json')))
const catalogue: BotCatalogue = {
  tracks: trackFile.tracks,
  moods: moodFile.moods,
  collections: collectionFile.collections,
  artistPolicy: gift.artistPolicy,
  primaryArtistId: gift.artist.slug,
  primaryArtistName: gift.artist.name,
}
const trackIds = new Set(catalogue.tracks.map((track) => track.id))

const uniqueMessages = [...new Set([
  ...dataset.utterances.map((item) => item.utterance),
  ...dataset.conversations.flatMap((conversation) =>
    conversation.turns.map((turn) => turn.utterance),
  ),
])]

const dot = (
  vectors: Float32Array,
  offset: number,
  dimensions: number,
  query: Float32Array,
) => {
  let score = 0
  const start = offset * dimensions
  for (let index = 0; index < dimensions; index += 1) {
    score += (vectors[start + index] ?? 0) * (query[index] ?? 0)
  }
  return Math.max(0, Math.min(1, score))
}

class HiddenSemanticInterpreter implements SemanticInterpreter {
  constructor(private readonly values: Map<string, SemanticInterpretationResult>) {}
  async interpret(message: string) {
    const value = this.values.get(message)
    if (!value) throw new Error(`No holdout embedding was computed for: ${message}`)
    return value
  }
}

const semanticTrackText = (track: Track) => [
  `Title: ${track.title}.`,
  `Artist: ${track.artist}.`,
  track.album ? `Album: ${track.album}.` : '',
  track.semanticDescription,
  track.vocalCharacter.length ? `Vocal character: ${track.vocalCharacter.join(', ')}.` : '',
  track.instrumentalCharacter.length
    ? `Instrumental character: ${track.instrumentalCharacter.join(', ')}.`
    : '',
  track.useCases.length ? `Suitable for: ${track.useCases.join(', ')}.` : '',
  track.collections.length ? `Collections: ${track.collections.join(', ')}.` : '',
].filter(Boolean).join(' ')

const candidatePrototypeEntries = [
  ...flattenedSemanticPrototypes(),
  ...catalogue.collections.filter((collection) => collection.active).map((collection) => ({
    id: `collection-${collection.id}`,
    kind: 'collection' as const,
    text: collection.semanticDescription,
    payload: { collectionId: collection.id },
  })),
]

const buildBenchmarkSemantic = async () => {
  if (!benchmarkModelId) throw new Error('A benchmark model ID is required.')
  if (!['mean', 'cls'].includes(benchmarkPooling)) {
    throw new Error('--model-pooling must be mean or cls.')
  }
  env.cacheDir = resolve(projectRoot, '.cache', 'transformers')
  env.allowRemoteModels = true
  const rssBefore = process.memoryUsage().rss
  const loadStarted = performance.now()
  const extractor = (await pipeline('feature-extraction', benchmarkModelId, {
    revision: benchmarkRevision,
    dtype: benchmarkDtype as never,
    device: 'cpu',
    progress_callback: (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return
      const event = raw as Record<string, unknown>
      if (event.status === 'progress' && typeof event.progress === 'number') {
        process.stdout.write(`\r${benchmarkLabel} download: ${Math.round(event.progress)}%`)
      }
    },
  })) as unknown as FeatureExtractor
  const modelLoadMs = performance.now() - loadStarted
  process.stdout.write('\n')

  const timed = async (message: string) => {
    const started = performance.now()
    await extractor(`${benchmarkQueryPrefix}${message}`, {
      pooling: benchmarkPooling,
      normalize: true,
    })
    return performance.now() - started
  }
  const firstInferenceMs = await timed('a calm evening selection')
  const repeatSamples = [
    await timed('lagu yang ceria'),
    await timed('romantic but not sleepy'),
    await timed('sesuatu yang lebih bertenaga'),
  ]

  const encode = async (texts: string[], prefix: string, label: string) => {
    const rows: Float32Array[] = []
    let dimensions = 0
    const batchSize = 20
    for (let offset = 0; offset < texts.length; offset += batchSize) {
      const batch = texts.slice(offset, offset + batchSize).map((text) => `${prefix}${text}`)
      const output = await extractor(batch, { pooling: benchmarkPooling, normalize: true })
      dimensions = output.dims.at(-1) ?? dimensions
      if (!dimensions || output.data.length !== batch.length * dimensions) {
        throw new Error(`Unexpected ${benchmarkLabel} tensor: ${output.dims.join(' x ')}`)
      }
      batch.forEach((_text, row) => {
        rows.push(output.data.slice(row * dimensions, (row + 1) * dimensions))
      })
      process.stdout.write(`\r${benchmarkLabel} ${label}: ${Math.min(offset + batch.length, texts.length)}/${texts.length}`)
    }
    process.stdout.write('\n')
    return { rows, dimensions }
  }

  try {
    const activeTracks = catalogue.tracks.filter((track) => track.active)
    const tracks = await encode(
      activeTracks.map(semanticTrackText),
      benchmarkPassagePrefix,
      'catalogue',
    )
    const prototypes = await encode(
      candidatePrototypeEntries.map((entry) => entry.text),
      benchmarkPassagePrefix,
      'prototypes',
    )
    if (tracks.dimensions !== prototypes.dimensions) {
      throw new Error('Candidate track and prototype dimensions differ.')
    }
    const dimensions = tracks.dimensions
    const search = (query: Float32Array): SemanticInterpretationResult => {
      const started = performance.now()
      const trackScores = Object.fromEntries(activeTracks.map((track, index) => [
        track.id,
        Math.max(0, Math.min(1, tracks.rows[index]?.reduce(
          (sum, value, dimension) => sum + value * (query[dimension] ?? 0),
          0,
        ) ?? 0)),
      ]))
      const collapsed = new Map<string, SemanticPrototypeMatch>()
      candidatePrototypeEntries.forEach((entry, index) => {
        const score = Math.max(0, Math.min(1, prototypes.rows[index]?.reduce(
          (sum, value, dimension) => sum + value * (query[dimension] ?? 0),
          0,
        ) ?? 0))
        const id = entry.id.split(':')[0] ?? entry.id
        const previous = collapsed.get(id)
        if (!previous || score > previous.score) {
          collapsed.set(id, { id, kind: entry.kind, score, payload: entry.payload })
        }
      })
      return {
        trackScores,
        prototypeMatches: [...collapsed.values()]
          .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
          .slice(0, 10),
        durationMs: performance.now() - started,
      }
    }

    const queryStarted = performance.now()
    const queryRows = await encode(uniqueMessages, benchmarkQueryPrefix, 'holdout queries')
    const values = new Map<string, SemanticInterpretationResult>()
    uniqueMessages.forEach((message, index) => {
      const query = queryRows.rows[index]
      if (query) values.set(message, search(query))
    })
    const batchInferenceMs = performance.now() - queryStarted
    const rssAfter = process.memoryUsage().rss
    return {
      interpreter: new HiddenSemanticInterpreter(values),
      performance: {
        mode: 'benchmark-candidate',
        label: benchmarkLabel,
        modelId: benchmarkModelId,
        revision: benchmarkRevision,
        dtype: benchmarkDtype,
        pooling: benchmarkPooling,
        queryPrefix: benchmarkQueryPrefix,
        passagePrefix: benchmarkPassagePrefix,
        dimensions,
        estimatedDownloadBytes: Number.isFinite(benchmarkDownloadBytes)
          ? benchmarkDownloadBytes
          : null,
        modelLoadMs: Math.round(modelLoadMs),
        firstInferenceMs: Math.round(firstInferenceMs),
        repeatInferenceMs: Math.round(
          repeatSamples.reduce((sum, value) => sum + value, 0) / repeatSamples.length,
        ),
        batchInferenceMs: Math.round(batchInferenceMs),
        queryCount: uniqueMessages.length,
        meanBatchQueryMs: Number((batchInferenceMs / uniqueMessages.length).toFixed(3)),
        rssBeforeBytes: rssBefore,
        rssAfterBytes: rssAfter,
        observedRssDeltaBytes: rssAfter - rssBefore,
        environment: 'Node CPU benchmark; browser and mobile timings require separate acceptance testing',
      },
    }
  } finally {
    await extractor.dispose()
  }
}

const buildCurrentSemantic = async () => {
  if (isBenchmarkModel) return buildBenchmarkSemantic()
  if (!enhancedCurrent) return {
    interpreter: null,
    performance: { mode: 'instant', modelLoadMs: 0, firstInferenceMs: 0, repeatInferenceMs: 0 },
  }
  const manifest = embeddingManifestSchema.parse(
    readJsonFile(resolve(profilePath, 'embeddings', 'manifest.json')),
  )
  const index = readJsonFile(
    resolve(profilePath, 'embeddings', manifest.files.index),
  ) as EmbeddingIndex
  const prototypeFile = readFileSync(resolve(profilePath, 'embeddings', manifest.files.prototypes))
  const prototypeVectors = new Float32Array(
    prototypeFile.buffer,
    prototypeFile.byteOffset,
    prototypeFile.byteLength / Float32Array.BYTES_PER_ELEMENT,
  )
  const trackFileBuffer = readFileSync(resolve(profilePath, 'embeddings', manifest.files.tracks))
  const trackVectors = new Float32Array(
    trackFileBuffer.buffer,
    trackFileBuffer.byteOffset,
    trackFileBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  )

  const search = (query: Float32Array): SemanticInterpretationResult => {
    const started = performance.now()
    const trackScores = Object.fromEntries(index.tracks.map((entry) => [
      entry.id,
      dot(trackVectors, entry.offset, index.dimensions, query),
    ]))
    const collapsed = new Map<string, SemanticPrototypeMatch>()
    for (const entry of index.prototypes) {
      const score = dot(prototypeVectors, entry.offset, index.dimensions, query)
      const id = entry.id.split(':')[0] ?? entry.id
      const previous = collapsed.get(id)
      if (!previous || score > previous.score) {
        collapsed.set(id, { id, kind: entry.kind, score, payload: entry.payload })
      }
    }
    return {
      trackScores,
      prototypeMatches: [...collapsed.values()]
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
        .slice(0, 10),
      durationMs: performance.now() - started,
    }
  }

  env.cacheDir = resolve(projectRoot, '.cache', 'transformers')
  const loadStarted = performance.now()
  const extractor = (await pipeline('feature-extraction', manifest.modelId, {
    revision: manifest.modelRevision,
    dtype: manifest.dtype,
    device: 'cpu',
  })) as unknown as FeatureExtractor
  const modelLoadMs = performance.now() - loadStarted
  const timedQuery = async () => {
    const started = performance.now()
    await extractor('query: holdout timing probe', { pooling: 'mean', normalize: true })
    return performance.now() - started
  }
  const firstInferenceMs = await timedQuery()
  const repeatInferenceMs = await timedQuery()
  const values = new Map<string, SemanticInterpretationResult>()
  const batchStarted = performance.now()
  const batchSize = 24
  for (let offset = 0; offset < uniqueMessages.length; offset += batchSize) {
    const batch = uniqueMessages.slice(offset, offset + batchSize)
    const output = await extractor(
      batch.map((message) => `query: ${message}`),
      { pooling: 'mean', normalize: true },
    )
    const dimensions = output.dims.at(-1) ?? manifest.dimensions
    if (dimensions !== manifest.dimensions || output.data.length !== batch.length * dimensions) {
      throw new Error(`Unexpected holdout embedding shape: ${output.dims.join(' × ')}`)
    }
    batch.forEach((message, row) => {
      values.set(
        message,
        search(output.data.slice(row * dimensions, (row + 1) * dimensions)),
      )
    })
    process.stdout.write(
      `\rHoldout embeddings: ${Math.min(offset + batch.length, uniqueMessages.length)}/${uniqueMessages.length}`,
    )
  }
  process.stdout.write('\n')
  const batchInferenceMs = performance.now() - batchStarted
  await extractor.dispose()
  return {
    interpreter: new HiddenSemanticInterpreter(values),
    performance: {
      mode: 'enhanced-current',
      modelId: manifest.modelId,
      revision: manifest.modelRevision,
      dtype: manifest.dtype,
      modelLoadMs: Math.round(modelLoadMs),
      firstInferenceMs: Math.round(firstInferenceMs),
      repeatInferenceMs: Math.round(repeatInferenceMs),
      batchInferenceMs: Math.round(batchInferenceMs),
      queryCount: uniqueMessages.length,
      meanBatchQueryMs: Number((batchInferenceMs / uniqueMessages.length).toFixed(3)),
      environment: 'Node CPU; not a browser or mobile timing claim',
    },
  }
}

const emptyContext = (): ConversationContext => ({
  messages: [],
  lastInterpretations: [],
  lastRecommendations: [],
  currentTarget: null,
  rejectedTrackIds: [],
  activeArtistPolicy: gift.artistPolicy,
  pendingClarification: null,
  previousRecommendedTrack: null,
  mostRecentRefinement: null,
})

const isClarification = (kind: AssistantInterpretation['kind']) =>
  kind === 'clarification' || kind === 'conflict'

const interpretedMoods = (interpretation: AssistantInterpretation) => new Set(
  interpretation.evidence
    .filter((item) => item.concept === 'mood')
    .map((item) => item.value),
)

const scoreInterpretation = (
  expected: HiddenExpected,
  interpretation: AssistantInterpretation,
  context: ConversationContext,
): EvaluationScore => {
  const request = interpretation.request
  const moods = interpretedMoods(interpretation)
  const expectedMoods = expected.moods ?? []
  const checks: Record<string, boolean> = {}
  const kindCorrect = expected.kind === 'clarification'
    ? isClarification(interpretation.kind)
    : interpretation.kind === expected.kind
  checks.kind = kindCorrect
  if (expectedMoods.length) {
    checks.moods = expectedMoods.every((mood) =>
      moods.has(mood) || (
        interpretation.target?.[mood as MoodDimension] !== undefined &&
        (interpretation.target[mood as MoodDimension] ?? 0) >= 72
      ),
    )
  }
  if (expected.excludedMoods?.length) {
    checks.negation = expected.excludedMoods.every((mood) => request?.excludedMoods.includes(mood))
  }
  if (expected.activity) checks.activity = request?.activities?.includes(expected.activity) ?? false
  if (expected.context) checks.context = request?.contexts?.includes(expected.context) ?? false
  if (expected.familiarity) checks.familiarity = request?.familiarity === expected.familiarity
  if (expected.relation) checks.relation = request?.relationToPrevious === expected.relation
  if (expected.era) {
    checks.era = interpretation.evidence.some(
      (item) => item.concept === 'era' && item.value === expected.era,
    )
  }
  if (expected.versionTypes?.length) {
    checks.versionTypes = expected.versionTypes.every((version) =>
      request?.versionTypes?.includes(version as never),
    )
  }
  if (expected.requestedTrackId) {
    checks.requestedTrack = request?.requestedTrackId === expected.requestedTrackId
  }
  if (expected.surprise !== undefined) checks.surprise = request?.surprise === expected.surprise
  if (expected.reset !== undefined) checks.reset = Boolean(interpretation.resetContext) === expected.reset
  if (expected.excludePreviousTrack) {
    checks.excludePreviousTrack = Boolean(
      context.previousRecommendedTrack &&
      request?.exclusions.trackIds.includes(context.previousRecommendedTrack.id),
    )
  }
  if (expected.excludePreviousAlbum) {
    checks.excludePreviousAlbum = Boolean(
      context.previousRecommendedTrack?.albumId &&
      request?.exclusions.albumIds.includes(context.previousRecommendedTrack.albumId),
    )
  }

  const actualMoodSet = new Set([...moods].filter((mood) =>
    ['peaceful', 'happy', 'romantic', 'confident', 'energised', 'nostalgic', 'elegant', 'comforted', 'dramatic'].includes(mood),
  ))
  const moodMatched = expectedMoods.filter((mood) =>
    actualMoodSet.has(mood) || (
      interpretation.target?.[mood as MoodDimension] !== undefined &&
      (interpretation.target[mood as MoodDimension] ?? 0) >= 72
    ),
  ).length
  const moodExtra = [...actualMoodSet].filter((mood) => !expectedMoods.includes(mood)).length
  const clarificationRelevant = expected.kind === 'clarification'
  const unsupportedRelevant = expected.kind === 'unsupported'
  const followUpRelevant = Boolean(
    expected.relation || expected.excludePreviousTrack || expected.excludePreviousAlbum || expected.reset,
  )
  return {
    passed: Object.values(checks).every(Boolean),
    kindCorrect,
    moodExpected: expectedMoods.length,
    moodMatched,
    moodExtra,
    negationRelevant: Boolean(expected.excludedMoods?.length),
    negationCorrect: !expected.excludedMoods?.length || Boolean(checks.negation),
    entityRelevant: Boolean(expected.requestedTrackId),
    entityCorrect: !expected.requestedTrackId || Boolean(checks.requestedTrack),
    clarificationRelevant,
    clarificationCorrect: !clarificationRelevant || isClarification(interpretation.kind),
    unsupportedRelevant,
    unsupportedCorrect: !unsupportedRelevant || interpretation.kind === 'unsupported',
    followUpRelevant,
    followUpCorrect: !followUpRelevant || Object.entries(checks)
      .filter(([key]) => ['relation', 'excludePreviousTrack', 'excludePreviousAlbum', 'reset'].includes(key))
      .every(([, value]) => value),
    checks,
  }
}

const aggregate = (): Aggregate => ({
  total: 0,
  passed: 0,
  kindCorrect: 0,
  moodExpected: 0,
  moodMatched: 0,
  moodExtra: 0,
})

const addAggregate = (target: Aggregate, score: EvaluationScore) => {
  target.total += 1
  if (score.passed) target.passed += 1
  if (score.kindCorrect) target.kindCorrect += 1
  target.moodExpected += score.moodExpected
  target.moodMatched += score.moodMatched
  target.moodExtra += score.moodExtra
}

const ratio = (value: number, total: number) => total ? value / total : 1
const summariseAggregate = (value: Aggregate) => {
  const moodPrecision = ratio(value.moodMatched, value.moodMatched + value.moodExtra)
  const moodRecall = ratio(value.moodMatched, value.moodExpected)
  return {
    total: value.total,
    directAccuracy: ratio(value.passed, value.total),
    kindAccuracy: ratio(value.kindCorrect, value.total),
    moodPrecision,
    moodRecall,
    moodF1: moodPrecision + moodRecall
      ? 2 * moodPrecision * moodRecall / (moodPrecision + moodRecall)
      : 0,
  }
}

const classifyFailure = (
  item: HiddenUtterance | { category: string },
  expected: HiddenExpected,
  score: EvaluationScore,
) => {
  if (expected.kind === 'unsupported') return 'unsupported request'
  if (expected.kind === 'clarification') return score.clarificationCorrect
    ? 'ambiguity correctly requiring clarification'
    : 'incorrect clarification'
  if (expected.requestedTrackId) return 'entity failure'
  if (expected.excludedMoods?.length && !score.negationCorrect) return 'negation failure'
  if (score.followUpRelevant && !score.followUpCorrect) return 'context failure'
  if (item.category.includes('figurative')) return 'semantic misunderstanding'
  if (item.category.includes('noisy')) return 'missing vocabulary'
  return score.kindCorrect ? 'missing vocabulary' : 'semantic misunderstanding'
}

const semanticBuild = await buildCurrentSemantic()
const provider: MusicAssistantProvider = enhancedCurrent
  ? new HybridWisseBotProvider(catalogue, semanticBuild.interpreter)
  : isBenchmarkModel
    ? new HybridWisseBotProvider(catalogue, semanticBuild.interpreter)
  : instantLite
    ? new HybridWisseBotProvider(
        catalogue,
        new SemanticLiteInterpreter(catalogue.tracks, catalogue.collections),
      )
    : new LocalWisseBotProvider(catalogue)
const listener = createDefaultListenerState(gift.defaultStreamingService)
const overall = aggregate()
const groups = new Map<string, Aggregate>()
const failures: Array<Record<string, unknown>> = []
let negationTotal = 0
let negationCorrect = 0
let entityTotal = 0
let entityCorrect = 0
let clarificationTotal = 0
let clarificationCorrect = 0
let unsupportedTotal = 0
let unsupportedCorrect = 0
let followUpTotal = 0
let followUpCorrect = 0
let hallucinatedCatalogueTracks = 0
let unsupportedFactualClaims = 0
let lyricOutputCount = 0
let recommendationChecks = 0

const evaluateOne = async (
  id: string,
  category: string,
  utterance: string,
  expected: HiddenExpected,
  context: ConversationContext,
  group: string,
) => {
  const interpretation = await provider.interpret(utterance, context)
  const score = scoreInterpretation(expected, interpretation, context)
  addAggregate(overall, score)
  const groupAggregate = groups.get(group) ?? aggregate()
  addAggregate(groupAggregate, score)
  groups.set(group, groupAggregate)
  if (score.negationRelevant) {
    negationTotal += 1
    if (score.negationCorrect) negationCorrect += 1
  }
  if (score.entityRelevant) {
    entityTotal += 1
    if (score.entityCorrect) entityCorrect += 1
  }
  if (score.clarificationRelevant) {
    clarificationTotal += 1
    if (score.clarificationCorrect) clarificationCorrect += 1
  }
  if (score.unsupportedRelevant) {
    unsupportedTotal += 1
    if (score.unsupportedCorrect) unsupportedCorrect += 1
  }
  if (score.followUpRelevant) {
    followUpTotal += 1
    if (score.followUpCorrect) followUpCorrect += 1
  }
  if (interpretation.request?.requestedTrackId && !trackIds.has(interpretation.request.requestedTrackId)) {
    hallucinatedCatalogueTracks += 1
  }

  let selectedTrack = null
  if (interpretation.kind === 'recommendation' && interpretation.target) {
    try {
      const recommendation = recommendTrack({
        tracks: catalogue.tracks,
        target: interpretation.target,
        stationName: 'Hidden evaluation',
        frequency: 'H.3',
        listener,
        context: {
          ...interpretation.constraints,
          sessionTrackIds: context.lastRecommendations,
          artistPolicy: catalogue.artistPolicy,
        },
      })
      recommendationChecks += 1
      selectedTrack = recommendation.track
      if (!trackIds.has(recommendation.track.id)) hallucinatedCatalogueTracks += 1
      const response = buildGroundedRecommendationResponse(interpretation, recommendation)
      if (/\b(lyrics?|lirik)\b/i.test(response)) lyricOutputCount += 1
    } catch {
      hallucinatedCatalogueTracks += 1
    }
  }
  if (
    interpretation.kind === 'unsupported' &&
    /\b(?:born|married|divorced|private address|phone number|released in)\b/i.test(interpretation.summary)
  ) {
    unsupportedFactualClaims += 1
  }
  if (!score.passed) {
    failures.push({
      id,
      category,
      utterance,
      expected,
      actual: {
        kind: interpretation.kind,
        summary: interpretation.summary,
        request: interpretation.request,
      },
      checks: score.checks,
      classification: classifyFailure({ category }, expected, score),
    })
  }
  return { interpretation, selectedTrack }
}

for (const item of dataset.utterances) {
  await evaluateOne(
    item.id,
    item.category,
    item.utterance,
    item.expected,
    emptyContext(),
    item.language,
  )
}

for (const conversation of dataset.conversations) {
  let context = emptyContext()
  for (let index = 0; index < conversation.turns.length; index += 1) {
    const turn = conversation.turns[index]
    if (!turn) continue
    const result = await evaluateOne(
      `${conversation.id}:${index + 1}`,
      'conversation',
      turn.utterance,
      turn.expected,
      context,
      conversation.manualAcceptance ? 'manual-conversations' : 'additional-conversations',
    )
    if (result.interpretation.resetContext) {
      context = emptyContext()
    }
    if (result.interpretation.request) {
      context.currentTarget = result.interpretation.request
      context.lastInterpretations = [
        ...context.lastInterpretations,
        result.interpretation.request,
      ].slice(-6)
      context.rejectedTrackIds = result.interpretation.request.exclusions.trackIds.slice(-20)
    }
    if (result.selectedTrack) {
      context.previousRecommendedTrack = result.selectedTrack
      context.lastRecommendations = [
        ...context.lastRecommendations,
        result.selectedTrack.id,
      ].slice(-12)
    }
    context.messages = [
      ...context.messages,
      { role: 'listener' as const, text: turn.utterance },
      { role: 'assistant' as const, text: result.interpretation.summary },
    ].slice(-6)
    context.pendingClarification = result.interpretation.clarification
    context.mostRecentRefinement = result.interpretation.refinement
  }
}

const failureClassification = Object.fromEntries(
  [...new Set(failures.map((item) => String(item.classification)))].sort().map((classification) => [
    classification,
    failures.filter((item) => item.classification === classification).length,
  ]),
)

const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  phase: 'phase-3-hidden-holdout',
  profile: slug,
  mode: isBenchmarkModel
    ? `benchmark-${benchmarkLabel}`
    : enhancedCurrent
      ? 'enhanced-current'
      : instantLite
        ? 'instant-semantic-lite'
        : 'instant',
  dataset: {
    path: 'evaluation/hidden/holdout.json',
    contentHash: dataset.contentHash,
    counts: dataset.counts,
    utterances: dataset.utterances.length,
    conversationTurns: dataset.conversations.reduce((sum, item) => sum + item.turns.length, 0),
  },
  overall: summariseAggregate(overall),
  groups: Object.fromEntries(
    [...groups.entries()].map(([group, value]) => [group, summariseAggregate(value)]),
  ),
  metrics: {
    negationAccuracy: ratio(negationCorrect, negationTotal),
    entityAccuracy: ratio(entityCorrect, entityTotal),
    clarificationAppropriateness: ratio(clarificationCorrect, clarificationTotal),
    unsupportedDetection: ratio(unsupportedCorrect, unsupportedTotal),
    contextFollowUpAccuracy: ratio(followUpCorrect, followUpTotal),
  },
  grounding: {
    recommendationChecks,
    hallucinatedCatalogueTracks,
    unsupportedFactualClaims,
    lyricOutputCount,
  },
  performance: semanticBuild.performance,
  failureCount: failures.length,
  failureClassification,
  failures,
}

writeJsonFile(outputPath, report)
console.log(`Hidden evaluation (${report.mode})`)
console.log(`Dataset hash: ${dataset.contentHash}`)
console.log(`Direct accuracy: ${(report.overall.directAccuracy * 100).toFixed(1)}%`)
console.log(`Mood F1: ${(report.overall.moodF1 * 100).toFixed(1)}%`)
console.log(`Negation: ${(report.metrics.negationAccuracy * 100).toFixed(1)}%`)
console.log(`Entities: ${(report.metrics.entityAccuracy * 100).toFixed(1)}%`)
console.log(`Clarification: ${(report.metrics.clarificationAppropriateness * 100).toFixed(1)}%`)
console.log(`Unsupported: ${(report.metrics.unsupportedDetection * 100).toFixed(1)}%`)
console.log(`Context: ${(report.metrics.contextFollowUpAccuracy * 100).toFixed(1)}%`)
console.log(`Hallucinated tracks: ${hallucinatedCatalogueTracks}`)
console.log(`Unsupported factual claims: ${unsupportedFactualClaims}`)
console.log(`Lyrics emitted: ${lyricOutputCount}`)
console.log(`Failures: ${failures.length}`)
console.log(`Report: ${outputPath}`)
