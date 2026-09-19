import { NextResponse, type NextRequest } from "next/server";

import { removeCompetitor } from "@/lib/domain/repository";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** DELETE /api/competitors/{id} — deja de seguir la cuenta y sus reels. */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const removed = await removeCompetitor(id);

  if (!removed) {
    return NextResponse.json(
      { error: "Cuenta no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
