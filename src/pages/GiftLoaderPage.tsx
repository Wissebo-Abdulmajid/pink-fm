import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { ExperienceProvider } from '../app/providers'
import { LoadingTuner } from '../components/feedback/LoadingTuner'
import { ProfileError } from '../components/feedback/ProfileError'
import {
  loadProfile,
  ProfileLoadError,
  type ProfileLoadErrorKind,
} from '../features/profiles/profile-loader'
import type { ProfileBundle } from '../config/schemas'

type LoadState =
  | { status: 'loading'; slug: string; messageIndex: number }
  | { status: 'ready'; slug: string; profile: ProfileBundle; source: 'network' | 'cache' }
  | { status: 'error'; slug: string; error: ProfileLoadError }

const fallbackMessages = ['Warming the valves…', 'Finding the clearest signal…', 'Setting the mood dial…']

export function GiftLoaderPage() {
  const { giftSlug = '' } = useParams()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading', slug: giftSlug, messageIndex: 0 })

  useEffect(() => {
    const controller = new AbortController()
    const interval = window.setInterval(() => {
      setState((current) =>
        current.status === 'loading' && current.slug === giftSlug
          ? { ...current, messageIndex: (current.messageIndex + 1) % fallbackMessages.length }
          : current,
      )
    }, 850)

    void loadProfile(giftSlug, controller.signal)
      .then(({ profile, source }) => setState({ status: 'ready', slug: giftSlug, profile, source }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const controlled =
          error instanceof ProfileLoadError
            ? error
            : new ProfileLoadError(
                'network' satisfies ProfileLoadErrorKind,
                error instanceof Error ? error.message : 'This profile could not be loaded.',
              )
        setState({ status: 'error', slug: giftSlug, error: controlled })
      })
      .finally(() => window.clearInterval(interval))

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [attempt, giftSlug])

  if (state.slug !== giftSlug || state.status === 'loading') {
    return (
      <LoadingTuner
        heading="Tuning your frequency"
        message={fallbackMessages[state.status === 'loading' ? state.messageIndex : 0] ?? fallbackMessages[0] ?? 'Tuning…'}
      />
    )
  }
  if (state.status === 'error') {
    return <ProfileError error={state.error} onRetry={() => {
      setState({ status: 'loading', slug: giftSlug, messageIndex: 0 })
      setAttempt((value) => value + 1)
    }} />
  }
  return (
    <ExperienceProvider slug={giftSlug} profile={state.profile} profileSource={state.source}>
      <Outlet />
    </ExperienceProvider>
  )
}
