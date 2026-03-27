// Nexera Service Worker — Phase 1 skeleton
// Full offline support will be added in Phase 2

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Pass through — offline caching added in Phase 2
})

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
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
