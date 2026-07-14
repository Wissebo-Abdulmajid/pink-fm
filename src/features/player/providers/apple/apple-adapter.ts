import type { Track } from '../../../../config/schemas'
import { playbackCapabilities } from '../../provider-selection'
import type { PlaybackProviderAdapter, PlaybackState } from '../../playback-types'
import { appleMusicEmbedUrl } from './apple-url'

export class AppleMusicPreviewAdapter implements PlaybackProviderAdapter {
  readonly id = 'apple-preview' as const
  readonly capability = playbackCapabilities[this.id]
  private container: HTMLElement | null = null
  private iframe: HTMLIFrameElement | null = null

  constructor(private readonly onState: (state: PlaybackState) => void) {}

  canHandle(track: Track) {
    return Boolean(appleMusicEmbedUrl(track.playback.appleMusic?.url || track.officialLinks.appleMusic))
  }

  async mount(container: HTMLElement) { this.container = container }

  async loadTrack(track: Track) {
    const source = track.playback.appleMusic?.embedUrl
      || appleMusicEmbedUrl(track.playback.appleMusic?.url || track.officialLinks.appleMusic)
    if (!source || !this.container) throw new Error('This Apple Music preview is unavailable.')
    this.onState('loading')
    const iframe = this.iframe ?? document.createElement('iframe')
    iframe.title = `${track.title} — Apple Music preview player`
    iframe.allow = 'autoplay; encrypted-media'
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'
    iframe.loading = 'lazy'
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')
    iframe.onload = () => this.onState('ready')
    iframe.onerror = () => this.onState('failed')
    iframe.src = source
    if (!this.iframe) this.container.append(iframe)
    this.iframe = iframe
  }

  async play() { throw new Error('Use the visible Apple Music preview controls.') }
  async pause() { throw new Error('Use the visible Apple Music preview controls.') }
  destroy() { this.iframe?.remove(); this.iframe = null; this.container = null }
}
