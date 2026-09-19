import { listAccounts as zernioListAccounts } from "@/lib/zernio/accounts";
import {
  getAnalytics as zernioGetAnalytics,
  getDailyMetrics as zernioGetDailyMetrics,
} from "@/lib/zernio/analytics";
import {
  createPost as zernioCreatePost,
  listPosts as zernioListPosts,
} from "@/lib/zernio/posts";
import { getProfileId, isDemoMode } from "@/lib/zernio/config";
import { getFollowerStats as zernioGetFollowerStats } from "@/lib/zernio/accounts";
import {
  DEMO_ACCOUNTS,
  DEMO_SCHEDULED_POSTS,
} from "@/lib/domain/seed/accounts";
import {
  DEMO_DAILY_METRICS,
  DEMO_FOLLOWER_STATS,
  DEMO_POSTS,
} from "@/lib/domain/seed/analytics";
import {
  buildAnalyticsSnapshot,
  type AnalyticsSnapshot,
  type RangeKey,
} from "@/lib/domain/analytics-service";
import type {
  CreatePostInput,
  DailyMetricsResponse,
  FollowerStatsResponse,
  PostAnalyticsEntry,
  PostStatus,
  ZernioAccount,
  ZernioPost,
} from "@/lib/zernio/types";

/**
 * Pasarela única hacia Zernio.
 *
 * Cada función consulta la API real cuando hay credenciales y `DEMO_MODE=false`,
 * y cae a los datos semilla en caso contrario. Si la API falla en runtime
 * (403 sin add-on de Analytics, token caducado, límite de peticiones...) se
 * degrada a la demo en lugar de romper la página, dejando constancia en el
 * campo `source` del resultado.
 */

export interface GatewayResult<T> {
  data: T;
  source: "zernio" | "demo";
  warning?: string;
}

function demo<T>(data: T, warning?: string): GatewayResult<T> {
  return { data, source: "demo", warning };
}

function live<T>(data: T): GatewayResult<T> {
  return { data, source: "zernio" };
}

export async function getAccounts(): Promise<GatewayResult<ZernioAccount[]>> {
  if (isDemoMode()) return demo(DEMO_ACCOUNTS);

  try {
    const accounts = await zernioListAccounts({ profileId: getProfileId() });
    return live(accounts.length > 0 ? accounts : DEMO_ACCOUNTS);
  } catch (error) {
    return demo(DEMO_ACCOUNTS, describe(error));
  }
}

export interface PostQuery {
  status?: PostStatus | "all";
  platform?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export async function getPosts(
  query: PostQuery = {},
): Promise<GatewayResult<ZernioPost[]>> {
  if (isDemoMode()) {
    return demo(filterDemoPosts(DEMO_SCHEDULED_POSTS, query));
  }

  try {
    const posts = await zernioListPosts({
      profileId: getProfileId(),
      status: query.status,
      platform: query.platform,
      fromDate: query.fromDate,
      toDate: query.toDate,
      limit: query.limit,
    });
    return live(posts);
  } catch (error) {
    return demo(filterDemoPosts(DEMO_SCHEDULED_POSTS, query), describe(error));
  }
}

function filterDemoPosts(posts: ZernioPost[], query: PostQuery): ZernioPost[] {
  let result = posts;
  if (query.status && query.status !== "all") {
    result = result.filter((p) => p.status === query.status);
  }
  if (query.platform) {
    result = result.filter((p) =>
      p.platforms.some((pl) => pl.platform === query.platform),
    );
  }
  if (query.fromDate) {
    result = result.filter(
      (p) => (p.scheduledFor ?? "") >= `${query.fromDate}T00:00:00`,
    );
  }
  if (query.toDate) {
    result = result.filter(
      (p) => (p.scheduledFor ?? "") <= `${query.toDate}T23:59:59`,
    );
  }
  return query.limit ? result.slice(0, query.limit) : result;
}

export async function getAnalyticsSnapshot(
  range: RangeKey,
): Promise<
  GatewayResult<AnalyticsSnapshot> & { posts: PostAnalyticsEntry[] }
> {
  if (isDemoMode()) {
    const snapshot = buildAnalyticsSnapshot({
      dailyMetrics: DEMO_DAILY_METRICS,
      posts: DEMO_POSTS,
      followerStats: DEMO_FOLLOWER_STATS,
      range,
    });
    return { ...demo(snapshot), posts: DEMO_POSTS };
  }

  try {
    const now = new Date();
    const fromDate = new Date(now.getTime() - (range + range) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const toDate = now.toISOString().slice(0, 10);

    const [daily, analytics, followers] = await Promise.all([
      zernioGetDailyMetrics({
        profileId: getProfileId(),
        fromDate,
        toDate,
      }),
      zernioGetAnalytics({
        profileId: getProfileId(),
        fromDate,
        toDate,
        limit: 100,
        sortBy: "views",
      }),
      zernioGetFollowerStats({ profileId: getProfileId() }).catch(
        () => undefined,
      ),
    ]);

    const posts = analytics.analytics ?? [];
    const snapshot = buildAnalyticsSnapshot({
      dailyMetrics: daily,
      posts,
      followerStats: followers,
      range,
    });

    return { ...live(snapshot), posts };
  } catch (error) {
    const snapshot = buildAnalyticsSnapshot({
      dailyMetrics: DEMO_DAILY_METRICS,
      posts: DEMO_POSTS,
      followerStats: DEMO_FOLLOWER_STATS,
      range,
    });
    return { ...demo(snapshot, describe(error)), posts: DEMO_POSTS };
  }
}

export async function getDailyMetricsRaw(): Promise<
  GatewayResult<DailyMetricsResponse>
> {
  if (isDemoMode()) return demo(DEMO_DAILY_METRICS);
  try {
    return live(
      await zernioGetDailyMetrics({ profileId: getProfileId() }),
    );
  } catch (error) {
    return demo(DEMO_DAILY_METRICS, describe(error));
  }
}

export async function getFollowerStatsRaw(): Promise<
  GatewayResult<FollowerStatsResponse>
> {
  if (isDemoMode()) return demo(DEMO_FOLLOWER_STATS);
  try {
    return live(await zernioGetFollowerStats({ profileId: getProfileId() }));
  } catch (error) {
    return demo(DEMO_FOLLOWER_STATS, describe(error));
  }
}

export interface PublishResult {
  post: ZernioPost;
  simulated: boolean;
}

/**
 * Publica o programa contenido.
 *
 * En demo no se llama a la API: se sintetiza el post que Zernio devolvería, con
 * el mismo contrato, para que la UI pueda mostrar el estado real.
 */
export async function publish(
  input: CreatePostInput,
): Promise<PublishResult> {
  if (isDemoMode()) {
    return { post: simulatePost(input), simulated: true };
  }

  const post = await zernioCreatePost(input);
  return { post, simulated: false };
}

function simulatePost(input: CreatePostInput): ZernioPost {
  const id = `post_demo_${Date.now().toString(36)}`;
  const status: PostStatus = input.publishNow
    ? "published"
    : input.scheduledFor
      ? "scheduled"
      : "draft";

  return {
    _id: id,
    content: input.content,
    status,
    scheduledFor: input.scheduledFor
      ? new Date(input.scheduledFor).toISOString()
      : null,
    publishedAt: input.publishNow ? new Date().toISOString() : null,
    timezone: input.timezone,
    platforms: input.platforms.map((p) => ({
      platform: p.platform,
      accountId: p.accountId,
      status: input.publishNow ? "published" : "pending",
    })),
    mediaItems: input.mediaItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Zernio no respondió; se usan datos de demostración.";
}
