"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Bot,
  Film,
  ListPlus,
  Loader2,
  Save,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
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
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_DRAFT,
  clearScriptDraft,
  readScriptDraft,
  writeScriptDraft,
} from "@/lib/client/script-draft";
import { classifyHook } from "@/lib/domain/hook-engine";
import { HOOK_PATTERNS, PATTERN_BY_ID } from "@/lib/domain/hook-patterns";
import {
  NICHE_LABELS,
  NICHES,
  type Niche,
  type ScriptDraft,
} from "@/lib/domain/types";

export function ScriptStudio({
  hookSuggestions,
  aiLabel,
  aiReady,
}: {
  hookSuggestions: HookOption[];
  /** Etiqueta legible del proveedor de IA activo, p. ej. "OpenAI · gpt-4o-mini". */
  aiLabel: string;
  /** false cuando el proveedor elegido no tiene credencial utilizable. */
  aiReady: boolean;
}) {
  const [draft, setDraft] = React.useState<ScriptDraft>(EMPTY_DRAFT);
  const [generating, setGenerating] = React.useState(false);
  const [generatingScript, setGeneratingScript] = React.useState(false);
  const [generatingHooks, setGeneratingHooks] = React.useState(false);
  const [variants, setVariants] = React.useState<HookVariant[]>([]);

  React.useEffect(() => {
    setDraft(readScriptDraft());
  }, []);

  function update<K extends keyof ScriptDraft>(key: K, value: ScriptDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    writeScriptDraft(draft);
    toast.success("Borrador guardado");
  }

  function clear() {
    clearScriptDraft();
    setDraft(EMPTY_DRAFT);
    toast.info("Borrador vaciado");
  }

  async function generateCaption() {
    if (draft.hookText.trim().length < 4) {
      toast.error("Escribe primero el hook");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: draft.hookText.trim(),
          angle: draft.angle.trim() || "Tutorial paso a paso",
          niche: draft.niche,
          platforms: [draft.platform],
        }),
      });

      if (!response.ok) throw new Error("No se pudo generar la caption");
      const payload = (await response.json()) as {
        variants: Array<{ full: string }>;
      };
      const caption = payload.variants[0]?.full ?? "";
      const next = { ...draft, caption };
      setDraft(next);
      writeScriptDraft(next);
      toast.success("Caption generada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setGenerating(false);
    }
  }

  async function generateFullScript() {
    if (draft.hookText.trim().length < 4) {
      toast.error("Escribe primero el hook");
      return;
    }

    setGeneratingScript(true);
    try {
      const response = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: draft.hookText.trim(),
          angle: draft.angle.trim() || "Tutorial paso a paso",
          niche: draft.niche,
          platform: draft.platform,
          notes: draft.body.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error("No se pudo generar el guion");

      const payload = (await response.json()) as {
        hook: string;
        beats: string[];
        cta: string;
        caption: string;
        hashtags: string[];
        source: string;
        note?: string;
      };

      const body = [...payload.beats.map((beat, index) => `${index + 1}. ${beat}`), "", payload.cta]
        .join("\n")
        .trim();

      const caption = payload.caption
        ? `${payload.caption}\n\n${payload.hashtags.map((tag) => `#${tag}`).join(" ")}`.trim()
        : draft.caption;

      const next: ScriptDraft = {
        ...draft,
        hookText: payload.hook || draft.hookText,
        body,
        caption,
      };

      setDraft(next);
      writeScriptDraft(next);

      toast.success("Guion generado", {
        description:
          payload.source === "fallback"
            ? payload.note ?? "Se usó el generador heurístico."
            : `Generado con ${payload.source}.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setGeneratingScript(false);
    }
  }

  async function generateVariants() {
    if (draft.hookText.trim().length < 4) {
      toast.error("Escribe primero el hook de referencia");
      return;
    }

    setGeneratingHooks(true);
    try {
      const response = await fetch("/api/ai/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base: draft.hookText.trim(),
          niche: draft.niche,
          count: 5,
        }),
      });

      if (!response.ok) throw new Error("No se pudieron generar las variaciones");

      const payload = (await response.json()) as {
        variants: HookVariant[];
        source: string;
        note?: string;
      };

      setVariants(payload.variants);

      toast.success(`${payload.variants.length} variaciones listas`, {
        description:
          payload.source === "fallback"
            ? payload.note ?? "Se usó el generador heurístico."
            : `Generadas con ${payload.source}.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setGeneratingHooks(false);
    }
  }

  function sendToScheduler() {
    writeScriptDraft(draft);
    window.location.href = "/scheduler";
  }

  const classification = React.useMemo(
    () => (draft.hookText.trim().length >= 4 ? classifyHook(draft.hookText) : null),
    [draft.hookText],
  );
  const pattern = classification
    ? PATTERN_BY_ID.get(classification.patternId)
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-4 w-4 text-primary" />
              Guion
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={aiReady ? "default" : "muted"}
                className="hidden font-normal sm:inline-flex"
                title={
                  aiReady
                    ? "Proveedor de IA activo"
                    : "Configura una API key en Ajustes; se usará el generador heurístico"
                }
              >
                <Bot className="mr-1 h-3 w-3" />
                {aiLabel}
              </Badge>
              <Button variant="ghost" size="sm" onClick={clear}>
                <Trash2 className="h-3.5 w-3.5" />
                Vaciar
              </Button>
              <Button variant="outline" size="sm" onClick={save}>
                <Save className="h-3.5 w-3.5" />
                Guardar
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hook">Hook</Label>
              <Textarea
                id="hook"
                value={draft.hookText}
                onChange={(event) => update("hookText", event.target.value)}
                rows={2}
                placeholder="Los hooks que elijas en la Biblioteca aparecen aquí automáticamente"
              />
            </div>

            {pattern ? (
              <div className="rounded-md border border-primary/25 bg-primary/[0.07] p-3">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                  <Wand2 className="h-3.5 w-3.5" />
                  Plantilla · {pattern.name} ({Math.round((classification?.confidence ?? 0) * 100)}%)
                </p>
                <p className="mt-1 font-mono text-sm">{pattern.template}</p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="body">Desarrollo del guion</Label>
              <Textarea
                id="body"
                value={draft.body}
                onChange={(event) => update("body", event.target.value)}
                rows={6}
                placeholder={"1. Contexto\n2. Desarrollo\n3. Cierre con CTA"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="angle">Ángulo de contenido</Label>
                <Input
                  id="angle"
                  value={draft.angle}
                  onChange={(event) => update("angle", event.target.value)}
                  placeholder="Error común y cómo evitarlo"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Plataforma objetivo</Label>
                <Select
                  value={draft.platform}
                  onValueChange={(value) => update("platform", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["instagram", "tiktok", "youtube", "facebook", "threads", "linkedin", "twitter"].map(
                      (platform) => (
                        <SelectItem key={platform} value={platform}>
                          {platform}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nicho</Label>
              <Select
                value={draft.niche}
                onValueChange={(value) => update("niche", value as Niche)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NICHES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {NICHE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={draft.caption}
                onChange={(event) => update("caption", event.target.value)}
                rows={5}
                placeholder="Genera la caption a partir del hook y el ángulo, o escríbela a mano."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={generateFullScript}
                disabled={generatingScript}
              >
                {generatingScript ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                {generatingScript ? "Escribiendo guion…" : "Generar guion con IA"}
              </Button>
              <Button
                onClick={generateVariants}
                disabled={generatingHooks}
                variant="outline"
              >
                {generatingHooks ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ListPlus className="h-4 w-4" />
                )}
                {generatingHooks ? "Generando…" : "Variaciones de hook"}
              </Button>
              <Button onClick={generateCaption} disabled={generating} variant="secondary">
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Generando…" : "Generar caption"}
              </Button>
              <Button onClick={sendToScheduler}>
                <Send className="h-4 w-4" />
                Enviar al Programador
              </Button>
            </div>

            {variants.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Variaciones propuestas
                </p>
                {variants.map((variant) => (
                  <button
                    key={variant.text}
                    onClick={() => {
                      const next = { ...draft, hookText: variant.text };
                      setDraft(next);
                      writeScriptDraft(next);
                      toast.success("Hook aplicado al guion");
                    }}
                    className="w-full rounded-md border border-border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <p className="text-sm">{variant.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-mono text-primary">{variant.pattern}</span>
                      {" · "}
                      {variant.rationale}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              Hooks de referencia
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Los mejores hooks de tu biblioteca, listos para traer al guion.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {hookSuggestions.length === 0 ? (
              <EmptyState
                icon={Film}
                title="Sin hooks guardados"
                description="Guarda hooks desde la Biblioteca o desde el Seguimiento de competidores."
              />
            ) : (
              hookSuggestions.map((hook) => (
                <button
                  key={hook.id}
                  onClick={() => {
                    const next = {
                      ...draft,
                      hookId: hook.id,
                      hookText: hook.text,
                      niche: hook.niche,
                    };
                    setDraft(next);
                    writeScriptDraft(next);
                    toast.success("Hook cargado en el guion");
                  }}
                  className="w-full rounded-md border border-border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <p className="text-sm">«{hook.text}»</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{hook.creatorHandle}</span>
                    <Badge variant="muted" className="ml-auto">
                      {hook.viewsLabel}
                    </Badge>
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Plantillas disponibles</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[320px] space-y-2 overflow-y-auto">
            {HOOK_PATTERNS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  const next = { ...draft, hookText: item.example };
                  setDraft(next);
                  writeScriptDraft(next);
                }}
                className="w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/40"
              >
                <p className="font-mono text-xs text-primary">{item.template}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.name}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export interface HookOption {
  id: string;
  text: string;
  niche: Niche;
  creatorHandle: string;
  viewsLabel: string;
}

/** Variación de hook devuelta por /api/ai/hooks. */
export interface HookVariant {
  text: string;
  pattern: string;
  rationale: string;
}
