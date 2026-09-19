import { NextResponse } from "next/server";

import { getAccounts } from "@/lib/domain/zernio-gateway";
import { getProfileId, isDemoMode } from "@/lib/zernio/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/status
 * Estado de la integración: modo, perfil y cuentas conectadas.
 */
export async function GET() {
  const demo = isDemoMode();
  const accounts = await getAccounts();

  return NextResponse.json({
    demo,
    profileId: getProfileId() ?? null,
    source: accounts.source,
    warning: accounts.warning ?? null,
    accounts: accounts.data.map((a) => ({
      id: a._id,
      platform: a.platform,
      username: a.username,
      displayName: a.displayName,
      isActive: a.isActive,
      followerCount: a.followerCount,
    })),
  });
}
