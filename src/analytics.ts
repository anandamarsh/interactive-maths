import type { Game } from "./games";

const defaultAnalyticsEndpoint = import.meta.env.PROD
  ? "https://discussit-portal.vercel.app/api/analytics-ingest"
  : "http://localhost:5002/api/analytics-ingest";

const analyticsEndpoint = (import.meta.env.VITE_ANALYTICS_INGEST_URL ?? defaultAnalyticsEndpoint).trim();
const playerIdStorageKey = "see-maths:analytics:player-id";
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

type AnalyticsEvent = {
  eventType: "session_started" | "heartbeat" | "session_ended";
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
};

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
}

export function analyticsHeartbeatIntervalMs() {
  return heartbeatIntervalMs;
}
