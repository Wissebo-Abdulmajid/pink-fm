import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ExperienceProvider } from '../app/providers'
import { WisseBotDialog } from '../features/bot/WisseBotDialog'
import { PlaybackAction } from '../features/player/PlaybackAction'
import MoodPage from '../pages/MoodPage'
import RadioPage from '../pages/RadioPage'
import LibraryPage from '../pages/LibraryPage'
import { makeProfile, makeTrack } from '../test/fixtures'

const renderExperience = (children: React.ReactNode, profile = makeProfile()) =>
  render(
    <MemoryRouter initialEntries={['/g/test/mood']}>
      <ExperienceProvider slug="test" profile={profile} profileSource="network">
        {children}
      </ExperienceProvider>
    </MemoryRouter>,
  )

describe('primary experience components', () => {
  it('lets a keyboard user select a mood', async () => {
    const user = userEvent.setup()
    renderExperience(
      <Routes>
        <Route path="/g/test/mood" element={<MoodPage />} />
        <Route path="/g/test/radio" element={<div>Radio destination</div>} />
      </Routes>,
    )
    const peaceful = screen.getByRole('button', { name: /Peaceful/i })
    peaceful.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Radio destination')).toBeInTheDocument()
  })

  it('announces a changed recommendation', async () => {
    renderExperience(<RadioPage />)
    expect(await screen.findByText(/Recommended Track calm by Test Artist/i)).toBeInTheDocument()
  })

  it('updates local feedback state from the radio controls', async () => {
    const user = userEvent.setup()
    renderExperience(<RadioPage />)
    const love = await screen.findByRole('button', { name: 'Love this' })
    expect(love).toHaveAttribute('aria-pressed', 'false')
    await user.click(love)
    await waitFor(() => expect(love).toHaveAttribute('aria-pressed', 'true'))
  })

  it('runs WisseBot quick refinements through the shared recommender', async () => {
    const user = userEvent.setup()
    renderExperience(<WisseBotDialog open onClose={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'More energetic' }))
    expect(await screen.findByText(/more energy while keeping the current mood/i)).toBeInTheDocument()
    expect(screen.getByText('Current recommendation')).toBeInTheDocument()
  })

  it('discloses the enhanced model download before starting it', async () => {
    renderExperience(<WisseBotDialog open onClose={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Enhanced local understanding' })).toBeInTheDocument()
    expect(screen.getByText(/one-time download of approximately 142 MB/i)).toBeInTheDocument()
    expect(screen.getByText(/Pink FM remains fully usable without it/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download enhanced understanding' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/browser does not expose connection-quality details/i)).toBeInTheDocument())
  })

  it('lets the listener explicitly continue in instant mode', async () => {
    const user = userEvent.setup()
    renderExperience(<WisseBotDialog open onClose={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Continue with instant mode' }))
    expect(await screen.findByText('Instant understanding is ready.')).toBeInTheDocument()
    expect(screen.getByText(/no model download/i)).toBeInTheDocument()
  })

  it('handles a Malay request through the shared grounded recommender', async () => {
    const user = userEvent.setup()
    renderExperience(<WisseBotDialog open onClose={() => undefined} />)
    await user.type(screen.getByLabelText('Message WisseBot'), 'tenang tapi tak mengantuk')
    await user.click(screen.getByRole('button', { name: 'Tune' }))
    expect(await screen.findByText(/calm music with gentle energy/i)).toBeInTheDocument()
    expect(screen.getByText('Current recommendation')).toBeInTheDocument()
  })

  it('renders focused clarification choices for ambiguous input', async () => {
    const user = userEvent.setup()
    renderExperience(<WisseBotDialog open onClose={() => undefined} />)
    await user.type(screen.getByLabelText('Message WisseBot'), 'something powerful')
    await user.click(screen.getByRole('button', { name: 'Tune' }))
    expect(await screen.findByText(/stronger vocals, more energy, or greater emotional intensity/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Powerful vocals' })).toBeInTheDocument()
  })

  it('searches and filters the data-driven catalogue accessibly', async () => {
    const user = userEvent.setup()
    const calm = makeTrack('purnama', {
      title: 'Purnama Merindu',
      album: 'Pancawarna',
      albumId: 'pancawarna',
      collections: ['classics'],
    })
    const modern = makeTrack('modern', {
      title: 'Modern Signal',
      album: 'Modern Album',
      albumId: 'modern-album',
      collections: ['modern'],
    })
    const profile = makeProfile({
      tracks: { schemaVersion: 4, tracks: [calm, modern] },
      collections: {
        schemaVersion: 1,
        collections: [
          { id: 'classics', label: 'Classics', description: 'Older favourites', active: true, kind: 'editorial', artistIds: ['test-artist'], semanticDescription: 'Classic songs.', rankingWeight: 0.2 },
          { id: 'modern', label: 'Modern', description: 'Modern songs', active: true, kind: 'editorial', artistIds: ['test-artist'], semanticDescription: 'Modern songs.', rankingWeight: 0.2 },
        ],
      },
    })
    renderExperience(<LibraryPage />, profile)
    const search = screen.getByRole('searchbox', { name: /Search title, album or artist/i })
    await user.type(search, 'Pancawarna')
    expect(await screen.findAllByText('Purnama Merindu')).not.toHaveLength(0)
    expect(screen.queryAllByText('Modern Signal')).toHaveLength(0)
    await user.clear(search)
    await user.selectOptions(screen.getByLabelText('Collection'), 'modern')
    expect(await screen.findAllByText('Modern Signal')).not.toHaveLength(0)
    expect(screen.queryAllByText('Purnama Merindu')).toHaveLength(0)
  })

  it('handles a track with no streaming links without a fake play control', () => {
    const track = makeTrack('unlinked', {
      officialLinks: { youtube: '', spotify: '', appleMusic: '' },
    })
    renderExperience(<PlaybackAction track={track} />)
    expect(screen.getByText(/No official listening destination/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Listen on/i })).not.toBeInTheDocument()
  })
})
