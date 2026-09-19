/**
 * Tipos de la API de Zernio (https://docs.zernio.com).
 *
 * Se modelan sólo las superficies que consume el dashboard y se mantienen los
 * nombres de campo tal cual los devuelve la API (`_id`, `impressions`, ...) para
 * evitar traducciones que se desincronicen del contrato real.
 */

export const ZERNIO_PLATFORMS = [
  "twitter",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "reddit",
  "bluesky",
  "threads",
  "googlebusiness",
  "telegram",
  "snapchat",
  "whatsapp",
  "discord",
  "slack",
  "shopify",
  "wordpress",
] as const;

export type ZernioPlatform = (typeof ZERNIO_PLATFORMS)[number];

/** Plataformas que el Programador ofrece por defecto. */
export const PRIMARY_PLATFORMS: ZernioPlatform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "threads",
  "linkedin",
  "twitter",
];

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "partial"
  | "cancelled";

export interface ZernioProfile {
  _id: string;
  name: string;
}

export interface ZernioAccount {
  _id: string;
  platform: ZernioPlatform;
  username?: string;
  displayName?: string;
  profileId?: string;
  isActive: boolean;
  followerCount?: number;
  avatarUrl?: string;
}

export interface MediaItem {
  url: string;
  type?: "image" | "video" | "gif" | "document";
  thumbnail?: string;
  altText?: string;
}

export interface PlatformTarget {
  platform: ZernioPlatform;
  accountId: string;
  customMedia?: MediaItem[];
  platformSpecificData?: Record<string, unknown>;
}

export interface CreatePostInput {
  content: string;
  platforms: PlatformTarget[];
  mediaItems?: MediaItem[];
  /** Hora local de pared `YYYY-MM-DDTHH:mm:ss`; se interpreta en `timezone`. */
  scheduledFor?: string;
  /** IANA, p. ej. `America/Mexico_City`. */
  timezone?: string;
  publishNow?: boolean;
  /** Sólo texto; Zernio lo guarda como borrador. */
  isDraft?: boolean;
  firstComment?: string;
}

export interface ZernioPost {
  _id: string;
  content: string;
  status: PostStatus;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  timezone?: string;
  platforms: Array<{
    platform: ZernioPlatform;
    accountId?: string;
    status: string;
    platformPostUrl?: string;
  }>;
  mediaItems?: MediaItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PostAnalytics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  views?: number;
  engagementRate?: number;
  lastUpdated?: string;
  /** Métricas específicas de plataforma (p. ej. `ig_reels_avg_watch_time`). */
  [metric: string]: number | string | undefined;
}

export interface PostAnalyticsEntry {
  postId: string;
  latePostId?: string | null;
  status: string;
  content: string;
  platform: ZernioPlatform;
  platformPostUrl?: string | null;
  thumbnailUrl?: string | null;
  mediaType?: string;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  isExternal?: boolean;
  analytics: PostAnalytics;
  platformAnalytics?: Array<{
    platform: ZernioPlatform;
    accountId?: string;
    accountUsername?: string;
    analytics: PostAnalytics;
    platformPostUrl?: string | null;
  }>;
}

export interface AnalyticsOverview {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  views?: number;
  engagementRate?: number;
}

export interface AnalyticsListResponse {
  overview?: AnalyticsOverview;
  analytics: PostAnalyticsEntry[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
  };
}

export interface DailyMetricsResponse {
  dailyData: Array<{
    date: string;
    postCount: number;
    platforms: Record<string, number>;
    metrics: Required<
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
  }>;
  platformBreakdown: Array<{
    platform: ZernioPlatform;
    postCount: number;
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    views: number;
  }>;
}

export interface FollowerStatsResponse {
  accounts?: Array<{
    accountId: string;
    platform: ZernioPlatform;
    username?: string;
    followerCount: number;
    followerCountChange?: number;
    history?: Array<{ date: string; count: number }>;
  }>;
  /** Forma alternativa devuelta por algunas cuentas. */
  history?: Array<{ date: string; count: number }>;
}

export interface InstagramInsightsResponse {
  data?: Array<{
    name: string;
    period?: string;
    values?: Array<{ value: number; end_time?: string }>;
    total_value?: { value: number };
  }>;
  [key: string]: unknown;
}

export interface MediaPresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

export interface BestTimeToPostSlot {
  dayOfWeek: number;
  hour: number;
  averageEngagement: number;
  postCount: number;
}

export interface ZernioErrorBody {
  error: string;
  message?: string;
  type?: string;
  code?: string;
  param?: string;
  details?: Record<string, unknown>;
}
