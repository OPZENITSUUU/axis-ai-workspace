const CACHE_NAME = "axis-app-shell-v3";
const APP_SHELL = ["/offline.html", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("axis-app-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/oauth")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => await caches.match("/offline.html")));
    return;
  }

  event.respondWith(fetch(request).then(response => {
    if (response.ok && /\.(?:css|js|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)) {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request)));
});

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" ? payload.title : "AXIS update";
  const body = typeof payload.body === "string" ? payload.body : "Open AXIS to continue your private work.";
  const url = typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/";
  const taskId = typeof payload.taskId === "number" ? payload.taskId : "latest";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/manus-storage/axis-pwa-icon-master_e973b7d9.png",
    badge: "/manus-storage/axis-pwa-icon-master_e973b7d9.png",
    tag: `axis-task-${taskId}`,
    renotify: false,
    data: { url },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = typeof event.notification.data?.url === "string" ? event.notification.data.url : "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.focus().then(() => existing.navigate(url));
    return self.clients.openWindow(url);
  }));
});
