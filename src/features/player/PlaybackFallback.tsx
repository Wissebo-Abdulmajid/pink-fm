export function PlaybackFallback({ offline }: { offline: boolean }) {
  return offline
    ? <p className="playback-network-note" role="status">Music playback requires an internet connection.</p>
    : <p className="playback-network-note">Provider availability can vary by account, browser, region, cookies, and content blockers.</p>
}
