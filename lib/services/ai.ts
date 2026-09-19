import { getAiConfig, type AiConfig } from "@/lib/zernio/config";
import type { AiProviderId } from "@/lib/server/settings-store";
import { NICHE_LABELS, type Niche } from "@/lib/domain/types";

/**
 * Capa de IA para creaciones y textos.
 *
 * Un único punto de entrada (`aiComplete`) sobre los proveedores soportados:
 *  - `openai`    · POST https://api.openai.com/v1/chat/completions
 *  - `anthropic` · POST https://api.anthropic.com/v1/messages
 *  - `heuristic` · generador local determinista, sin red ni coste
 *
 * Toda función de alto nivel degrada al heurístico si el proveedor falla o no
 * está configurado, de modo que la UI nunca se queda sin respuesta.
 */

export interface AiMessage {
  role: "system" | "user";
  content: string;
}

export interface AiCompleteOptions {
  maxTokens?: number;
  temperature?: number;
  /** Pide al modelo una respuesta JSON estricta y la parsea. */
  json?: boolean;
  signal?: AbortSignal;
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function isAiConfigured(config: AiConfig = getAiConfig()): boolean {
  return config.ready;
}

export function aiProviderLabel(provider: AiProviderId, model?: string): string {
  switch (provider) {
    case "openai":
      return model ? `OpenAI · ${model}` : "OpenAI";
    case "anthropic":
      return model ? `Anthropic · ${model}` : "Anthropic";
    default:
      return "Heurístico (local)";
  }
}

/**
 * Ejecuta una completación. Lanza `AiUnavailableError` si el proveedor no está
 * configurado o responde con error, para que el llamador decida el fallback.
 */
export async function aiComplete(
  messages: AiMessage[],
  options: AiCompleteOptions = {},
): Promise<{ text: string; provider: AiProviderId; model: string }> {
  const config = getAiConfig();

  if (config.provider === "heuristic") {
    throw new AiUnavailableError(
      "El proveedor de IA es «heurístico»: configura OpenAI o Anthropic en Ajustes.",
    );
  }

  if (config.provider === "openai") {
    if (!config.openaiApiKey) {
      throw new AiUnavailableError("Falta la API key de OpenAI.");
    }
    const text = await callOpenAI(config, messages, options);
    return { text, provider: "openai", model: config.openaiModel };
  }

  if (!config.anthropicApiKey) {
    throw new AiUnavailableError("Falta la API key de Anthropic.");
  }
  const text = await callAnthropic(config, messages, options);
  return { text, provider: "anthropic", model: config.anthropicModel };
}

async function callOpenAI(
  config: AiConfig,
  messages: AiMessage[],
  options: AiCompleteOptions,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1200,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: options.signal ?? AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new AiUnavailableError(
      `OpenAI respondió ${response.status}: ${await safeErrorText(response)}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiUnavailableError("OpenAI devolvió una respuesta vacía.");
  return text;
}

async function callAnthropic(
  config: AiConfig,
  messages: AiMessage[],
  options: AiCompleteOptions,
): Promise<string> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m) => m.role === "user")
    .map((m) => ({ role: "user" as const, content: m.content }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.anthropicApiKey ?? "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: options.maxTokens ?? 1200,
      temperature: options.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages: turns.length > 0 ? turns : [{ role: "user", content: "Hola" }],
    }),
    signal: options.signal ?? AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new AiUnavailableError(
      `Anthropic respondió ${response.status}: ${await safeErrorText(response)}`,
    );
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = payload.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();

  if (!text) throw new AiUnavailableError("Anthropic devolvió una respuesta vacía.");
  return text;
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.slice(0, 300);
  } catch {
    return response.statusText;
  }
}

/** Extrae JSON de una respuesta que puede venir con vallas de código. */
export function parseJsonLoose<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Prueba de conexión
// ---------------------------------------------------------------------------

export interface AiTestResult {
  ok: boolean;
  provider: AiProviderId;
  model?: string;
  message: string;
  latencyMs?: number;
  /** Respuesta literal del modelo, para verificar que llega contenido. */
  sample?: string;
}

/** Prueba el proveedor indicado, permitiendo valores aún no guardados. */
export async function testAiConnection(input: {
  provider: AiProviderId;
  apiKey?: string;
  model?: string;
}): Promise<AiTestResult> {
  if (input.provider === "heuristic") {
    return {
      ok: true,
      provider: "heuristic",
      message:
        "El generador heurístico funciona sin credenciales: produce captions y guiones con plantillas locales.",
    };
  }

  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    return {
      ok: false,
      provider: input.provider,
      message: "Introduce una API key para probar la conexión.",
    };
  }

  const config = getAiConfig();
  const model =
    input.model?.trim() ||
    (input.provider === "openai" ? config.openaiModel : config.anthropicModel);

  const probe: AiMessage[] = [
    {
      role: "system",
      content: "Responde siempre en español, en una sola frase corta.",
    },
    { role: "user", content: "Confirma con una frase que la conexión funciona." },
  ];

  const overridden: AiConfig = {
    ...config,
    provider: input.provider,
    ...(input.provider === "openai"
      ? { openaiApiKey: apiKey, openaiModel: model, ready: true }
      : { anthropicApiKey: apiKey, anthropicModel: model, ready: true }),
  };

  const startedAt = Date.now();
  try {
    const text =
      input.provider === "openai"
        ? await callOpenAI(overridden, probe, { maxTokens: 60, temperature: 0 })
        : await callAnthropic(overridden, probe, { maxTokens: 60, temperature: 0 });

    return {
      ok: true,
      provider: input.provider,
      model,
      message: "Conexión correcta.",
      latencyMs: Date.now() - startedAt,
      sample: text,
    };
  } catch (error) {
    return {
      ok: false,
      provider: input.provider,
      model,
      latencyMs: Date.now() - startedAt,
      message:
        error instanceof Error ? error.message : "No se pudo conectar con el proveedor.",
    };
  }
}

/** Prueba el proveedor actualmente configurado (sin overrides). */
export async function testConfiguredAi(): Promise<AiTestResult> {
  const config = getAiConfig();
  if (config.provider === "openai") {
    return testAiConnection({
      provider: "openai",
      apiKey: config.openaiApiKey,
      model: config.openaiModel,
    });
  }
  if (config.provider === "anthropic") {
    return testAiConnection({
      provider: "anthropic",
      apiKey: config.anthropicApiKey,
      model: config.anthropicModel,
    });
  }
  return testAiConnection({ provider: "heuristic" });
}

// ---------------------------------------------------------------------------
// Generadores de alto nivel (con fallback heurístico)
// ---------------------------------------------------------------------------

export interface GeneratedScript {
  hook: string;
  beats: string[];
  cta: string;
  caption: string;
  hashtags: string[];
  source: AiProviderId | "fallback";
  /** Motivo del fallback, cuando aplica. */
  note?: string;
}

export interface ScriptRequest {
  hook: string;
  angle: string;
  niche: Niche;
  platform: string;
  durationSeconds?: number;
  notes?: string;
}

/** Convierte una idea en un guion por bloques + caption. */
export async function generateScript(
  input: ScriptRequest,
): Promise<GeneratedScript> {
  const messages: AiMessage[] = [
    {
      role: "system",
      content: [
        "Eres un guionista de contenido vertical en español, especializado en hooks virales.",
        "Escribes directo, sin relleno, con frases cortas y concretas.",
        "Devuelves SIEMPRE un objeto JSON válido con esta forma exacta:",
        '{"hook": string, "beats": string[], "cta": string, "caption": string, "hashtags": string[]}',
        "beats son 3-5 bloques numerados del desarrollo, cada uno de una sola frase.",
        "caption es el texto de publicación sin hashtags.",
        "hashtags son entre 3 y 12 etiquetas sin el carácter #.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Hook de partida: ${input.hook}`,
        `Ángulo: ${input.angle}`,
        `Nicho: ${NICHE_LABELS[input.niche]}`,
        `Plataforma: ${input.platform}`,
        `Duración objetivo: ${input.durationSeconds ?? 30} segundos`,
        input.notes ? `Notas: ${input.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  try {
    const { text, provider } = await aiComplete(messages, {
      json: true,
      temperature: 0.75,
      maxTokens: 1400,
    });

    const parsed = parseJsonLoose<Partial<GeneratedScript>>(text);
    if (parsed?.hook && Array.isArray(parsed.beats)) {
      return {
        hook: parsed.hook,
        beats: parsed.beats.slice(0, 6),
        cta: parsed.cta ?? "Guarda esto para tu próxima publicación.",
        caption: parsed.caption ?? "",
        hashtags: (parsed.hashtags ?? []).slice(0, 12),
        source: provider,
      };
    }

    // El modelo respondió texto libre: se aprovecha como cuerpo del guion.
    return {
      ...heuristicScript(input),
      source: provider,
      note: "El modelo no devolvió JSON; se estructuró la respuesta como texto.",
      beats: text.split(/\n+/).filter(Boolean).slice(0, 6),
    };
  } catch (error) {
    return {
      ...heuristicScript(input),
      source: "fallback",
      note: error instanceof Error ? error.message : "Proveedor de IA no disponible.",
    };
  }
}

function heuristicScript(input: ScriptRequest): GeneratedScript {
  const duration = input.durationSeconds ?? 30;
  return {
    hook: input.hook,
    beats: [
      `Contexto: por qué ${input.angle.toLowerCase()} importa ahora mismo.`,
      "El error concreto que comete casi todo el mundo, con un ejemplo real.",
      "El cambio exacto que aplicas y el resultado medible que obtuviste.",
      `Cierre con la conclusión en una frase, dentro de ${duration}s.`,
    ],
    cta: "Guarda esto para tu próxima publicación y dime en comentarios qué te funcionó.",
    caption: `${input.hook}\n\n${input.angle}.`,
    hashtags: [input.niche, input.platform, "contenido", "crecimiento"],
    source: "fallback",
  };
}

export interface HookVariantsResult {
  variants: Array<{ text: string; pattern: string; rationale: string }>;
  source: AiProviderId | "fallback";
  note?: string;
}

/** Genera variaciones de un mismo hook reutilizando los patrones del catálogo. */
export async function generateHookVariants(input: {
  base: string;
  niche: Niche;
  count?: number;
  patterns?: string[];
}): Promise<HookVariantsResult> {
  const count = input.count ?? 5;
  const patternList = input.patterns?.length
    ? input.patterns.join(", ")
    : "[X] acaba de destruir [Y], Deja de hacer [X], [NÚMERO] cosas que me hubiera gustado saber, Cómo pasé de [A] a [B] en [TIEMPO], Si sigues haciendo [X] para ya, La plantilla exacta que uso para [X]";

  const messages: AiMessage[] = [
    {
      role: "system",
      content: [
        "Eres un especialista en hooks para vídeo corto en español.",
        "Escribes hooks que se entienden en menos de 2 segundos y crean tensión.",
        "Devuelves SIEMPRE JSON válido:",
        '{"variants": [{"text": string, "pattern": string, "rationale": string}]}',
        "pattern es la plantilla usada, textualmente del catálogo que se te da.",
        "rationale explica en una frase por qué ese hook retiene.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Hook de referencia: ${input.base}`,
        `Nicho: ${NICHE_LABELS[input.niche]}`,
        `Número de variantes: ${count}`,
        `Plantillas disponibles: ${patternList}`,
      ].join("\n"),
    },
  ];

  try {
    const { text, provider } = await aiComplete(messages, {
      json: true,
      temperature: 0.85,
      maxTokens: 1200,
    });

    const parsed = parseJsonLoose<{
      variants?: Array<{ text: string; pattern: string; rationale: string }>;
    }>(text);

    if (parsed?.variants?.length) {
      return { variants: parsed.variants.slice(0, count), source: provider };
    }
    throw new Error("El modelo no devolvió variantes válidas.");
  } catch (error) {
    return {
      variants: heuristicHookVariants(input.base, count),
      source: "fallback",
      note: error instanceof Error ? error.message : "Proveedor de IA no disponible.",
    };
  }
}

function heuristicHookVariants(
  base: string,
  count: number,
): Array<{ text: string; pattern: string; rationale: string }> {
  const subject = subjectFromBase(base);

  const templates: Array<[string, string, string]> = [
    [
      `${capitalize(subject)} acaba de destruir la forma en la que trabajabas`,
      "[X] acaba de destruir [Y]",
      "El conflicto con algo nuevo obliga a comprobar de qué se trata.",
    ],
    [
      `Deja de hacer ${subject}`,
      "Deja de hacer [X]",
      "La orden directa funciona como patrón de interrupción.",
    ],
    [
      `5 cosas que me hubiera gustado saber antes de ${subject}`,
      "[NÚMERO] cosas que me hubiera gustado saber antes de [X]",
      "La cifra promete un final claro y sube la retención.",
    ],
    [
      `Si sigues con ${subject}, para ya`,
      "Si sigues haciendo [X], para ya",
      "Urgencia y riesgo personal: el espectador se queda a verificar.",
    ],
    [
      `La plantilla exacta que uso para ${subject}`,
      "La plantilla exacta que uso para [X]",
      "Valor tangible y guardable; dispara el guardado.",
    ],
  ];

  const normalizedBase = base.trim().toLowerCase();

  return templates
    .filter(([text]) => text.trim().toLowerCase() !== normalizedBase)
    .slice(0, count)
    .map(([text, pattern, rationale]) => ({ text, pattern, rationale }));
}

/**
 * Aísla el tema de un hook existente para poder reinyectarlo en otra plantilla.
 * Quita la apertura propia del hook original ("nadie te dice la verdad sobre",
 * "deja de", la cifra inicial...) y recorta a cuatro palabras.
 */
function subjectFromBase(base: string): string {
  let text = base.trim().replace(/[¿?¡!.]/g, "");

  const openers: RegExp[] = [
    /^nadie te dice (la verdad )?(sobre |de |que )?/i,
    /^deja de (hacer )?/i,
    /^para de (hacer )?/i,
    /^si sigues (haciendo |con )?/i,
    /^c[oó]mo (pas[eé] de |llegu[eé] a |logr[eé] )?/i,
    /^(el truco|el secreto) que usan [^ ]+ para /i,
    /^la plantilla exacta que uso para /i,
    /^\d+\s+(cosas|errores|formas|razones|pasos|trucos|señales)\s+(que\s+)?(me hubiera gustado saber\s+)?(antes de\s+)?/i,
  ];

  for (const opener of openers) {
    text = text.replace(opener, "");
  }

  const words = text.split(/\s+/).filter(Boolean).slice(0, 4).join(" ").trim();
  return words.length >= 3 ? words : base.split(/\s+/).slice(0, 4).join(" ");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface RewriteResult {
  text: string;
  source: AiProviderId | "fallback";
  note?: string;
}

/** Reescribe una caption para una plataforma concreta. */
export async function rewriteCaption(input: {
  caption: string;
  platform: string;
  niche: Niche;
  hook?: string;
}): Promise<RewriteResult> {
  const messages: AiMessage[] = [
    {
      role: "system",
      content: [
        `Eres copywriter de redes sociales en español, especializado en ${input.platform}.`,
        "Mantienes el hook literal, acortas el relleno y adaptas el tono a la plataforma.",
        "Devuelves sólo el texto final, sin comillas ni explicaciones.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        input.hook ? `Hook literal que no se puede cambiar: ${input.hook}` : "",
        `Nicho: ${NICHE_LABELS[input.niche]}`,
        "",
        input.caption,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  try {
    const { text, provider } = await aiComplete(messages, {
      temperature: 0.7,
      maxTokens: 700,
    });
    return { text, source: provider };
  } catch (error) {
    return {
      text: input.caption,
      source: "fallback",
      note: error instanceof Error ? error.message : "Proveedor de IA no disponible.",
    };
  }
}
