import type { ReactNode } from 'react'
import type { Track } from '../../config/schemas'
import { playbackStatusLabel, selectPrimaryFullPlaybackSource } from '../recommendations/full-playback'

export function PlayerShell({ track, station, children }: { track: Track; station: string; children: ReactNode }) {
  const source = selectPrimaryFullPlaybackSource(track)
  return (
    <section className="player-shell" aria-labelledby="embedded-player-title">
      <div className="player-shell__display">
        <span>{station}</span>
        <h2 id="embedded-player-title">{track.title}</h2>
        <p>{track.artist}</p>
        <p className="player-shell__coverage">
          <strong>{playbackStatusLabel(track)}</strong>
          {source ? <span>Playback via official YouTube source</span> : null}
        </p>
        {source && ['live', 'acoustic', 'alternate'].includes(source.version) ? (
          <p className="player-shell__version">Official {source.version} version</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
