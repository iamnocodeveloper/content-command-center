import {
  ZERNIO_BASE_URL,
  getZernioApiKey,
  getProfileId,
} from "@/lib/zernio/config";
import type { ZernioErrorBody } from "@/lib/zernio/types";

/**
 * Error tipado de Zernio. Conserva el envelope documentado en
 * https://docs.zernio.com/guides/error-handling para que la UI pueda decidir
 * si reintentar (`retryable`) o pedir al usuario que actúe.
 */
export class ZernioError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly type?: string;
  readonly param?: string;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(status: number, body: Partial<ZernioErrorBody> = {}) {
    super(body.error || body.message || `Zernio respondió ${status}`);
    this.name = "ZernioError";
    this.status = status;
    this.code = body.code;
    this.type = body.type;
    this.param = body.param;
    this.details = body.details;
    this.retryable = status === 429 || status >= 500;
  }
}

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Cabecera `x-request-id` para reintentos idempotentes al crear posts. */
  requestId?: string;
  /** Cabecera `Idempotency-Key` para el resto de escrituras. */
  idempotencyKey?: string;
  /**
   * Credencial a usar en esta llamada concreta. Permite probar una clave desde
   * /settings antes de guardarla, sin tocar la configuración activa.
   */
  apiKey?: string;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${ZERNIO_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Cliente HTTP mínimo y tipado contra `https://zernio.com/api/v1`.
 * No depende del SDK oficial para mantener el bundle y los tipos bajo control.
 */
export async function zernioFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const apiKey = options.apiKey?.trim() || getZernioApiKey();
  if (!apiKey) {
    throw new ZernioError(401, {
      error:
        "Falta la API key de Zernio. Configúrala en Ajustes o en .env.local.",
      code: "missing_api_key",
    });
  }

  const { method = "GET", query, body, requestId, idempotencyKey, signal } =
    options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (requestId) headers["x-request-id"] = requestId;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : {};

  if (!response.ok) {
    throw new ZernioError(
      response.status,
      (payload as Partial<ZernioErrorBody>) ?? {},
    );
  }

  return payload as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

/** Cabecera de idempotencia estable para un comando del usuario. */
export function makeRequestId(scope: string): string {
  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export { getProfileId };
