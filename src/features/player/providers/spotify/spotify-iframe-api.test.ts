import { loadSpotifyIframeApi, resetSpotifyIframeApiForTests } from './spotify-iframe-api'
import { SpotifyPlaybackAdapter } from './spotify-adapter'
import type { SpotifyEmbedController, SpotifyIFrameApi } from './spotify-types'
import { makeTrack } from '../../../../test/fixtures'

afterEach(() => {
  resetSpotifyIframeApiForTests()
  document.querySelectorAll('script[data-pink-fm-provider="spotify"]').forEach((script) => script.remove())
})

describe('Spotify iframe API lifecycle', () => {
  it('loads the official script only once and shares concurrent requests', async () => {
    const first = loadSpotifyIframeApi()
    const second = loadSpotifyIframeApi()
    expect(first).toBe(second)
    expect(document.querySelectorAll('script[data-pink-fm-provider="spotify"]')).toHaveLength(1)
    const api = { createController: vi.fn() } as unknown as SpotifyIFrameApi
    window.onSpotifyIframeApiReady?.(api)
    await expect(first).resolves.toBe(api)
    await expect(second).resolves.toBe(api)
  })

  it('allows a later retry after script failure', async () => {
    const first = loadSpotifyIframeApi()
    document.querySelector<HTMLScriptElement>('script[data-pink-fm-provider="spotify"]')?.dispatchEvent(new Event('error'))
    await expect(first).rejects.toThrow(/could not be loaded/i)
    const second = loadSpotifyIframeApi()
    expect(document.querySelectorAll('script[data-pink-fm-provider="spotify"]')).toHaveLength(1)
    const api = { createController: vi.fn() } as unknown as SpotifyIFrameApi
    window.onSpotifyIframeApiReady?.(api)
    await expect(second).resolves.toBe(api)
  })

  it('reuses one controller for a new recommendation and destroys it on teardown', async () => {
    const loadUri = vi.fn((_uri: string) => undefined)
    const destroy = vi.fn(() => undefined)
    const instance: SpotifyEmbedController = {
      loadUri, destroy,
      play: () => undefined,
      pause: () => undefined,
      addListener: () => undefined,
    }
    const createController = vi.fn((
      _element: HTMLElement,
      _options: { uri: string; width: string; height: number },
      ready: (controller: SpotifyEmbedController) => void,
    ) => { ready(instance) })
    window.SpotifyIframeApi = { createController }
    const adapter = new SpotifyPlaybackAdapter(() => undefined)
    const container = document.createElement('div')
    await adapter.mount(container)
    await adapter.loadTrack(makeTrack('first'))
    await adapter.loadTrack(makeTrack('second', { officialLinks: { spotify: 'https://open.spotify.com/track/3hCfrrBnKmZsbep5rZ7f61', youtube: '', appleMusic: '' } }))
    expect(createController).toHaveBeenCalledTimes(1)
    expect(loadUri).toHaveBeenLastCalledWith('spotify:track:3hCfrrBnKmZsbep5rZ7f61')
    adapter.destroy()
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
