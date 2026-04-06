const CACHE_VERSION = "interactive-maths-v4";
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
    ).then(() => self.clients.claim()),
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
  const url = resolveAppUrl(payload.url);
  const tag = payload.tag || "interactive-maths-push";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      icon: new URL("./icon-192.png", SCOPE_URL).pathname,
      badge: new URL("./icon-192.png", SCOPE_URL).pathname,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(resolveAppUrl(event.notification.data?.url), SCOPE_URL);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const scopedClients = clients.filter((client) => {
        try {
          const clientUrl = new URL(client.url);
          return clientUrl.origin === targetUrl.origin && clientUrl.pathname.startsWith(SCOPE_URL.pathname);
        } catch {
          return false;
        }
      });

      const preferredClient = scopedClients.find((client) => client.url === targetUrl.href) ?? scopedClients[0];

      if (preferredClient && "focus" in preferredClient) {
        preferredClient.navigate(targetUrl.href);
        return preferredClient.focus();
      }

      for (const client of clients) {
        if ("focus" in client && client.url === targetUrl.href) {
          client.navigate(targetUrl.href);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl.href);
      }

      return undefined;
    }),
  );
});
