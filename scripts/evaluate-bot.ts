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
} from '../src/config/schemas.ts'
import {
  scoreInterpretation,
  type EvaluationScore,
  type EvaluationSequence,
  type EvaluationUtterance,
} from '../src/features/bot/evaluation/evaluateBot.ts'
import { HybridWisseBotProvider } from '../src/features/bot/hybrid-provider.ts'
import { buildGroundedRecommendationResponse } from '../src/features/bot/responseBuilder.ts'
import type {
  ConversationContext,
  SemanticInterpreter,
} from '../src/features/bot/types.ts'
import type {
  EmbeddingIndex,
  SemanticInterpretationResult,
  SemanticPrototypeMatch,
} from '../src/features/bot/semantic/semanticTypes.ts'
import { recommendTrack } from '../src/features/recommendations/engine.ts'
import { createDefaultListenerState } from '../src/lib/storage.ts'
import {
  argumentValue,
  hasArgument,
  profilePathFor,
  projectRoot,
  readJsonFile,
  writeJsonFile,
} from './catalog-shared.ts'

type FeatureExtractor = {
  (
    text: string | string[],
    options: { pooling: 'mean'; normalize: true },
  ): Promise<{ data: Float32Array; dims: number[] }>
  dispose: () => Promise<void>
}

type LanguageFile = {
  schemaVersion: 1
  language: 'en' | 'ms' | 'mixed'
  utterances: EvaluationUtterance[]
}

type AdversarialFile = {
  schemaVersion: 1
  utterances: EvaluationUtterance[]
  sequences: EvaluationSequence[]
}

type Aggregate = {
  total: number
  intentCorrect: number
  kindCorrect: number
  moodTruePositive: number
  moodFalsePositive: number
  moodFalseNegative: number
  moodExamples: number
}

const slug = argumentValue('--slug') ?? 'siti'
const lightweight = hasArgument('--lightweight')
const batchSize = Number(argumentValue('--batch-size') ?? 32)
const profilePath = profilePathFor(slug)
const evaluationPath = resolve(projectRoot, 'src', 'features', 'bot', 'evaluation')
const loadEvaluation = <T>(file: string) =>
  JSON.parse(readFileSync(resolve(evaluationPath, file), 'utf8')) as T

const languageFiles = [
  loadEvaluation<LanguageFile>('utterances.en.json'),
  loadEvaluation<LanguageFile>('utterances.ms.json'),
  loadEvaluation<LanguageFile>('utterances.mixed.json'),
]
const adversarial = loadEvaluation<AdversarialFile>('adversarial.json')
const gift = giftSchema.parse(readJsonFile(resolve(profilePath, 'gift.json')))
const tracks = tracksFileSchema.parse(readJsonFile(resolve(profilePath, 'tracks.json')))
const moods = moodsFileSchema.parse(readJsonFile(resolve(profilePath, 'moods.json')))
const collections = collectionsFileSchema.parse(readJsonFile(resolve(profilePath, 'collections.json')))
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

// Node buffers can have a non-zero byte offset. Rebuild the track view over the exact bytes.
const exactTrackFile = readFileSync(resolve(profilePath, 'embeddings', manifest.files.tracks))
const exactTrackVectors = new Float32Array(
  exactTrackFile.buffer,
  exactTrackFile.byteOffset,
  exactTrackFile.byteLength / Float32Array.BYTES_PER_ELEMENT,
)

const catalogue = {
  tracks: tracks.tracks,
  collections: collections.collections,
  moods: moods.moods,
  artistPolicy: gift.artistPolicy,
  primaryArtistName: gift.artist.name,
  primaryArtistId: gift.artist.slug,
}
const trackIds = new Set(tracks.tracks.map((track) => track.id))

const allUtterances = [
  ...languageFiles.flatMap((file) => file.utterances.map((item) => item.utterance)),
  ...adversarial.utterances.map((item) => item.utterance),
  ...adversarial.sequences.flatMap((sequence) =>
    sequence.turns.map((turn) => turn.utterance),
  ),
]
const uniqueUtterances = [...new Set(allUtterances)]

const dot = (vectors: Float32Array, offset: number, dimensions: number, query: Float32Array) => {
  let score = 0
  const start = offset * dimensions
  for (let indexValue = 0; indexValue < dimensions; indexValue += 1) {
    score += (vectors[start + indexValue] ?? 0) * (query[indexValue] ?? 0)
  }
  return Math.max(0, Math.min(1, score))
}

const search = (query: Float32Array): SemanticInterpretationResult => {
  const started = performance.now()
  const trackScores = Object.fromEntries(
    index.tracks.map((entry) => [
      entry.id,
      dot(exactTrackVectors, entry.offset, index.dimensions, query),
    ]),
  )
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

class EvaluationSemanticInterpreter implements SemanticInterpreter {
  constructor(private readonly values: Map<string, SemanticInterpretationResult>) {}
  async interpret(message: string) {
    const value = this.values.get(message)
    if (!value) throw new Error(`Missing precomputed evaluation query: ${message}`)
    return value
  }
}

const buildSemanticInterpreter = async () => {
  if (lightweight) {
    return {
      interpreter: null,
      performanceReport: {
        mode: 'lightweight',
        modelLoadMs: 0,
        firstInferenceMs: 0,
        repeatInferenceMs: 0,
        batchInferenceMs: 0,
      },
    }
  }
  env.cacheDir = resolve(projectRoot, '.cache', 'transformers')
  const modelStarted = performance.now()
  const extractor = (await pipeline('feature-extraction', manifest.modelId, {
    revision: manifest.modelRevision,
    dtype: manifest.dtype,
    device: 'cpu',
  })) as unknown as FeatureExtractor
  const modelLoadMs = performance.now() - modelStarted
  const timedQuery = async () => {
    const started = performance.now()
    await extractor('query: romantic but cheerful', { pooling: 'mean', normalize: true })
    return performance.now() - started
  }
  const firstInferenceMs = await timedQuery()
  const repeatInferenceMs = await timedQuery()
  const values = new Map<string, SemanticInterpretationResult>()
  const batchStarted = performance.now()
  for (let offset = 0; offset < uniqueUtterances.length; offset += batchSize) {
    const batch = uniqueUtterances.slice(offset, offset + batchSize)
    const output = await extractor(
      batch.map((message) => `query: ${message}`),
      { pooling: 'mean', normalize: true },
    )
    const dimensions = output.dims.at(-1) ?? manifest.dimensions
    if (dimensions !== manifest.dimensions || output.data.length !== batch.length * dimensions) {
      throw new Error(`Unexpected evaluation embedding shape: ${output.dims.join(' × ')}`)
    }
    batch.forEach((message, row) => {
      const query = output.data.slice(row * dimensions, (row + 1) * dimensions)
      values.set(message, search(query))
    })
    process.stdout.write(
      `\rEmbedding evaluation requests: ${Math.min(offset + batch.length, uniqueUtterances.length)}/${uniqueUtterances.length}`,
    )
  }
  process.stdout.write('\n')
  const batchInferenceMs = performance.now() - batchStarted
  await extractor.dispose()
  return {
    interpreter: new EvaluationSemanticInterpreter(values),
    performanceReport: {
      mode: 'enhanced',
      modelLoadMs: Math.round(modelLoadMs),
      firstInferenceMs: Math.round(firstInferenceMs),
      repeatInferenceMs: Math.round(repeatInferenceMs),
      batchInferenceMs: Math.round(batchInferenceMs),
      queryCount: uniqueUtterances.length,
      meanBatchQueryMs: Number((batchInferenceMs / uniqueUtterances.length).toFixed(3)),
      environment: 'Node CPU on the build machine; not a browser claim',
    },
  }
}

const semanticBuild = await buildSemanticInterpreter()
const provider = new HybridWisseBotProvider(catalogue, semanticBuild.interpreter)

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

const aggregate = (): Aggregate => ({
  total: 0,
  intentCorrect: 0,
  kindCorrect: 0,
  moodTruePositive: 0,
  moodFalsePositive: 0,
  moodFalseNegative: 0,
  moodExamples: 0,
})

const addScore = (target: Aggregate, score: EvaluationScore) => {
  target.total += 1
  if (score.intentCorrect) target.intentCorrect += 1
  if (score.kindCorrect) target.kindCorrect += 1
  if (score.expectedMoods.length > 0) {
    target.moodExamples += 1
    const expected = new Set(score.expectedMoods)
    const actual = new Set(score.interpretedMoods)
    target.moodTruePositive += [...expected].filter((mood) => actual.has(mood)).length
    target.moodFalseNegative += [...expected].filter((mood) => !actual.has(mood)).length
    target.moodFalsePositive += [...actual].filter((mood) => !expected.has(mood)).length
  }
}

const ratio = (correct: number, total: number) => total ? correct / total : 1
const summarise = (value: Aggregate) => {
  const precision = ratio(
    value.moodTruePositive,
    value.moodTruePositive + value.moodFalsePositive,
  )
  const recall = ratio(
    value.moodTruePositive,
    value.moodTruePositive + value.moodFalseNegative,
  )
  return {
    total: value.total,
    intentAccuracy: ratio(value.intentCorrect, value.total),
    kindAccuracy: ratio(value.kindCorrect, value.total),
    moodPrecision: precision,
    moodRecall: recall,
    moodF1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
  }
}

let groundingChecks = 0
let explanationChecks = 0
let hallucinatedCatalogueTracks = 0
let unsupportedFactualClaims = 0
let lyricOutputCount = 0
let negationTotal = 0
let negationCorrect = 0
let entityTotal = 0
let entityCorrect = 0
let clarificationTotal = 0
let clarificationCorrect = 0
let unsupportedTotal = 0
let unsupportedCorrect = 0
const failures: Array<{ id: string; utterance: string; expected: unknown; actual: unknown }> = []

const checkGrounding = (
  interpretation: Awaited<ReturnType<typeof provider.interpret>>,
  context: ConversationContext,
) => {
  if (interpretation.request?.requestedTrackId && !trackIds.has(interpretation.request.requestedTrackId)) {
    hallucinatedCatalogueTracks += 1
  }
  if (interpretation.kind !== 'recommendation' || !interpretation.target) return null
  try {
    const recommendation = recommendTrack({
      tracks: tracks.tracks,
      target: interpretation.target,
      stationName: 'Evaluation',
      frequency: 'EV.1',
      listener: createDefaultListenerState('spotify'),
      context: {
        ...interpretation.constraints,
        artistPolicy: gift.artistPolicy,
        sessionTrackIds: context.lastRecommendations,
      },
    })
    groundingChecks += 1
    if (!trackIds.has(recommendation.track.id)) hallucinatedCatalogueTracks += 1
    const validExplanation = recommendation.matchedMoods.every((mood) => {
      const key = mood as keyof typeof recommendation.track.moods
      return Math.abs((interpretation.target?.[key] ?? 0) - recommendation.track.moods[key]) <= 32
    })
    if (validExplanation) explanationChecks += 1
    const response = buildGroundedRecommendationResponse(interpretation, recommendation)
    if (/\b(lyrics?|lirik)\b/i.test(response)) lyricOutputCount += 1
    return recommendation.track
  } catch {
    hallucinatedCatalogueTracks += 1
    return null
  }
}

const processScore = (
  id: string,
  utterance: string,
  expected: EvaluationUtterance['expected'],
  interpretation: Awaited<ReturnType<typeof provider.interpret>>,
  target: Aggregate,
) => {
  const score = scoreInterpretation(utterance, expected, interpretation)
  addScore(target, score)
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
    if (
      interpretation.kind === 'unsupported' &&
      !interpretation.summary.startsWith('I’m designed to guide your music experience.')
    ) {
      unsupportedFactualClaims += 1
    }
  }
  if (!score.intentCorrect && failures.length < 80) {
    failures.push({
      id,
      utterance,
      expected,
      actual: {
        kind: interpretation.kind,
        request: interpretation.request,
        summary: interpretation.summary,
      },
    })
  }
  return score
}

const byLanguage: Record<string, Aggregate> = {}
for (const file of languageFiles) {
  const totals = aggregate()
  byLanguage[file.language] = totals
  for (const item of file.utterances) {
    const context = emptyContext()
    const interpretation = await provider.interpret(item.utterance, context)
    processScore(item.id, item.utterance, item.expected, interpretation, totals)
    checkGrounding(interpretation, context)
  }
}

const adversarialTotals = aggregate()
for (const item of adversarial.utterances) {
  const context = emptyContext()
  const interpretation = await provider.interpret(item.utterance, context)
  processScore(item.id, item.utterance, item.expected, interpretation, adversarialTotals)
  checkGrounding(interpretation, context)
}

const sequenceTotals = aggregate()
let contextFollowUpTotal = 0
let contextFollowUpCorrect = 0
for (const sequence of adversarial.sequences) {
  const context = emptyContext()
  for (let indexValue = 0; indexValue < sequence.turns.length; indexValue += 1) {
    const turn = sequence.turns[indexValue]
    if (!turn) continue
    const interpretation = await provider.interpret(turn.utterance, context)
    const score = processScore(
      `${sequence.id}:${indexValue + 1}`,
      turn.utterance,
      turn.expected,
      interpretation,
      sequenceTotals,
    )
    if (indexValue > 0) {
      contextFollowUpTotal += 1
      if (score.intentCorrect) contextFollowUpCorrect += 1
    }
    const selectedTrack = checkGrounding(interpretation, context)
    if (interpretation.request) {
      context.currentTarget = interpretation.request
      context.lastInterpretations = [...context.lastInterpretations, interpretation.request].slice(-6)
      context.rejectedTrackIds = interpretation.request.exclusions.trackIds.slice(-20)
    }
    if (selectedTrack) {
      context.previousRecommendedTrack = selectedTrack
      context.lastRecommendations = [...context.lastRecommendations, selectedTrack.id].slice(-12)
    }
    context.messages = [
      ...context.messages,
      { role: 'listener' as const, text: turn.utterance },
      { role: 'assistant' as const, text: interpretation.summary },
    ].slice(-6)
    context.pendingClarification = interpretation.clarification
    context.mostRecentRefinement = interpretation.refinement
  }
}

const allAggregates = [
  ...Object.values(byLanguage),
  adversarialTotals,
  sequenceTotals,
].reduce((combined, value) => ({
  total: combined.total + value.total,
  intentCorrect: combined.intentCorrect + value.intentCorrect,
  kindCorrect: combined.kindCorrect + value.kindCorrect,
  moodTruePositive: combined.moodTruePositive + value.moodTruePositive,
  moodFalsePositive: combined.moodFalsePositive + value.moodFalsePositive,
  moodFalseNegative: combined.moodFalseNegative + value.moodFalseNegative,
  moodExamples: combined.moodExamples + value.moodExamples,
}), aggregate())

const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  profile: slug,
  mode: lightweight ? 'lightweight' : 'hybrid-semantic',
  model: {
    id: manifest.modelId,
    revision: manifest.modelRevision,
    dtype: manifest.dtype,
    dimensions: manifest.dimensions,
    estimatedDownloadBytes: manifest.estimatedModelDownloadBytes,
  },
  corpus: {
    english: languageFiles[0]?.utterances.length ?? 0,
    malay: languageFiles[1]?.utterances.length ?? 0,
    mixed: languageFiles[2]?.utterances.length ?? 0,
    noisy: adversarial.utterances.filter((item) => item.category === 'noisy').length,
    unsupportedAdversarial: adversarial.utterances.filter((item) => item.category === 'unsupported').length,
    multiTurnSequences: adversarial.sequences.length,
    multiTurnTurns: adversarial.sequences.reduce((sum, sequence) => sum + sequence.turns.length, 0),
  },
  languages: Object.fromEntries(
    Object.entries(byLanguage).map(([language, value]) => [language, summarise(value)]),
  ),
  overall: summarise(allAggregates),
  negationAccuracy: ratio(negationCorrect, negationTotal),
  entityMatchAccuracy: ratio(entityCorrect, entityTotal),
  clarificationAccuracy: ratio(clarificationCorrect, clarificationTotal),
  unsupportedRequestDetection: ratio(unsupportedCorrect, unsupportedTotal),
  contextFollowUpAccuracy: ratio(contextFollowUpCorrect, contextFollowUpTotal),
  grounding: {
    recommendationChecks: groundingChecks,
    evidenceBackedExplanationChecks: explanationChecks,
    hallucinatedCatalogueTracks,
    unsupportedFactualClaims,
    lyricOutputCount,
  },
  performance: semanticBuild.performanceReport,
  failureCount: failures.length,
  failures,
}

const reportPath = resolve(projectRoot, 'docs', `bot-evaluation${lightweight ? '-lightweight' : ''}.json`)
writeJsonFile(reportPath, report)
console.log(`WisseBot evaluation (${report.mode})`)
console.log(`English intent accuracy: ${(report.languages.en?.intentAccuracy ?? 0).toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`)
console.log(`Malay intent accuracy: ${(report.languages.ms?.intentAccuracy ?? 0).toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`)
console.log(`Mixed intent accuracy: ${(report.languages.mixed?.intentAccuracy ?? 0).toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`)
console.log(`Mood F1: ${report.overall.moodF1.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`)
console.log(`Negation accuracy: ${report.negationAccuracy.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`)
console.log(`Context follow-up accuracy: ${report.contextFollowUpAccuracy.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`)
console.log(`Clarification accuracy: ${report.clarificationAccuracy.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`)
console.log(`Unsupported request detection: ${report.unsupportedRequestDetection.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}`)
console.log(`Hallucinated catalogue tracks: ${hallucinatedCatalogueTracks}`)
console.log(`Unsupported factual claims: ${unsupportedFactualClaims}`)
console.log(`Report: ${reportPath}`)

const minimumIntent = lightweight ? 0.76 : 0.82
if (
  report.overall.intentAccuracy < minimumIntent ||
  report.negationAccuracy < 0.9 ||
  report.unsupportedRequestDetection < 1 ||
  hallucinatedCatalogueTracks !== 0 ||
  unsupportedFactualClaims !== 0 ||
  lyricOutputCount !== 0
) {
  console.error('WisseBot evaluation did not meet its automated quality thresholds.')
  process.exitCode = 1
}
