import { existsSync } from 'node:fs'
import {
  candidatesJsonPath,
  readJsonFile,
  writeCandidateReports,
} from './youtube-acquisition-tools.ts'
import type {
  CatalogueVideoCandidate,
  YouTubeCandidateReviewStatus,
} from '../src/features/recommendations/youtube-catalog-matching.ts'

const allowedStatuses = new Set<YouTubeCandidateReviewStatus>([
  'pending',
  'accepted',
  'rejected',
  'alternate-version',
  'duplicate',
  'wrong-song',
  'medley',
  'preview',
  'unavailable',
  'needs-listening-review',
])

type CandidateFile = {
  candidates: CatalogueVideoCandidate[]
}

const path = candidatesJsonPath()
if (!existsSync(path)) {
  throw new Error('Missing docs/phase-4-2-youtube-candidates.json. Run youtube:match first.')
}

const file = readJsonFile<CandidateFile>(path)
const setArg = process.argv.find((arg) => arg.startsWith('--set='))

if (setArg) {
  const [, payload] = setArg.split('=', 2)
  const [trackId, videoId, status] = (payload ?? '').split(':')
  if (!trackId || !videoId || !allowedStatuses.has(status as YouTubeCandidateReviewStatus)) {
    throw new Error('Expected --set=track-id:video-id:status with a recognised review status.')
  }
  let changed = false
  const next = file.candidates.map((candidate) => {
    if (candidate.trackId !== trackId || candidate.videoId !== videoId) return candidate
    changed = true
    return { ...candidate, reviewStatus: status as YouTubeCandidateReviewStatus }
  })
  if (!changed) throw new Error(`Candidate not found: ${trackId}:${videoId}`)
  writeCandidateReports(next)
}

const summary = file.candidates.reduce<Record<string, number>>((counts, candidate) => ({
  ...counts,
  [candidate.reviewStatus]: (counts[candidate.reviewStatus] ?? 0) + 1,
}), {})

console.log(JSON.stringify({
  totalCandidates: file.candidates.length,
  byReviewStatus: summary,
  exactHighConfidence: file.candidates.filter((candidate) => candidate.matchConfidence === 'exact-high-confidence').length,
  probableNeedsReview: file.candidates.filter((candidate) => candidate.matchConfidence === 'probable-needs-review').length,
  ambiguous: file.candidates.filter((candidate) => candidate.matchConfidence === 'ambiguous').length,
}, null, 2))
