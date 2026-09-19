import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NICHES } from "@/lib/domain/types";
import { generateHookVariants } from "@/lib/services/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  base: z.string().min(4, "Falta el hook de referencia."),
  niche: z.enum(NICHES).default("marketing"),
  count: z.number().int().min(1).max(10).default(5),
  patterns: z.array(z.string()).optional(),
});

/**
 * POST /api/ai/hooks
 * Genera variaciones del mismo hook usando el catálogo de plantillas.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await generateHookVariants(parsed.data);
  return NextResponse.json(result);
}
