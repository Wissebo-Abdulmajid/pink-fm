import { chooseUpdateAction } from './useServiceWorker'

describe('service worker update behaviour', () => {
  it('waits while music is active', () => {
    expect(chooseUpdateAction({ hasWaitingWorker: true, controllerRefreshReady: false, playbackActive: true }))
      .toBe('wait-for-pause')
  })

  it('activates a waiting worker only after playback is clear', () => {
    expect(chooseUpdateAction({ hasWaitingWorker: true, controllerRefreshReady: false, playbackActive: false }))
      .toBe('activate-worker')
  })

  it('offers one explicit reload after a controller changed during playback', () => {
    expect(chooseUpdateAction({ hasWaitingWorker: false, controllerRefreshReady: true, playbackActive: false }))
      .toBe('reload')
  })
})
