const CACHE_VERSION = "interactive-maths-v3";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-mask512.png",
  "/icon-1024.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-opaque-1024.png",
  "/games.json",
  "/games-local.json",
];

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

      if (failures.length > 0) {
        console.error(
          "[interactive-maths sw] precache failures",
          failures.map(({ asset, result }) => ({
            asset,
            reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
          })),
        );
      } else {
        console.log("[interactive-maths sw] precache complete", { count: APP_SHELL_ASSETS.length });
      }

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
    ).then(() => {
      console.log("[interactive-maths sw] activate complete");
      return self.clients.claim();
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
          return cachedPage || caches.match("/index.html");
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
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title || "Interactive Maths";
  const body = payload.body || "You have a new notification.";
  const url = payload.url || "/";
  const tag = payload.tag || "interactive-maths-push";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
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
