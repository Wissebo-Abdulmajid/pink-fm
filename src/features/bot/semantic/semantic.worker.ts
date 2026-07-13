/// <reference lib="webworker" />

import { EmbeddingStore } from './embeddingStore'
import { SemanticModelManager } from './modelManager'
import type { SemanticWorkerRequest, SemanticWorkerResponse } from './semanticTypes'

const scope = self as DedicatedWorkerGlobalScope
const model = new SemanticModelManager()
let store: EmbeddingStore | null = null

const send = (message: SemanticWorkerResponse) => scope.postMessage(message)

const errorCode = (error: unknown): Extract<SemanticWorkerResponse, { type: 'error' }>['code'] => {
  if (error instanceof Error && error.name === 'StaleEmbeddingIndexError') return 'STALE_INDEX'
  if (error instanceof Error && /index|embedding binary|manifest/i.test(error.message)) return 'CORRUPT_INDEX'
  return store ? 'INFERENCE' : 'MODEL_LOAD'
}

scope.onmessage = (event: MessageEvent<SemanticWorkerRequest>) => {
  const request = event.data
  void (async () => {
    try {
      if (request.type === 'init') {
        const started = performance.now()
        store = await EmbeddingStore.load(request.profileRootUrl, request.expectedCatalogueHash)
        const device = await model.load({
          modelId: request.modelId,
          modelRevision: request.modelRevision,
          preferWebGpu: request.preferWebGpu,
          onProgress: (progress) => send({ type: 'progress', requestId: request.requestId, progress }),
        })
        send({
          type: 'ready',
          requestId: request.requestId,
          device,
          modelLoadMs: performance.now() - started,
        })
        return
      }
      if (request.type === 'interpret') {
        if (!store) throw new Error('Embedding index is not ready.')
        const started = performance.now()
        const query = await model.embed(request.message)
        const result = store.search(query)
        send({
          type: 'result',
          requestId: request.requestId,
          result: { ...result, durationMs: performance.now() - started },
        })
        return
      }
      await model.dispose()
      store = null
      send({ type: 'disposed', requestId: request.requestId })
      scope.close()
    } catch (error) {
      send({
        type: 'error',
        requestId: request.requestId,
        code: errorCode(error),
        message: error instanceof Error ? error.message : 'Semantic worker failed.',
      })
    }
  })()
}
