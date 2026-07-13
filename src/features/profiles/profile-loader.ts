import { ZodError } from 'zod'
import { PROFILE_FILES } from '../../config/constants'
import {
  collectionsFileSchema,
  emptyCollectionsFile,
  giftSchema,
  messagesSchema,
  moodsFileSchema,
  profileBundleSchema,
  tracksFileSchema,
  type ProfileBundle,
} from '../../config/schemas'

const CACHE_PREFIX = 'pink-fm:profile-cache:'

export type ProfileLoadErrorKind = 'missing' | 'invalid' | 'network'

export class ProfileLoadError extends Error {
  constructor(
    public readonly kind: ProfileLoadErrorKind,
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message)
    this.name = 'ProfileLoadError'
  }
}

const basePath = () => import.meta.env.BASE_URL.replace(/\/?$/, '/')

export const profileRootUrl = (slug: string) => `${basePath()}gifts/${slug}/`

export const profileAssetUrl = (slug: string, asset: string | null) =>
  asset ? `${profileRootUrl(slug)}${asset.replace(/^\/+/, '')}` : null

const describeZodError = (error: ZodError) =>
  error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'profile'
    return `${path}: ${issue.message}`
  })

const readCache = (slug: string): ProfileBundle | null => {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${slug}`)
    if (!cached) return null
    const result = profileBundleSchema.safeParse(JSON.parse(cached))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

const writeCache = (slug: string, profile: ProfileBundle) => {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify(profile))
  } catch {
    // Profile loading remains functional when storage is unavailable or full.
  }
}

const fetchJson = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, {
    ...(signal ? { signal } : {}),
    headers: { Accept: 'application/json' },
    cache: 'no-cache',
  })
  if (!response.ok) {
    throw new ProfileLoadError(
      response.status === 404 ? 'missing' : 'network',
      response.status === 404
        ? `Profile file not found: ${url}`
        : `Could not load ${url} (${response.status})`,
    )
  }
  try {
    return (await response.json()) as unknown
  } catch {
    throw new ProfileLoadError('invalid', `Profile file is not valid JSON: ${url}`)
  }
}

const fetchOptionalJson = async (
  url: string,
  fallback: unknown,
  signal?: AbortSignal,
) => {
  try {
    return await fetchJson(url, signal)
  } catch (error) {
    if (error instanceof ProfileLoadError && error.kind === 'missing') return fallback
    throw error
  }
}

export const loadProfile = async (
  slug: string,
  signal?: AbortSignal,
): Promise<{ profile: ProfileBundle; source: 'network' | 'cache' }> => {
  const root = profileRootUrl(slug)

  try {
    const [giftRaw, moodsRaw, tracksRaw, messagesRaw, collectionsRaw] =
      await Promise.all([
        ...PROFILE_FILES.map((file) => fetchJson(`${root}${file}`, signal)),
        fetchOptionalJson(`${root}collections.json`, emptyCollectionsFile, signal),
      ])

    const candidate = {
      gift: giftSchema.parse(giftRaw),
      moods: moodsFileSchema.parse(moodsRaw),
      tracks: tracksFileSchema.parse(tracksRaw),
      messages: messagesSchema.parse(messagesRaw),
      collections: collectionsFileSchema.parse(collectionsRaw),
    }
    const profile = profileBundleSchema.parse(candidate)
    if (profile.gift.slug !== slug) {
      throw new ProfileLoadError('invalid', 'Profile slug does not match its route.', [
        `gift.json declares "${profile.gift.slug}" but the requested route is "${slug}".`,
      ])
    }
    writeCache(slug, profile)
    return { profile, source: 'network' }
  } catch (error) {
    if (signal?.aborted) throw error
    const cached = readCache(slug)
    if (cached) return { profile: cached, source: 'cache' }

    if (error instanceof ProfileLoadError) throw error
    if (error instanceof ZodError) {
      throw new ProfileLoadError(
        'invalid',
        'The gift profile contains invalid configuration.',
        describeZodError(error),
      )
    }
    throw new ProfileLoadError(
      'network',
      error instanceof Error ? error.message : 'The profile could not be loaded.',
    )
  }
}

export const clearProfileCache = (slug: string) => {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${slug}`)
  } catch {
    // No action needed when storage is unavailable.
  }
}
