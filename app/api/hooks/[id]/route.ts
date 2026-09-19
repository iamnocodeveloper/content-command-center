import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { deleteHook, updateHook } from "@/lib/domain/repository";
import { NICHES } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  isFavorite: z.boolean().optional(),
  niche: z.enum(NICHES).optional(),
  tags: z.array(z.string()).optional(),
  patternId: z.string().optional(),
});

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/hooks/{id} — favorito, nicho, tags o plantilla. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const hook = await updateHook(id, parsed.data);
  if (!hook) {
    return NextResponse.json({ error: "Hook no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ hook });
}

/** DELETE /api/hooks/{id} */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const removed = await deleteHook(id);

  if (!removed) {
    return NextResponse.json({ error: "Hook no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
