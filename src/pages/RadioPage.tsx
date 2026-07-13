import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Bot, BookmarkPlus, Gauge, RotateCw, Volume2 } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { useExperience } from '../app/providers'
import { RecommendationFeedback } from '../components/feedback/RecommendationFeedback'
import { MoodIcon } from '../components/common/MoodIcon'
import { FrequencyScale } from '../components/radio/FrequencyScale'
import { TrackArtwork } from '../components/radio/TrackArtwork'
import { PlaybackAction } from '../features/player/PlaybackAction'
import type { LayoutOutletContext } from '../layouts/AppLayout'
import { clamp } from '../lib/utils'

export default function RadioPage() {
  const {
    slug,
    profile,
    listener,
    recommendation,
    currentTarget,
    tuneMood,
    tuneTarget,
    chooseAnother,
    saveCurrentPreset,
    setSoundVolume,
    playSound,
  } = useExperience()
  const outletContext = useOutletContext<LayoutOutletContext | undefined>()
  const openBot = outletContext?.openBot ?? (() => undefined)
  const didAutoTune = useRef(false)
  const [pendingDialEnergy, setPendingDialEnergy] = useState<number | null>(null)

  useEffect(() => {
    if (!recommendation && !didAutoTune.current) {
      const firstMood = profile.moods.moods[0]
      if (firstMood) {
        didAutoTune.current = true
        tuneMood(firstMood)
      }
    }
  }, [profile.moods.moods, recommendation, tuneMood])

  const commitEnergy = () => {
    const dialEnergy = pendingDialEnergy ?? currentTarget?.energised ?? 50
    if (!currentTarget || dialEnergy === currentTarget.energised) return
    const target = {
      ...currentTarget,
      energised: dialEnergy,
      happy: clamp(currentTarget.happy + (dialEnergy - currentTarget.energised) * 0.3),
      peaceful: clamp(currentTarget.peaceful - (dialEnergy - currentTarget.energised) * 0.25),
    }
    tuneTarget(target, { context: { minEnergy: Math.max(0, dialEnergy - 26) } })
    setPendingDialEnergy(null)
  }

  if (!recommendation) {
    return <main className="page radio-page" id="main-content" aria-busy="true"><p>Tuning the first recommendation…</p></main>
  }

  const dialEnergy = pendingDialEnergy ?? currentTarget?.energised ?? 50
  const needle = 8 + (dialEnergy / 100) * 84

  return (
    <main className="page radio-page" id="main-content">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Recommended {recommendation.track.title} by {recommendation.track.artist}. {recommendation.primaryReasons.join(' ')}
      </div>

      <section className="retro-radio" aria-labelledby="now-playing-title">
        <div className="retro-radio__handle" aria-hidden="true" />
        <div className="retro-radio__topline">
          <span className="retro-radio__brand">{profile.gift.station.shortName}</span>
          <span className="on-air"><i aria-hidden="true" /> ON AIR</span>
        </div>

        <div className="retro-radio__body">
          <div className="speaker-panel" aria-hidden="true">
            <span className="speaker-panel__ring" />
            <span className="speaker-panel__centre" />
          </div>

          <div className="radio-console">
            <div className="illuminated-display">
              <div className="illuminated-display__station">
                <span>{profile.messages.radio.nowTuned}</span>
                <strong>{recommendation.stationName}</strong>
                <b>{recommendation.frequency}</b>
              </div>
              <FrequencyScale label={`Tuned to ${recommendation.frequency} FM`} value={needle} compact />
              <div className="illuminated-display__track">
                <span>{recommendation.matchPercentage}% {profile.messages.radio.matchLabel}</span>
                <h1 id="now-playing-title">{recommendation.track.title}</h1>
                <p>{recommendation.track.artist}</p>
              </div>
            </div>

            <div className="radio-controls">
              <div className="tuning-control">
                <label htmlFor="energy-dial">{profile.messages.radio.energyLabel}</label>
                <div className="tuning-knob" style={{ '--dial-rotation': `${-130 + dialEnergy * 2.6}deg` } as CSSProperties} aria-hidden="true">
                  <span />
                </div>
                <input
                  id="energy-dial"
                  className="energy-range"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={dialEnergy}
                  onChange={(event) => {
                    setPendingDialEnergy(Number(event.target.value))
                    playSound('tick')
                  }}
                  onPointerUp={commitEnergy}
                  onKeyUp={(event) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commitEnergy()
                  }}
                  aria-valuetext={`${dialEnergy}% energy`}
                />
                <output htmlFor="energy-dial">{dialEnergy}%</output>
              </div>

              <div className="volume-control">
                <label htmlFor="tone-volume"><Volume2 size={16} aria-hidden="true" /> Interface tone</label>
                <input
                  id="tone-volume"
                  type="range"
                  min="0"
                  max="100"
                  value={listener.soundVolume}
                  onChange={(event) => setSoundVolume(Number(event.target.value))}
                  onPointerUp={() => playSound('click')}
                  aria-valuetext={`${listener.soundVolume}% interface tone volume; this does not control music playback`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="radio-presets" aria-label="Quick mood presets">
          {profile.moods.moods.slice(0, 5).map((mood, index) => (
            <button type="button" key={mood.id} onClick={() => tuneMood(mood)} aria-label={`Preset ${index + 1}: ${mood.label}`}>
              <span>{index + 1}</span><MoodIcon name={mood.icon} size={15} /><small>{mood.label}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="recommendation-card panel" aria-labelledby="recommendation-heading">
        <TrackArtwork track={recommendation.track} slug={slug} />
        <div className="recommendation-card__copy">
          <p className="eyebrow" id="recommendation-heading"><Gauge size={14} aria-hidden="true" /> Why this frequency</p>
          {recommendation.primaryReasons.map((reason) => <p key={reason}>{reason}</p>)}
          <p className="recommendation-editorial">{recommendation.track.editorialNote}</p>
          <div className="mood-tags" aria-label="Matched moods">
            {recommendation.matchedMoods.slice(0, 4).map((mood) => <span key={mood}>{mood}</span>)}
          </div>
          <PlaybackAction track={recommendation.track} />
        </div>
      </section>

      <RecommendationFeedback />

      <div className="radio-secondary-actions">
        <button className="button button--secondary" type="button" onClick={() => chooseAnother()}>
          <RotateCw size={18} aria-hidden="true" /> {profile.messages.radio.another}
        </button>
        <button className="button button--secondary" type="button" onClick={saveCurrentPreset}>
          <BookmarkPlus size={18} aria-hidden="true" /> Save this mix
        </button>
        {profile.gift.features.wisseBot && (
          <button className="button button--secondary" type="button" onClick={openBot}>
            <Bot size={18} aria-hidden="true" /> Fine-tune with {profile.gift.assistant.name}
          </button>
        )}
      </div>
    </main>
  )
}
