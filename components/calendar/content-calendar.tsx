"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";

import { PlatformIcon, platformLabel } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NICHES, NICHE_LABELS, type ContentPlanEntry } from "@/lib/domain/types";
import type { ZernioPost } from "@/lib/zernio/types";
import { cn } from "@/lib/utils";

export interface CalendarBlock {
  id: string;
  kind: "plan" | "zernio";
  date: string;
  time: string;
  platform: string;
  hook: string;
  caption: string;
  angle?: string;
  status: string;
  postId?: string;
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  idea: { label: "Idea", className: "border-muted-foreground/30 text-muted-foreground" },
  script: { label: "Guion", className: "border-primary/40 text-primary" },
  scheduled: { label: "Programado", className: "border-primary/40 text-primary" },
  published: { label: "Publicado", className: "border-success/40 text-success" },
  draft: { label: "Borrador", className: "border-muted-foreground/30 text-muted-foreground" },
  pending: { label: "Pendiente", className: "border-warning/40 text-warning" },
};

function planToBlock(entry: ContentPlanEntry): CalendarBlock {
  return {
    id: entry.id,
    kind: "plan",
    date: entry.date,
    time: entry.time,
    platform: entry.platform,
    hook: entry.hookText,
    caption: entry.caption,
    angle: entry.angle,
    status: entry.status,
    postId: entry.zernioPostId,
  };
}

function postToBlock(post: ZernioPost): CalendarBlock {
  const scheduled = post.scheduledFor ? new Date(post.scheduledFor) : null;
  const platform = post.platforms[0]?.platform ?? "instagram";
  return {
    id: post._id,
    kind: "zernio",
    date: scheduled ? format(scheduled, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    time: scheduled ? format(scheduled, "HH:mm") : "00:00",
    platform,
    hook: post.content,
    caption: post.content,
    status: post.status,
    postId: post._id,
  };
}

export function ContentCalendar({
  planEntries,
  posts,
  demoSafe,
}: {
  planEntries: ContentPlanEntry[];
  posts: ZernioPost[];
  demoSafe: boolean;
}) {
  const router = useRouter();
  const [month, setMonth] = React.useState(() => new Date());
  const [selected, setSelected] = React.useState<CalendarBlock | null>(null);
  const [autofillOpen, setAutofillOpen] = React.useState(false);

  const blocks = React.useMemo(() => {
    const fromPlan = planEntries.map(planToBlock);
    const planIds = new Set(fromPlan.map((b) => b.postId).filter(Boolean));
    // Evita duplicar un post que ya tiene su entrada de plan enlazada.
    const fromPosts = posts
      .map(postToBlock)
      .filter((block) => !planIds.has(block.postId));
    return [...fromPlan, ...fromPosts];
  }, [planEntries, posts]);

  const gridDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const monthBlocks = blocks.filter((block) =>
    block.date.startsWith(format(month, "yyyy-MM")),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center text-sm font-semibold capitalize">
            {format(month, "MMMM yyyy", { locale: es })}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>
            Hoy
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="muted">
            {monthBlocks.length} publicaciones este mes
          </Badge>
          <Button size="sm" onClick={() => setAutofillOpen(true)}>
            <Wand2 className="h-4 w-4" />
            Autocompletar mes
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {gridDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayBlocks = blocks
              .filter((block) => block.date === key)
              .sort((a, b) => a.time.localeCompare(b.time));

            return (
              <div
                key={key}
                className={cn(
                  "min-h-[128px] border-b border-r border-border p-1.5 last:border-r-0",
                  !isSameMonth(day, month) && "bg-muted/20",
                )}
              >
                <div className="mb-1 flex items-center justify-between px-1">
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      !isSameMonth(day, month)
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground",
                      isToday(day) &&
                        "flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                <div className="space-y-1">
                  {dayBlocks.map((block) => (
                    <button
                      key={`${block.kind}-${block.id}`}
                      onClick={() => setSelected(block)}
                      className="w-full rounded border border-border bg-card p-1.5 text-left transition-colors hover:border-primary/50 hover:bg-accent/50"
                    >
                      <span className="flex items-center gap-1.5">
                        <PlatformIcon platform={block.platform} className="h-3 w-3" />
                        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                          {block.time}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[11px] leading-snug">
                        {block.hook}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Los bloques combinan el plan generado por scripts (estado «Idea» o
        «Guion») con lo que ya está programado en Zernio. Haz clic en cualquiera
        para ver el guion completo y la caption.
      </p>

      {/* Panel lateral con el detalle */}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent className="sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8">
                  {format(new Date(`${selected.date}T${selected.time}:00`), "EEEE d 'de' MMMM", {
                    locale: es,
                  })}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <PlatformIcon platform={selected.platform} />
                    {platformLabel(selected.platform)}
                  </span>
                  <span>·</span>
                  <span>{selected.time}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      STATUS_STYLE[selected.status]?.className,
                      "ml-1 capitalize",
                    )}
                  >
                    {STATUS_STYLE[selected.status]?.label ?? selected.status}
                  </Badge>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-6 pb-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Hook
                  </p>
                  <p className="mt-1 text-sm font-medium">«{selected.hook}»</p>
                </div>

                {selected.angle ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Ángulo de contenido
                    </p>
                    <p className="mt-1 text-sm">{selected.angle}</p>
                  </div>
                ) : null}

                <Separator />

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Guion completo y caption
                  </p>
                  <div className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed">
                    {selected.caption}
                  </div>
                </div>

                {selected.postId ? (
                  <p className="break-all text-xs text-muted-foreground">
                    ID en Zernio: <span className="font-mono">{selected.postId}</span>
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = new URL("/scheduler", window.location.origin);
                      url.searchParams.set("hook", selected.hook);
                      window.location.href = url.toString();
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar al Programador
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelected(null);
                      toast.info("Duplica el bloque desde el Programador para moverlo de fecha");
                    }}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Reprogramar
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AutofillDialog
        open={autofillOpen}
        onOpenChange={setAutofillOpen}
        month={format(month, "yyyy-MM")}
        demoSafe={demoSafe}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

function AutofillDialog({
  open,
  onOpenChange,
  month,
  demoSafe,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  demoSafe: boolean;
  onDone: () => void;
}) {
  const [perWeek, setPerWeek] = React.useState("3");
  const [platforms, setPlatforms] = React.useState<string[]>([
    "instagram",
    "tiktok",
    "youtube",
  ]);
  const [niche, setNiche] = React.useState<string>("all");
  const [running, setRunning] = React.useState(false);

  const PLATFORM_OPTIONS = ["instagram", "tiktok", "youtube", "facebook", "threads", "linkedin"];

  function togglePlatform(platform: string) {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((item) => item !== platform)
        : [...prev, platform],
    );
  }

  async function run() {
    if (platforms.length === 0) {
      toast.error("Elige al menos una plataforma");
      return;
    }

    setRunning(true);
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "autofill",
          month,
          perWeek: Number(perWeek),
          platforms,
          niche: niche === "all" ? undefined : niche,
        }),
      });

      if (!response.ok) throw new Error("No se pudo autocompletar el mes");
      const payload = (await response.json()) as {
        entries: unknown[];
        summary: string;
      };

      toast.success("Calendario completado", { description: payload.summary });
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Autocompletar {month}
          </DialogTitle>
          <DialogDescription>
            El script cruza tu Biblioteca de Hooks con los ángulos de contenido, los
            coloca en los mejores huecos de engagement y escribe la caption de cada
            pieza.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Publicaciones por semana</Label>
              <Select value={perWeek} onValueChange={setPerWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4", "5"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value} por semana
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Nicho</Label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos (según el hook)</SelectItem>
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
            <Label>Plataformas</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((platform) => (
                <button
                  key={platform}
                  onClick={() => togglePlatform(platform)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    platforms.includes(platform)
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <PlatformIcon platform={platform} className="h-3 w-3" />
                  {platformLabel(platform)}
                </button>
              ))}
            </div>
          </div>

          {demoSafe ? (
            <p className="text-xs text-muted-foreground">
              El plan se guarda localmente. Al programar cada pieza se envía a Zernio
              con <span className="font-mono">POST /v1/posts</span>.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={run} disabled={running}>
            {running ? "Generando…" : "Generar calendario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
