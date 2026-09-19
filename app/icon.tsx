import { ImageResponse } from "next/og";

/**
 * Icono de la aplicación (favicon / PWA).
 * Se genera en build, así que no depende de assets binarios en el repo.
 */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #1c120e 0%, #100b09 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            left: -40,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(217,105,74,0.55) 0%, rgba(217,105,74,0) 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 300,
            height: 300,
            borderRadius: 72,
            border: "5px solid rgba(229,130,95,0.55)",
            background: "rgba(217,105,74,0.16)",
            color: "#f0a68c",
            fontSize: 140,
            fontWeight: 700,
            letterSpacing: -2,
            fontFamily: "monospace",
          }}
        >
          TM
        </div>
      </div>
    ),
    size,
  );
}
