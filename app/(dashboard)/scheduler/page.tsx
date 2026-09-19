import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Scheduler } from "@/components/scheduler/scheduler";
import { getAccounts } from "@/lib/domain/zernio-gateway";
import { aiProviderLabel } from "@/lib/services/ai";
import { getAiConfig, getDefaultTimezone, isDemoMode } from "@/lib/zernio/config";

export const metadata: Metadata = {
  title: "Programador",
  description:
    "Programación multiplataforma con un solo clic y generación automática de captions.",
};

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  const accounts = await getAccounts();
  const ai = getAiConfig();

  return (
    <>
      <PageHeader
        eyebrow="Sección 4"
        title="Programador"
        description="Un solo clic programa la misma pieza en Instagram, TikTok, YouTube, Facebook, Threads, LinkedIn y X. Las captions se generan automáticamente por plataforma a partir del hook y el ángulo de contenido, y se afinan con el modelo conectado en Ajustes."
      />

      <Scheduler
        accounts={accounts.data}
        defaultTimezone={getDefaultTimezone()}
        demoSafe={isDemoMode()}
        aiLabel={aiProviderLabel(
          ai.provider,
          ai.provider === "openai" ? ai.openaiModel : ai.anthropicModel,
        )}
        aiReady={ai.ready}
      />
    </>
  );
}
