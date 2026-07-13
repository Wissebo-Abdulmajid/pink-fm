import type {
  ArtistPolicy,
  Collection,
  MoodPreset,
  MoodVector,
  Track,
  TrackVersionType,
} from '../../config/schemas.ts'
import type { RecommendationContext } from '../recommendations/engine.ts'
import type { SemanticInterpretationResult } from './semantic/semanticTypes.ts'

export type EvidenceSource =
  | 'exact-rule'
  | 'entity-match'
  | 'semantic-similarity'
  | 'previous-context'
  | 'user-preference'
  | 'default-assumption'

export type InterpretationEvidence = {
  source: EvidenceSource
  concept: string
  value: string
  confidence: number
  span?: string
}

export type StructuredMusicRequest = {
  requestedTrackId?: string
  requestedArtistIds?: string[]
  targetMoods: MoodVector
  excludedMoods: string[]
  energy?: {
    target?: number
    direction?: 'higher' | 'lower'
  }
  intensity?: {
    target?: number
    direction?: 'higher' | 'lower'
  }
  familiarity?: 'familiar' | 'balanced' | 'discovery'
  era?: {
    preferred?: string[]
    excluded?: string[]
  }
  collectionIds?: string[]
  preferredAlbumIds?: string[]
  activities?: string[]
  contexts?: string[]
  versionTypes?: TrackVersionType[]
  exclusions: {
    trackIds: string[]
    albumIds: string[]
    artistIds: string[]
  }
  relationToPrevious?:
    | 'similar'
    | 'different'
    | 'more-energetic'
    | 'less-energetic'
    | 'more-intense'
    | 'less-intense'
  surprise: boolean
  confidence: number
  evidence: InterpretationEvidence[]
}

export type ClarificationChoice = {
  id: string
  label: string
  message: string
}

export type ClarificationState = {
  question: string
  reason: 'ambiguous' | 'low-confidence' | 'entity-confirmation' | 'conflict'
  choices: ClarificationChoice[]
}

export type ConversationMessage = {
  role: 'listener' | 'assistant'
  text: string
  createdAt?: number
}

export type ConversationContext = {
  messages: ConversationMessage[]
  lastInterpretations: StructuredMusicRequest[]
  lastRecommendations: string[]
  currentTarget: StructuredMusicRequest | MoodVector | null
  rejectedTrackIds: string[]
  activeArtistPolicy: ArtistPolicy | null
  pendingClarification: ClarificationState | null
  previousRecommendedTrack: Track | null
  mostRecentRefinement: string | null
}

export type AssistantInterpretationKind =
  | 'recommendation'
  | 'clarification'
  | 'unsupported'
  | 'conflict'

export type AssistantInterpretation = {
  kind: AssistantInterpretationKind
  request: StructuredMusicRequest | null
  target: MoodVector | null
  constraints: RecommendationContext
  summary: string
  matchedTerms: string[]
  refinement: string | null
  confidence: number
  evidence: InterpretationEvidence[]
  clarification: ClarificationState | null
  mode: 'deterministic' | 'hybrid'
  resetContext?: boolean
}

export type BotCatalogue = {
  tracks: Track[]
  collections: Collection[]
  moods: MoodPreset[]
  artistPolicy: ArtistPolicy
  primaryArtistName: string
  primaryArtistId: string
}

export interface SemanticInterpreter {
  interpret(message: string): Promise<SemanticInterpretationResult>
}

export interface MusicAssistantProvider {
  interpret(
    message: string,
    context: ConversationContext,
  ): Promise<AssistantInterpretation>
}
