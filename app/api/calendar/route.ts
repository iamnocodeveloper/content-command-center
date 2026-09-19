import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  listHooks,
  listPlanEntries,
  listTrends,
  removePlanEntry,
  setPlanEntryZernioId,
  upsertPlanEntry,
} from "@/lib/domain/repository";
import { autoFillMonth } from "@/lib/services/calendar-service";
import { getPosts } from "@/lib/domain/zernio-gateway";
import { NICHES } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const autoFillSchema = z.object({
  action: z.literal("autofill"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado: YYYY-MM"),
  perWeek: z.number().int().min(1).max(7).default(3),
  platforms: z.array(z.string()).default(["instagram"]),
  niche: z.enum(NICHES).optional(),
  preferredHour: z.number().int().min(0).max(23).optional(),
});

const upsertSchema = z.object({
  action: z.literal("upsert"),
  entry: z.object({
    id: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    platform: z.string(),
    hookId: z.string().optional(),
    hookText: z.string(),
    angle: z.string(),
    caption: z.string(),
    status: z.enum(["idea", "script", "scheduled", "published"]),
    zernioPostId: z.string().optional(),
    createdAt: z.string(),
  }),
});

const linkSchema = z.object({
  action: z.literal("link"),
  entryId: z.string(),
  zernioPostId: z.string(),
});

const bodySchema = z.discriminatedUnion("action", [
  autoFillSchema,
  upsertSchema,
  linkSchema,
  z.object({ action: z.literal("remove"), entryId: z.string() }),
]);

/**
 * GET /api/calendar?month=YYYY-MM
 * Devuelve el plan local del mes cruzado con los posts programados en Zernio.
 */
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") ?? undefined;

  const fromDate = month ? `${month}-01` : undefined;
  const toDate = month ? endOfMonth(month) : undefined;

  const [entries, posts] = await Promise.all([
    listPlanEntries(),
    getPosts({ fromDate, toDate, limit: 100 }),
  ]);

  const filtered = month
    ? entries.filter((e) => e.date.startsWith(month))
    : entries;

  return NextResponse.json({
    entries: filtered,
    posts: posts.data,
    source: posts.source,
    warning: posts.warning ?? null,
  });
}

/** POST /api/calendar — autofill del mes o alta/edición de una entrada. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  if (payload.action === "autofill") {
    const [hooks, trends] = await Promise.all([
      listHooks({ sortBy: "views", order: "desc" }),
      listTrends({ minScore: 80, limit: 12 }),
    ]);

    const result = await autoFillMonth({
      month: payload.month,
      perWeek: payload.perWeek,
      platforms: payload.platforms,
      niche: payload.niche,
      hooks,
      trends,
      preferredHour: payload.preferredHour,
    });

    for (const entry of result.entries) {
      await upsertPlanEntry(entry);
    }

    return NextResponse.json(result, { status: 201 });
  }

  if (payload.action === "upsert") {
    const entry = await upsertPlanEntry(payload.entry);
    return NextResponse.json({ entry }, { status: 201 });
  }

  if (payload.action === "link") {
    await setPlanEntryZernioId(payload.entryId, payload.zernioPostId);
    return NextResponse.json({ ok: true });
  }

  const removed = await removePlanEntry(payload.entryId);
  return NextResponse.json({ ok: removed }, { status: removed ? 200 : 404 });
}

function endOfMonth(month: string): string {
  const [year, monthPart] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthPart, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}
