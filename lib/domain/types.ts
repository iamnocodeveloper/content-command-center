/**
 * Modelo de dominio del Content Command Center.
 *
 * Zernio es la fuente de verdad para cuentas, posts y analíticas. Todo lo que
 * Zernio no cubre (biblioteca de hooks, seguimiento de competidores, tendencias
 * y el plan de contenido) vive en este modelo propio, persistido por el
 * repositorio de `lib/domain/repository.ts`.
 */

export const NICHES = [
  "fitness",
  "negocios",
  "marketing",
  "ia_automatizacion",
  "finanzas",
  "desarrollo_personal",
  "tecnologia",
  "gastronomia",
  "viajes",
  "moda_belleza",
  "educacion",
  "inmobiliaria",
] as const;
export type Niche = (typeof NICHES)[number];

export const NICHE_LABELS: Record<Niche, string> = {
  fitness: "Fitness",
  negocios: "Negocios",
  marketing: "Marketing",
  ia_automatizacion: "IA y automatización",
  finanzas: "Finanzas",
  desarrollo_personal: "Desarrollo personal",
  tecnologia: "Tecnología",
  gastronomia: "Gastronomía",
  viajes: "Viajes",
  moda_belleza: "Moda y belleza",
  educacion: "Educación",
  inmobiliaria: "Inmobiliaria",
};

/** Familias de hook que el motor de plantillas reconoce. */
export const HOOK_TYPES = [
  "curiosity_gap",
  "contrarian",
  "listicle",
  "callout",
  "proof",
  "warning",
  "question",
  "story",
  "utility",
] as const;
export type HookType = (typeof HOOK_TYPES)[number];

export const HOOK_TYPE_LABELS: Record<HookType, string> = {
  curiosity_gap: "Brecha de curiosidad",
  contrarian: "Contrarian",
  listicle: "Lista",
  callout: "Callout",
  proof: "Prueba / resultado",
  warning: "Advertencia",
  question: "Pregunta",
  story: "Historia",
  utility: "Utilidad / plantilla",
};

/** Plantilla de hook reutilizable, con placeholders entre corchetes. */
export interface HookPattern {
  id: string;
  /** Nombre corto mostrado en la UI. */
  name: string;
  /** Estructura con marcadores: "[X] acaba de destruir [Y]". */
  template: string;
  type: HookType;
  /** Por qué funciona, en una frase. */
  rationale: string;
  /** Ejemplo ya rellenado. */
  example: string;
  /** Métricas históricas de la plantilla en la cuenta. */
  averageViews: number;
  usageCount: number;
}

/** Hook real guardado por el usuario, transcrito y normalizado a plantilla. */
export interface Hook {
  id: string;
  /** Texto original tal como se dijo o apareció en pantalla. */
  rawText: string;
  /** Versión normalizada a plantilla ("Deja de hacer [X]"). */
  templateText: string;
  /** Hook listo para usar, con los placeholders ya resueltos. */
  filledText: string;
  patternId: string;
  type: HookType;
  niche: Niche;
  views: number;
  likes: number;
  saves: number;
  /** Creador de origen. */
  creatorHandle: string;
  creatorPlatform: string;
  sourceUrl?: string;
  sourceReelId?: string;
  /** Texto que aparece en pantalla, si se pudo extraer. */
  onScreenText?: string;
  tags: string[];
  isFavorite: boolean;
  savedAt: string;
  /** `viral` si superó 3x la media de views del nicho. */
  tier: "standard" | "high" | "viral";
}

export interface CompetitorAccount {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  followerCount: number;
  niche: Niche;
  avatarUrl?: string;
  isActive: boolean;
  addedAt: string;
}

export interface CompetitorReel {
  id: string;
  accountId: string;
  platform: string;
  url: string;
  thumbnailUrl?: string;
  views: number;
  likes: number;
  comments: number;
  postedAt: string;
  /** Hook hablado, extraído de la transcripción de audio. */
  hookText: string;
  /** Texto renderizado en pantalla. */
  onScreenText: string;
  /** Transcripción completa del audio. */
  transcript: string;
  /** Posición dentro del top semanal (1 = más visto). */
  rank: number;
  /** Semana ISO de ingesta: `2026-W38`. */
  week: string;
  ingestedAt: string;
  savedToHooks: boolean;
}

export interface TrendSource {
  id: string;
  name: string;
  url: string;
  kind: "rss" | "api" | "scrape";
  category: "labs" | "research" | "media" | "community" | "newsletter";
}

export interface TrendItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  /** 0-100: potencial para convertirse en hook. */
  hookScore: number;
  /** Ángulo de contenido sugerido. */
  angle: string;
  /** Hook propuesto, ya en formato de plantilla. */
  hookSuggestion: string;
  patternId?: string;
  category: string;
}

/** Entrada del plan de contenido que autoalimenta el calendario. */
export interface ContentPlanEntry {
  id: string;
  /** `YYYY-MM-DD` en la timezone del perfil. */
  date: string;
  /** `HH:mm` local. */
  time: string;
  platform: string;
  hookId?: string;
  /** Texto del hook congelado en el momento de planificar. */
  hookText: string;
  angle: string;
  caption: string;
  status: "idea" | "script" | "scheduled" | "published";
  /** Id del post en Zernio cuando ya se programó. */
  zernioPostId?: string;
  createdAt: string;
}

/** Borrador activo del compositor de guiones (/script). */
export interface ScriptDraft {
  hookId?: string;
  hookText: string;
  body: string;
  caption: string;
  angle: string;
  niche: Niche;
  platform: string;
  updatedAt: string;
}
