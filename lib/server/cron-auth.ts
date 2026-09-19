import { NextResponse, type NextRequest } from "next/server";

/**
 * Autorización de los endpoints de cron.
 *
 * Vercel Cron envía `Authorization: Bearer $CRON_SECRET` cuando la variable
 * está definida. En desarrollo, si `CRON_SECRET` no existe, el endpoint queda
 * abierto para poder probarlo a mano con `curl`.
 */
export function assertCronAuthorized(
  request: NextRequest,
): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return null;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return null;

  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}
