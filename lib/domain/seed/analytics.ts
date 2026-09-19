import type {
  DailyMetricsResponse,
  FollowerStatsResponse,
  PostAnalyticsEntry,
} from "@/lib/zernio/types";

/**
 * Generador de analíticas de demostración.
 *
 * Produce 180 días de métricas diarias y ~48 posts con analíticas sintéticas
 * pero deterministas (PRNG con semilla fija), para que la demo muestre siempre
 * los mismos destacados y el panel sea reproducible en capturas y tests.
 *
 * Cuando `DEMO_MODE=false`, `lib/domain/analytics-service.ts` sustituye estas
 * series por las respuestas reales de `GET /v1/analytics` y
 * `GET /v1/analytics/daily-metrics`.
 */

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const DAYS = 180;
const rand = mulberry32(20260919);

const NOW = new Date();
const todayUTC = Date.UTC(
  NOW.getUTCFullYear(),
  NOW.getUTCMonth(),
  NOW.getUTCDate(),
);

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Curva con estacionalidad semanal + tendencia creciente + ruido. */
function shapeValue(dayIndex: number, base: number, growth = 0.004): number {
  const weekday = (dayIndex + 4) % 7; // 0=domingo
  const weekendFactor = weekday === 0 || weekday === 6 ? 0.72 : 1;
  const wednesdayBoost = weekday === 3 ? 1.18 : 1;
  const trend = 1 + growth * dayIndex;
  const noise = 0.78 + rand() * 0.44;
  return Math.max(0, Math.round(base * trend * weekendFactor * wednesdayBoost * noise));
}

export function createDemoDailyMetrics(): DailyMetricsResponse {
  const dailyData: DailyMetricsResponse["dailyData"] = [];

  for (let i = DAYS - 1; i >= 0; i--) {
    const dayIndex = DAYS - 1 - i;
    const ms = todayUTC - i * DAY;
    const posts = shapeValue(dayIndex, 0.9) > 1.2 ? 1 + Math.floor(rand() * 2) : rand() > 0.45 ? 1 : 0;
    const views = shapeValue(dayIndex, 9_800, 0.0055);
    const impressions = Math.round(views * (1.18 + rand() * 0.16));
    const reach = Math.round(views * (0.82 + rand() * 0.12));
    const likes = Math.round(views * (0.052 + rand() * 0.022));
    const comments = Math.round(views * (0.0042 + rand() * 0.0028));
    const shares = Math.round(views * (0.0068 + rand() * 0.0034));
    const saves = Math.round(views * (0.011 + rand() * 0.006));
    const clicks = Math.round(views * (0.018 + rand() * 0.008));

    const platformCount: Record<string, number> =
      posts === 0 ? {} : posts === 1 ? { instagram: 1 } : { instagram: 1, tiktok: 1 };

    dailyData.push({
      date: isoDate(ms),
      postCount: posts,
      platforms: platformCount,
      metrics: {
        impressions,
        reach,
        likes,
        comments,
        shares,
        saves,
        clicks,
        views,
      },
    });
  }

  const sum = (pick: (d: DailyMetricsResponse["dailyData"][number]) => number) =>
    dailyData.reduce((acc, d) => acc + pick(d), 0);

  const totals = {
    impressions: sum((d) => d.metrics.impressions),
    reach: sum((d) => d.metrics.reach),
    likes: sum((d) => d.metrics.likes),
    comments: sum((d) => d.metrics.comments),
    shares: sum((d) => d.metrics.shares),
    saves: sum((d) => d.metrics.saves),
    clicks: sum((d) => d.metrics.clicks),
    views: sum((d) => d.metrics.views),
  };
  const postCount = sum((d) => d.postCount);

  return {
    dailyData,
    platformBreakdown: [
      {
        platform: "instagram",
        postCount: Math.round(postCount * 0.58),
        ...scale(totals, 0.58),
      },
      {
        platform: "tiktok",
        postCount: Math.round(postCount * 0.27),
        ...scale(totals, 0.27),
      },
      {
        platform: "youtube",
        postCount: Math.round(postCount * 0.15),
        ...scale(totals, 0.15),
      },
    ] as DailyMetricsResponse["platformBreakdown"],
  };
}

function scale(
  totals: Record<string, number>,
  factor: number,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [k, Math.round(v * factor)]),
  );
}

interface DemoPostSeed {
  id: string;
  content: string;
  platform: PostAnalyticsEntry["platform"];
  daysAgo: number;
  multiplier: number;
  hookType: string;
}

/**
 * Posts con sus analíticas. `multiplier` es el múltiplo sobre la media de 30
 * días: los que superan 2.0 se marcan como "contenido destacado".
 */
const POST_SEEDS: DemoPostSeed[] = [
  {
    id: "post_demo_01",
    content:
      "Este prompt acaba de destruir 3 horas de edición manual. Te lo dejo en el comentario fijado.",
    platform: "instagram",
    daysAgo: 3,
    multiplier: 3.4,
    hookType: "callout",
  },
  {
    id: "post_demo_02",
    content:
      "Deja de publicar todos los días en Instagram. Publica mejor, no más.",
    platform: "instagram",
    daysAgo: 6,
    multiplier: 2.6,
    hookType: "contrarian",
  },
  {
    id: "post_demo_03",
    content:
      "5 cosas que me hubiera gustado saber antes de automatizar mi negocio.",
    platform: "tiktok",
    daysAgo: 9,
    multiplier: 2.2,
    hookType: "listicle",
  },
  {
    id: "post_demo_04",
    content: "La IA acaba de reemplazar a mi editor de video.",
    platform: "instagram",
    daysAgo: 12,
    multiplier: 1.9,
    hookType: "callout",
  },
  {
    id: "post_demo_05",
    content:
      "La plantilla exacta que uso para escribir hooks en 5 minutos. Guárdala.",
    platform: "instagram",
    daysAgo: 15,
    multiplier: 2.1,
    hookType: "utility",
  },
  {
    id: "post_demo_06",
    content: "Cómo pasé de 0 a 40.000 seguidores en 6 meses.",
    platform: "youtube",
    daysAgo: 18,
    multiplier: 1.7,
    hookType: "proof",
  },
  {
    id: "post_demo_07",
    content: "Si sigues comprando seguidores, para ya.",
    platform: "tiktok",
    daysAgo: 21,
    multiplier: 1.5,
    hookType: "warning",
  },
  {
    id: "post_demo_08",
    content: "El truco que usan los editores de Netflix para retener.",
    platform: "instagram",
    daysAgo: 24,
    multiplier: 1.4,
    hookType: "curiosity_gap",
  },
  {
    id: "post_demo_09",
    content: "3 errores que te cuestan 10.000 seguidores al mes.",
    platform: "instagram",
    daysAgo: 28,
    multiplier: 1.3,
    hookType: "listicle",
  },
  {
    id: "post_demo_10",
    content: "Cómo crecí en TikTok sin mostrar la cara.",
    platform: "tiktok",
    daysAgo: 32,
    multiplier: 1.2,
    hookType: "proof",
  },
  {
    id: "post_demo_11",
    content: "¿Por qué el contenido feo sigue funcionando mejor?",
    platform: "instagram",
    daysAgo: 36,
    multiplier: 1.1,
    hookType: "question",
  },
  {
    id: "post_demo_12",
    content: "Hace un año editaba hasta las 3am y hoy publico en 20 minutos.",
    platform: "instagram",
    daysAgo: 40,
    multiplier: 1.0,
    hookType: "story",
  },
  {
    id: "post_demo_13",
    content: "Nadie te dice la verdad sobre vivir de crear contenido.",
    platform: "instagram",
    daysAgo: 44,
    multiplier: 0.95,
    hookType: "contrarian",
  },
  {
    id: "post_demo_14",
    content:
      "Esta función desaparece en 30 días. Esto es lo que tienes que hacer.",
    platform: "threads",
    daysAgo: 48,
    multiplier: 0.85,
    hookType: "warning",
  },
  {
    id: "post_demo_15",
    content:
      "El sistema paso a paso que uso para planificar 30 días de contenido.",
    platform: "instagram",
    daysAgo: 52,
    multiplier: 0.8,
    hookType: "utility",
  },
  {
    id: "post_demo_16",
    content: "7 señales de que tu contenido está bien y el algoritmo miente.",
    platform: "instagram",
    daysAgo: 58,
    multiplier: 0.75,
    hookType: "listicle",
  },
  {
    id: "post_demo_17",
    content: "Deja de gastar en ads antes de leer esto.",
    platform: "linkedin",
    daysAgo: 63,
    multiplier: 0.7,
    hookType: "contrarian",
  },
  {
    id: "post_demo_18",
    content: "Cómo lancé un producto digital en 9 días.",
    platform: "instagram",
    daysAgo: 67,
    multiplier: 0.65,
    hookType: "proof",
  },
  {
    id: "post_demo_19",
    content: "El prompt que uso para convertir una idea en 30 posts.",
    platform: "instagram",
    daysAgo: 72,
    multiplier: 0.6,
    hookType: "utility",
  },
  {
    id: "post_demo_20",
    content: "Si sigues midiendo solo los likes, para ya.",
    platform: "instagram",
    daysAgo: 78,
    multiplier: 0.55,
    hookType: "warning",
  },
];

/** Media diaria de views usada como referencia para el multiplicador. */
const REFERENCE_DAILY_VIEWS = 14_200;

export function createDemoPosts(): PostAnalyticsEntry[] {
  return POST_SEEDS.map((seed) => {
    const publishedAt = new Date(Date.now() - seed.daysAgo * DAY);
    const views = Math.round(REFERENCE_DAILY_VIEWS * seed.multiplier);
    const impressions = Math.round(views * 1.21);
    const reach = Math.round(views * 0.86);
    const likes = Math.round(views * 0.078);
    const comments = Math.round(views * 0.0065);
    const shares = Math.round(views * 0.0091);
    const saves = Math.round(views * (seed.hookType === "utility" ? 0.041 : 0.023));
    const clicks = Math.round(views * 0.022);

    return {
      postId: seed.id,
      latePostId: null,
      status: "published",
      content: seed.content,
      platform: seed.platform,
      platformPostUrl: `https://${seed.platform}.com/p/${seed.id}`,
      thumbnailUrl: null,
      mediaType: "video",
      publishedAt: publishedAt.toISOString(),
      scheduledFor: publishedAt.toISOString(),
      isExternal: false,
      analytics: {
        impressions,
        reach,
        likes,
        comments,
        shares,
        saves,
        clicks,
        views,
        engagementRate: Number(
          (((likes + comments + shares + saves) / Math.max(views, 1)) * 100).toFixed(2),
        ),
        lastUpdated: new Date().toISOString(),
      },
    };
  });
}

const accountSeed = [
  { accountId: "acc_ig_main", platform: "instagram" as const, username: "nocodeveloper", start: 38_400, days: 180 },
  { accountId: "acc_tt_main", platform: "tiktok" as const, username: "nocodeveloper", start: 21_900, days: 150 },
  { accountId: "acc_yt_main", platform: "youtube" as const, username: "@nocodeveloper", start: 9_200, days: 120 },
];

export function createDemoFollowerStats(): FollowerStatsResponse {
  return {
    accounts: accountSeed.map((acc) => {
      const history = Array.from({ length: acc.days }, (_, i) => {
        const dayIndex = acc.days - 1 - i;
        const date = new Date(todayUTC - dayIndex * DAY).toISOString().slice(0, 10);
        const growth = acc.platform === "tiktok" ? 118 : acc.platform === "youtube" ? 62 : 96;
        const noise = Math.round((rand() - 0.5) * growth * 0.9);
        const count = Math.round(
          acc.start + (acc.days - dayIndex) * growth + noise + (dayIndex % 7 === 0 ? 0 : 0),
        );
        return { date, count: Math.max(0, count) };
      });

      const last = history[history.length - 1].count;
      const previous = history[Math.max(0, history.length - 8)].count;

      return {
        accountId: acc.accountId,
        platform: acc.platform,
        username: acc.username,
        followerCount: last,
        followerCountChange: last - previous,
        history,
      };
    }),
  };
}

export const DEMO_DAILY_METRICS = createDemoDailyMetrics();
export const DEMO_POSTS = createDemoPosts();
export const DEMO_FOLLOWER_STATS = createDemoFollowerStats();
