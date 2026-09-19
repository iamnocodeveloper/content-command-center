"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Bot,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

import { PlatformIcon, platformLabel } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { readScriptDraft, writeScriptDraft } from "@/lib/client/script-draft";
import { NICHES, NICHE_LABELS, type Niche } from "@/lib/domain/types";
import type { ZernioAccount } from "@/lib/zernio/types";
import { cn } from "@/lib/utils";

interface CaptionVariant {
  platform: string;
  caption: string;
  hashtags: string[];
  firstComment?: string;
  full: string;
  /** `true` cuando el texto salió del modelo de IA. */
  refined?: boolean;
}

export function Scheduler({
  accounts,
  defaultTimezone,
  demoSafe,
  aiLabel,
  aiReady,
}: {
  accounts: ZernioAccount[];
  defaultTimezone: string;
  demoSafe: boolean;
  /** Etiqueta del proveedor de IA activo (captions automáticas). */
  aiLabel: string;
  aiReady: boolean;
}) {
  const [content, setContent] = React.useState("");
  const [firstComment, setFirstComment] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [date, setDate] = React.useState(todayIso());
  const [time, setTime] = React.useState("18:00");
  const [timezone, setTimezone] = React.useState(defaultTimezone);
  const [angle, setAngle] = React.useState("");
  const [niche, setNiche] = React.useState<Niche>("marketing");
  const [variants, setVariants] = React.useState<CaptionVariant[]>([]);
  const [generating, setGenerating] = React.useState(false);
  const [rewriting, setRewriting] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{
    id: string;
    status: string;
    simulated: boolean;
  } | null>(null);

  // Precarga el hook que llega desde la Biblioteca, Tendencias o el Estudio de guiones.
  React.useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("hook");
    const draft = readScriptDraft();
    const incoming = fromQuery || draft.hookText;

    if (incoming) {
      setContent(incoming);
      if (draft.angle) setAngle(draft.angle);
      if (draft.caption) setFirstComment(draft.caption);
      setNiche(draft.niche);
    }
  }, []);

  const selectedAccounts = React.useMemo(
    () => accounts.filter((account) => selected.includes(account._id)),
    [accounts, selected],
  );

  function toggleAccount(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.length === accounts.length ? [] : accounts.map((a) => a._id),
    );
  }

  async function generate() {
    if (content.trim().length < 4) {
      toast.error("Escribe el hook o el contenido antes de generar captions");
      return;
    }
    if (selected.length === 0) {
      toast.error("Selecciona al menos una cuenta destino");
      return;
    }

    setGenerating(true);
    try {
      const platforms = [
        ...new Set(selectedAccounts.map((account) => account.platform)),
      ];
      const response = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: content.trim(),
          angle: angle.trim() || "Tutorial paso a paso",
          niche,
          platforms,
        }),
      });

      if (!response.ok) throw new Error("No se pudieron generar las captions");
      const payload = (await response.json()) as { variants: CaptionVariant[] };
      setVariants(payload.variants);

      // Guarda el progreso para que el Estudio de guiones lo conserve.
      const draft = readScriptDraft();
      writeScriptDraft({ ...draft, caption: payload.variants[0]?.full ?? "", angle, niche });

      toast.success(
        `${payload.variants.length} caption${payload.variants.length === 1 ? "" : "s"} generada${payload.variants.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setGenerating(false);
    }
  }

  /** Reescribe una caption concreta con el modelo configurado. */
  async function rewriteVariant(variant: CaptionVariant) {
    setRewriting(variant.platform);
    try {
      const response = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: variant.caption,
          platform: variant.platform,
          niche,
          hook: content.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error("No se pudo reescribir la caption");
      const payload = (await response.json()) as {
        text: string;
        source: string;
        note?: string;
      };

      setVariants((prev) =>
        prev.map((item) =>
          item.platform === variant.platform
            ? { ...item, caption: payload.text, refined: true }
            : item,
        ),
      );

      toast.success("Caption reescrita", {
        description:
          payload.source === "fallback"
            ? payload.note ?? "Se mantuvo el texto original."
            : `Reescrita con ${payload.source}.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setRewriting(null);
    }
  }

  async function submit(mode: "schedule" | "now" | "draft") {
    if (content.trim().length < 1) {
      toast.error("El contenido no puede estar vacío");
      return;
    }
    if (selected.length === 0) {
      toast.error("Selecciona al menos una cuenta destino");
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          firstComment: firstComment.trim() || undefined,
          platforms: selectedAccounts.map((account) => ({
            platform: account.platform,
            accountId: account._id,
          })),
          date: mode === "schedule" ? date : undefined,
          time: mode === "schedule" ? time : undefined,
          timezone,
          publishNow: mode === "now" || undefined,
          isDraft: mode === "draft" || undefined,
        }),
      });

      const payload = (await response.json()) as {
        post?: { _id: string; status: string };
        simulated?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.post) {
        throw new Error(payload.error ?? "No se pudo completar la operación");
      }

      setResult({
        id: payload.post._id,
        status: payload.post.status,
        simulated: Boolean(payload.simulated),
      });

      toast.success(
        mode === "now"
          ? "Publicado en todas las cuentas seleccionadas"
          : mode === "draft"
            ? "Guardado como borrador en Zernio"
            : "Programado correctamente",
        { description: `Post ${payload.post._id}` },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        {/* Compositor */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Contenido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="content">Hook y cuerpo del guion</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={6}
                placeholder="Deja de publicar todos los días en Instagram…"
              />
              <p className="text-xs text-muted-foreground">
                {content.length} caracteres · se envía tal cual a cada plataforma
                seleccionada.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="angle">Ángulo de contenido</Label>
                <Input
                  id="angle"
                  value={angle}
                  onChange={(event) => setAngle(event.target.value)}
                  placeholder="Error común y cómo evitarlo"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Nicho</Label>
                <Select
                  value={niche}
                  onValueChange={(value) => setNiche(value as Niche)}
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="first-comment">
                Primer comentario (opcional)
              </Label>
              <Textarea
                id="first-comment"
                value={firstComment}
                onChange={(event) => setFirstComment(event.target.value)}
                rows={2}
                placeholder="Te dejo la plantilla completa aquí 👇"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={generate} disabled={generating} variant="secondary">
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {generating ? "Generando…" : "Generar captions automáticas"}
              </Button>
              <Badge
                variant={aiReady ? "default" : "muted"}
                className="font-normal"
                title={
                  aiReady
                    ? "Las captions se refinan con este modelo"
                    : "Sin credencial de IA: se usan plantillas heurísticas"
                }
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {aiLabel}
              </Badge>
            </div>

            {!aiReady ? (
              <p className="text-xs text-muted-foreground">
                Estás con el generador heurístico. Conecta un modelo en{" "}
                <a href="/settings" className="text-primary underline-offset-2 hover:underline">
                  Ajustes
                </a>{" "}
                para que las captions se escriban con IA.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Captions generadas */}
        {variants.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Captions generadas
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVariants([])}
                aria-label="Descartar captions"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Descartar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {variants.map((variant) => (
                <div key={variant.platform} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={variant.platform} />
                      <span className="text-sm font-medium">
                        {platformLabel(variant.platform)}
                      </span>
                      {variant.refined ? (
                        <Badge variant="default" className="font-normal">
                          IA
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={rewriting === variant.platform}
                        onClick={() => rewriteVariant(variant)}
                      >
                        {rewriting === variant.platform ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Bot className="h-3.5 w-3.5" />
                        )}
                        Reescribir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setContent(variant.caption);
                          if (variant.firstComment) setFirstComment(variant.firstComment);
                          toast.success("Caption aplicada al contenido");
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aplicar
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {variant.caption}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {variant.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Panel de programación */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Cuentas destino</CardTitle>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selected.length === accounts.length ? "Ninguna" : "Todas"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {accounts.map((account) => (
              <label
                key={account._id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60",
                  selected.includes(account._id) && "bg-primary/10",
                )}
              >
                <Checkbox
                  checked={selected.includes(account._id)}
                  onCheckedChange={() => toggleAccount(account._id)}
                />
                <PlatformIcon platform={account.platform} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {platformLabel(account.platform)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{account.username}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Programación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Zona horaria</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "America/Mexico_City",
                    "America/Bogota",
                    "America/Argentina/Buenos_Aires",
                    "America/New_York",
                    "Europe/Madrid",
                  ].map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => submit("schedule")}
                disabled={submitting}
              >
                <CalendarClock className="h-4 w-4" />
                Programar en {selected.length || 0} cuenta
                {selected.length === 1 ? "" : "s"}
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => submit("now")}
                disabled={submitting}
              >
                <Send className="h-4 w-4" />
                Publicar ahora
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => submit("draft")}
                disabled={submitting}
              >
                <Clock className="h-4 w-4" />
                Guardar como borrador
              </Button>
            </div>

            {result ? (
              <div className="rounded-md border border-primary/25 bg-primary/[0.07] p-3 text-xs">
                <p className="font-medium text-primary">Post {result.status}</p>
                <p className="mt-0.5 break-all text-muted-foreground">{result.id}</p>
                {result.simulated ? (
                  <p className="mt-1 text-muted-foreground">
                    Modo demo: no se ha llamado a Zernio.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
            <p>
              La publicación es multiplataforma con un solo clic: un único request a
              <span className="font-mono"> POST /v1/posts</span> con una entrada por
              cuenta.
            </p>
            <p>
              Se envía <span className="font-mono">x-request-id</span> para que un
              reintento devuelva el mismo post en lugar de duplicarlo.
            </p>
            {demoSafe ? (
              <Badge variant="warning">Sin credenciales: los envíos se simulan</Badge>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}
