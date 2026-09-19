"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Flame,
  Play,
  Rss,
  Search,
  Sparkles,
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
import { insertHookIntoDraft } from "@/lib/client/script-draft";
import type { TrendItem, TrendSource } from "@/lib/domain/types";
import { cn, relativeTime } from "@/lib/utils";

type SourceWithStats = TrendSource & { itemCount: number; topScore: number };

function scoreTone(score: number): string {
  if (score >= 90) return "text-primary";
  if (score >= 80) return "text-warning";
  return "text-muted-foreground";
}

export function TrendsBoard({
  trends,
  sources,
}: {
  trends: TrendItem[];
  sources: SourceWithStats[];
}) {
  const [search, setSearch] = React.useState("");
  const [sourceId, setSourceId] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [minScore, setMinScore] = React.useState("0");
  const [sortBy, setSortBy] = React.useState("hookScore");

  const categories = React.useMemo(
    () => [...new Set(trends.map((t) => t.category))].sort(),
    [trends],
  );

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return trends
      .filter((item) => {
        if (sourceId !== "all" && item.sourceId !== sourceId) return false;
        if (category !== "all" && item.category !== category) return false;
        if (Number(minScore) > 0 && item.hookScore < Number(minScore)) return false;
        if (term) {
          const haystack = `${item.title} ${item.summary} ${item.angle} ${item.hookSuggestion}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        sortBy === "publishedAt"
          ? b.publishedAt.localeCompare(a.publishedAt)
          : b.hookScore - a.hookScore,
      );
  }, [trends, search, sourceId, category, minScore, sortBy]);

  const highPotential = trends.filter((t) => t.hookScore >= 85).length;

  return (
    <div className="space-y-6">
      {/* Fuentes */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rss className="h-4 w-4 text-primary" />
            {sources.length} fuentes monitorizadas
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default">{highPotential} con potencial alto</Badge>
            <Badge variant="muted">{trends.length} items</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sources.map((source) => (
              <button
                key={source.id}
                onClick={() => setSourceId(sourceId === source.id ? "all" : source.id)}
                className={cn(
                  "rounded-md border p-2.5 text-left transition-colors",
                  sourceId === source.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border hover:border-primary/30",
                )}
              >
                <p className="truncate text-sm font-medium">{source.name}</p>
                <p className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{source.category}</span>
                  <span className="tabular-nums">
                    {source.itemCount > 0 ? `${source.itemCount} items` : "sin items"}
                  </span>
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Título, ángulo o hook…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fuente</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las fuentes</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Potencial de hook</Label>
            <Select value={minScore} onValueChange={setMinScore}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Cualquier score</SelectItem>
                <SelectItem value="70">70+</SelectItem>
                <SelectItem value="80">80+</SelectItem>
                <SelectItem value="90">90+ (top)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {filtered.length} noticia{filtered.length === 1 ? "" : "s"} clasificada
                {filtered.length === 1 ? "" : "s"}
              </p>
              <div className="inline-flex rounded-lg border border-border p-0.5">
                {[
                  { value: "hookScore", label: "Potencial de hook" },
                  { value: "publishedAt", label: "Más reciente" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      sortBy === option.value
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listado */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="Ninguna noticia coincide con los filtros"
          description="Baja el umbral de potencial de hook o cambia de fuente. La ingesta se ejecuta a diario."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="flex shrink-0 items-start gap-3 lg:w-28">
                  <div className="text-center">
                    <p
                      className={cn(
                        "text-2xl font-semibold tabular-nums leading-none",
                        scoreTone(item.hookScore),
                      )}
                    >
                      {item.hookScore}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      hook score
                    </p>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.sourceName}</Badge>
                    <Badge variant="outline">{item.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(item.publishedAt)}
                    </span>
                  </div>

                  <div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-start gap-1.5 text-sm font-medium hover:text-primary"
                    >
                      {item.title}
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                    </a>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.summary}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-border p-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
                        <Sparkles className="h-3 w-3" />
                        Hook sugerido
                      </p>
                      <p className="mt-1 text-sm">«{item.hookSuggestion}»</p>
                    </div>
                    <div className="rounded-md border border-border p-2.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Ángulo de contenido
                      </p>
                      <p className="mt-1 text-sm">{item.angle}</p>
                    </div>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${item.hookScore}%` }}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 items-start">
                  <Button
                    size="sm"
                    onClick={() => {
                      insertHookIntoDraft({ hookText: item.hookSuggestion });
                      toast.success("Hook insertado en el Estudio de guiones");
                      window.location.href = "/script";
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Usar este hook
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
