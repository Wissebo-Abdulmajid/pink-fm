import type {
  AssistantInterpretation,
  ConversationContext,
  MusicAssistantProvider,
} from './types'

export class SecureBackendAssistantProvider implements MusicAssistantProvider {
  async interpret(
    _message: string,
    _context: ConversationContext,
  ): Promise<AssistantInterpretation> {
    throw new Error(
      'The secure backend assistant is intentionally disabled. Pink FM makes no direct browser calls to an LLM API.',
    )
  }
}
