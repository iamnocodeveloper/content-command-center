import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NICHES } from "@/lib/domain/types";
import { rewriteCaption } from "@/lib/services/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  caption: z.string().min(2, "Falta la caption."),
  platform: z.string().min(2).default("instagram"),
  niche: z.enum(NICHES).default("marketing"),
  hook: z.string().optional(),
});

/**
 * POST /api/ai/rewrite
 * Reescribe una caption con el modelo configurado, conservando el hook literal.
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

  const result = await rewriteCaption(parsed.data);
  return NextResponse.json(result);
}
