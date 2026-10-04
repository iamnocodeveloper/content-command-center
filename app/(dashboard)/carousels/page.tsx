import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { CarouselStudio } from "@/components/carousels/carousel-studio";
import { getAiConfig } from "@/lib/zernio/config";

export const metadata: Metadata = { title: "Carruseles IA" };
export const dynamic = "force-dynamic";
export default function CarouselsPage() {
  return <><PageHeader eyebrow="Estudio visual" title="Carruseles IA" description="Transforma una referencia o una idea en un carrusel completo con tu identidad. Imágenes finales con textos, ilustraciones y diseño generados por OpenAI." /><CarouselStudio configured={Boolean(getAiConfig().openaiApiKey)} /></>;
}
