const demoModeStorageKey = "see-maths:demo-mode";

function readStoredDemoMode() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(demoModeStorageKey) === "on";
  } catch {
    return false;
  }
}

export function resolveDemoModeFromUrl() {
  if (typeof window === "undefined") {
    return false;
  }

  const search = new URLSearchParams(window.location.search);
  const raw = search.get("demo");
  if (raw === "1") {
    try {
      window.localStorage.setItem(demoModeStorageKey, "on");
    } catch {
      // Ignore storage errors for demo mode.
    }
    return true;
  }

  if (raw === "0") {
    try {
      window.localStorage.removeItem(demoModeStorageKey);
    } catch {
      // Ignore storage errors for demo mode.
    }
    return false;
  }

  return readStoredDemoMode();
}

export function setDemoModeEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(demoModeStorageKey, "on");
    } else {
      window.localStorage.removeItem(demoModeStorageKey);
    }
  } catch {
    // Ignore storage errors for demo mode.
  }

  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set("demo", "1");
  } else {
    url.searchParams.delete("demo");
  }
  window.history.replaceState({}, "", url.toString());
}

export function withDemoParam(url: string, enabled: boolean) {
  try {
    const next = new URL(url);
    next.searchParams.set("demo", enabled ? "1" : "0");
    return next.toString();
  } catch {
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}demo=${enabled ? "1" : "0"}`;
  }
}
