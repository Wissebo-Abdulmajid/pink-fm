import { useState } from 'react'
import { BrainCircuit, Download, LockKeyhole, RotateCcw, Trash2, Volume2 } from 'lucide-react'
import { useExperience } from '../app/providers'
import { Modal } from '../components/common/Modal'
import type { PlaybackPreference, StreamingService } from '../config/schemas'
import { removeEnhancedModelCache } from '../features/bot/semantic/enhancedMode'

export default function SettingsPage() {
  const {
    profile,
    listener,
    setStreamingService,
    setPlaybackPreference,
    setEmbedConsent,
    setAllowOfficialAlternateVersions,
    setAllowPreviewsWhenFullSongsUnavailable,
    setSoundEffects,
    setReducedMotion,
    setHighContrast,
    setSoundVolume,
    setSemanticMode,
    clearHistory,
    resetPreferences,
  } = useExperience()
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmClearHistory, setConfirmClearHistory] = useState(false)
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
            ? `Removed ${result.deleted} stored enhanced-understanding files. Favourites and listening history were not changed.`
            : 'No stored enhanced-understanding files were found. Favourites and listening history were not changed.'
          : 'This browser manages the optional enhanced data itself. Your Pink FM choices were not changed.',
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
        <h2 id="playback-settings-heading">Playback</h2>
        <div className="field">
          <label htmlFor="playback-preference">Playback preference</label>
          <select
            className="select"
            id="playback-preference"
            value={listener.playbackPreference}
            onChange={(event) => setPlaybackPreference(event.target.value as PlaybackPreference)}
          >
            <option value="automatic">Automatic</option>
            <option value="spotify">Prefer Spotify</option>
            <option value="youtube">Prefer YouTube</option>
            <option value="apple">Prefer Apple Music</option>
          </select>
          <small>Pink FM keeps the guaranteed full song first. Your preference is used when another listening option is needed.</small>
        </div>
        <label className="switch-row">
          <span>
            <strong>Allow official alternate versions</strong>
            <small>Use official live, acoustic or alternate full performances when the studio recording is unavailable.</small>
          </span>
          <input
            className="switch"
            type="checkbox"
            checked={listener.allowOfficialAlternateVersions}
            onChange={(event) => setAllowOfficialAlternateVersions(event.target.checked)}
          />
        </label>
        <label className="switch-row">
          <span>
            <strong>Allow previews when full songs are unavailable</strong>
            <small>Off by default. Short samples are never chosen while a full song is available.</small>
          </span>
          <input
            className="switch"
            type="checkbox"
            checked={listener.allowPreviewsWhenFullSongsUnavailable}
            onChange={(event) => setAllowPreviewsWhenFullSongsUnavailable(event.target.checked)}
          />
        </label>
        <div className="field">
          <label htmlFor="embed-consent">Embedded players</label>
          <select
            className="select"
            id="embed-consent"
            value={listener.embedConsent}
            onChange={(event) => setEmbedConsent(event.target.value as typeof listener.embedConsent)}
          >
            <option value="ask">Ask before first load</option>
            <option value="allowed">Allow embedded players</option>
            <option value="external-only">External links only</option>
          </select>
          <small>Embedded providers receive network requests and may use their own cookies. Pink FM does not add analytics.</small>
        </div>
        <div className="field">
          <label htmlFor="streaming-service">Preferred external destination</label>
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
          <small>This affects secondary “Open in…” links. Pink FM uses another official destination when needed.</small>
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
              Enhanced mode downloads about {profile.gift.assistant.semantic.estimatedDownloadMb} MB on first use and works on this device. Pink FM always asks before starting it. Instant mode needs no extra download, and recommendations remain fully available.
            </small>
            <button
              className="text-button settings-model-remove"
              type="button"
              onClick={() => void removeSemanticData()}
              disabled={removingSemantic}
            >
              <Trash2 size={15} aria-hidden="true" />
              {removingSemantic ? 'Removing enhanced data…' : 'Remove optional enhanced data'}
            </button>
            <small>
              Frees the matching optional files when the browser allows it. This never clears favourites, history or other preferences.
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
          <p>{profile.gift.privacyNotice} Favourites, feedback, settings and listening history stay in this browser. Pink FM has no account, advertising or analytics, and does not send this history to a server.</p>
          <p>Music services connect only when you allow an embedded player or choose an external listening link.</p>
        </div>
      </section>

      <button className="button button--secondary settings-reset" type="button" onClick={() => setConfirmClearHistory(true)}>
        <Trash2 size={18} aria-hidden="true" /> Clear listening history
      </button>

      <button className="button button--danger settings-reset" type="button" onClick={() => setConfirmReset(true)}>
        <RotateCcw size={18} aria-hidden="true" /> Reset Pink FM experience
      </button>

      <Modal open={confirmClearHistory} onClose={() => setConfirmClearHistory(false)} title="Clear listening history?">
        <p>This clears played-song history and listening counts for this Pink FM profile. Favourites, saved mixes and settings stay in place.</p>
        <div className="confirm-actions">
          <button className="button button--secondary" type="button" onClick={() => setConfirmClearHistory(false)}>Keep my history</button>
          <button className="button button--danger" type="button" onClick={() => { clearHistory(); setConfirmClearHistory(false) }}>Clear listening history</button>
        </div>
      </Modal>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset Pink FM experience?">
        <p>This removes favourites, feedback, listening history, saved mixes and settings for this Pink FM profile from this browser. The station and music catalogue remain safe and ready to use.</p>
        <div className="confirm-actions">
          <button className="button button--secondary" type="button" onClick={() => setConfirmReset(false)}>Keep my experience</button>
          <button className="button button--danger" type="button" onClick={() => { resetPreferences(); setConfirmReset(false) }}>Reset this experience</button>
        </div>
      </Modal>
    </main>
  )
}
