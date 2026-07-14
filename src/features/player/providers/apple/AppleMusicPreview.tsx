import type { RefObject } from 'react'

export function AppleMusicPreview({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  return <div className="provider-player provider-player--apple" ref={containerRef} aria-label="Apple Music preview player" />
}
