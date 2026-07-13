import { Music2 } from 'lucide-react'
import { resolveProfileAsset } from '../../lib/assets'
import type { Track } from '../../config/schemas'

export function TrackArtwork({ track, slug }: { track: Track; slug: string }) {
  const source = resolveProfileAsset(slug, track.artwork)
  if (source) {
    return (
      <img
        className="track-artwork"
        src={source}
        alt={track.artworkAlt || `${track.title} artwork`}
        width="420"
        height="420"
        loading="lazy"
      />
    )
  }
  return (
    <div className="track-artwork track-artwork--fallback" aria-hidden="true">
      <span className="track-artwork__orbit" />
      <span className="track-artwork__label"><Music2 size={30} /></span>
    </div>
  )
}
