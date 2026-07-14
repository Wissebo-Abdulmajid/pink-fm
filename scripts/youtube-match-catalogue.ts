import {
  loadAuthorities,
  loadDiscoveredVideos,
  loadTracksFile,
  parseSlug,
  writeCandidateReports,
  writeSourceAcquisitionReport,
} from './youtube-acquisition-tools.ts'
import {
  candidateCanBeApplied,
  classifyCatalogueCandidate,
  type CatalogueVideoCandidate,
} from '../src/features/recommendations/youtube-catalog-matching.ts'

const slug = parseSlug()
const tracks = loadTracksFile(slug).tracks.filter((track) => track.active)
const authorities = loadAuthorities(slug).filter((authority) => authority.active)
const authorityByChannel = new Map(authorities.map((authority) => [authority.channelId, authority]))
const videos = loadDiscoveredVideos(slug)

const candidates: CatalogueVideoCandidate[] = []
const seen = new Set<string>()

for (const video of videos) {
  const authority = authorityByChannel.get(video.channelId)
  for (const track of tracks) {
    if (track.fullPlaybackSources.some((source) => source.videoId === video.videoId)) continue
    const candidate = classifyCatalogueCandidate(track, video, authority)
    if (candidate.matchConfidence === 'rejected') continue
    const key = `${candidate.trackId}:${candidate.videoId}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(candidate)
  }
}

candidates.sort((left, right) =>
  left.trackId.localeCompare(right.trackId) ||
  left.matchConfidence.localeCompare(right.matchConfidence) ||
  left.videoId.localeCompare(right.videoId),
)

writeCandidateReports(candidates)
writeSourceAcquisitionReport({
  slug,
  apiKeyPresent: Boolean(process.env.YOUTUBE_DATA_API_KEY),
  authorityCount: authorities.length,
  discoveredVideoCount: videos.length,
  candidateCount: candidates.length,
  autoAcceptedCount: candidates.filter(candidateCanBeApplied).length,
  rejectedCount: 0,
  ambiguousCount: candidates.filter((candidate) => candidate.matchConfidence === 'ambiguous').length,
  apiCalls: 0,
  quotaEstimate: 0,
  notes: [
    videos.length === 0
      ? 'No discovered upload cache exists yet. Run `npm.cmd run youtube:discover -- --slug=siti` with YOUTUBE_DATA_API_KEY set.'
      : 'Matched cached trusted-channel uploads against the active Pink FM catalogue.',
    'General YouTube search is intentionally not used by this matcher.',
    'Candidates not meeting conservative confidence remain in the manual review queue only.',
  ],
})

console.log(JSON.stringify({
  slug,
  discoveredVideos: videos.length,
  candidates: candidates.length,
  exactHighConfidence: candidates.filter((candidate) => candidate.matchConfidence === 'exact-high-confidence').length,
  applicable: candidates.filter(candidateCanBeApplied).length,
}, null, 2))
