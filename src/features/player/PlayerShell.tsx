import type { ReactNode } from 'react'
import type { Track } from '../../config/schemas'

export function PlayerShell({ track, station, children }: { track: Track; station: string; children: ReactNode }) {
  return (
    <section className="player-shell" aria-labelledby="embedded-player-title">
      <div className="player-shell__display">
        <span>{station}</span>
        <h2 id="embedded-player-title">{track.title}</h2>
        <p>{track.artist}</p>
      </div>
      {children}
    </section>
  )
}
