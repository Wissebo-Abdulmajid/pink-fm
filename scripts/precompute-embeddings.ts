import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { env, pipeline } from '@huggingface/transformers'
import { embeddingManifestSchema, giftSchema, type Track } from '../src/config/schemas.ts'
import { flattenedSemanticPrototypes } from '../src/features/bot/semantic/prototypes.ts'
import type {
  EmbeddingIndex,
  PrototypeIndexEntry,
} from '../src/features/bot/semantic/semanticTypes.ts'
import {
  argumentValue,
  catalogueContentHash,
  hasArgument,
  loadCatalog,
  projectRoot,
  readJsonFile,
  writeJsonFile,
} from './catalog-shared.ts'

type FeatureExtractor = {
  (
    texts: string[],
    options: { pooling: 'mean'; normalize: true },
  ): Promise<{ data: Float32Array; dims: number[] }>
  dispose: () => Promise<void>
}

const slug = argumentValue('--slug') ?? 'siti'
const batchSize = Number(argumentValue('--batch-size') ?? 12)
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 64) {
  throw new Error('--batch-size must be an integer from 1 to 64.')
}

const catalogue = loadCatalog(slug)
const gift = giftSchema.parse(readJsonFile(resolve(catalogue.profilePath, 'gift.json')))
if (!gift.assistant.semantic.enabled && !hasArgument('--force')) {
  throw new Error('Semantic understanding is disabled for this profile. Pass --force to generate anyway.')
}

env.cacheDir = resolve(projectRoot, '.cache', 'transformers')
env.allowRemoteModels = true

const activeTracks = catalogue.tracks.tracks
  .filter((track) => track.active)
  .sort((left, right) => left.id.localeCompare(right.id))

const semanticTrackText = (track: Track) =>
  [
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
  ]
    .filter(Boolean)
    .join(' ')

const prototypeEntries: PrototypeIndexEntry[] = [
  ...flattenedSemanticPrototypes().map((prototype) => ({
    ...prototype,
    offset: 0,
  })),
  ...catalogue.collections.collections
    .filter((collection) => collection.active)
    .map((collection) => ({
      id: `collection-${collection.id}`,
      kind: 'collection' as const,
      text: collection.semanticDescription,
      payload: { collectionId: collection.id },
      offset: 0,
    })),
]

const progress = (event: unknown) => {
  if (!event || typeof event !== 'object') return
  const value = event as Record<string, unknown>
  if (value.status === 'progress' && typeof value.progress === 'number') {
    process.stdout.write(`\rDownloading semantic model: ${Math.round(value.progress)}%`)
  }
}

console.log(`Loading ${gift.assistant.semantic.modelId} @ ${gift.assistant.semantic.modelRevision} (q8)…`)
const loadStarted = performance.now()
const extractor = (await pipeline(
  'feature-extraction',
  gift.assistant.semantic.modelId,
  {
    revision: gift.assistant.semantic.modelRevision,
    dtype: 'q8',
    device: 'cpu',
    progress_callback: progress,
  },
)) as unknown as FeatureExtractor
const modelLoadMs = performance.now() - loadStarted
process.stdout.write('\n')

const encode = async (texts: string[], label: string) => {
  const rows: number[][] = []
  let dimensions = 0
  const started = performance.now()
  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize).map((text) => `passage: ${text}`)
    const output = await extractor(batch, { pooling: 'mean', normalize: true })
    const batchCount = output.dims[0] ?? batch.length
    dimensions = output.dims.at(-1) ?? dimensions
    if (!dimensions || output.data.length !== batchCount * dimensions) {
      throw new Error(`Unexpected embedding tensor for ${label}: ${output.dims.join(' × ')}`)
    }
    for (let row = 0; row < batchCount; row += 1) {
      rows.push(Array.from(output.data.slice(row * dimensions, (row + 1) * dimensions)))
    }
    process.stdout.write(`\rEmbedding ${label}: ${Math.min(index + batch.length, texts.length)}/${texts.length}`)
  }
  process.stdout.write('\n')
  return { rows, dimensions, durationMs: performance.now() - started }
}

try {
  const trackResult = await encode(activeTracks.map(semanticTrackText), 'tracks')
  const prototypeResult = await encode(prototypeEntries.map((entry) => entry.text), 'prototypes')
  if (trackResult.dimensions !== prototypeResult.dimensions) {
    throw new Error('Track and prototype embedding dimensions do not match.')
  }
  const dimensions = trackResult.dimensions
  const flatten = (rows: number[][]) => Float32Array.from(rows.flat())
  const trackVectors = flatten(trackResult.rows)
  const prototypeVectors = flatten(prototypeResult.rows)
  const outputDirectory = resolve(catalogue.profilePath, 'embeddings')
  mkdirSync(outputDirectory, { recursive: true })
  const tracksFile = 'tracks.bin'
  const prototypesFile = 'prototypes.bin'
  const indexFile = 'index.json'
  const trackBuffer = Buffer.from(
    trackVectors.buffer,
    trackVectors.byteOffset,
    trackVectors.byteLength,
  )
  const prototypeBuffer = Buffer.from(
    prototypeVectors.buffer,
    prototypeVectors.byteOffset,
    prototypeVectors.byteLength,
  )
  writeFileSync(resolve(outputDirectory, tracksFile), trackBuffer)
  writeFileSync(resolve(outputDirectory, prototypesFile), prototypeBuffer)

  const index: EmbeddingIndex = {
    schemaVersion: 1,
    dimensions,
    tracks: activeTracks.map((track, offset) => ({ id: track.id, offset })),
    prototypes: prototypeEntries.map((entry, offset) => ({ ...entry, offset })),
  }
  writeJsonFile(resolve(outputDirectory, indexFile), index)

  const manifest = embeddingManifestSchema.parse({
    schemaVersion: 1,
    modelId: gift.assistant.semantic.modelId,
    modelRevision: gift.assistant.semantic.modelRevision,
    dtype: 'q8',
    dimensions,
    pooling: 'mean',
    normalisation: 'l2',
    catalogueContentHash: catalogueContentHash(
      catalogue.tracks.tracks,
      catalogue.collections.collections,
    ),
    createdAt: new Date().toISOString(),
    trackCount: activeTracks.length,
    prototypeCount: prototypeEntries.length,
    estimatedModelDownloadBytes: Math.round(gift.assistant.semantic.estimatedDownloadMb * 1024 * 1024),
    vectorEncoding: 'float32-le',
    trackEmbeddingBytes: trackBuffer.byteLength,
    prototypeEmbeddingBytes: prototypeBuffer.byteLength,
    files: {
      tracks: tracksFile,
      prototypes: prototypesFile,
      index: indexFile,
    },
  })
  writeJsonFile(resolve(outputDirectory, 'manifest.json'), manifest)
  writeJsonFile(resolve(outputDirectory, 'benchmark.json'), {
    schemaVersion: 1,
    environment: 'build-machine-node-cpu',
    modelLoadMs: Math.round(modelLoadMs),
    trackEmbeddingMs: Math.round(trackResult.durationMs),
    prototypeEmbeddingMs: Math.round(prototypeResult.durationMs),
    trackCount: activeTracks.length,
    prototypeCount: prototypeEntries.length,
    batchSize,
    dimensions,
    measuredAt: new Date().toISOString(),
    note: 'Build-time CPU measurements are not browser performance claims.',
  })
  console.log(`Embeddings written: ${outputDirectory}`)
  console.log(`Dimensions: ${dimensions}`)
  console.log(`Tracks: ${activeTracks.length} (${trackBuffer.byteLength.toLocaleString()} bytes)`)
  console.log(`Prototypes: ${prototypeEntries.length} (${prototypeBuffer.byteLength.toLocaleString()} bytes)`)
  console.log(`Model initialisation: ${Math.round(modelLoadMs).toLocaleString()} ms`)
} finally {
  await extractor.dispose()
}
