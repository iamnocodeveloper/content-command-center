"use client";

/* eslint-disable @next/next/no-img-element -- Vistas previas locales (data/object URLs) y remotas. */

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  CalendarClock,
  Check,
  Clock,
  Film,
  Images,
  ImageIcon,
  Link2,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Upload,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { loadProject } from "@/lib/client/carousel-storage";
import { contentTypeFor, dataUrlToBlob, uploadMediaBlob } from "@/lib/client/media-upload";
import { readScriptDraft, writeScriptDraft } from "@/lib/client/script-draft";
import { NICHES, NICHE_LABELS, type Niche } from "@/lib/domain/types";
import {
  MEDIA_ACCEPT,
  defaultFormatFor,
  findFormat,
  formatOptionsFor,
  guessMediaType,
  isImageOnly,
  validateFormat,
} from "@/lib/zernio/formats";
import type {
  MediaItem,
  MediaType,
  TikTokCreatorInfoResponse,
  ZernioAccount,
  ZernioPost,
} from "@/lib/zernio/types";
import { cn } from "@/lib/utils";

const MAX_MEDIA = 10;

const DEFAULT_TIKTOK_PRIVACY = [
  { value: "PUBLIC_TO_EVERYONE", label: "Público" },
  { value: "MUTUAL_FOLLOW_FRIENDS", label: "Amigos mutuos" },
  { value: "FOLLOWER_OF_CREATOR", label: "Seguidores" },
  { value: "SELF_ONLY", label: "Solo yo" },
];

interface CaptionVariant {
  platform: string;
  caption: string;
  hashtags: string[];
  firstComment?: string;
  full: string;
  /** `true` cuando el texto salió del modelo de IA. */
  refined?: boolean;
}

interface MediaDraft {
  id: string;
  source: "file" | "dataurl" | "url";
  name: string;
  type: MediaType;
  preview: string;
  file?: File;
  dataUrl?: string;
  url?: string;
  status: "ready" | "uploading" | "uploaded" | "error";
  percent?: number;
  publicUrl?: string;
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
    failures: string[];
  } | null>(null);

  const [media, setMedia] = React.useState<MediaDraft[]>([]);
  const [formats, setFormats] = React.useState<Record<string, string>>({});
  const [urlDraft, setUrlDraft] = React.useState("");
  const [tiktok, setTiktok] = React.useState({
    privacy: "PUBLIC_TO_EVERYONE",
    allowComment: true,
    allowDuet: true,
    allowStitch: true,
    description: "",
  });
  const [tiktokInfo, setTiktokInfo] =
    React.useState<TikTokCreatorInfoResponse | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

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

  const tiktokAccount = selectedAccounts.find(
    (account) => account.platform === "tiktok",
  );

  React.useEffect(() => {
    if (!tiktokAccount) return;
    let active = true;
    fetch(
      `/api/tiktok/creator-info?accountId=${encodeURIComponent(tiktokAccount._id)}`,
    )
      .then((response) => response.json())
      .then((data: TikTokCreatorInfoResponse) => {
        if (active && data?.privacyLevels?.length) setTiktokInfo(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [tiktokAccount]);

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

  function currentFormat(account: ZernioAccount): string | undefined {
    return formats[account._id] ?? defaultFormatFor(account.platform);
  }

  // --- Media -----------------------------------------------------------------

  function addDrafts(items: Omit<MediaDraft, "id" | "status">[]) {
    setMedia((prev) => {
      const room = MAX_MEDIA - prev.length;
      if (room <= 0) {
        toast.error(`Puedes adjuntar hasta ${MAX_MEDIA} elementos.`);
        return prev;
      }
      const accepted = items.slice(0, room);
      if (items.length > room) {
        toast.info(
          `Se añadieron ${accepted.length} de ${items.length} elementos (máximo ${MAX_MEDIA}).`,
        );
      }
      return [
        ...prev,
        ...accepted.map((item) => ({
          ...item,
          id: crypto.randomUUID(),
          status: "ready" as const,
        })),
      ];
    });
  }

  function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    addDrafts(
      files.map((file) => ({
        source: "file" as const,
        name: file.name,
        type: guessMediaType(file.type, file.name),
        file,
        preview: URL.createObjectURL(file),
      })),
    );
  }

  function onAddUrl() {
    const value = urlDraft.trim();
    if (!/^https?:\/\//i.test(value)) {
      toast.error("Introduce una URL pública que empiece por http(s)://");
      return;
    }
    const filename = value.split("/").pop()?.split("?")[0] ?? "archivo";
    addDrafts([
      {
        source: "url",
        name: filename,
        type: guessMediaType("", filename),
        url: value,
        preview: value,
      },
    ]);
    setUrlDraft("");
  }

  async function addStudioSlides() {
    try {
      const project = await loadProject();
      if (!project || project.images.length === 0) {
        toast.error("El estudio de Carruseles todavía no tiene láminas generadas.");
        return;
      }
      const slides = [...project.images].sort((a, b) => a.index - b.index);
      addDrafts(
        slides.map((image) => ({
          source: "dataurl" as const,
          name: `Lámina ${image.index + 1}`,
          type: "image" as const,
          dataUrl: image.data,
          preview: image.data,
        })),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron leer las láminas del estudio.",
      );
    }
  }

  function updateMedia(id: string, patch: Partial<MediaDraft>) {
    setMedia((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeMedia(id: string) {
    setMedia((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item?.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
      return prev.filter((entry) => entry.id !== id);
    });
  }

  function moveMedia(index: number, direction: number) {
    setMedia((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function resolveMediaItems(items: MediaDraft[]): Promise<MediaItem[]> {
    const resolved: MediaItem[] = [];
    for (const item of items) {
      if (item.source === "url" && item.url) {
        resolved.push({ url: item.url, type: item.type });
        continue;
      }
      if (item.status === "uploaded" && item.publicUrl) {
        resolved.push({ url: item.publicUrl, type: item.type });
        continue;
      }
      const blob =
        item.file ?? (item.dataUrl ? dataUrlToBlob(item.dataUrl) : null);
      if (!blob) throw new Error(`No se pudo leer «${item.name}».`);
      const filename =
        item.file?.name ??
        `${item.name.replace(/\s+/g, "-").toLowerCase()}.png`;
      const contentType = contentTypeFor(
        filename,
        item.file?.type ?? (item.source === "dataurl" ? "image/png" : undefined),
      );
      updateMedia(item.id, { status: "uploading", percent: 0 });
      const uploaded = await uploadMediaBlob({
        filename,
        contentType,
        size: item.file?.size,
        body: blob,
        onProgress: (percent) =>
          updateMedia(item.id, { percent, status: "uploading" }),
      });
      updateMedia(item.id, {
        status: "uploaded",
        percent: 100,
        publicUrl: uploaded.publicUrl,
      });
      resolved.push({ url: uploaded.publicUrl, type: item.type });
    }
    return resolved;
  }

  function buildTiktokSettings(mediaTypes: MediaType[]): Record<string, unknown> {
    const settings: Record<string, unknown> = {
      privacy_level: tiktok.privacy,
      allow_comment: tiktok.allowComment,
      content_preview_confirmed: true,
      express_consent_given: true,
    };
    if (isImageOnly(mediaTypes)) {
      settings.media_type = "photo";
      if (tiktok.description.trim()) settings.description = tiktok.description.trim();
    } else {
      settings.allow_duet = tiktok.allowDuet;
      settings.allow_stitch = tiktok.allowStitch;
    }
    return settings;
  }

  // --- Captions ---------------------------------------------------------------

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

  // --- Envío ------------------------------------------------------------------

  async function submit(mode: "schedule" | "now" | "draft") {
    if (!content.trim() && media.length === 0) {
      toast.error("Escribe el contenido o adjunta un archivo multimedia");
      return;
    }
    if (selected.length === 0) {
      toast.error("Selecciona al menos una cuenta destino");
      return;
    }

    const mediaTypes = media.map((item) => item.type);
    for (const account of selectedAccounts) {
      const option = findFormat(account.platform, currentFormat(account));
      if (!option) continue;
      const problem = validateFormat(option, mediaTypes);
      if (problem) {
        toast.error(`${platformLabel(account.platform)}: ${problem}`);
        return;
      }
    }

    setSubmitting(true);
    setResult(null);
    try {
      const mediaItems = await resolveMediaItems(media);

      const platformsPayload = selectedAccounts.map((account) => {
        const option = findFormat(account.platform, currentFormat(account));
        const platformSpecificData: Record<string, unknown> = {};
        if (option?.contentType) platformSpecificData.contentType = option.contentType;
        return {
          platform: account.platform,
          accountId: account._id,
          ...(Object.keys(platformSpecificData).length ? { platformSpecificData } : {}),
        };
      });

      const tiktokSettings = tiktokAccount ? buildTiktokSettings(mediaTypes) : undefined;

      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          firstComment: firstComment.trim() || undefined,
          mediaItems: mediaItems.length ? mediaItems : undefined,
          platforms: platformsPayload,
          timezone,
          tiktokSettings,
          date: mode === "schedule" ? date : undefined,
          time: mode === "schedule" ? time : undefined,
          publishNow: mode === "now" || undefined,
          isDraft: mode === "draft" || undefined,
        }),
      });

      const payload = (await response.json()) as {
        post?: ZernioPost;
        simulated?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.post) {
        throw new Error(payload.error ?? "No se pudo completar la operación");
      }

      const failures = payload.post.platforms
        .filter((entry) => entry.errorMessage || entry.status === "failed")
        .map(
          (entry) =>
            `${platformLabel(entry.platform)}: ${entry.errorMessage ?? entry.status}`,
        );

      setResult({
        id: payload.post._id,
        status: payload.post.status,
        simulated: Boolean(payload.simulated),
        failures,
      });

      if (failures.length || ["failed", "partial"].includes(payload.post.status)) {
        toast.warning("Publicación con incidencias", {
          description: failures.join(" · ") || "Revisa el detalle del post.",
        });
      } else {
        toast.success(
          mode === "now"
            ? "Publicado en todas las cuentas seleccionadas"
            : mode === "draft"
              ? "Guardado como borrador en Zernio"
              : "Programado correctamente",
          { description: `Post ${payload.post._id}` },
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  const privacyOptions =
    tiktokInfo?.privacyLevels?.length ? tiktokInfo.privacyLevels : DEFAULT_TIKTOK_PRIVACY;

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

        {/* Media */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-primary" />
              Imagen o vídeo
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {media.length} / {MAX_MEDIA}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={demoSafe || media.length >= MAX_MEDIA}
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Subir archivos
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={media.length >= MAX_MEDIA}
                onClick={() => void addStudioSlides()}
              >
                <Images className="h-4 w-4" />
                Usar láminas del estudio
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept={MEDIA_ACCEPT}
                multiple
                className="hidden"
                onChange={onFiles}
              />
            </div>

            {demoSafe ? (
              <p className="text-xs text-muted-foreground">
                Sin credencial de Zernio no se pueden subir archivos; puedes
                adjuntar URLs públicas.
              </p>
            ) : null}

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="media-url">Añadir por URL pública</Label>
                <Input
                  id="media-url"
                  value={urlDraft}
                  onChange={(event) => setUrlDraft(event.target.value)}
                  placeholder="https://…/imagen.jpg o vídeo.mp4"
                  disabled={media.length >= MAX_MEDIA}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={media.length >= MAX_MEDIA || !urlDraft.trim()}
                onClick={onAddUrl}
              >
                <Link2 className="h-4 w-4" />
                Añadir
              </Button>
            </div>

            {media.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {media.map((item, index) => (
                  <div key={item.id} className="space-y-2 rounded-lg border p-2">
                    <div className="flex h-28 items-center justify-center overflow-hidden rounded bg-muted">
                      {item.type === "video" ? (
                        <video
                          src={item.preview}
                          className="h-full w-full object-contain"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={item.preview}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="min-w-0 flex-1 truncate text-xs" title={item.name}>
                        {index + 1}. {item.name}
                      </p>
                      <Badge variant="muted" className="font-normal">
                        {item.type === "video" ? (
                          <Film className="mr-1 h-3 w-3" />
                        ) : (
                          <ImageIcon className="mr-1 h-3 w-3" />
                        )}
                        {item.type}
                      </Badge>
                    </div>
                    {item.status === "uploading" ? (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${item.percent ?? 0}%` }}
                        />
                      </div>
                    ) : null}
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        aria-label={`Mover ${item.name} antes`}
                        onClick={() => moveMedia(index, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === media.length - 1}
                        aria-label={`Mover ${item.name} después`}
                        onClick={() => moveMedia(index, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar ${item.name}`}
                        onClick={() => removeMedia(item.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin archivos el post es solo texto (no válido en Instagram, TikTok
                ni YouTube).
              </p>
            )}
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
            {accounts.map((account) => {
              const isSelected = selected.includes(account._id);
              const options = formatOptionsFor(account.platform);
              const activeFormat = findFormat(
                account.platform,
                currentFormat(account),
              );
              return (
                <div
                  key={account._id}
                  className={cn(
                    "rounded-md transition-colors",
                    isSelected && "bg-primary/10",
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                    <Checkbox
                      checked={isSelected}
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
                  {isSelected && options.length > 0 ? (
                    <div className="space-y-1 px-2 pb-2 pl-9">
                      <Select
                        value={currentFormat(account)}
                        onValueChange={(value) =>
                          setFormats((prev) => ({ ...prev, [account._id]: value }))
                        }
                      >
                        <SelectTrigger className="h-8" aria-label="Formato">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {activeFormat?.hint ? (
                        <p className="text-[11px] text-muted-foreground">
                          {activeFormat.hint}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {tiktokAccount ? (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <PlatformIcon platform="tiktok" />
                Ajustes de TikTok
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Privacidad</Label>
                <Select
                  value={tiktok.privacy}
                  onValueChange={(value) =>
                    setTiktok((prev) => ({ ...prev, privacy: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {privacyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tt-comment" className="text-sm">
                  Permitir comentarios
                </Label>
                <Switch
                  id="tt-comment"
                  checked={tiktok.allowComment}
                  onCheckedChange={(value) =>
                    setTiktok((prev) => ({ ...prev, allowComment: value }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tt-duet" className="text-sm">
                  Permitir duetos
                </Label>
                <Switch
                  id="tt-duet"
                  checked={tiktok.allowDuet}
                  onCheckedChange={(value) =>
                    setTiktok((prev) => ({ ...prev, allowDuet: value }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tt-stitch" className="text-sm">
                  Permitir stitch
                </Label>
                <Switch
                  id="tt-stitch"
                  checked={tiktok.allowStitch}
                  onCheckedChange={(value) =>
                    setTiktok((prev) => ({ ...prev, allowStitch: value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tt-description">
                  Descripción (carrusel de fotos)
                </Label>
                <Textarea
                  id="tt-description"
                  rows={3}
                  value={tiktok.description}
                  onChange={(event) =>
                    setTiktok((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Solo para carruseles de fotos: copy largo (hasta 4000 caracteres)."
                />
                <p className="text-[11px] text-muted-foreground">
                  Zernio envía los consentimientos legales de TikTok
                  automáticamente al publicar.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
                onClick={() => void submit("schedule")}
                disabled={submitting}
              >
                <CalendarClock className="h-4 w-4" />
                Programar en {selected.length || 0} cuenta
                {selected.length === 1 ? "" : "s"}
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => void submit("now")}
                disabled={submitting}
              >
                <Send className="h-4 w-4" />
                Publicar ahora
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => void submit("draft")}
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
                {result.failures.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-destructive">
                    {result.failures.map((failure) => (
                      <li key={failure}>{failure}</li>
                    ))}
                  </ul>
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
              Los archivos se suben a Zernio (presign + PUT) y el post usa su URL
              pública. Las láminas del estudio se suben igual al programar.
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
