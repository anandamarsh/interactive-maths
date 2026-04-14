/**
 * games.json entries:
 * - remote: { playUrl, year } for first-party games that expose manifest.json
 * - inline: { playUrl, year, manifest } for third-party or custom-hosted cards
 * - override: { playUrl, year, manifestOverrides } to merge a remote manifest with local overrides
 */

export interface GameManifest {
  id?: string;
  name?: string;
  icon?: string;
  ["level-icons"]?: GameLevelIcon[];
  screenshots?: string[];
  videoUrl?: string;
  tags?: string[];
  subjects?: string[];
  skills?: string[];
  githubUrl?: string;
  description?: string;
  teachesLevels?: TeachingLevel[];
  /** Set true in remote manifest to mark partner games */
  thirdParty?: boolean;
}

export interface TeachingLevel {
  label: string;
  stageLabel?: string;
  syllabusCode?: string;
  syllabusUrl?: string;
  syllabusDescription?: string;
}

export interface GameLevelIcon {
  level: number;
  src: string;
  sizes?: string;
  type?: string;
}

export interface GameListBaseEntry {
  playUrl: string;
  year: string;
  /** Card / drawer image; defaults to favicon discovery for host */
  imageUrl?: string;
  /** Skip iframe; open playUrl in a new tab */
  openInNewTab?: boolean;
}

export interface RemoteGameEntry extends GameListBaseEntry {}

export interface InlineGameEntry extends GameListBaseEntry {
  manifest: GameManifest;
}

export interface RemoteGameOverrideEntry extends GameListBaseEntry {
  manifestOverrides: GameManifest;
}

export type GameListEntry = RemoteGameEntry | InlineGameEntry | RemoteGameOverrideEntry;

export interface Game {
  id: string;
  name: string;
  url: string;
  screenshots: string[];
  videoUrl?: string;
  buildStamp?: string;
  tags: string[];
  subjects: string[];
  skills: string[];
  githubUrl?: string;
  description: string;
  teachesLevels: TeachingLevel[];
  levelIcons: GameLevelIcon[];
  /** Card + drawer art (first-party: omit -> favicon.svg on game origin) */
  imageUrl?: string;
  thirdParty: boolean;
  openInNewTab: boolean;
  yearLabel: string;
  yearSortKey: number;
}

export interface GameSlot {
  slotId: string;
  playUrl: string;
  launchLevel?: number;
  displayName?: string;
  imageUrl?: string;
  yearLabel: string;
  yearSortKey: number;
  teachesLevels: TeachingLevel[];
  thirdParty: boolean;
  openInNewTab: boolean;
  game: Game | null;
}

async function fetchJsonNoCache<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export const base = (url: string) => url.replace(/\/?$/, "/");

function toUrl(url: string): URL | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return null;
  }
}

function manifestBase(url: string): string {
  const parsed = toUrl(url);
  if (!parsed) return base(url.split(/[?#]/, 1)[0] ?? url);
  parsed.search = "";
  parsed.hash = "";
  return base(parsed.toString());
}

export function hostFromPlayUrl(playUrl: string): string | null {
  return toUrl(playUrl)?.hostname ?? null;
}

function slugFromUrl(url: string): string {
  const host = hostFromPlayUrl(url);
  if (host) return host.replace(/^www\./, "").replace(/\./g, "-");
  return "game";
}

export function isInlineGameEntry(entry: unknown): entry is InlineGameEntry {
  if (entry === null || typeof entry !== "object") return false;
  const o = entry as Record<string, unknown>;
  return typeof o.playUrl === "string" && typeof o.year === "string" && o.manifest !== null && typeof o.manifest === "object";
}

export function isRemoteGameOverrideEntry(entry: unknown): entry is RemoteGameOverrideEntry {
  if (entry === null || typeof entry !== "object") return false;
  const o = entry as Record<string, unknown>;
  return typeof o.playUrl === "string" && typeof o.year === "string" && o.manifestOverrides !== null && typeof o.manifestOverrides === "object";
}

export function isRemoteGameEntry(entry: unknown): entry is RemoteGameEntry {
  if (entry === null || typeof entry !== "object") return false;
  const o = entry as Record<string, unknown>;
  return typeof o.playUrl === "string" && typeof o.year === "string" && !("manifest" in o) && !("manifestOverrides" in o);
}

export function parseYearSortKey(yearLabel: string): number {
  const normalized = yearLabel.trim();
  if (!normalized) return 999;
  if (/preschool|kindergarten|early stage/i.test(normalized)) return 0;
  const rangeMatch = normalized.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);
  const singleMatch = normalized.match(/(\d+)/);
  if (singleMatch) return parseInt(singleMatch[1], 10);
  return 999;
}

function normalizeTeachingLevel(level: unknown): TeachingLevel | null {
  if (level === null || typeof level !== "object") return null;
  const item = level as {
    label?: unknown;
    stageLabel?: unknown;
    syllabusCode?: unknown;
    syllabusUrl?: unknown;
    syllabusDescription?: unknown;
  };
  const label = typeof item.label === "string" ? item.label.trim() : "";
  if (!label) return null;
  const stageLabel = typeof item.stageLabel === "string" ? item.stageLabel.trim() : "";
  const syllabusCode = typeof item.syllabusCode === "string" ? item.syllabusCode.trim() : "";
  const syllabusUrl = typeof item.syllabusUrl === "string" ? item.syllabusUrl.trim() : "";
  const syllabusDescription =
    typeof item.syllabusDescription === "string" ? item.syllabusDescription.trim() : "";
  return {
    label,
    stageLabel: stageLabel || undefined,
    syllabusCode: syllabusCode || undefined,
    syllabusUrl: syllabusUrl || undefined,
    syllabusDescription: syllabusDescription || undefined,
  };
}

function normalizeGameLevelIcon(icon: unknown): GameLevelIcon | null {
  if (icon === null || typeof icon !== "object") return null;
  const item = icon as {
    level?: unknown;
    src?: unknown;
    sizes?: unknown;
    type?: unknown;
  };
  const level = typeof item.level === "number" ? item.level : Number(item.level);
  const src = typeof item.src === "string" ? item.src.trim() : "";
  if (!Number.isFinite(level) || level <= 0 || !src) return null;
  const sizes = typeof item.sizes === "string" ? item.sizes.trim() : "";
  const type = typeof item.type === "string" ? item.type.trim() : "";
  return {
    level,
    src,
    sizes: sizes || undefined,
    type: type || undefined,
  };
}

export function normalizeGame(
  raw: GameManifest & {
    url: string;
    imageUrl?: string;
    screenshots?: string[];
    thirdParty?: boolean;
    openInNewTab?: boolean;
    yearLabel?: string;
    yearSortKey?: number;
  },
): Game {
  const id = raw.id?.trim() || slugFromUrl(raw.url);
  const name = raw.name?.trim() || "Game";
  const description = raw.description?.trim() || "";
  const buildMatch = description.match(/^Build:\s*(.+)$/m);
  const buildStamp = buildMatch?.[1]?.trim();
  const cleanedDescription = description
    .replace(/^Build:\s*.+\n*/m, "")
    .trim();
  return {
    id,
    name,
    url: raw.url.trim(),
    screenshots: Array.isArray(raw.screenshots) ? raw.screenshots.map(String).filter(Boolean) : [],
    videoUrl: typeof raw.videoUrl === "string" ? raw.videoUrl.trim() || undefined : undefined,
    buildStamp,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    subjects: Array.isArray(raw.subjects) ? raw.subjects.map(String) : ["maths"],
    skills: Array.isArray(raw.skills) ? raw.skills.map(String) : [],
    githubUrl: typeof raw.githubUrl === "string" ? raw.githubUrl.trim() || undefined : undefined,
    description: cleanedDescription,
    teachesLevels: Array.isArray(raw.teachesLevels) ? raw.teachesLevels.flatMap((level) => {
      const normalizedLevel = normalizeTeachingLevel(level);
      return normalizedLevel ? [normalizedLevel] : [];
    }) : [],
    levelIcons: Array.isArray(raw["level-icons"])
      ? raw["level-icons"].flatMap((icon) => {
          const normalizedIcon = normalizeGameLevelIcon(icon);
          return normalizedIcon ? [normalizedIcon] : [];
        })
      : [],
    imageUrl: raw.imageUrl,
    thirdParty: Boolean(raw.thirdParty),
    openInNewTab: Boolean(raw.openInNewTab),
    yearLabel: raw.yearLabel?.trim() || "",
    yearSortKey: raw.yearSortKey ?? 999,
  };
}

function resolveAssetUrls(paths: string[] | undefined, gameUrl: string): string[] {
  if (!Array.isArray(paths)) return [];
  const assetBase = manifestBase(gameUrl);
  return paths
    .map((path) => String(path).trim())
    .filter(Boolean)
    .map((path) => {
      if (/^https?:\/\//.test(path)) return path;
      return `${assetBase}${path.replace(/^\//, "")}`;
    });
}

function resolveAssetUrl(path: string | undefined, gameUrl: string): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return `${manifestBase(gameUrl)}${trimmed.replace(/^\//, "")}`;
}

function getEntryThirdParty(entry: GameListEntry): boolean {
  if (isInlineGameEntry(entry)) return true;
  if (isRemoteGameOverrideEntry(entry)) return Boolean(entry.manifestOverrides.thirdParty);
  return false;
}

export function createGameSlot(entry: GameListEntry, index: number): GameSlot {
  const playUrl = entry.playUrl.trim();
  const yearLabel = entry.year.trim();
  const launchLevelRaw = toUrl(playUrl)?.searchParams.get("level");
  const launchLevel = launchLevelRaw ? Number(launchLevelRaw) : undefined;
  return {
    slotId: `${index}:${playUrl}`,
    playUrl,
    launchLevel:
      launchLevel && Number.isFinite(launchLevel) && launchLevel > 0
        ? launchLevel
        : undefined,
    yearLabel,
    yearSortKey: parseYearSortKey(yearLabel),
    teachesLevels: [],
    thirdParty: getEntryThirdParty(entry),
    openInNewTab: Boolean(entry.openInNewTab),
    game: null,
  };
}

export function createGameSlots(entry: GameListEntry, index: number): GameSlot[] {
  return [createGameSlot(entry, index)];
}

export function compareGameSlots(
  a: Pick<GameSlot, "thirdParty" | "yearSortKey" | "slotId">,
  b: Pick<GameSlot, "thirdParty" | "yearSortKey" | "slotId">,
): number {
  if (a.thirdParty !== b.thirdParty) return a.thirdParty ? 1 : -1;
  if (a.yearSortKey !== b.yearSortKey) return a.yearSortKey - b.yearSortKey;
  return a.slotId.localeCompare(b.slotId);
}

export async function resolveGameEntry(entry: GameListEntry): Promise<Game | null> {
  if (isInlineGameEntry(entry)) {
    const playUrl = entry.playUrl.trim();
    const imageUrl = entry.imageUrl?.trim();
    return normalizeGame({
      ...entry.manifest,
      url: playUrl,
      imageUrl: imageUrl || undefined,
      screenshots: resolveAssetUrls(entry.manifest.screenshots, playUrl),
      thirdParty: true,
      openInNewTab: Boolean(entry.openInNewTab),
      yearLabel: entry.year,
      yearSortKey: parseYearSortKey(entry.year),
    });
  }

  if (isRemoteGameOverrideEntry(entry)) {
    try {
      const m = await fetchJsonNoCache<GameManifest>(manifestBase(entry.playUrl) + "manifest.json");
      return normalizeGame({
        ...m,
        ...entry.manifestOverrides,
        url: entry.playUrl,
        imageUrl: entry.imageUrl?.trim() || undefined,
        screenshots: resolveAssetUrls(entry.manifestOverrides.screenshots ?? m.screenshots, entry.playUrl),
        thirdParty: Boolean(entry.manifestOverrides.thirdParty ?? m.thirdParty),
        openInNewTab: Boolean(entry.openInNewTab),
        yearLabel: entry.year,
        yearSortKey: parseYearSortKey(entry.year),
      });
    } catch {
      return null;
    }
  }

  if (isRemoteGameEntry(entry)) {
    try {
      const m = await fetchJsonNoCache<GameManifest>(manifestBase(entry.playUrl) + "manifest.json");
      return normalizeGame({
        ...m,
        url: entry.playUrl,
        imageUrl: entry.imageUrl?.trim() || undefined,
        screenshots: resolveAssetUrls(m.screenshots, entry.playUrl),
        thirdParty: Boolean(m.thirdParty),
        openInNewTab: Boolean(entry.openInNewTab),
        yearLabel: entry.year,
        yearSortKey: parseYearSortKey(entry.year),
      });
    } catch {
      return null;
    }
  }

  return null;
}

export async function loadGamesListProgressively(
  entries: GameListEntry[],
  onGame: (game: Game, index: number) => void,
): Promise<void> {
  await Promise.allSettled(
    entries.map(async (entry, index) => {
      const game = await resolveGameEntry(entry);
      if (game) onGame(game, index);
    }),
  );
}

/** Ordered fallbacks for <img src> (first-party games only; partners use PartnerGameGlyph) */
export function getGameIconCandidates(game: Game): string[] {
  const list: string[] = [];
  const assetBase = manifestBase(game.url);
  if (game.imageUrl) list.push(game.imageUrl);
  list.push(`${assetBase}favicon.svg`);
  list.push(`${assetBase}favicon.ico`);
  return [...new Set(list.filter(Boolean))];
}

export function getGameLevelIconUrl(game: Game, level: number): string | undefined {
  const match = game.levelIcons.find((icon) => icon.level === level);
  return resolveAssetUrl(match?.src, game.url);
}
