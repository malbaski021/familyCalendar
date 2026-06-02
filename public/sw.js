// Family Calendar service worker — push notifications + offline read.
//
// Lifecycle:
//   1. install      — claim immediately, no precache (offline support lands in F16).
//   2. activate     — clean up old caches if any, take over open pages.
//   3. push         — render a notification from the payload.
//   4. notification click — focus or open the target URL.
//
// The server sends JSON of the shape:
//   {
//     "title": "Luka's match in 1 hour",
//     "body":  "Stadion Kraj Drine, 17:00",
//     "url":   "/en/calendar/<event-id>",
//     "tag":   "event:<event-id>",   // optional, collapses duplicates
//     "data":  { ... }                // optional, surfaced on click
//   }

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const fallbackTitle = 'Family Calendar';
  let payload = { title: fallbackTitle, body: '', url: '/' };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || fallbackTitle, {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url || '/', ...(payload.data || {}) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      // Reuse an existing tab if it matches the target URL or origin.
      for (const client of allClients) {
        const url = new URL(client.url);
        if (url.pathname === targetUrl || url.pathname.startsWith(targetUrl)) {
          await client.focus();
          return;
        }
      }
      // Otherwise open a new tab.
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
