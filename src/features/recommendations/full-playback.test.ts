import { makeTrack } from '../../test/fixtures'
import { isRadioEligible, playbackStatusLabel } from './full-playback'

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
})
