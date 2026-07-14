const APPLE_HOSTS = new Set(['music.apple.com', 'embed.music.apple.com'])

export const isAppleMusicUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && APPLE_HOSTS.has(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

export const appleMusicEmbedUrl = (value: string) => {
  if (!isAppleMusicUrl(value)) return null
  const url = new URL(value)
  url.hostname = 'embed.music.apple.com'
  return url.toString()
}
