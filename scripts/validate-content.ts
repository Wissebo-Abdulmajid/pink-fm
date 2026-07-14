import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ZodType } from 'zod'
import {
  catalogSourcesSchema,
  collectionsFileSchema,
  embeddingManifestSchema,
  giftSchema,
  messagesSchema,
  moodsFileSchema,
  tracksFileSchema,
  youtubeAuthoritiesFileSchema,
  type CatalogSources,
  type CollectionsFile,
  type GiftConfig,
  type Track,
  type TracksFile,
  type YouTubeAuthoritiesFile,
} from '../src/config/schemas.ts'
import { catalogueContentHash } from './catalog-shared.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const giftsRoot = resolve(projectRoot, 'public', 'gifts')

type Problem = { level: 'error' | 'warning'; file: string; message: string }

const problems: Problem[] = []

const report = (level: Problem['level'], file: string, message: string) => {
  problems.push({ level, file, message })
}

const readAndParse = <T>(profilePath: string, file: string, schema: ZodType<T>): T | null => {
  const fullPath = resolve(profilePath, file)
  if (!existsSync(fullPath)) {
    report('error', fullPath, 'Required profile file is missing.')
    return null
  }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(fullPath, 'utf8')) as unknown
  } catch (error) {
    report(
      'error',
      fullPath,
      error instanceof Error ? `Malformed JSON: ${error.message}` : 'Malformed JSON.',
    )
    return null
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const location = issue.path.length ? ` at ${issue.path.join('.')}` : ''
      report('error', fullPath, `${issue.message}${location}`)
    })
    return null
  }
  return result.data
}

const checkAsset = (profilePath: string, sourceFile: string, asset: string | null) => {
  if (!asset) return
  const assetPath = resolve(profilePath, asset)
  const relativePath = relative(profilePath, assetPath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    report('error', sourceFile, `Asset path escapes the profile directory: ${asset}`)
  } else if (!existsSync(assetPath)) {
    report('error', sourceFile, `Referenced asset does not exist: ${asset}`)
  }
}

const checkLinks = (profilePath: string, tracks: Track[]) => {
  const seenUrls = new Map<string, string>()
  let missingArtwork = 0
  for (const track of tracks) {
    if (track.embed.url) {
      const allowedEmbedHosts: Record<string, string[]> = {
        spotify: ['open.spotify.com'],
        youtube: ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'],
        appleMusic: ['music.apple.com', 'embed.music.apple.com'],
      }
      try {
        const embedUrl = new URL(track.embed.url)
        if (
          embedUrl.protocol !== 'https:' ||
          !(allowedEmbedHosts[track.embed.provider] ?? []).includes(embedUrl.hostname)
        ) {
          report('error', resolve(profilePath, 'tracks.json'), `${track.id}.embed uses an unsupported iframe host.`)
        }
      } catch {
        report('error', resolve(profilePath, 'tracks.json'), `${track.id}.embed is not a valid URL.`)
      }
    }
    for (const [service, link] of Object.entries(track.officialLinks)) {
      if (!link) continue
      try {
        const url = new URL(link)
        if (url.protocol !== 'https:') {
          report('error', resolve(profilePath, 'tracks.json'), `${track.id}.${service} is not HTTPS.`)
        }
        if (service === 'youtube' && url.searchParams.get('v')) {
          const videoId = url.searchParams.get('v')
          url.search = videoId ? `?v=${videoId}` : ''
        } else {
          url.search = ''
        }
        url.hash = ''
        const canonical = url.toString().replace(/\/$/, '')
        const previous = seenUrls.get(canonical)
        if (previous && previous !== track.id) {
          report(
            'error',
            resolve(profilePath, 'tracks.json'),
            `${track.id}.${service} duplicates the provider URL used by ${previous}.`,
          )
        }
        seenUrls.set(canonical, track.id)
      } catch {
        report('error', resolve(profilePath, 'tracks.json'), `${track.id}.${service} is not a valid URL.`)
      }
    }
    if (track.active && !Object.values(track.officialLinks).some(Boolean) && !track.embed.url) {
      report(
        'warning',
        resolve(profilePath, 'tracks.json'),
        `${track.id} has no listening destination and will display an unavailable message.`,
      )
    }
    if (!track.artwork) missingArtwork += 1
    checkAsset(profilePath, resolve(profilePath, 'tracks.json'), track.artwork)
  }
  if (missingArtwork > 0) {
    report(
      'warning',
      resolve(profilePath, 'tracks.json'),
      `${missingArtwork} track(s) have no artwork; the original abstract fallback will be used.`,
    )
  }
}

const checkRelationships = (
  profilePath: string,
  gift: GiftConfig,
  tracksFile: TracksFile,
  collections: CollectionsFile,
  sources: CatalogSources,
  youtubeAuthorities: YouTubeAuthoritiesFile,
) => {
  const tracks = tracksFile.tracks
  const collectionIds = new Set(collections.collections.map((collection) => collection.id))
  const sourceIds = new Set(sources.sources.map((source) => source.id))
  const trackIds = new Set(tracks.map((track) => track.id))
  const tracksPath = resolve(profilePath, 'tracks.json')
  const sourcesPath = resolve(profilePath, 'catalog-sources.json')
  const trustedYoutubeChannels = new Set(
    youtubeAuthorities.channels
      .filter((channel) => channel.active)
      .map((channel) => channel.channelId),
  )

  for (const track of tracks) {
    for (const collectionId of track.collections) {
      if (!collectionIds.has(collectionId)) {
        report('error', tracksPath, `${track.id} references unknown collection "${collectionId}".`)
      }
    }
    for (const sourceId of track.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        report('error', tracksPath, `${track.id} references unknown source "${sourceId}".`)
      }
    }
    if (track.playback.youtube && !sourceIds.has(track.playback.youtube.sourceId)) {
      report(
        'error',
        tracksPath,
        `${track.id} YouTube playback references unknown source "${track.playback.youtube.sourceId}".`,
      )
    }
    for (const fullSource of track.fullPlaybackSources) {
      if (!sourceIds.has(fullSource.provenanceSourceId)) {
        report(
          'error',
          tracksPath,
          `${track.id} full playback source "${fullSource.id}" references unknown provenance "${fullSource.provenanceSourceId}".`,
        )
      }
      if (!trustedYoutubeChannels.has(fullSource.channelId)) {
        report(
          'error',
          tracksPath,
          `${track.id} full playback source "${fullSource.id}" uses unregistered YouTube channel "${fullSource.channelId}".`,
        )
      }
    }
    const verification = sources.trackVerification[track.id]
    if (!verification) {
      report('error', sourcesPath, `${track.id} has no trackVerification record.`)
    } else {
      const declared = new Set(track.sourceIds)
      for (const sourceId of verification.sourceIds) {
        if (!declared.has(sourceId)) {
          report(
            'error',
            sourcesPath,
            `${track.id} verification uses "${sourceId}" but tracks.json does not declare it.`,
          )
        }
      }
    }
    if (track.curationStatus === 'reviewed' && track.curationConfidence < 0.7) {
      report('error', tracksPath, `${track.id} is reviewed but has curationConfidence below 0.7.`)
    }
    if (track.curationStatus === 'verified-metadata' && track.curationConfidence > 0.85) {
      report('warning', tracksPath, `${track.id} is metadata-only but claims unusually high curation confidence.`)
    }
    if (gift.artistPolicy.mode === 'primary-only') {
      const permitted =
        gift.artistPolicy.primaryArtistIds.includes(track.primaryArtistId) ||
        (gift.artistPolicy.allowFeaturedArtists &&
          track.featuredArtistIds.some((artistId) =>
            gift.artistPolicy.primaryArtistIds.includes(artistId),
          ))
      if (!permitted && track.active) {
        report(
          'warning',
          tracksPath,
          `${track.id} is active but excluded by the profile's primary-only artist policy.`,
        )
      }
    }
  }

  for (const trackId of Object.keys(sources.trackVerification)) {
    if (!trackIds.has(trackId)) {
      report('warning', sourcesPath, `Provenance remains for missing track "${trackId}".`)
    }
  }
  for (const collection of collections.collections) {
    if (
      collection.kind === 'secondary-artist' &&
      collection.active &&
      !gift.artistPolicy.allowSecondaryCollection
    ) {
      report(
        'error',
        resolve(profilePath, 'collections.json'),
        `${collection.id} is active while secondary collections are disabled.`,
      )
    }
  }
}

const checkEmbeddingFile = (
  profilePath: string,
  embeddingsPath: string,
  fileName: string,
  expectedBytes?: number,
) => {
  const fullPath = resolve(embeddingsPath, fileName)
  const relativePath = relative(embeddingsPath, fullPath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    report(
      'error',
      resolve(embeddingsPath, 'manifest.json'),
      `Embedding file escapes its directory: ${fileName}`,
    )
    return
  }
  if (!existsSync(fullPath)) {
    report('error', fullPath, 'Embedding file is missing. Run npm run bot:embeddings.')
    return
  }
  if (expectedBytes !== undefined) {
    const actualBytes = statSync(fullPath).size
    if (actualBytes !== expectedBytes) {
      report('error', fullPath, `Expected ${expectedBytes} bytes but found ${actualBytes}.`)
    }
  }
  if (!fullPath.startsWith(profilePath)) {
    report('error', fullPath, 'Embedding file resolved outside the profile directory.')
  }
}

const checkEmbeddings = (
  profilePath: string,
  gift: GiftConfig,
  tracks: TracksFile,
  collections: CollectionsFile,
) => {
  if (!gift.features.semanticUnderstanding || !gift.assistant.semantic.enabled) return
  const embeddingsPath = resolve(profilePath, 'embeddings')
  const manifest = readAndParse(
    embeddingsPath,
    'manifest.json',
    embeddingManifestSchema,
  )
  if (!manifest) return
  if (
    manifest.modelId !== gift.assistant.semantic.modelId ||
    manifest.modelRevision !== gift.assistant.semantic.modelRevision
  ) {
    report(
      'error',
      resolve(embeddingsPath, 'manifest.json'),
      'Embedding model does not match gift.json. Run npm run bot:embeddings.',
    )
  }
  const expectedHash = catalogueContentHash(tracks.tracks, collections.collections)
  if (manifest.catalogueContentHash !== expectedHash) {
    report(
      'error',
      resolve(embeddingsPath, 'manifest.json'),
      'Embeddings are stale after catalogue content changed. Run npm run bot:embeddings.',
    )
  }
  const activeCount = tracks.tracks.filter((track) => track.active).length
  if (manifest.trackCount !== activeCount) {
    report(
      'error',
      resolve(embeddingsPath, 'manifest.json'),
      `Embedding manifest has ${manifest.trackCount} tracks; catalogue has ${activeCount} active tracks.`,
    )
  }
  checkEmbeddingFile(
    profilePath,
    embeddingsPath,
    manifest.files.tracks,
    manifest.trackEmbeddingBytes,
  )
  checkEmbeddingFile(
    profilePath,
    embeddingsPath,
    manifest.files.prototypes,
    manifest.prototypeEmbeddingBytes,
  )
  checkEmbeddingFile(profilePath, embeddingsPath, manifest.files.index)

  const indexPath = resolve(embeddingsPath, manifest.files.index)
  if (!existsSync(indexPath)) return
  try {
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
      dimensions?: unknown
      tracks?: unknown[]
      prototypes?: unknown[]
    }
    if (
      index.dimensions !== manifest.dimensions ||
      index.tracks?.length !== manifest.trackCount ||
      index.prototypes?.length !== manifest.prototypeCount
    ) {
      report('error', indexPath, 'Embedding index counts or dimensions do not match the manifest.')
    }
  } catch (error) {
    report(
      'error',
      indexPath,
      error instanceof Error
        ? `Malformed embedding index: ${error.message}`
        : 'Malformed embedding index.',
    )
  }
}

const validateProfile = (profileName: string) => {
  const profilePath = resolve(giftsRoot, profileName)
  const gift = readAndParse(profilePath, 'gift.json', giftSchema)
  const moods = readAndParse(profilePath, 'moods.json', moodsFileSchema)
  const tracks = readAndParse(profilePath, 'tracks.json', tracksFileSchema)
  const collections = readAndParse(profilePath, 'collections.json', collectionsFileSchema)
  const sources = readAndParse(profilePath, 'catalog-sources.json', catalogSourcesSchema)
  const youtubeAuthorities = readAndParse(
    profilePath,
    'youtube-authorities.json',
    youtubeAuthoritiesFileSchema,
  )
  readAndParse(profilePath, 'messages.json', messagesSchema)

  if (gift) {
    if (gift.slug !== profileName) {
      report('error', resolve(profilePath, 'gift.json'), `Slug "${gift.slug}" must match directory "${profileName}".`)
    }
    checkAsset(profilePath, resolve(profilePath, 'gift.json'), gift.artist.image)
    checkAsset(profilePath, resolve(profilePath, 'gift.json'), gift.assistant.avatar)
  }
  if (moods && !moods.moods.some((mood) => mood.surprise || mood.id === 'surprise')) {
    report('warning', resolve(profilePath, 'moods.json'), 'No Surprise me preset is configured.')
  }
  if (tracks) {
    checkLinks(profilePath, tracks.tracks)
    const activeCount = tracks.tracks.filter((track) => track.active).length
    if (activeCount < 10) {
      report('warning', resolve(profilePath, 'tracks.json'), `Only ${activeCount} active track(s); ten or more are recommended.`)
    }
  }
  if (gift && tracks && collections && sources && youtubeAuthorities) {
    checkRelationships(profilePath, gift, tracks, collections, sources, youtubeAuthorities)
    checkEmbeddings(profilePath, gift, tracks, collections)
  }
}

if (!existsSync(giftsRoot)) {
  console.error(`Content directory not found: ${giftsRoot}`)
  process.exitCode = 1
} else {
  const profiles = readdirSync(giftsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_template')
    .map((entry) => entry.name)
    .sort()

  if (profiles.length === 0) {
    report('error', giftsRoot, 'No gift profiles were found.')
  }
  profiles.forEach(validateProfile)

  problems.forEach(({ level, file, message }) => {
    const prefix = level === 'error' ? 'ERROR' : 'WARN '
    console.log(`${prefix} ${file}: ${message}`)
  })

  const errorCount = problems.filter((problem) => problem.level === 'error').length
  const warningCount = problems.length - errorCount
  if (errorCount > 0) {
    console.error(`\nContent validation failed: ${errorCount} error(s), ${warningCount} warning(s).`)
    process.exitCode = 1
  } else {
    console.log(`\nContent valid: ${profiles.length} profile(s), ${warningCount} warning(s).`)
  }
}
