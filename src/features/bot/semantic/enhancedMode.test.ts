import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  inspectEnhancedModelCache,
  readConnectionSignals,
  removeEnhancedModelCache,
} from './enhancedMode'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('enhanced-mode connection and cache policy', () => {
  it('treats unsupported connection information as a normal fast-path signal', () => {
    const signals = readConnectionSignals({ onLine: true } as Navigator)
    expect(signals).toMatchObject({
      online: true,
      effectiveType: null,
      saveData: null,
      constrained: false,
    })
  })

  it('detects data saver and slow connections', () => {
    expect(readConnectionSignals({
      onLine: true,
      connection: { saveData: true, effectiveType: '4g' },
    } as unknown as Navigator).constrained).toBe(true)
    expect(readConnectionSignals({
      onLine: true,
      connection: { saveData: false, effectiveType: '2g' },
    } as unknown as Navigator).constrained).toBe(true)
  })

  it('recognises and removes only the selected model revision', async () => {
    const matching = [
      new Request('https://huggingface.co/Xenova/multilingual-e5-small/resolve/rev-1/onnx/model_quantized.onnx'),
      new Request('https://huggingface.co/Xenova/multilingual-e5-small/resolve/rev-1/tokenizer.json'),
    ]
    const unrelated = new Request('https://example.test/other-model.bin')
    const deleted: string[] = []
    const cache = {
      keys: vi.fn(async () => [...matching, unrelated]),
      match: vi.fn(async () => new Response('', { headers: { 'content-length': '10' } })),
      delete: vi.fn(async (request: Request) => {
        deleted.push(request.url)
        return true
      }),
    }
    vi.stubGlobal('caches', {
      keys: vi.fn(async () => ['transformers-cache']),
      open: vi.fn(async () => cache),
    })

    await expect(inspectEnhancedModelCache('Xenova/multilingual-e5-small', 'rev-1'))
      .resolves.toMatchObject({ cached: true, entryCount: 2, approximateBytes: 20 })
    await expect(removeEnhancedModelCache('Xenova/multilingual-e5-small', 'rev-1'))
      .resolves.toEqual({ deleted: 2, supported: true })
    expect(deleted).toHaveLength(2)
    expect(deleted).not.toContain(unrelated.url)
  })
})
