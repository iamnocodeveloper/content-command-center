"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  Copy,
  Eye,
  Heart,
  Play,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { insertHookIntoDraft } from "@/lib/client/script-draft";
import { PATTERN_BY_ID } from "@/lib/domain/hook-patterns";
import { HOOK_TYPE_LABELS, NICHE_LABELS, type Hook } from "@/lib/domain/types";
import { cn, formatCompact, formatNumber } from "@/lib/utils";

const TIER_STYLE: Record<Hook["tier"], { label: string; variant: "default" | "warning" | "success" | "muted" }> = {
  viral: { label: "Viral", variant: "default" },
  high: { label: "Alto", variant: "warning" },
  standard: { label: "Estándar", variant: "muted" },
};

export function HookCard({
  hook,
  onToggleFavorite,
  onCopy,
}: {
  hook: Hook;
  onToggleFavorite: (hook: Hook) => void;
  onCopy: (hook: Hook) => void;
}) {
  const pattern = PATTERN_BY_ID.get(hook.patternId);
  const tier = TIER_STYLE[hook.tier];

  return (
    <Card className="animate-fade-in flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tier.variant}>{tier.label}</Badge>
          <Badge variant="outline">{HOOK_TYPE_LABELS[hook.type]}</Badge>
          <Badge variant="secondary">{NICHE_LABELS[hook.niche]}</Badge>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={hook.isFavorite ? "Quitar de favoritos" : "Marcar favorito"}
          onClick={() => onToggleFavorite(hook)}
        >
          <Star
            className={cn(
              "h-4 w-4",
              hook.isFavorite ? "fill-primary text-primary" : "text-muted-foreground",
            )}
          />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hook original
          </p>
          <p className="mt-1 text-sm leading-relaxed">«{hook.rawText}»</p>
        </div>

        <div className="rounded-md border border-primary/25 bg-primary/[0.07] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Plantilla
          </p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {hook.templateText}
          </p>
          {hook.filledText && hook.filledText !== hook.rawText ? (
            <p className="mt-2 text-sm text-muted-foreground">{hook.filledText}</p>
          ) : null}
          {pattern ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {pattern.rationale}
            </p>
          ) : null}
        </div>

        {hook.onScreenText ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">En pantalla · </span>
            {hook.onScreenText}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Metric icon={Eye} label="Views" value={formatCompact(hook.views)} />
        <Metric icon={Heart} label="Likes" value={formatCompact(hook.likes)} />
        <Metric icon={BookOpen} label="Guardados" value={formatCompact(hook.saves)} />
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{hook.creatorHandle}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(hook.savedAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            {hook.sourceUrl ? " · origen verificado" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(hook)}
            aria-label="Copiar hook"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              insertHookIntoDraft({
                hookId: hook.id,
                hookText: hook.filledText || hook.rawText,
                niche: hook.niche,
              });
              toast.success("Hook insertado en el Estudio de guiones", {
                description: "Abriendo /script…",
              });
              window.location.href = "/script";
            }}
          >
            <Play className="h-3.5 w-3.5" />
            Usar este hook
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-2">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function HooksSummaryStrip({ hooks }: { hooks: Hook[] }) {
  const totalViews = hooks.reduce((acc, h) => acc + h.views, 0);
  const viral = hooks.filter((h) => h.tier === "viral").length;
  const favorites = hooks.filter((h) => h.isFavorite).length;
  const patterns = new Set(hooks.map((h) => h.patternId)).size;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryTile icon={Sparkles} label="Hooks guardados" value={formatNumber(hooks.length)} />
      <SummaryTile icon={TrendingUp} label="Virales (500K+)" value={formatNumber(viral)} />
      <SummaryTile icon={Eye} label="Views acumuladas" value={formatCompact(totalViews)} />
      <SummaryTile icon={Check} label={`Plantillas · ${favorites} favoritos`} value={formatNumber(patterns)} />
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/12 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </Card>
  );
}
