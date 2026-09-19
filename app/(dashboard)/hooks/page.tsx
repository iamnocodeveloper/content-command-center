import type { Metadata } from "next";

import { HooksLibrary } from "@/components/hooks/hooks-library";
import { SaveHookDialog } from "@/components/hooks/save-hook-dialog";
import { PageHeader } from "@/components/page-header";
import { listHooks } from "@/lib/domain/repository";

export const metadata: Metadata = {
  title: "Biblioteca de Hooks",
  description:
    "Todos los hooks virales guardados, transcritos y organizados en plantillas reutilizables.",
};

export const dynamic = "force-dynamic";

export default async function HooksPage() {
  const hooks = await listHooks({ sortBy: "views", order: "desc" });
  const favorites = hooks.filter((hook) => hook.isFavorite);

  return (
    <>
      <PageHeader
        eyebrow="Sección 1"
        title="Biblioteca de Hooks"
        description="Cada hook que guardas se transcribe y se convierte en plantilla («[X] acaba de destruir [Y]», «Deja de hacer [X]», «[NÚMERO] cosas que me hubiera gustado saber»). Filtra por nicho, tipo de hook y visualizaciones, y lanza cualquiera al Estudio de guiones con un clic."
        actions={<SaveHookDialog />}
      />

      <HooksLibrary initialHooks={hooks} initialFavorites={favorites} />
    </>
  );
}
