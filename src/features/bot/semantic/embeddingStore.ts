import { embeddingManifestSchema, type EmbeddingManifest } from '../../../config/schemas'
import type {
  EmbeddingIndex,
  PrototypeIndexEntry,
  SemanticPrototypeMatch,
} from './semanticTypes'

const fetchRequired = async (url: string) => {
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Could not load semantic index file (${response.status}): ${url}`)
  return response
}

const parseIndex = (value: unknown): EmbeddingIndex => {
  if (!value || typeof value !== 'object') throw new Error('Embedding index is not an object.')
  const candidate = value as Partial<EmbeddingIndex>
  if (
    candidate.schemaVersion !== 1 ||
    !Number.isInteger(candidate.dimensions) ||
    !Array.isArray(candidate.tracks) ||
    !Array.isArray(candidate.prototypes)
  ) {
    throw new Error('Embedding index has an unsupported structure.')
  }
  const validEntry = (entry: unknown) => {
    if (!entry || typeof entry !== 'object') return false
    const item = entry as { id?: unknown; offset?: unknown }
    return typeof item.id === 'string' && Number.isInteger(item.offset) && Number(item.offset) >= 0
  }
  if (!candidate.tracks.every(validEntry) || !candidate.prototypes.every(validEntry)) {
    throw new Error('Embedding index contains an invalid offset.')
  }
  return candidate as EmbeddingIndex
}

const dot = (vectors: Float32Array, offset: number, dimensions: number, query: Float32Array) => {
  let score = 0
  const start = offset * dimensions
  for (let index = 0; index < dimensions; index += 1) {
    score += (vectors[start + index] ?? 0) * (query[index] ?? 0)
  }
  return score
}

export class EmbeddingStore {
  private constructor(
    readonly manifest: EmbeddingManifest,
    private readonly index: EmbeddingIndex,
    private readonly trackVectors: Float32Array,
    private readonly prototypeVectors: Float32Array,
  ) {}

  static async load(profileRootUrl: string, expectedCatalogueHash: string) {
    const root = `${profileRootUrl.replace(/\/?$/, '/')}embeddings/`
    const manifestResponse = await fetchRequired(`${root}manifest.json`)
    const manifest = embeddingManifestSchema.parse(await manifestResponse.json())
    if (manifest.catalogueContentHash !== expectedCatalogueHash) {
      const error = new Error(
        'Semantic embeddings are stale for this catalogue. Run npm run bot:embeddings.',
      )
      error.name = 'StaleEmbeddingIndexError'
      throw error
    }
    const [indexResponse, trackResponse, prototypeResponse] = await Promise.all([
      fetchRequired(`${root}${manifest.files.index}`),
      fetchRequired(`${root}${manifest.files.tracks}`),
      fetchRequired(`${root}${manifest.files.prototypes}`),
    ])
    const index = parseIndex(await indexResponse.json())
    if (index.dimensions !== manifest.dimensions) {
      throw new Error('Embedding index dimensions do not match the manifest.')
    }
    const [trackBuffer, prototypeBuffer] = await Promise.all([
      trackResponse.arrayBuffer(),
      prototypeResponse.arrayBuffer(),
    ])
    const expectedTrackBytes = index.tracks.length * index.dimensions * Float32Array.BYTES_PER_ELEMENT
    const expectedPrototypeBytes = index.prototypes.length * index.dimensions * Float32Array.BYTES_PER_ELEMENT
    if (
      trackBuffer.byteLength !== expectedTrackBytes ||
      prototypeBuffer.byteLength !== expectedPrototypeBytes ||
      manifest.trackEmbeddingBytes !== expectedTrackBytes ||
      manifest.prototypeEmbeddingBytes !== expectedPrototypeBytes
    ) {
      throw new Error('Embedding binary length does not match its validated index.')
    }
    if (
      manifest.trackCount !== index.tracks.length ||
      manifest.prototypeCount !== index.prototypes.length
    ) {
      throw new Error('Embedding item counts do not match the manifest.')
    }
    return new EmbeddingStore(
      manifest,
      index,
      new Float32Array(trackBuffer),
      new Float32Array(prototypeBuffer),
    )
  }

  search(query: Float32Array) {
    if (query.length !== this.index.dimensions) {
      throw new Error(`Expected ${this.index.dimensions} query dimensions; received ${query.length}.`)
    }
    const trackScores = Object.fromEntries(
      this.index.tracks.map((entry) => [
        entry.id,
        Math.max(0, Math.min(1, dot(this.trackVectors, entry.offset, this.index.dimensions, query))),
      ]),
    )

    const collapsed = new Map<string, { entry: PrototypeIndexEntry; score: number }>()
    for (const entry of this.index.prototypes) {
      const score = dot(this.prototypeVectors, entry.offset, this.index.dimensions, query)
      const conceptId = entry.id.split(':')[0] ?? entry.id
      const previous = collapsed.get(conceptId)
      if (!previous || score > previous.score) collapsed.set(conceptId, { entry, score })
    }
    const prototypeMatches: SemanticPrototypeMatch[] = [...collapsed.values()]
      .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id))
      .slice(0, 10)
      .map(({ entry, score }) => ({
        id: entry.id.split(':')[0] ?? entry.id,
        kind: entry.kind,
        score: Math.max(0, Math.min(1, score)),
        payload: entry.payload,
      }))
    return { trackScores, prototypeMatches }
  }
}
