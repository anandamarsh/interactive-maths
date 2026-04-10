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
      const subscription = await self.registration.pushManager.getSubscription().catch(() => null);
      if (subscription) {
        await subscription.unsubscribe().catch(() => {});
      }

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
  const gamesLocalListPath = new URL("./games-local.json", SCOPE_URL).pathname;

  if (isSameOrigin && (requestUrl.pathname === gamesListPath || requestUrl.pathname === gamesLocalListPath)) {
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
