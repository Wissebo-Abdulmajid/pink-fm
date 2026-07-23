const CACHE_VERSION = 'pink-fm-v6'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const PROFILE_CACHE = `${CACHE_VERSION}-profiles`

const scopedUrl = (path) => new URL(path, self.registration.scope).toString()
const APP_SHELL = [
  './',
  'tap/',
  'offline.html',
  'manifest.webmanifest',
  'icons/pink-fm.svg',
  'icons/pink-fm-192.png',
  'icons/pink-fm-512.png',
  'icons/pink-fm-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL.map(scopedUrl))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('pink-fm-') && ![SHELL_CACHE, PROFILE_CACHE].includes(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

const networkFirst = async (request, cacheName, forceFresh = false) => {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request, forceFresh ? { cache: 'no-cache' } : undefined)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  return cached ?? (await network) ?? Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Provider scripts, iframe pages, media, authentication and cookies remain entirely
  // outside Pink FM's caches. The service worker only handles same-origin app resources.
  if (url.origin !== self.location.origin) return

  if (
    url.pathname.includes('/gifts/') &&
    (url.pathname.endsWith('.json') || url.pathname.includes('/embeddings/'))
  ) {
    const isTrackCatalogue = url.pathname.endsWith('/tracks.json')
    event.respondWith(networkFirst(request, PROFILE_CACHE, isTrackCatalogue))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, SHELL_CACHE).catch(async () =>
        (await caches.match(scopedUrl('./'))) ?? caches.match(scopedUrl('offline.html')),
      ),
    )
    return
  }

  const staticDestinations = new Set(['style', 'script', 'worker', 'font', 'image', 'manifest'])
  if (staticDestinations.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
