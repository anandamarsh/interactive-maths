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
  /** Set true in remote manifest to mark partner games */
  thirdParty?: boolean;
}

export interface InlineGameEntry {
  playUrl: string;
  manifest: GameManifest;
  /** Card / drawer image; defaults to favicon discovery for host */
  imageUrl?: string;
  /** Skip iframe; open playUrl in a new tab */
  openInNewTab?: boolean;
}

export type GameListEntry = string | InlineGameEntry;

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
  /** Card + drawer art (first-party: omit → favicon.svg on game origin) */
  imageUrl?: string;
  thirdParty: boolean;
  openInNewTab: boolean;
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
      const r = await fetch(base(entry) + "manifest.json");
      if (!r.ok) return null;
      const m = (await r.json()) as GameManifest;
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

/** Ordered fallbacks for <img src> (first-party games only; partners use PartnerGameGlyph) */
export function getGameIconCandidates(game: Game): string[] {
  const list: string[] = [];
  if (game.imageUrl) list.push(game.imageUrl);
  list.push(`${base(game.url)}favicon.svg`);
  list.push(`${base(game.url)}favicon.ico`);
  return [...new Set(list.filter(Boolean))];
}
