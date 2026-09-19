import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea números grandes de forma compacta: 12500 -> "12,5 K". */
export function formatCompact(value: number, locale = "es-ES"): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Formatea números con separador de miles. */
export function formatNumber(value: number, locale = "es-ES"): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Porcentaje con signo: 0.123 -> "+12,3 %". */
export function formatDelta(value: number, locale = "es-ES"): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value)}`;
}

/** Convierte un valor a "hace 3 días" en español. */
export function relativeTime(date: Date | string, locale = "es-ES"): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = target.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === "minute") {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, "minute");
}

/** Slug estable para claves de React y URLs. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Convierte "instagram" | "twitter" en etiquetas legibles. */
export function titleCase(input: string): string {
  return input.replace(/^\w/, (c) => c.toUpperCase());
}

export function truncate(input: string, max = 120): string {
  return input.length > max ? `${input.slice(0, max - 1)}…` : input;
}
