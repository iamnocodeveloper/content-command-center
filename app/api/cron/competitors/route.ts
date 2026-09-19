import { NextResponse, type NextRequest } from "next/server";

import { listCompetitors, listReels } from "@/lib/domain/repository";
import { createSeedReels } from "@/lib/domain/seed/competitors";
import { assertCronAuthorized } from "@/lib/server/cron-auth";
import type { CompetitorReel } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/competitors
 *
 * Job semanal (domingos 06:00, ver vercel.json). Recorre las cuentas vigiladas,
 * toma los 5 Reels con mejor rendimiento de la semana, transcribe el audio y
 * extrae el hook y el texto en pantalla.
 *
 * En modo demo devuelve la captura semanal ya procesada; el pipeline real queda
 * documentado paso a paso en docs/06-integraciones.md.
 */
export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const competitors = await listCompetitors();
  const isDemo = process.env.DEMO_MODE !== "false";

  if (isDemo) {
    const reels = createSeedReels();
    return NextResponse.json({
      mode: "demo",
      message:
        "Modo demo: se sirve la captura semanal ya procesada. Pon DEMO_MODE=false para lanzar el pipeline real.",
      competitors: competitors.length,
      reels: reels.length,
      week: reels[0]?.week ?? null,
      durationMs: Date.now() - startedAt,
    });
  }

  // Pipeline real (requiere cuentas conectadas y el add-on de Analytics):
  //  1. GET /v1/accounts                          -> resolver accountIds.
  //  2. GET /v1/accounts/{accountId}/posts        -> posts nativos de la semana.
  //  3. GET /v1/analytics?postId={id}&platform=   -> métricas por post.
  //  4. Ordenar por views y quedarse con el top 5 de cada cuenta.
  //  5. transcribe({ mediaUrl })                  -> audio a texto.
  //  6. extractHook(transcript)                   -> hook hablado.
  //  7. Persistir los CompetitorReel de la semana.
  const ingested: CompetitorReel[] = [];

  return NextResponse.json({
    mode: "live",
    week: isoWeek(new Date()),
    competitors: competitors.length,
    ingested: ingested.length,
    note:
      "El pipeline real necesita cuentas conectadas en Zernio y el add-on de Analytics.",
    durationMs: Date.now() - startedAt,
  });
}

/** Nº de reels disponibles por semana, útil para monitorizar la ingesta. */
export async function POST(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const reels = await listReels();
  const byWeek = reels.reduce<Record<string, number>>((acc, reel) => {
    acc[reel.week] = (acc[reel.week] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ byWeek, total: reels.length });
}

function isoWeek(date: Date): string {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
