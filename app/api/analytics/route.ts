import { NextResponse, type NextRequest } from "next/server";

import { getAnalyticsSnapshot } from "@/lib/domain/zernio-gateway";
import type { RangeKey } from "@/lib/domain/analytics-service";

export const dynamic = "force-dynamic";

const VALID_RANGES: RangeKey[] = [7, 30, 90];

/** GET /api/analytics?range=7|30|90 */
export async function GET(request: NextRequest) {
  const rangeParam = Number(request.nextUrl.searchParams.get("range") ?? 30);
  const range: RangeKey = VALID_RANGES.includes(rangeParam as RangeKey)
    ? (rangeParam as RangeKey)
    : 30;

  const result = await getAnalyticsSnapshot(range);

  return NextResponse.json({
    source: result.source,
    warning: result.warning ?? null,
    snapshot: result.data,
  });
}
