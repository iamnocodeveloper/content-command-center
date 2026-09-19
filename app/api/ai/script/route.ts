import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NICHES } from "@/lib/domain/types";
import { generateScript } from "@/lib/services/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  hook: z.string().min(4, "Falta el hook."),
  angle: z.string().min(2, "Falta el ángulo de contenido."),
  niche: z.enum(NICHES).default("marketing"),
  platform: z.string().min(2).default("instagram"),
  durationSeconds: z.number().int().positive().max(600).optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/ai/script
 * Convierte un hook + ángulo en un guion por bloques con caption y hashtags.
 * Si el proveedor de IA no está configurado, devuelve la versión heurística.
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

  const script = await generateScript(parsed.data);

  return NextResponse.json({
    ...script,
    captionFull: script.caption
      ? `${script.caption}\n\n${script.hashtags.map((tag) => `#${tag}`).join(" ")}`.trim()
      : "",
  });
}
