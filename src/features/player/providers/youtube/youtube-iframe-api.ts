export type YouTubePlayer = {
  cueVideoById(videoId: string): void
  playVideo(): void
  pauseVideo(): void
  destroy(): void
}

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; CUED: number }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null

export const loadYouTubeIframeApi = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('YouTube embeds require a browser.'))
  }
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    const existing = document.querySelector<HTMLScriptElement>('script[data-pink-fm-provider="youtube"]')
    const script = existing ?? document.createElement('script')
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      if (window.YT) resolve(window.YT)
      else reject(new Error('YouTube’s player API was unavailable.'))
    }
    script.addEventListener('error', () => {
      apiPromise = null
      if (!existing) script.remove()
      reject(new Error('YouTube’s embedded player could not be loaded.'))
    }, { once: true })
    if (!existing) {
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.pinkFmProvider = 'youtube'
      document.head.append(script)
    }
  })
  return apiPromise
}
