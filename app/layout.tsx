import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  ),
  title: {
    default: "Content Command Center",
    template: "%s · Content Command Center",
  },
  description:
    "Dashboard de contenido para creadores: hooks, analíticas, competidores, programación multiplataforma, calendario y tendencias de IA.",
  applicationName: "Content Command Center",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Content Command Center",
    title: "Content Command Center",
    description:
      "Seis secciones para capturar hooks, medir lo que funciona, vigilar a tu competencia y publicar en todas tus cuentas con un clic.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Content Command Center",
    description:
      "Dashboard de contenido para creadores sobre la API de Zernio.",
  },
};

export const viewport: Viewport = {
  themeColor: "#100c0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
