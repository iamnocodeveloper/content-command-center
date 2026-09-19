import {
  HOOK_PATTERNS,
  PATTERN_BY_ID,
} from "@/lib/domain/hook-patterns";
import {
  HOOK_TYPES,
  type Hook,
  type HookType,
  type Niche,
} from "@/lib/domain/types";

/**
 * Motor de hooks: convierte texto libre (una transcripción, un caption, un hook
 * pegado a mano) en una plantilla normalizada del catálogo.
 *
 * Estrategia de clasificación (sin LLM, determinista y explicable):
 *  1. Coincidencia de palabras clave por tipo de hook.
 *  2. Coincidencia de estructura (número inicial -> listicle, "deja de" ->
 *     contrarian, etc.).
 *  3. Puntuación y desempate por la plantilla con más views históricas.
 */

interface TypeRule {
  type: HookType;
  /** Patrones que, si aparecen, suman 3 puntos. */
  strong: RegExp[];
  /** Patrones que suman 1 punto. */
  weak: RegExp[];
}

const TYPE_RULES: TypeRule[] = [
  {
    type: "callout",
    strong: [/\bacaba de\b/i, /\bacaban de\b/i, /\bacaba de destruir\b/i],
    weak: [/\bse acabó\b/i, /\bterminó\b/i, /\breemplaz\w+/i, /\bmuerto\b/i],
  },
  {
    type: "contrarian",
    strong: [/\bdeja de\b/i, /\bpara de\b/i, /\bno hagas\b/i],
    weak: [/\bnadie\b/i, /\bmentira\b/i, /\bverdad sobre\b/i, /\bno necesitas\b/i],
  },
  {
    type: "listicle",
    strong: [/^\s*\d+\s+(cosas|errores|formas|razones|pasos|trucos|tips|señales)/i],
    weak: [/\bcosas que\b/i, /\berrores\b/i, /\bformas de\b/i, /\brazones\b/i, /\bpasos\b/i],
  },
  {
    type: "proof",
    strong: [/\bc[oó]mo pas[eé] de\b/i, /\bc[oó]mo llegu[eé] a\b/i, /\bc[oó]mo logr[eé]\b/i],
    weak: [/\bc[oó]mo\b/i, /\ben \d+\s*(d[ií]as|semanas|meses|a[nñ]os)\b/i, /\bsin\b/i],
  },
  {
    type: "warning",
    strong: [/\bsi sigues\b/i, /\bpara ya\b/i, /\bten cuidado\b/i, /\bdesaparec\w+/i],
    weak: [/\bantes de que\b/i, /\burgen\w+/i, /\b[úu]ltima\b/i, /\briesgo\b/i],
  },
  {
    type: "question",
    strong: [/^\s*[¿?]/, /\?$/],
    weak: [/\bpor qu[eé]\b/i, /\bqu[eé] pasar[ií]a\b/i, /\bcu[aá]l\b/i],
  },
  {
    type: "story",
    strong: [/\bhace \w*\s*(d[ií]a|semana|mes|a[nñ]o)/i, /\bcuando yo\b/i],
    weak: [/\ber[aá]\b/i, /\bmi historia\b/i, /\bhoy\b/i],
  },
  {
    type: "utility",
    strong: [/\bla plantilla\b/i, /\bel m[eé]todo\b/i, /\bel sistema\b/i, /\bpaso a paso\b/i],
    weak: [/\bexacta?o?\b/i, /\bque uso\b/i, /\bdescarga\b/i, /\bscript\b/i],
  },
  {
    type: "curiosity_gap",
    strong: [/\b(el truco|el secreto)\b/i, /\bque usan\b/i, /\bnadie te cuenta\b/i],
    weak: [/\boculto\b/i, /\bpoco conocido\b/i, /\bincre[ií]ble\b/i],
  },
];

const NICHE_KEYWORDS: Record<Niche, RegExp[]> = {
  fitness: [/\bgym\b/i, /\brutina\b/i, /\bprote[ií]na\b/i, /\bentrenar\b/i, /\bm[úu]sculo\b/i],
  negocios: [/\bnegocio\b/i, /\bclientes?\b/i, /\bfactur\w+/i, /\bventas?\b/i, /\bagencia\b/i],
  marketing: [/\bmarketing\b/i, /\bfunnel\b/i, /\bembudo\b/i, /\bcopy\b/i, /\banuncio\w*/i],
  ia_automatizacion: [
    /\b(ia|ai)\b/i,
    /\bchat ?gpt\b/i,
    /\bautomatiz\w+/i,
    /\bprompt\w*/i,
    /\bn8n\b/i,
    /\bclaude\b/i,
  ],
  finanzas: [/\binvertir\b/i, /\bdinero\b/i, /\bingresos\b/i, /\bfinanzas\b/i, /\brentab\w+/i],
  desarrollo_personal: [
    /\bh[aá]bitos?\b/i,
    /\bdisciplina\b/i,
    /\bmentalidad\b/i,
    /\bproductivid\w+/i,
    /\bfoco\b/i,
  ],
  tecnologia: [/\bapp\b/i, /\bsoftware\b/i, /\bc[oó]digo\b/i, /\bdeveloper\b/i, /\bsaas\b/i],
  gastronomia: [/\breceta\b/i, /\bcocina\b/i, /\brestaurante\b/i, /\bchef\b/i, /\bsabor\b/i],
  viajes: [/\bviaje\w*/i, /\bdestino\w*/i, /\bvuelo\w*/i, /\bplaya\b/i, /\bmochil\w+/i],
  moda_belleza: [/\boutfit\b/i, /\bmaquillaje\b/i, /\bskincare\b/i, /\bestilo\b/i, /\bmoda\b/i],
  educacion: [/\bcurso\b/i, /\bestudiar\b/i, /\bexamen\b/i, /\baprender\b/i, /\bclase\b/i],
  inmobiliaria: [/\bpropiedad\b/i, /\brenta\b/i, /\bhipoteca\b/i, /\bdepartamento\b/i, /\bcasa\b/i],
};

export interface ClassificationResult {
  patternId: string;
  type: HookType;
  /** 0-1; por debajo de 0.3 se considera clasificación débil. */
  confidence: number;
  scores: Record<string, number>;
}

const PLACEHOLDER_HINT: Record<string, string> = {
  "[X]": "el tema o herramienta",
  "[Y]": "lo que reemplaza o el receptor",
  "[NÚMERO]": "una cifra concreta (3, 5, 7)",
  "[N]": "una cifra concreta",
  "[TIEMPO]": "un plazo concreto (30 días, 6 meses)",
  "[A]": "el estado inicial",
  "[B]": "el estado final",
  "[LOGRO]": "el resultado deseado",
  "[COSTO]": "lo que se evitó",
  "[GRUPO]": "un grupo con autoridad",
};

export function hintForPlaceholder(token: string): string {
  return PLACEHOLDER_HINT[token] ?? "un valor concreto";
}

/** Clasifica un texto libre contra el catálogo de plantillas. */
export function classifyHook(text: string): ClassificationResult {
  const scores: Record<string, number> = {};
  const normalized = text.trim();

  for (const pattern of HOOK_PATTERNS) {
    let score = 0;
    const rule = TYPE_RULES.find((r) => r.type === pattern.type);
    if (rule) {
      for (const re of rule.strong) if (re.test(normalized)) score += 3;
      for (const re of rule.weak) if (re.test(normalized)) score += 1;
    }
    // Bonus por estructura literal de la plantilla.
    score += structuralBonus(normalized, pattern.template);
    // Desempate histórico: las plantillas con mejor rendimiento pesan un poco más.
    score += pattern.averageViews / 1_000_000;
    if (score > 0) scores[pattern.id] = score;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    const fallback = HOOK_PATTERNS.reduce((best, p) =>
      p.averageViews > best.averageViews ? p : best,
    );
    return {
      patternId: fallback.id,
      type: fallback.type,
      confidence: 0.15,
      scores,
    };
  }

  const [patternId, topScore] = ranked[0];
  const total = ranked.reduce((sum, [, s]) => sum + s, 0);
  return {
    patternId,
    type: PATTERN_BY_ID.get(patternId)!.type,
    confidence: Math.min(1, (topScore / total) * Math.min(1, topScore / 4)),
    scores,
  };
}

function structuralBonus(text: string, template: string): number {
  const startsWithNumber = /^\s*[¿¡]?\s*\d+/.test(text);
  if (template.includes("[NÚMERO]") && startsWithNumber) return 4;
  if (template.startsWith("Deja de") && /^\s*deja de/i.test(text)) return 4;
  if (template.startsWith("Si sigues") && /^\s*si sigues/i.test(text)) return 4;
  if (template.includes("acaba de") && /acaba de/i.test(text)) return 4;
  if (template.includes("Cómo pasé de") && /c[oó]mo pas[eé] de/i.test(text)) return 4;
  return 0;
}

/** Deduce el nicho más probable a partir de palabras clave. */
export function detectNiche(text: string): {
  niche: Niche;
  confidence: number;
} {
  let best: Niche = "marketing";
  let bestHits = 0;
  let totalHits = 0;

  for (const [niche, regexes] of Object.entries(NICHE_KEYWORDS) as [
    Niche,
    RegExp[],
  ][]) {
    const hits = regexes.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0);
    totalHits += hits;
    if (hits > bestHits) {
      bestHits = hits;
      best = niche;
    }
  }

  return {
    niche: best,
    confidence: totalHits === 0 ? 0.2 : Math.min(1, bestHits / totalHits),
  };
}

/**
 * Rellena los marcadores de una plantilla con valores sugeridos.
 * Si no se aportan valores, se usan los del ejemplo de la plantilla.
 */
export function fillTemplate(
  patternId: string,
  values: Record<string, string> = {},
): { filled: string; missing: string[] } {
  const pattern = PATTERN_BY_ID.get(patternId);
  if (!pattern) return { filled: "", missing: [] };

  const missing: string[] = [];
  const filled = pattern.template.replace(/\[[^\]]+\]/g, (token) => {
    const value = values[token];
    if (value) return value;
    missing.push(token);
    return token;
  });

  return { filled, missing };
}

/** Convierte texto libre en un `Hook` completo y clasificado. */
export function buildHook(input: {
  rawText: string;
  views: number;
  likes?: number;
  saves?: number;
  creatorHandle: string;
  creatorPlatform: string;
  sourceUrl?: string;
  sourceReelId?: string;
  onScreenText?: string;
  nicheOverride?: Niche;
  patternIdOverride?: string;
  savedAt?: string;
  tags?: string[];
  isFavorite?: boolean;
}): Hook {
  const classification = input.patternIdOverride
    ? {
        patternId: input.patternIdOverride,
        type: PATTERN_BY_ID.get(input.patternIdOverride)?.type ?? "curiosity_gap",
        confidence: 1,
        scores: {},
      }
    : classifyHook(input.rawText);

  const niche =
    input.nicheOverride ?? detectNiche(
      [input.rawText, input.onScreenText, input.tags?.join(" ")]
        .filter(Boolean)
        .join(" "),
    ).niche;

  const tier: Hook["tier"] =
    input.views >= 500_000
      ? "viral"
      : input.views >= 150_000
        ? "high"
        : "standard";

  const values = extractValues(input.rawText);
  const { filled } = fillTemplate(classification.patternId, values);

  return {
    id: input.sourceReelId
      ? `hook_${input.sourceReelId}`
      : `hook_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    rawText: input.rawText,
    templateText: PATTERN_BY_ID.get(classification.patternId)?.template ?? "",
    filledText: filled || input.rawText,
    patternId: classification.patternId,
    type: classification.type,
    niche,
    views: input.views,
    likes: input.likes ?? Math.round(input.views * 0.07),
    saves: input.saves ?? Math.round(input.views * 0.02),
    creatorHandle: input.creatorHandle,
    creatorPlatform: input.creatorPlatform,
    sourceUrl: input.sourceUrl,
    sourceReelId: input.sourceReelId,
    onScreenText: input.onScreenText,
    tags: input.tags ?? deriveTags(input.rawText),
    isFavorite: input.isFavorite ?? false,
    savedAt: input.savedAt ?? new Date().toISOString(),
    tier,
  };
}

/** Extrae valores para los marcadores habituales desde un texto libre. */
export function extractValues(text: string): Record<string, string> {
  const values: Record<string, string> = {};

  const numberMatch = text.match(/^\s*[¿¡]?\s*(\d+)/);
  if (numberMatch) {
    values["[NÚMERO]"] = numberMatch[1];
    values["[N]"] = numberMatch[1];
  }

  const timeMatch = text.match(
    /\ben\s+(\d+\s*(?:d[ií]as|semanas|meses|a[nñ]os))/i,
  );
  if (timeMatch) values["[TIEMPO]"] = timeMatch[1].toLowerCase();

  const fromTo = text.match(/de\s+([^,]{2,30}?)\s+a\s+([^,]{2,30})/i);
  if (fromTo) {
    values["[A]"] = fromTo[1].trim();
    values["[B]"] = fromTo[2].trim();
  }

  return values;
}

const STOPWORDS = new Set([
  "para", "como", "esto", "esta", "este", "pero", "porque", "desde", "hasta",
  "sobre", "entre", "cuando", "donde", "todos", "toda", "mucho", "poco", "más",
  "menos", "también", "sólo", "solo", "muy", "hay", "hace", "the", "and",
]);

function deriveTags(text: string, max = 5): string[] {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-záéíóúñü]{4,}/g) ?? []) {
    if (STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([word]) => word);
}

export { HOOK_TYPES };
