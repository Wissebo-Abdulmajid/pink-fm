import type { FullPlaybackSource, Track } from '../../config/schemas'

export type PlaybackStatusLabel =
  | 'FULL SONG'
  | 'FULL OFFICIAL LIVE VERSION'
  | 'PREVIEW'
  | 'EXTERNAL ONLY'
  | 'CURRENTLY UNAVAILABLE'

export type FullPlaybackReplacement = {
  originalTrackId: string
  replacementTrackId: string
  reason: 'no-full-source' | 'source-unavailable' | 'regional-restriction' | 'embed-blocked'
  moodSimilarity: number
  energyDifference: number
  sameCollection: boolean
  sameEra: boolean
  sameArtist: boolean
}

export const fullPlaybackSourceIsUsable = (source: FullPlaybackSource) =>
  source.provider === 'youtube' &&
  source.verified &&
  source.embeddable &&
  source.fullLength &&
  source.durationSeconds !== null &&
  source.priority > 0

export const fullPlaybackSourcesForRadio = (
  track: Track,
  allowOfficialAlternateVersions = true,
) =>
  track.fullPlaybackSources
    .filter(fullPlaybackSourceIsUsable)
    .filter((source) =>
      allowOfficialAlternateVersions
        ? true
        : !['live', 'acoustic', 'alternate'].includes(source.version),
    )
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))

export function isRadioEligible(track: Track, allowOfficialAlternateVersions = true): boolean {
  return (
    track.active &&
    track.playbackCoverage === 'full-subscription-free' &&
    fullPlaybackSourcesForRadio(track, allowOfficialAlternateVersions).length > 0
  )
}

export const selectPrimaryFullPlaybackSource = (
  track: Track,
  allowOfficialAlternateVersions = true,
) => fullPlaybackSourcesForRadio(track, allowOfficialAlternateVersions)[0] ?? null

export const playbackStatusLabel = (track: Track): PlaybackStatusLabel => {
  if (track.playbackCoverage === 'full-subscription-free') {
    const source = selectPrimaryFullPlaybackSource(track)
    return source && ['live', 'acoustic', 'alternate'].includes(source.version)
      ? 'FULL OFFICIAL LIVE VERSION'
      : 'FULL SONG'
  }
  if (track.playbackCoverage === 'preview-only') return 'PREVIEW'
  if (track.playbackCoverage === 'external-only') return 'EXTERNAL ONLY'
  return 'CURRENTLY UNAVAILABLE'
}

