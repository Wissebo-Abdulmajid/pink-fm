import type { SpotifyIFrameApi } from './spotify-types'

const SCRIPT_URL = 'https://open.spotify.com/embed/iframe-api/v1'
let apiPromise: Promise<SpotifyIFrameApi> | null = null

export const loadSpotifyIframeApi = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Spotify embeds require a browser.'))
  }
  if (window.SpotifyIframeApi) return Promise.resolve(window.SpotifyIframeApi)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<SpotifyIFrameApi>((resolve, reject) => {
    const previousReady = window.onSpotifyIframeApiReady
    const existing = document.querySelector<HTMLScriptElement>('script[data-pink-fm-provider="spotify"]')
    const script = existing ?? document.createElement('script')
    const fail = () => {
      apiPromise = null
      if (!existing) script.remove()
      reject(new Error('Spotify’s embedded player could not be loaded.'))
    }
    window.onSpotifyIframeApiReady = (api) => {
      window.SpotifyIframeApi = api
      previousReady?.(api)
      resolve(api)
    }
    script.addEventListener('error', fail, { once: true })
    if (!existing) {
      script.src = SCRIPT_URL
      script.async = true
      script.dataset.pinkFmProvider = 'spotify'
      document.head.append(script)
    }
  })
  return apiPromise
}

export const resetSpotifyIframeApiForTests = () => {
  apiPromise = null
  if (typeof window !== 'undefined') {
    delete window.SpotifyIframeApi
    delete window.onSpotifyIframeApiReady
  }
}
