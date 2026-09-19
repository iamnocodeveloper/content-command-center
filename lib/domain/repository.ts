import { buildHook } from "@/lib/domain/hook-engine";
import { createSeedCompetitors, SEED_REELS } from "@/lib/domain/seed/competitors";
import { SEED_HOOKS } from "@/lib/domain/seed/hooks";
import { SEED_TRENDS, TREND_SOURCES } from "@/lib/domain/seed/trends";
import type {
  CompetitorAccount,
  CompetitorReel,
  ContentPlanEntry,
  Hook,
  Niche,
  TrendItem,
} from "@/lib/domain/types";

/**
 * Repositorio de datos propios del dashboard.
 *
 * Implementación por defecto: store en memoria, colgado de `globalThis` para
 * sobrevivir al hot-reload de Next en desarrollo y para compartir estado entre
 * route handlers del mismo proceso.
 *
 * Para producción se sustituye por una base de datos real implementando esta
 * misma interfaz (ver docs/03-bases-de-datos.md). Toda la API es asíncrona a
 * propósito, para que el cambio a Postgres/InsForge no toque a los llamadores.
 */

interface Store {
  hooks: Hook[];
  competitors: CompetitorAccount[];
  reels: CompetitorReel[];
  trends: TrendItem[];
  plan: ContentPlanEntry[];
  seededAt: string;
}

const GLOBAL_KEY = "__ccc_store__";

function createInitialStore(): Store {
  return {
    hooks: SEED_HOOKS.map((h) => ({ ...h })),
    competitors: createSeedCompetitors().map((c) => ({ ...c })),
    reels: SEED_REELS.map((r) => ({ ...r })),
    trends: SEED_TRENDS.map((t) => ({ ...t })),
    plan: [],
    seededAt: new Date().toISOString(),
  };
}

function getStore(): Store {
  const globalRef = globalThis as unknown as Record<string, Store | undefined>;
  if (!globalRef[GLOBAL_KEY]) {
    globalRef[GLOBAL_KEY] = createInitialStore();
  }
  return globalRef[GLOBAL_KEY]!;
}

/** Restaura el store a los datos semilla. Usado por los tests y la demo. */
export function resetStore(): void {
  const globalRef = globalThis as unknown as Record<string, Store | undefined>;
  globalRef[GLOBAL_KEY] = createInitialStore();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface HookQuery {
  search?: string;
  niche?: Niche | "all";
  type?: string;
  patternId?: string;
  minViews?: number;
  maxViews?: number;
  favoritesOnly?: boolean;
  sortBy?: "views" | "savedAt" | "saves" | "engagement";
  order?: "asc" | "desc";
}

export async function listHooks(query: HookQuery = {}): Promise<Hook[]> {
  const store = getStore();
  const {
    search,
    niche = "all",
    type = "all",
    patternId,
    minViews = 0,
    maxViews = Number.MAX_SAFE_INTEGER,
    favoritesOnly = false,
    sortBy = "views",
    order = "desc",
  } = query;

  const term = search?.trim().toLowerCase();

  const filtered = store.hooks.filter((hook) => {
    if (niche !== "all" && hook.niche !== niche) return false;
    if (type !== "all" && hook.type !== type) return false;
    if (patternId && hook.patternId !== patternId) return false;
    if (hook.views < minViews || hook.views > maxViews) return false;
    if (favoritesOnly && !hook.isFavorite) return false;
    if (term) {
      const haystack = [
        hook.rawText,
        hook.templateText,
        hook.filledText,
        hook.creatorHandle,
        hook.onScreenText ?? "",
        hook.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const direction = order === "asc" ? 1 : -1;
  const compare = (a: Hook, b: Hook): number => {
    switch (sortBy) {
      case "savedAt":
        return direction * a.savedAt.localeCompare(b.savedAt);
      case "saves":
        return direction * (a.saves - b.saves);
      case "engagement": {
        const rateA = a.views > 0 ? (a.likes + a.saves) / a.views : 0;
        const rateB = b.views > 0 ? (b.likes + b.saves) / b.views : 0;
        return direction * (rateA - rateB);
      }
      case "views":
      default:
        return direction * (a.views - b.views);
    }
  };

  return filtered.sort(compare);
}

export async function getHook(id: string): Promise<Hook | undefined> {
  return getStore().hooks.find((h) => h.id === id);
}

export async function createHook(input: {
  rawText: string;
  onScreenText?: string;
  views?: number;
  likes?: number;
  saves?: number;
  creatorHandle: string;
  creatorPlatform: string;
  sourceUrl?: string;
  sourceReelId?: string;
  niche?: Niche;
  patternId?: string;
  tags?: string[];
}): Promise<Hook> {
  const store = getStore();
  const hook = buildHook({
    rawText: input.rawText,
    onScreenText: input.onScreenText,
    views: input.views ?? 0,
    likes: input.likes,
    saves: input.saves,
    creatorHandle: input.creatorHandle,
    creatorPlatform: input.creatorPlatform,
    sourceUrl: input.sourceUrl,
    sourceReelId: input.sourceReelId,
    nicheOverride: input.niche,
    patternIdOverride: input.patternId,
    tags: input.tags,
  });

  if (store.hooks.some((h) => h.id === hook.id)) {
    return store.hooks.find((h) => h.id === hook.id)!;
  }

  store.hooks.unshift(hook);
  return hook;
}

export async function updateHook(
  id: string,
  patch: Partial<Pick<Hook, "isFavorite" | "niche" | "tags" | "patternId">>,
): Promise<Hook | undefined> {
  const store = getStore();
  const index = store.hooks.findIndex((h) => h.id === id);
  if (index === -1) return undefined;
  store.hooks[index] = { ...store.hooks[index], ...patch };
  return store.hooks[index];
}

export async function deleteHook(id: string): Promise<boolean> {
  const store = getStore();
  const before = store.hooks.length;
  store.hooks = store.hooks.filter((h) => h.id !== id);
  return store.hooks.length < before;
}

// ---------------------------------------------------------------------------
// Competidores
// ---------------------------------------------------------------------------

export async function listCompetitors(): Promise<CompetitorAccount[]> {
  return getStore().competitors.slice();
}

export async function addCompetitor(input: {
  username: string;
  platform: string;
  displayName?: string;
  followerCount?: number;
  niche?: Niche;
}): Promise<CompetitorAccount> {
  const store = getStore();
  const existing = store.competitors.find(
    (c) =>
      c.username.toLowerCase() === input.username.toLowerCase() &&
      c.platform === input.platform,
  );
  if (existing) return existing;

  const competitor: CompetitorAccount = {
    id: `cmp_${Date.now().toString(36)}`,
    platform: input.platform,
    username: input.username.startsWith("@")
      ? input.username
      : `@${input.username}`,
    displayName: input.displayName ?? input.username.replace(/^@/, ""),
    followerCount: input.followerCount ?? 0,
    niche: input.niche ?? "marketing",
    isActive: true,
    addedAt: new Date().toISOString(),
  };

  store.competitors.push(competitor);
  return competitor;
}

export async function removeCompetitor(id: string): Promise<boolean> {
  const store = getStore();
  const before = store.competitors.length;
  store.competitors = store.competitors.filter((c) => c.id !== id);
  store.reels = store.reels.filter((r) => r.accountId !== id);
  return store.competitors.length < before;
}

export interface ReelQuery {
  accountId?: string;
  week?: string;
  platform?: string;
  minViews?: number;
  search?: string;
  sortBy?: "views" | "likes" | "comments" | "postedAt";
  order?: "asc" | "desc";
  limit?: number;
}

export interface CompetitorReelWithAccount extends CompetitorReel {
  account?: CompetitorAccount;
}

export async function listReels(
  query: ReelQuery = {},
): Promise<CompetitorReelWithAccount[]> {
  const store = getStore();
  const byId = new Map(store.competitors.map((c) => [c.id, c]));
  const term = query.search?.trim().toLowerCase();

  const filtered = store.reels.filter((reel) => {
    if (query.accountId && reel.accountId !== query.accountId) return false;
    if (query.week && reel.week !== query.week) return false;
    if (query.platform && reel.platform !== query.platform) return false;
    if (query.minViews && reel.views < query.minViews) return false;
    if (term) {
      const haystack = `${reel.hookText} ${reel.onScreenText} ${reel.transcript} ${byId.get(reel.accountId)?.username ?? ""}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const sortBy = query.sortBy ?? "views";
  const direction = query.order === "asc" ? 1 : -1;
  const sorted = filtered
    .map((reel) => ({ ...reel, account: byId.get(reel.accountId) }))
    .sort((a, b) => {
      if (sortBy === "postedAt") return direction * a.postedAt.localeCompare(b.postedAt);
      return direction * ((a[sortBy] as number) - (b[sortBy] as number));
    });

  return query.limit ? sorted.slice(0, query.limit) : sorted;
}

export async function listWeeks(): Promise<string[]> {
  const weeks = new Set(getStore().reels.map((r) => r.week));
  return [...weeks].sort().reverse();
}

export async function markReelSavedToHooks(reelId: string): Promise<void> {
  const store = getStore();
  const reel = store.reels.find((r) => r.id === reelId);
  if (reel) reel.savedToHooks = true;
}

/** Guarda un reel de competidor en la biblioteca de hooks. */
export async function saveReelToHooks(reelId: string): Promise<Hook | undefined> {
  const store = getStore();
  const reel = store.reels.find((r) => r.id === reelId);
  if (!reel) return undefined;
  const account = store.competitors.find((c) => c.id === reel.accountId);

  const hook = await createHook({
    rawText: reel.hookText,
    onScreenText: reel.onScreenText,
    views: reel.views,
    likes: reel.likes,
    creatorHandle: account?.username ?? "@desconocido",
    creatorPlatform: reel.platform,
    sourceUrl: reel.url,
    sourceReelId: reel.id,
    niche: account?.niche,
  });

  reel.savedToHooks = true;
  return hook;
}

// ---------------------------------------------------------------------------
// Tendencias
// ---------------------------------------------------------------------------

export interface TrendQuery {
  sourceId?: string;
  category?: string;
  minScore?: number;
  search?: string;
  sortBy?: "hookScore" | "publishedAt";
  limit?: number;
}

export async function listTrends(query: TrendQuery = {}): Promise<TrendItem[]> {
  const store = getStore();
  const term = query.search?.trim().toLowerCase();

  const filtered = store.trends.filter((item) => {
    if (query.sourceId && item.sourceId !== query.sourceId) return false;
    if (query.category && item.category !== query.category) return false;
    if (query.minScore !== undefined && item.hookScore < query.minScore) return false;
    if (term) {
      const haystack = `${item.title} ${item.summary} ${item.angle} ${item.hookSuggestion} ${item.sourceName}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const sorted = filtered.sort((a, b) =>
    query.sortBy === "publishedAt"
      ? b.publishedAt.localeCompare(a.publishedAt)
      : b.hookScore - a.hookScore,
  );

  return query.limit ? sorted.slice(0, query.limit) : sorted;
}

export async function getTrendSources() {
  return TREND_SOURCES;
}

export async function replaceTrends(items: TrendItem[]): Promise<void> {
  getStore().trends = items.sort((a, b) => b.hookScore - a.hookScore);
}

// ---------------------------------------------------------------------------
// Plan de contenido (calendario)
// ---------------------------------------------------------------------------

export async function listPlanEntries(): Promise<ContentPlanEntry[]> {
  return getStore().plan.slice().sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
  );
}

export async function upsertPlanEntry(
  entry: ContentPlanEntry,
): Promise<ContentPlanEntry> {
  const store = getStore();
  const index = store.plan.findIndex((e) => e.id === entry.id);
  if (index === -1) store.plan.push(entry);
  else store.plan[index] = entry;
  return entry;
}

export async function removePlanEntry(id: string): Promise<boolean> {
  const store = getStore();
  const before = store.plan.length;
  store.plan = store.plan.filter((e) => e.id !== id);
  return store.plan.length < before;
}

export async function setPlanEntryZernioId(
  id: string,
  zernioPostId: string,
): Promise<void> {
  const entry = getStore().plan.find((e) => e.id === id);
  if (entry) {
    entry.zernioPostId = zernioPostId;
    entry.status = "scheduled";
  }
}
