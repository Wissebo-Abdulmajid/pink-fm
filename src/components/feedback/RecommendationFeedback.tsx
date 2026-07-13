import { Ban, Heart, Sparkles } from 'lucide-react'
import { useExperience } from '../../app/providers'

export function RecommendationFeedback() {
  const {
    listener,
    recommendation,
    toggleLove,
    notToday,
    moreLikeThis,
    lessIntense,
    moreEnergetic,
    profile,
  } = useExperience()
  if (!recommendation) return null
  const loved = listener.lovedTrackIds.includes(recommendation.track.id)

  return (
    <div className="feedback-controls" aria-label="Recommendation feedback">
      <button className="feedback-button" type="button" aria-pressed={loved} onClick={toggleLove}>
        <Heart size={18} fill={loved ? 'currentColor' : 'none'} aria-hidden="true" />
        {profile.messages.feedback.love}
      </button>
      <button className="feedback-button" type="button" onClick={moreLikeThis}>
        <Sparkles size={18} aria-hidden="true" />
        {profile.messages.feedback.moreLikeThis}
      </button>
      <button className="feedback-button" type="button" onClick={() => notToday()}>
        <Ban size={18} aria-hidden="true" />
        {profile.messages.feedback.notToday}
      </button>
      <button className="feedback-button feedback-button--text" type="button" onClick={() => lessIntense()}>
        {profile.messages.feedback.lessIntense}
      </button>
      <button className="feedback-button feedback-button--text" type="button" onClick={() => moreEnergetic()}>
        {profile.messages.feedback.moreEnergetic}
      </button>
    </div>
  )
}
