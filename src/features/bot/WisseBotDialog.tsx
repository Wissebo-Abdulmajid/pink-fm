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

const useOnlineState = () => {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
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
  const online = useOnlineState()
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
  const provider = useMemo(() => new HybridWisseBotProvider(catalogue), [catalogue])
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
  const messageEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => semanticClient.dispose(), [semanticClient])

  useEffect(() => {
    const enhanced =
      listener.semanticMode === 'enhanced' &&
      profile.gift.features.semanticUnderstanding &&
      profile.gift.assistant.semantic.enabled
    provider.setSemanticInterpreter(enhanced ? semanticClient : null)
    if (
      open &&
      enhanced &&
      ['idle', 'consent-required', 'lightweight'].includes(semantic.state)
    ) {
      void semanticClient.enable().catch(() => undefined)
    }
    if (listener.semanticMode === 'lightweight' && semantic.state !== 'lightweight') {
      semanticClient.useLightweightMode()
    }
  }, [listener.semanticMode, open, profile.gift.assistant.semantic.enabled, profile.gift.features.semanticUnderstanding, provider, semantic.state, semanticClient])

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
    setSemanticMode('enhanced')
    try {
      await semanticClient.enable()
    } catch {
      // The status panel exposes the failure while lightweight parsing remains available.
    }
  }

  const useLightweight = () => {
    setSemanticMode('lightweight')
    semanticClient.useLightweightMode()
    provider.setSemanticInterpreter(null)
  }

  const understood = currentRequest ? describeStructuredRequest(currentRequest) : null
  const showConsent =
    listener.semanticMode === 'ask' &&
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

      {!online && (
        <div className="bot-offline" role="status">
          <WifiOff size={16} aria-hidden="true" /> Offline: lightweight requests and cached recommendations remain available.
        </div>
      )}

      {showConsent && (
        <section className="semantic-consent" aria-labelledby="semantic-consent-title">
          <BrainCircuit size={21} aria-hidden="true" />
          <div>
            <h3 id="semantic-consent-title">Enhanced local understanding</h3>
            <p>
              Better paraphrase matching can run in a background worker. The first use downloads about{' '}
              {profile.gift.assistant.semantic.estimatedDownloadMb} MB; no message is sent to Pink FM or a chat service.
            </p>
            <div className="semantic-consent__actions">
              <button className="button button--small" type="button" onClick={() => void allowSemantic()}>
                Enable enhanced understanding
              </button>
              <button className="text-button" type="button" onClick={useLightweight}>
                Continue with lightweight mode
              </button>
            </div>
          </div>
        </section>
      )}

      {!showConsent && (
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
            <button className="text-button" type="button" onClick={useLightweight}>Use lightweight mode</button>
          )}
        </div>
      )}

      <div className="bot-toolbar">
        <span><Info size={14} aria-hidden="true" /> Enhanced understanding runs locally in your browser.</span>
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
