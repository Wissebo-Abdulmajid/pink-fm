const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

export const isYouTubeVideoId = (value: string) => VIDEO_ID.test(value)

export const youtubeNoCookieEmbedUrl = (videoId: string) => {
  if (!isYouTubeVideoId(videoId)) return null
  return `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0`
}

export const youtubeWatchUrl = (videoId: string) =>
  isYouTubeVideoId(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : null
