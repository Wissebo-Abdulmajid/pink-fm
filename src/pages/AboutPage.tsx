import { Bot, Code2, ExternalLink, Radio, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useExperience } from '../app/providers'

export default function AboutPage() {
  const { slug, profile } = useExperience()
  const { gift } = profile
  return (
    <main className="page page--narrow about-page" id="main-content">
      <p className="eyebrow">Behind the dial</p>
      <h1 className="page-heading">About {gift.station.name}</h1>
      <p className="page-intro">A personal, profile-driven radio gift built around the listener's desired feeling.</p>

      <section className="about-hero panel">
        <span className="about-hero__radio" aria-hidden="true"><Radio size={36} /></span>
        <div><h2>Mood first. Music second.</h2><p>Every recommendation compares the selected mood vector with editorial track profiles, then applies small, explainable adjustments for context, recent plays and local feedback.</p></div>
      </section>

      <section className="about-item">
        <span aria-hidden="true"><Bot /></span>
        <div>
          <h2>{gift.assistant.name}</h2>
          <p>{gift.assistant.name} is a grounded personal music and mood guide created by {gift.creator.name}. Multilingual rules handle precise instructions such as negation and follow-ups; optional semantic matching recognises paraphrases and retrieves only from this configured catalogue.</p>
          <p>Enhanced understanding runs locally in a background browser worker after the listener opts in. The lightweight rules remain available offline. Neither mode impersonates {gift.artist.name}, uses a text-generating chatbot, quotes lyrics, or invents artist facts.</p>
        </div>
      </section>

      <section className="about-item">
        <span aria-hidden="true"><ShieldCheck /></span>
        <div><h2>Local by default</h2><p>{gift.privacyNotice} There is no account, database, analytics tracker or hidden client secret. Official music destinations are opened separately; Pink FM does not host the audio.</p></div>
      </section>

      {gift.creator.showOnAboutPage && (
        <section className="creator-credit panel">
          <Code2 size={24} aria-hidden="true" />
          <p>{gift.creator.creditLabel}</p>
          <strong>{gift.creator.name}</strong>
        </section>
      )}

      <p className="disclaimer">Pink FM is an independent personal project and is not affiliated with or endorsed by the featured artist or streaming services.</p>
      <div className="about-actions">
        <Link className="button" to={`/g/${slug}/mood`}>Choose a mood</Link>
        <a className="button button--secondary" href="https://github.com/Wissebo-Abdulmajid/pink-fm" target="_blank" rel="noopener noreferrer">Project source <ExternalLink size={16} aria-hidden="true" /></a>
      </div>
    </main>
  )
}
