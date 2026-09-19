import { ImageResponse } from "next/og";

/**
 * Imagen de previsualización social (Open Graph / Twitter Card).
 * Se genera en build con `next/og`, sin assets binarios.
 */
export const alt =
  "Content Command Center · dashboard de contenido para creadores sobre la API de Zernio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SECTIONS = [
  "Biblioteca de Hooks",
  "Analíticas",
  "Competidores",
  "Programador",
  "Calendario",
  "Tendencias",
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(140deg, #1a1210 0%, #120c0a 55%, #0d0908 100%)",
          padding: 64,
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Resplandor de marca */}
        <div
          style={{
            position: "absolute",
            top: -180,
            left: -120,
            width: 760,
            height: 760,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(217,105,74,0.38) 0%, rgba(217,105,74,0) 68%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -220,
            right: -140,
            width: 620,
            height: 620,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(229,130,95,0.20) 0%, rgba(229,130,95,0) 70%)",
          }}
        />

        {/* Marca */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 62,
              height: 62,
              borderRadius: "50%",
              border: "2px solid rgba(229,130,95,0.55)",
              background: "rgba(217,105,74,0.18)",
              color: "#f0a68c",
              fontSize: 26,
              fontWeight: 700,
              fontFamily: "monospace",
            }}
          >
            NC
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#e9d9d2", fontSize: 26, fontWeight: 600 }}>
              @nocodeveloper
            </div>
            <div
              style={{
                color: "#a08b83",
                fontSize: 19,
                fontFamily: "monospace",
                letterSpacing: 1,
              }}
            >
              dashboard-de-contenido
            </div>
          </div>
        </div>

        {/* Título */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 52,
          }}
        >
          <div
            style={{
              color: "#fdf5f1",
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: -2.5,
              lineHeight: 1.05,
            }}
          >
            Content Command Center
          </div>
          <div
            style={{
              marginTop: 20,
              color: "#b59d94",
              fontSize: 27,
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Seis secciones para capturar hooks, medir lo que funciona, vigilar a tu
            competencia y publicar en todas tus cuentas con un clic.
          </div>
        </div>

        {/* Chips de secciones */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: "auto",
          }}
        >
          {SECTIONS.map((label, index) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "11px 22px",
                borderRadius: 999,
                fontSize: 21,
                fontWeight: 600,
                border:
                  index === 0
                    ? "1px solid rgba(217,105,74,0.55)"
                    : "1px solid rgba(255,255,255,0.12)",
                background:
                  index === 0 ? "rgba(217,105,74,0.18)" : "rgba(255,255,255,0.05)",
                color: index === 0 ? "#f0a68c" : "#d8c5bd",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Pie */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 34,
            fontFamily: "monospace",
            fontSize: 19,
            color: "#8a7269",
          }}
        >
          <div>Next.js 15 · TypeScript · Tailwind · shadcn/ui</div>
          <div style={{ color: "#c4755a" }}>powered by Zernio API</div>
        </div>
      </div>
    ),
    size,
  );
}
