import { makeTrack } from '../../test/fixtures'
import {
  candidateCanBeApplied,
  classifyCatalogueCandidate,
  detectYouTubeVideoKind,
  durationIsFullLength,
  normaliseForMatch,
  titleMatchesTrack,
  type DiscoveredYouTubeVideo,
  type TrustedYouTubeAuthority,
} from './youtube-catalog-matching'

const authority: TrustedYouTubeAuthority = {
  channelId: 'UCNq-mu-iXUmiAWyDOcJmZZg',
  name: 'Siti Nurhaliza',
  authority: 'artist-official',
  active: true,
  evidenceUrl: 'https://www.youtube.com/channel/UCNq-mu-iXUmiAWyDOcJmZZg',
  verifiedAt: '2026-07-14',
  notes: 'Fixture authority.',
}

const video = (overrides: Partial<DiscoveredYouTubeVideo> = {}): DiscoveredYouTubeVideo => ({
  videoId: 'N2zJlMofr9Y',
  title: "Dato' Sri Siti Nurhaliza - Cindai (Official Music Video)",
  channelId: authority.channelId,
  channelName: authority.name,
  durationSeconds: 296,
  embeddable: true,
  public: true,
  sourceUrl: 'https://www.youtube.com/watch?v=N2zJlMofr9Y',
  ...overrides,
})

describe('youtube catalogue matching', () => {
  it('normalises honorifics, punctuation and artist names', () => {
    expect(normaliseForMatch("Dato' Sri Siti Nurhaliza - Cindai (Official Music Video)")).toBe('cindai')
    expect(titleMatchesTrack(makeTrack('cindai', { title: 'Cindai' }), 'Cindai · Siti Nurhaliza')).toBe(true)
  })

  it('detects official versions without losing parenthetical metadata', () => {
    expect(detectYouTubeVideoKind('Cindai (Official Music Video)', 296)).toBe('official-music-video')
    expect(detectYouTubeVideoKind('Cindai (Official Audio)', 296)).toBe('official-audio')
    expect(detectYouTubeVideoKind('Cindai (Official Lyric Video)', 296)).toBe('official-lyric-video')
    expect(detectYouTubeVideoKind('Cindai Live Performance', 296)).toBe('official-live')
  })

  it('rejects Shorts, previews, medleys and karaoke-like records', () => {
    expect(detectYouTubeVideoKind('Cindai #Shorts', 45)).toBe('rejected-short')
    expect(detectYouTubeVideoKind('Cindai preview', 30)).toBe('rejected-short')
    expect(detectYouTubeVideoKind('Siti Nurhaliza medley', 620)).toBe('rejected-medley')
    expect(detectYouTubeVideoKind('Cindai karaoke', 296)).toBe('rejected-karaoke')
  })

  it('requires adequate duration evidence', () => {
    expect(durationIsFullLength(296, 290)).toBe(true)
    expect(durationIsFullLength(80, 290)).toBe(false)
    expect(durationIsFullLength(null, 290)).toBe(false)
  })

  it('classifies trusted exact official uploads as applicable', () => {
    const candidate = classifyCatalogueCandidate(makeTrack('cindai', { title: 'Cindai' }), video(), authority)
    expect(candidate.matchConfidence).toBe('exact-high-confidence')
    expect(candidate.reviewStatus).toBe('accepted')
    expect(candidateCanBeApplied(candidate)).toBe(true)
  })

  it('rejects non-trusted channels and disabled embeds', () => {
    const track = makeTrack('cindai', { title: 'Cindai' })
    expect(classifyCatalogueCandidate(track, video({ channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa' }), undefined).matchConfidence).toBe('rejected')
    expect(classifyCatalogueCandidate(track, video({ embeddable: false }), authority).matchConfidence).toBe('rejected')
  })

  it('does not auto-apply alternate live versions', () => {
    const candidate = classifyCatalogueCandidate(
      makeTrack('cindai', { title: 'Cindai' }),
      video({ title: 'Siti Nurhaliza - Cindai Live Performance' }),
      authority,
    )
    expect(candidate.matchConfidence).toBe('probable-needs-review')
    expect(candidateCanBeApplied(candidate)).toBe(false)
  })
})
