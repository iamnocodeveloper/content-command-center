import { NextResponse, type NextRequest } from "next/server";

import { removeCompetitor } from "@/lib/domain/repository";
import { isDemoMode } from "@/lib/zernio/config";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** DELETE /api/competitors/{id} — deja de seguir la cuenta y sus reels. */
export async function DELETE(_request: NextRequest, { params }: Context) {
  if (isDemoMode()) {
    return NextResponse.json(
      {
        error:
          "En modo demo la lista de cuentas es la muestra fija de 8 cuentas y no se puede editar. Conecta Zernio en /settings para pasar a datos en vivo y gestionar las tuyas.",
      },
      { status: 409 },
    );
  }

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
