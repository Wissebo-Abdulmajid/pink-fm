export type ConnectionSignals = {
  online: boolean
  effectiveType: string | null
  saveData: boolean | null
  downlinkMbps: number | null
  constrained: boolean
}

type NetworkInformationLike = EventTarget & {
  effectiveType?: string
  saveData?: boolean
  downlink?: number
}

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike
  mozConnection?: NetworkInformationLike
  webkitConnection?: NetworkInformationLike
}

export type EnhancedCacheStatus = {
  supported: boolean
  cached: boolean
  entryCount: number
  approximateBytes: number | null
}

const TRANSFORMERS_CACHE = 'transformers-cache'

const connectionFor = (candidate: NavigatorWithConnection) =>
  candidate.connection ?? candidate.mozConnection ?? candidate.webkitConnection

export const readConnectionSignals = (candidate: Navigator = navigator): ConnectionSignals => {
  const connection = connectionFor(candidate)
  const effectiveType = typeof connection?.effectiveType === 'string'
    ? connection.effectiveType
    : null
  const saveData = typeof connection?.saveData === 'boolean' ? connection.saveData : null
  const downlinkMbps = typeof connection?.downlink === 'number' ? connection.downlink : null
  return {
    online: candidate.onLine,
    effectiveType,
    saveData,
    downlinkMbps,
    constrained:
      saveData === true || effectiveType === 'slow-2g' || effectiveType === '2g',
  }
}

const matchesModel = (url: string, modelId: string, revision: string) => {
  const decoded = decodeURIComponent(url).toLowerCase()
  const id = modelId.toLowerCase()
  const targetRevision = revision.toLowerCase()
  return decoded.includes(id) && decoded.includes(targetRevision)
}

const responseBytes = async (cache: Cache, request: Request) => {
  const response = await cache.match(request)
  const header = response?.headers.get('content-length')
  const parsed = header ? Number(header) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export const inspectEnhancedModelCache = async (
  modelId: string,
  revision: string,
): Promise<EnhancedCacheStatus> => {
  if (typeof caches === 'undefined') {
    return { supported: false, cached: false, entryCount: 0, approximateBytes: null }
  }
  try {
    const names = await caches.keys()
    const matching: Array<{ cache: Cache; request: Request }> = []
    for (const name of names) {
      const cache = await caches.open(name)
      const requests = await cache.keys()
      requests
        .filter((request) => matchesModel(request.url, modelId, revision))
        .forEach((request) => matching.push({ cache, request }))
    }
    const urls = matching.map(({ request }) => decodeURIComponent(request.url).toLowerCase())
    const hasWeights = urls.some((url) => /\/onnx\/model_(?:quantized|int8|uint8)\.onnx(?:$|\?)/.test(url))
    const hasTokenizer = urls.some((url) => /\/tokenizer\.json(?:$|\?)/.test(url))
    const sizes = await Promise.all(matching.map(({ cache, request }) => responseBytes(cache, request)))
    const knownSizes = sizes.filter((size): size is number => size !== null)
    return {
      supported: true,
      cached: hasWeights && hasTokenizer,
      entryCount: matching.length,
      approximateBytes: knownSizes.length === matching.length
        ? knownSizes.reduce((sum, size) => sum + size, 0)
        : null,
    }
  } catch {
    return { supported: true, cached: false, entryCount: 0, approximateBytes: null }
  }
}

export const removeEnhancedModelCache = async (
  modelId: string,
  revision: string,
) => {
  if (typeof caches === 'undefined') return { deleted: 0, supported: false }
  let deleted = 0
  const names = await caches.keys()
  for (const name of names) {
    const cache = await caches.open(name)
    const requests = await cache.keys()
    for (const request of requests) {
      if (matchesModel(request.url, modelId, revision) && await cache.delete(request)) {
        deleted += 1
      }
    }
  }
  return { deleted, supported: true }
}

export const transformersCacheName = TRANSFORMERS_CACHE
