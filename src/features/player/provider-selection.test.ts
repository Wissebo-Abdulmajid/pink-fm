import { makeTrack } from '../../test/fixtures'
import { selectPlaybackProvider } from './provider-selection'

const youtube = { videoId: 'AbCdEfGhI_1', verifiedOfficial: true as const, sourceId: 'official-source' }

describe('playback provider selection', () => {
  it('selects Spotify first when a direct track URL exists', () => {
    expect(selectPlaybackProvider(makeTrack('spotify')).provider).toBe('spotify-embed')
  })

  it('selects verified official YouTube when Spotify is absent', () => {
    const track = makeTrack('youtube', { officialLinks: { spotify: '', youtube: 'https://www.youtube.com/watch?v=AbCdEfGhI_1', appleMusic: '' }, playback: { preferredProvider: 'automatic', spotify: null, youtube, appleMusic: null } })
    expect(selectPlaybackProvider(track).provider).toBe('youtube-embed')
  })

  it('selects Apple preview after Spotify and YouTube', () => {
    const track = makeTrack('apple', { officialLinks: { spotify: '', youtube: '', appleMusic: 'https://music.apple.com/my/album/test/123?i=456' } })
    expect(selectPlaybackProvider(track).provider).toBe('apple-preview')
  })

  it('selects external last', () => {
    const track = makeTrack('external', { officialLinks: { spotify: 'https://open.spotify.com/album/5hYW2hAwvsaifyiNxDVVKC', youtube: '', appleMusic: '' } })
    expect(selectPlaybackProvider(track).provider).toBe('external')
  })

  it('respects an available listener preference', () => {
    const track = makeTrack('preferred', { officialLinks: { spotify: 'https://open.spotify.com/track/5hYW2hAwvsaifyiNxDVVKC', youtube: 'https://www.youtube.com/watch?v=AbCdEfGhI_1', appleMusic: '' }, playback: { preferredProvider: 'automatic', spotify: null, youtube, appleMusic: null } })
    expect(selectPlaybackProvider(track, 'youtube').provider).toBe('youtube-embed')
  })

  it('falls back without error when a preference is unavailable', () => {
    expect(selectPlaybackProvider(makeTrack('fallback'), 'youtube').provider).toBe('spotify-embed')
  })
})
