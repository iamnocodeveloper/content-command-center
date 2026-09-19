import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NICHES } from "@/lib/domain/types";
import { generateCaptions, plainCaption } from "@/lib/services/captions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  hook: z.string().min(4, "Falta el hook."),
  angle: z.string().min(2, "Falta el ángulo de contenido."),
  niche: z.enum(NICHES).default("marketing"),
  platforms: z.array(z.string().min(2)).min(1, "Elige al menos una plataforma."),
  notes: z.string().optional(),
  durationSeconds: z.number().int().positive().max(600).optional(),
});

/** POST /api/captions — genera captions por plataforma a partir de hook + ángulo. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await generateCaptions(parsed.data);

  return NextResponse.json({
    provider: result.provider,
    variants: result.variants.map((variant) => ({
      ...variant,
      full: plainCaption(variant),
    })),
  });
}
