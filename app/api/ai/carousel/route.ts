import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { brandSchema, briefSchema, planSchema, imageDataSchema } from "@/lib/carousel/schema";
import { analyzeCarousel, generateCarouselSlide, CarouselError } from "@/lib/services/carousel";

export const runtime = "nodejs";
export const maxDuration = 300;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze"), brand: brandSchema, brief: briefSchema }),
  z.object({ action: z.literal("generate"), brand: brandSchema, brief: briefSchema, plan: planSchema, index: z.number().int().min(0).max(11), anchor: imageDataSchema.optional(), feedback: z.string().max(2000).default("") }),
]);
const LIMIT = 4_000_000;
async function boundedJson(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > LIMIT) throw new CarouselError("Las referencias son demasiado grandes. Reduce su tamaño.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CarouselError("Solicitud vacía.", 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > LIMIT) { await reader.cancel(); throw new CarouselError("Las referencias superan el límite de 4 MB por solicitud.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new CarouselError("Solicitud JSON no válida.", 400); }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    const result = schema.safeParse(await boundedJson(request));
    if (!result.success) return NextResponse.json({ error: "Revisa el tamaño, formato y contenido de las referencias.", issues: result.error.flatten() }, { status: 400 });
    const input = result.data;
    if (!input.brand.name.trim() || (!input.brand.style.trim() && !input.brand.examples.length)) throw new CarouselError("Define el nombre de tu marca y su estilo, o sube ejemplos propios.", 400);
    if (input.action === "analyze" && !input.brief.topic.trim() && !input.brief.references.length) throw new CarouselError("Escribe un tema o sube un carrusel de referencia.", 400);
    if (input.action === "analyze") return NextResponse.json({ plan: await analyzeCarousel(input.brand, input.brief, request.signal) });
    if (input.index >= input.plan.slides.length) throw new CarouselError("Lámina inexistente.", 400);
    if (input.plan.slides.some((slide) => !slide.title.trim())) throw new CarouselError("Completa los títulos de las láminas antes de generar.", 400);
    return NextResponse.json({ image: await generateCarouselSlide(input, request.signal) });
  } catch (error) {
    const timeout = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    return NextResponse.json({ error: error instanceof CarouselError ? error.message : timeout ? "La generación excedió el tiempo disponible. Las imágenes terminadas se conservan. Reintenta la pendiente." : "No se pudo completar la solicitud. Revisa tu conexión y vuelve a intentarlo." }, { status: error instanceof CarouselError ? error.status : timeout ? 504 : 502 });
  }
}
