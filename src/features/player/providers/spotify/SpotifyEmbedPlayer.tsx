import type { RefObject } from 'react'

export function SpotifyEmbedPlayer({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  return <div className="provider-player provider-player--spotify" ref={containerRef} aria-label="Spotify embedded player" />
}
