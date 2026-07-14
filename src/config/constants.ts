import type { MoodVector } from './schemas'

export const PROFILE_SCHEMA_VERSION = 1
export const STORAGE_SCHEMA_VERSION = 4
export const PROFILE_FILES = ['gift.json', 'moods.json', 'tracks.json', 'messages.json'] as const

export const RECOMMENDATION_WEIGHTS = {
  mood: 0.45,
  semantic: 0.1,
  context: 0.06,
  energy: 0.05,
  intensity: 0.04,
  preference: 0.08,
  era: 0.025,
  collection: 0.025,
  novelty: 0.06,
  affinity: 0.05,
  time: 0.03,
  artist: 0.03,
  version: 0.01,
  recentPenalty: 0.22,
  albumRepetitionPenalty: 0.045,
  dailyRotationTolerance: 0.095,
  secondaryArtistPenalty: 0.08,
  curationPenalty: {
    reviewed: 0,
    'verified-metadata': 0.045,
    provisional: 0.12,
  },
} as const

export const neutralMoodVector: MoodVector = {
  peaceful: 50,
  happy: 50,
  romantic: 50,
  confident: 50,
  energised: 50,
  nostalgic: 50,
  elegant: 50,
  comforted: 50,
  dramatic: 50,
}

export const RECENT_TRACK_LIMIT = 8
export const NOT_TODAY_TTL_MS = 1000 * 60 * 60 * 24 * 3
