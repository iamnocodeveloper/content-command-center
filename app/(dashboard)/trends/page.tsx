import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { TrendsBoard } from "@/components/trends/trends-board";
import { getTrendSources, listTrends } from "@/lib/domain/repository";

export const metadata: Metadata = {
  title: "Tendencias",
  description:
    "Noticias de IA de 12 fuentes, clasificadas según su potencial para crear hooks.",
};

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const [trends, sources] = await Promise.all([
    listTrends({ sortBy: "hookScore" }),
    getTrendSources(),
  ]);

  const sourcesWithStats = sources.map((source) => {
    const items = trends.filter((trend) => trend.sourceId === source.id);
    return {
      ...source,
      itemCount: items.length,
      topScore: items.reduce((max, item) => Math.max(max, item.hookScore), 0),
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Sección 6"
        title="Tendencias"
        description="Noticias de IA provenientes de 12 fuentes (laboratorios, investigación, medios, comunidades y newsletters), clasificadas según su potencial para crear hooks. Cada noticia llega con ángulo de contenido y hook sugerido, listo para producción."
      />

      <TrendsBoard trends={trends} sources={sourcesWithStats} />
    </>
  );
}
