/**
 * games.json / games-local.json entries:
 * - string: fetch `${baseUrl}manifest.json` (first-party contract)
 * - object: inline manifest + playUrl (third-party or custom hosting)
 */

export interface GameManifest {
  id?: string;
  name?: string;
  icon?: string;
  screenshots?: string[];
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

export interface InlineGameEntry {
  playUrl: string;
  manifest: GameManifest;
  /** Card / drawer image; defaults to favicon discovery for host */
  imageUrl?: string;
  /** Skip iframe; open playUrl in a new tab */
  openInNewTab?: boolean;
}

export interface RemoteGameOverrideEntry {
  playUrl: string;
  manifestOverrides: GameManifest;
  /** Card / drawer image; defaults to favicon discovery for host */
  imageUrl?: string;
  /** Skip iframe; open playUrl in a new tab */
  openInNewTab?: boolean;
}

export type GameListEntry = string | InlineGameEntry | RemoteGameOverrideEntry;

export interface Game {
  id: string;
  name: string;
  url: string;
  screenshots: string[];
  buildStamp?: string;
  tags: string[];
  subjects: string[];
  skills: string[];
  githubUrl?: string;
  description: string;
  teachesLevels: TeachingLevel[];
  /** Card + drawer art (first-party: omit → favicon.svg on game origin) */
  imageUrl?: string;
  thirdParty: boolean;
  openInNewTab: boolean;
}

async function fetchJsonNoCache<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export const base = (url: string) => url.replace(/\/?$/, "/");

export function hostFromPlayUrl(playUrl: string): string | null {
  try {
    const u = playUrl.startsWith("http") ? playUrl : `https://${playUrl}`;
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

function slugFromUrl(url: string): string {
  const host = hostFromPlayUrl(url);
  if (host) return host.replace(/^www\./, "").replace(/\./g, "-");
  return "game";
}

export function isInlineGameEntry(entry: unknown): entry is InlineGameEntry {
  if (entry === null || typeof entry !== "object") return false;
  const o = entry as Record<string, unknown>;
  return typeof o.playUrl === "string" && o.manifest !== null && typeof o.manifest === "object";
}

export function isRemoteGameOverrideEntry(entry: unknown): entry is RemoteGameOverrideEntry {
  if (entry === null || typeof entry !== "object") return false;
  const o = entry as Record<string, unknown>;
  return typeof o.playUrl === "string" && o.manifestOverrides !== null && typeof o.manifestOverrides === "object";
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

export function normalizeGame(
  raw: GameManifest & {
    url: string;
    imageUrl?: string;
    screenshots?: string[];
    thirdParty?: boolean;
    openInNewTab?: boolean;
  }
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
    imageUrl: raw.imageUrl,
    thirdParty: Boolean(raw.thirdParty),
    openInNewTab: Boolean(raw.openInNewTab),
  };
}

function resolveAssetUrls(paths: string[] | undefined, gameUrl: string): string[] {
  if (!Array.isArray(paths)) return [];
  return paths
    .map((path) => String(path).trim())
    .filter(Boolean)
    .map((path) => {
      if (/^https?:\/\//.test(path)) return path;
      return `${base(gameUrl)}${path.replace(/^\//, "")}`;
    });
}

export async function resolveGameEntry(entry: GameListEntry): Promise<Game | null> {
  if (typeof entry === "string") {
    try {
      const m = await fetchJsonNoCache<GameManifest>(base(entry) + "manifest.json");
      return normalizeGame({
        ...m,
        url: entry,
        screenshots: resolveAssetUrls(m.screenshots, entry),
        thirdParty: Boolean(m.thirdParty),
        openInNewTab: false,
      });
    } catch {
      return null;
    }
  }

  if (isRemoteGameOverrideEntry(entry)) {
    try {
      const m = await fetchJsonNoCache<GameManifest>(base(entry.playUrl) + "manifest.json");
      return normalizeGame({
        ...m,
        ...entry.manifestOverrides,
        url: entry.playUrl,
        imageUrl: entry.imageUrl?.trim() || undefined,
        screenshots: resolveAssetUrls(entry.manifestOverrides.screenshots ?? m.screenshots, entry.playUrl),
        thirdParty: Boolean(entry.manifestOverrides.thirdParty ?? m.thirdParty),
        openInNewTab: Boolean(entry.openInNewTab),
      });
    } catch {
      return null;
    }
  }

  const playUrl = entry.playUrl.trim();
  const imageUrl = entry.imageUrl?.trim();
  return normalizeGame({
    ...entry.manifest,
    url: playUrl,
    imageUrl: imageUrl || undefined,
    screenshots: resolveAssetUrls(entry.manifest.screenshots, playUrl),
    thirdParty: true,
    openInNewTab: Boolean(entry.openInNewTab),
  });
}

export async function loadGamesList(entries: GameListEntry[]): Promise<Game[]> {
  const results = await Promise.all(entries.map((e) => resolveGameEntry(e)));
  return results.filter((g): g is Game => g !== null);
}

export async function loadGamesListProgressively(
  entries: GameListEntry[],
  onGame: (game: Game) => void,
): Promise<void> {
  await Promise.allSettled(
    entries.map(async (entry) => {
      const game = await resolveGameEntry(entry);
      if (game) onGame(game);
    }),
  );
}

/** Ordered fallbacks for <img src> (first-party games only; partners use PartnerGameGlyph) */
export function getGameIconCandidates(game: Game): string[] {
  const list: string[] = [];
  if (game.imageUrl) list.push(game.imageUrl);
  list.push(`${base(game.url)}favicon.svg`);
  list.push(`${base(game.url)}favicon.ico`);
  return [...new Set(list.filter(Boolean))];
}
