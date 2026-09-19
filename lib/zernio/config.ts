import {
  readSettings,
  resolveValue,
  type AiProviderId,
  type SettingSource,
  type TranscriptionProviderId,
} from "@/lib/server/settings-store";

/**
 * Configuración resuelta de las integraciones.
 *
 * Orden de precedencia: valor guardado desde /settings  >  variable de entorno
 * > valor por defecto. La procedencia (`source`) se expone para que la UI pueda
 * decir de dónde sale cada credencial.
 *
 * Importante: este módulo sólo debe usarse en el servidor. Ningún componente
 * cliente lo importa, porque arrastra `node:fs` a través de settings-store.
 */

export const ZERNIO_BASE_URL =
  process.env.ZERNIO_BASE_URL?.replace(/\/$/, "") ?? "https://zernio.com/api/v1";

export interface IntegrationConfig {
  zernioApiKey?: string;
  zernioApiKeySource: SettingSource;
  profileId?: string;
  profileIdSource: SettingSource;
  timezone: string;
  timezoneSource: SettingSource;
  demoMode: "auto" | "on" | "off";
}

export interface AiConfig {
  provider: AiProviderId;
  openaiApiKey?: string;
  openaiApiKeySource: SettingSource;
  openaiModel: string;
  anthropicApiKey?: string;
  anthropicApiKeySource: SettingSource;
  anthropicModel: string;
  /** true cuando el proveedor elegido tiene credencial utilizable. */
  ready: boolean;
}

export interface TranscriptionConfig {
  provider: TranscriptionProviderId;
  deepgramApiKey?: string;
  deepgramApiKeySource: SettingSource;
  ready: boolean;
}

/** Resolución completa, cacheada en el módulo por el store subyacente. */
export function getIntegrationConfig(): IntegrationConfig {
  const settings = readSettings();

  const apiKey = resolveValue(settings.zernio.apiKey, process.env.ZERNIO_API_KEY);
  const profileId = resolveValue(
    settings.zernio.profileId,
    process.env.ZERNIO_PROFILE_ID,
  );
  const timezone = resolveValue(
    settings.zernio.timezone,
    process.env.ZERNIO_DEFAULT_TIMEZONE,
  );

  return {
    zernioApiKey: apiKey.value,
    zernioApiKeySource: apiKey.source,
    profileId: profileId.value,
    profileIdSource: profileId.source,
    timezone: timezone.value ?? "America/Mexico_City",
    timezoneSource: timezone.source,
    demoMode: settings.zernio.demoMode,
  };
}

export function getAiConfig(): AiConfig {
  const settings = readSettings();

  const openaiKey = resolveValue(
    settings.ai.openaiApiKey,
    process.env.OPENAI_API_KEY,
  );
  const anthropicKey = resolveValue(
    settings.ai.anthropicApiKey,
    process.env.ANTHROPIC_API_KEY,
  );

  const provider = settings.ai.provider;
  const ready =
    provider === "heuristic"
      ? true
      : provider === "openai"
        ? Boolean(openaiKey.value)
        : Boolean(anthropicKey.value);

  return {
    provider,
    openaiApiKey: openaiKey.value,
    openaiApiKeySource: openaiKey.source,
    openaiModel:
      settings.ai.openaiModel ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini",
    anthropicApiKey: anthropicKey.value,
    anthropicApiKeySource: anthropicKey.source,
    anthropicModel:
      settings.ai.anthropicModel ||
      process.env.ANTHROPIC_MODEL ||
      "claude-sonnet-4-5",
    ready,
  };
}

export function getTranscriptionConfig(): TranscriptionConfig {
  const settings = readSettings();
  const deepgramKey = resolveValue(
    settings.transcription.deepgramApiKey,
    process.env.DEEPGRAM_API_KEY,
  );
  const openaiKey = resolveValue(
    settings.ai.openaiApiKey,
    process.env.OPENAI_API_KEY,
  );

  const provider = settings.transcription.provider;
  const ready =
    provider === "mock"
      ? true
      : provider === "openai"
        ? Boolean(openaiKey.value)
        : Boolean(deepgramKey.value);

  return {
    provider,
    deepgramApiKey: deepgramKey.value,
    deepgramApiKeySource: deepgramKey.source,
    ready,
  };
}

// ---------------------------------------------------------------------------
// Accesores de conveniencia (firma síncrona heredada)
// ---------------------------------------------------------------------------

export function getZernioApiKey(): string | undefined {
  return getIntegrationConfig().zernioApiKey;
}

export function getProfileId(): string | undefined {
  return getIntegrationConfig().profileId;
}

export function getDefaultTimezone(): string {
  return getIntegrationConfig().timezone;
}

/**
 * El modo demo se controla desde /settings (auto | on | off). En `auto` se
 * activa cuando no hay clave de Zernio, para que el dashboard siempre sea
 * navegable.
 */
export function isDemoMode(): boolean {
  const config = getIntegrationConfig();
  if (config.demoMode === "off") return false;
  if (config.demoMode === "on") return true;
  return !config.zernioApiKey;
}

export type CaptionProvider = AiProviderId;
export type TranscriptionProvider = TranscriptionProviderId;

export function getCaptionProvider(): CaptionProvider {
  return getAiConfig().provider;
}

export function getTranscriptionProvider(): TranscriptionProvider {
  return getTranscriptionConfig().provider;
}
