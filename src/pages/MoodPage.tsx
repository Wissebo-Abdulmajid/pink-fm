import { Bot, CalendarHeart } from 'lucide-react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useExperience } from '../app/providers'
import { MoodIcon } from '../components/common/MoodIcon'
import type { LayoutOutletContext } from '../layouts/AppLayout'

export default function MoodPage() {
  const { slug, profile, tuneMood, playSound } = useExperience()
  const outletContext = useOutletContext<LayoutOutletContext | undefined>()
  const openBot = outletContext?.openBot ?? (() => undefined)
  const navigate = useNavigate()
  const { moods } = profile.moods

  const selectMood = (mood: (typeof moods)[number]) => {
    playSound('click')
    tuneMood(mood)
    void navigate(`/g/${slug}/radio`)
  }

  const dailyMood = moods[new Date().getDate() % Math.max(1, moods.length - 1)] ?? moods[0]

  return (
    <main className="page page--narrow mood-page" id="main-content">
      <p className="eyebrow">Mood presets</p>
      <h1 className="page-heading">{profile.messages.mood.heading}</h1>
      <p className="page-intro">{profile.messages.mood.intro}</p>

      {profile.gift.features.dailyFrequency && dailyMood && (
        <button className="daily-frequency panel" type="button" onClick={() => selectMood(dailyMood)}>
          <span className="daily-frequency__icon" aria-hidden="true"><CalendarHeart size={21} /></span>
          <span><small>Today’s frequency</small><strong>{dailyMood.stationName}</strong></span>
          <span className="daily-frequency__number">{dailyMood.frequency}</span>
        </button>
      )}

      <div className="mood-grid" aria-label="Mood presets">
        {moods.map((mood) => (
          <button
            className={`mood-preset${mood.surprise ? ' mood-preset--surprise' : ''}`}
            type="button"
            key={mood.id}
            onClick={() => selectMood(mood)}
            aria-describedby={`mood-${mood.id}-description`}
          >
            <span className="mood-preset__icon" aria-hidden="true"><MoodIcon name={mood.icon} size={24} /></span>
            <span className="mood-preset__copy">
              <strong>{mood.label}</strong>
              <small id={`mood-${mood.id}-description`}>{mood.description}</small>
            </span>
            <span className="mood-preset__frequency" aria-hidden="true">{mood.frequency}</span>
          </button>
        ))}
      </div>

      {profile.gift.features.wisseBot && (
        <button className="assistant-callout panel" type="button" onClick={openBot}>
          <span className="assistant-callout__icon" aria-hidden="true"><Bot size={25} /></span>
          <span><strong>{profile.messages.mood.askAssistant}</strong><small>Describe the exact mix in your own words.</small></span>
        </button>
      )}
    </main>
  )
}
