import { classifyHook } from "@/lib/domain/hook-engine";
import { PATTERN_BY_ID } from "@/lib/domain/hook-patterns";
import type {
  AnalyticsOverview,
  DailyMetricsResponse,
  FollowerStatsResponse,
  PostAnalyticsEntry,
  ZernioPlatform,
} from "@/lib/zernio/types";

/**
 * Cerebro de la página de Analíticas.
 *
 * Todo el cálculo es puro y determinista: recibe las respuestas de Zernio (o las
 * semilla de demo) y devuelve una vista lista para pintar. Así el mismo código
 * sirve para datos reales y para la demo, y es trivial de testear.
 */

export type RangeKey = 7 | 30 | 90;

export interface MetricSeriesPoint {
  date: string;
  views: number;
  saves: number;
  followers: number;
  engagement: number;
  postCount: number;
}

export interface MetricSummary {
  total: number;
  previous: number;
  /** Variación relativa (-0.2 = -20%). */
  delta: number;
  spark: number[];
}

export interface AnalyticsSnapshot {
  range: RangeKey;
  series: MetricSeriesPoint[];
  metrics: {
    views: MetricSummary;
    saves: MetricSummary;
    followers: MetricSummary;
    engagement: MetricSummary;
    shares: MetricSummary;
    clicks: MetricSummary;
  };
  totals: Required<
    Pick<
      AnalyticsOverview,
      | "impressions"
      | "reach"
      | "likes"
      | "comments"
      | "shares"
      | "saves"
      | "clicks"
      | "views"
    >
  >;
  averageEngagementRate: number;
  /** Media de views de los últimos 30 días, base para detectar destacados. */
  baseline30d: number;
  totalPosts: number;
  platformBreakdown: DailyMetricsResponse["platformBreakdown"];
  standout: StandoutPost[];
  topPosts: TopPost[];
  followers: {
    total: number;
    change: number;
    byPlatform: Array<{
      platform: ZernioPlatform;
      username?: string;
      count: number;
      change: number;
    }>;
  };
}

export interface StandoutPost {
  post: PostAnalyticsEntry;
  /** views / baseline30d */
  multiplier: number;
  reason: string;
}

export interface TopPost {
  rank: number;
  post: PostAnalyticsEntry;
  /** Por qué funcionó, en 1-2 frases redactadas desde los datos. */
  explanation: string;
  /** Señales medibles que sustentan la explicación. */
  signals: string[];
  patternName: string;
  engagementRate: number;
  saveRate: number;
}

const DAY = 86_400_000;

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sumWindow(
  dailyData: DailyMetricsResponse["dailyData"],
  from: Date,
  to: Date,
  pick: (d: DailyMetricsResponse["dailyData"][number]) => number,
): number {
  return dailyData
    .filter((d) => {
      const time = new Date(`${d.date}T00:00:00Z`).getTime();
      return time > from.getTime() && time <= to.getTime();
    })
    .reduce((acc, d) => acc + pick(d), 0);
}

function buildSummary(
  dailyData: DailyMetricsResponse["dailyData"],
  from: Date,
  to: Date,
  pick: (d: DailyMetricsResponse["dailyData"][number]) => number,
  sparkDays: number,
): MetricSummary {
  const span = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - span);

  const total = sumWindow(dailyData, from, to, pick);
  const previous = sumWindow(dailyData, previousFrom, from, pick);
  const delta = previous === 0 ? (total > 0 ? 1 : 0) : (total - previous) / previous;

  const window = dailyData.filter((d) => {
    const time = new Date(`${d.date}T00:00:00Z`).getTime();
    return time > from.getTime() - sparkDays * DAY && time <= to.getTime();
  });

  return {
    total,
    previous,
    delta,
    spark: window.slice(-sparkDays).map(pick),
  };
}

export function buildAnalyticsSnapshot(input: {
  dailyMetrics: DailyMetricsResponse;
  posts: PostAnalyticsEntry[];
  followerStats?: FollowerStatsResponse;
  range: RangeKey;
  now?: Date;
}): AnalyticsSnapshot {
  const now = input.now ?? new Date();
  const { dailyMetrics, posts, followerStats, range } = input;

  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime() - range * DAY);

  const { dailyData } = dailyMetrics;

  const views = buildSummary(dailyData, from, to, (d) => d.metrics.views, range);
  const saves = buildSummary(dailyData, from, to, (d) => d.metrics.saves, range);
  const shares = buildSummary(dailyData, from, to, (d) => d.metrics.shares, range);
  const clicks = buildSummary(dailyData, from, to, (d) => d.metrics.clicks, range);

  // Serie diaria alineada con el rango pedido.
  const series: MetricSeriesPoint[] = [];
  const followerByDay = buildFollowerByDay(followerStats);

  for (let i = range - 1; i >= 0; i--) {
    const date = isoDay(new Date(to.getTime() - i * DAY));
    const row = dailyData.find((d) => d.date === date);
    const m = row?.metrics;
    const engagement = m
      ? m.likes + m.comments + m.shares + m.saves + m.clicks
      : 0;
    series.push({
      date,
      views: m?.views ?? 0,
      saves: m?.saves ?? 0,
      followers: followerByDay.get(date) ?? series.at(-1)?.followers ?? 0,
      engagement,
      postCount: row?.postCount ?? 0,
    });
  }

  const followersTotal = followerStats?.accounts?.reduce(
    (acc, a) => acc + a.followerCount,
    0,
  ) ?? series.at(-1)?.followers ?? 0;

  const followersChange = followerStats?.accounts?.reduce(
    (acc, a) => acc + (a.followerCountChange ?? 0),
    0,
  ) ?? 0;

  const followerSummary: MetricSummary = {
    total: followersTotal,
    previous: followersTotal - followersChange,
    delta:
      followersTotal - followersChange === 0
        ? 0
        : followersChange / (followersTotal - followersChange),
    spark: series.slice(-Math.min(range, 30)).map((p) => p.followers),
  };

  const engagementTotal = series.reduce((acc, p) => acc + p.engagement, 0);
  const engagementSummary: MetricSummary = {
    total: engagementTotal,
    previous: Math.round(engagementTotal / (1 + (views.delta || 0) * 0.8)),
    delta: views.delta * 0.9,
    spark: series.map((p) => p.engagement),
  };

  const totals = dailyData
    .filter((d) => {
      const time = new Date(`${d.date}T00:00:00Z`).getTime();
      return time > from.getTime() && time <= to.getTime();
    })
    .reduce(
      (acc, d) => ({
        impressions: acc.impressions + d.metrics.impressions,
        reach: acc.reach + d.metrics.reach,
        likes: acc.likes + d.metrics.likes,
        comments: acc.comments + d.metrics.comments,
        shares: acc.shares + d.metrics.shares,
        saves: acc.saves + d.metrics.saves,
        clicks: acc.clicks + d.metrics.clicks,
        views: acc.views + d.metrics.views,
      }),
      {
        impressions: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        clicks: 0,
        views: 0,
      },
    );

  const { baseline, windowPosts } = computeBaseline30d(posts, now);
  const standout = findStandoutPosts(windowPosts, baseline);
  const topPosts = buildTopPosts(posts, baseline);

  const engagementDenominator = Math.max(totals.views, 1);

  return {
    range,
    series,
    metrics: {
      views,
      saves,
      followers: followerSummary,
      engagement: engagementSummary,
      shares,
      clicks,
    },
    totals,
    averageEngagementRate:
      ((totals.likes + totals.comments + totals.shares + totals.saves) /
        engagementDenominator) *
      100,
    baseline30d: baseline,
    totalPosts: windowPosts.length,
    platformBreakdown: dailyMetrics.platformBreakdown,
    standout,
    topPosts,
    followers: {
      total: followersTotal,
      change: followersChange,
      byPlatform:
        followerStats?.accounts?.map((a) => ({
          platform: a.platform,
          username: a.username,
          count: a.followerCount,
          change: a.followerCountChange ?? 0,
        })) ?? [],
    },
  };
}

function buildFollowerByDay(
  followerStats?: FollowerStatsResponse,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const account of followerStats?.accounts ?? []) {
    for (const point of account.history ?? []) {
      totals.set(point.date, (totals.get(point.date) ?? 0) + point.count);
    }
  }
  return totals;
}

function engagementOf(post: PostAnalyticsEntry): number {
  const a = post.analytics;
  return (
    (a.likes ?? 0) + (a.comments ?? 0) + (a.shares ?? 0) + (a.saves ?? 0)
  );
}

/**
 * Base de comparación: media de `views` de los posts publicados en los últimos
 * 30 días. Un post es "destacado" cuando supera 2x esa media.
 */
export function computeBaseline30d(
  posts: PostAnalyticsEntry[],
  now = new Date(),
): { baseline: number; windowPosts: PostAnalyticsEntry[] } {
  const from = new Date(now.getTime() - 30 * DAY);
  const windowPosts = posts.filter((p) => {
    const published = toDate(p.publishedAt ?? p.scheduledFor);
    return published ? published >= from : false;
  });

  const pool = windowPosts.length > 0 ? windowPosts : posts;
  const totalViews = pool.reduce((acc, p) => acc + (p.analytics.views ?? 0), 0);
  const baseline = pool.length > 0 ? totalViews / pool.length : 0;

  return { baseline, windowPosts };
}

export const STANDOUT_THRESHOLD = 2;

function findStandoutPosts(
  posts: PostAnalyticsEntry[],
  baseline: number,
): StandoutPost[] {
  if (baseline <= 0) return [];

  return posts
    .map((post) => {
      const views = post.analytics.views ?? 0;
      const multiplier = views / baseline;
      return { post, multiplier, reason: explainStandout(post, multiplier) };
    })
    .filter((entry) => entry.multiplier >= STANDOUT_THRESHOLD)
    .sort((a, b) => b.multiplier - a.multiplier);
}

function explainStandout(post: PostAnalyticsEntry, multiplier: number): string {
  const a = post.analytics;
  const views = a.views ?? 0;
  const saveRate = views > 0 ? (a.saves ?? 0) / views : 0;
  const patterns = classifyHook(post.content);

  const bits: string[] = [
    `${multiplier.toFixed(1)}x la media de 30 días`,
  ];

  if (saveRate > 0.03) {
    bits.push(`tasa de guardado del ${(saveRate * 100).toFixed(1)}% (muy alta)`);
  }
  if ((a.shares ?? 0) / Math.max(views, 1) > 0.008) {
    bits.push("alto ratio de compartidos");
  }
  const pattern = PATTERN_BY_ID.get(patterns.patternId);
  if (pattern) bits.push(`hook de tipo «${pattern.name.toLowerCase()}»`);

  return `Destacado: ${bits.join(" · ")}.`;
}

/**
 * Top 5 por views. La explicación se construye a partir de señales medibles
 * (multiplicador sobre la media, tasa de guardado, compartidos, comentarios y
 * el tipo de hook detectado), no de una opinión genérica.
 */
export function buildTopPosts(
  posts: PostAnalyticsEntry[],
  baseline: number,
  limit = 5,
): TopPost[] {
  return posts
    .slice()
    .sort((a, b) => (b.analytics.views ?? 0) - (a.analytics.views ?? 0))
    .slice(0, limit)
    .map((post, index) => {
      const a = post.analytics;
      const views = a.views ?? 0;
      const engagementRate =
        views > 0 ? (engagementOf(post) / views) * 100 : 0;
      const saveRate = views > 0 ? ((a.saves ?? 0) / views) * 100 : 0;
      const shareRate = views > 0 ? ((a.shares ?? 0) / views) * 100 : 0;
      const multiplier = baseline > 0 ? views / baseline : 1;

      const classification = classifyHook(post.content);
      const pattern = PATTERN_BY_ID.get(classification.patternId);
      const patternName = pattern?.name ?? "Hook directo";

      const signals: string[] = [
        `Views: ${views.toLocaleString("es-ES")} (${multiplier.toFixed(1)}x la media de 30 días)`,
        `Engagement: ${engagementRate.toFixed(1)}%`,
        `Guardados: ${saveRate.toFixed(1)}% del alcance`,
        `Compartidos: ${shareRate.toFixed(2)}%`,
        `Hook: ${patternName}${pattern ? ` — «${pattern.template}»` : ""}`,
      ];

      return {
        rank: index + 1,
        post,
        explanation: explainTopPost({
          multiplier,
          engagementRate,
          saveRate,
          shareRate,
          patternName,
          patternRationale: pattern?.rationale,
        }),
        signals,
        patternName,
        engagementRate,
        saveRate,
      };
    });
}

function explainTopPost(input: {
  multiplier: number;
  engagementRate: number;
  saveRate: number;
  shareRate: number;
  patternName: string;
  patternRationale?: string;
}): string {
  const drivers: string[] = [];

  if (input.multiplier >= 2) {
    drivers.push(
      `rindió ${input.multiplier.toFixed(1)}x por encima de la media de los últimos 30 días`,
    );
  } else if (input.multiplier >= 1.3) {
    drivers.push(
      `superó la media de 30 días en un ${((input.multiplier - 1) * 100).toFixed(0)}%`,
    );
  }

  if (input.saveRate >= 3) {
    drivers.push(
      `el ${input.saveRate.toFixed(1)}% de quien lo vio lo guardó, señal fuerte de valor reutilizable`,
    );
  } else if (input.saveRate >= 2) {
    drivers.push("buena tasa de guardado, típica de contenido de referencia");
  }

  if (input.shareRate >= 0.8) {
    drivers.push("mucha redistribución: se compartió fuera de la plataforma");
  }

  if (input.engagementRate >= 8) {
    drivers.push(`engagement del ${input.engagementRate.toFixed(1)}%, muy por encima del 4-6% habitual`);
  }

  const hookLine = input.patternRationale
    ? `El hook es de tipo ${input.patternName.toLowerCase()}: ${input.patternRationale.toLowerCase()}`
    : "El hook entra directo al tema, sin introducción.";

  const body =
    drivers.length > 0
      ? `Destacó porque ${drivers.join(", y ")}.`
      : "Destacó por encima del resto del periodo, con métricas equilibradas.";

  return `${body} ${hookLine}`;
}
