const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const envVapidPublicKey = import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY;

let vapidPublicKeyPromise: Promise<string> | null = null;

type SerializedPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

type AppPushMetadata = {
  appId: string;
  appName: string;
  appOrigin: string;
  appScope: string;
};

function getAppPushMetadata(): AppPushMetadata {
  const scopeUrl = new URL("./", window.location.href);
  return {
    appId: "see-maths",
    appName: "See Maths",
    appOrigin: window.location.origin,
    appScope: scopeUrl.href,
  };
}

function requirePushConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Push notifications are not configured for this app.");
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (data && typeof data === "object") {
    const error =
      "error" in data && typeof data.error === "string"
        ? data.error
        : fallback;
    const details =
      "details" in data && typeof data.details === "string"
        ? data.details
        : "";
    return details ? `${error}: ${details}` : error;
  }

  return fallback;
}

async function loadVapidPublicKey() {
  if (envVapidPublicKey) {
    return envVapidPublicKey;
  }

  if (!vapidPublicKeyPromise) {
    vapidPublicKeyPromise = fetch(`${supabaseUrl}/functions/v1/push-config`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Failed to load push configuration."));
        }

        const data = await response.json().catch(() => ({}));
        if (typeof data.vapidPublicKey !== "string" || !data.vapidPublicKey) {
          throw new Error("Push configuration is incomplete.");
        }

        return data.vapidPublicKey;
      })
      .catch((error) => {
        vapidPublicKeyPromise = null;
        throw error;
      });
  }

  return vapidPublicKeyPromise;
}

function base64UrlToUint8Array(input: string) {
  const padding = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  const scopeUrl = new URL("./", window.location.href);
  const scriptUrl = new URL("./sw.js", window.location.href);

  const waitForWorkerActivation = (worker: ServiceWorker) =>
    new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        worker.removeEventListener("statechange", handleStateChange);
        reject(new Error("Service worker activation timed out."));
      }, 10000);

      const handleStateChange = () => {
        if (worker.state === "activated") {
          window.clearTimeout(timeoutId);
          worker.removeEventListener("statechange", handleStateChange);
          resolve();
          return;
        }

        if (worker.state === "redundant") {
          window.clearTimeout(timeoutId);
          worker.removeEventListener("statechange", handleStateChange);
          reject(new Error("Service worker became redundant before activation."));
        }
      };

      worker.addEventListener("statechange", handleStateChange);
      handleStateChange();
    });

  let registration = await navigator.serviceWorker.getRegistration(scopeUrl.href);
  if (!registration) {
    registration = await navigator.serviceWorker.register(scriptUrl.pathname, {
      scope: scopeUrl.pathname,
      updateViaCache: "none",
    });
  }

  const pendingWorker = registration.installing ?? registration.waiting;
  if (pendingWorker) {
    await waitForWorkerActivation(pendingWorker);
  } else if (!registration.active) {
    const readyRegistration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Service worker ready timed out.")), 10000);
      }),
    ]).catch(() => null);

    if (readyRegistration) {
      registration = readyRegistration;
    }
  }

  registration = (await navigator.serviceWorker.getRegistration(scopeUrl.href)) ?? registration;
  if (!registration.active) {
    throw new Error("Push subscription requires an active service worker.");
  }

  return registration;
}

function serializePushSubscription(subscription: PushSubscription): SerializedPushSubscription {
  const payload = subscription.toJSON();

  if (!payload.endpoint || !payload.keys?.auth || !payload.keys?.p256dh) {
    throw new Error("Push subscription is missing required keys.");
  }

  return {
    endpoint: payload.endpoint,
    expirationTime: payload.expirationTime ?? null,
    keys: {
      auth: payload.keys.auth,
      p256dh: payload.keys.p256dh,
    },
  };
}

async function savePushSubscription(subscription: PushSubscription) {
  const payload = serializePushSubscription(subscription);
  const app = getAppPushMetadata();
  const response = await fetch(`${supabaseUrl}/functions/v1/save-push-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ subscription: payload, app }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to save push subscription."));
  }

  return payload;
}

async function deletePushSubscription(endpoint: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/save-push-subscription`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to delete push subscription."));
  }
}

export async function ensurePushSubscription() {
  requirePushConfig();

  if (!("PushManager" in window)) {
    throw new Error("This browser does not support push notifications.");
  }

  const vapidPublicKey = await loadVapidPublicKey();
  const registration = await getRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await savePushSubscription(existing);
    return existing;
  }

  const subscribeOptions = {
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
  } satisfies PushSubscriptionOptionsInit;
  const subscription = await registration.pushManager.subscribe(subscribeOptions);

  await savePushSubscription(subscription);
  return subscription;
}

async function renewPushSubscription() {
  const registration = await getRegistration();
  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    await existing.unsubscribe().catch(() => {});
  }

  return ensurePushSubscription();
}

export async function disablePushSubscription() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const scopeUrl = new URL("./", window.location.href);
  const registration =
    (await navigator.serviceWorker.getRegistration(scopeUrl.href)) ??
    (await navigator.serviceWorker.getRegistration());

  if (!registration) {
    return;
  }

  const existing = await registration.pushManager.getSubscription();
  if (!existing) {
    return;
  }

  const endpoint = existing.endpoint;
  await existing.unsubscribe().catch(() => {});
  await deletePushSubscription(endpoint).catch((error) => {
    console.warn("Failed to remove push subscription from server", error);
  });
}

export async function sendTestPush() {
  requirePushConfig();

  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Notifications are not available in this browser.");
  }

  if (Notification.permission !== "granted") {
    throw new Error("Enable notifications first.");
  }

  const app = getAppPushMetadata();
  const send = async (subscription: PushSubscription) =>
    fetch(`${supabaseUrl}/functions/v1/test-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        subscription: serializePushSubscription(subscription),
        title: app.appName,
        body: "Push notifications are working.",
        url: app.appScope,
        app,
      }),
    });

  let subscription = await ensurePushSubscription();
  let response = await send(subscription);

  if (!response.ok && response.status !== 400) {
    subscription = await renewPushSubscription();
    response = await send(subscription);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to send test push."));
  }
}
