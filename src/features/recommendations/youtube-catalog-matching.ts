import type { FullPlaybackSource, Track } from '../../config/schemas'

export type YouTubeCandidateConfidence =
  | 'exact-high-confidence'
  | 'probable-needs-review'
  | 'ambiguous'
  | 'rejected'

export type YouTubeCandidateReviewStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'alternate-version'
  | 'duplicate'
  | 'wrong-song'
  | 'medley'
  | 'preview'
  | 'unavailable'
  | 'needs-listening-review'

export type YouTubeVideoKind =
  | 'official-music-video'
  | 'official-audio'
  | 'youtube-topic'
  | 'official-lyric-video'
  | 'official-live'
  | 'official-acoustic'
  | 'alternate'
  | 'rejected-short'
  | 'rejected-preview'
  | 'rejected-medley'
  | 'rejected-karaoke'
  | 'rejected-fan-or-reaction'
  | 'unknown'

export type TrustedYouTubeAuthority = {
  channelId: string
  name: string
  authority: FullPlaybackSource['authority']
  active: boolean
  evidenceUrl: string
  verifiedAt: string
  notes?: string
}

export type DiscoveredYouTubeVideo = {
  videoId: string
  title: string
  channelId: string
  channelName: string
  durationSeconds: number | null
  embeddable: boolean
  public: boolean
  sourceUrl: string
}

export type CatalogueVideoCandidate = {
  trackId: string
  trackTitle: string
  candidateTitle: string
  videoId: string
  channelId: string
  channelName: string
  durationSeconds: number | null
  expectedTrackDurationSeconds: number | null
  authority: FullPlaybackSource['authority']
  matchConfidence: YouTubeCandidateConfidence
  versionClassification: YouTubeVideoKind
  embeddable: boolean
  fullLength: boolean
  existingPrimarySource: string | null
  proposedPriority: number
  reason: string
  reviewStatus: YouTubeCandidateReviewStatus
  sourceUrl: string
  provenanceSourceId: string
}

const HONORIFICS = [
  "dato' sri",
  "dato' seri",
  'dato sri',
  'dato seri',
  'dato',
  'datuk',
  'dati',
  'dsk',
  'hajah',
  'ctdk',
]

const REJECTED_VERSION_WORDS = [
  'teaser',
  'trailer',
  'snippet',
  'preview',
  'short version',
  '#shorts',
  'shorts',
  'reaction',
  'cover',
  'fanmade',
  'fan made',
  'compilation',
  'rehearsal',
  'behind the scenes',
]

export const slugifyForSource = (value: string) =>
  normaliseForMatch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

const slugifyAuthorityName = (value: string) =>
  normaliseLoose(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

export const normaliseForMatch = (value: string) => {
  let next = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/&/g, ' and ')
    .toLowerCase()

  for (const honorific of HONORIFICS) {
    next = next.replace(new RegExp(`\\b${honorific}\\b`, 'g'), ' ')
  }

  return next
    .replace(/\([^)]*\b(?:official|music video|audio|lyric|mv|video muzik|visualizer)\b[^)]*\)/g, ' ')
    .replace(/\[[^\]]*\b(?:official|music video|audio|lyric|mv|video muzik|visualizer)\b[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bsiti nurhaliza\b/g, ' ')
    .replace(/\bct nurhaliza\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const normaliseLoose = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const detectYouTubeVideoKind = (title: string, durationSeconds: number | null): YouTubeVideoKind => {
  const text = normaliseLoose(title)
  const original = title.toLowerCase()
  if (durationSeconds !== null && durationSeconds <= 60) return 'rejected-short'
  if (original.includes('/shorts/') || text.includes(' shorts ') || original.includes('#shorts')) return 'rejected-short'
  if (text.includes('medley') || text.includes('non stop') || text.includes('kompilasi')) return 'rejected-medley'
  if (text.includes('karaoke') || text.includes('minus one')) return 'rejected-karaoke'
  if (text.includes('reaction') || text.includes('cover') || text.includes('fanmade')) return 'rejected-fan-or-reaction'
  if (text.includes('teaser') || text.includes('trailer') || text.includes('snippet') || text.includes('preview')) return 'rejected-preview'
  if (text.includes('topic') || title.includes(' - Topic')) return 'youtube-topic'
  if (text.includes('official audio') || text.includes('audio rasmi') || text.includes('audio official')) return 'official-audio'
  if (text.includes('official lyric') || text.includes('lyric video') || text.includes('lirik rasmi')) return 'official-lyric-video'
  if (text.includes('official music video') || text.includes('music video') || text.includes('video muzik') || /\bmv\b/.test(text)) {
    return 'official-music-video'
  }
  if (text.includes('live') || text.includes('konsert') || text.includes('performance')) return 'official-live'
  if (text.includes('acoustic') || text.includes('akustik')) return 'official-acoustic'
  if (text.includes('alternate') || text.includes('version')) return 'alternate'
  return 'unknown'
}

export const youtubeKindToSourceVersion = (kind: YouTubeVideoKind): FullPlaybackSource['version'] | null => {
  if (kind === 'official-music-video') return 'music-video'
  if (kind === 'official-audio' || kind === 'youtube-topic' || kind === 'official-lyric-video') return 'official-audio'
  if (kind === 'official-live') return 'live'
  if (kind === 'official-acoustic') return 'acoustic'
  if (kind === 'alternate' || kind === 'unknown') return 'alternate'
  return null
}

export const durationIsFullLength = (
  durationSeconds: number | null,
  expectedTrackDurationSeconds: number | null,
) => {
  if (durationSeconds === null) return false
  if (durationSeconds < 120) return false
  if (expectedTrackDurationSeconds === null) return true
  return durationSeconds >= Math.max(120, Math.floor(expectedTrackDurationSeconds * 0.75))
}

export const titleMatchesTrack = (track: Track, title: string) => {
  const trackTitle = normaliseForMatch(track.title)
  const candidate = normaliseForMatch(title)
  if (!trackTitle || !candidate) return false
  if (candidate === trackTitle) return true
  if (candidate.includes(trackTitle)) return true
  const reversed = `${trackTitle} ${normaliseForMatch(track.artist)}`
  return normaliseForMatch(`${title}`).includes(reversed)
}

export const classifyCatalogueCandidate = (
  track: Track,
  video: DiscoveredYouTubeVideo,
  authority: TrustedYouTubeAuthority | undefined,
): CatalogueVideoCandidate => {
  const kind = detectYouTubeVideoKind(video.title, video.durationSeconds)
  const trusted = Boolean(authority?.active && authority.channelId === video.channelId)
  const fullLength = durationIsFullLength(video.durationSeconds, null)
  const titleMatch = titleMatchesTrack(track, video.title)
  const rejectedKind = kind.startsWith('rejected-')
  const existingPrimary = track.fullPlaybackSources.find((source) => source.priority === 1)?.videoId ?? null
  const proposedPriority = track.fullPlaybackSources.length + 1
  const canAutoPrepare = trusted && video.public && video.embeddable && fullLength && titleMatch && !rejectedKind
  const exactKind = ['official-music-video', 'official-audio', 'youtube-topic', 'official-lyric-video'].includes(kind)
  const alternateKind = ['official-live', 'official-acoustic', 'alternate'].includes(kind)
  const matchConfidence: YouTubeCandidateConfidence = !trusted || !video.public || !video.embeddable || rejectedKind
    ? 'rejected'
    : canAutoPrepare && exactKind
      ? 'exact-high-confidence'
      : canAutoPrepare && alternateKind
        ? 'probable-needs-review'
        : titleMatch
          ? 'probable-needs-review'
          : video.title.toLowerCase().includes(track.title.toLowerCase().split(/\s+/)[0] ?? '')
            ? 'ambiguous'
            : 'rejected'

  const reason = !trusted
    ? 'Channel is not in the trusted authority registry.'
    : !video.public
      ? 'Video is not public.'
      : !video.embeddable
        ? 'Embedding is not allowed.'
        : rejectedKind
          ? `Rejected by version classifier: ${kind}.`
          : !fullLength
            ? 'Duration evidence is too short for a full performance.'
            : !titleMatch
              ? 'Video title does not conservatively match the catalogue track.'
              : matchConfidence === 'exact-high-confidence'
                ? 'Trusted channel, matching title, full-length duration and exact official source type.'
                : 'Trusted source but version or title pattern requires manual review.'

  return {
    trackId: track.id,
    trackTitle: track.title,
    candidateTitle: video.title,
    videoId: video.videoId,
    channelId: video.channelId,
    channelName: video.channelName,
    durationSeconds: video.durationSeconds,
    expectedTrackDurationSeconds: null,
    authority: authority?.authority ?? 'licensed-broadcaster',
    matchConfidence,
    versionClassification: kind,
    embeddable: video.embeddable,
    fullLength,
    existingPrimarySource: existingPrimary,
    proposedPriority,
    reason,
    reviewStatus: matchConfidence === 'exact-high-confidence' ? 'accepted' : 'pending',
    sourceUrl: video.sourceUrl,
    provenanceSourceId: authority ? `youtube-${slugifyAuthorityName(authority.name)}` : 'youtube-untrusted',
  }
}

export const candidateCanBeApplied = (candidate: CatalogueVideoCandidate) =>
  candidate.matchConfidence === 'exact-high-confidence' &&
  candidate.reviewStatus === 'accepted' &&
  candidate.embeddable &&
  candidate.fullLength &&
  !REJECTED_VERSION_WORDS.some((word) => normaliseForMatch(candidate.candidateTitle).includes(word))

export const candidateToFullPlaybackSource = (
  candidate: CatalogueVideoCandidate,
  verifiedAt: string,
): FullPlaybackSource => {
  const version = youtubeKindToSourceVersion(candidate.versionClassification)
  if (!version) throw new Error(`Cannot convert rejected candidate ${candidate.videoId} to a source.`)
  return {
    id: `${slugifyForSource(candidate.trackId)}-${slugifyForSource(candidate.versionClassification)}-${slugifyForSource(candidate.videoId)}`,
    provider: 'youtube',
    videoId: candidate.videoId,
    version,
    authority: candidate.authority,
    channelId: candidate.channelId,
    channelName: candidate.channelName,
    verified: true,
    embeddable: true,
    fullLength: true,
    durationSeconds: candidate.durationSeconds,
    expectedTrackDurationSeconds: candidate.expectedTrackDurationSeconds,
    regionNotes: [],
    verifiedAt,
    sourceUrl: candidate.sourceUrl,
    provenanceSourceId: candidate.provenanceSourceId,
    priority: candidate.proposedPriority,
  }
}
