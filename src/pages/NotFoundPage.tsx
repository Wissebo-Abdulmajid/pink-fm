import { Radio } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <main className="error-screen">
      <div className="error-screen__mark" aria-hidden="true"><Radio /></div>
      <p className="eyebrow">Off the dial</p>
      <h1>This frequency is quiet</h1>
      <p>The address does not point to an active Pink FM screen.</p>
      <a className="button" href="#/g/siti">Tune to Pink FM</a>
    </main>
  )
}
