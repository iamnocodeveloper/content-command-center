import type { HookPattern, HookType } from "@/lib/domain/types";

/**
 * Catálogo de plantillas de hook.
 *
 * Cada plantilla es un esqueleto con marcadores entre corchetes. El motor de
 * `lib/domain/hook-engine.ts` usa estos patrones para clasificar hooks nuevos
 * (los que se guardan desde el móvil o desde el seguimiento de competidores) y
 * para generar variantes rellenadas automáticamente.
 */
export const HOOK_PATTERNS: HookPattern[] = [
  {
    id: "callout-destroy",
    name: "Callout destructivo",
    template: "[X] acaba de destruir [Y]",
    type: "callout",
    rationale:
      "Genera conflicto y novedad: el espectador necesita saber quién y qué se rompió.",
    example: "Este prompt acaba de destruir 3 horas de edición manual",
    averageViews: 412000,
    usageCount: 18,
  },
  {
    id: "callout-replace",
    name: "Callout de reemplazo",
    template: "[X] acaba de reemplazar a [Y]",
    type: "callout",
    rationale: "Miedo a quedarse atrás; implica una obsolescencia inmediata.",
    example: "La IA acaba de reemplazar a mi editor de video",
    averageViews: 287000,
    usageCount: 11,
  },
  {
    id: "contrarian-stop",
    name: "Deja de hacer",
    template: "Deja de hacer [X]",
    type: "contrarian",
    rationale:
      "La orden directa crea tensión y funciona como patrón de interrupción.",
    example: "Deja de publicar todos los días en Instagram",
    averageViews: 356000,
    usageCount: 22,
  },
  {
    id: "contrarian-nobody",
    name: "Nadie te dice",
    template: "Nadie te dice la verdad sobre [X]",
    type: "contrarian",
    rationale: "Promete información privilegiada y rompe la expectativa.",
    example: "Nadie te dice la verdad sobre vivir de crear contenido",
    averageViews: 198000,
    usageCount: 9,
  },
  {
    id: "listicle-wish",
    name: "Cosas que me hubiera gustado saber",
    template: "[NÚMERO] cosas que me hubiera gustado saber antes de [X]",
    type: "listicle",
    rationale:
      "La estructura numerada promete un final claro y sube el tiempo de retención.",
    example: "5 cosas que me hubiera gustado saber antes de automatizar mi negocio",
    averageViews: 245000,
    usageCount: 27,
  },
  {
    id: "listicle-errors",
    name: "Errores numerados",
    template: "[NÚMERO] errores que te cuestan [Y]",
    type: "listicle",
    rationale: "Convierte el error en una pérdida concreta y medible.",
    example: "3 errores que te cuestan 10.000 seguidores al mes",
    averageViews: 176000,
    usageCount: 14,
  },
  {
    id: "proof-before-after",
    name: "Antes y después",
    template: "Cómo pasé de [A] a [B] en [TIEMPO]",
    type: "proof",
    rationale: "Transformación concreta y acotada en el tiempo.",
    example: "Cómo pasé de 0 a 40.000 seguidores en 6 meses",
    averageViews: 312000,
    usageCount: 16,
  },
  {
    id: "proof-without",
    name: "Resultado sin sacrificio",
    template: "Cómo [LOGRO] sin [COSTO]",
    type: "proof",
    rationale: "Elimina la objeción principal antes de que aparezca.",
    example: "Cómo crecí en TikTok sin mostrar la cara",
    averageViews: 268000,
    usageCount: 12,
  },
  {
    id: "warning-stop",
    name: "Advertencia urgente",
    template: "Si sigues haciendo [X], para ya",
    type: "warning",
    rationale: "Urgencia + riesgo personal; obliga a quedarse a comprobar.",
    example: "Si sigues comprando seguidores, para ya",
    averageViews: 221000,
    usageCount: 8,
  },
  {
    id: "question-why",
    name: "Pregunta incómoda",
    template: "¿Por qué [X] sigue funcionando?",
    type: "question",
    rationale: "Abre un bucle que el espectador sólo cierra viendo el video.",
    example: "¿Por qué el contenido feo sigue funcionando mejor?",
    averageViews: 154000,
    usageCount: 7,
  },
  {
    id: "story-timeline",
    name: "Historia con fecha",
    template: "Hace [TIEMPO] yo era [A] y hoy [B]",
    type: "story",
    rationale: "El contraste temporal activa identificación inmediata.",
    example: "Hace un año editaba hasta las 3am; hoy publico en 20 minutos",
    averageViews: 189000,
    usageCount: 10,
  },
  {
    id: "utility-template",
    name: "Plantilla regalada",
    template: "La plantilla exacta que uso para [X]",
    type: "utility",
    rationale: "Valor tangible y guardable; dispara el guardado (saves).",
    example: "La plantilla exacta que uso para escribir hooks en 5 minutos",
    averageViews: 143000,
    usageCount: 19,
  },
  {
    id: "curiosity-secret",
    name: "Secreto operativo",
    template: "El truco que usan [GRUPO] para [X]",
    type: "curiosity_gap",
    rationale: "Autoridad prestada de un grupo que el espectador admira.",
    example: "El truco que usan los editores de Netflix para retener",
    averageViews: 205000,
    usageCount: 13,
  },
  {
    id: "warning-last",
    name: "Última oportunidad",
    template: "[X] desaparece en [TIEMPO]. Esto es lo que tienes que hacer",
    type: "warning",
    rationale: "Escasez temporal explícita sobre una acción concreta.",
    example: "Esta función desaparece en 30 días. Esto es lo que tienes que hacer",
    averageViews: 167000,
    usageCount: 6,
  },
];

export const PATTERN_BY_ID = new Map(HOOK_PATTERNS.map((p) => [p.id, p]));

export const PATTERNS_BY_TYPE = HOOK_PATTERNS.reduce(
  (acc, pattern) => {
    (acc[pattern.type] ??= []).push(pattern);
    return acc;
  },
  {} as Record<HookType, HookPattern[]>,
);

export function getPattern(id: string): HookPattern | undefined {
  return PATTERN_BY_ID.get(id);
}
