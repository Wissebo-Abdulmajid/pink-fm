import { shouldEnablePlaybackTestRoute } from './route-config'

describe('playback maintenance route', () => {
  it('is unavailable in an ordinary production build', () => {
    expect(shouldEnablePlaybackTestRoute(false, undefined)).toBe(false)
    expect(shouldEnablePlaybackTestRoute(false, 'false')).toBe(false)
  })

  it('remains available for local maintenance or an explicit maintenance build', () => {
    expect(shouldEnablePlaybackTestRoute(true, undefined)).toBe(true)
    expect(shouldEnablePlaybackTestRoute(false, 'true')).toBe(true)
  })
})
