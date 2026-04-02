const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const envVapidPublicKey = import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY;

let vapidPublicKeyPromise: Promise<string> | null = null;

function pushLog(step: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[interactive-maths push] ${step}`);
    return;
  }

  console.log(`[interactive-maths push] ${step}`, details);
}

function describeWorker(worker: ServiceWorker | null | undefined) {
  if (!worker) {
    return null;
  }

  return {
    scriptURL: worker.scriptURL,
    state: worker.state,
  };
}

async function describeSubscription(
  subscription: PushSubscription | null,
): Promise<null | {
  endpoint: string;
  expirationTime: number | null;
  hasAuthKey: boolean;
  hasP256dhKey: boolean;
}> {
  if (!subscription) {
    return null;
  }

  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint ?? "",
    expirationTime: json.expirationTime ?? null,
    hasAuthKey: Boolean(json.keys?.auth),
    hasP256dhKey: Boolean(json.keys?.p256dh),
  };
}

type SerializedPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

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
    pushLog("using VAPID key from env");
    return envVapidPublicKey;
  }

  if (!vapidPublicKeyPromise) {
    pushLog("loading VAPID key from push-config");
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

        pushLog("received VAPID key from push-config");
        return data.vapidPublicKey;
      })
      .catch((error) => {
        vapidPublicKeyPromise = null;
        pushLog("failed to load VAPID key", error);
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

  pushLog("service worker environment", {
    controller: describeWorker(navigator.serviceWorker.controller),
  });

  const waitForWorkerActivation = (worker: ServiceWorker) =>
    new Promise<void>((resolve, reject) => {
      pushLog("waiting for service worker activation", { state: worker.state });

      const timeoutId = window.setTimeout(() => {
        worker.removeEventListener("statechange", handleStateChange);
        reject(new Error("Service worker activation timed out."));
      }, 10000);

      const handleStateChange = () => {
        pushLog("service worker state changed", { state: worker.state });

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

  let registration = await navigator.serviceWorker.getRegistration("/");
  pushLog("looked up existing service worker registration", registration
    ? {
        scope: registration.scope,
        active: describeWorker(registration.active),
        installing: describeWorker(registration.installing),
        waiting: describeWorker(registration.waiting),
      }
    : null);

  if (!registration) {
    pushLog("registering service worker", { scope: "/" });
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    pushLog("service worker register returned", {
      scope: registration.scope,
      active: describeWorker(registration.active),
      installing: describeWorker(registration.installing),
      waiting: describeWorker(registration.waiting),
    });
  } else {
    pushLog("reusing existing service worker registration", { scope: registration.scope });
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
    ]).catch((error) => {
      pushLog("service worker ready wait failed", error);
      return null;
    });

    if (readyRegistration) {
      pushLog("navigator.serviceWorker.ready resolved", {
        scope: readyRegistration.scope,
        active: describeWorker(readyRegistration.active),
        installing: describeWorker(readyRegistration.installing),
        waiting: describeWorker(readyRegistration.waiting),
      });
      registration = readyRegistration;
    }
  }

  registration = (await navigator.serviceWorker.getRegistration("/")) ?? registration;
  pushLog("service worker ready", {
    scope: registration.scope,
    hasActiveWorker: Boolean(registration.active),
  });

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
  pushLog("saving push subscription", { endpoint: payload.endpoint });
  const response = await fetch(`${supabaseUrl}/functions/v1/save-push-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ subscription: payload }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to save push subscription."));
  }

  pushLog("saved push subscription");
  return payload;
}

export async function ensurePushSubscription() {
  requirePushConfig();

  if (!("PushManager" in window)) {
    throw new Error("This browser does not support push notifications.");
  }

  pushLog("ensuring push subscription", {
    notificationPermission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  });
  const vapidPublicKey = await loadVapidPublicKey();
  const registration = await getRegistration();
  pushLog("using registration for push", {
    scope: registration.scope,
    active: describeWorker(registration.active),
    installing: describeWorker(registration.installing),
    waiting: describeWorker(registration.waiting),
  });
  const existing = await registration.pushManager.getSubscription();
  pushLog("existing subscription lookup completed", await describeSubscription(existing));
  if (existing) {
    pushLog("reusing existing subscription");
    await savePushSubscription(existing);
    return existing;
  }

  pushLog("creating new subscription");
  const subscribeOptions = {
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
  } satisfies PushSubscriptionOptionsInit;
  pushLog("push subscribe options prepared", {
    userVisibleOnly: subscribeOptions.userVisibleOnly,
    applicationServerKeyLength: subscribeOptions.applicationServerKey.length,
  });
  const subscription = await registration.pushManager.subscribe(subscribeOptions);
  pushLog("push subscribe completed", await describeSubscription(subscription));

  await savePushSubscription(subscription);
  return subscription;
}

async function renewPushSubscription() {
  pushLog("renewing push subscription");
  const registration = await getRegistration();
  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    await existing.unsubscribe().catch(() => {});
  }

  return ensurePushSubscription();
}

export async function sendTestPush() {
  requirePushConfig();

  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Notifications are not available in this browser.");
  }

  if (Notification.permission !== "granted") {
    throw new Error("Enable notifications first.");
  }

  pushLog("sending test push");
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
        title: "Interactive Maths",
        body: "Push notifications are working.",
        url: window.location.origin,
      }),
    });

  let subscription = await ensurePushSubscription();
  pushLog("test push using subscription", await describeSubscription(subscription));
  let response = await send(subscription);
  pushLog("test push response received", { status: response.status, ok: response.ok });

  if (!response.ok && response.status !== 400) {
    pushLog("test push failed, retrying with renewed subscription", { status: response.status });
    subscription = await renewPushSubscription();
    pushLog("test push renewed subscription", await describeSubscription(subscription));
    response = await send(subscription);
    pushLog("test push retry response received", { status: response.status, ok: response.ok });
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to send test push."));
  }

  pushLog("test push request accepted");
}
