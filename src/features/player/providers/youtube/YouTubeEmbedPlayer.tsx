import type { RefObject } from 'react'

export function YouTubeEmbedPlayer({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  return <div className="provider-player provider-player--youtube" ref={containerRef} aria-label="YouTube embedded player" />
}
