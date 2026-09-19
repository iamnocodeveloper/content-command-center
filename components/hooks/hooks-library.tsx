"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lightbulb, RotateCcw, Search, Star } from "lucide-react";

import { HookCard, HooksSummaryStrip } from "@/components/hooks/hook-card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { HOOK_PATTERNS } from "@/lib/domain/hook-patterns";
import {
  HOOK_TYPES,
  HOOK_TYPE_LABELS,
  NICHES,
  NICHE_LABELS,
  type Hook,
} from "@/lib/domain/types";
import { formatCompact } from "@/lib/utils";

interface Filters {
  search: string;
  niche: string;
  type: string;
  minViews: string;
  sortBy: string;
  favoritesOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  niche: "all",
  type: "all",
  minViews: "0",
  sortBy: "views",
  favoritesOnly: false,
};

const VIEW_RANGES = [
  { value: "0", label: "Cualquier alcance" },
  { value: "100000", label: "100K+ views" },
  { value: "250000", label: "250K+ views" },
  { value: "500000", label: "500K+ views" },
  { value: "1000000", label: "1M+ views" },
];

export function HooksLibrary({
  initialHooks,
  initialFavorites,
}: {
  initialHooks: Hook[];
  initialFavorites: Hook[];
}) {
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [favorites, setFavorites] = React.useState<Hook[]>(initialFavorites);
  const [localOverrides, setLocalOverrides] = React.useState<
    Record<string, boolean>
  >({});

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 250);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const isDefaultQuery =
    filters.niche === "all" &&
    filters.type === "all" &&
    filters.minViews === "0" &&
    filters.sortBy === "views" &&
    !filters.favoritesOnly &&
    debouncedSearch === "";

  const { data, isFetching } = useQuery({
    queryKey: [
      "hooks",
      debouncedSearch,
      filters.niche,
      filters.type,
      filters.minViews,
      filters.sortBy,
      filters.favoritesOnly,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.niche !== "all") params.set("niche", filters.niche);
      if (filters.type !== "all") params.set("type", filters.type);
      if (filters.minViews !== "0") params.set("minViews", filters.minViews);
      params.set("sortBy", filters.sortBy);
      if (filters.favoritesOnly) params.set("favoritesOnly", "true");

      const response = await fetch(`/api/hooks?${params.toString()}`);
      if (!response.ok) throw new Error("No se pudo cargar la biblioteca");
      return (await response.json()) as { hooks: Hook[]; count: number };
    },
    initialData: isDefaultQuery
      ? { hooks: initialHooks, count: initialHooks.length }
      : undefined,
  });

  const hooks = React.useMemo(() => {
    const list = data?.hooks ?? [];
    return list.map((hook) =>
      hook.id in localOverrides
        ? { ...hook, isFavorite: localOverrides[hook.id] }
        : hook,
    );
  }, [data, localOverrides]);

  async function toggleFavorite(hook: Hook) {
    const next = !hook.isFavorite;
    setLocalOverrides((prev) => ({ ...prev, [hook.id]: next }));

    try {
      const response = await fetch(`/api/hooks/${hook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      });
      if (!response.ok) throw new Error("No se pudo actualizar");

      setFavorites((prev) =>
        next
          ? [hook, ...prev.filter((h) => h.id !== hook.id)]
          : prev.filter((h) => h.id !== hook.id),
      );
    } catch {
      setLocalOverrides((prev) => ({ ...prev, [hook.id]: hook.isFavorite }));
      toast.error("No se pudo actualizar el favorito");
    }
  }

  async function copyHook(hook: Hook) {
    const text = hook.filledText || hook.rawText;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Hook copiado al portapapeles");
    } catch {
      toast.error("El navegador bloqueó el acceso al portapapeles");
    }
  }

  const activeFilters =
    debouncedSearch !== "" ||
    filters.niche !== "all" ||
    filters.type !== "all" ||
    filters.minViews !== "0" ||
    filters.favoritesOnly;

  return (
    <div className="space-y-6">
      <HooksSummaryStrip hooks={hooks.length > 0 ? hooks : initialHooks} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) =>
                setFilters((f) => ({ ...f, search: event.target.value }))
              }
              placeholder="Busca por texto, creador, etiqueta o frase del hook…"
              className="pl-9"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nicho">
              <Select
                value={filters.niche}
                onValueChange={(value) =>
                  setFilters((f) => ({ ...f, niche: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los nichos</SelectItem>
                  {NICHES.map((niche) => (
                    <SelectItem key={niche} value={niche}>
                      {NICHE_LABELS[niche]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tipo de hook">
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  setFilters((f) => ({ ...f, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {HOOK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {HOOK_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Visualizaciones">
              <Select
                value={filters.minViews}
                onValueChange={(value) =>
                  setFilters((f) => ({ ...f, minViews: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Ordenar por">
              <Select
                value={filters.sortBy}
                onValueChange={(value) =>
                  setFilters((f) => ({ ...f, sortBy: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="views">Más vistas</SelectItem>
                  <SelectItem value="saves">Más guardados</SelectItem>
                  <SelectItem value="engagement">Mejor engagement</SelectItem>
                  <SelectItem value="savedAt">Guardado reciente</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="favorites-only"
                checked={filters.favoritesOnly}
                onCheckedChange={(checked) =>
                  setFilters((f) => ({ ...f, favoritesOnly: checked }))
                }
              />
              <Label htmlFor="favorites-only" className="cursor-pointer">
                Sólo favoritos
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {hooks.length} resultado{hooks.length === 1 ? "" : "s"}
              </span>
              {activeFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Limpiar
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {isFetching ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[340px] rounded-lg" />
          ))}
        </div>
      ) : hooks.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Ningún hook coincide con los filtros"
          description="Prueba a subir o bajar el rango de visualizaciones, cambiar el nicho o limpiar la búsqueda."
          action={
            <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hooks.map((hook) => (
            <HookCard
              key={hook.id}
              hook={hook}
              onToggleFavorite={toggleFavorite}
              onCopy={copyHook}
            />
          ))}
        </div>
      )}

      <PatternReference hooks={initialHooks} favoriteCount={favorites.length} />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PatternReference({
  hooks,
  favoriteCount,
}: {
  hooks: Hook[];
  favoriteCount: number;
}) {
  const usage = React.useMemo(() => {
    return HOOK_PATTERNS.map((pattern) => {
      const used = hooks.filter((h) => h.patternId === pattern.id);
      return {
        pattern,
        count: used.length,
        best: used.reduce((max, h) => Math.max(max, h.views), 0),
      };
    }).sort((a, b) => b.best - a.best || b.count - a.count);
  }, [hooks]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-primary" />
          Catálogo de plantillas
          <Badge variant="muted" className="ml-1">
            {HOOK_PATTERNS.length} plantillas · {favoriteCount} favoritos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {usage.map(({ pattern, count, best }) => (
          <div
            key={pattern.id}
            className="rounded-md border border-border p-3 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{pattern.name}</p>
              <Badge variant={best > 0 ? "default" : "muted"}>
                {count} uso{count === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="mt-1.5 font-mono text-xs text-primary">
              {pattern.template}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {pattern.rationale}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Media histórica {formatCompact(pattern.averageViews)}</span>
              {best > 0 ? <span>Tu mejor: {formatCompact(best)}</span> : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
