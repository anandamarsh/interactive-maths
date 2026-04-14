import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SocialComments, SocialShare } from "./components/Social";
import { GameIcon } from "./components/GameIcon";
import type { Game, GameListEntry, GameSlot, TeachingLevel } from "./games";
import {
  compareGameSlots,
  createGameSlots,
  getGameLevelIconUrl,
  loadGamesListProgressively,
  parseYearSortKey,
} from "./games";
import {
  disablePushSubscription,
  ensurePushSubscription,
  sendTestPush,
} from "./pushNotifications";
import { installEmbeddedStorageBridge } from "./utils/embeddedStorageBridge";
import {
  analyticsHeartbeatIntervalMs,
  createSiteAnalyticsSession,
  createAnalyticsSession,
  endAnalyticsSession,
  heartbeatAnalyticsSession,
  sendEmbeddedGameAnalyticsEvent,
  startAnalyticsSession,
  type AnalyticsSession,
  type EmbeddedGameAnalyticsMessage,
} from "./analytics";
import {
  resolveDemoModeFromUrl,
  setDemoModeEnabled,
  withDemoParam,
} from "./demoMode";

const SHELL_GITHUB_URL = "https://github.com/anandamarsh/see-maths";
const SHELL_YOUTUBE_URL = "https://www.youtube.com/@SeeMaths0";
const SHELL_YOUTUBE_ICON_URL = "/youtube-circle-logo-svgrepo-com.svg";
const SHELL_PUBLIC_URL = "https://seemaths.com/";
const SEE_MATHS_COMMENT_NOTIFICATIONS_KEY = "see-maths:comment-notifications";
const LEGACY_COMMENT_NOTIFICATIONS_KEY = "interactive-maths:comment-notifications";
function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.23 1.84 1.23 1.08 1.84 2.82 1.31 3.5 1 .11-.78.42-1.31.77-1.61-2.67-.3-5.47-1.33-5.47-5.94 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22v3.29c0 .32.22.69.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function PersonIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.05 0-7 2.07-7 4.5 0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5C19 16.07 16.05 14 12 14Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EyesLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 80 700 360"
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <g transform="rotate(-15 400 320)">
        <path
          d="M260 200 Q340 160 420 200"
          fill="none"
          stroke="#5E667A"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M440 200 Q520 160 600 200"
          fill="none"
          stroke="#5E667A"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <ellipse cx="360" cy="320" rx="90" ry="110" fill="#FFFFFF" />
        <ellipse cx="390" cy="350" rx="42" ry="50" fill="#3DB5F2" />
        <circle cx="405" cy="360" r="26" fill="#000000" />
        <circle cx="390" cy="330" r="10" fill="#FFFFFF" />
        <ellipse cx="520" cy="320" rx="78" ry="96" fill="#FFFFFF" />
        <ellipse cx="545" cy="350" rx="36" ry="44" fill="#3DB5F2" />
        <circle cx="558" cy="358" r="22" fill="#000000" />
        <circle cx="545" cy="332" r="8" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

/** Avoid mixed-content when the shell is HTTPS */
function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 900px)").matches;
}

function iframeSrc(url: string): string {
  if (typeof window === "undefined") return url;
  if (window.location.protocol !== "https:" || !url.startsWith("http://"))
    return url;
  try {
    const u = new URL(url);
    u.protocol = "https:";
    return u.href;
  } catch {
    return url;
  }
}

function hostName(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function getLaunchLevels(game: Game): number[] {
  if (game.levelIcons.length > 0) {
    return [...new Set(game.levelIcons.map((icon) => icon.level))]
      .filter((level) => level > 0)
      .sort((a, b) => a - b);
  }
  const host = hostName(game.url) ?? "";
  if (host.includes("maths-angle-explorer")) return [1, 2, 3];
  if (host.includes("maths-distance-calculator")) return [1, 2, 3];
  return [];
}

function formatTag(tag: string): string {
  if (/^\d+-\d+$/.test(tag)) return `Year ${tag}`;
  return tag;
}

function withLevelParam(url: string, level: number): string {
  try {
    const next = new URL(url);
    next.searchParams.set("level", String(level));
    return next.toString();
  } catch {
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}level=${level}`;
  }
}

const SKILL_COLORS = [
  { bg: "rgba(56,189,248,0.15)", color: "#38bdf8" },
  { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
  { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  { bg: "rgba(74,222,128,0.15)", color: "#4ade80" },
  { bg: "rgba(251,113,133,0.15)", color: "#fb7185" },
  { bg: "rgba(251,146,60,0.15)", color: "#fb923c" },
];

function renderDescriptionLines(lines: string[], keyPrefix: string) {
  const result: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (!line.trim()) {
      result.push(<div key={`${keyPrefix}-${key++}`} className="h-3" />);
    } else if (line.startsWith("- ")) {
      result.push(
        <p
          key={`${keyPrefix}-${key++}`}
          className="text-sm text-slate-300 leading-relaxed pl-3"
          style={{ textIndent: "-0.75rem", paddingLeft: "0.75rem" }}
        >
          <span style={{ color: "#4ade80" }}>–</span> {line.slice(2)}
        </p>,
      );
    } else {
      result.push(
        <p
          key={`${keyPrefix}-${key++}`}
          className="text-sm text-slate-300 leading-relaxed"
        >
          {line}
        </p>,
      );
    }
  }
  return result;
}

type DescriptionSection = {
  heading: string | null;
  headingRest: string;
  lines: string[];
};

const STAGE_COLOR_SCENE: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  "Stage 1": {
    border: "rgba(244, 114, 182, 0.48)",
    bg: "rgba(244, 114, 182, 0.16)",
    text: "#f9a8d4",
  },
  "Stage 2": {
    border: "rgba(250, 204, 21, 0.48)",
    bg: "rgba(250, 204, 21, 0.16)",
    text: "#fde047",
  },
  "Stage 3": {
    border: "rgba(251, 146, 60, 0.48)",
    bg: "rgba(251, 146, 60, 0.16)",
    text: "#fdba74",
  },
  "Stage 4": {
    border: "rgba(167, 139, 250, 0.48)",
    bg: "rgba(167, 139, 250, 0.16)",
    text: "#c4b5fd",
  },
  "Stage 5": {
    border: "rgba(248, 113, 113, 0.48)",
    bg: "rgba(248, 113, 113, 0.16)",
    text: "#fca5a5",
  },
  "Stage 6": {
    border: "rgba(245, 158, 11, 0.48)",
    bg: "rgba(245, 158, 11, 0.16)",
    text: "#fcd34d",
  },
};

function splitDescriptionSections(text: string): DescriptionSection[] {
  const lines = text.split("\n");
  const sections: DescriptionSection[] = [];
  let current: DescriptionSection = {
    heading: null,
    headingRest: "",
    lines: [],
  };

  const pushCurrent = () => {
    if (current.heading !== null || current.lines.length > 0)
      sections.push(current);
  };

  for (const line of lines) {
    if (/^[A-Z][A-Z\s]+:/.test(line)) {
      pushCurrent();
      const colon = line.indexOf(":");
      current = {
        heading: line.slice(0, colon + 1),
        headingRest: line.slice(colon + 1).trim(),
        lines: [],
      };
      continue;
    }

    current.lines.push(line);
  }

  pushCurrent();
  return sections;
}

function getStageKey(level: TeachingLevel) {
  const match = level.stageLabel?.match(/Stage\s+\d+/i);
  return match?.[0] ?? "";
}

function getCurriculumColor(level: TeachingLevel) {
  const stageKey = getStageKey(level);
  return (
    STAGE_COLOR_SCENE[stageKey] ?? {
      border: "rgba(148, 163, 184, 0.28)",
      bg: "rgba(148, 163, 184, 0.12)",
      text: "#cbd5e1",
    }
  );
}

function splitLevelLabel(label: string) {
  const match = label.match(/^(Level\s+\d+):\s*(.+)$/i);
  if (!match) return { prefix: label, body: "" };
  return { prefix: match[1], body: match[2] };
}

function titleCaseLevelBody(body: string) {
  if (!body) return "";
  const normalized = body.charAt(0).toUpperCase() + body.slice(1);
  return normalized.replace(
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(\s+)/,
    (_match, words, spacing) => {
      return `${words}${spacing}`;
    },
  );
}

function getGitHubOwner(githubUrl?: string): string | null {
  if (!githubUrl) return null;
  try {
    const parsed = new URL(githubUrl);
    if (!parsed.hostname.includes("github.com")) return null;
    const [owner] = parsed.pathname.split("/").filter(Boolean);
    return owner ?? null;
  } catch {
    return null;
  }
}

function getGitHubAvatarUrl(githubUrl?: string): string | null {
  const owner = getGitHubOwner(githubUrl);
  if (!owner) return null;
  return `https://github.com/${owner}.png?size=80`;
}

function getGitHubProfileUrl(githubUrl?: string): string | null {
  const owner = getGitHubOwner(githubUrl);
  if (!owner) return null;
  return `https://github.com/${owner}`;
}

function AuthorAvatarButton({
  githubUrl,
  className = "",
  tooltipClassName = "",
}: {
  githubUrl?: string;
  className?: string;
  tooltipClassName?: string;
}) {
  const owner = useMemo(() => getGitHubOwner(githubUrl), [githubUrl]);
  const avatarUrl = useMemo(() => getGitHubAvatarUrl(githubUrl), [githubUrl]);
  const profileUrl = useMemo(() => getGitHubProfileUrl(githubUrl), [githubUrl]);
  const [imageFailed, setImageFailed] = useState(false);
  const [authorLabel, setAuthorLabel] = useState<string | null>(owner);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    setAuthorLabel(owner);
    if (!owner) return;

    const controller = new AbortController();

    fetch(`https://api.github.com/users/${owner}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub user lookup failed (${response.status})`);
        return response.json() as Promise<{ name?: string; login?: string }>;
      })
      .then((payload) => {
        const login = payload.login?.trim() || owner;
        const name = payload.name?.trim();
        setAuthorLabel(name ? `${name} (@${login})` : `@${login}`);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAuthorLabel(`@${owner}`);
      });

    return () => controller.abort();
  }, [owner]);

  const tooltipLabel = authorLabel ?? "Author";

  return (
    <div
      className={`group ${className}`.trim()}
      aria-label={tooltipLabel}
    >
      <div
        className={`pointer-events-none absolute right-0 bottom-full mb-2 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold text-slate-50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${tooltipClassName}`.trim()}
        style={{
          background: "rgba(15,23,42,0.96)",
          border: "1px solid rgba(250,204,21,0.65)",
          boxShadow: "0 10px 20px rgba(2,6,23,0.45)",
        }}
      >
        {tooltipLabel}
      </div>
      <div
        role="button"
        tabIndex={0}
        className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full"
        style={{
          background: "linear-gradient(180deg, rgba(30,41,59,0.96), rgba(15,23,42,0.96))",
          border: "2px solid rgba(250,204,21,0.9)",
          boxShadow: "0 8px 20px rgba(2,6,23,0.45)",
        }}
        title={tooltipLabel}
        onClick={(event) => {
          event.stopPropagation();
          if (profileUrl) window.open(profileUrl, "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          if (profileUrl) window.open(profileUrl, "_blank", "noopener,noreferrer");
        }}
      >
        {avatarUrl && !imageFailed ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PersonIcon className="h-5 w-5 text-slate-200" />
        )}
      </div>
    </div>
  );
}

function GameAuthorBadge({ githubUrl }: { githubUrl?: string }) {
  return (
    <AuthorAvatarButton
      githubUrl={githubUrl}
      className="absolute right-2 bottom-2 z-20"
    />
  );
}

function isLiveSyllabusUrl(url: string | undefined) {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

function CurriculumTag({
  level,
  compact = false,
}: {
  level: TeachingLevel;
  compact?: boolean;
}) {
  if (!level.syllabusCode) return null;

  const liveUrl = isLiveSyllabusUrl(level.syllabusUrl)
    ? level.syllabusUrl
    : undefined;
  const colors = getCurriculumColor(level);
  const className = compact
    ? "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] leading-none font-bold tracking-wide"
    : "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide";
  const style = {
    borderColor: colors.border,
    background: colors.bg,
    color: colors.text,
  };

  if (!liveUrl) {
    return (
      <span className={className} style={style}>
        {level.syllabusCode}
      </span>
    );
  }

  return (
    <a
      href={liveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} transition-transform hover:scale-[1.02]`}
      style={style}
    >
      {level.syllabusCode}
    </a>
  );
}

function WhatItTeachesLevels({ levels }: { levels: TeachingLevel[] }) {
  return (
    <div className="space-y-2">
      {levels.map((level, index) => {
        const { prefix, body } = splitLevelLabel(level.label);
        const bodyText = titleCaseLevelBody(body);

        return (
          <div
            key={`${level.label}-${index}`}
            className="flex items-start gap-2 pl-1 text-sm text-slate-200"
          >
            <span style={{ color: "#4ade80" }} className="leading-6">
              –
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 leading-relaxed">
              {level.syllabusCode ? (
                <CurriculumTag level={level} compact />
              ) : null}
              <span style={{ color: "#4ade80" }} className="font-semibold">
                {prefix}
              </span>
              {bodyText ? <span>{bodyText}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReferencesSection({ levels }: { levels: TeachingLevel[] }) {
  return (
    <div className="mt-6 space-y-2">
      <p
        className="text-xs font-bold tracking-wider mb-3"
        style={{ color: "#38bdf8" }}
      >
        REFERENCES:
      </p>
      <div className="space-y-2">
        {levels.map((level, index) => (
          <div
            key={`reference-${level.syllabusCode ?? level.label}-${index}`}
            className="flex items-start gap-2 pl-1 text-sm text-slate-200"
          >
            <span style={{ color: "#4ade80" }} className="leading-6">
              –
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 leading-relaxed">
              {level.syllabusCode ? (
                <CurriculumTag level={level} compact />
              ) : null}
              {level.stageLabel ? (
                <span
                  style={{ color: getCurriculumColor(level).text }}
                  className="font-semibold"
                >
                  {level.stageLabel}
                </span>
              ) : null}
              {level.syllabusDescription ? (
                <span>{level.syllabusDescription}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderDescription(text: string, teachesLevels: TeachingLevel[]) {
  return splitDescriptionSections(text).flatMap((section, sectionIndex) => {
    const result: React.ReactNode[] = [];

    if (section.heading === "TECH:" && teachesLevels.length > 0) {
      result.push(
        <ReferencesSection
          key={`references-${sectionIndex}`}
          levels={teachesLevels}
        />,
      );
      result.push(
        <div key={`references-gap-${sectionIndex}`} className="h-4" />,
      );
    }

    if (section.heading !== null) {
      result.push(
        <p
          key={`heading-${sectionIndex}`}
          className="text-xs font-bold tracking-wider mb-3 mt-6 first:mt-0"
          style={{ color: "#38bdf8" }}
        >
          {section.heading}
          {section.headingRest && (
            <span className="font-normal tracking-normal text-slate-300">
              {" "}
              {section.headingRest}
            </span>
          )}
        </p>,
      );
    }

    if (section.heading === "WHAT IT TEACHES:" && teachesLevels.length > 0) {
      result.push(
        <WhatItTeachesLevels
          key={`teaches-${sectionIndex}`}
          levels={teachesLevels}
        />,
      );
      return result;
    }

    return result.concat(
      renderDescriptionLines(section.lines, `section-${sectionIndex}`),
    );
  });
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

/** Violet ribbon — starter/template game marker */
const starterTagStyle: CSSProperties = {
  background: "linear-gradient(180deg, #a78bfa 0%, #7c3aed 55%, #6d28d9 100%)",
  color: "white",
  border: "1px solid rgba(109, 40, 217, 0.35)",
  boxShadow:
    "0 2px 0 rgba(109, 40, 217, 0.45), 0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
  fontWeight: 800,
};

const YEAR_STRIP_COLORS: Record<string, string> = {
  preschool: "#ec4899",
  "1": "#0ea5e9",
  "2": "#f97316",
  "3": "#2563eb",
  "4": "#e11d48",
  "5": "#059669",
  "6": "#7c3aed",
  "7": "#ca8a04",
  "8": "#0891b2",
  "9": "#dc2626",
  "10": "#4f46e5",
};

/** Merge all active teachesLevels into a single year label, e.g. [Stage 2 Yr 3-4, Stage 3 Yr 5-6] → "Yr 3-6" */
function formatYearStripLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  if (/preschool|kindergarten/i.test(trimmed)) return "Preschool";
  const yearMatch = trimmed.match(/^(?:yr|year)?\s*(\d+(?:\s*-\s*\d+)?)$/i);
  if (yearMatch) return `Year ${yearMatch[1].replace(/\s+/g, "")}`;
  return trimmed;
}

/** Merge all active teachesLevels into a single year label, e.g. [Stage 2 Yr 3-4, Stage 3 Yr 5-6] → "Year 3-6" */
function deriveYearStripLabel(levels: TeachingLevel[]): string {
  // Exclude "coming soon" placeholder levels
  const active = levels.filter((lv) => !/coming soon/i.test(lv.label));
  let minYear = Infinity,
    maxYear = -Infinity;
  let hasKindergarten = false;
  for (const lv of active) {
    const sl = lv.stageLabel ?? "";
    if (/kindergarten/i.test(sl)) {
      hasKindergarten = true;
      continue;
    }
    const m = sl.match(/Years?\s+(\d+)-(\d+)/i);
    if (m) {
      minYear = Math.min(minYear, parseInt(m[1]));
      maxYear = Math.max(maxYear, parseInt(m[2]));
    }
  }
  if (minYear !== Infinity) return `Year ${minYear}-${maxYear}`;
  if (hasKindergarten) return "Preschool";
  return "";
}

function getYearStripLabel(levels: TeachingLevel[], fallback = ""): string {
  return formatYearStripLabel(fallback || deriveYearStripLabel(levels));
}

function getYearColor(yearLabel: string): string {
  if (/preschool|kindergarten/i.test(yearLabel)) {
    return YEAR_STRIP_COLORS.preschool;
  }
  const rangeMatch = yearLabel.match(/(\d+)\s*-\s*(\d+)/);
  const singleMatch = yearLabel.match(/(\d+)/);
  const anchorYear = rangeMatch
    ? parseInt(rangeMatch[1], 10)
    : singleMatch
      ? parseInt(singleMatch[1], 10)
      : 99;
  return YEAR_STRIP_COLORS[String(anchorYear)] ?? "#475569";
}

function getDisplayTeachingLevels(game: Game, launchLevel?: number): TeachingLevel[] {
  if (!launchLevel) return game.teachesLevels;
  const matchedLevel = game.teachesLevels[launchLevel - 1];
  return matchedLevel ? [matchedLevel] : game.teachesLevels;
}

function getDisplayName(game: Game, launchLevel?: number): string {
  return launchLevel ? `${game.name} ${launchLevel}` : game.name;
}

function getCardDisplayName(
  game: Game,
  launchLevel: number | undefined,
  demoModeEnabled: boolean,
): string {
  if (demoModeEnabled && launchLevel) return game.name;
  return getDisplayName(game, launchLevel);
}

function getDisplayImageUrl(game: Game, launchLevel?: number): string | undefined {
  if (!launchLevel) return game.imageUrl;
  return getGameLevelIconUrl(game, launchLevel) ?? game.imageUrl;
}

function getDisplayYearLabel(game: Game, launchLevel?: number): string {
  return getYearStripLabel(
    getDisplayTeachingLevels(game, launchLevel),
    game.yearLabel,
  );
}

function getSlotDisplayGame(slot: GameSlot): Game | null {
  if (!slot.game) return null;
  return {
    ...slot.game,
    name: slot.displayName ?? getDisplayName(slot.game, slot.launchLevel),
    imageUrl: slot.imageUrl ?? getDisplayImageUrl(slot.game, slot.launchLevel),
    teachesLevels:
      slot.teachesLevels.length > 0
        ? slot.teachesLevels
        : getDisplayTeachingLevels(slot.game, slot.launchLevel),
    yearLabel: slot.yearLabel || getDisplayYearLabel(slot.game, slot.launchLevel),
  };
}

function getSlotDisplayGameForMode(
  slot: GameSlot,
  demoModeEnabled: boolean,
): Game | null {
  const displayGame = getSlotDisplayGame(slot);
  if (!displayGame || !slot.game) return displayGame;
  return {
    ...displayGame,
    name: getCardDisplayName(slot.game, slot.launchLevel, demoModeEnabled),
  };
}

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

function LevelLaunchButtons({
  levels,
  enabledLevels,
  onSelect,
}: {
  levels: number[];
  enabledLevels?: number[];
  onSelect: (level: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {levels.map((level) => {
        const enabled = !enabledLevels || enabledLevels.includes(level);
        return (
          <button
            key={level}
            type="button"
            onClick={() => {
              if (enabled) onSelect(level);
            }}
            disabled={!enabled}
            className="inline-flex items-center gap-3 rounded-xl px-5 py-2 text-sm font-bold text-black transition-all"
            style={{
              background: enabled
                ? "linear-gradient(135deg, #4ade80, #16a34a)"
                : "linear-gradient(135deg, #475569, #334155)",
              cursor: enabled ? "pointer" : "not-allowed",
              opacity: enabled ? 1 : 0.5,
            }}
            title={enabled ? `Play level ${level}` : `Level ${level} unavailable from this card`}
            aria-label={enabled ? `Play level ${level}` : `Level ${level} unavailable`}
            onMouseEnter={(e) => {
              if (!enabled) return;
              (e.currentTarget as HTMLElement).style.background =
                "linear-gradient(135deg, #86efac, #22c55e)";
              (e.currentTarget as HTMLElement).style.transform = "scale(1.03)";
            }}
            onMouseLeave={(e) => {
              if (!enabled) return;
              (e.currentTarget as HTMLElement).style.background =
                "linear-gradient(135deg, #4ade80, #16a34a)";
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            <span aria-hidden="true">{enabled ? "▶" : "•"}</span>
            <span>{`Level ${level}`}</span>
          </button>
        );
      })}
    </div>
  );
}

const youtubeBubbleDismissedKey = "see-maths:youtube-bubble-dismissed";

function readYouTubeBubbleDismissed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(youtubeBubbleDismissedKey) === "true";
}

function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const videoId = parsed.hostname.includes("youtu.be")
      ? parsed.pathname.replace(/^\/+/, "")
      : (parsed.searchParams.get("v") ??
        (parsed.pathname.startsWith("/shorts/")
          ? parsed.pathname.split("/")[2]
          : null));
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

function ScreenshotCarousel({
  screenshots,
  videoUrl,
  name,
}: {
  screenshots: string[];
  videoUrl?: string;
  name: string;
}) {
  const media = useMemo(() => {
    const items: Array<
      { kind: "video"; src: string } | { kind: "image"; src: string }
    > = [];
    const embedUrl = videoUrl ? toYouTubeEmbedUrl(videoUrl) : null;
    if (embedUrl) items.push({ kind: "video", src: embedUrl });
    for (const screenshot of screenshots)
      items.push({ kind: "image", src: screenshot });
    return items;
  }, [screenshots, videoUrl]);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoadedImages({});
  }, [screenshots, videoUrl]);

  if (media.length === 0) return null;

  return (
    <div
      className="shrink-0 border-b p-4"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div
        className="hide-scrollbar flex gap-3 overflow-x-auto overflow-y-hidden rounded-2xl"
        style={{
          scrollBehavior: "smooth",
          touchAction: "pan-x pan-y",
          height: "min(44svh, 280px)",
        }}
      >
        {media.map((item, index) =>
          item.kind === "video" ? (
            <div
              key={`video-${item.src}`}
              className="relative h-full shrink-0 overflow-hidden rounded-2xl"
              style={{
                aspectRatio: "16 / 9",
                background: "#020617",
                border: "1px solid rgba(56,189,248,0.22)",
                boxShadow: "0 18px 40px rgba(2,6,23,0.4)",
              }}
            >
              <iframe
                src={item.src}
                title={`${name} video`}
                className="block h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <img
              key={`${item.src}-${index}`}
              src={item.src}
              alt={`${name} screenshot ${index}`}
              className="block h-full w-auto shrink-0 rounded-2xl object-contain"
              onLoad={() => {
                setLoadedImages((current) =>
                  current[item.src]
                    ? current
                    : { ...current, [item.src]: true },
                );
              }}
              style={{
                background: loadedImages[item.src] ? "#020617" : "transparent",
                border: loadedImages[item.src]
                  ? "1px solid rgba(56,189,248,0.22)"
                  : "0",
                boxShadow: loadedImages[item.src]
                  ? "0 18px 40px rgba(2,6,23,0.4)"
                  : "none",
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}

function LoadingCard({ slot }: { slot: GameSlot }) {
  return (
    <div
      className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl p-2 pt-3 text-center"
      style={{
        background: "rgba(15, 23, 42, 0.68)",
        border: "1px solid rgba(148, 163, 184, 0.28)",
      }}
      aria-label={`Loading ${slot.playUrl}`}
    >
      {slot.thirdParty ? (
        <span
          className="pointer-events-none absolute top-0 left-0 z-20 rounded-br-lg rounded-tl-2xl px-2.5 py-1.5 text-[10px] uppercase tracking-wide"
          style={partnerTagGoldStyle}
        >
          Partner
        </span>
      ) : null}

      {slot.yearLabel ? (
        <div
          className="pointer-events-none absolute z-[15]"
          style={{
            top: "18px",
            right: "-28px",
            width: "108px",
            transform: "rotate(45deg)",
            background: getYearColor(slot.yearLabel),
            color: "white",
            fontSize: "9px",
            fontWeight: 800,
            textAlign: "center",
            padding: "4px 0",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          {formatYearStripLabel(slot.yearLabel)}
        </div>
      ) : null}

      <div
        className="flex h-32 w-32 items-center justify-center rounded-[1.75rem]"
        style={{
          background:
            "linear-gradient(180deg, rgba(30,41,59,0.82) 0%, rgba(15,23,42,0.92) 100%)",
          border: "1px solid rgba(148,163,184,0.18)",
        }}
      >
        <div
          className="h-10 w-10 rounded-full"
          style={{
            border: "3px solid rgba(148,163,184,0.18)",
            borderTopColor: "#38bdf8",
            animation: "spin 0.9s linear infinite",
          }}
        />
      </div>

      <div className="w-full px-2">
        <div className="mx-auto h-4 w-24 rounded-full bg-slate-700/70" />
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        <span className="h-5 w-12 rounded-full bg-slate-800/80" />
        <span className="h-5 w-16 rounded-full bg-slate-800/65" />
      </div>
    </div>
  );
}

export default function App() {
  const [slots, setSlots] = useState<GameSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<{ game: Game; url: string } | null>(
    null,
  );
  const [drawer, setDrawer] = useState<{ game: Game; launchLevel?: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [commentComposeRequest, setCommentComposeRequest] = useState(0);
  const [commentReloadRequest, setCommentReloadRequest] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [demoModeEnabled, setDemoModeEnabledState] = useState(() =>
    resolveDemoModeFromUrl(),
  );
  const [commentNotificationsEnabled, setCommentNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      window.localStorage.getItem(SEE_MATHS_COMMENT_NOTIFICATIONS_KEY) === "on" ||
      window.localStorage.getItem(LEGACY_COMMENT_NOTIFICATIONS_KEY) === "on"
    );
  });
  const [commentNotificationsBusy, setCommentNotificationsBusy] = useState(false);
  const [commentNotificationsTesting, setCommentNotificationsTesting] = useState(false);
  const [commentNotificationsError, setCommentNotificationsError] = useState("");
  const [youtubeBubbleDismissed, setYoutubeBubbleDismissed] = useState(
    readYouTubeBubbleDismissed,
  );
  const [isMobileLandscape, setIsMobileLandscape] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024 && window.innerWidth > window.innerHeight;
  });
  const [isMobilePortrait, setIsMobilePortrait] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024 && window.innerWidth <= window.innerHeight;
  });
  const activeAnalyticsSessionRef = useRef<AnalyticsSession | null>(null);
  const siteAnalyticsSessionRef = useRef<AnalyticsSession | null>(null);
  const confirmedMobileGamesRef = useRef<Set<string>>(new Set());
  const [pendingMobilePlay, setPendingMobilePlay] = useState<
    { game: Game; url: string } | null
  >(null);

  useEffect(() => {
    const listFile = "/games.json";
    const controller = new AbortController();
    let cancelled = false;

    setSlots([]);
    setLoading(true);

    fetch(listFile, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Failed to fetch ${listFile} (${r.status})`);
        }
        return r.json() as Promise<GameListEntry[]>;
      })
      .then(async (entries) => {
        const initialSlots = entries
          .flatMap((entry, index) => createGameSlots(entry, index))
          .sort(compareGameSlots);

        if (!cancelled) {
          setSlots(initialSlots);
        }

        await loadGamesListProgressively(entries, (game, index) => {
          if (cancelled) return;
          const baseSlotId = `${index}:${entries[index].playUrl.trim()}`;
          setSlots((current) =>
            current
              .map((slot) =>
                slot.slotId === baseSlotId ||
                slot.slotId.startsWith(`${baseSlotId}:level-`)
                  ? {
                      ...slot,
                      game,
                      displayName: getDisplayName(game, slot.launchLevel),
                      imageUrl: getDisplayImageUrl(game, slot.launchLevel),
                      teachesLevels: getDisplayTeachingLevels(game, slot.launchLevel),
                      yearLabel: getDisplayYearLabel(game, slot.launchLevel),
                      yearSortKey: parseYearSortKey(
                        getDisplayYearLabel(game, slot.launchLevel),
                      ),
                    }
                  : slot,
              )
              .sort(compareGameSlots),
          );
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("Failed to load games list:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const syncViewportMode = () => {
      setIsMobileLandscape(
        window.innerWidth < 1024 && window.innerWidth > window.innerHeight,
      );
      setIsMobilePortrait(
        window.innerWidth < 1024 && window.innerWidth <= window.innerHeight,
      );
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      youtubeBubbleDismissedKey,
      youtubeBubbleDismissed ? "true" : "false",
    );
  }, [youtubeBubbleDismissed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SEE_MATHS_COMMENT_NOTIFICATIONS_KEY,
      commentNotificationsEnabled ? "on" : "off",
    );
    window.localStorage.setItem(
      LEGACY_COMMENT_NOTIFICATIONS_KEY,
      commentNotificationsEnabled ? "on" : "off",
    );
  }, [commentNotificationsEnabled]);

  async function toggleCommentNotifications() {
    if (commentNotificationsBusy) {
      return;
    }

    setCommentNotificationsBusy(true);
    setCommentNotificationsError("");

    try {
      if (commentNotificationsEnabled) {
        await disablePushSubscription();
        setCommentNotificationsEnabled(false);
      } else {
        await ensurePushSubscription();
        setCommentNotificationsEnabled(true);
      }
    } catch (error) {
      setCommentNotificationsError(
        error instanceof Error ? error.message : "Unable to update comment notifications.",
      );
    } finally {
      setCommentNotificationsBusy(false);
    }
  }

  async function sendCommentNotificationTest() {
    if (commentNotificationsBusy || commentNotificationsTesting) {
      return;
    }

    setCommentNotificationsTesting(true);
    setCommentNotificationsError("");

    try {
      await sendTestPush();
      setCommentNotificationsEnabled(true);
    } catch (error) {
      setCommentNotificationsError(
        error instanceof Error ? error.message : "Unable to send test notification.",
      );
    } finally {
      setCommentNotificationsTesting(false);
    }
  }

  const openDrawer = (g: Game, launchLevel?: number) => {
    closeSocialDrawers();
    setDrawer({ game: g, launchLevel });
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

  async function handleShare() {
    setShowCommentsDrawer(false);

    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data?: ShareData) => boolean;
      standalone?: boolean;
    };
    const shareData: ShareData = {
      title: document.title || "See Maths",
      text: "Check out this maths game on See Maths!",
      url: withDemoParam(SHELL_PUBLIC_URL, demoModeEnabled),
    };
    const looksMobileOrPwa =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      !!nav.standalone ||
      navigator.maxTouchPoints > 0;

    if (
      looksMobileOrPwa &&
      typeof nav.share === "function" &&
      (!nav.canShare || nav.canShare(shareData))
    ) {
      try {
        await nav.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }

    setShowShareDrawer((open) => !open);
  }

  function toggleCommentsDrawer() {
    setShowShareDrawer(false);
    setShowCommentsDrawer((open) => !open);
  }

  const filteredSlots = slots.filter((slot) => {
    if (demoModeEnabled && slot.game) {
      const isRipple = slot.game.url.includes("maths-game-template");
      if (isRipple || slot.game.thirdParty) {
        return false;
      }
      if (slot.launchLevel) {
        const launchLevels = getLaunchLevels(slot.game);
        const lowestLevel = launchLevels.length > 0 ? launchLevels[0] : slot.launchLevel;
        if (slot.launchLevel !== lowestLevel) {
          return false;
        }
      }
    }
    const q = query.toLowerCase();
    if (!q) return true;
    if (!slot.game) return false;
    const g = getSlotDisplayGameForMode(slot, demoModeEnabled) ?? slot.game;
    return (
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.tags.some((t) => t.includes(q)) ||
      g.skills.some((s) => s.includes(q)) ||
      g.description.toLowerCase().includes(q)
    );
  });
  const commentPageUrl = active ? active.game.url : SHELL_PUBLIC_URL;
  const drawerGame = drawer?.game ?? null;
  const drawerDisplayGame =
    drawerGame && drawer
      ? {
          ...drawerGame,
          name: getCardDisplayName(
            drawerGame,
            drawer.launchLevel,
            demoModeEnabled,
          ),
          imageUrl: getDisplayImageUrl(drawerGame, drawer.launchLevel),
          teachesLevels: getDisplayTeachingLevels(
            drawerGame,
            drawer.launchLevel,
          ),
          yearLabel: getDisplayYearLabel(drawerGame, drawer.launchLevel),
        }
      : null;
  const drawerEnabledLevels =
    demoModeEnabled || !drawer?.launchLevel ? undefined : [drawer.launchLevel];

  function startPlay(g: Game, level?: number) {
    closeSocialDrawers();
    const levelUrl = level ? withLevelParam(g.url, level) : g.url;
    const targetUrl = withDemoParam(levelUrl, demoModeEnabled);
    if (g.openInNewTab) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (
      isMobileViewport() &&
      !confirmedMobileGamesRef.current.has(g.id)
    ) {
      setPendingMobilePlay({ game: g, url: targetUrl });
      return;
    }
    setActive({ game: g, url: targetUrl });
  }

  function proceedMobilePlay() {
    if (!pendingMobilePlay) return;
    confirmedMobileGamesRef.current.add(pendingMobilePlay.game.id);
    setActive(pendingMobilePlay);
    setPendingMobilePlay(null);
  }

  function cancelMobilePlay() {
    setPendingMobilePlay(null);
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent<EmbeddedGameAnalyticsMessage>) => {
      const data = event.data;
      if (!data || (data.type !== "see-maths:analytics-event" && data.type !== "interactive-maths:analytics-event")) {
        return;
      }

      const session = activeAnalyticsSessionRef.current;
      if (!session || session.ended || !active) {
        return;
      }

      const source = event.source;
      const frame = document.querySelector("iframe");
      if (frame?.contentWindow && source !== frame.contentWindow) {
        return;
      }

      const eventName = typeof data.eventName === "string" ? data.eventName.trim() : "";
      if (!eventName) {
        return;
      }

      sendEmbeddedGameAnalyticsEvent(
        session,
        eventName,
        data.payload && typeof data.payload === "object" ? data.payload : {},
      );
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [active]);

  useEffect(() => installEmbeddedStorageBridge(), []);

  useEffect(() => {
    if (active) {
      return;
    }

    const analyticsSession = createSiteAnalyticsSession();
    siteAnalyticsSessionRef.current = analyticsSession;
    startAnalyticsSession(analyticsSession);
    heartbeatAnalyticsSession(analyticsSession);

    const heartbeatId = window.setInterval(() => {
      heartbeatAnalyticsSession(analyticsSession);
    }, analyticsHeartbeatIntervalMs());

    const handlePageHide = () => {
      endAnalyticsSession(analyticsSession, "pagehide");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        heartbeatAnalyticsSession(analyticsSession);
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      endAnalyticsSession(analyticsSession, "game-opened");

      if (siteAnalyticsSessionRef.current?.sessionId === analyticsSession.sessionId) {
        siteAnalyticsSessionRef.current = null;
      }
    };
  }, [active]);

  useEffect(() => {
    const handlePopState = () => {
      setDemoModeEnabledState(resolveDemoModeFromUrl());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    const analyticsSession = createAnalyticsSession(active.game, active.url);
    activeAnalyticsSessionRef.current = analyticsSession;
    startAnalyticsSession(analyticsSession);
    heartbeatAnalyticsSession(analyticsSession);

    const heartbeatId = window.setInterval(() => {
      heartbeatAnalyticsSession(analyticsSession);
    }, analyticsHeartbeatIntervalMs());

    const handlePageHide = () => {
      endAnalyticsSession(analyticsSession, "pagehide");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        heartbeatAnalyticsSession(analyticsSession);
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      endAnalyticsSession(analyticsSession, "shell-exit");

      if (activeAnalyticsSessionRef.current?.sessionId === analyticsSession.sessionId) {
        activeAnalyticsSessionRef.current = null;
      }
    };
  }, [active]);

  if (pendingMobilePlay) {
    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center px-6"
        style={{ backgroundColor: "#020617" }}
      >
        <div
          className="w-full max-w-md rounded-2xl px-6 py-8 text-center"
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
            boxShadow: "0 20px 60px rgba(2, 6, 23, 0.65)",
          }}
        >
          <div className="text-xs font-black uppercase tracking-[0.22em] text-sky-400">
            Heads up
          </div>
          <h2 className="mt-2 text-lg font-black text-white">
            {pendingMobilePlay.game.name}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-200">
            These games work best on a larger screen like a tablet or desktop.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={proceedMobilePlay}
              className="whitespace-nowrap rounded-xl px-4 py-3 text-sm font-bold text-slate-950 transition-all"
              style={{ background: "#facc15" }}
            >
              Try mobile version
            </button>
            <button
              type="button"
              onClick={cancelMobilePlay}
              className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: "transparent",
          touchAction: "none",
          overscrollBehavior: "none",
        }}
      >
        <iframe
          src={iframeSrc(active.url)}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; clipboard-write; encrypted-media; web-share"
          referrerPolicy="no-referrer-when-downgrade"
          title={active.game.name}
          style={{
            touchAction: "none",
            overscrollBehavior: "none",
          }}
        />
        {active.game.thirdParty && <PartnerIframeChrome url={active.url} />}
        <button
          onClick={() => setActive(null)}
          title="Home"
          aria-label="Return to home"
          className="arcade-button absolute top-2 left-2 z-[40] h-10 w-10 p-2"
        >
          <svg className="h-full w-full" viewBox="0 0 24 24" fill="white">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100lvh] px-6 py-10"
      style={{ backgroundColor: "transparent" }}
    >
      <div
        className="app-shell-actions"
        style={{
          opacity: showSettingsModal ? 0 : 1,
          pointerEvents: showSettingsModal ? "none" : "auto",
        }}
        aria-hidden={showSettingsModal}
      >
        <div className="app-youtube-cta">
          {!youtubeBubbleDismissed ? (
            <div
              className="app-youtube-bubble"
              role="complementary"
              aria-label="YouTube channel prompt"
            >
              <a
                href={SHELL_YOUTUBE_URL}
                target="_blank"
                rel="noreferrer"
                title="Open YouTube channel"
                className="app-youtube-bubble-link"
              >
                <span className="app-youtube-bubble-icon-shell">
                  <img
                    src={SHELL_YOUTUBE_ICON_URL}
                    alt="YouTube"
                    className="app-settings-icon"
                  />
                </span>
                <span className="app-youtube-bubble-copy">
                  View and subscribe to our YouTube channel.
                </span>
              </a>
              <button
                type="button"
                className="app-youtube-bubble-dismiss"
                onClick={() => setYoutubeBubbleDismissed(true)}
              >
                Don&apos;t show again
              </button>
            </div>
          ) : null}
          <a
            href={SHELL_YOUTUBE_URL}
            target="_blank"
            rel="noreferrer"
            title="Open YouTube channel"
            className="app-settings-button app-settings-button-plain"
          >
            <img
              src={SHELL_YOUTUBE_ICON_URL}
              alt="YouTube"
              className="app-settings-icon"
            />
          </a>
        </div>
        <a
          href={SHELL_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          title="Open shell GitHub"
          className="arcade-button app-settings-button"
        >
          <GitHubIcon className="app-settings-icon" />
        </a>
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          title="Settings"
          className="arcade-button app-settings-button"
        >
          <svg
            viewBox="0 0 24 24"
            className="app-settings-icon"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.028 7.028 0 0 0-1.63-.94l-.36-2.54A.488.488 0 0 0 13.9 2h-3.8c-.24 0-.44.17-.48.41l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.493.493 0 0 0-.6.22L2.72 8.47a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.07.64-.07.95s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.39.31.6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54c.04.24.24.41.48.41h3.8c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.22.09.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.01-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
          </svg>
        </button>
        {!demoModeEnabled && !isMobilePortrait ? (
          <button
            type="button"
            onClick={() => {
              setDemoModeEnabled(true);
              setDemoModeEnabledState(true);
            }}
            className="app-demo-launch whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-slate-950 transition-all"
            style={{ background: "#facc15" }}
            title="Enter demo mode"
            aria-label="Enter demo mode"
          >
            Enter Demo Mode
          </button>
        ) : null}
      </div>
      <div className="max-w-5xl mx-auto w-full">
        {!demoModeEnabled && isMobilePortrait ? (
          <div className="-mt-4 mb-3 flex w-full justify-center">
            <button
              type="button"
              onClick={() => {
                setDemoModeEnabled(true);
                setDemoModeEnabledState(true);
              }}
              className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-slate-950 transition-all"
              style={{ background: "#facc15" }}
              title="Enter demo mode"
              aria-label="Enter demo mode"
            >
              Enter Demo Mode
            </button>
          </div>
        ) : null}
        <header
          className={`app-shell-header mb-10 flex flex-col items-center overflow-visible text-center ${
            isMobilePortrait ? "pt-0" : "pt-4"
          }`}
        >
          <div className="relative mb-1 inline-block overflow-visible pl-10">
            <EyesLogo className="absolute left-3 top-[-0.9rem] h-5 w-auto" />
            <p className="text-[1.125rem] font-bold tracking-[0.25em] text-sky-400">
              See the Maths you Do
            </p>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by topic or skill…"
            className="w-full max-w-md rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none text-left mt-3"
            style={{ background: "#0f172a", border: "1px solid #334155" }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#0ea5e9";
              e.currentTarget.style.boxShadow =
                "0 0 25px rgba(14,165,233,0.8), 0 0 60px rgba(14,165,233,0.35)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#334155";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {demoModeEnabled ? (
            <div
              className="mt-4 w-full max-w-md rounded-2xl px-4 py-3 text-left"
              style={{
                background: "#09104c",
                border: "1px solid rgba(96, 165, 250, 0.45)",
                boxShadow: "0 0 24px rgba(59, 130, 246, 0.16)",
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-sm">
                  <p className="text-sm leading-relaxed text-slate-100">
                    In Demo mode, you can pass a level with only two questions. Meant for a quick-preview by an Adult.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDemoModeEnabled(false);
                    setDemoModeEnabledState(false);
                  }}
                  className="self-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-slate-950 transition-all"
                  style={{ background: "#facc15" }}
                >
                  Exit Demo
                </button>
              </div>
            </div>
          ) : null}
        </header>

        {filteredSlots.length === 0 && !loading ? (
          <p className="text-slate-500">No games match "{query}".</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredSlots.map((slot) =>
              slot.game ? (
                (() => {
                  const cardGame = getSlotDisplayGameForMode(
                    slot,
                    demoModeEnabled,
                  );
                  if (!cardGame) return null;
                  const label = getYearStripLabel(
                    cardGame.teachesLevels,
                    cardGame.yearLabel,
                  );
                  return (
                    <button
                      key={slot.slotId}
                      onClick={() => openDrawer(slot.game!, slot.launchLevel)}
                      className="relative flex w-full max-w-[206px] justify-self-center flex-col items-center gap-3 overflow-hidden rounded-2xl p-2 pt-3 text-center transition-all cursor-pointer"
                      style={{ background: "#0f172a", border: "1px solid #1e293b" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "0 0 25px rgba(74,222,128,0.8), 0 0 60px rgba(74,222,128,0.35)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                    >
                      {cardGame.thirdParty ? (
                        <span
                          className="pointer-events-none absolute top-0 left-0 z-20 rounded-br-lg rounded-tl-2xl px-2.5 py-1.5 text-[10px] uppercase tracking-wide"
                          style={partnerTagGoldStyle}
                        >
                          Partner
                        </span>
                      ) : cardGame.tags.includes("starter") ? (
                        <span
                          className="pointer-events-none absolute top-0 left-0 z-20 rounded-br-lg rounded-tl-2xl px-2.5 py-1.5 text-[10px] uppercase tracking-wide"
                          style={starterTagStyle}
                        >
                          Starter
                        </span>
                      ) : null}

                      {label ? (
                        <div
                          className="pointer-events-none absolute z-[15]"
                          style={{
                            top: "18px",
                            right: "-28px",
                            width: "108px",
                            transform: "rotate(45deg)",
                            background: getYearColor(label),
                            color: "white",
                            fontSize: "9px",
                            fontWeight: 800,
                            textAlign: "center",
                            padding: "4px 0",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          {label}
                        </div>
                      ) : null}

                      <GameIcon
                        game={cardGame}
                        className="w-32 h-32 object-contain"
                      />
                      <div className="px-1">
                        <div className="text-white font-bold text-sm leading-tight">
                          {cardGame.name}
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap justify-start gap-1 pl-2 pr-12">
                        {cardGame.tags.slice(0, 2).map((t, i) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: SKILL_COLORS[i % SKILL_COLORS.length].bg,
                              color: SKILL_COLORS[i % SKILL_COLORS.length].color,
                              border: `1px solid ${SKILL_COLORS[i % SKILL_COLORS.length].color}`,
                            }}
                          >
                            {formatTag(t)}
                          </span>
                        ))}
                      </div>
                      <GameAuthorBadge githubUrl={cardGame.githubUrl} />
                    </button>
                  );
                })()
              ) : (
                <LoadingCard key={slot.slotId} slot={slot} />
              ),
            )}
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
          <div
            className="fixed top-1.5 left-2 z-[60] flex items-center gap-2"
            style={{
              transform: drawerOpen ? "translateY(0)" : "translateY(100dvh)",
              transition: "transform 0.3s ease",
            }}
          >
            <button
              onClick={closeDrawer}
              title="Home"
              className="arcade-button w-10 h-10 p-2"
            >
              <svg className="w-full h-full" viewBox="0 0 24 24" fill="white">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </button>

            {drawerGame?.githubUrl ? (
              <a
                href={drawerGame.githubUrl}
                target="_blank"
                rel="noreferrer"
                title="Open app GitHub"
                className="arcade-button w-10 h-10 p-2"
              >
                <GitHubIcon className="detail-github-icon" />
              </a>
            ) : null}

            {isMobilePortrait ? (
              <AuthorAvatarButton
                githubUrl={drawerGame?.githubUrl}
                className="relative z-[60]"
              />
            ) : null}

          </div>

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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#166534";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#14532d";
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M18 6L6 18M6 6l12 12" />
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
              <div
                className="p-4 pb-3 pt-10 shrink-0"
                style={{ borderBottom: "1px solid #1e293b" }}
              >
                <div className="flex items-center gap-4">
                  <GameIcon
                    game={drawerDisplayGame!}
                    className="w-32 h-32 rounded-[1.75rem] object-contain shrink-0"
                    alt=""
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2 justify-center">
                    {drawerGame?.thirdParty ? (
                      <span
                        className="self-start rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider"
                        style={partnerTagGoldStyle}
                      >
                        Partner site
                      </span>
                    ) : drawerGame?.tags.includes("starter") ? (
                      <span
                        className="self-start rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider"
                        style={starterTagStyle}
                      >
                        Starter app
                      </span>
                    ) : null}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black text-white leading-tight">
                          {drawerGame?.name}
                        </h2>
                      </div>
                      {drawerGame?.buildStamp && !drawerGame.thirdParty && (
                        <p className="text-[10px] leading-none text-sky-300/10 transition-colors hover:text-sky-300/80">
                          Build {drawerGame.buildStamp}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {drawerGame && getLaunchLevels(drawerGame).length > 0 ? (
                        <LevelLaunchButtons
                          levels={getLaunchLevels(drawerGame)}
                          enabledLevels={drawerEnabledLevels}
                          onSelect={(level) => {
                            startPlay(drawerGame, level);
                            if (!drawerGame.openInNewTab) closeDrawer();
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!drawerGame) return;
                            startPlay(drawerGame);
                            if (!drawerGame.openInNewTab) closeDrawer();
                          }}
                          className="self-start rounded-xl px-6 py-2 text-sm font-bold text-black cursor-pointer transition-all"
                          style={{
                            background:
                              "linear-gradient(135deg, #4ade80, #16a34a)",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              "linear-gradient(135deg, #86efac, #22c55e)";
                            (e.currentTarget as HTMLElement).style.transform =
                              "scale(1.03)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              "linear-gradient(135deg, #4ade80, #16a34a)";
                            (e.currentTarget as HTMLElement).style.transform =
                              "scale(1)";
                          }}
                        >
                          {drawerGame?.openInNewTab ? "▶ Open game" : "▶ Play"}
                        </button>
                      )}
                    </div>
                    {drawerGame?.thirdParty && !drawerGame.openInNewTab && (
                      <button
                        type="button"
                        onClick={() => {
                          window.open(
                            withDemoParam(drawerGame.url, demoModeEnabled),
                            "_blank",
                            "noopener,noreferrer",
                          );
                          closeDrawer();
                        }}
                        className="w-full rounded-xl px-5 py-2 text-sm font-bold cursor-pointer transition-all"
                        style={{
                          background: "#1e293b",
                          color: "#e2e8f0",
                          border: "1px solid #475569",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "#38bdf8";
                          (e.currentTarget as HTMLElement).style.color =
                            "#38bdf8";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "#475569";
                          (e.currentTarget as HTMLElement).style.color =
                            "#e2e8f0";
                        }}
                      >
                        ↗ New tab
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1">
                  {drawerGame?.skills.slice(0, 4).map((s, i) => (
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
                {drawerGame?.thirdParty && (
                  <p
                    className="mt-3 max-w-full text-[10px] leading-snug"
                    style={{ color: "#64748b", wordBreak: "break-all" }}
                    title={drawerGame.url}
                  >
                    {drawerGame.url}
                  </p>
                )}
              </div>
            ) : (
              <div
                className="flex gap-5 p-4 pb-3 pt-10 shrink-0"
                style={{ borderBottom: "1px solid #1e293b" }}
              >
                <GameIcon
                  game={drawerDisplayGame!}
                  className="w-40 h-40 rounded-[1.75rem] object-contain shrink-0"
                  alt=""
                />
                <div className="flex flex-col gap-4 justify-center min-w-0">
                  {drawerGame?.thirdParty ? (
                    <span
                      className="self-start rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider"
                      style={partnerTagGoldStyle}
                      >
                        Partner site
                      </span>
                  ) : drawerGame?.tags.includes("starter") ? (
                    <span
                      className="self-start rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider"
                      style={starterTagStyle}
                    >
                      Starter app
                    </span>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {drawerGame?.skills.slice(0, 4).map((s, i) => (
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
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black text-white leading-tight">
                        {drawerGame?.name}
                      </h2>
                      <AuthorAvatarButton
                        githubUrl={drawerGame?.githubUrl}
                        className="relative shrink-0"
                      />
                    </div>
                    {drawerGame?.buildStamp && !drawerGame.thirdParty && (
                      <p className="pb-0.5 text-[10px] leading-none text-sky-300/10 transition-colors hover:text-sky-300/80">
                        Build {drawerGame.buildStamp}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {drawerGame && getLaunchLevels(drawerGame).length > 0 ? (
                      <LevelLaunchButtons
                        levels={getLaunchLevels(drawerGame)}
                        enabledLevels={drawerEnabledLevels}
                        onSelect={(level) => {
                          startPlay(drawerGame, level);
                          if (!drawerGame.openInNewTab) closeDrawer();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!drawerGame) return;
                          startPlay(drawerGame);
                          if (!drawerGame.openInNewTab) closeDrawer();
                        }}
                        className="px-6 py-2 rounded-xl font-bold text-sm text-black cursor-pointer transition-all"
                        style={{
                          background:
                            "linear-gradient(135deg, #4ade80, #16a34a)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "linear-gradient(135deg, #86efac, #22c55e)";
                          (e.currentTarget as HTMLElement).style.transform =
                            "scale(1.03)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "linear-gradient(135deg, #4ade80, #16a34a)";
                          (e.currentTarget as HTMLElement).style.transform =
                            "scale(1)";
                        }}
                      >
                        {drawerGame?.openInNewTab ? "▶ Open game" : "▶ Play"}
                      </button>
                    )}
                    {drawerGame?.thirdParty && !drawerGame.openInNewTab && (
                      <button
                        type="button"
                        onClick={() => {
                          window.open(
                            withDemoParam(drawerGame.url, demoModeEnabled),
                            "_blank",
                            "noopener,noreferrer",
                          );
                          closeDrawer();
                        }}
                        className="px-5 py-2 rounded-xl font-bold text-sm cursor-pointer transition-all"
                        style={{
                          background: "#1e293b",
                          color: "#e2e8f0",
                          border: "1px solid #475569",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "#38bdf8";
                          (e.currentTarget as HTMLElement).style.color =
                            "#38bdf8";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "#475569";
                          (e.currentTarget as HTMLElement).style.color =
                            "#e2e8f0";
                        }}
                      >
                        ↗ New tab
                      </button>
                    )}
                  </div>
                  {drawerGame?.thirdParty && (
                    <p
                      className="mt-2 max-w-full text-[10px] leading-snug"
                      style={{ color: "#64748b", wordBreak: "break-all" }}
                      title={drawerGame.url}
                    >
                      {drawerGame.url}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="lg:flex-1 lg:overflow-y-auto">
              {(drawerGame?.videoUrl || (drawerGame?.screenshots.length ?? 0) > 0) && (
                <ScreenshotCarousel
                  screenshots={drawerGame?.screenshots ?? []}
                  videoUrl={drawerGame?.videoUrl}
                  name={drawerGame?.name ?? ""}
                />
              )}

              {/* Row 2: description */}
              <div className="shrink-0 p-6">
                {drawerGame
                  ? renderDescription(drawerGame.description, drawerGame.teachesLevels)
                  : null}
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
          <svg
            viewBox="0 0 24 24"
            className="shell-social-launcher-icon"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="5.5"
              r="2.25"
              stroke="currentColor"
              strokeWidth="1.9"
            />
            <circle
              cx="6"
              cy="12"
              r="2.25"
              stroke="currentColor"
              strokeWidth="1.9"
            />
            <circle
              cx="18"
              cy="18.5"
              r="2.25"
              stroke="currentColor"
              strokeWidth="1.9"
            />
            <path
              d="M8.1 10.95 15.9 6.55"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <path
              d="M8.1 13.05 15.9 17.45"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
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
          <svg
            viewBox="0 0 24 24"
            className="shell-social-launcher-icon"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 6.5h12a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 3v-3H6A2.5 2.5 0 0 1 3.5 15V9A2.5 2.5 0 0 1 6 6.5Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {(showShareDrawer || showCommentsDrawer) && (
        <div className="shell-social-backdrop" onClick={closeSocialDrawers} />
      )}

      {showSettingsModal && (
        <div
          className="settings-overlay"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="settings-card"
            onClick={(event) => event.stopPropagation()}
          >
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

            <div className="settings-switch-row">
              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                <strong
                  style={{
                    display: "block",
                    color: "#f8fafc",
                    fontSize: "0.95rem",
                  }}
                >
                  Notifications
                </strong>
                <button
                  type="button"
                  className="settings-push-button"
                  onClick={() => void sendCommentNotificationTest()}
                  disabled={commentNotificationsBusy || commentNotificationsTesting}
                >
                  {commentNotificationsTesting ? "SENDING…" : "TEST"}
                </button>
              </div>
              <button
                type="button"
                className="settings-switch"
                role="switch"
                aria-checked={commentNotificationsEnabled}
                aria-label="Toggle See Maths comment notifications"
                onClick={() => void toggleCommentNotifications()}
                disabled={commentNotificationsBusy || commentNotificationsTesting}
              >
                <span
                  className="settings-switch-track"
                  style={{
                    background: commentNotificationsEnabled ? "#ca8a04" : "#334155",
                    opacity: commentNotificationsBusy || commentNotificationsTesting ? 0.75 : 1,
                  }}
                >
                  <span
                    className="settings-switch-thumb"
                    style={{
                      transform: commentNotificationsEnabled ? "translateX(1.4rem)" : "translateX(0)",
                    }}
                  />
                </span>
              </button>
            </div>
            {commentNotificationsError ? (
              <small
                style={{
                  display: "block",
                  marginTop: "0.7rem",
                  color: "#fca5a5",
                }}
              >
                {commentNotificationsError}
              </small>
            ) : null}
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
          transform: showShareDrawer
            ? "translateY(0)"
            : "translateY(calc(100% + 1rem))",
          background: "rgba(2,6,23,0.97)",
          border: "3px solid rgba(56,189,248,0.4)",
          borderRadius: "16px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
          width: "fit-content",
          maxWidth: "calc(100vw - 2rem)",
        }}
      >
        <div
          className="shell-social-drawer-header"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="shell-social-share-title">Spread the word...</div>
          <button
            type="button"
            onClick={() => setShowShareDrawer(false)}
            className="shell-social-drawer-close"
            aria-label="Close share drawer"
          >
            ✕
          </button>
        </div>
        <SocialShare
          shareUrl={withDemoParam(SHELL_PUBLIC_URL, demoModeEnabled)}
        />
      </div>

      <div
        id="shell-social-comments-drawer"
        className="shell-social-comments-drawer"
        aria-hidden={!showCommentsDrawer}
        style={{
          width: "100vw",
          height: isMobileLandscape || isMobilePortrait ? "100dvh" : "70vh",
          maxWidth: "100vw",
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
            <button
              type="button"
              onClick={closeCommentsDrawer}
              className="shell-social-drawer-close shell-social-drawer-close-comments"
              aria-label="Close comments drawer"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="shell-social-comments-shell">
          {showCommentsDrawer ? (
            <SocialComments
              pageUrl={commentPageUrl}
              composeRequest={commentComposeRequest}
              reloadRequest={commentReloadRequest}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
