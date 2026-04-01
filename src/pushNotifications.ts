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

function requirePushConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Push notifications are not configured for this app.");
  }
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
          const data = await response.json().catch(() => ({}));
          throw new Error(typeof data.error === "string" ? data.error : "Failed to load push configuration.");
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

  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) {
    await navigator.serviceWorker.ready;
    return existing;
  }

  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
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
    throw new Error("Failed to save push subscription.");
  }

  return payload;
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

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
  });

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

export async function sendTestPush() {
  requirePushConfig();

  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Notifications are not available in this browser.");
  }

  if (Notification.permission !== "granted") {
    throw new Error("Enable notifications first.");
  }

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
  let response = await send(subscription);

  if (!response.ok && response.status !== 400) {
    subscription = await renewPushSubscription();
    response = await send(subscription);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const details = typeof data.details === "string" ? data.details : "";
    throw new Error(
      typeof data.error === "string"
        ? (details ? `${data.error}: ${details}` : data.error)
        : "Failed to send test push.",
    );
  }
}
