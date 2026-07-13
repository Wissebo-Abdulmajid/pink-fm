import { ArrowRight, LockKeyhole, Power } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useExperience } from '../app/providers'
import { StationLogo } from '../components/common/StationLogo'
import { FrequencyScale } from '../components/radio/FrequencyScale'

export default function WelcomePage() {
  const { slug, profile, playSound, profileSource } = useExperience()
  const navigate = useNavigate()
  const { gift, messages } = profile
  const recipientGreeting =
    gift.recipient.showName && gift.recipient.displayName
      ? gift.recipient.privateGreeting || `A frequency for ${gift.recipient.displayName}`
      : null

  return (
    <main className="welcome" id="main-content">
      <section className="welcome__content" aria-labelledby="welcome-heading">
        <StationLogo name={gift.station.name} />
        <div className="welcome__prepared">
          <span className="welcome__on-light" aria-hidden="true" />
          {messages.welcome.preparedFor}
        </div>
        {recipientGreeting && <p className="welcome__recipient">{recipientGreeting}</p>}
        <h1 id="welcome-heading">{gift.station.welcomeHeading}</h1>
        <p className="welcome__message">{gift.station.welcomeMessage}</p>
        <FrequencyScale label={messages.welcome.frequencyAriaLabel} value={47} />
        <button
          className="welcome__tune button"
          type="button"
          onClick={() => {
            playSound('power')
            void navigate(`/g/${slug}/mood`)
          }}
        >
          <span className="welcome__power" aria-hidden="true"><Power size={25} /></span>
          <span>{messages.welcome.tuneIn}<small>{gift.station.frequencyLabel} FM</small></span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <div className="welcome__privacy">
          <LockKeyhole size={15} aria-hidden="true" />
          <span>{gift.privacyNotice}</span>
          {profileSource === 'cache' && <span className="welcome__offline">Offline copy</span>}
        </div>
        {gift.creator.showInMainExperience && (
          <small>{gift.creator.creditLabel} {gift.creator.name}</small>
        )}
      </section>
      <div className="welcome__speaker" aria-hidden="true">
        <span className="welcome__speaker-center" />
      </div>
    </main>
  )
}
