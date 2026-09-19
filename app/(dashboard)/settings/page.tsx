import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ConnectionsPanel } from "@/components/settings/connections-panel";

export const metadata: Metadata = {
  title: "Ajustes e integraciones",
  description:
    "Conecta la API de Zernio y el modelo de IA que genera guiones, captions y hooks.",
};

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Integraciones"
        title="Ajustes y conexiones"
        description="Conecta la API de Zernio para traer cuentas, publicaciones y estadísticas reales, y elige el modelo de IA que escribe los guiones, las captions y las variaciones de hook. Todo se prueba desde aquí antes de guardarse."
      />

      <ConnectionsPanel />
    </>
  );
}
