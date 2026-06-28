self.addEventListener('push', function (event) {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {
      title: 'ResidentPass',
      body: event.data ? event.data.text() : '',
    }
  }

  const title = data.title || 'ResidentPass'
  const options = {
    body: data.body || '',
    icon: '/branding/icons/icon-192.png',
    badge: '/branding/icons/icon-192.png',
    data: { url: data.url || '/dashboard/notifications' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const url = event.notification.data?.url || '/dashboard/notifications'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      }),
  )
})
