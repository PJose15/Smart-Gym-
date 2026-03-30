// Nexera Service Worker — Phase 4 (offline cache + push)
// Bump version to invalidate old caches on deploy
const CACHE_VERSION = 1
const CACHE_NAME = `nexera-v${CACHE_VERSION}`
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/badge-72.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Cache-first for static assets (images, fonts, icons)
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Network-first for everything else
})

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    // Malformed push payload — show generic notification
    data = { title: 'Nexera', body: 'You have a new notification' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nexera', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: data.data || {},
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/home'
  event.waitUntil(clients.openWindow(url))
})
