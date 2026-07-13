import type { Collection, Track } from '../../../config/schemas'
import { browserCatalogueContentHash } from './catalogueHash'
import type {
  SemanticInterpretationResult,
  SemanticModelState,
  SemanticProgress,
  SemanticWorkerRequest,
  SemanticWorkerResponse,
} from './semanticTypes'
import type { SemanticInterpreter } from '../types'

type Pending = {
  resolve: (value: SemanticWorkerResponse) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export type SemanticClientSnapshot = SemanticProgress & {
  modelLoadMs: number | null
  firstInferenceMs: number | null
  lastInferenceMs: number | null
}

const initialSnapshot = (): SemanticClientSnapshot => ({
  state: 'consent-required',
  message: 'Enhanced understanding is available locally.',
  progress: null,
  loadedBytes: null,
  totalBytes: null,
  device: null,
  modelLoadMs: null,
  firstInferenceMs: null,
  lastInferenceMs: null,
})

export class SemanticClient implements SemanticInterpreter {
  private worker: Worker | null = null
  private pending = new Map<string, Pending>()
  private sequence = 0
  private snapshot = initialSnapshot()
  private listeners = new Set<() => void>()
  private enablePromise: Promise<void> | null = null

  constructor(
    private readonly config: {
      modelId: string
      modelRevision: string
      profileRootUrl: string
      tracks: Track[]
      collections: Collection[]
      preferWebGpu?: boolean
    },
  ) {}

  getSnapshot = () => this.snapshot

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private update(next: Partial<SemanticClientSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next }
    this.listeners.forEach((listener) => listener())
  }

  private requestId(prefix: string) {
    this.sequence += 1
    return `${prefix}-${Date.now()}-${this.sequence}`
  }

  private ensureWorker() {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./semantic.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<SemanticWorkerResponse>) => {
      const response = event.data
      if (response.type === 'progress') {
        this.update(response.progress)
        return
      }
      const pending = this.pending.get(response.requestId)
      if (!pending) return
      clearTimeout(pending.timeout)
      this.pending.delete(response.requestId)
      if (response.type === 'error') {
        const state: SemanticModelState = response.code === 'STALE_INDEX' ? 'stale-index' : 'unavailable'
        this.update({ state, message: response.message })
        pending.reject(new Error(response.message))
      } else {
        pending.resolve(response)
      }
    }
    worker.onerror = () => {
      this.update({ state: 'unavailable', message: 'Enhanced understanding could not start.' })
      this.rejectAll(new Error('Semantic worker failed.'))
    }
    this.worker = worker
    return worker
  }

  private send(request: SemanticWorkerRequest, timeoutMs: number) {
    const worker = this.ensureWorker()
    return new Promise<SemanticWorkerResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request.requestId)
        reject(new Error('Semantic request timed out.'))
      }, timeoutMs)
      this.pending.set(request.requestId, { resolve, reject, timeout })
      worker.postMessage(request)
    })
  }

  async enable() {
    if (this.snapshot.state === 'ready') return
    if (this.enablePromise) return this.enablePromise
    this.enablePromise = (async () => {
      this.update({
        state: 'initialising',
        message: 'Checking the local semantic index…',
        progress: null,
      })
      const expectedCatalogueHash = await browserCatalogueContentHash(
        this.config.tracks,
        this.config.collections,
      )
      const requestId = this.requestId('init')
      const response = await this.send(
        {
          type: 'init',
          requestId,
          modelId: this.config.modelId,
          modelRevision: this.config.modelRevision,
          profileRootUrl: this.config.profileRootUrl,
          expectedCatalogueHash,
          preferWebGpu: this.config.preferWebGpu ?? true,
        },
        180_000,
      )
      if (response.type !== 'ready') throw new Error('Semantic model did not become ready.')
      this.update({
        state: 'ready',
        message: 'Enhanced local understanding is ready.',
        progress: 1,
        device: response.device,
        modelLoadMs: response.modelLoadMs,
      })
    })()
      .catch((error) => {
        if (this.snapshot.state !== 'stale-index') {
          this.update({
            state: 'unavailable',
            message: error instanceof Error ? error.message : 'Enhanced understanding is unavailable.',
          })
        }
        throw error
      })
      .finally(() => {
        this.enablePromise = null
      })
    return this.enablePromise
  }

  useLightweightMode() {
    this.update({
      state: 'lightweight',
      message: 'Lightweight multilingual rules are active.',
      progress: null,
    })
  }

  async interpret(message: string): Promise<SemanticInterpretationResult> {
    if (this.snapshot.state !== 'ready') await this.enable()
    const requestId = this.requestId('interpret')
    const response = await this.send({ type: 'interpret', requestId, message }, 25_000)
    if (response.type !== 'result') throw new Error('Semantic interpretation did not return a result.')
    this.update({
      firstInferenceMs: this.snapshot.firstInferenceMs ?? response.result.durationMs,
      lastInferenceMs: response.result.durationMs,
    })
    return response.result
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pending.clear()
  }

  dispose() {
    if (!this.worker) return
    const requestId = this.requestId('dispose')
    this.worker.postMessage({ type: 'dispose', requestId } satisfies SemanticWorkerRequest)
    this.worker.terminate()
    this.worker = null
    this.rejectAll(new Error('Semantic client was disposed.'))
  }
}
