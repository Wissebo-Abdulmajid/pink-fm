import { z } from 'zod'

export const moodDimensionKeys = [
  'peaceful',
  'happy',
  'romantic',
  'confident',
  'energised',
  'nostalgic',
  'elegant',
  'comforted',
  'dramatic',
] as const

export const streamingServiceSchema = z.enum(['youtube', 'spotify', 'appleMusic'])
export const artistPolicyModeSchema = z.enum([
  'primary-only',
  'primary-preferred',
  'multi-artist',
])
export const curationStatusSchema = z.enum([
  'reviewed',
  'verified-metadata',
  'provisional',
])
export const trackVersionTypeSchema = z.enum([
  'studio',
  'single',
  'live',
  'acoustic',
  'remix',
  'duet',
  'collaboration',
  'traditional',
  'festive',
  'children',
  'alternate',
])
export const languageCodeSchema = z.enum([
  'ms',
  'en',
  'id',
  'ar',
  'zh',
  'mixed',
  'other',
])

export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const slugListSchema = z.array(slugSchema).max(80)
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)')

export const artistPolicySchema = z.strictObject({
  mode: artistPolicyModeSchema,
  primaryArtistIds: slugListSchema.min(1),
  allowFeaturedArtists: z.boolean(),
  allowSecondaryCollection: z.boolean(),
  secondaryCollectionId: slugSchema.nullable(),
})

export const moodVectorSchema = z.strictObject(
  Object.fromEntries(
    moodDimensionKeys.map((key) => [key, z.number().int().min(0).max(100)]),
  ) as Record<(typeof moodDimensionKeys)[number], z.ZodNumber>,
)

const hexColourSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Expected a six-digit hexadecimal colour')

const optionalLocalAssetSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.includes('..') &&
      !/^[a-z][a-z\d+.-]*:/i.test(value),
    'Asset paths must be relative and must not contain a protocol or parent traversal',
  )
  .nullable()

const giftObjectSchema = z.strictObject({
  schemaVersion: z.literal(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale: z.string().min(2).max(35),
  station: z.strictObject({
    name: z.string().min(1).max(80),
    tagline: z.string().min(1).max(140),
    shortName: z.string().min(1).max(30),
    frequencyLabel: z.string().min(1).max(12),
    welcomeHeading: z.string().min(1).max(100),
    welcomeMessage: z.string().min(1).max(300),
  }),
  recipient: z.strictObject({
    displayName: z.string().max(80),
    privateGreeting: z.string().max(240),
    showName: z.boolean(),
  }),
  artist: z.strictObject({
    name: z.string().min(1).max(100),
    shortName: z.string().min(1).max(50),
    slug: slugSchema,
    image: optionalLocalAssetSchema,
    imageAlt: z.string().max(180),
  }),
  assistant: z.strictObject({
    name: z.string().min(1).max(60),
    subtitle: z.string().min(1).max(100),
    personality: z.string().min(1).max(240),
    avatar: optionalLocalAssetSchema,
    semantic: z
      .strictObject({
        enabled: z.boolean(),
        modelId: z.string().min(1).max(160),
        modelRevision: z.string().min(1).max(100),
        estimatedDownloadMb: z.number().positive().max(1000),
      })
      .default({
        enabled: true,
        modelId: 'Xenova/multilingual-e5-small',
        modelRevision: '761b726dd34fb83930e26aab4e9ac3899aa1fa78',
        estimatedDownloadMb: 142,
      }),
  }),
  creator: z.strictObject({
    name: z.string().min(1).max(100),
    creditLabel: z.string().min(1).max(100),
    showOnAboutPage: z.boolean(),
    showInMainExperience: z.boolean(),
  }),
  theme: z.strictObject({
    background: hexColourSchema,
    surface: hexColourSchema,
    surfaceAlt: hexColourSchema,
    primary: hexColourSchema,
    primaryStrong: hexColourSchema,
    secondary: hexColourSchema,
    accent: hexColourSchema,
    text: hexColourSchema,
    mutedText: hexColourSchema,
    plum: hexColourSchema,
    speakerCloth: hexColourSchema,
  }),
  features: z.strictObject({
    wisseBot: z.boolean(),
    dailyFrequency: z.boolean(),
    listeningStats: z.boolean(),
    installPrompt: z.boolean(),
    soundEffects: z.boolean(),
    mysteryBroadcast: z.boolean(),
    semanticUnderstanding: z.boolean().default(true),
  }),
  artistPolicy: z
    .strictObject({
      mode: artistPolicyModeSchema,
      primaryArtistIds: slugListSchema,
      allowFeaturedArtists: z.boolean(),
      allowSecondaryCollection: z.boolean(),
      secondaryCollectionId: slugSchema.nullable(),
    })
    .default({
      mode: 'primary-only',
      primaryArtistIds: [],
      allowFeaturedArtists: true,
      allowSecondaryCollection: false,
      secondaryCollectionId: 'malaysian-legends',
    }),
  defaultStreamingService: streamingServiceSchema,
  privacyNotice: z.string().min(1).max(240),
})

export const giftSchema = giftObjectSchema.transform((gift) => ({
  ...gift,
  artistPolicy: {
    ...gift.artistPolicy,
    primaryArtistIds:
      gift.artistPolicy.primaryArtistIds.length > 0
        ? gift.artistPolicy.primaryArtistIds
        : [gift.artist.slug],
  },
}))

const httpsOrEmptySchema = z.string().refine((value) => {
  if (value === '') return true
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}, 'Expected an HTTPS URL or an empty string')

const catalogueSlug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const migrateTrackInput = (input: unknown) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const track = input as Record<string, unknown>
  const artist = typeof track.artist === 'string' ? track.artist : 'unknown-artist'
  const album = typeof track.album === 'string' ? track.album : ''
  const contexts = Array.isArray(track.contexts) ? track.contexts : []
  return {
    ...track,
    album,
    albumId:
      typeof track.albumId === 'string'
        ? track.albumId
        : album
          ? catalogueSlug(album)
          : '',
    releaseDate: track.releaseDate ?? null,
    releaseYear: track.releaseYear ?? track.year ?? null,
    versionType: track.versionType ?? 'studio',
    isPrimaryVersion: track.isPrimaryVersion ?? true,
    primaryArtistId:
      typeof track.primaryArtistId === 'string'
        ? track.primaryArtistId
        : catalogueSlug(artist) || 'unknown-artist',
    featuredArtists: track.featuredArtists ?? [],
    featuredArtistIds: track.featuredArtistIds ?? [],
    languages: track.languages ?? ['other'],
    genres: track.genres ?? [],
    collections: track.collections ?? [],
    curationStatus: track.curationStatus ?? 'reviewed',
    curationConfidence: track.curationConfidence ?? 0.9,
    semanticDescription: track.semanticDescription ?? track.editorialNote ?? '',
    emotionalArc: track.emotionalArc ?? { opening: '', middle: '', ending: '' },
    vocalCharacter: track.vocalCharacter ?? [],
    instrumentalCharacter: track.instrumentalCharacter ?? [],
    useCases: track.useCases ?? contexts,
    avoidWhen: track.avoidWhen ?? [],
    sourceIds: track.sourceIds ?? [],
  }
}

const trackObjectSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(160),
  artist: z.string().min(1).max(160),
  primaryArtistId: slugSchema,
  featuredArtists: z.array(z.string().min(1).max(160)).max(12),
  featuredArtistIds: slugListSchema,
  year: z.number().int().min(1900).max(2200).nullable(),
  album: z.string().max(180),
  albumId: z.union([slugSchema, z.literal('')]),
  releaseDate: isoDateSchema.nullable(),
  releaseYear: z.number().int().min(1900).max(2200).nullable(),
  versionType: trackVersionTypeSchema,
  isPrimaryVersion: z.boolean(),
  languages: z.array(languageCodeSchema).min(1).max(8),
  genres: z.array(z.string().min(1).max(80)).max(20),
  collections: slugListSchema,
  curationStatus: curationStatusSchema,
  curationConfidence: z.number().min(0).max(1),
  era: z.string().max(80),
  artwork: optionalLocalAssetSchema,
  artworkAlt: z.string().max(180),
  active: z.boolean(),
  officialLinks: z.strictObject({
    youtube: httpsOrEmptySchema,
    spotify: httpsOrEmptySchema,
    appleMusic: httpsOrEmptySchema,
  }),
  embed: z.strictObject({
    provider: z.enum(['none', 'youtube', 'spotify', 'appleMusic']),
    url: httpsOrEmptySchema.nullable(),
  }),
  moods: moodVectorSchema,
  contexts: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(20),
  tempoClass: z.enum(['slow', 'medium', 'fast']),
  intensity: z.number().int().min(0).max(100),
  familiarity: z.number().int().min(0).max(100),
  editorialNote: z.string().min(1).max(360),
  tags: z.array(z.string().min(1).max(50)).max(30),
  semanticDescription: z.string().max(600),
  emotionalArc: z.strictObject({
    opening: z.string().max(180),
    middle: z.string().max(180),
    ending: z.string().max(180),
  }),
  vocalCharacter: z.array(z.string().min(1).max(80)).max(20),
  instrumentalCharacter: z.array(z.string().min(1).max(80)).max(20),
  useCases: z.array(slugSchema).max(30),
  avoidWhen: z.array(z.string().min(1).max(120)).max(20),
  sourceIds: slugListSchema,
})

export const trackSchema = z
  .preprocess(migrateTrackInput, trackObjectSchema)
  .superRefine((track, context) => {
    if (
      track.year !== null &&
      track.releaseYear !== null &&
      track.year !== track.releaseYear
    ) {
      context.addIssue({
        code: 'custom',
        path: ['releaseYear'],
        message: 'releaseYear must match the legacy year field when both are set',
      })
    }
  })

const migrateTracksFileInput = (input: unknown) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const file = input as Record<string, unknown>
  return {
    ...file,
    schemaVersion: file.schemaVersion === 1 ? 2 : file.schemaVersion,
  }
}

const tracksFileObjectSchema = z.strictObject({
    schemaVersion: z.literal(2),
    tracks: z.array(trackSchema),
  })

export const tracksFileSchema = z
  .preprocess(migrateTracksFileInput, tracksFileObjectSchema)
  .superRefine(({ tracks }, context) => {
    const seen = new Set<string>()
    tracks.forEach((track, index) => {
      if (seen.has(track.id)) {
        context.addIssue({
          code: 'custom',
          path: ['tracks', index, 'id'],
          message: `Duplicate track id: ${track.id}`,
        })
      }
      seen.add(track.id)
      if (track.embed.provider === 'none' && track.embed.url) {
        context.addIssue({
          code: 'custom',
          path: ['tracks', index, 'embed', 'url'],
          message: 'An embed URL cannot be set when the provider is none',
        })
      }
      if (track.embed.provider !== 'none' && !track.embed.url) {
        context.addIssue({
          code: 'custom',
          path: ['tracks', index, 'embed', 'url'],
          message: 'An embed URL is required when an embed provider is selected',
        })
      }
    })
  })

export const collectionSchema = z.strictObject({
  id: slugSchema,
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
  active: z.boolean(),
  kind: z.enum(['editorial', 'secondary-artist']).default('editorial'),
  artistIds: slugListSchema,
  semanticDescription: z.string().min(1).max(500),
  rankingWeight: z.number().min(0).max(1).default(0.2),
})

export const collectionsFileSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    collections: z.array(collectionSchema),
  })
  .superRefine(({ collections }, context) => {
    const seen = new Set<string>()
    collections.forEach((collection, index) => {
      if (seen.has(collection.id)) {
        context.addIssue({
          code: 'custom',
          path: ['collections', index, 'id'],
          message: 'Duplicate collection id: ' + collection.id,
        })
      }
      seen.add(collection.id)
    })
  })

export const emptyCollectionsFile = {
  schemaVersion: 1 as const,
  collections: [],
}

export const catalogSourceSchema = z.strictObject({
  id: slugSchema,
  type: slugSchema,
  provider: z.string().min(1).max(100),
  url: httpsOrEmptySchema.refine((value) => value !== '', 'A source URL is required'),
  checkedAt: isoDateSchema,
  notes: z.string().max(500).default(''),
})

export const trackVerificationSchema = z.strictObject({
  verifiedAt: isoDateSchema,
  sourceIds: slugListSchema.min(1),
  notes: z.string().max(500),
})

export const catalogReleaseCoverageSchema = z.strictObject({
  album: z.string().min(1).max(180),
  expectedTrackCount: z.number().int().positive(),
  includedTrackIds: z.array(slugSchema),
  sourceIds: slugListSchema.min(1),
  notes: z.string().max(500),
})

export const catalogSourcesSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    lastFullAudit: isoDateSchema,
    sources: z.array(catalogSourceSchema).min(1),
    trackVerification: z.record(slugSchema, trackVerificationSchema),
    releaseCoverage: z
      .record(slugSchema, catalogReleaseCoverageSchema)
      .default({}),
  })
  .superRefine(({ sources, trackVerification }, context) => {
    const sourceIds = new Set<string>()
    sources.forEach((source, index) => {
      if (sourceIds.has(source.id)) {
        context.addIssue({
          code: 'custom',
          path: ['sources', index, 'id'],
          message: 'Duplicate catalogue source id: ' + source.id,
        })
      }
      sourceIds.add(source.id)
    })
    Object.entries(trackVerification).forEach(([trackId, verification]) => {
      verification.sourceIds.forEach((sourceId) => {
        if (!sourceIds.has(sourceId)) {
          context.addIssue({
            code: 'custom',
            path: ['trackVerification', trackId, 'sourceIds'],
            message: 'Unknown source id: ' + sourceId,
          })
        }
      })
    })
  })

export const embeddingManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  modelId: z.string().min(1).max(160),
  modelRevision: z.string().min(1).max(100),
  dtype: z.enum(['fp32', 'fp16', 'q8', 'q4']),
  dimensions: z.number().int().positive().max(4096),
  pooling: z.literal('mean'),
  normalisation: z.literal('l2'),
  catalogueContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  trackCount: z.number().int().nonnegative(),
  prototypeCount: z.number().int().nonnegative(),
  estimatedModelDownloadBytes: z.number().int().positive(),
  vectorEncoding: z.literal('float32-le'),
  trackEmbeddingBytes: z.number().int().nonnegative(),
  prototypeEmbeddingBytes: z.number().int().nonnegative(),
  files: z.strictObject({
    tracks: z.string().min(1),
    prototypes: z.string().min(1),
    index: z.string().min(1),
  }),
})

export const moodPresetSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().min(1).max(60),
  description: z.string().min(1).max(140),
  icon: z.string().min(1).max(40),
  stationName: z.string().min(1).max(80),
  frequency: z.string().min(1).max(12),
  target: moodVectorSchema,
  surprise: z.boolean().optional(),
})

export const moodsFileSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    moods: z.array(moodPresetSchema).min(1),
  })
  .superRefine(({ moods }, context) => {
    const seen = new Set<string>()
    moods.forEach((mood, index) => {
      if (seen.has(mood.id)) {
        context.addIssue({
          code: 'custom',
          path: ['moods', index, 'id'],
          message: `Duplicate mood id: ${mood.id}`,
        })
      }
      seen.add(mood.id)
    })
  })

export const messagesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  loading: z.strictObject({
    heading: z.string(),
    messages: z.array(z.string()).min(1),
  }),
  welcome: z.strictObject({
    preparedFor: z.string(),
    tuneIn: z.string(),
    frequencyAriaLabel: z.string(),
  }),
  mood: z.strictObject({
    heading: z.string(),
    intro: z.string(),
    askAssistant: z.string(),
  }),
  radio: z.strictObject({
    nowTuned: z.string(),
    matchLabel: z.string(),
    playOn: z.string(),
    noLink: z.string(),
    another: z.string(),
    energyLabel: z.string(),
  }),
  feedback: z.strictObject({
    love: z.string(),
    notToday: z.string(),
    moreLikeThis: z.string(),
    lessIntense: z.string(),
    moreEnergetic: z.string(),
    saved: z.string(),
  }),
  bot: z.strictObject({
    greeting: z.string(),
    placeholder: z.string(),
    send: z.string(),
    understoodPrefix: z.string(),
    clarification: z.string(),
    semanticAvailable: z
      .string()
      .default('Enhanced understanding can run locally in this browser.'),
    semanticLoading: z
      .string()
      .default('Preparing enhanced local understanding…'),
    semanticReady: z
      .string()
      .default('Enhanced local understanding is ready.'),
    semanticUnavailable: z
      .string()
      .default('Enhanced understanding is unavailable; lightweight mode remains ready.'),
    lightweightMode: z.string().default('Continue with lightweight mode'),
    enableSemantic: z.string().default('Enable enhanced understanding'),
    newConversation: z.string().default('Start a new request'),
    whyRecommendation: z.string().default('Why this recommendation?'),
    whatUnderstood: z.string().default('What did you understand?'),
    localProcessing: z
      .string()
      .default('Requests are interpreted locally and grounded in this catalogue.'),
    suggestions: z
      .array(z.string().min(1).max(180))
      .min(1)
      .default([
        'Romantic but cheerful',
        'Tenang tapi tak mengantuk',
        'Something like the last song with more energy',
      ]),
  }),
  library: z.strictObject({
    heading: z.string(),
    intro: z.string(),
    loved: z.string(),
    recent: z.string(),
    insights: z.string(),
    empty: z.string(),
  }),
  settings: z.strictObject({
    heading: z.string(),
    privacyHeading: z.string(),
    installHeading: z.string(),
    installInstructions: z.string(),
  }),
  errors: z.strictObject({
    profileMissing: z.string(),
    profileInvalid: z.string(),
    retry: z.string(),
  }),
  stationIds: z.array(z.string()).min(1),
})

export const profileBundleSchema = z.strictObject({
  gift: giftSchema,
  tracks: tracksFileSchema,
  moods: moodsFileSchema,
  messages: messagesSchema,
  collections: collectionsFileSchema.default(emptyCollectionsFile),
})

export type MoodDimension = (typeof moodDimensionKeys)[number]
export type MoodVector = z.infer<typeof moodVectorSchema>
export type GiftConfig = z.infer<typeof giftSchema>
export type Track = z.infer<typeof trackSchema>
export type TracksFile = z.infer<typeof tracksFileSchema>
export type MoodPreset = z.infer<typeof moodPresetSchema>
export type MoodsFile = z.infer<typeof moodsFileSchema>
export type Messages = z.infer<typeof messagesSchema>
export type ProfileBundle = z.infer<typeof profileBundleSchema>
export type StreamingService = z.infer<typeof streamingServiceSchema>
export type ArtistPolicyMode = z.infer<typeof artistPolicyModeSchema>
export type ArtistPolicy = z.infer<typeof artistPolicySchema>
export type CurationStatus = z.infer<typeof curationStatusSchema>
export type TrackVersionType = z.infer<typeof trackVersionTypeSchema>
export type LanguageCode = z.infer<typeof languageCodeSchema>
export type Collection = z.infer<typeof collectionSchema>
export type CollectionsFile = z.infer<typeof collectionsFileSchema>
export type CatalogSources = z.infer<typeof catalogSourcesSchema>
export type EmbeddingManifest = z.infer<typeof embeddingManifestSchema>
