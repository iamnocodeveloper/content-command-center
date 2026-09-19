import type { Metadata } from "next";

import { ContentCalendar } from "@/components/calendar/content-calendar";
import { PageHeader } from "@/components/page-header";
import { listPlanEntries } from "@/lib/domain/repository";
import { getPosts } from "@/lib/domain/zernio-gateway";
import { isDemoMode } from "@/lib/zernio/config";

export const metadata: Metadata = {
  title: "Calendario de Contenido",
  description:
    "Vista mensual con todo el contenido programado, completada automáticamente por scripts.",
};

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [planEntries, posts] = await Promise.all([
    listPlanEntries(),
    getPosts({ limit: 200 }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Sección 5"
        title="Calendario de Contenido"
        description="Vista mensual con la fecha y hora exactas de publicación, la plataforma y el hook de cada pieza. Se completa automáticamente cruzando tu Biblioteca de Hooks con ángulos de contenido; al hacer clic en un bloque se abre el guion completo y la caption."
      />

      <ContentCalendar
        planEntries={planEntries}
        posts={posts.data}
        demoSafe={isDemoMode()}
      />
    </>
  );
}
