"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bookmark,
  Flame,
  MessageCircle,
  MousePointerClick,
  Share2,
  TrendingUp,
  Users,
  Eye,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import type { AnalyticsSnapshot, RangeKey } from "@/lib/domain/analytics-service";
import { platformLabel, PlatformIcon } from "@/components/platform-icon";
import { cn, formatCompact, formatNumber } from "@/lib/utils";

type MetricKey = "views" | "saves" | "followers" | "engagement";

const METRIC_LABELS: Record<MetricKey, string> = {
  views: "Visualizaciones",
  saves: "Guardados",
  followers: "Seguidores",
  engagement: "Interacciones",
};

const RANGES: Array<{ value: RangeKey; label: string }> = [
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
];

export function AnalyticsDashboard({ initialRange = 30 }: { initialRange?: RangeKey }) {
  const [range, setRange] = React.useState<RangeKey>(initialRange);
  const [metric, setMetric] = React.useState<MetricKey>("views");

  const { data, isFetching } = useQuery({
    queryKey: ["analytics", range],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?range=${range}`);
      if (!response.ok) throw new Error("No se pudieron cargar las analíticas");
      return (await response.json()) as {
        source: "zernio" | "demo";
        warning: string | null;
        snapshot: AnalyticsSnapshot;
      };
    },
  });

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const { snapshot } = data;

  return (
    <div className={cn("space-y-6", isFetching && "opacity-70 transition-opacity")}>
      {/* Rango temporal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {RANGES.map((option) => (
            <button
              key={option.value}
              onClick={() => setRange(option.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                range === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="muted">
            Base 30 días: {formatCompact(snapshot.baseline30d)} views/post
          </Badge>
          <Badge variant="warning">Destacado a partir de 2x</Badge>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Visualizaciones"
          value={formatNumber(snapshot.metrics.views.total)}
          delta={snapshot.metrics.views.delta}
          spark={snapshot.metrics.views.spark}
          hint={`Periodo anterior: ${formatCompact(snapshot.metrics.views.previous)}`}
        />
        <StatCard
          label="Guardados"
          value={formatNumber(snapshot.metrics.saves.total)}
          delta={snapshot.metrics.saves.delta}
          spark={snapshot.metrics.saves.spark}
          hint={`Periodo anterior: ${formatCompact(snapshot.metrics.saves.previous)}`}
        />
        <StatCard
          label="Nuevos seguidores"
          value={`${snapshot.followers.change >= 0 ? "+" : ""}${formatNumber(snapshot.followers.change)}`}
          delta={snapshot.metrics.followers.delta}
          spark={snapshot.metrics.followers.spark}
          hint={`Total: ${formatNumber(snapshot.followers.total)}`}
        />
        <StatCard
          label="Interacciones"
          value={formatNumber(snapshot.metrics.engagement.total)}
          delta={snapshot.metrics.engagement.delta}
          hint={`Engagement medio: ${snapshot.averageEngagementRate.toFixed(2)}%`}
        />
      </div>

      {/* Gráfica de tendencia */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-4">
          <CardTitle className="text-base">
            Tendencia · últimos {range} días
          </CardTitle>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  metric === key
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {METRIC_LABELS[key]}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={snapshot.series} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value: string) => value.slice(5)}
                  minTickGap={24}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value: number) => formatCompact(value)}
                  width={44}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(value: number) => [formatNumber(value), METRIC_LABELS[metric]]}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#metricFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Desglose por plataforma y volumetría */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Rendimiento por plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={snapshot.platformBreakdown}
                  margin={{ left: 4, right: 8, top: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="platform"
                    tickFormatter={(value: string) => platformLabel(value)}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value: number) => formatCompact(value)}
                    width={44}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      formatNumber(value),
                      name === "views" ? "Visualizaciones" : name,
                    ]}
                  />
                  <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                    {snapshot.platformBreakdown.map((_, index) => (
                      <Cell key={index} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {snapshot.platformBreakdown.map((platform) => (
                <div
                  key={platform.platform}
                  className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2"
                >
                  <PlatformIcon platform={platform.platform} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {platformLabel(platform.platform)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {platform.postCount} posts · {formatCompact(platform.views)} views
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Volumen de interacción</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <VolumeRow icon={Eye} label="Impresiones" value={snapshot.totals.impressions} />
            <VolumeRow icon={Users} label="Alcance" value={snapshot.totals.reach} />
            <VolumeRow icon={Bookmark} label="Guardados" value={snapshot.totals.saves} />
            <VolumeRow icon={Share2} label="Compartidos" value={snapshot.totals.shares} />
            <VolumeRow icon={MessageCircle} label="Comentarios" value={snapshot.totals.comments} />
            <VolumeRow icon={MousePointerClick} label="Clics al enlace" value={snapshot.totals.clicks} />
          </CardContent>
        </Card>
      </div>

      {/* Contenido destacado */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-primary" />
            Contenido destacado
            <Badge variant="muted" className="ml-1">
              {snapshot.standout.length} publicaciones por encima de 2x
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.standout.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguna publicación ha superado el doble de la media de los últimos
              30 días. La media actual es {formatCompact(snapshot.baseline30d)} views.
            </p>
          ) : (
            snapshot.standout.map((entry) => (
              <div
                key={entry.post.postId}
                className="rounded-md border border-primary/25 bg-primary/[0.06] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={entry.post.platform} />
                    <span className="text-sm font-medium">
                      {platformLabel(entry.post.platform)}
                    </span>
                  </div>
                  <Badge variant="default">
                    {entry.multiplier.toFixed(1)}x la media
                  </Badge>
                </div>
                <p className="mt-2 text-sm">{entry.post.content}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{entry.reason}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Top 5 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Top 5 contenidos de la semana pasada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {snapshot.topPosts.map((entry) => (
            <div key={entry.post.postId} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {entry.rank}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformIcon platform={entry.post.platform} />
                  <span className="text-xs text-muted-foreground">
                    {entry.post.publishedAt
                      ? new Date(entry.post.publishedAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "sin fecha"}
                  </span>
                  <Badge variant="outline">{entry.patternName}</Badge>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {formatNumber(entry.post.analytics.views ?? 0)} views
                  </span>
                </div>

                <p className="text-sm font-medium">{entry.post.content}</p>
                <p className="text-sm text-muted-foreground">{entry.explanation}</p>

                <div className="flex flex-wrap gap-1.5">
                  {entry.signals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {data.warning ? (
        <p className="text-xs text-muted-foreground">
          Nota: se muestran datos de demostración ({data.warning})
        </p>
      ) : null}
    </div>
  );
}

function VolumeRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-medium tabular-nums">{formatNumber(value)}</span>
    </div>
  );
}
