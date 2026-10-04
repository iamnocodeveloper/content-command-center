import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ZernioError } from "@/lib/zernio/client";
import { isDemoMode } from "@/lib/zernio/config";
import { presignMedia } from "@/lib/zernio/media";

export const dynamic = "force-dynamic";

const schema = z.object({
  filename: z.string().min(1).max(300),
  contentType: z.string().min(3).max(120),
  size: z.number().int().positive().optional(),
});

/**
 * POST /api/media/presign
 *
 * Prepara una subida de media en Zernio. El binario NO pasa por aquí: el
 * navegador hace `PUT` directo al `uploadUrl` devuelto (sin Authorization) y
 * luego el Programador publica con la `publicUrl` resultante.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  if (isDemoMode()) {
    return NextResponse.json(
      {
        error:
          "Conecta Zernio en Ajustes para subir archivos. En modo demo solo puedes adjuntar URLs públicas.",
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const presigned = await presignMedia(parsed.data);
    return NextResponse.json(presigned);
  } catch (error) {
    const message =
      error instanceof ZernioError
        ? error.message
        : "No se pudo preparar la subida del archivo.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
