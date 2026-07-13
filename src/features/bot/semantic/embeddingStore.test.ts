import { vi } from 'vitest'
import { EmbeddingStore } from './embeddingStore'

const hash = 'a'.repeat(64)
const manifest = {
  schemaVersion: 1,
  modelId: 'Xenova/multilingual-e5-small',
  modelRevision: 'revision',
  dtype: 'q8',
  dimensions: 2,
  pooling: 'mean',
  normalisation: 'l2',
  catalogueContentHash: hash,
  createdAt: '2026-07-13T00:00:00.000Z',
  trackCount: 2,
  prototypeCount: 2,
  estimatedModelDownloadBytes: 100,
  vectorEncoding: 'float32-le',
  trackEmbeddingBytes: 16,
  prototypeEmbeddingBytes: 16,
  files: { tracks: 'tracks.bin', prototypes: 'prototypes.bin', index: 'index.json' },
}

const index = {
  schemaVersion: 1,
  dimensions: 2,
  tracks: [{ id: 'calm', offset: 0 }, { id: 'bright', offset: 1 }],
  prototypes: [
    { id: 'mood-peaceful:1', offset: 0, kind: 'mood', text: 'calm', payload: { mood: 'peaceful' } },
    { id: 'mood-happy:1', offset: 1, kind: 'mood', text: 'happy', payload: { mood: 'happy' } },
  ],
}

const arrayBuffer = (values: number[]) => Float32Array.from(values).buffer

const response = (value: unknown, binary = false): Response => ({
  ok: true,
  status: 200,
  json: async () => value,
  arrayBuffer: async () => binary ? value as ArrayBuffer : new ArrayBuffer(0),
}) as Response

const installFetch = (overrides: Record<string, Response> = {}) => {
  const values: Record<string, Response> = {
    '/gifts/test/embeddings/manifest.json': response(manifest),
    '/gifts/test/embeddings/index.json': response(index),
    '/gifts/test/embeddings/tracks.bin': response(arrayBuffer([1, 0, 0, 1]), true),
    '/gifts/test/embeddings/prototypes.bin': response(arrayBuffer([1, 0, 0, 1]), true),
    ...overrides,
  }
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const key = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
    const match = values[key]
    if (!match) return { ok: false, status: 404 } as Response
    return match
  }))
}

describe('EmbeddingStore', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads compact vectors and returns grounded cosine matches', async () => {
    installFetch()
    const store = await EmbeddingStore.load('/gifts/test/', hash)
    const result = store.search(Float32Array.from([1, 0]))
    expect(result.trackScores.calm).toBe(1)
    expect(result.trackScores.bright).toBe(0)
    expect(result.prototypeMatches[0]).toEqual(expect.objectContaining({ id: 'mood-peaceful', score: 1 }))
  })

  it('rejects a stale catalogue hash before loading model vectors', async () => {
    installFetch()
    await expect(EmbeddingStore.load('/gifts/test/', 'b'.repeat(64))).rejects.toThrow(/stale/i)
  })

  it('rejects a corrupt binary length', async () => {
    installFetch({
      '/gifts/test/embeddings/tracks.bin': response(arrayBuffer([1, 0]), true),
    })
    await expect(EmbeddingStore.load('/gifts/test/', hash)).rejects.toThrow(/binary length/i)
  })

  it('rejects an index with mismatched dimensions', async () => {
    installFetch({
      '/gifts/test/embeddings/index.json': response({ ...index, dimensions: 3 }),
    })
    await expect(EmbeddingStore.load('/gifts/test/', hash)).rejects.toThrow(/dimensions/i)
  })

  it('rejects a query vector from the wrong model', async () => {
    installFetch()
    const store = await EmbeddingStore.load('/gifts/test/', hash)
    expect(() => store.search(Float32Array.from([1, 0, 0]))).toThrow(/Expected 2 query dimensions/i)
  })
})
