import type { Metadata } from "next";

import {
  CompetitorTracker,
  type ReelWithAccount,
} from "@/components/competitors/competitor-tracker";
import { PageHeader } from "@/components/page-header";
import { listCompetitors, listReels, listWeeks } from "@/lib/domain/repository";

export const metadata: Metadata = {
  title: "Seguimiento de Competidores",
  description:
    "Los 5 Reels con mejor rendimiento de las cuentas que sigues, transcritos y ordenados por visualizaciones.",
};

export const dynamic = "force-dynamic";

export default async function CompetitorsPage() {
  const [competitors, reels, weeks] = await Promise.all([
    listCompetitors(),
    listReels({ sortBy: "views", order: "desc" }),
    listWeeks(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Sección 3"
        title="Seguimiento de Competidores"
        description={`Cada domingo a las 06:00 se analizan los 5 Reels con mejor rendimiento de las ${competitors.length} cuentas que sigues. Se transcribe el audio y se extraen el hook y el texto en pantalla, listos para guardarlos en el Banco de Hooks.`}
      />

      <CompetitorTracker
        competitors={competitors}
        reels={reels as ReelWithAccount[]}
        weeks={weeks}
      />
    </>
  );
}
