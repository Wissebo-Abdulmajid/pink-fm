import { Radio } from 'lucide-react'

export function LoadingTuner({ heading, message }: { heading: string; message: string }) {
  return (
    <main className="loader" aria-busy="true" aria-live="polite">
      <div className="loader__radio" aria-hidden="true">
        <Radio size={38} />
        <span className="loader__signal loader__signal--one" />
        <span className="loader__signal loader__signal--two" />
      </div>
      <h1>{heading}</h1>
      <p>{message}</p>
      <div className="loader__dial" aria-hidden="true"><span /></div>
    </main>
  )
}
