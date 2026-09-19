"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Save,
  Sparkles,
  Waves,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SettingSource = "file" | "env" | "unset";
type AiProviderId = "heuristic" | "openai" | "anthropic";
type TranscriptionProviderId = "mock" | "openai" | "deepgram";

interface SettingsPayload {
  zernio: {
    apiKey: string | null;
    apiKeyConfigured: boolean;
    apiKeySource: SettingSource;
    profileId: string;
    profileIdSource: SettingSource;
    timezone: string;
    timezoneSource: SettingSource;
    demoMode: "auto" | "on" | "off";
  };
  ai: {
    provider: AiProviderId;
    openaiApiKey: string | null;
    openaiApiKeyConfigured: boolean;
    openaiApiKeySource: SettingSource;
    openaiModel: string;
    anthropicApiKey: string | null;
    anthropicApiKeyConfigured: boolean;
    anthropicApiKeySource: SettingSource;
    anthropicModel: string;
  };
  transcription: {
    provider: TranscriptionProviderId;
    deepgramApiKey: string | null;
    deepgramApiKeyConfigured: boolean;
    deepgramApiKeySource: SettingSource;
  };
  runtime: {
    demoMode: boolean;
    aiReady: boolean;
    transcriptionReady: boolean;
    dataDir: string;
  };
}

interface TestState {
  status: "idle" | "running" | "ok" | "error";
  message?: string;
  detail?: string[];
}

const TIMEZONES = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
];

function SourceBadge({ source }: { source: SettingSource }) {
  if (source === "file") {
    return (
      <Badge variant="default" className="font-normal">
        Guardado en el panel
      </Badge>
    );
  }
  if (source === "env") {
    return (
      <Badge variant="secondary" className="font-normal">
        Variable de entorno
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className="font-normal">
      Sin definir
    </Badge>
  );
}

function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  configured,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  configured: boolean;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={configured ? placeholder : "sk_..."}
        autoComplete="off"
        spellCheck={false}
        className="pr-10 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? "Ocultar" : "Mostrar"}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function TestResult({ state }: { state: TestState }) {
  if (state.status === "idle") return null;

  const tone =
    state.status === "ok"
      ? "border-success/40 bg-success/[0.07]"
      : state.status === "error"
        ? "border-destructive/40 bg-destructive/[0.07]"
        : "border-border bg-muted/40";

  return (
    <div className={cn("rounded-md border p-3 text-sm", tone)}>
      <p className="flex items-start gap-2">
        {state.status === "running" ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : state.status === "ok" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <span>{state.message ?? "Probando…"}</span>
      </p>

      {state.detail && state.detail.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {state.detail.map((item) => (
            <span
              key={item}
              className="rounded-full bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ConnectionsPanel() {
  const [settings, setSettings] = React.useState<SettingsPayload | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  // Campos editables (los secretos empiezan vacíos: sólo se envían si se
  // escriben, para no borrar una credencial existente sin querer).
  const [zernioKey, setZernioKey] = React.useState("");
  const [zernioProfile, setZernioProfile] = React.useState("");
  const [zernioTimezone, setZernioTimezone] = React.useState("");
  const [zernioDemo, setZernioDemo] = React.useState<"auto" | "on" | "off">("auto");
  const [zernioTest, setZernioTest] = React.useState<TestState>({ status: "idle" });

  const [aiProvider, setAiProvider] = React.useState<AiProviderId>("heuristic");
  const [openaiKey, setOpenaiKey] = React.useState("");
  const [openaiModel, setOpenaiModel] = React.useState("");
  const [anthropicKey, setAnthropicKey] = React.useState("");
  const [anthropicModel, setAnthropicModel] = React.useState("");
  const [aiTest, setAiTest] = React.useState<TestState>({ status: "idle" });

  const [trProvider, setTrProvider] =
    React.useState<TranscriptionProviderId>("mock");
  const [deepgramKey, setDeepgramKey] = React.useState("");
  const [trTest, setTrTest] = React.useState<TestState>({ status: "idle" });

  const load = React.useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) {
      toast.error("No se pudo leer la configuración");
      return;
    }
    const payload = (await response.json()) as SettingsPayload;
    setSettings(payload);
    setZernioProfile(payload.zernio.profileId);
    setZernioTimezone(payload.zernio.timezone);
    setZernioDemo(payload.zernio.demoMode);
    setAiProvider(payload.ai.provider);
    setOpenaiModel(payload.ai.openaiModel);
    setAnthropicModel(payload.ai.anthropicModel);
    setTrProvider(payload.transcription.provider);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save(
    section: "zernio" | "ai" | "transcription",
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setSaving(section);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [section]: body }),
      });

      const payload = (await response.json()) as SettingsPayload & {
        persisted?: boolean;
        warning?: string | null;
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar");

      setSettings(payload);
      toast.success(successMessage, {
        description: payload.persisted
          ? `Guardado en ${payload.runtime.dataDir}/settings.json`
          : payload.warning ?? undefined,
      });

      // Limpia los campos secretos: ya están persistidos y enmascarados.
      if (section === "zernio") setZernioKey("");
      if (section === "ai") {
        setOpenaiKey("");
        setAnthropicKey("");
      }
      if (section === "transcription") setDeepgramKey("");

      return payload;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
      return null;
    } finally {
      setSaving(null);
    }
  }

  async function testZernio() {
    setZernioTest({ status: "running", message: "Contactando con Zernio…" });
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-zernio",
          apiKey: zernioKey || undefined,
          profileId: zernioProfile || undefined,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message: string;
        accounts?: Array<{ platform: string; username?: string }>;
        latencyMs?: number;
        hint?: string | null;
      };

      setZernioTest({
        status: payload.ok ? "ok" : "error",
        message: payload.latencyMs
          ? `${payload.message} (${payload.latencyMs} ms)`
          : payload.message,
        detail: [
          ...(payload.accounts?.map(
            (account) => `${account.platform}${account.username ? ` · @${account.username}` : ""}`,
          ) ?? []),
          ...(payload.hint ? [payload.hint] : []),
        ],
      });
    } catch (error) {
      setZernioTest({
        status: "error",
        message: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  }

  async function testAi() {
    const provider = aiProvider;
    const apiKey =
      provider === "openai" ? openaiKey : provider === "anthropic" ? anthropicKey : undefined;
    const model = provider === "openai" ? openaiModel : anthropicModel;

    setAiTest({ status: "running", message: "Probando el modelo…" });
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-ai", provider, apiKey, model }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message: string;
        model?: string;
        latencyMs?: number;
        sample?: string;
      };

      setAiTest({
        status: payload.ok ? "ok" : "error",
        message: payload.ok
          ? `${payload.message}${payload.latencyMs ? ` (${payload.latencyMs} ms)` : ""}`
          : payload.message,
        detail: [payload.model ? `modelo: ${payload.model}` : "", payload.sample ?? ""].filter(
          Boolean,
        ),
      });
    } catch (error) {
      setAiTest({
        status: "error",
        message: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  }

  function testTranscription() {
    if (trProvider === "mock") {
      setTrTest({
        status: "ok",
        message:
          "El proveedor simulado funciona sin credenciales: genera transcripciones de ejemplo para la demo.",
      });
      return;
    }
    const configured =
      trProvider === "openai"
        ? Boolean(settings?.ai.openaiApiKeyConfigured || openaiKey)
        : Boolean(settings?.transcription.deepgramApiKeyConfigured || deepgramKey);

    setTrTest({
      status: configured ? "ok" : "error",
      message: configured
        ? trProvider === "openai"
          ? "Usará tu clave de OpenAI (Whisper) para transcribir."
          : "Usará tu clave de Deepgram para transcribir."
        : trProvider === "openai"
          ? "Falta la API key de OpenAI: configúrala en la tarjeta del modelo de IA."
          : "Introduce una API key de Deepgram y guarda para activarlo.",
    });
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estado global */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Badge variant={settings.runtime.demoMode ? "warning" : "success"}>
            {settings.runtime.demoMode ? "Modo demo activo" : "Datos en vivo"}
          </Badge>
          <Badge variant={settings.runtime.aiReady ? "success" : "muted"}>
            IA: {settings.ai.provider}
          </Badge>
          <Badge variant={settings.runtime.transcriptionReady ? "success" : "muted"}>
            Transcripción: {settings.transcription.provider}
          </Badge>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            {settings.runtime.dataDir}/settings.json
          </span>
        </CardContent>
      </Card>

      {/* Zernio */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-primary" />
            Conexión con Zernio
          </CardTitle>
          <div className="flex items-center gap-2">
            {settings.zernio.apiKeyConfigured ? (
              <Badge variant="success">Credencial presente</Badge>
            ) : (
              <Badge variant="warning">Sin credencial</Badge>
            )}
            <SourceBadge source={settings.zernio.apiKeySource} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Con la API key, el dashboard lee cuentas, publicaciones y analíticas
            reales (<span className="font-mono text-xs">GET /v1/accounts</span>,{" "}
            <span className="font-mono text-xs">GET /v1/analytics</span>) y publica
            con <span className="font-mono text-xs">POST /v1/posts</span>. Sin ella
            se muestran los datos semilla.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="zernio-key">API key</Label>
              <SecretInput
                id="zernio-key"
                value={zernioKey}
                onChange={setZernioKey}
                configured={settings.zernio.apiKeyConfigured}
                placeholder={settings.zernio.apiKey ?? "sk_…"}
              />
              <p className="text-xs text-muted-foreground">
                {settings.zernio.apiKeyConfigured
                  ? "Ya hay una clave configurada. Escribe otra para reemplazarla."
                  : "Créala en zernio.com/dashboard/api-keys. Formato sk_ seguido de 64 hex."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zernio-profile">
                Profile ID
                <SourceBadge source={settings.zernio.profileIdSource} />
              </Label>
              <Input
                id="zernio-profile"
                value={zernioProfile}
                onChange={(event) => setZernioProfile(event.target.value)}
                placeholder="66a1f0c2a4b9d3e8f1a2b3c4"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Zona horaria</Label>
              <Select value={zernioTimezone} onValueChange={setZernioTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Modo de datos</Label>
              <Select
                value={zernioDemo}
                onValueChange={(value) =>
                  setZernioDemo(value as "auto" | "on" | "off")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Automático (demo si no hay clave)
                  </SelectItem>
                  <SelectItem value="on">Forzar datos de demostración</SelectItem>
                  <SelectItem value="off">Forzar datos en vivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TestResult state={zernioTest} />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={testZernio}
              disabled={zernioTest.status === "running"}
            >
              {zernioTest.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              Probar conexión
            </Button>
            <Button
              onClick={() =>
                save(
                  "zernio",
                  {
                    ...(zernioKey ? { apiKey: zernioKey } : {}),
                    profileId: zernioProfile,
                    timezone: zernioTimezone,
                    demoMode: zernioDemo,
                  },
                  "Conexión de Zernio actualizada",
                )
              }
              disabled={saving === "zernio"}
            >
              {saving === "zernio" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modelo de IA */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            Modelo de IA
          </CardTitle>
          <Badge variant={settings.runtime.aiReady ? "success" : "muted"}>
            {settings.runtime.aiReady ? "Listo" : "Sin credencial"}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El modelo se usa para generar guiones, captions por plataforma,
            variaciones de hook y reescrituras. Con «heurístico» todo funciona sin
            claves, usando plantillas locales deterministas.
          </p>

          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <Select
              value={aiProvider}
              onValueChange={(value) => {
                setAiProvider(value as AiProviderId);
                setAiTest({ status: "idle" });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heuristic">
                  Heurístico local (sin coste)
                </SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {aiProvider === "openai" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="openai-key">
                  OpenAI API key
                  <SourceBadge source={settings.ai.openaiApiKeySource} />
                </Label>
                <SecretInput
                  id="openai-key"
                  value={openaiKey}
                  onChange={setOpenaiKey}
                  configured={settings.ai.openaiApiKeyConfigured}
                  placeholder={settings.ai.openaiApiKey ?? "sk-…"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="openai-model">Modelo</Label>
                <Input
                  id="openai-model"
                  value={openaiModel}
                  onChange={(event) => setOpenaiModel(event.target.value)}
                  placeholder="gpt-4o-mini"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ) : null}

          {aiProvider === "anthropic" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="anthropic-key">
                  Anthropic API key
                  <SourceBadge source={settings.ai.anthropicApiKeySource} />
                </Label>
                <SecretInput
                  id="anthropic-key"
                  value={anthropicKey}
                  onChange={setAnthropicKey}
                  configured={settings.ai.anthropicApiKeyConfigured}
                  placeholder={settings.ai.anthropicApiKey ?? "sk-ant-…"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="anthropic-model">Modelo</Label>
                <Input
                  id="anthropic-model"
                  value={anthropicModel}
                  onChange={(event) => setAnthropicModel(event.target.value)}
                  placeholder="claude-sonnet-4-5"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ) : null}

          {aiProvider === "heuristic" ? (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                El generador heurístico produce captions, guiones y variaciones con
                reglas locales: funciona sin internet y sin coste por token.
              </span>
            </div>
          ) : null}

          <TestResult state={aiTest} />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={testAi}
              disabled={aiTest.status === "running"}
            >
              {aiTest.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              Probar modelo
            </Button>
            <Button
              onClick={() =>
                save(
                  "ai",
                  {
                    provider: aiProvider,
                    ...(openaiKey ? { openaiApiKey: openaiKey } : {}),
                    openaiModel,
                    ...(anthropicKey ? { anthropicApiKey: anthropicKey } : {}),
                    anthropicModel,
                  },
                  "Modelo de IA actualizado",
                )
              }
              disabled={saving === "ai"}
            >
              {saving === "ai" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transcripción */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Waves className="h-4 w-4 text-primary" />
            Transcripción de audio
          </CardTitle>
          <Badge variant={settings.runtime.transcriptionReady ? "success" : "muted"}>
            {settings.transcription.provider}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se usa en el Seguimiento de competidores para convertir el audio de los
            Reels en el hook y el texto que alimentan tu Biblioteca.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select
                value={trProvider}
                onValueChange={(value) => {
                  setTrProvider(value as TranscriptionProviderId);
                  setTrTest({ status: "idle" });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Simulado (demo)</SelectItem>
                  <SelectItem value="openai">OpenAI Whisper</SelectItem>
                  <SelectItem value="deepgram">Deepgram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {trProvider === "deepgram" ? (
              <div className="space-y-1.5">
                <Label htmlFor="deepgram-key">
                  Deepgram API key
                  <SourceBadge source={settings.transcription.deepgramApiKeySource} />
                </Label>
                <SecretInput
                  id="deepgram-key"
                  value={deepgramKey}
                  onChange={setDeepgramKey}
                  configured={settings.transcription.deepgramApiKeyConfigured}
                  placeholder={settings.transcription.deepgramApiKey ?? "…"}
                />
              </div>
            ) : null}
          </div>

          {trProvider === "openai" ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/[0.07] p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                Whisper reutiliza la API key de OpenAI configurada en la tarjeta del
                modelo de IA.
              </span>
            </div>
          ) : null}

          <TestResult state={trTest} />

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={testTranscription}>
              <Waves className="h-4 w-4" />
              Comprobar
            </Button>
            <Button
              onClick={() =>
                save(
                  "transcription",
                  {
                    provider: trProvider,
                    ...(deepgramKey ? { deepgramApiKey: deepgramKey } : {}),
                  },
                  "Transcripción actualizada",
                )
              }
              disabled={saving === "transcription"}
            >
              {saving === "transcription" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <p className="text-xs text-muted-foreground">
        Las credenciales se guardan en {settings.runtime.dataDir}/settings.json con
        permisos 0600 y nunca se envían al navegador: la API devuelve sólo una
        versión enmascarada. En despliegues con disco efímero (por ejemplo Vercel)
        usa las variables de entorno de .env.example, que tienen prioridad cuando
        no hay valor guardado en el panel.
      </p>
    </div>
  );
}
