/**
 * Ingesta manual del seguimiento de competidores.
 *
 * Uso:  npm run ingest:competitors
 *
 * En modo demo imprime la captura semanal que sirve la aplicación. Con Zernio
 * conectado en /settings (o DEMO_MODE=false), este script es el punto donde se
 * engancha el pipeline real descrito en docs/06-integraciones.md.
 */
import { SEED_COMPETITORS } from "../lib/domain/seed/competitors";
import { extractHook, transcribe } from "../lib/services/transcription";
import { isDemoMode } from "../lib/zernio/config";

async function main() {
  // Misma definición de «demo» que el resto del sistema (lib/zernio/config):
  // con Zernio conectado en /settings, esto ya corre en vivo.
  const demo = isDemoMode();

  console.log(`Cuentas vigiladas: ${SEED_COMPETITORS.length}\n`);

  if (demo) {
    console.log("Modo demo activo.");
    console.log(
      "El pipeline real necesita ZERNIO_API_KEY (o DEMO_MODE=false) y el add-on de Analytics.",
    );
    console.log("\nDemostración del paso de transcripción:\n");

    const result = await transcribe({
      mediaUrl: "https://example.com/reel.mp4",
      hookHint: "Tu embudo está roto antes de que el cliente te vea",
    });

    console.log(`  proveedor: ${result.provider}`);
    console.log(`  hook:      ${extractHook(result.transcript)}`);
    console.log(`  texto:     ${result.transcript.slice(0, 140)}…`);
    return;
  }

  for (const account of SEED_COMPETITORS) {
    console.log(`  → ${account.username} (${account.platform})`);
  }

  console.log(
    "\nPasos pendientes de conectar: GET /v1/accounts, GET /v1/accounts/{id}/posts, GET /v1/analytics, transcribe(), extractHook().",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
