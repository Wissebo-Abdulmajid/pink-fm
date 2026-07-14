import type { Track } from '../../../../config/schemas'
import { playbackCapabilities } from '../../provider-selection'
import type { PlaybackProviderAdapter, PlaybackState } from '../../playback-types'
import { loadYouTubeIframeApi, type YouTubePlayer } from './youtube-iframe-api'
import { isYouTubeVideoId } from './youtube-url'

export class YouTubePlaybackAdapter implements PlaybackProviderAdapter {
  readonly id = 'youtube-embed' as const
  readonly capability = playbackCapabilities[this.id]
  private container: HTMLElement | null = null
  private player: YouTubePlayer | null = null
  private playerPromise: Promise<YouTubePlayer> | null = null
  private latestVideoId: string | null = null

  constructor(private readonly onState: (state: PlaybackState) => void) {}

  canHandle(track: Track) {
    const item = track.playback.youtube
    return Boolean(item?.verifiedOfficial && item.sourceId && isYouTubeVideoId(item.videoId))
  }

  async mount(container: HTMLElement) { this.container = container }

  private createPlayer(videoId: string) {
    if (this.player) return Promise.resolve(this.player)
    if (this.playerPromise) return this.playerPromise
    if (!this.container) return Promise.reject(new Error('YouTube player is not mounted.'))
    this.playerPromise = loadYouTubeIframeApi().then((api) => new Promise<YouTubePlayer>((resolve) => {
      const player = new api.Player(this.container as HTMLElement, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        width: '100%',
        height: '220',
        playerVars: { controls: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: () => { this.onState('ready'); resolve(player) },
          onError: () => this.onState('failed'),
          onStateChange: (event: { data: number }) => {
            if (event.data === api.PlayerState.PLAYING) this.onState('playing')
            else if (event.data === api.PlayerState.PAUSED) this.onState('paused')
            else if (event.data === api.PlayerState.ENDED) this.onState('completed')
            else if (event.data === api.PlayerState.CUED) this.onState('ready')
          },
        },
      })
      this.player = player
    })).catch((error) => {
      this.playerPromise = null
      throw error
    })
    return this.playerPromise
  }

  async loadTrack(track: Track) {
    const videoId = track.playback.youtube?.videoId
    if (!videoId || !this.canHandle(track)) throw new Error('This YouTube record is not verified.')
    this.latestVideoId = videoId
    this.onState('loading')
    const player = await this.createPlayer(videoId)
    if (videoId === this.latestVideoId) player.cueVideoById(videoId)
  }

  async play() { this.player?.playVideo() }
  async pause() { this.player?.pauseVideo() }
  destroy() { this.player?.destroy(); this.player = null; this.playerPromise = null; this.container = null }
}
