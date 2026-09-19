import { NextResponse, type NextRequest } from "next/server";

import { getTrendSources, listTrends } from "@/lib/domain/repository";

export const dynamic = "force-dynamic";

/** GET /api/trends — noticias de IA clasificadas por potencial de hook. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const [trends, sources] = await Promise.all([
    listTrends({
      sourceId: params.get("sourceId") ?? undefined,
      category: params.get("category") ?? undefined,
      minScore: params.get("minScore")
        ? Number(params.get("minScore"))
        : undefined,
      search: params.get("search") ?? undefined,
      sortBy: params.get("sortBy") === "publishedAt" ? "publishedAt" : "hookScore",
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    }),
    getTrendSources(),
  ]);

  // Resumen por fuente para saber de dónde viene el material de cada semana.
  const bySource = sources.map((source) => {
    const items = trends.filter((t) => t.sourceId === source.id);
    return {
      ...source,
      itemCount: items.length,
      topScore: items.reduce((max, t) => Math.max(max, t.hookScore), 0),
    };
  });

  return NextResponse.json({ trends, sources, bySource });
}
