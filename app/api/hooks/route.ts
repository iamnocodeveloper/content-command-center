import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createHook, listHooks } from "@/lib/domain/repository";
import { NICHES } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const createHookSchema = z.object({
  rawText: z.string().min(4, "El hook necesita al menos 4 caracteres."),
  onScreenText: z.string().optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  saves: z.number().int().nonnegative().optional(),
  creatorHandle: z.string().min(1),
  creatorPlatform: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceReelId: z.string().optional(),
  niche: z.enum(NICHES).optional(),
  patternId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** GET /api/hooks — búsqueda y filtrado de la biblioteca. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const nicheParam = params.get("niche");
  const niche =
    nicheParam && NICHES.includes(nicheParam as (typeof NICHES)[number])
      ? (nicheParam as (typeof NICHES)[number])
      : "all";

  const hooks = await listHooks({
    search: params.get("search") ?? undefined,
    niche,
    type: params.get("type") ?? "all",
    patternId: params.get("patternId") ?? undefined,
    minViews: numberOr(params.get("minViews"), 0),
    maxViews: numberOr(params.get("maxViews"), Number.MAX_SAFE_INTEGER),
    favoritesOnly: params.get("favoritesOnly") === "true",
    sortBy:
      (params.get("sortBy") as "views" | "savedAt" | "saves" | "engagement") ??
      "views",
    order: params.get("order") === "asc" ? "asc" : "desc",
  });

  return NextResponse.json({ hooks, count: hooks.length });
}

/** POST /api/hooks — guarda un hook nuevo (se transcribe a plantilla). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createHookSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const hook = await createHook(parsed.data);
  return NextResponse.json({ hook }, { status: 201 });
}

function numberOr(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
