import { ShieldCheck } from 'lucide-react'

export function PlaybackConsent({ onAllow, onExternalOnly }: { onAllow: () => void; onExternalOnly: () => void }) {
  return (
    <section className="playback-consent" aria-labelledby="playback-consent-heading">
      <ShieldCheck size={22} aria-hidden="true" />
      <div>
        <h3 id="playback-consent-heading">Allow an embedded music player?</h3>
        <p>Playing music inside Pink FM loads the selected streaming provider. The provider may receive your IP address and use its own cookies.</p>
        <div className="playback-consent__actions">
          <button className="button" type="button" onClick={onAllow}>Allow embedded players</button>
          <button className="button button--secondary" type="button" onClick={onExternalOnly}>Continue with external links only</button>
        </div>
      </div>
    </section>
  )
}
