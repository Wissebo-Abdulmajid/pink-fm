import { Bot, Code2, Radio, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useExperience } from '../app/providers'

export default function AboutPage() {
  const { slug, profile } = useExperience()
  const { gift } = profile
  return (
    <main className="page page--narrow about-page" id="main-content">
      <p className="eyebrow">Behind the dial</p>
      <h1 className="page-heading">About {gift.station.name}</h1>
      <p className="page-intro">A personal radio gift that begins with how the listener wants to feel.</p>

      <section className="about-hero panel">
        <span className="about-hero__radio" aria-hidden="true"><Radio size={36} /></span>
        <div><h2>Mood first. Music second.</h2><p>Choose a feeling and Pink FM finds a fitting full song, with a short, human explanation for the choice.</p></div>
      </section>

      <section className="about-item">
        <span aria-hidden="true"><Bot /></span>
        <div>
          <h2>{gift.assistant.name}</h2>
          <p>{gift.assistant.name} is a warm music and mood guide created for this station. Ask in English, Malay or a natural mix of both, and it will tune only from the Pink FM collection.</p>
          <p>Its instant mode is always ready. Optional enhanced understanding works on this device only after the listener agrees to the download.</p>
        </div>
      </section>

      <section className="about-item">
        <span aria-hidden="true"><ShieldCheck /></span>
        <div><h2>Private by design</h2><p>{gift.privacyNotice} There is no account, advertising or analytics. Listening history and favourites stay in this browser. Music services connect only after consent or when an external link is chosen.</p></div>
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
      </div>
    </main>
  )
}
