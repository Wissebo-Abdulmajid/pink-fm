import { pipeline } from '@huggingface/transformers'
import type { SemanticProgress } from './semanticTypes'

type FeatureExtractor = {
  (
    text: string,
    options: { pooling: 'mean'; normalize: true },
  ): Promise<{ data: Float32Array; dims: number[] }>
  dispose: () => Promise<void>
}

type ProgressEvent = {
  status?: string
  progress?: number
  loaded?: number
  total?: number
  file?: string
}

type WebGpuNavigator = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<unknown>
  }
}

/**
 * A `navigator.gpu` property is only an API-shape signal. Browsers can expose
 * it while policy, drivers, headless mode, or power settings prevent an
 * adapter from being created. Probe the adapter before selecting WebGPU so
 * those environments go straight to the reliable WASM backend.
 */
export const hasUsableWebGpu = async (candidate: Navigator = navigator) => {
  const gpu = (candidate as WebGpuNavigator).gpu
  if (!gpu || typeof gpu.requestAdapter !== 'function') return false
  try {
    return Boolean(await gpu.requestAdapter())
  } catch {
    return false
  }
}

export class SemanticModelManager {
  private extractor: FeatureExtractor | null = null
  private device: 'webgpu' | 'wasm' = 'wasm'

  async load(input: {
    modelId: string
    modelRevision: string
    preferWebGpu: boolean
    onProgress: (progress: SemanticProgress) => void
  }) {
    const progressCallback = (raw: unknown) => {
      const event = (raw ?? {}) as ProgressEvent
      const isDownload = event.status === 'progress' || event.status === 'download'
      input.onProgress({
        state: isDownload ? 'downloading' : 'initialising',
        message: isDownload
          ? `Downloading enhanced understanding${event.file ? `: ${event.file}` : ''}`
          : 'Initialising enhanced local understanding',
        progress: typeof event.progress === 'number' ? event.progress / 100 : null,
        loadedBytes: typeof event.loaded === 'number' ? event.loaded : null,
        totalBytes: typeof event.total === 'number' ? event.total : null,
        device: this.device,
      })
    }

    const loadForDevice = async (device: 'webgpu' | 'wasm') => {
      this.device = device
      input.onProgress({
        state: 'initialising',
        message: `Initialising enhanced understanding with ${device === 'webgpu' ? 'WebGPU' : 'WASM'}`,
        progress: null,
        loadedBytes: null,
        totalBytes: null,
        device,
      })
      return (await pipeline('feature-extraction', input.modelId, {
        revision: input.modelRevision,
        dtype: 'q8',
        device,
        progress_callback: progressCallback,
      })) as unknown as FeatureExtractor
    }

    if (input.preferWebGpu && (await hasUsableWebGpu())) {
      try {
        this.extractor = await loadForDevice('webgpu')
        return this.device
      } catch {
        this.extractor = null
        input.onProgress({
          state: 'initialising',
          message: 'WebGPU was unavailable; continuing with the WASM fallback',
          progress: null,
          loadedBytes: null,
          totalBytes: null,
          device: 'wasm',
        })
      }
    }
    this.extractor = await loadForDevice('wasm')
    return this.device
  }

  async embed(message: string) {
    if (!this.extractor) throw new Error('Semantic model is not ready.')
    const output = await this.extractor(`query: ${message}`, {
      pooling: 'mean',
      normalize: true,
    })
    const dimensions = output.dims.at(-1) ?? output.data.length
    if (output.data.length !== dimensions) {
      throw new Error(`Unexpected query embedding shape: ${output.dims.join(' × ')}`)
    }
    return output.data
  }

  getDevice() {
    return this.device
  }

  async dispose() {
    if (this.extractor) await this.extractor.dispose()
    this.extractor = null
  }
}
