import { NextResponse, type NextRequest } from "next/server";

import { getTikTokCreatorInfo } from "@/lib/zernio/accounts";
import { ZernioError } from "@/lib/zernio/client";
import { isDemoMode } from "@/lib/zernio/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/tiktok/creator-info?accountId=…
 *
 * Informa al Programador de los `privacyLevels` y toggles reales de la cuenta
 * TikTok. En modo demo devuelve una lista vacía para que la UI caiga a su
 * valor por defecto.
 */
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId")?.trim();

  if (!accountId) {
    return NextResponse.json({ error: "Falta accountId." }, { status: 400 });
  }

  if (isDemoMode()) {
    return NextResponse.json({ privacyLevels: [] });
  }

  try {
    return NextResponse.json(await getTikTokCreatorInfo(accountId));
  } catch (error) {
    const message =
      error instanceof ZernioError
        ? error.message
        : "No se pudo leer la información de TikTok.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
