import type { Game } from "./games";

const defaultAnalyticsEndpoint = import.meta.env.PROD
  ? "https://discussit-portal.vercel.app/api/analytics-ingest"
  : "http://localhost:5002/api/analytics-ingest";

const analyticsEndpoint = (import.meta.env.VITE_ANALYTICS_INGEST_URL ?? defaultAnalyticsEndpoint).trim();
const playerIdStorageKey = "see-maths:analytics:player-id";
const siteSessionStorageKey = "see-maths:analytics:site-session";
const heartbeatIntervalMs = 30000;

export type AnalyticsSession = {
  sessionId: string;
  playerId: string;
  gameId: string;
  gameName: string;
  gameUrl: string;
  shellUrl: string;
  startedAt: string;
  launchMode: "embedded" | "new-tab";
  ended: boolean;
};

const siteAnalyticsGameId = "__site__";
const siteAnalyticsGameName = "See Maths";

type AnalyticsEvent = {
  eventType: "session_started" | "heartbeat" | "session_ended" | "game_event";
  sessionId: string;
  playerId: string;
  gameId: string;
  gameName: string;
  gameUrl: string;
  shellUrl: string;
  startedAt: string;
  sentAt: string;
  launchMode: "embedded" | "new-tab";
  timezone?: string;
  language?: string;
  platform?: string;
  screenWidth?: number;
  screenHeight?: number;
  endedAt?: string;
  endReason?: string;
  eventName?: string;
  payload?: Record<string, unknown>;
};

export type EmbeddedGameAnalyticsMessage = {
  type: "see-maths:analytics-event" | "interactive-maths:analytics-event";
  eventName?: string;
  payload?: Record<string, unknown>;
};

function sessionLevelPayload(session: AnalyticsSession) {
  try {
    const url = new URL(session.gameUrl);
    const level = url.searchParams.get("level");
    if (!level) {
      return null;
    }

    return { level };
  } catch {
    return null;
  }
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getPlayerId() {
  if (typeof window === "undefined") {
    return randomId();
  }

  try {
    const existing = window.localStorage.getItem(playerIdStorageKey);
    if (existing) {
      return existing;
    }

    const created = randomId();
    window.localStorage.setItem(playerIdStorageKey, created);
    return created;
  } catch {
    return randomId();
  }
}

function currentShellUrl() {
  if (typeof window === "undefined") {
    return "https://seemaths.com/";
  }

  return window.location.href;
}

function readStoredSiteSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(siteSessionStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { sessionId?: string; startedAt?: string } | null;
    if (!parsed?.sessionId || !parsed?.startedAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSiteSession(session: Pick<AnalyticsSession, "sessionId" | "startedAt">) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(siteSessionStorageKey, JSON.stringify(session));
  } catch {
    // Ignore storage failures for analytics.
  }
}

function clearStoredSiteSession(sessionId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = readStoredSiteSession();
    if (!current || current.sessionId !== sessionId) {
      return;
    }

    window.sessionStorage.removeItem(siteSessionStorageKey);
  } catch {
    // Ignore storage failures for analytics.
  }
}

function baseEvent(session: AnalyticsSession): Omit<AnalyticsEvent, "eventType" | "sentAt"> {
  return {
    sessionId: session.sessionId,
    playerId: session.playerId,
    gameId: session.gameId,
    gameName: session.gameName,
    gameUrl: session.gameUrl,
    shellUrl: session.shellUrl,
    startedAt: session.startedAt,
    launchMode: session.launchMode,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: typeof navigator !== "undefined" ? navigator.language : "",
    platform: typeof navigator !== "undefined" ? navigator.platform : "",
    screenWidth: typeof window !== "undefined" ? window.screen.width : undefined,
    screenHeight: typeof window !== "undefined" ? window.screen.height : undefined,
  };
}

function sendEvent(event: AnalyticsEvent, useBeacon = false) {
  if (!analyticsEndpoint) {
    return;
  }

  const body = JSON.stringify(event);

  try {
    if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(analyticsEndpoint, blob);
      return;
    }

    void fetch(analyticsEndpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: useBeacon,
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
  } catch {
    // Analytics should never affect gameplay.
  }
}

export function createAnalyticsSession(game: Game, gameUrl: string, launchMode: "embedded" | "new-tab" = "embedded"): AnalyticsSession {
  return {
    sessionId: randomId(),
    playerId: getPlayerId(),
    gameId: game.id,
    gameName: game.name,
    gameUrl,
    shellUrl: currentShellUrl(),
    startedAt: new Date().toISOString(),
    launchMode,
    ended: false,
  };
}

export function createSiteAnalyticsSession(): AnalyticsSession {
  const shellUrl = currentShellUrl();
  const stored = readStoredSiteSession();
  const sessionId = stored?.sessionId ?? randomId();
  const startedAt = stored?.startedAt ?? new Date().toISOString();
  writeStoredSiteSession({ sessionId, startedAt });
  return {
    sessionId,
    playerId: getPlayerId(),
    gameId: siteAnalyticsGameId,
    gameName: siteAnalyticsGameName,
    gameUrl: shellUrl,
    shellUrl,
    startedAt,
    launchMode: "embedded",
    ended: false,
  };
}

export function startAnalyticsSession(session: AnalyticsSession) {
  sendEvent({
    eventType: "session_started",
    sentAt: new Date().toISOString(),
    ...baseEvent(session),
  });
}

export function heartbeatAnalyticsSession(session: AnalyticsSession) {
  if (session.ended || typeof document !== "undefined" && document.visibilityState !== "visible") {
    return;
  }

  sendEvent({
    eventType: "heartbeat",
    sentAt: new Date().toISOString(),
    ...baseEvent(session),
  });
}

export function endAnalyticsSession(session: AnalyticsSession, endReason: string) {
  if (session.ended) {
    return;
  }

  session.ended = true;

  sendEvent({
    eventType: "session_ended",
    sentAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    endReason,
    ...baseEvent(session),
  }, true);

  if (session.gameId === siteAnalyticsGameId && endReason !== "pagehide") {
    clearStoredSiteSession(session.sessionId);
  }
}

export function sendEmbeddedGameAnalyticsEvent(
  session: AnalyticsSession,
  eventName: string,
  payload: Record<string, unknown> = {},
) {
  if (session.ended || !eventName.trim()) {
    return;
  }

  sendEvent({
    eventType: "game_event",
    sentAt: new Date().toISOString(),
    eventName: eventName.trim(),
    payload,
    ...baseEvent(session),
  });
}

export function sessionLevelContext(session: AnalyticsSession) {
  return sessionLevelPayload(session);
}

export function analyticsHeartbeatIntervalMs() {
  return heartbeatIntervalMs;
}
