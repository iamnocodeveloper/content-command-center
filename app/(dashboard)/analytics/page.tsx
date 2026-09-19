import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Analíticas",
  description:
    "Vistas, guardados, nuevos seguidores y volumen de DMs, con detección automática del contenido destacado.",
};

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sección 2"
        title="Analíticas"
        description="Métricas de vistas, guardados, nuevos seguidores y volumen de DMs con tendencia a 7, 30 y 90 días. Cualquier reel que supere 2x la media de rendimiento de los últimos 30 días se marca como contenido destacado, y los 5 mejores se explican según sus propias señales."
      />

      <AnalyticsDashboard initialRange={30} />
    </>
  );
}
