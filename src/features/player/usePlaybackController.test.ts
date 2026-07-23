import { friendlyPlaybackError } from './usePlaybackController'

describe('playback failure language', () => {
  it('never exposes a raw provider error in the recipient message', () => {
    expect(friendlyPlaybackError()).toBe('This player could not tune in. Try again or choose another frequency.')
    expect(friendlyPlaybackError()).not.toMatch(/api|exception|stack|source id/i)
  })
})
