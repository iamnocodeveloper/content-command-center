import { zernioFetch } from "@/lib/zernio/client";
import type { ZernioAccount, ZernioProfile } from "@/lib/zernio/types";

/** GET /v1/accounts */
export async function listAccounts(params: {
  profileId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<ZernioAccount[]> {
  const { accounts } = await zernioFetch<{ accounts: ZernioAccount[] }>(
    "/accounts",
    {
      query: {
        profileId: params.profileId,
        page: params.page,
        limit: params.limit,
      },
    },
  );
  return accounts ?? [];
}

/** POST /v1/profiles */
export async function createProfile(name: string): Promise<ZernioProfile> {
  const { profile } = await zernioFetch<{ profile: ZernioProfile }>(
    "/profiles",
    { method: "POST", body: { name } },
  );
  return profile;
}

/** GET /v1/connect/{platform} — devuelve la URL de autorización OAuth. */
export async function getConnectUrl(
  platform: string,
  profileId: string,
  redirectUrl?: string,
): Promise<string> {
  const { authUrl } = await zernioFetch<{ authUrl: string }>(
    `/connect/${platform}`,
    { query: { profileId, redirect_url: redirectUrl } },
  );
  return authUrl;
}

/**
 * GET /v1/accounts/follower-stats
 * El seguimiento de seguidores requiere el add-on de Analytics en Zernio.
 */
export async function getFollowerStats(params: {
  profileId?: string;
  accountId?: string;
  fromDate?: string;
  toDate?: string;
} = {}) {
  return zernioFetch<import("@/lib/zernio/types").FollowerStatsResponse>(
    "/accounts/follower-stats",
    {
      query: {
        profileId: params.profileId,
        accountId: params.accountId,
        fromDate: params.fromDate,
        toDate: params.toDate,
      },
    },
  );
}
