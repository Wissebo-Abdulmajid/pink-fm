import { profileAssetUrl } from '../features/profiles/profile-loader'

export const resolveProfileAsset = (slug: string, path: string | null) =>
  profileAssetUrl(slug, path)

export const isAllowedEmbed = (provider: string, url: string | null) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const allowedHosts: Record<string, string[]> = {
      youtube: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'],
      spotify: ['open.spotify.com'],
      appleMusic: ['embed.music.apple.com', 'music.apple.com'],
    }
    return (allowedHosts[provider] ?? []).includes(parsed.hostname)
  } catch {
    return false
  }
}
