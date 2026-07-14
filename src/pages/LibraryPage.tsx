import { useDeferredValue, useMemo, useState, type CSSProperties } from 'react'
import { BarChart3, Clock3, Disc3, Heart, Radio, Search, Trash2, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useExperience } from '../app/providers'
import type { StreamingService } from '../config/schemas'
import { formatHistoryTime } from '../lib/time'

const serviceOrder: StreamingService[] = ['spotify', 'youtube', 'appleMusic']
const externalProvider = (service: StreamingService | undefined) =>
  service === 'spotify' ? 'spotify-embed' as const
    : service === 'youtube' ? 'youtube-embed' as const
      : service === 'appleMusic' ? 'apple-preview' as const
        : 'external' as const

export default function LibraryPage() {
  const { slug, profile, listener, tuneTarget, clearHistory, recordPlaybackEvent } = useExperience()
  const navigate = useNavigate()
  const tracksById = new Map(profile.tracks.tracks.map((track) => [track.id, track]))
  const lovedTracks = listener.lovedTrackIds.flatMap((id) => {
    const track = tracksById.get(id)
    return track ? [track] : []
  })
  const recent = listener.listeningHistory.slice(0, 8)
  const mostRequestedMood = Object.entries(listener.moodSelectionCounts).sort((a, b) => b[1] - a[1])[0]
  const mostPlayed = Object.entries(listener.playCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const favouriteStation = Object.entries(listener.favouriteStationCounts).sort((a, b) => b[1] - a[1])[0]
  const insightMax = Math.max(1, mostRequestedMood?.[1] ?? 1, favouriteStation?.[1] ?? 1)
  const [catalogueQuery, setCatalogueQuery] = useState('')
  const [collectionId, setCollectionId] = useState('all')
  const [visibleCount, setVisibleCount] = useState(24)
  const deferredQuery = useDeferredValue(catalogueQuery.trim().toLocaleLowerCase('en'))
  const activeCollections = profile.collections.collections.filter((collection) => collection.active)
  const catalogueTracks = useMemo(
    () => profile.tracks.tracks
      .filter((track) => track.active)
      .filter((track) => collectionId === 'all' || track.collections.includes(collectionId))
      .filter((track) => {
        if (!deferredQuery) return true
        return [
          track.title,
          track.artist,
          track.album,
          track.era,
          ...track.featuredArtists,
          ...track.tags,
          ...track.vocalCharacter,
        ].join(' ').toLocaleLowerCase('en').includes(deferredQuery)
      })
      .sort((left, right) =>
        Number(right.curationStatus === 'reviewed') - Number(left.curationStatus === 'reviewed') ||
        right.familiarity - left.familiarity ||
        left.title.localeCompare(right.title),
      ),
    [collectionId, deferredQuery, profile.tracks.tracks],
  )
  const preferredServices = [
    listener.selectedStreamingService,
    ...serviceOrder.filter((service) => service !== listener.selectedStreamingService),
  ]

  return (
    <main className="page library-page" id="main-content">
      <p className="eyebrow">Local listening memory</p>
      <h1 className="page-heading">{profile.messages.library.heading}</h1>
      <p className="page-intro">{profile.messages.library.intro}</p>

      <section className="library-section panel catalogue-browser" aria-labelledby="catalogue-heading">
        <div className="section-heading">
          <span aria-hidden="true"><Disc3 size={19} /></span>
          <h2 id="catalogue-heading">Explore the catalogue</h2>
          <small>{catalogueTracks.length}</small>
        </div>
        <p className="catalogue-browser__intro">
          Browse verified titles, albums and data-driven collections. Internal provenance notes stay out of the listening view.
        </p>
        <div className="catalogue-filters">
          <label className="field" htmlFor="catalogue-search">
            <span>Search title, album or artist</span>
            <span className="catalogue-search-control">
              <Search size={17} aria-hidden="true" />
              <input
                className="input"
                id="catalogue-search"
                type="search"
                value={catalogueQuery}
                onChange={(event) => setCatalogueQuery(event.target.value)}
                placeholder={`Search ${profile.tracks.tracks.filter((track) => track.active).length} tracks`}
              />
            </span>
          </label>
          <label className="field" htmlFor="catalogue-collection">
            <span>Collection</span>
            <select
              className="select"
              id="catalogue-collection"
              value={collectionId}
              onChange={(event) => {
                setCollectionId(event.target.value)
                setVisibleCount(24)
              }}
            >
              <option value="all">All active collections</option>
              {activeCollections.map((collection) => (
                <option value={collection.id} key={collection.id}>{collection.label}</option>
              ))}
            </select>
          </label>
        </div>
        {catalogueTracks.length > 0 ? (
          <ul className="catalogue-list" aria-label="Catalogue search results">
            {catalogueTracks.slice(0, visibleCount).map((track) => {
              const service = preferredServices.find((item) => track.officialLinks[item])
              const link = service ? track.officialLinks[service] : ''
              return (
                <li key={track.id}>
                  <span className="catalogue-list__number" aria-hidden="true">{String(profile.tracks.tracks.findIndex((item) => item.id === track.id) + 1).padStart(3, '0')}</span>
                  <span className="catalogue-list__copy">
                    <strong>{track.title}</strong>
                    <small>
                      {track.artist}{track.album ? ` · ${track.album}` : ''}{track.releaseYear ? ` · ${track.releaseYear}` : ''}
                    </small>
                    <span>
                      {track.curationStatus === 'reviewed' ? 'Reviewed' : 'Metadata verified'}
                      {track.versionType !== 'studio' ? ` · ${track.versionType}` : ''}
                    </span>
                  </span>
                  <span className="catalogue-list__actions">
                    <button
                      type="button"
                      onClick={() => {
                        tuneTarget(track.moods, {
                          stationName: track.collections[0]?.replace(/-/g, ' ') ?? 'Catalogue Select',
                          frequency: 'CAT',
                          moodId: 'catalogue',
                          context: { requestedTrackId: track.id, artistPolicy: profile.gift.artistPolicy },
                        })
                        void navigate(`/g/${slug}/radio`)
                      }}
                    >
                      Tune<span className="sr-only"> {track.title}</span>
                    </button>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => recordPlaybackEvent('externally-opened', track.id, externalProvider(service))}>
                        Listen<span className="sr-only"> to {track.title}</span>
                      </a>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="empty-state">No catalogue track matches that search and collection.</p>
        )}
        {catalogueTracks.length > visibleCount && (
          <button className="button button--secondary catalogue-more" type="button" onClick={() => setVisibleCount((count) => count + 24)}>
            Show more tracks
          </button>
        )}
      </section>

      <div className="library-grid">
        <section className="library-section panel" aria-labelledby="loved-heading">
          <div className="section-heading">
            <span aria-hidden="true"><Heart size={19} /></span>
            <h2 id="loved-heading">{profile.messages.library.loved}</h2>
            <small>{lovedTracks.length}</small>
          </div>
          {lovedTracks.length ? (
            <ul className="record-list">
              {lovedTracks.map((track) => {
                const service = serviceOrder.find((item) => track.officialLinks[item])
                const link = service ? track.officialLinks[service] : ''
                return (
                  <li key={track.id}>
                    <span className="record-list__disc" aria-hidden="true" />
                    <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => recordPlaybackEvent('externally-opened', track.id, externalProvider(service))}>
                        Listen<span className="sr-only"> to {track.title}</span>
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : <p className="empty-state">{profile.messages.library.empty}</p>}
        </section>

        <section className="library-section panel" aria-labelledby="presets-heading">
          <div className="section-heading">
            <span aria-hidden="true"><Radio size={19} /></span>
            <h2 id="presets-heading">Saved mood presets</h2>
            <small>{listener.savedPresets.length}</small>
          </div>
          {listener.savedPresets.length ? (
            <div className="saved-presets">
              {listener.savedPresets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => {
                    tuneTarget(preset.target, { stationName: preset.label, frequency: 'SVD', moodId: preset.id })
                    void navigate(`/g/${slug}/radio`)
                  }}
                >
                  <span aria-hidden="true">FM</span><strong>{preset.label}</strong><small>{preset.target.energised}% energy</small>
                </button>
              ))}
            </div>
          ) : <p className="empty-state">Fine-tune a recommendation, then save the mix from the radio.</p>}
        </section>
      </div>

      {profile.gift.features.listeningStats && (
        <section className="library-section panel insights" aria-labelledby="insights-heading">
          <div className="section-heading">
            <span aria-hidden="true"><BarChart3 size={19} /></span>
            <h2 id="insights-heading">{profile.messages.library.insights}</h2>
          </div>
          <div className="meter-list">
            <div className="retro-meter">
              <span><Trophy size={16} aria-hidden="true" /> Most requested mood</span>
              <strong>{mostRequestedMood?.[0]?.replace(/-/g, ' ') ?? 'Not enough listening yet'}</strong>
              <i style={{ '--meter': `${((mostRequestedMood?.[1] ?? 0) / insightMax) * 100}%` } as CSSProperties} />
            </div>
            <div className="retro-meter">
              <span><Radio size={16} aria-hidden="true" /> Favourite station</span>
              <strong>{favouriteStation?.[0] ?? 'Not enough listening yet'}</strong>
              <i style={{ '--meter': `${((favouriteStation?.[1] ?? 0) / insightMax) * 100}%` } as CSSProperties} />
            </div>
            <div className="retro-meter">
              <span><Clock3 size={16} aria-hidden="true" /> Most played</span>
              <strong>{mostPlayed.length ? mostPlayed.map(([id, count]) => `${tracksById.get(id)?.title ?? id} · ${count}`).join(' / ') : 'No external plays recorded'}</strong>
              <i style={{ '--meter': `${Math.min(100, (mostPlayed[0]?.[1] ?? 0) * 20)}%` } as CSSProperties} />
            </div>
          </div>
        </section>
      )}

      <section className="library-section panel" aria-labelledby="recent-heading">
        <div className="section-heading">
          <span aria-hidden="true"><Clock3 size={19} /></span>
          <h2 id="recent-heading">{profile.messages.library.recent}</h2>
          {recent.length > 0 && (
            <button className="section-heading__action" type="button" onClick={clearHistory}>
              <Trash2 size={15} aria-hidden="true" /> Clear
            </button>
          )}
        </div>
        {recent.length ? (
          <ol className="history-list">
            {recent.map((entry, index) => {
              const track = tracksById.get(entry.trackId)
              return (
                <li key={`${entry.trackId}-${entry.timestamp}-${index}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span><strong>{track?.title ?? entry.trackId}</strong><small>{entry.stationName} · {formatHistoryTime(entry.timestamp)}</small></span>
                </li>
              )
            })}
          </ol>
        ) : <p className="empty-state">{profile.messages.library.empty}</p>}
      </section>
    </main>
  )
}
