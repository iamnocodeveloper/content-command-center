import { zernioFetch } from "@/lib/zernio/client";
import type {
  AnalyticsListResponse,
  BestTimeToPostSlot,
  DailyMetricsResponse,
  InstagramInsightsResponse,
  PostAnalyticsEntry,
} from "@/lib/zernio/types";

interface AnalyticsQuery {
  profileId?: string;
  accountId?: string;
  platform?: string;
  source?: "all" | "late" | "external";
  fromDate?: string;
  toDate?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  order?: "asc" | "desc";
}

/** GET /v1/analytics */
export async function getAnalytics(
  query: AnalyticsQuery = {},
): Promise<AnalyticsListResponse> {
  return zernioFetch<AnalyticsListResponse>("/analytics", {
    query: {
      profileId: query.profileId,
      accountId: query.accountId,
      platform: query.platform,
      source: query.source ?? "all",
      fromDate: query.fromDate,
      toDate: query.toDate,
      limit: query.limit ?? 100,
      page: query.page ?? 1,
      sortBy: query.sortBy,
      order: query.order,
    },
  });
}

/** GET /v1/analytics — detalle de un post concreto. */
export async function getPostAnalytics(
  postId: string,
): Promise<PostAnalyticsEntry | null> {
  return zernioFetch<PostAnalyticsEntry | null>("/analytics", {
    query: { postId },
  });
}

/** GET /v1/analytics/daily-metrics */
export async function getDailyMetrics(params: {
  profileId?: string;
  accountId?: string;
  platform?: string;
  fromDate?: string;
  toDate?: string;
  attribution?: "publish" | "received";
} = {}): Promise<DailyMetricsResponse> {
  return zernioFetch<DailyMetricsResponse>("/analytics/daily-metrics", {
    query: {
      profileId: params.profileId,
      accountId: params.accountId,
      platform: params.platform,
      fromDate: params.fromDate,
      toDate: params.toDate,
      attribution: params.attribution,
    },
  });
}

/** GET /v1/analytics/best-time-to-post */
export async function getBestTimeToPost(params: {
  profileId?: string;
  platform?: string;
} = {}): Promise<{ slots: BestTimeToPostSlot[] }> {
  return zernioFetch<{ slots: BestTimeToPostSlot[] }>(
    "/analytics/best-time-to-post",
    { query: { profileId: params.profileId, platform: params.platform } },
  );
}

/** GET /v1/analytics/instagram/account-insights */
export async function getInstagramInsights(params: {
  accountId: string;
  metrics?: string;
  period?: string;
}): Promise<InstagramInsightsResponse> {
  return zernioFetch<InstagramInsightsResponse>(
    "/analytics/instagram/account-insights",
    {
      query: {
        accountId: params.accountId,
        metrics: params.metrics,
        period: params.period,
      },
    },
  );
}
