import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ScriptStudio, type HookOption } from "@/components/script/script-studio";
import { listHooks } from "@/lib/domain/repository";
import { aiProviderLabel } from "@/lib/services/ai";
import { formatCompact } from "@/lib/utils";
import { getAiConfig } from "@/lib/zernio/config";

export const metadata: Metadata = {
  title: "Estudio de guiones",
  description:
    "Compositor donde aterrizan los hooks elegidos en la Biblioteca, Tendencias y el Banco de Hooks.",
};

export const dynamic = "force-dynamic";

export default async function ScriptPage() {
  const hooks = await listHooks({ sortBy: "views", order: "desc" });
  const ai = getAiConfig();

  const suggestions: HookOption[] = hooks.slice(0, 8).map((hook) => ({
    id: hook.id,
    text: hook.filledText || hook.rawText,
    niche: hook.niche,
    creatorHandle: hook.creatorHandle,
    viewsLabel: `${formatCompact(hook.views)} views`,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Flujo de producción"
        title="Estudio de guiones"
        description="Aquí aterriza el botón «Usar este hook» de la Biblioteca, del Seguimiento de competidores y de Tendencias. Escribe el guion —a mano o con el modelo de IA conectado en Ajustes—, genera la caption y mándalo al Programador para publicarlo en todas tus cuentas."
      />

      <ScriptStudio
        hookSuggestions={suggestions}
        aiLabel={aiProviderLabel(
          ai.provider,
          ai.provider === "openai" ? ai.openaiModel : ai.anthropicModel,
        )}
        aiReady={ai.ready}
      />
    </>
  );
}
