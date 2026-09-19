import { NextResponse } from "next/server";

import { getAccounts } from "@/lib/domain/zernio-gateway";

export const dynamic = "force-dynamic";

/** GET /api/accounts — cuentas conectadas (Zernio o demo). */
export async function GET() {
  const result = await getAccounts();
  return NextResponse.json(result);
}
