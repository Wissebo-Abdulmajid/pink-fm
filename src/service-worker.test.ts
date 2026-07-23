import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

type WorkerListener = (event: { waitUntil?: (promise: Promise<unknown>) => void; request?: unknown; respondWith?: (promise: Promise<unknown>) => void }) => void

const loadWorker = () => {
  const listeners = new Map<string, WorkerListener>()
  const deleted: string[] = []
  const caches = {
    keys: vi.fn(async () => ['pink-fm-v3-runtime', 'pink-fm-v5-profiles', 'pink-fm-v6-shell', 'pink-fm-v6-profiles', 'another-app']),
    delete: vi.fn(async (name: string) => { deleted.push(name); return true }),
    open: vi.fn(async () => ({ addAll: vi.fn(), match: vi.fn(), put: vi.fn() })),
    match: vi.fn(),
  }
  const self = {
    registration: { scope: 'https://example.test/pink-fm/' },
    location: { origin: 'https://example.test' },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, listener: WorkerListener) => listeners.set(type, listener),
  }
  runInNewContext(readFileSync(resolve(process.cwd(), 'public', 'sw.js'), 'utf8'), {
    self,
    caches,
    URL,
    Set,
    Promise,
    Response,
    fetch: vi.fn(),
  })
  return { listeners, deleted, caches }
}

describe('service worker cache safety', () => {
  it('cleans old Pink FM caches but preserves current and unrelated caches', async () => {
    const { listeners, deleted } = loadWorker()
    let activation: Promise<unknown> = Promise.resolve()
    listeners.get('activate')?.({ waitUntil: (promise) => { activation = promise } })
    await activation
    expect(deleted).toEqual(['pink-fm-v3-runtime', 'pink-fm-v5-profiles'])
  })

  it('does not intercept or cache a provider iframe request', () => {
    const { listeners, caches } = loadWorker()
    const respondWith = vi.fn()
    listeners.get('fetch')?.({
      request: { method: 'GET', url: 'https://www.youtube-nocookie.com/embed/example', mode: 'navigate', destination: 'iframe' },
      respondWith,
    })
    expect(respondWith).not.toHaveBeenCalled()
    expect(caches.open).not.toHaveBeenCalled()
  })
})
