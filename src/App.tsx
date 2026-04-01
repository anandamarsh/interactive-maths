import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SocialComments, SocialShare } from "./components/Social";
import { GameIcon } from "./components/GameIcon";
import type { Game, GameListEntry } from "./games";
import { loadGamesList } from "./games";
import { ensurePushSubscription, sendTestPush } from "./pushNotifications";

/** Avoid mixed-content when the shell is HTTPS */
function iframeSrc(url: string): string {
  if (typeof window === "undefined") return url;
  if (window.location.protocol !== "https:" || !url.startsWith("http://")) return url;
  try {
    const u = new URL(url);
    u.protocol = "https:";
    return u.href;
  } catch {
    return url;
  }
}

const SKILL_COLORS = [
  { bg: "rgba(56,189,248,0.15)",  color: "#38bdf8" },
  { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
  { bg: "rgba(251,191,36,0.15)",  color: "#fbbf24" },
  { bg: "rgba(74,222,128,0.15)",  color: "#4ade80" },
  { bg: "rgba(251,113,133,0.15)", color: "#fb7185" },
  { bg: "rgba(251,146,60,0.15)",  color: "#fb923c" },
];

function renderDescription(text: string) {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (!line.trim()) {
      result.push(<div key={key++} className="h-3" />);
    } else if (/^[A-Z][A-Z\s]+:/.test(line)) {
      // Section heading like "WHAT IT DOES:" or "TECH: ..."
      const colon = line.indexOf(":");
      const heading = line.slice(0, colon + 1);
      const rest = line.slice(colon + 1);
      result.push(
        <p key={key++} className="text-xs font-bold tracking-wider mb-1" style={{ color: "#38bdf8" }}>
          {heading}{rest && <span className="font-normal tracking-normal text-slate-300"> {rest.trim()}</span>}
        </p>
      );
    } else if (line.startsWith("- ")) {
      result.push(
        <p key={key++} className="text-sm text-slate-300 leading-relaxed pl-3" style={{ textIndent: "-0.75rem", paddingLeft: "0.75rem" }}>
          <span style={{ color: "#4ade80" }}>–</span> {line.slice(2)}
        </p>
      );
    } else {
      result.push(
        <p key={key++} className="text-sm text-slate-300 leading-relaxed">
          {line}
        </p>
      );
    }
  }
  return result;
}

/** Gold ribbon — obvious partner marker, black text */
const partnerTagGoldStyle: CSSProperties = {
  background: "linear-gradient(180deg, #fde047 0%, #eab308 55%, #ca8a04 100%)",
  color: "#0f172a",
  border: "1px solid rgba(15, 23, 42, 0.35)",
  boxShadow:
    "0 2px 0 rgba(180, 83, 9, 0.45), 0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
  fontWeight: 800,
};

/** Top-right overlay when a partner game is embedded */
function PartnerIframeChrome({ url }: { url: string }) {
  return (
    <div className="absolute top-3 right-3 z-[30] flex max-w-[min(92vw,300px)] flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        className="cursor-pointer rounded-lg px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider transition-transform hover:scale-[1.02] active:scale-[0.98]"
        style={partnerTagGoldStyle}
        aria-label={`Open partner site in new tab: ${url}`}
      >
        Partner
      </button>
      <p
        className="m-0 max-w-full text-right text-[9px] leading-snug"
        style={{ color: "#94a3b8", wordBreak: "break-all" }}
        title={url}
      >
        {url}
      </p>
    </div>
  );
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const notificationPreferenceKey = "interactive-maths:comment-notifications";

function readNotificationPreference() {
  if (typeof window === "undefined") return "off";
  return window.localStorage.getItem(notificationPreferenceKey) ?? "off";
}

function ScreenshotCarousel({ screenshots, name }: { screenshots: string[]; name: string }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const ordered = useMemo(() => shuffle(screenshots), [screenshots]);
  const [allImagesLoaded, setAllImagesLoaded] = useState(false);
  const autoplayCancelledRef = useRef(false);
  const dragStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setAllImagesLoaded(false);
    autoplayCancelledRef.current = false;
  }, [ordered]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || ordered.length === 0) return;

    let rafId = 0;
    let cancelled = false;
    let direction = 1;
    let lastTime = 0;

    const stop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const step = (time: number) => {
      if (cancelled) return;
      const delta = lastTime ? Math.min(time - lastTime, 64) : 16;
      lastTime = time;

      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      if (maxScroll <= 0) return;

      const next = track.scrollLeft + (0.35 * direction * delta / 16);
      if (next >= maxScroll) {
        track.scrollTo(maxScroll, 0);
        direction = -1;
      } else if (next <= 0) {
        track.scrollTo(0, 0);
        direction = 1;
      } else {
        track.scrollTo(next, 0);
      }
      rafId = requestAnimationFrame(step);
    };

    const start = () => {
      stop();
      if (autoplayCancelledRef.current) return;
      direction = 1;
      lastTime = 0;
      track.scrollTo(0, 0);
      if (track.scrollWidth <= track.clientWidth) return;
      rafId = requestAnimationFrame(step);
    };

    const images = Array.from(track.querySelectorAll("img"));
    let loadedCount = 0;

    const markImageReady = () => {
      loadedCount += 1;
      if (loadedCount >= images.length) {
        setAllImagesLoaded(true);
        start();
      }
    };

    for (const image of images) {
      if (image.complete) {
        markImageReady();
      } else {
        image.addEventListener("load", markImageReady, { once: true });
        image.addEventListener("error", markImageReady, { once: true });
      }
    }

    const observer = new ResizeObserver(() => {
      if (allImagesLoaded) start();
    });
    observer.observe(track);

    const cancelAutoplay = () => {
      autoplayCancelledRef.current = true;
      stop();
    };

    const resetDrag = () => {
      dragStartXRef.current = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      dragStartXRef.current = event.clientX;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragStartXRef.current === null) return;
      if (Math.abs(event.clientX - dragStartXRef.current) > 6) {
        cancelAutoplay();
        resetDrag();
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      dragStartXRef.current = event.touches[0]?.clientX ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      const currentX = event.touches[0]?.clientX;
      if (dragStartXRef.current === null || currentX === undefined) return;
      if (Math.abs(currentX - dragStartXRef.current) > 6) {
        cancelAutoplay();
        resetDrag();
      }
    };

    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", resetDrag);
    track.addEventListener("pointercancel", resetDrag);
    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchmove", onTouchMove, { passive: true });
    track.addEventListener("touchend", resetDrag);
    track.addEventListener("touchcancel", resetDrag);
    track.addEventListener("wheel", cancelAutoplay, { passive: true });

    return () => {
      cancelled = true;
      stop();
      lastTime = 0;
      observer.disconnect();
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", resetDrag);
      track.removeEventListener("pointercancel", resetDrag);
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchmove", onTouchMove);
      track.removeEventListener("touchend", resetDrag);
      track.removeEventListener("touchcancel", resetDrag);
      track.removeEventListener("wheel", cancelAutoplay);
      for (const image of images) {
        image.removeEventListener("load", markImageReady);
        image.removeEventListener("error", markImageReady);
      }
    };
  }, [allImagesLoaded, ordered]);

  if (ordered.length === 0) return null;

  return (
    <div className="shrink-0 border-b p-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <div
        ref={trackRef}
        className="hide-scrollbar flex gap-3 overflow-x-auto overflow-y-hidden rounded-2xl"
        style={{
          scrollBehavior: "auto",
          touchAction: "pan-x",
          height: "min(44svh, 280px)",
          opacity: allImagesLoaded ? 1 : 0,
          transition: "opacity 0.18s ease",
        }}
      >
        {ordered.map((src, index) => (
          <img
            key={`${src}-${index}`}
            src={src}
            alt={`${name} screenshot ${index + 1}`}
            className="block h-full w-auto shrink-0 rounded-2xl object-contain"
            style={{
              background: "#020617",
              border: "1px solid rgba(56,189,248,0.22)",
              boxShadow: "0 18px 40px rgba(2,6,23,0.4)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Game | null>(null);
  const [drawer, setDrawer] = useState<Game | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [embeddedOverlayActive, setEmbeddedOverlayActive] = useState(false);
  const [commentComposeRequest, setCommentComposeRequest] = useState(0);
  const [commentReloadRequest, setCommentReloadRequest] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [notificationPreference, setNotificationPreference] = useState(readNotificationPreference);
  const [pushState, setPushState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [pushError, setPushError] = useState("");
  const [isMobileLandscape, setIsMobileLandscape] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024 && window.innerWidth > window.innerHeight;
  });
  const [isMobilePortrait, setIsMobilePortrait] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024 && window.innerWidth <= window.innerHeight;
  });

  useEffect(() => {
    const listFile = import.meta.env.DEV ? "/games-local.json" : "/games.json";
    fetch(listFile)
      .then((r) => r.json())
      .then((entries: GameListEntry[]) => loadGamesList(entries))
      .then(setGames)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const syncViewportMode = () => {
      setIsMobileLandscape(window.innerWidth < 1024 && window.innerWidth > window.innerHeight);
      setIsMobilePortrait(window.innerWidth < 1024 && window.innerWidth <= window.innerHeight);
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(notificationPreferenceKey, notificationPreference);
  }, [notificationPreference]);

  const openDrawer = (g: Game) => {
    closeSocialDrawers();
    setDrawer(g);
    setTimeout(() => setDrawerOpen(true), 10);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawer(null), 300);
  };

  function closeSocialDrawers() {
    setShowShareDrawer(false);
    if (showCommentsDrawer) {
      setShowCommentsDrawer(false);
      setCommentReloadRequest((value) => value + 1);
      return;
    }
    setShowCommentsDrawer(false);
  }

  function closeCommentsDrawer() {
    setShowCommentsDrawer(false);
    setCommentReloadRequest((value) => value + 1);
  }

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushState("error");
      setPushError("Notifications are not available in this browser.");
      return;
    }

    setPushState("idle");
    setPushError("");

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      try {
        await ensurePushSubscription();
        setNotificationPreference("on");
        return;
      } catch (error) {
        setNotificationPreference("off");
        setPushState("error");
        setPushError(error instanceof Error ? error.message : "Failed to enable notifications.");
        return;
      }
    }

    setNotificationPreference("off");
    setPushState("error");
    setPushError("Notifications were not allowed.");
  }

  function disableNotifications() {
    setNotificationPreference("off");
    setPushState("idle");
    setPushError("");
  }

  async function handleTestPush() {
    setPushState("sending");
    setPushError("");

    try {
      await sendTestPush();
      setPushState("sent");
      window.setTimeout(() => setPushState("idle"), 1800);
    } catch (error) {
      setPushState("error");
      setPushError(error instanceof Error ? error.message : "Push test failed.");
    }
  }

  async function handleShare() {
    setShowCommentsDrawer(false);

    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data?: ShareData) => boolean;
      standalone?: boolean;
    };
    const shareData: ShareData = {
      title: document.title || "Interactive Maths",
      text: "Check out this maths game on Interactive Maths!",
      url: "https://interactive-maths.vercel.app/",
    };
    const looksMobileOrPwa =
      window.matchMedia?.("(display-mode: standalone)").matches
      || !!nav.standalone
      || navigator.maxTouchPoints > 0;

    if (looksMobileOrPwa && typeof nav.share === "function" && (!nav.canShare || nav.canShare(shareData))) {
      try {
        await nav.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    setShowShareDrawer((open) => !open);
  }

  function toggleCommentsDrawer() {
    setShowShareDrawer(false);
    setShowCommentsDrawer((open) => !open);
  }

  const filtered = games.filter((g) => {
    const q = query.toLowerCase();
    return (
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.tags.some((t) => t.includes(q)) ||
      g.skills.some((s) => s.includes(q)) ||
      g.description.toLowerCase().includes(q)
    );
  });

  function startPlay(g: Game) {
    closeSocialDrawers();
    setEmbeddedOverlayActive(false);
    if (g.openInNewTab) {
      window.open(g.url, "_blank", "noopener,noreferrer");
      return;
    }
    setActive(g);
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== "interactive-maths:overlay-active") {
        return;
      }

      setEmbeddedOverlayActive(Boolean(event.data.active));
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (active) {
    return (
      <div className="fixed inset-0" style={{ backgroundColor: "#020617" }}>
        <iframe
          src={iframeSrc(active.url)}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; clipboard-write; encrypted-media; web-share"
          referrerPolicy="no-referrer-when-downgrade"
          title={active.name}
        />
        {active.thirdParty && <PartnerIframeChrome url={active.url} />}
        {!embeddedOverlayActive ? (
          <button
            onClick={() => setActive(null)}
            title="Home"
            className="arcade-button absolute top-2 left-2 z-[40] w-10 h-10 p-2"
          >
            <svg className="w-full h-full" viewBox="0 0 24 24" fill="white">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-[100lvh] px-6 py-10">
      <button
        type="button"
        onClick={() => setShowSettingsModal(true)}
        title="Settings"
        className="arcade-button app-settings-button"
      >
        <svg viewBox="0 0 24 24" className="app-settings-icon" fill="currentColor" aria-hidden="true">
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.028 7.028 0 0 0-1.63-.94l-.36-2.54A.488.488 0 0 0 13.9 2h-3.8c-.24 0-.44.17-.48.41l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.493.493 0 0 0-.6.22L2.72 8.47a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.07.64-.07.95s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.39.31.6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54c.04.24.24.41.48.41h3.8c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.22.09.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.01-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
        </svg>
      </button>
      <div className="max-w-5xl mx-auto w-full">
        <header className="flex flex-col items-center text-center mb-10">
          <p className="text-[1.125rem] font-bold tracking-[0.25em] uppercase text-sky-400 mb-1">
            Interactive Maths
          </p>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by topic or skill…"
            className="w-full max-w-md rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none text-left mt-3"
            style={{ background: "#0f172a", border: "1px solid #334155" }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#0ea5e9";
              e.currentTarget.style.boxShadow = "0 0 25px rgba(14,165,233,0.8), 0 0 60px rgba(14,165,233,0.35)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#334155";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </header>

        {loading ? (
          <p className="text-slate-500">Loading games…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">No games match "{query}".</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => openDrawer(g)}
                className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl p-2 pt-3 text-center transition-all cursor-pointer"
                style={{ background: "#0f172a", border: "1px solid #1e293b" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 25px rgba(74,222,128,0.8), 0 0 60px rgba(74,222,128,0.35)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {g.thirdParty && (
                  <span
                    className="pointer-events-none absolute top-0 right-0 z-20 rounded-bl-lg rounded-tr-2xl px-2.5 py-1.5 text-[10px] uppercase tracking-wide"
                    style={partnerTagGoldStyle}
                  >
                    Partner
                  </span>
                )}
                <GameIcon game={g} className="w-32 h-32 object-contain" />
                <div className="px-1">
                  <div className="text-white font-bold text-sm leading-tight">{g.name}</div>
                </div>
                <div className="flex flex-wrap justify-center gap-1">
                  {g.tags.slice(0, 2).map((t, i) => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: SKILL_COLORS[i % SKILL_COLORS.length].bg,
                        color: SKILL_COLORS[i % SKILL_COLORS.length].color,
                        border: `1px solid ${SKILL_COLORS[i % SKILL_COLORS.length].color}`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Backdrop */}
      {drawer && (
        <div
          className="fixed inset-0 z-40"
          style={{
            background: drawerOpen ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)",
            transition: "background 0.3s ease",
          }}
          onClick={closeDrawer}
        />
      )}

      {/* Drawer */}
      {drawer && (
        <>
          <button
            onClick={closeDrawer}
            title="Home"
            className="fixed top-1.5 left-2 z-[60] arcade-button w-10 h-10 p-2"
            style={{
              transform: drawerOpen ? "translateY(0)" : "translateY(100dvh)",
              transition: "transform 0.3s ease",
            }}
          >
            <svg className="w-full h-full" viewBox="0 0 24 24" fill="white">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={closeDrawer}
            className="fixed top-1.5 right-2 z-[60] w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors"
            style={{
              background: "#14532d",
              color: "#86efac",
              border: "1px solid #4ade80",
              transform: drawerOpen ? "translateY(0)" : "translateY(100dvh)",
              transition: "transform 0.3s ease, background 0.15s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#166534"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#14532d"; }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>

          <div
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden lg:overflow-hidden lg:rounded-t-2xl"
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              transform: drawerOpen ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.3s ease",
              maxHeight: "100dvh",
              height: "100dvh",
            }}
          >

          {/* Row 1: icon + meta */}
          {isMobilePortrait ? (
            <div className="p-4 pb-3 pt-10 shrink-0" style={{ borderBottom: "1px solid #1e293b" }}>
              <div className="flex items-center gap-4">
                <GameIcon game={drawer} className="w-32 h-32 object-contain shrink-0" alt="" />
                <div className="flex min-w-0 flex-1 flex-col gap-2 justify-center">
                  {drawer.thirdParty && (
                    <span
                      className="self-start rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider"
                      style={partnerTagGoldStyle}
                    >
                      Partner site
                    </span>
                  )}
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black text-white leading-tight">{drawer.name}</h2>
                    {drawer.buildStamp && !drawer.thirdParty && (
                      <p className="text-[10px] leading-none text-sky-300/80">
                        Build {drawer.buildStamp}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      startPlay(drawer);
                      if (!drawer.openInNewTab) closeDrawer();
                    }}
                    className="mt-2 self-start rounded-xl px-6 py-2 text-sm font-bold text-black cursor-pointer transition-all"
                    style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "linear-gradient(135deg, #86efac, #22c55e)";
                      (e.currentTarget as HTMLElement).style.transform = "scale(1.03)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "linear-gradient(135deg, #4ade80, #16a34a)";
                      (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                    }}
                  >
                    {drawer.openInNewTab ? "▶ Open game" : "▶ Play"}
                  </button>
                  {drawer.thirdParty && !drawer.openInNewTab && (
                    <button
                      type="button"
                      onClick={() => {
                        window.open(drawer.url, "_blank", "noopener,noreferrer");
                        closeDrawer();
                      }}
                      className="w-full rounded-xl px-5 py-2 text-sm font-bold cursor-pointer transition-all"
                      style={{
                        background: "#1e293b",
                        color: "#e2e8f0",
                        border: "1px solid #475569",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#38bdf8";
                        (e.currentTarget as HTMLElement).style.color = "#38bdf8";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#475569";
                        (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                      }}
                    >
                      ↗ New tab
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1">
                {drawer.skills.slice(0, 4).map((s, i) => (
                  <span
                    key={s}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: SKILL_COLORS[i % SKILL_COLORS.length].bg,
                      color: SKILL_COLORS[i % SKILL_COLORS.length].color,
                      border: `1px solid ${SKILL_COLORS[i % SKILL_COLORS.length].color}`,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
              {drawer.thirdParty && (
                <p
                  className="mt-3 max-w-full text-[10px] leading-snug"
                  style={{ color: "#64748b", wordBreak: "break-all" }}
                  title={drawer.url}
                >
                  {drawer.url}
                </p>
              )}
            </div>
          ) : (
            <div className="flex gap-5 p-4 pb-3 pt-10 shrink-0" style={{ borderBottom: "1px solid #1e293b" }}>
              <GameIcon game={drawer} className="w-40 h-40 object-contain shrink-0" alt="" />
              <div className="flex flex-col gap-4 justify-center min-w-0">
                {drawer.thirdParty && (
                  <span
                    className="self-start rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider"
                    style={partnerTagGoldStyle}
                  >
                    Partner site
                  </span>
                )}
                <div className="flex flex-wrap gap-1">
                  {drawer.skills.slice(0, 4).map((s, i) => (
                    <span
                      key={s}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: SKILL_COLORS[i % SKILL_COLORS.length].bg,
                        color: SKILL_COLORS[i % SKILL_COLORS.length].color,
                        border: `1px solid ${SKILL_COLORS[i % SKILL_COLORS.length].color}`,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                  <h2 className="text-2xl font-black text-white leading-tight">{drawer.name}</h2>
                  {drawer.buildStamp && !drawer.thirdParty && (
                    <p className="pb-0.5 text-[10px] leading-none text-sky-300/80">
                      Build {drawer.buildStamp}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      startPlay(drawer);
                      if (!drawer.openInNewTab) closeDrawer();
                    }}
                    className="px-6 py-2 rounded-xl font-bold text-sm text-black cursor-pointer transition-all"
                    style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "linear-gradient(135deg, #86efac, #22c55e)";
                      (e.currentTarget as HTMLElement).style.transform = "scale(1.03)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "linear-gradient(135deg, #4ade80, #16a34a)";
                      (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                    }}
                  >
                    {drawer.openInNewTab ? "▶ Open game" : "▶ Play"}
                  </button>
                  {drawer.thirdParty && !drawer.openInNewTab && (
                    <button
                      type="button"
                      onClick={() => {
                        window.open(drawer.url, "_blank", "noopener,noreferrer");
                        closeDrawer();
                      }}
                      className="px-5 py-2 rounded-xl font-bold text-sm cursor-pointer transition-all"
                      style={{
                        background: "#1e293b",
                        color: "#e2e8f0",
                        border: "1px solid #475569",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#38bdf8";
                        (e.currentTarget as HTMLElement).style.color = "#38bdf8";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#475569";
                        (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                      }}
                    >
                      ↗ New tab
                    </button>
                  )}
                </div>
                {drawer.thirdParty && (
                  <p
                    className="mt-2 max-w-full text-[10px] leading-snug"
                    style={{ color: "#64748b", wordBreak: "break-all" }}
                    title={drawer.url}
                  >
                    {drawer.url}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="lg:flex-1 lg:overflow-y-auto">
            {drawer.screenshots.length > 0 && (
              <ScreenshotCarousel screenshots={drawer.screenshots} name={drawer.name} />
            )}

            {/* Row 2: description */}
            <div className="shrink-0 p-6">
              {renderDescription(drawer.description)}
            </div>
          </div>
          </div>
        </>
      )}

      <div className="shell-social-launchers">
        <button
          type="button"
          onClick={handleShare}
          className={`shell-social-launcher arcade-button ${showShareDrawer ? "is-active" : ""}`}
          aria-expanded={showShareDrawer}
          aria-controls="shell-social-share-drawer"
          aria-label="Open share panel"
        >
          <svg viewBox="0 0 24 24" className="shell-social-launcher-icon" fill="none" aria-hidden="true">
            <circle cx="18" cy="5.5" r="2.25" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="6" cy="12" r="2.25" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="18" cy="18.5" r="2.25" stroke="currentColor" strokeWidth="1.9" />
            <path d="M8.1 10.95 15.9 6.55" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M8.1 13.05 15.9 17.45" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggleCommentsDrawer}
          className={`shell-social-launcher arcade-button ${showCommentsDrawer ? "is-active" : ""}`}
          aria-expanded={showCommentsDrawer}
          aria-controls="shell-social-comments-drawer"
          aria-label="Open comments panel"
        >
          <svg viewBox="0 0 24 24" className="shell-social-launcher-icon" fill="none" aria-hidden="true">
            <path d="M6 6.5h12a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 3v-3H6A2.5 2.5 0 0 1 3.5 15V9A2.5 2.5 0 0 1 6 6.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {(showShareDrawer || showCommentsDrawer) && (
        <div className="shell-social-backdrop" onClick={closeSocialDrawers} />
      )}

      {showSettingsModal && (
        <div className="settings-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="settings-card" onClick={(event) => event.stopPropagation()}>
            <div className="settings-header">
              <p className="settings-kicker">Settings</p>
              <button
                type="button"
                className="settings-close"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            <label className="settings-switch-row">
              <span className="settings-label-group">
                <span
                  className="settings-label"
                  style={{ color: notificationPreference === "on" ? "#fde047" : undefined }}
                >
                  Notifications
                </span>
                {notificationPreference === "on" && (
                  <button
                    type="button"
                    className="settings-push-button"
                    onClick={(event) => {
                      event.preventDefault();
                      void handleTestPush();
                    }}
                    disabled={pushState === "sending"}
                  >
                    {pushState === "sending" ? "Sending..." : pushState === "sent" ? "Sent" : "Push"}
                  </button>
                )}
              </span>
              <span className={`settings-switch ${notificationPreference === "on" ? "is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={notificationPreference === "on"}
                  onChange={(event) => {
                    if (event.currentTarget.checked) {
                      void enableNotifications();
                    } else {
                      disableNotifications();
                    }
                  }}
                />
                <span className="settings-switch-track">
                  <span className="settings-switch-thumb" />
                </span>
              </span>
            </label>

            {pushState === "error" && pushError && (
              <p className="settings-note" style={{ color: "#fda4af" }}>
                {pushError}
              </p>
            )}
          </div>
        </div>
      )}

      <div
        id="shell-social-share-drawer"
        className="shell-social-drawer"
        aria-hidden={!showShareDrawer}
        style={{
          right: "1rem",
          bottom: "1rem",
          transform: showShareDrawer ? "translateY(0)" : "translateY(calc(100% + 1rem))",
          background: "rgba(2,6,23,0.97)",
          border: "3px solid rgba(56,189,248,0.4)",
          borderRadius: "16px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
          width: "fit-content",
          maxWidth: "calc(100vw - 2rem)",
        }}
      >
        <div className="shell-social-drawer-header" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="shell-social-share-title">Spread the word...</div>
          <button type="button" onClick={() => setShowShareDrawer(false)} className="shell-social-drawer-close" aria-label="Close share drawer">✕</button>
        </div>
        <SocialShare />
      </div>

      <div
        id="shell-social-comments-drawer"
        className="shell-social-comments-drawer"
        aria-hidden={!showCommentsDrawer}
        style={{
          width: isMobileLandscape || isMobilePortrait ? "100vw" : "70vw",
          height: isMobileLandscape || isMobilePortrait ? "100dvh" : "70vh",
          maxWidth: isMobileLandscape || isMobilePortrait ? "100vw" : "70vw",
          maxHeight: isMobileLandscape || isMobilePortrait ? "100dvh" : "70vh",
          transform: showCommentsDrawer ? "translateY(0)" : "translateY(100%)",
        }}
      >
        <div className="shell-social-comments-header">
          <button
            type="button"
            onClick={() => setCommentComposeRequest((value) => value + 1)}
            className="shell-social-comments-new"
          >
            Add Comment
          </button>
          <div className="shell-social-comments-actions">
            <button type="button" onClick={closeCommentsDrawer} className="shell-social-drawer-close shell-social-drawer-close-comments" aria-label="Close comments drawer">✕</button>
          </div>
        </div>
        <div className="shell-social-comments-shell">
          <SocialComments composeRequest={commentComposeRequest} reloadRequest={commentReloadRequest} />
        </div>
      </div>
    </div>
  );
}
