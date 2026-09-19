"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { classifyHook } from "@/lib/domain/hook-engine";
import { PATTERN_BY_ID } from "@/lib/domain/hook-patterns";
import { NICHES, NICHE_LABELS, type Hook } from "@/lib/domain/types";

/**
 * Guarda un hook nuevo. Al pegar la transcripción, el motor de hooks muestra en
 * vivo qué plantilla y qué tipo detecta, para que el creador vea el resultado
 * antes de confirmar.
 */
export function SaveHookDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [rawText, setRawText] = React.useState("");
  const [onScreenText, setOnScreenText] = React.useState("");
  const [creatorHandle, setCreatorHandle] = React.useState("@tenfoldmarc");
  const [creatorPlatform, setCreatorPlatform] = React.useState("instagram");
  const [views, setViews] = React.useState("0");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [niche, setNiche] = React.useState<string>("auto");

  const preview = React.useMemo(() => {
    if (rawText.trim().length < 4) return null;
    const classification = classifyHook(rawText);
    const pattern = PATTERN_BY_ID.get(classification.patternId);
    return { pattern, confidence: classification.confidence };
  }, [rawText]);

  async function save() {
    if (rawText.trim().length < 4) {
      toast.error("Escribe la transcripción del hook");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawText.trim(),
          onScreenText: onScreenText.trim() || undefined,
          creatorHandle: creatorHandle.trim() || "@tenfoldmarc",
          creatorPlatform,
          views: Number(views) || 0,
          sourceUrl: sourceUrl.trim() || undefined,
          niche: niche === "auto" ? undefined : niche,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "No se pudo guardar el hook");
      }

      const { hook } = (await response.json()) as { hook: Hook };
      toast.success("Hook guardado y clasificado", {
        description: PATTERN_BY_ID.get(hook.patternId)?.template,
      });

      reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setRawText("");
    setOnScreenText("");
    setViews("0");
    setSourceUrl("");
    setNiche("auto");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Guardar hook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Guardar un hook</DialogTitle>
          <DialogDescription>
            Pega la transcripción o el texto del hook. Se normaliza a plantilla
            automáticamente y queda disponible para el Estudio de guiones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="raw-text">Transcripción del hook</Label>
            <Textarea
              id="raw-text"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Ej: 5 cosas que me hubiera gustado saber antes de automatizar mi negocio"
              rows={3}
            />
          </div>

          {preview?.pattern ? (
            <div className="rounded-md border border-primary/25 bg-primary/[0.07] p-3">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                <Wand2 className="h-3.5 w-3.5" />
                Plantilla detectada ·{" "}
                {Math.round(preview.confidence * 100)}% de confianza
              </p>
              <p className="mt-1 font-mono text-sm">
                {preview.pattern.template}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {preview.pattern.name} — {preview.pattern.rationale}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="on-screen">Texto en pantalla (opcional)</Label>
              <Input
                id="on-screen"
                value={onScreenText}
                onChange={(event) => setOnScreenText(event.target.value)}
                placeholder="5 COSAS ANTES DE AUTOMATIZAR"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="creator">Creador original</Label>
              <Input
                id="creator"
                value={creatorHandle}
                onChange={(event) => setCreatorHandle(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Plataforma</Label>
              <Select value={creatorPlatform} onValueChange={setCreatorPlatform}>
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

            <div className="space-y-1.5">
              <Label htmlFor="views">Visualizaciones</Label>
              <Input
                id="views"
                type="number"
                min={0}
                value={views}
                onChange={(event) => setViews(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="source">URL de origen (opcional)</Label>
              <Input
                id="source"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://instagram.com/reel/..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nicho</Label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detectar automáticamente</SelectItem>
                  {NICHES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {NICHE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Badge variant="muted" className="mr-auto hidden sm:inline-flex">
            El motor de hooks es determinista y local
          </Badge>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar hook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
