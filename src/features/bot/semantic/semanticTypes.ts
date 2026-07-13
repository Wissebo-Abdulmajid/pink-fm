export type SemanticPrototypeKind =
  | 'mood'
  | 'activity'
  | 'intent'
  | 'clarification'
  | 'collection'

export type SemanticPrototypeMatch = {
  id: string
  kind: SemanticPrototypeKind
  score: number
  payload: Record<string, string | number | boolean>
}

export type SemanticInterpretationResult = {
  prototypeMatches: SemanticPrototypeMatch[]
  trackScores: Record<string, number>
  durationMs: number
}

export type SemanticModelState =
  | 'idle'
  | 'consent-required'
  | 'downloading'
  | 'initialising'
  | 'ready'
  | 'lightweight'
  | 'unavailable'
  | 'stale-index'

export type SemanticProgress = {
  state: SemanticModelState
  message: string
  progress: number | null
  loadedBytes: number | null
  totalBytes: number | null
  device: 'webgpu' | 'wasm' | null
}

export type EmbeddingIndexEntry = {
  id: string
  offset: number
}

export type PrototypeIndexEntry = EmbeddingIndexEntry & {
  kind: SemanticPrototypeMatch['kind']
  text: string
  payload: Record<string, string | number | boolean>
}

export type EmbeddingIndex = {
  schemaVersion: 1
  dimensions: number
  tracks: EmbeddingIndexEntry[]
  prototypes: PrototypeIndexEntry[]
}

export type WorkerInitRequest = {
  type: 'init'
  requestId: string
  modelId: string
  modelRevision: string
  profileRootUrl: string
  expectedCatalogueHash: string
  preferWebGpu: boolean
}

export type WorkerInterpretRequest = {
  type: 'interpret'
  requestId: string
  message: string
}

export type WorkerDisposeRequest = {
  type: 'dispose'
  requestId: string
}

export type SemanticWorkerRequest =
  | WorkerInitRequest
  | WorkerInterpretRequest
  | WorkerDisposeRequest

export type WorkerProgressResponse = {
  type: 'progress'
  requestId: string
  progress: SemanticProgress
}

export type WorkerReadyResponse = {
  type: 'ready'
  requestId: string
  device: 'webgpu' | 'wasm'
  modelLoadMs: number
}

export type WorkerResultResponse = {
  type: 'result'
  requestId: string
  result: SemanticInterpretationResult
}

export type WorkerErrorResponse = {
  type: 'error'
  requestId: string
  code: 'MODEL_LOAD' | 'TIMEOUT' | 'STALE_INDEX' | 'CORRUPT_INDEX' | 'INFERENCE'
  message: string
}

export type WorkerDisposedResponse = {
  type: 'disposed'
  requestId: string
}

export type SemanticWorkerResponse =
  | WorkerProgressResponse
  | WorkerReadyResponse
  | WorkerResultResponse
  | WorkerErrorResponse
  | WorkerDisposedResponse
