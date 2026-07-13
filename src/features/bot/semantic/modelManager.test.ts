import { describe, expect, it, vi } from 'vitest'
import { hasUsableWebGpu } from './modelManager'

const navigatorWithGpu = (requestAdapter: () => Promise<unknown>) =>
  ({ gpu: { requestAdapter } }) as unknown as Navigator

describe('semantic device selection', () => {
  it('uses WebGPU only when an adapter can actually be created', async () => {
    const requestAdapter = vi.fn().mockResolvedValue({ name: 'test adapter' })

    await expect(hasUsableWebGpu(navigatorWithGpu(requestAdapter))).resolves.toBe(true)
    expect(requestAdapter).toHaveBeenCalledOnce()
  })

  it('falls back when WebGPU is exposed without an available adapter', async () => {
    await expect(
      hasUsableWebGpu(navigatorWithGpu(vi.fn().mockResolvedValue(null))),
    ).resolves.toBe(false)
  })

  it('falls back when probing WebGPU throws', async () => {
    await expect(
      hasUsableWebGpu(navigatorWithGpu(vi.fn().mockRejectedValue(new Error('blocked')))),
    ).resolves.toBe(false)
  })
})
