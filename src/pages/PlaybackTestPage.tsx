import { useMemo, useState } from 'react'
import type { FullPlaybackSource, Track } from '../config/schemas'
import { useExperience } from '../app/providers'
import EmbeddedRadioPlayer from '../features/player/EmbeddedRadioPlayer'
import { fullPlaybackSourcesForRadio, isRadioEligible } from '../features/recommendations/full-playback'

const simulatedFailureVideoId = 'aaaaaaaaaaa'

const withSource = (track: Track, source: FullPlaybackSource): Track => ({
  ...track,
  playback: {
    ...track.playback,
    preferredProvider: 'youtube',
    youtube: {
      videoId: source.videoId,
      verifiedOfficial: true,
      sourceId: source.provenanceSourceId,
    },
  },
  fullPlaybackSources: [source],
})

const withSimulatedPrimaryFailure = (track: Track): Track => {
  const sources = fullPlaybackSourcesForRadio(track)
  const backup = sources[1] ?? sources[0]
  if (!backup) return track
  const failingPrimary: FullPlaybackSource = {
    ...backup,
    id: `${track.id}-simulated-unavailable-primary`,
    videoId: simulatedFailureVideoId,
    sourceUrl: `https://www.youtube.com/watch?v=${simulatedFailureVideoId}`,
    priority: 1,
  }
  return {
    ...track,
    playback: {
      ...track.playback,
      preferredProvider: 'youtube',
      youtube: {
        videoId: failingPrimary.videoId,
        verifiedOfficial: true,
        sourceId: failingPrimary.provenanceSourceId,
      },
    },
    fullPlaybackSources: [failingPrimary, { ...backup, priority: 2 }],
  }
}

export default function PlaybackTestPage() {
  const { profile } = useExperience()
  const fullTracks = useMemo(
    () => profile.tracks.tracks.filter((track) => isRadioEligible(track)).slice(0, 12),
    [profile.tracks.tracks],
  )
  const [selected, setSelected] = useState<Track | null>(fullTracks[0] ?? null)
  const selectedSources = selected ? fullPlaybackSourcesForRadio(selected) : []
  const backupSource = selectedSources[1] ?? null
  const nearestRetune = fullTracks.find((track) => track.id !== selected?.id) ?? null

  return (
    <main id="main-content" className="page playback-test-page">
      <section className="section-card">
        <p className="eyebrow">Manual QA only</p>
        <h1>Full-song YouTube playback test</h1>
        <p>
          This hidden route lists representative verified primary and backup sources.
          It is excluded from normal navigation and never exposes credentials.
        </p>
        <p>
          Real YouTube readiness, playing, paused, ended and error states depend on
          the provider script loading in this browser.
        </p>
      </section>

      {selected && (
        <section className="section-card">
          <h2>Selected source</h2>
          <dl className="playback-test-page__details">
            <div><dt>Track</dt><dd>{selected.title}</dd></div>
            <div><dt>Artist</dt><dd>{selected.artist}</dd></div>
            <div><dt>Video ID</dt><dd>{selectedSources[0]?.videoId ?? 'none'}</dd></div>
            <div><dt>Authority</dt><dd>{selectedSources[0]?.authority ?? 'none'}</dd></div>
            <div><dt>Version</dt><dd>{selectedSources[0]?.version ?? 'none'}</dd></div>
            <div><dt>Backup sources</dt><dd>{Math.max(0, selectedSources.length - 1)}</dd></div>
          </dl>
          <div className="playback-test-page__actions">
            <button type="button" onClick={() => setSelected(withSimulatedPrimaryFailure(selected))}>
              Simulate primary-source failure
            </button>
            {backupSource && (
              <button type="button" onClick={() => setSelected(withSource(selected, backupSource))}>
                Test backup source only
              </button>
            )}
            {nearestRetune && (
              <button type="button" onClick={() => setSelected(nearestRetune)}>
                Retune to nearest full song
              </button>
            )}
          </div>
        </section>
      )}

      {selected && <EmbeddedRadioPlayer track={selected} station="Playback QA" />}

      <section className="section-card">
        <h2>Representative sources</h2>
        <ul className="playback-test-page__source-list">
          {fullTracks.map((track) => {
            const sources = fullPlaybackSourcesForRadio(track)
            const primary = sources[0]
            return (
              <li key={track.id}>
                <button type="button" onClick={() => setSelected(track)}>
                  <strong>{track.title}</strong>
                  <span>{primary?.videoId ?? 'missing'} · {primary?.authority ?? 'unknown'} · {primary?.version ?? 'unknown'}</span>
                  <small>{sources.length > 1 ? `${sources.length - 1} backup source(s)` : 'no backup source'}</small>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
