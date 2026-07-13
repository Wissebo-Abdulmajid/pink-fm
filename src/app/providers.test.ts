import { vector } from '../test/fixtures'
import { normaliseMoodTarget } from './providers'

describe('mood target persistence boundary', () => {
  it('rounds and clamps dial-derived values before storage', () => {
    const target = normaliseMoodTarget(vector({ peaceful: 48.75, happy: 61.5, energised: 103.2 }))
    expect(target.peaceful).toBe(49)
    expect(target.happy).toBe(62)
    expect(target.energised).toBe(100)
  })

  it('replaces a non-finite value with a neutral safe default', () => {
    const target = normaliseMoodTarget(vector({ dramatic: Number.NaN }))
    expect(target.dramatic).toBe(50)
  })
})
