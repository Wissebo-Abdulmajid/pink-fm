import { makeTrack } from '../../test/fixtures'
import { fullPlaybackSourcesForRadio, isRadioEligible, playbackStatusLabel } from './full-playback'

describe('full-song radio eligibility', () => {
  it('accepts a verified embeddable full YouTube source', () => {
    expect(isRadioEligible(makeTrack('full'))).toBe(true)
  })

  it('rejects preview-only and external-only tracks', () => {
    expect(isRadioEligible(makeTrack('preview', {
      playbackCoverage: 'preview-only',
      fullPlaybackSources: [],
    }))).toBe(false)
    expect(isRadioEligible(makeTrack('external', {
      playbackCoverage: 'external-only',
      fullPlaybackSources: [],
    }))).toBe(false)
  })

  it('rejects unverified, non-embeddable and too-short sources', () => {
    const base = makeTrack('bad')
    const baseSource = base.fullPlaybackSources[0]
    if (!baseSource) throw new Error('Fixture track must include a full playback source.')
    expect(isRadioEligible({
      ...base,
      id: 'unverified',
      fullPlaybackSources: [{ ...baseSource, verified: false }],
    })).toBe(false)
    expect(isRadioEligible({
      ...base,
      id: 'disabled',
      fullPlaybackSources: [{ ...baseSource, embeddable: false }],
    })).toBe(false)
    expect(isRadioEligible({
      ...base,
      id: 'short',
      fullPlaybackSources: [{ ...baseSource, fullLength: false }],
    })).toBe(false)
  })

  it('labels official live versions clearly', () => {
    const base = makeTrack('live')
    const baseSource = base.fullPlaybackSources[0]
    if (!baseSource) throw new Error('Fixture track must include a full playback source.')
    expect(playbackStatusLabel(makeTrack('live', {
      fullPlaybackSources: [{ ...baseSource, version: 'live' }],
    }))).toBe('FULL OFFICIAL LIVE VERSION')
  })

  it('orders the primary, backup and official alternate sources deterministically', () => {
    const track = makeTrack('fallback-order')
    const source = track.fullPlaybackSources[0]
    if (!source) throw new Error('Fixture track must include a full playback source.')
    const sources = fullPlaybackSourcesForRadio(makeTrack('fallback-order', {
      fullPlaybackSources: [
        { ...source, id: 'official-live', videoId: 'AbCdEfGhI_3', sourceUrl: 'https://www.youtube.com/watch?v=AbCdEfGhI_3', priority: 3, version: 'live' },
        { ...source, id: 'backup-studio', videoId: 'AbCdEfGhI_2', sourceUrl: 'https://www.youtube.com/watch?v=AbCdEfGhI_2', priority: 2 },
        { ...source, id: 'primary-studio', videoId: 'AbCdEfGhI_1', sourceUrl: 'https://www.youtube.com/watch?v=AbCdEfGhI_1', priority: 1 },
      ],
    }))
    expect(sources.map((item) => item.id)).toEqual(['primary-studio', 'backup-studio', 'official-live'])
  })

  it('removes alternate performances when the listener disables them', () => {
    const track = makeTrack('no-alternates')
    const source = track.fullPlaybackSources[0]
    if (!source) throw new Error('Fixture track must include a full playback source.')
    expect(fullPlaybackSourcesForRadio(makeTrack('no-alternates', {
      fullPlaybackSources: [
        source,
        { ...source, id: 'live', videoId: 'AbCdEfGhI_2', sourceUrl: 'https://www.youtube.com/watch?v=AbCdEfGhI_2', priority: 2, version: 'live' },
      ],
    }), false).map((item) => item.id)).toEqual([source.id])
  })
})
