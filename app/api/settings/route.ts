import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { zernioFetch, ZernioError } from "@/lib/zernio/client";
import {
  getAiConfig,
  getIntegrationConfig,
  getTranscriptionConfig,
  isDemoMode,
} from "@/lib/zernio/config";
import {
  DEFAULT_SETTINGS,
  maskSecret,
  readSettings,
  writeSettings,
  type AiProviderId,
  type DemoModeSetting,
  type SettingSource,
} from "@/lib/server/settings-store";
import { testAiConnection } from "@/lib/services/ai";
import type { ZernioAccount } from "@/lib/zernio/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const saveSchema = z.object({
  zernio: z
    .object({
      apiKey: z.string().optional(),
      profileId: z.string().optional(),
      timezone: z.string().optional(),
      demoMode: z.enum(["auto", "on", "off"]).optional(),
    })
    .optional(),
  ai: z
    .object({
      provider: z.enum(["heuristic", "openai", "anthropic"]).optional(),
      openaiApiKey: z.string().optional(),
      openaiModel: z.string().optional(),
      anthropicApiKey: z.string().optional(),
      anthropicModel: z.string().optional(),
    })
    .optional(),
  transcription: z
    .object({
      provider: z.enum(["mock", "openai", "deepgram"]).optional(),
      deepgramApiKey: z.string().optional(),
    })
    .optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("test-zernio"),
    apiKey: z.string().optional(),
    profileId: z.string().optional(),
  }),
  z.object({
    action: z.literal("test-ai"),
    provider: z.enum(["heuristic", "openai", "anthropic"]),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }),
]);

interface MaskedSection {
  [key: string]: string | boolean | null | undefined;
}

function buildStatusPayload() {
  const settings = readSettings();
  const integration = getIntegrationConfig();
  const ai = getAiConfig();
  const transcription = getTranscriptionConfig();

  const zernioSection: MaskedSection & {
    apiKey: string | null;
    apiKeyConfigured: boolean;
    apiKeySource: SettingSource;
    profileId: string;
    profileIdSource: SettingSource;
    timezone: string;
    timezoneSource: SettingSource;
    demoMode: DemoModeSetting;
  } = {
    apiKey: maskSecret(integration.zernioApiKey),
    apiKeyConfigured: Boolean(integration.zernioApiKey),
    apiKeySource: integration.zernioApiKeySource,
    profileId: integration.profileId ?? "",
    profileIdSource: integration.profileIdSource,
    timezone: integration.timezone,
    timezoneSource: integration.timezoneSource,
    demoMode: settings.zernio.demoMode,
  };

  const aiSection: MaskedSection & {
    provider: AiProviderId;
    openaiApiKey: string | null;
    openaiApiKeyConfigured: boolean;
    openaiApiKeySource: SettingSource;
    openaiModel: string;
    anthropicApiKey: string | null;
    anthropicApiKeyConfigured: boolean;
    anthropicApiKeySource: SettingSource;
    anthropicModel: string;
  } = {
    provider: ai.provider,
    openaiApiKey: maskSecret(ai.openaiApiKey),
    openaiApiKeyConfigured: Boolean(ai.openaiApiKey),
    openaiApiKeySource: ai.openaiApiKeySource,
    openaiModel: ai.openaiModel,
    anthropicApiKey: maskSecret(ai.anthropicApiKey),
    anthropicApiKeyConfigured: Boolean(ai.anthropicApiKey),
    anthropicApiKeySource: ai.anthropicApiKeySource,
    anthropicModel: ai.anthropicModel,
  };

  const transcriptionSection = {
    provider: transcription.provider,
    deepgramApiKey: maskSecret(transcription.deepgramApiKey),
    deepgramApiKeyConfigured: Boolean(transcription.deepgramApiKey),
    deepgramApiKeySource: transcription.deepgramApiKeySource,
  };

  return {
    zernio: zernioSection,
    ai: aiSection,
    transcription: transcriptionSection,
    runtime: {
      demoMode: isDemoMode(),
      aiReady: ai.ready,
      transcriptionReady: transcription.ready,
      dataDir: process.env.DATA_DIR?.trim() || ".data",
    },
    defaults: DEFAULT_SETTINGS,
  };
}

/** GET /api/settings — configuración actual con secretos enmascarados. */
export async function GET() {
  return NextResponse.json(buildStatusPayload());
}

/** PUT /api/settings — guarda credenciales y preferencias. */
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = writeSettings(parsed.data);

  return NextResponse.json({
    ...buildStatusPayload(),
    persisted: result.persisted,
    warning: result.error ?? null,
  });
}

/** POST /api/settings — prueba credenciales (guardadas o aún sin guardar). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.action === "test-ai") {
    const result = await testAiConnection({
      provider: parsed.data.provider as AiProviderId,
      apiKey: parsed.data.apiKey,
      model: parsed.data.model,
    });
    return NextResponse.json(result);
  }

  // Prueba de Zernio: se usan los valores enviados o, si vienen vacíos, los
  // ya configurados. Nunca se escribe nada.
  const integration = getIntegrationConfig();
  const apiKey = parsed.data.apiKey?.trim() || integration.zernioApiKey;
  const profileId = parsed.data.profileId?.trim() || integration.profileId;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      message: "Introduce una API key de Zernio para probar la conexión.",
    });
  }

  const startedAt = Date.now();

  try {
    const { accounts } = await zernioFetch<{ accounts: ZernioAccount[] }>(
      "/accounts",
      { apiKey, query: { profileId }, signal: AbortSignal.timeout(20_000) },
    );

    const list = accounts ?? [];
    const filtered = profileId
      ? list.filter((account) => account.profileId === profileId)
      : list;

    return NextResponse.json({
      ok: true,
      message:
        filtered.length > 0
          ? `Conexión correcta. ${filtered.length} cuenta${filtered.length === 1 ? "" : "s"} disponible${filtered.length === 1 ? "" : "s"}.`
          : "La clave es válida, pero no hay cuentas conectadas. Conecta una cuenta en el panel de Zernio para empezar a leer analíticas.",
      latencyMs: Date.now() - startedAt,
      accountCount: filtered.length,
      accounts: filtered.slice(0, 8).map((account) => ({
        id: account._id,
        platform: account.platform,
        username: account.username,
        isActive: account.isActive,
      })),
      hint:
        filtered.length === 0
          ? "Zernio exige al menos una cuenta conectada para servir analíticas."
          : null,
    });
  } catch (error) {
    const zernioError = error instanceof ZernioError ? error : null;

    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: zernioError
        ? describeZernioError(zernioError)
        : error instanceof Error
          ? error.message
          : "No se pudo conectar con Zernio.",
      code: zernioError?.code ?? null,
      status: zernioError?.status ?? null,
    });
  }
}

function describeZernioError(error: ZernioError): string {
  switch (error.status) {
    case 401:
      return "La API key no es válida o fue revocada. Genera una nueva en zernio.com/dashboard/api-keys.";
    case 402:
      return "Zernio requiere un método de pago para esta operación. Añade una tarjeta en tu dashboard.";
    case 403:
      return "La clave no tiene permisos sobre este perfil. Revisa el ámbito de la API key.";
    case 429:
      return "Demasiadas peticiones. Espera unos segundos y vuelve a probar.";
    default:
      return error.message;
  }
}
