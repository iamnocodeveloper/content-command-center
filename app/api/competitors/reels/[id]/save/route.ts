import { NextResponse, type NextRequest } from "next/server";

import { listReels, saveReelToHooks } from "@/lib/domain/repository";

export const dynamic = "force-dynamic";

/**
 * POST /api/competitors/reels/{id}/save
 * Guarda el hook de un reel competidor en la Biblioteca de Hooks.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const hook = await saveReelToHooks(id);

  if (!hook) {
    return NextResponse.json({ error: "Reel no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ hook }, { status: 201 });
}

/** GET espejo para depurar el estado de un reel concreto. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reels = await listReels();
  const reel = reels.find((r) => r.id === id);

  if (!reel) {
    return NextResponse.json({ error: "Reel no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ reel });
}
