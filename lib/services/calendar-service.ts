import { HOOK_PATTERNS } from "@/lib/domain/hook-patterns";
import { generateCaptions } from "@/lib/services/captions";
import type {
  ContentPlanEntry,
  Hook,
  Niche,
  TrendItem,
} from "@/lib/domain/types";

/**
 * Autoalimentado del calendario de contenido.
 *
 * Regla de negocio: para un mes dado, el script coloca N publicaciones por
 * semana en los mejores huecos disponibles, y para cada hueco elige un hook de
 * la biblioteca (priorizando los de mayor rendimiento y los favoritos) y lo
 * cruza con un ángulo de contenido. El resultado se puede programar en Zernio
 * con un clic desde la propia página.
 */

/** Mejores huecos según el histórico de engagement (UTC). */
export const OPTIMAL_SLOTS: Array<{ day: number; hour: number; weight: number }> = [
  { day: 2, hour: 12, weight: 1.0 }, // martes
  { day: 3, hour: 18, weight: 1.18 }, // miércoles
  { day: 4, hour: 12, weight: 1.05 }, // jueves
  { day: 1, hour: 18, weight: 0.92 }, // lunes
  { day: 0, hour: 11, weight: 0.78 }, // domingo
  { day: 5, hour: 10, weight: 0.72 }, // viernes
  { day: 6, hour: 11, weight: 0.7 }, // sábado
];

/** Ángulos de contenido: se rotan para no repetir enfoque en la misma semana. */
export const CONTENT_ANGLES = [
  "Tutorial paso a paso",
  "Error común y cómo evitarlo",
  "Antes y después con números",
  "Herramienta que uso a diario",
  "Opinión contraria al consenso",
  "Caso real de un cliente o proyecto",
  "Detrás de cámaras del proceso",
  "Comparativa de dos opciones",
  "Pregunta frecuente de la audiencia",
  "Predicción sobre lo que viene",
  "Checklist accionable",
  "Historia personal con aprendizaje",
] as const;

export interface AutoFillOptions {
  /** Primer día del mes a rellenar, en formato `YYYY-MM`. */
  month: string;
  /** Posts por semana (1-7). */
  perWeek?: number;
  platforms?: string[];
  niche?: Niche;
  hooks: Hook[];
  trends?: TrendItem[];
  /** Hora local preferida; si se omite se usan los huecos óptimos. */
  preferredHour?: number;
}

export interface AutoFillResult {
  entries: ContentPlanEntry[];
  summary: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function selectSlot(
  perWeek: number,
  preferredHour?: number,
): Array<{ day: number; hour: number }> {
  const slots = preferredHour !== undefined
    ? OPTIMAL_SLOTS.map((s) => ({ ...s, hour: preferredHour }))
    : [...OPTIMAL_SLOTS];

  const ordered = slots.sort((a, b) => b.weight - a.weight).slice(0, Math.min(perWeek, 7));
  return ordered.map(({ day, hour }) => ({ day, hour }));
}

/**
 * Distribuye contenido a lo largo de un mes.
 *
 * Prioriza hooks así: favoritos primero, luego los de mayor multiplicador de
 * rendimiento (views / media de la biblioteca), y finalmente el resto. Los
 * patrones se rotan para no repetir la misma plantilla dos veces seguidas.
 */
export async function autoFillMonth(
  options: AutoFillOptions,
): Promise<AutoFillResult> {
  const {
    month,
    perWeek = 3,
    platforms = ["instagram"],
    hooks,
    trends = [],
    preferredHour,
  } = options;

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const totalDays = daysInMonth(year, monthIndex);

  if (hooks.length === 0) {
    return {
      entries: [],
      summary: "No hay hooks en la biblioteca todavía: guarda alguno antes de rellenar el mes.",
    };
  }

  const averageViews =
    hooks.reduce((acc, h) => acc + h.views, 0) / Math.max(hooks.length, 1);

  const ranked = [...hooks].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.views - a.views;
  });

  const slots = selectSlot(perWeek, preferredHour);
  const entries: ContentPlanEntry[] = [];

  let hookIndex = 0;
  let angleIndex = 0;
  let slotIndex = 0;
  let lastPatternId = "";

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    const weekday = date.getUTCDay();
    const slot = slots.find((s) => s.day === weekday);
    if (!slot) continue;

    // Evita repetir la misma plantilla en publicaciones consecutivas.
    let hook = ranked[hookIndex % ranked.length];
    if (hook.patternId === lastPatternId && ranked.length > 1) {
      hookIndex++;
      hook = ranked[hookIndex % ranked.length];
    }
    lastPatternId = hook.patternId;

    const angle = CONTENT_ANGLES[angleIndex % CONTENT_ANGLES.length];
    const platform = platforms[slotIndex % platforms.length];

    const relatedTrend = trends.find((t) => t.hookScore >= 85);

    const captionResponse = await generateCaptions({
      hook: hook.filledText || hook.rawText,
      angle: relatedTrend && entries.length % 4 === 0
        ? `${angle}. Gancho de actualidad: ${relatedTrend.title}`
        : angle,
      niche: options.niche ?? hook.niche,
      platforms: [platform],
    });

    const variant = captionResponse.variants[0];

    entries.push({
      id: `plan_${month}_${pad(day)}_${platform}`,
      date: `${year}-${pad(monthIndex + 1)}-${pad(day)}`,
      time: `${pad(slot.hour)}:00`,
      platform,
      hookId: hook.id,
      hookText: hook.filledText || hook.rawText,
      angle,
      caption: `${variant.caption}\n\n${variant.hashtags.map((h) => `#${h}`).join(" ")}`,
      status: "idea",
      createdAt: new Date().toISOString(),
    });

    hookIndex++;
    angleIndex++;
    slotIndex++;
  }

  const summary = [
    `${entries.length} publicaciones planificadas para ${month}`,
    `${perWeek}/semana en los mejores huecos`,
    `${new Set(entries.map((e) => e.platform)).size} plataformas`,
    `base: ${Math.round(averageViews).toLocaleString("es-ES")} views/hook`,
  ].join(" · ");

  return { entries, summary };
}

/** Hueco óptimo siguiente a partir de una fecha dada. */
export function nextOptimalSlot(
  from: Date,
  preferredHour: number,
): { date: string; time: string } {
  const best = [...OPTIMAL_SLOTS].sort((a, b) => b.weight - a.weight)[0];
  const cursor = new Date(from);
  for (let i = 0; i < 14; i++) {
    if (cursor.getUTCDay() === best.day) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return {
    date: cursor.toISOString().slice(0, 10),
    time: `${pad(preferredHour)}:00`,
  };
}

/** Resumen por plantilla para saber qué ángulos ya se usaron. */
export function patternUsageSummary(hooks: Hook[]) {
  return HOOK_PATTERNS.map((pattern) => {
    const used = hooks.filter((h) => h.patternId === pattern.id);
    return {
      pattern,
      count: used.length,
      bestViews: used.reduce((max, h) => Math.max(max, h.views), 0),
      averageViews: pattern.averageViews,
    };
  }).sort((a, b) => b.bestViews - a.bestViews);
}
