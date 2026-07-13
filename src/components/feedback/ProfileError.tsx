import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { ProfileLoadError } from '../../features/profiles/profile-loader'

export function ProfileError({ error, onRetry }: { error: ProfileLoadError; onRetry: () => void }) {
  return (
    <main className="error-screen">
      <div className="error-screen__mark" aria-hidden="true"><AlertTriangle /></div>
      <p className="eyebrow">Signal unavailable</p>
      <h1>{error.kind === 'missing' ? 'Frequency not found' : 'This profile needs retuning'}</h1>
      <p>{error.message}</p>
      {error.details.length > 0 && (
        <div className="error-summary" role="alert" aria-labelledby="error-details-heading">
          <h2 id="error-details-heading">Configuration details</h2>
          <ul>
            {error.details.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        </div>
      )}
      <button className="button" type="button" onClick={onRetry}>
        <RotateCcw size={18} aria-hidden="true" /> Try again
      </button>
      <a className="button button--secondary" href="#/g/siti">Open the default station</a>
    </main>
  )
}
