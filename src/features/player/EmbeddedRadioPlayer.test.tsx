import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ExperienceProvider } from '../../app/providers'
import { makeProfile, makeTrack } from '../../test/fixtures'
import { EmbeddedRadioPlayer } from './EmbeddedRadioPlayer'
import { resetSpotifyIframeApiForTests } from './providers/spotify/spotify-iframe-api'

const renderPlayer = (track = makeTrack('player')) => render(
  <MemoryRouter>
    <ExperienceProvider slug="player-test" profile={makeProfile({ tracks: { schemaVersion: 4, tracks: [track] } })} profileSource="network">
      <EmbeddedRadioPlayer track={track} station="Velvet Calm" />
    </ExperienceProvider>
  </MemoryRouter>,
)

afterEach(() => {
  resetSpotifyIframeApiForTests()
  document.querySelectorAll('script[data-pink-fm-provider]').forEach((script) => script.remove())
})

describe('embedded radio player', () => {
  it('does not load provider scripts before consent and keeps external fallback after denial', async () => {
    const user = userEvent.setup()
    renderPlayer()
    expect(document.querySelector('script[data-pink-fm-provider]')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Continue with external links only' }))
    expect(document.querySelector('script[data-pink-fm-provider]')).toBeNull()
    expect(screen.getByRole('link', { name: /Open in Spotify/i })).toBeInTheDocument()
    expect(screen.getByText(/Embedded players are turned off/i)).toBeInTheDocument()
  })

  it('loads Spotify only after the listener allows embedded players', async () => {
    const user = userEvent.setup()
    renderPlayer(makeTrack('spotify-player', {
      officialLinks: { spotify: 'https://open.spotify.com/track/5hYW2hAwvsaifyiNxDVVKC', youtube: '', appleMusic: '' },
      playbackCoverage: 'external-only',
      fullPlaybackSources: [],
      playback: { preferredProvider: 'automatic', spotify: null, youtube: null, appleMusic: null },
    }))
    await user.click(screen.getByRole('button', { name: 'Allow embedded players' }))
    await waitFor(() => expect(document.querySelectorAll('script[data-pink-fm-provider="spotify"]')).toHaveLength(1))
  })

  it('renders an official Apple preview iframe without fake custom play controls', async () => {
    const user = userEvent.setup()
    const track = makeTrack('apple-player', {
      officialLinks: { spotify: '', youtube: '', appleMusic: 'https://music.apple.com/my/album/cindai/573126598?i=573126640' },
      playbackCoverage: 'preview-only',
      fullPlaybackSources: [],
      playback: { preferredProvider: 'automatic', spotify: null, youtube: null, appleMusic: null },
    })
    renderPlayer(track)
    await user.click(screen.getByRole('button', { name: 'Allow embedded players' }))
    await waitFor(() => expect(document.querySelector('iframe[src^="https://embed.music.apple.com/"]')).not.toBeNull())
    expect(screen.getByText('Preview provided by Apple Music')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Play$/ })).not.toBeInTheDocument()
  })

  it('announces an honest offline playback limitation', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    renderPlayer()
    expect(screen.getByText('Pink FM is ready, but full-song playback requires an internet connection.')).toBeInTheDocument()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
  })
})
