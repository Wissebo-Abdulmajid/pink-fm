import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import {
  Bot,
  BrainCircuit,
  CircleHelp,
  CircleX,
  Gauge,
  Info,
  Radio,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  WifiOff,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useExperience } from '../../app/providers'
import { Modal } from '../../components/common/Modal'
import { profileRootUrl } from '../profiles/profile-loader'
import { HybridWisseBotProvider } from './hybrid-provider'
import { buildGroundedRecommendationResponse, describeStructuredRequest } from './responseBuilder'
import { SemanticLiteInterpreter } from './semantic-lite/semanticLite'
import {
  inspectEnhancedModelCache,
  readConnectionSignals,
  type ConnectionSignals,
  type EnhancedCacheStatus,
} from './semantic/enhancedMode'
import { SemanticClient } from './semantic/semanticClient'
import type {
  ClarificationState,
  ConversationContext,
  ConversationMessage,
  StructuredMusicRequest,
} from './types'

const quickRefinements = [
  'More energetic',
  'Calmer',
  'More romantic',
  'Less intense',
  'More nostalgic',
  'Same mood, different era',
  'A deeper cut',
  'Surprise me',
  'Another choice',
]

const boundedMessages = (messages: ConversationMessage[]) => messages.slice(-24)

const useConnectionSignals = () => {
  const [signals, setSignals] = useState<ConnectionSignals>(() => readConnectionSignals())
  useEffect(() => {
    const update = () => setSignals(readConnectionSignals())
    const connection = (navigator as Navigator & {
      connection?: EventTarget
      mozConnection?: EventTarget
      webkitConnection?: EventTarget
    }).connection ?? (navigator as Navigator & { mozConnection?: EventTarget }).mozConnection ??
      (navigator as Navigator & { webkitConnection?: EventTarget }).webkitConnection
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    connection?.addEventListener('change', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      connection?.removeEventListener('change', update)
    }
  }, [])
  return signals
}

export function WisseBotDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const {
    slug,
    profile,
    listener,
    currentTarget,
    recommendation,
    tuneTarget,
    setSemanticMode,
  } = useExperience()
  const navigate = useNavigate()
  const connection = useConnectionSignals()
  const catalogue = useMemo(
    () => ({
      tracks: profile.tracks.tracks,
      collections: profile.collections.collections,
      moods: profile.moods.moods,
      artistPolicy: profile.gift.artistPolicy,
      primaryArtistName: profile.gift.artist.name,
      primaryArtistId: profile.gift.artist.slug,
    }),
    [profile],
  )
  const semanticClient = useMemo(
    () =>
      new SemanticClient({
        modelId: profile.gift.assistant.semantic.modelId,
        modelRevision: profile.gift.assistant.semantic.modelRevision,
        profileRootUrl: profileRootUrl(slug),
        tracks: profile.tracks.tracks,
        collections: profile.collections.collections,
      }),
    [profile.collections.collections, profile.gift.assistant.semantic.modelId, profile.gift.assistant.semantic.modelRevision, profile.tracks.tracks, slug],
  )
  const semantic = useSyncExternalStore(
    semanticClient.subscribe,
    semanticClient.getSnapshot,
    semanticClient.getSnapshot,
  )
  const instantInterpreter = useMemo(
    () => new SemanticLiteInterpreter(catalogue.tracks, catalogue.collections),
    [catalogue.collections, catalogue.tracks],
  )
  const provider = useMemo(
    () => new HybridWisseBotProvider(catalogue, instantInterpreter),
    [catalogue, instantInterpreter],
  )
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ConversationMessage[]>([
    { role: 'assistant', text: profile.messages.bot.greeting },
  ])
  const [lastInterpretations, setLastInterpretations] = useState<StructuredMusicRequest[]>([])
  const [lastRecommendations, setLastRecommendations] = useState<string[]>([])
  const [rejectedTrackIds, setRejectedTrackIds] = useState<string[]>([])
  const [currentRequest, setCurrentRequest] = useState<StructuredMusicRequest | null>(null)
  const [pendingClarification, setPendingClarification] = useState<ClarificationState | null>(null)
  const [mostRecentRefinement, setMostRecentRefinement] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [semanticActivated, setSemanticActivated] = useState(false)
  const [constrainedConfirmed, setConstrainedConfirmed] = useState(false)
  const [cacheStatus, setCacheStatus] = useState<EnhancedCacheStatus | null>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => semanticClient.dispose(), [semanticClient])

  useEffect(() => {
    provider.setSemanticInterpreter(
      semanticActivated && semantic.state === 'ready' ? semanticClient : instantInterpreter,
    )
  }, [instantInterpreter, provider, semantic.state, semanticActivated, semanticClient])

  useEffect(() => {
    if (!open || !profile.gift.assistant.semantic.enabled) return
    let active = true
    void inspectEnhancedModelCache(
      profile.gift.assistant.semantic.modelId,
      profile.gift.assistant.semantic.modelRevision,
    ).then((status) => {
      if (active) setCacheStatus(status)
    })
    return () => {
      active = false
    }
  }, [open, profile.gift.assistant.semantic.enabled, profile.gift.assistant.semantic.modelId, profile.gift.assistant.semantic.modelRevision])

  useEffect(() => {
    if (typeof messageEndRef.current?.scrollIntoView === 'function') {
      messageEndRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [messages])

  const resetConversation = () => {
    setMessages([
      { role: 'assistant', text: 'Fresh frequency. Tell me how you want the music to feel.' },
    ])
    setLastInterpretations([])
    setLastRecommendations([])
    setRejectedTrackIds([])
    setCurrentRequest(null)
    setPendingClarification(null)
    setMostRecentRefinement(null)
    setInput('')
  }

  const appendAssistant = (text: string) => {
    setMessages((current) => boundedMessages([
      ...current,
      { role: 'assistant', text },
    ]))
  }

  const interpret = async (message: string) => {
    const trimmed = message.trim()
    if (!trimmed || busy) return
    setBusy(true)
    const listenerMessage: ConversationMessage = {
      role: 'listener',
      text: trimmed,
    }
    const nextMessages = boundedMessages([...messages, listenerMessage])
    setMessages(nextMessages)

    const context: ConversationContext = {
      currentTarget: currentRequest ?? currentTarget,
      previousRecommendedTrack: recommendation?.track ?? null,
      mostRecentRefinement,
      messages: nextMessages.slice(-6),
      lastInterpretations: lastInterpretations.slice(-6),
      lastRecommendations: lastRecommendations.slice(-12),
      rejectedTrackIds,
      activeArtistPolicy: profile.gift.artistPolicy,
      pendingClarification,
    }
    try {
      const interpretation = await provider.interpret(trimmed, context)
      if (interpretation.resetContext) {
        resetConversation()
        return
      }
      if (interpretation.kind !== 'recommendation' || !interpretation.target || !interpretation.request) {
        setPendingClarification(interpretation.clarification)
        appendAssistant(interpretation.summary)
        return
      }

      const sessionTrackIds = [...new Set([
        ...lastRecommendations,
        ...interpretation.request.exclusions.trackIds,
      ])]
      const result = tuneTarget(interpretation.target, {
        stationName: `${profile.gift.assistant.name} Mix`,
        frequency: 'WB.1',
        moodId: 'wissebot',
        context: {
          ...interpretation.constraints,
          sessionTrackIds,
          artistPolicy: profile.gift.artistPolicy,
        },
      })
      appendAssistant(buildGroundedRecommendationResponse(interpretation, result))
      setCurrentRequest(interpretation.request)
      setLastInterpretations((current) => [...current, interpretation.request as StructuredMusicRequest].slice(-6))
      setLastRecommendations((current) => [...current, result.track.id].slice(-12))
      setRejectedTrackIds(interpretation.request.exclusions.trackIds.slice(-20))
      setPendingClarification(null)
      setMostRecentRefinement(interpretation.refinement)
    } catch (error) {
      appendAssistant(
        error instanceof Error && /No active tracks/.test(error.message)
          ? 'That combination leaves no available catalogue track. Try removing one exclusion or choosing another era.'
          : 'The signal slipped for a moment. Lightweight understanding is still available—please try that request once more.',
      )
    } finally {
      setBusy(false)
      setInput('')
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void interpret(input)
  }

  const allowSemantic = async () => {
    if (!cacheStatus?.cached && !connection.online) return
    if (!cacheStatus?.cached && connection.constrained && !constrainedConfirmed) {
      setConstrainedConfirmed(true)
      return
    }
    setSemanticMode('enhanced')
    setSemanticActivated(true)
    try {
      await semanticClient.enable()
    } catch {
      // The status panel exposes the failure while lightweight parsing remains available.
    }
  }

  const useLightweight = () => {
    setSemanticMode('lightweight')
    semanticClient.useLightweightMode()
    setSemanticActivated(false)
    setConstrainedConfirmed(false)
    provider.setSemanticInterpreter(instantInterpreter)
  }

  const cancelSemantic = () => {
    semanticClient.cancel()
    setSemanticActivated(false)
    setConstrainedConfirmed(false)
    setSemanticMode('ask')
    provider.setSemanticInterpreter(instantInterpreter)
  }

  const understood = currentRequest ? describeStructuredRequest(currentRequest) : null
  const showConsent =
    listener.semanticMode !== 'lightweight' &&
    !semanticActivated &&
    profile.gift.features.semanticUnderstanding &&
    profile.gift.assistant.semantic.enabled
  const progressPercentage = semantic.progress === null
    ? null
    : Math.max(0, Math.min(100, Math.round(semantic.progress * 100)))

  return (
    <Modal open={open} onClose={onClose} title={profile.gift.assistant.name}>
      <div className="bot-identity">
        <span className="bot-identity__light" aria-hidden="true" />
        <Bot size={20} aria-hidden="true" />
        <span>
          <strong>{profile.gift.assistant.subtitle}</strong>
          <small>Catalogue-grounded radio guide · processed on this device</small>
        </span>
      </div>

      {!connection.online && (
        <div className="bot-offline" role="status">
          <WifiOff size={16} aria-hidden="true" /> Offline: instant requests and cached recommendations remain available.
        </div>
      )}

      {showConsent && (
        <section className="semantic-consent" aria-labelledby="semantic-consent-title">
          <BrainCircuit size={21} aria-hidden="true" />
          <div>
            <h3 id="semantic-consent-title">Enhanced local understanding</h3>
            <p>
              Enhanced understanding helps WisseBot interpret more indirect and unusual requests. It requires a one-time download of approximately{' '}
              {profile.gift.assistant.semantic.estimatedDownloadMb} MB. Pink FM remains fully usable without it.
            </p>
            <p className="semantic-consent__network">
              {cacheStatus?.cached
                ? 'The selected model appears to be cached in this browser.'
                : connection.online
                  ? connection.effectiveType
                    ? `Connection signal: ${connection.effectiveType}${connection.saveData ? ' with data saver enabled' : ''}.`
                    : 'Your browser does not expose connection-quality details; you remain in control of the download.'
                  : 'The model is not available offline on this device.'}
            </p>
            {constrainedConfirmed && !cacheStatus?.cached && (
              <p className="semantic-consent__warning" role="alert">
                Data saver or a slow connection is active. Download only if you are comfortable using approximately{' '}
                {profile.gift.assistant.semantic.estimatedDownloadMb} MB now.
              </p>
            )}
            <div className="semantic-consent__actions">
              <button
                className="button button--small"
                type="button"
                onClick={() => void allowSemantic()}
                disabled={!connection.online && !cacheStatus?.cached}
              >
                {cacheStatus?.cached
                  ? 'Start enhanced understanding'
                  : constrainedConfirmed
                    ? 'Download on this connection'
                    : 'Download enhanced understanding'}
              </button>
              <button className="text-button" type="button" onClick={useLightweight}>
                Continue with instant mode
              </button>
            </div>
          </div>
        </section>
      )}

      {!showConsent && listener.semanticMode !== 'lightweight' && (
        <div className={`semantic-status semantic-status--${semantic.state}`} role="status" aria-live="polite">
          {semantic.state === 'ready' ? <BrainCircuit size={16} aria-hidden="true" /> : <Gauge size={16} aria-hidden="true" />}
          <span>
            <strong>{semantic.message}</strong>
            {semantic.state === 'ready' && (
              <small>
                {semantic.device?.toUpperCase()}
                {semantic.modelLoadMs !== null ? ` · ready in ${(semantic.modelLoadMs / 1000).toFixed(1)}s` : ''}
                {semantic.lastInferenceMs !== null ? ` · last request ${Math.round(semantic.lastInferenceMs)}ms` : ''}
                {' · requests stay in this browser'}
              </small>
            )}
          </span>
          {progressPercentage !== null && semantic.state !== 'ready' && (
            <progress value={progressPercentage} max="100" aria-label="Semantic model loading progress">
              {progressPercentage}%
            </progress>
          )}
          {(semantic.state === 'unavailable' || semantic.state === 'stale-index') && (
            <button className="text-button" type="button" onClick={useLightweight}>Use instant mode</button>
          )}
          {(semantic.state === 'downloading' || semantic.state === 'initialising') && (
            <button className="text-button" type="button" onClick={cancelSemantic}>
              <CircleX size={14} aria-hidden="true" /> Cancel
            </button>
          )}
        </div>
      )}

      {listener.semanticMode === 'lightweight' && !semanticActivated && (
        <div className="semantic-status semantic-status--lightweight" role="status">
          <Gauge size={16} aria-hidden="true" />
          <span>
            <strong>Instant understanding is ready.</strong>
            <small>Multilingual rules and catalogue-aware fuzzy retrieval · no model download</small>
          </span>
          {profile.gift.assistant.semantic.enabled && (
            <button className="text-button" type="button" onClick={() => setSemanticMode('ask')}>
              View enhanced option
            </button>
          )}
        </div>
      )}

      <div className="bot-toolbar">
        <span><Info size={14} aria-hidden="true" /> Instant understanding is always ready; enhanced requests also stay in this browser.</span>
        <button className="text-button" type="button" onClick={resetConversation}>
          <RefreshCw size={14} aria-hidden="true" /> Start a new request
        </button>
      </div>

      <div className="bot-messages" aria-live="polite" aria-label="Conversation">
        {messages.map((message, index) => (
          <div
            className={`bot-message bot-message--${message.role}`}
            key={`${message.role}-${message.createdAt ?? index}-${index}`}
          >
            {message.text}
          </div>
        ))}
        {busy && (
          <div className="bot-message bot-message--assistant bot-message--thinking">
            <Sparkles size={15} className="bot-thinking" aria-hidden="true" /> Tuning the catalogue signal…
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      {pendingClarification && (
        <div className="bot-clarification" aria-label="Clarification choices">
          {pendingClarification.choices.map((choice) => (
            <button
              type="button"
              className="bot-chip"
              key={choice.id}
              onClick={() => void interpret(choice.message)}
              disabled={busy}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}

      {recommendation && messages.at(-1)?.role === 'assistant' && (
        <div className="bot-result">
          <span><Radio size={17} aria-hidden="true" /> Current recommendation</span>
          <strong>{recommendation.track.title}</strong>
          <small>
            {recommendation.track.artist} · {recommendation.matchPercentage}% match
            {recommendation.track.primaryArtistId !== profile.gift.artist.slug ? ' · guest artist' : ''}
          </small>
          <div className="bot-result__details">
            {recommendation.track.album && <span>{recommendation.track.album}</span>}
            <span>{recommendation.track.curationStatus === 'reviewed' ? 'Editorially reviewed' : 'Metadata verified'}</span>
          </div>
          <div className="bot-result__actions">
            <button
              className="button button--secondary button--small"
              type="button"
              onClick={() => {
                onClose()
                void navigate(`/g/${slug}/radio`)
              }}
            >
              Open the radio
            </button>
          </div>
          {understood && (
            <div className="bot-evidence">
              <details>
                <summary><Search size={15} aria-hidden="true" /> What did you understand?</summary>
                <dl>
                  <div><dt>Strongest moods</dt><dd>{understood.strongestMoods.map((item) => `${item.mood} ${item.strength}%`).join(', ')}</dd></div>
                  {understood.activities.length > 0 && <div><dt>Activity</dt><dd>{understood.activities.join(', ')}</dd></div>}
                  {understood.versions.length > 0 && <div><dt>Version</dt><dd>{understood.versions.join(', ')}</dd></div>}
                  <div><dt>Confidence</dt><dd>{Math.round(understood.confidence * 100)}%</dd></div>
                </dl>
              </details>
              <details>
                <summary><CircleHelp size={15} aria-hidden="true" /> Why this recommendation?</summary>
                <p>{recommendation.primaryReasons.join(' ')}</p>
              </details>
            </div>
          )}
        </div>
      )}

      <div className="bot-suggestions" aria-label="Suggested prompts">
        {messages.length <= 2 && profile.messages.bot.suggestions.map((suggestion) => (
          <button type="button" className="bot-chip" key={suggestion} onClick={() => void interpret(suggestion)} disabled={busy}>
            {suggestion}
          </button>
        ))}
      </div>

      <div className="bot-chips" aria-label="Quick refinements">
        {quickRefinements.map((refinement) => (
          <button
            type="button"
            className="bot-chip"
            key={refinement}
            onClick={() => void interpret(refinement)}
            disabled={busy}
          >
            {refinement}
          </button>
        ))}
      </div>

      <form className="bot-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="wissebot-message">Message {profile.gift.assistant.name}</label>
        <textarea
          className="textarea"
          id="wissebot-message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={profile.messages.bot.placeholder}
          rows={2}
          maxLength={500}
        />
        <button className="button" type="submit" disabled={busy || !input.trim()}>
          {busy ? <Sparkles size={18} className="bot-thinking" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
          {profile.messages.bot.send}
        </button>
      </form>
    </Modal>
  )
}
