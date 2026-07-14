export type SpotifyPlaybackUpdate = {
  data?: { isPaused?: boolean; position?: number; duration?: number }
}

export type SpotifyEmbedController = {
  loadUri(uri: string): void
  play(): void
  pause(): void
  destroy(): void
  addListener(event: 'ready' | 'playback_update' | 'playback_error', callback: (event: SpotifyPlaybackUpdate) => void): void
}

export type SpotifyIFrameApi = {
  createController(
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyEmbedController) => void,
  ): void
}

declare global {
  interface Window {
    SpotifyIframeApi?: SpotifyIFrameApi
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void
  }
}
