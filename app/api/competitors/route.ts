import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  addCompetitor,
  listCompetitors,
  listReels,
  listWeeks,
} from "@/lib/domain/repository";
import { NICHES } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  username: z.string().min(2),
  platform: z.string().min(2),
  displayName: z.string().optional(),
  followerCount: z.number().int().nonnegative().optional(),
  niche: z.enum(NICHES).optional(),
});

/**
 * GET /api/competitors
 * Devuelve las cuentas vigiladas, la última semana disponible y su top de reels.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const weeks = await listWeeks();
  const week = params.get("week") ?? weeks[0];

  const [competitors, reels] = await Promise.all([
    listCompetitors(),
    listReels({
      week,
      accountId: params.get("accountId") ?? undefined,
      platform: params.get("platform") ?? undefined,
      search: params.get("search") ?? undefined,
      sortBy: "views",
      order: "desc",
    }),
  ]);

  return NextResponse.json({ competitors, reels, week, weeks });
}

/** POST /api/competitors — añade una cuenta al seguimiento. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const competitor = await addCompetitor(parsed.data);
  return NextResponse.json({ competitor }, { status: 201 });
}
