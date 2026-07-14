import { ListMusic, Radio, Redo2 } from 'lucide-react'
import { useExperience } from '../../app/providers'
import { usePlaybackHistory } from './usePlaybackHistory'

export function RecommendationQueue({ onReplay, replayAvailable }: { onReplay: () => void; replayAvailable: boolean }) {
  const {
    recommendation, nextRecommendation, playNextRecommendation,
    chooseAnother, sameMoodDifferentEra, differentAlbum,
  } = useExperience()
  const { previousPlayedTrack } = usePlaybackHistory()
  return (
    <div className="recommendation-queue" aria-label="Recommendation queue">
      <p><ListMusic size={16} aria-hidden="true" /> <strong>Radio queue</strong></p>
      <dl>
        <div><dt>Current</dt><dd>{recommendation?.track.title ?? 'Tuning…'}</dd></div>
        <div><dt>Next</dt><dd>{nextRecommendation?.track.title ?? 'Ready after this frequency'}</dd></div>
        <div><dt>Previously played</dt><dd>{previousPlayedTrack?.title ?? 'Nothing played in site yet'}</dd></div>
      </dl>
      <div className="recommendation-queue__actions">
        {nextRecommendation && <button type="button" onClick={() => playNextRecommendation()}><Radio aria-hidden="true" /> Next recommendation</button>}
        {replayAvailable && <button type="button" onClick={onReplay}><Redo2 aria-hidden="true" /> Replay</button>}
        <button type="button" onClick={() => chooseAnother()}>Another choice</button>
        <button type="button" onClick={() => sameMoodDifferentEra()}>Same mood, different era</button>
        <button type="button" onClick={() => differentAlbum()}>Different album</button>
      </div>
    </div>
  )
}
