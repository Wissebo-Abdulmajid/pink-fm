import { RefreshCw } from 'lucide-react'
import { useServiceWorker } from '../../hooks/useServiceWorker'

export function UpdateAvailable() {
  const { updateAvailable, playbackActive, applyUpdate } = useServiceWorker()
  if (!updateAvailable) return null
  return (
    <div className="update-banner" role="region" aria-live="polite" aria-label="Pink FM update available">
      <span>
        A fresh Pink FM edition is ready.
        {playbackActive && <small> Pause the song before reloading.</small>}
      </span>
      <button type="button" onClick={applyUpdate} disabled={playbackActive}>
        <RefreshCw size={16} aria-hidden="true" /> Reload
      </button>
    </div>
  )
}
