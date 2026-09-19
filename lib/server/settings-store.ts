import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Almacén de configuración de integraciones.
 *
 * Persiste en `DATA_DIR/settings.json` (por defecto `.data/settings.json`) las
 * credenciales y preferencias que el usuario introduce desde la página
 * /settings: clave de Zernio, perfil, proveedor de IA y sus claves.
 *
 * Diseño:
 *  - Lectura SÍNCRONA y cacheada en módulo, para que los getters de
 *    `lib/zernio/config.ts` sigan siendo síncronos y no haya que reescribir
 *    todo el código servidor.
 *  - Sólo se ejecuta en el servidor: ningún componente cliente importa este
 *    módulo ni `lib/zernio/config.ts`.
 *  - El archivo se crea con permisos 0600 (sólo el propietario). En
 *    plataformas con sistema de archivos efímero (Vercel) la escritura puede
 *    fallar: en ese caso se informa y se recomienda usar variables de entorno.
 */

export type SettingSource = "file" | "env" | "unset";
export type AiProviderId = "heuristic" | "openai" | "anthropic";
export type TranscriptionProviderId = "mock" | "openai" | "deepgram";
export type DemoModeSetting = "auto" | "on" | "off";

export interface AppSettings {
  zernio: {
    apiKey?: string;
    profileId?: string;
    timezone?: string;
    demoMode: DemoModeSetting;
  };
  ai: {
    provider: AiProviderId;
    openaiApiKey?: string;
    openaiModel: string;
    anthropicApiKey?: string;
    anthropicModel: string;
  };
  transcription: {
    provider: TranscriptionProviderId;
    deepgramApiKey?: string;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  zernio: { demoMode: "auto" },
  ai: {
    provider: "heuristic",
    openaiModel: "gpt-4o-mini",
    anthropicModel: "claude-sonnet-4-5",
  },
  transcription: { provider: "mock" },
};

function resolveFilePath(): string {
  const dir = process.env.DATA_DIR?.trim() || ".data";
  return join(process.cwd(), dir, "settings.json");
}

let cache: AppSettings | null = null;
let lastWriteError: string | null = null;

function normalize(raw: unknown): AppSettings {
  const input = (raw ?? {}) as Partial<AppSettings>;
  return {
    zernio: { ...DEFAULT_SETTINGS.zernio, ...(input.zernio ?? {}) },
    ai: { ...DEFAULT_SETTINGS.ai, ...(input.ai ?? {}) },
    transcription: {
      ...DEFAULT_SETTINGS.transcription,
      ...(input.transcription ?? {}),
    },
  };
}

/**
 * Lee la configuración persistida. No lanza: ante cualquier problema
 * (archivo ausente, JSON corrupto, entorno sin disco) devuelve los valores por
 * defecto para no tumbar la aplicación.
 */
export function readSettings(): AppSettings {
  if (cache) return cache;

  const file = resolveFilePath();
  try {
    if (!existsSync(file)) {
      cache = normalize({});
      return cache;
    }
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    cache = normalize(parsed);
  } catch (error) {
    console.warn("[settings] No se pudo leer settings.json:", error);
    cache = normalize({});
  }
  return cache;
}

export interface WriteResult {
  ok: boolean;
  persisted: boolean;
  error?: string;
}

/**
 * Parche de configuración: cada sección es parcial, de modo que guardar sólo la
 * tarjeta de IA no obliga a enviar los valores de Zernio.
 */
export interface SettingsPatch {
  zernio?: Partial<AppSettings["zernio"]>;
  ai?: Partial<AppSettings["ai"]>;
  transcription?: Partial<AppSettings["transcription"]>;
}

/** Escribe la configuración en disco. Devuelve si se pudo persistir. */
export function writeSettings(patch: SettingsPatch): WriteResult {
  const current = readSettings();
  const next = normalize({
    zernio: { ...current.zernio, ...(patch.zernio ?? {}) },
    ai: { ...current.ai, ...(patch.ai ?? {}) },
    transcription: {
      ...current.transcription,
      ...(patch.transcription ?? {}),
    },
  });

  // Los campos vacíos significan "borrar el valor guardado".
  for (const section of ["zernio", "ai", "transcription"] as const) {
    for (const [key, value] of Object.entries(next[section])) {
      if (value === "") {
        delete (next[section] as Record<string, unknown>)[key];
      }
    }
  }

  cache = normalize(next);

  const file = resolveFilePath();
  try {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    try {
      chmodSync(file, 0o600);
    } catch {
      // Windows y algunos sistemas de archivos no soportan chmod: es tolerable.
    }
    lastWriteError = null;
    return { ok: true, persisted: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo escribir en disco";
    lastWriteError = message;
    return {
      ok: true,
      persisted: false,
      error: `${message}. La configuración queda activa sólo en memoria; en producción define las variables de entorno.`,
    };
  }
}

/** Último error de escritura, para surfacearlo en la UI. */
export function getLastWriteError(): string | null {
  return lastWriteError;
}

/** Invalida la caché (útil en tests o tras editar el archivo a mano). */
export function invalidateSettingsCache(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// Resolución con procedencia (archivo > variables de entorno)
// ---------------------------------------------------------------------------

export interface ResolvedValue {
  value: string | undefined;
  source: SettingSource;
}

/**
 * El valor guardado desde la UI gana sobre la variable de entorno: si el
 * usuario lo escribió a propósito, espera que se aplique. La procedencia se
 * expone en la UI para que no haya ambigüedad.
 */
export function resolveValue(
  fileValue: string | undefined,
  envValue: string | undefined,
): ResolvedValue {
  const cleanFile = fileValue?.trim();
  if (cleanFile) return { value: cleanFile, source: "file" };
  const cleanEnv = envValue?.trim();
  if (cleanEnv) return { value: cleanEnv, source: "env" };
  return { value: undefined, source: "unset" };
}

/** Enmascara un secreto dejando visibles los últimos 4 caracteres. */
export function maskSecret(secret?: string): string | null {
  if (!secret) return null;
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 3)}••••••••${secret.slice(-4)}`;
}
