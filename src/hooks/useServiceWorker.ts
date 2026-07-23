import { useCallback, useEffect, useRef, useState } from 'react'
import { PLAYBACK_ACTIVITY_EVENT, playbackActivityFromEvent } from '../features/player/playback-activity'

export const chooseUpdateAction = ({
  hasWaitingWorker,
  controllerRefreshReady,
  playbackActive,
}: {
  hasWaitingWorker: boolean
  controllerRefreshReady: boolean
  playbackActive: boolean
}) => {
  if (playbackActive) return 'wait-for-pause' as const
  if (hasWaitingWorker) return 'activate-worker' as const
  if (controllerRefreshReady) return 'reload' as const
  return 'none' as const
}

export const useServiceWorker = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [controllerRefreshReady, setControllerRefreshReady] = useState(false)
  const [playbackActive, setPlaybackActive] = useState(false)
  const playbackActiveRef = useRef(false)

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let hadController = Boolean(navigator.serviceWorker.controller)
    const onPlaybackActivity = (event: Event) => {
      const playing = playbackActivityFromEvent(event)
      playbackActiveRef.current = playing
      setPlaybackActive(playing)
    }
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true
        return
      }
      setWaitingWorker(null)
      if (playbackActiveRef.current) setControllerRefreshReady(true)
      else window.location.reload()
    }
    window.addEventListener(PLAYBACK_ACTIVITY_EVENT, onPlaybackActivity)
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((registered) => {
        if (registered.waiting) setWaitingWorker(registered.waiting)
        registered.addEventListener('updatefound', () => {
          const installing = registered.installing
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installing)
            }
          })
        })
      })
      .catch(() => {
        // The application remains fully usable when service worker registration is unavailable.
      })

    return () => {
      window.removeEventListener(PLAYBACK_ACTIVITY_EVENT, onPlaybackActivity)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    const action = chooseUpdateAction({
      hasWaitingWorker: Boolean(waitingWorker),
      controllerRefreshReady,
      playbackActive,
    })
    if (action === 'activate-worker') waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
    if (action === 'reload') window.location.reload()
  }, [controllerRefreshReady, playbackActive, waitingWorker])

  return {
    updateAvailable: Boolean(waitingWorker) || controllerRefreshReady,
    playbackActive,
    applyUpdate,
  }
}
