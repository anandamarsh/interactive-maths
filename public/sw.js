const CACHE_VERSION = "see-maths-v2";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const SCOPE_URL = new URL(self.registration.scope);
const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-mask512.png",
  "./icon-1024.png",
  "./apple-touch-icon.png",
  "./apple-touch-icon-opaque-1024.png",
].map((asset) => new URL(asset, SCOPE_URL).pathname);

function resolveAppUrl(candidate) {
  try {
    const resolved = new URL(candidate || "./", SCOPE_URL);
    const sameOrigin = resolved.origin === SCOPE_URL.origin;
    const inScope = resolved.pathname.startsWith(SCOPE_URL.pathname);
    return sameOrigin && inScope ? resolved.href : SCOPE_URL.href;
  } catch {
    return SCOPE_URL.href;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      const results = await Promise.allSettled(
        APP_SHELL_ASSETS.map(async (asset) => {
          const response = await fetch(asset, { cache: "no-cache" });
          if (!response.ok) {
            throw new Error(`Failed to cache ${asset} (${response.status})`);
          }

          await cache.put(asset, response);
          return asset;
        }),
      );

      const failures = results
        .map((result, index) => ({ result, asset: APP_SHELL_ASSETS[index] }))
        .filter(({ result }) => result.status === "rejected");

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ).then(async () => {
      const notifications = await self.registration.getNotifications().catch(() => []);
      await Promise.all(notifications.map((notification) => notification.close()));
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const wantsHtml = event.request.mode === "navigate";
  const gamesListPath = new URL("./games.json", SCOPE_URL).pathname;

  if (isSameOrigin && requestUrl.pathname === gamesListPath) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (wantsHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          return cachedPage || caches.match(new URL("./index.html", SCOPE_URL).pathname);
        }),
    );
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, responseClone));
          return response;
        });
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const data = typeof payload === "object" && payload !== null ? payload : {};
  const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title : "See Maths";
  const body =
    typeof data.body === "string" && data.body.trim().length > 0
      ? data.body
      : "You have a new See Maths notification.";
  const url = typeof data.url === "string" && data.url.trim().length > 0 ? data.url : SCOPE_URL.href;
  const tag = typeof data.tag === "string" && data.tag.trim().length > 0 ? data.tag : "see-maths-notification";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: new URL("./icon-512.png", SCOPE_URL).pathname,
      badge: new URL("./favicon.svg", SCOPE_URL).pathname,
      tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveAppUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url === targetUrl) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
