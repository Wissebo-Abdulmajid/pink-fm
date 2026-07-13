import { loadProfile } from './profile-loader'
import type { ProfileLoadError } from './profile-loader'

describe('profile loader', () => {
  it('turns missing required files into a controlled profile error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(loadProfile('missing')).rejects.toMatchObject({
      kind: 'missing',
    } satisfies Partial<ProfileLoadError>)
    vi.unstubAllGlobals()
  })
})
