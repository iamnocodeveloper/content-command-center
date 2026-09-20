import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { CompetitorAccount, Niche } from "@/lib/domain/types";

/**
 * Cuentas vigiladas del Seguimiento de competidores.
 *
 * El resto del modelo propio vive en un store en memoria, pero esta lista no es
 * dato derivado: la eliges tú a mano, así que es **configuración**. Se persiste
 * en `DATA_DIR/competitors.json` con permisos 0600, con el mismo criterio que
 * las credenciales de `lib/server/settings-store.ts`:
 *
 *  - Lectura síncrona y cacheada en módulo.
 *  - Sólo servidor: ningún componente cliente importa este archivo.
 *  - Si el disco es efímero (Vercel) o falla la escritura, se avisa y la lista
 *    sigue activa en memoria para esa instancia, en lugar de romper la UI.
 *
 * Las 8 cuentas de demostración **no** entran aquí: viven en
 * `lib/domain/seed/competitors.ts` y sólo las sirve el modo demo.
 */

function resolveFilePath(): string {
  const dir = process.env.DATA_DIR?.trim() || ".data";
  return join(process.cwd(), dir, "competitors.json");
}

let cache: CompetitorAccount[] | null = null;

function isAccount(value: unknown): value is CompetitorAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<CompetitorAccount>;
  return (
    typeof account.id === "string" &&
    typeof account.username === "string" &&
    typeof account.platform === "string"
  );
}

/** Normaliza lo leído del disco: se descarta cualquier entrada sin forma válida. */
function normalize(raw: unknown): CompetitorAccount[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isAccount);
}

/** Lista persistida de cuentas vigiladas. Nunca lanza. */
export function readTrackedAccounts(): CompetitorAccount[] {
  if (cache) return cache;

  const file = resolveFilePath();
  try {
    if (!existsSync(file)) {
      cache = [];
      return cache;
    }
    cache = normalize(JSON.parse(readFileSync(file, "utf8")) as unknown);
  } catch (error) {
    console.warn("[competitors] No se pudo leer competitors.json:", error);
    cache = [];
  }
  return cache;
}

/** Escribe en disco. Devuelve si se pudo persistir. */
function persist(next: CompetitorAccount[]): boolean {
  cache = next;

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
    return true;
  } catch (error) {
    console.warn("[competitors] No se pudo persistir competitors.json:", error);
    return false;
  }
}

export interface TrackedResult<T> {
  value: T;
  persisted: boolean;
}

/**
 * Añade una cuenta. Idempotente por `(username, platform)`: repetir el alta
 * devuelve la existente en lugar de duplicarla.
 */
export function addTrackedAccount(input: {
  username: string;
  platform: string;
  displayName?: string;
  followerCount?: number;
  niche?: Niche;
}): TrackedResult<CompetitorAccount> {
  const username = input.username.trim();
  const current = readTrackedAccounts();

  const existing = current.find(
    (account) =>
      account.username.toLowerCase() === username.toLowerCase() &&
      account.platform === input.platform,
  );
  if (existing) return { value: existing, persisted: true };

  const account: CompetitorAccount = {
    id: `cmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    platform: input.platform,
    username: username.startsWith("@") ? username : `@${username}`,
    displayName: input.displayName?.trim() || username.replace(/^@/, ""),
    followerCount: input.followerCount ?? 0,
    niche: input.niche ?? "marketing",
    isActive: true,
    addedAt: new Date().toISOString(),
  };

  return { value: account, persisted: persist([...current, account]) };
}

/** Deja de seguir una cuenta. */
export function removeTrackedAccount(
  id: string,
): TrackedResult<boolean> & { found: boolean } {
  const current = readTrackedAccounts();
  const next = current.filter((account) => account.id !== id);

  if (next.length === current.length) {
    return { value: false, found: false, persisted: true };
  }
  return { value: true, found: true, persisted: persist(next) };
}

/** Invalida la caché (tests o edición manual del archivo). */
export function invalidateTrackedCache(): void {
  cache = null;
}
