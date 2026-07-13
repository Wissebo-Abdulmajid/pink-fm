import { RefreshCw } from 'lucide-react'
import { useServiceWorker } from '../../hooks/useServiceWorker'

export function UpdateAvailable() {
  const { updateAvailable, applyUpdate } = useServiceWorker()
  if (!updateAvailable) return null
  return (
    <div className="update-banner" role="status">
      <span>A fresh Pink FM signal is ready.</span>
      <button type="button" onClick={applyUpdate}><RefreshCw size={16} aria-hidden="true" /> Update now</button>
    </div>
  )
}
