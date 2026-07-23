import type { Track } from '../../../../config/schemas'
import { playbackCapabilities } from '../../provider-selection'
import type { PlaybackProviderAdapter, PlaybackState } from '../../playback-types'
import { loadSpotifyIframeApi } from './spotify-iframe-api'
import type { SpotifyEmbedController } from './spotify-types'
import { spotifyTrackUri } from './spotify-url'

export class SpotifyPlaybackAdapter implements PlaybackProviderAdapter {
  readonly id = 'spotify-embed' as const
  readonly capability = playbackCapabilities[this.id]
  private container: HTMLElement | null = null
  private controller: SpotifyEmbedController | null = null
  private controllerPromise: Promise<SpotifyEmbedController> | null = null
  private latestUri: string | null = null
  private wasPlaying = false
  private completedUri: string | null = null
  private latestTitle = ''

  constructor(private readonly onState: (state: PlaybackState) => void) {}

  canHandle(track: Track) { return Boolean(spotifyTrackUri(track.officialLinks.spotify)) }

  async mount(container: HTMLElement) {
    this.container = container
  }

  private createController(uri: string) {
    if (this.controller) return Promise.resolve(this.controller)
    if (this.controllerPromise) return this.controllerPromise
    if (!this.container) return Promise.reject(new Error('Spotify player is not mounted.'))
    this.controllerPromise = loadSpotifyIframeApi().then((api) => new Promise<SpotifyEmbedController>((resolve) => {
      api.createController(this.container as HTMLElement, { uri, width: '100%', height: 152 }, (controller) => {
        this.controller = controller
        controller.addListener('ready', () => {
          const iframe = this.container?.querySelector('iframe')
          if (iframe) iframe.title = `${this.latestTitle} — Spotify player`
          this.onState('ready')
        })
        controller.addListener('playback_error', () => this.onState('failed'))
        controller.addListener('playback_update', ({ data }) => {
          const playing = data?.isPaused === false
          if (playing && !this.wasPlaying) this.onState('playing')
          if (!playing && this.wasPlaying) this.onState('paused')
          this.wasPlaying = playing
          if (
            this.latestUri && this.completedUri !== this.latestUri && data?.duration &&
            data.position !== undefined && data.duration - data.position <= 500
          ) {
            this.completedUri = this.latestUri
            this.onState('completed')
          }
        })
        resolve(controller)
      })
    })).catch((error) => {
      this.controllerPromise = null
      throw error
    })
    return this.controllerPromise
  }

  async loadTrack(track: Track) {
    const uri = spotifyTrackUri(track.officialLinks.spotify)
    if (!uri) throw new Error('This is not a valid Spotify track destination.')
    this.latestUri = uri
    this.latestTitle = track.title
    this.completedUri = null
    this.onState('loading')
    const controller = await this.createController(uri)
    if (uri !== this.latestUri) return
    controller.loadUri(uri)
  }

  async play() { this.controller?.play() }
  async pause() { this.controller?.pause() }

  destroy() {
    this.controller?.destroy()
    this.controller = null
    this.controllerPromise = null
    this.container?.replaceChildren()
    this.container = null
  }
}
