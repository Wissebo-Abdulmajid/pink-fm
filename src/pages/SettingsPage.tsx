import { useState } from 'react'
import { BrainCircuit, Download, Info, LockKeyhole, RotateCcw, Trash2, Volume2 } from 'lucide-react'
import { useExperience } from '../app/providers'
import { Modal } from '../components/common/Modal'
import type { StreamingService } from '../config/schemas'
import { removeEnhancedModelCache } from '../features/bot/semantic/enhancedMode'

export default function SettingsPage() {
  const {
    profile,
    profileSource,
    listener,
    setStreamingService,
    setSoundEffects,
    setReducedMotion,
    setHighContrast,
    setSoundVolume,
    setSemanticMode,
    resetPreferences,
  } = useExperience()
  const [confirmReset, setConfirmReset] = useState(false)
  const [removingSemantic, setRemovingSemantic] = useState(false)
  const [semanticRemovalStatus, setSemanticRemovalStatus] = useState('')

  const removeSemanticData = async () => {
    setRemovingSemantic(true)
    setSemanticRemovalStatus('')
    try {
      const result = await removeEnhancedModelCache(
        profile.gift.assistant.semantic.modelId,
        profile.gift.assistant.semantic.modelRevision,
      )
      setSemanticMode('ask')
      setSemanticRemovalStatus(
        result.supported
          ? result.deleted > 0
            ? `Removed ${result.deleted} cached enhanced-understanding files. Favourites and listening history were not changed.`
            : 'No matching enhanced-understanding files were found. Favourites and listening history were not changed.'
          : 'This browser does not expose model Cache Storage. Its normal HTTP cache remains under browser control.',
      )
    } catch {
      setSemanticRemovalStatus('The model cache could not be changed. Your Pink FM preferences were not affected.')
    } finally {
      setRemovingSemantic(false)
    }
  }

  return (
    <main className="page page--narrow settings-page" id="main-content">
      <p className="eyebrow">Receiver controls</p>
      <h1 className="page-heading">{profile.messages.settings.heading}</h1>
      <p className="page-intro">Adjust the experience on this device. None of these choices require an account.</p>

      <section className="settings-section panel" aria-labelledby="playback-settings-heading">
        <h2 id="playback-settings-heading">Listening destination</h2>
        <div className="field">
          <label htmlFor="streaming-service">Preferred streaming service</label>
          <select
            className="select"
            id="streaming-service"
            value={listener.selectedStreamingService}
            onChange={(event) => setStreamingService(event.target.value as StreamingService)}
          >
            <option value="spotify">Spotify</option>
            <option value="youtube">YouTube</option>
            <option value="appleMusic">Apple Music</option>
          </select>
          <small>Pink FM uses a different available official link when your preferred service is not configured.</small>
        </div>
      </section>

      {profile.gift.features.wisseBot && profile.gift.features.semanticUnderstanding && (
        <section className="settings-section panel" aria-labelledby="understanding-settings-heading">
          <span className="settings-section__icon" aria-hidden="true"><BrainCircuit /></span>
          <div className="field">
            <label htmlFor="semantic-mode" id="understanding-settings-heading">WisseBot understanding</label>
            <select
              className="select"
              id="semantic-mode"
              value={listener.semanticMode}
              onChange={(event) => setSemanticMode(event.target.value as typeof listener.semanticMode)}
            >
              <option value="ask">Offer enhanced mode each session</option>
              <option value="enhanced">Prefer enhanced mode (still ask first)</option>
              <option value="lightweight">Instant understanding only</option>
            </select>
            <small>
              Enhanced mode downloads about {profile.gift.assistant.semantic.estimatedDownloadMb} MB on first use and runs in a background worker. Pink FM always asks before starting it. Instant mode never starts the model; recommendations remain fully available.
            </small>
            <button
              className="text-button settings-model-remove"
              type="button"
              onClick={() => void removeSemanticData()}
              disabled={removingSemantic}
            >
              <Trash2 size={15} aria-hidden="true" />
              {removingSemantic ? 'Removing enhanced data…' : 'Remove enhanced understanding data'}
            </button>
            <small>
              Removes matching model files from Cache Storage only. Browser cache eviction is not guaranteed, and this never clears favourites, history or other preferences.
            </small>
            {semanticRemovalStatus && <p className="settings-inline-status" role="status">{semanticRemovalStatus}</p>}
          </div>
        </section>
      )}

      <section className="settings-section panel" aria-labelledby="comfort-settings-heading">
        <h2 id="comfort-settings-heading">Sound and comfort</h2>
        <label className="switch-row">
          <span><strong>Interface sound effects</strong><small>Original, quiet radio tones only</small></span>
          <input className="switch" type="checkbox" checked={listener.soundEffects} onChange={(event) => setSoundEffects(event.target.checked)} />
        </label>
        <div className="settings-volume field">
          <label htmlFor="settings-volume"><Volume2 size={17} aria-hidden="true" /> Interface tone volume</label>
          <input id="settings-volume" type="range" min="0" max="100" value={listener.soundVolume} onChange={(event) => setSoundVolume(Number(event.target.value))} disabled={!listener.soundEffects} />
          <output htmlFor="settings-volume">{listener.soundVolume}% — does not control music playback</output>
        </div>
        <label className="switch-row">
          <span><strong>Reduce motion</strong><small>Shortens or removes decorative movement</small></span>
          <input className="switch" type="checkbox" checked={listener.reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
        </label>
        <label className="switch-row">
          <span><strong>High contrast</strong><small>Strengthens text and control contrast</small></span>
          <input className="switch" type="checkbox" checked={listener.highContrast} onChange={(event) => setHighContrast(event.target.checked)} />
        </label>
      </section>

      {profile.gift.features.installPrompt && (
        <section className="settings-section panel" aria-labelledby="install-heading">
          <span className="settings-section__icon" aria-hidden="true"><Download /></span>
          <div>
            <h2 id="install-heading">{profile.messages.settings.installHeading}</h2>
            <p>{profile.messages.settings.installInstructions}</p>
          </div>
        </section>
      )}

      <section className="settings-section panel" aria-labelledby="privacy-heading">
        <span className="settings-section__icon" aria-hidden="true"><LockKeyhole /></span>
        <div>
          <h2 id="privacy-heading">{profile.messages.settings.privacyHeading}</h2>
          <p>{profile.gift.privacyNotice} Pink FM stores favourites, feedback, settings and recommendation history in this browser’s local storage. Clearing site data also removes it.</p>
          <p>Static gift files and public URLs are not private authentication. Do not add sensitive messages to a public deployment.</p>
        </div>
      </section>

      <section className="settings-section panel" aria-labelledby="profile-info-heading">
        <span className="settings-section__icon" aria-hidden="true"><Info /></span>
        <div>
          <h2 id="profile-info-heading">Content profile</h2>
          <dl className="profile-details">
            <div><dt>Station</dt><dd>{profile.gift.station.name}</dd></div>
            <div><dt>Artist</dt><dd>{profile.gift.artist.name}</dd></div>
            <div><dt>Tracks</dt><dd>{profile.tracks.tracks.filter((track) => track.active).length} active</dd></div>
            <div><dt>Reviewed</dt><dd>{profile.tracks.tracks.filter((track) => track.active && track.curationStatus === 'reviewed').length} recommendation-ready</dd></div>
            <div><dt>Collections</dt><dd>{profile.collections.collections.filter((collection) => collection.active).length} active</dd></div>
            <div><dt>Profile source</dt><dd>{profileSource === 'cache' ? 'Cached offline copy' : 'Latest network copy'}</dd></div>
            <div><dt>Schema</dt><dd>Version {profile.gift.schemaVersion}</dd></div>
          </dl>
        </div>
      </section>

      <button className="button button--danger settings-reset" type="button" onClick={() => setConfirmReset(true)}>
        <RotateCcw size={18} aria-hidden="true" /> Clear all preferences on this device
      </button>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Clear local preferences?">
        <p>This removes loved tracks, feedback, history, saved presets and settings for this gift profile from this browser. Profile content is not affected.</p>
        <div className="confirm-actions">
          <button className="button button--secondary" type="button" onClick={() => setConfirmReset(false)}>Keep my preferences</button>
          <button className="button button--danger" type="button" onClick={() => { resetPreferences(); setConfirmReset(false) }}>Clear local data</button>
        </div>
      </Modal>
    </main>
  )
}
