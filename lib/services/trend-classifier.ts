import { classifyHook, detectNiche } from "@/lib/domain/hook-engine";
import { PATTERN_BY_ID } from "@/lib/domain/hook-patterns";
import type { TrendItem, TrendSource } from "@/lib/domain/types";

/**
 * Clasificador de tendencias: asigna a cada noticia un `hookScore` (0-100) que
 * estima su potencial para convertirse en un hook de contenido.
 *
 * El score pondera cuatro dimensiones, todas extraíbles del texto:
 *  - Novedad / ruptura: verbos de cambio ("lanza", "reemplaza", "acaba de").
 *  - Concreción: cifras, porcentajes, dinero y plazos.
 *  - Tensión: conflicto, riesgo, prohibición o pérdida.
 *  - Autoridad: si la fuente es un laboratorio o un medio de referencia.
 */

export interface TrendFeatures {
  novelty: number;
  concreteness: number;
  tension: number;
  authority: number;
}

const NOVELTY_PATTERNS = [
  /\blanza\b/i,
  /\bacaba de\b/i,
  /\bnuevo\b/i,
  /\bnueva\b/i,
  /\bpor primera vez\b/i,
  /\breemplaz\w+/i,
  /\bpresenta\b/i,
  /\bdespliega\b/i,
  /\bprimera\b/i,
];

const TENSION_PATTERNS = [
  /\bprohib\w+/i,
  /\briesgo\w*/i,
  /\bmulta\w*/i,
  /\bdespid\w+/i,
  /\bcolaps\w+/i,
  /\bcierra\w*/i,
  /\bprohibición\b/i,
  /\bregul\w+/i,
  /\bamenaza\w*/i,
  /\bcrisis\b/i,
];

const CHANGE_PATTERNS = [
  /\best[áa]n cambiando\b/i,
  /\bya no\b/i,
  /\badiós\b/i,
  /\bmuerte\b/i,
  /\bfin de\b/i,
];

const AUTHORITY_BY_CATEGORY: Record<TrendSource["category"], number> = {
  labs: 1,
  research: 0.85,
  media: 0.7,
  newsletter: 0.6,
  community: 0.5,
};

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0);
}

function countNumericSignals(text: string): number {
  const numbers = text.match(/\b\d+(?:[.,]\d+)?\s*(%|€|\$|k|m|millones|mil)?\b/gi) ?? [];
  const money = /\b(\d+(?:[.,]\d+)?)\s*(€|\$|millones|mil)\b/i.test(text) ? 1 : 0;
  const time = /\b(en \d+ (d[ií]as|semanas|meses|años)|\d{4})\b/i.test(text) ? 1 : 0;
  return Math.min(3, numbers.length) + money + time;
}

export function extractTrendFeatures(
  input: Pick<TrendItem, "title" | "summary">,
  source?: TrendSource,
): TrendFeatures {
  const text = `${input.title}. ${input.summary}`;

  const novelty = Math.min(1, countMatches(text, NOVELTY_PATTERNS) / 2.5);
  const concreteness = Math.min(1, countNumericSignals(text) / 3);
  const tension = Math.min(
    1,
    (countMatches(text, TENSION_PATTERNS) + countMatches(text, CHANGE_PATTERNS)) / 2.5,
  );
  const authority = source ? AUTHORITY_BY_CATEGORY[source.category] : 0.6;

  return { novelty, concreteness, tension, authority };
}

/** Pesos de cada dimensión en el score final. Suman 1. */
const WEIGHTS: TrendFeatures = {
  novelty: 0.35,
  concreteness: 0.25,
  tension: 0.25,
  authority: 0.15,
};

export function scoreTrend(features: TrendFeatures): number {
  const raw =
    features.novelty * WEIGHTS.novelty +
    features.concreteness * WEIGHTS.concreteness +
    features.tension * WEIGHTS.tension +
    features.authority * WEIGHTS.authority;

  // Se reparte en 30-99 para que ningún item quede fuera de rango útil.
  return Math.round(30 + raw * 69);
}

export interface ClassifiedTrend {
  hookScore: number;
  hookSuggestion: string;
  patternId: string;
  angle: string;
  category: string;
}

/**
 * Convierte un item crudo en un item clasificado, con sugerencia de hook ya
 * formateada contra el catálogo de plantillas.
 */
export function classifyTrendItem(
  raw: Pick<TrendItem, "title" | "summary" | "sourceName">,
  source?: TrendSource,
): ClassifiedTrend {
  const features = extractTrendFeatures(raw, source);
  const hookScore = scoreTrend(features);
  const niche = detectNiche(`${raw.title} ${raw.summary}`);

  const suggestion = buildSuggestion(raw, features, niche.niche);

  return {
    hookScore,
    hookSuggestion: suggestion.hook,
    patternId: suggestion.patternId,
    angle: suggestion.angle,
    category: categorize(raw.title, raw.summary),
  };
}

interface Suggestion {
  hook: string;
  patternId: string;
  angle: string;
}

function buildSuggestion(
  raw: Pick<TrendItem, "title" | "summary">,
  features: TrendFeatures,
  niche: string,
): Suggestion {
  const subject = extractSubject(raw.title);

  if (features.tension > 0.5) {
    return {
      hook: `Estas reglas desaparecen pronto. Esto es lo que tienes que hacer con ${subject}`,
      patternId: "warning-last",
      angle: `Urgencia regulatoria: explica qué cambia y qué hacer esta semana con ${subject}.`,
    };
  }

  if (features.novelty > 0.6) {
    return {
      hook: `${capitalize(subject)} acaba de destruir la forma en la que trabajabas`,
      patternId: "callout-destroy",
      angle: `Demo práctica: automatiza una tarea real con ${subject} y muestra el antes/después.`,
    };
  }

  if (features.concreteness > 0.5) {
    return {
      hook: `Cómo pasé de X a Y usando ${subject}`,
      patternId: "proof-before-after",
      angle: `Caso con números: cuánto ahorra ${subject} en tiempo o dinero, medido en tu caso.`,
    };
  }

  return {
    hook: `5 cosas que me hubiera gustado saber antes de usar ${subject}`,
    patternId: "listicle-wish",
    angle: `Lista práctica sobre ${subject} aplicada a ${niche.replace("_", " ")}.`,
  };
}

function extractSubject(title: string): string {
  const cleaned = title
    .replace(/^(openai|anthropic|google|meta|microsoft)\s+(lanza|publica|integra|abre)\s+/i, "")
    .replace(/^(nuevo|nueva)\s+/i, "")
    .replace(/[.:].*$/, "")
    .trim();

  const words = cleaned.split(/\s+/).slice(0, 6).join(" ");
  return words.length > 3 ? words.toLowerCase() : title.split(" ").slice(0, 5).join(" ");
}

function categorize(title: string, summary: string): string {
  const text = `${title} ${summary}`.toLowerCase();
  const rules: Array<[string, RegExp]> = [
    ["Agentes", /agente|agent|aut[oó]nom/],
    ["Modelos", /modelo|llm|gpt|claude|gemini|llama/],
    ["Regulación", /regul|ley|norma|ue\b|eu\b|cumpl/],
    ["Vídeo", /v[ií]deo|video|clip|reel/],
    ["Herramientas", /herramienta|tool|app|plugin/],
    ["Investigación", /paper|arxiv|estudio|benchmark|research/],
    ["Negocio", /ronda|recauda|millones|adquis|ipo|precio/],
  ];
  for (const [label, re] of rules) if (re.test(text)) return label;
  return "General";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Anota un item ya existente y refresca su plantilla si el score cambió. */
export function reclassify(item: TrendItem, source?: TrendSource): TrendItem {
  const classified = classifyTrendItem(item, source);
  const classification = classifyHook(item.hookSuggestion);
  const pattern = PATTERN_BY_ID.get(classified.patternId);

  return {
    ...item,
    hookScore: classified.hookScore,
    hookSuggestion: classified.hookSuggestion,
    patternId: pattern ? classified.patternId : classification.patternId,
    angle: classified.angle,
    category: classified.category,
  };
}
