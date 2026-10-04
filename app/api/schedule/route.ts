import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { publish } from "@/lib/domain/zernio-gateway";
import { ZERNIO_PLATFORMS } from "@/lib/zernio/types";
import { getDefaultTimezone } from "@/lib/zernio/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z
  .object({
    /** Opcional cuando hay `mediaItems` (Instagram, TikTok y YouTube exigen media). */
    content: z.string().default(""),
    /** `HH:mm` en formato de 24 h, junto con `date`. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD).").optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:mm).").optional(),
    timezone: z.string().optional(),
    publishNow: z.boolean().optional(),
    isDraft: z.boolean().optional(),
    firstComment: z.string().optional(),
    mediaItems: z
      .array(
        z.object({
          url: z.string().url(),
          type: z.enum(["image", "video", "gif", "document"]).optional(),
        }),
      )
      .optional(),
    platforms: z
      .array(
        z.object({
          platform: z.enum(ZERNIO_PLATFORMS),
          accountId: z.string().min(1),
          /** Opciones por plataforma/cuenta: `contentType` (story/reel), etc. */
          platformSpecificData: z.record(z.unknown()).optional(),
        }),
      )
      .min(1, "Selecciona al menos una cuenta destino."),
    /** Ajustes de TikTok; la API los exige en todo post a esa plataforma. */
    tiktokSettings: z.record(z.unknown()).optional(),
  })
  .refine((data) => data.content.trim().length > 0 || (data.mediaItems?.length ?? 0) > 0, {
    message: "Añade contenido o al menos un archivo multimedia.",
    path: ["content"],
  });

/**
 * POST /api/schedule
 * Programa o publica en Zernio. Los tres modos son excluyentes:
 * con fecha -> programado, `publishNow` -> inmediato, sin nada -> borrador.
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

  const { date, time, content, platforms, ...rest } = parsed.data;

  const scheduledFor =
    date && time ? `${date}T${time}:00` : undefined;

  if (!scheduledFor && !rest.publishNow && !rest.isDraft) {
    return NextResponse.json(
      {
        error:
          "Indica fecha y hora para programar, o `publishNow` para publicar ya.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await publish({
      content,
      platforms: platforms.map((p) => ({
        platform: p.platform,
        accountId: p.accountId,
        platformSpecificData: p.platformSpecificData,
      })),
      scheduledFor,
      timezone: rest.timezone ?? getDefaultTimezone(),
      publishNow: rest.publishNow,
      isDraft: rest.isDraft,
      firstComment: rest.firstComment,
      mediaItems: rest.mediaItems,
      tiktokSettings: rest.tiktokSettings,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo programar el post.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
