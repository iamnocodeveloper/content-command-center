import { getCaptionProvider } from "@/lib/zernio/config";
import { aiComplete, type AiMessage } from "@/lib/services/ai";
import { NICHE_LABELS, type Niche } from "@/lib/domain/types";

/**
 * Generación de captions por plataforma.
 *
 * - `heuristic` (por defecto): plantillas deterministas por plataforma. Sin
 *   coste, sin red y sin depender de claves.
 * - `openai` / `anthropic`: el texto se refina con el modelo configurado en
 *   /settings. Si la llamada falla, se devuelve el heurístico sin romper la UI.
 */

export interface CaptionRequest {
  hook: string;
  angle: string;
  niche: Niche;
  platforms: string[];
  /** Notas extra del creador (oferta, enlace, restricciones). */
  notes?: string;
  /** Duración objetivo del video, en segundos. */
  durationSeconds?: number;
}

export interface CaptionVariant {
  platform: string;
  caption: string;
  hashtags: string[];
  /** Primer comentario sugerido (útil para el CTA o el enlace). */
  firstComment?: string;
  /** `true` cuando el texto salió del modelo de IA. */
  refined?: boolean;
}

export interface CaptionResponse {
  provider: string;
  variants: CaptionVariant[];
  /** Motivo del fallback al heurístico, si lo hubo. */
  note?: string;
}

const CTA_BY_PLATFORM: Record<string, string> = {
  instagram: "Guarda esto para tu próxima publicación y dime en comentarios qué te funcionó.",
  tiktok: "Sígueme si quieres más de esto.",
  youtube: "Suscríbete si te sirvió; subo un sistema como este cada semana.",
  facebook: "Comparte esto con quien lo necesite.",
  threads: "¿Te pasa lo mismo? Cuéntame.",
  linkedin: "¿Cómo lo resolvéis en vuestro equipo?",
  twitter: "RT si te sirvió.",
  default: "Guárdalo para después.",
};

const HASHTAG_BANK: Record<Niche, string[]> = {
  fitness: ["fitness", "entrenamiento", "rutina", "gym", "salud"],
  negocios: ["negocios", "emprendimiento", "pymes", "clientes", "facturacion"],
  marketing: ["marketing", "marketingdigital", "contenido", "copywriting", "crecimiento"],
  ia_automatizacion: ["ia", "inteligenciaartificial", "automatizacion", "productividad", "n8n"],
  finanzas: ["finanzas", "inversion", "dinero", "ahorro", "libertadfinanciera"],
  desarrollo_personal: ["habitos", "disciplina", "mentalidad", "productividad", "foco"],
  tecnologia: ["tecnologia", "software", "saas", "developers", "startups"],
  gastronomia: ["recetas", "cocina", "gastronomia", "foodie", "chef"],
  viajes: ["viajes", "destinos", "travel", "mochilero", "aventura"],
  moda_belleza: ["moda", "outfit", "skincare", "maquillaje", "estilo"],
  educacion: ["educacion", "estudiar", "aprender", "curso", "apuntes"],
  inmobiliaria: ["inmobiliaria", "propiedades", "renta", "hipoteca", "inversion"],
};

const PLATFORM_TAG_COUNT: Record<string, number> = {
  instagram: 12,
  tiktok: 5,
  youtube: 4,
  facebook: 4,
  threads: 3,
  linkedin: 5,
  twitter: 2,
};

/**
 * Etiquetas transversales que se añaden cuando el banco del nicho no llega al
 * número de hashtags que la plataforma premia (Instagram pide 8-15).
 */
const GENERIC_TAGS = [
  "creadordecontenido",
  "contenido",
  "socialmedia",
  "estrategia",
  "crecimiento",
  "tips",
  "aprender",
  "productividad",
  "emprender",
  "reels",
];

const PLATFORM_TONE: Record<string, string> = {
  instagram: "cercano y visual, con saltos de línea y una llamada a guardar",
  tiktok: "muy corto, coloquial, sin hashtags de relleno",
  youtube: "descriptivo, con la promesa del vídeo en la primera línea",
  linkedin: "profesional y en primera persona, sin emojis excesivos",
  threads: "conversacional y breve, termina en pregunta",
  facebook: "directo y compartible",
  twitter: "una sola idea, sin rodeos",
};

function buildHashtags(niche: Niche, platform: string, extra: string[]): string[] {
  const bank = HASHTAG_BANK[niche] ?? HASHTAG_BANK.marketing;
  const count = PLATFORM_TAG_COUNT[platform] ?? 5;
  const merged = [
    ...bank,
    ...extra.map((tag) => tag.replace(/\s+/g, "").toLowerCase()),
    ...GENERIC_TAGS,
  ];
  return [...new Set(merged)].slice(0, count);
}

function heuristicCaption(input: CaptionRequest, platform: string): CaptionVariant {
  const cta = CTA_BY_PLATFORM[platform] ?? CTA_BY_PLATFORM.default;
  const duration = input.durationSeconds ?? 30;
  const hashtags = buildHashtags(input.niche, platform, [
    NICHE_LABELS[input.niche].toLowerCase().replace(/\s+/g, ""),
  ]);

  const lines: string[] = [input.hook, "", input.angle];

  if (input.notes) lines.push("", input.notes);

  if (platform === "linkedin") {
    lines.push(
      "",
      "Contexto: esto me llevó a revisar cómo trabajo el contenido cada semana. La idea central es simple: un formato, varios ángulos.",
    );
  }

  if (platform === "youtube") {
    lines.push("", `En ${duration} segundos tienes el resumen completo.`);
  }

  lines.push("", cta);

  const firstComment =
    platform === "instagram" || platform === "tiktok"
      ? "Te dejo la plantilla completa en el comentario fijado 👇"
      : undefined;

  return {
    platform,
    caption: lines.join("\n"),
    hashtags,
    firstComment,
    refined: false,
  };
}

/**
 * Refina las captions con el modelo configurado. Se hace en una sola llamada
 * con todas las plataformas para controlar coste y latencia.
 */
async function refineWithAi(
  input: CaptionRequest,
  variants: CaptionVariant[],
): Promise<{ variants: CaptionVariant[]; note?: string }> {
  const messages: AiMessage[] = [
    {
      role: "system",
      content: [
        "Eres copywriter de redes sociales en español.",
        "Reescribes captions manteniendo el hook LITERAL en la primera línea.",
        "Adaptas longitud y tono a cada plataforma y eliminas el relleno.",
        "Devuelves SIEMPRE JSON válido con esta forma:",
        '{"captions": [{"platform": string, "caption": string, "hashtags": string[]}]}',
        "hashtags sin el carácter #. Entre 3 y 12 por plataforma.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Hook literal (no cambiar): ${input.hook}`,
        `Ángulo: ${input.angle}`,
        `Nicho: ${NICHE_LABELS[input.niche]}`,
        input.notes ? `Notas: ${input.notes}` : "",
        "",
        "Plataformas y borradores a reescribir:",
        ...variants.map(
          (variant) =>
            `- ${variant.platform} (tono: ${PLATFORM_TONE[variant.platform] ?? "directo"})` +
            `\n  hashtags actuales: ${variant.hashtags.join(", ")}` +
            `\n  caption actual:\n${variant.caption}`,
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  try {
    const { text } = await aiComplete(messages, {
      json: true,
      temperature: 0.7,
      maxTokens: 2000,
    });

    const parsed = parseCaptionsPayload(text);
    if (!parsed) throw new Error("El modelo no devolvió captions válidas.");

    return {
      variants: variants.map((variant) => {
        const match = parsed.find(
          (item) => item.platform?.toLowerCase() === variant.platform.toLowerCase(),
        );
        if (!match?.caption) return variant;
        return {
          ...variant,
          caption: match.caption.trim(),
          hashtags:
            match.hashtags && match.hashtags.length > 0
              ? match.hashtags.map((tag) => tag.replace(/^#/, "").trim()).slice(0, 12)
              : variant.hashtags,
          refined: true,
        };
      }),
    };
  } catch (error) {
    return {
      variants,
      note:
        error instanceof Error
          ? `Se usó el generador heurístico: ${error.message}`
          : "Se usó el generador heurístico.",
    };
  }
}

function parseCaptionsPayload(
  raw: string,
): Array<{ platform?: string; caption?: string; hashtags?: string[] }> | null {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      captions?: Array<{ platform?: string; caption?: string; hashtags?: string[] }>;
    };
    return Array.isArray(parsed.captions) ? parsed.captions : null;
  } catch {
    return null;
  }
}

export async function generateCaptions(
  input: CaptionRequest,
): Promise<CaptionResponse> {
  const platforms = input.platforms.length > 0 ? input.platforms : ["instagram"];
  const variants = platforms.map((platform) => heuristicCaption(input, platform));

  const provider = getCaptionProvider();
  if (provider === "heuristic") {
    return { provider, variants };
  }

  const refined = await refineWithAi(input, variants);
  return { provider, variants: refined.variants, note: refined.note };
}

/** Variante compacta para previsualizar sin emojis ni saltos de línea. */
export function plainCaption(variant: CaptionVariant): string {
  return `${variant.caption}\n\n${variant.hashtags.map((h) => `#${h}`).join(" ")}`.trim();
}
