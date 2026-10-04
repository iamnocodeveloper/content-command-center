import type { MediaType, ZernioPlatform } from "@/lib/zernio/types";

/**
 * Tipos de publicación por plataforma.
 *
 * En Zernio el tipo casi siempre se **infiere del media**; la excepción son
 * Instagram y Facebook, que aceptan `platformSpecificData.contentType` para
 * Story/Reel. Este módulo es la única fuente de verdad que usa el Programador
 * para ofrecer el selector, validar el media y construir `platformSpecificData`.
 *
 * Reglas reales de Instagram que se reflejan aquí:
 *  - 1 imagen  → publicación de feed
 *  - 1 vídeo   → Reel (sin contentType)
 *  - 2+ items  → carrusel (imágenes y vídeos mezclados)
 *  - `contentType: "story"` → Historia
 */

export type MediaShape =
  | "any" // sin restricción (el texto basta)
  | "media-required" // ≥1 elemento, imagen o vídeo
  | "single" // exactamente 1, imagen o vídeo
  | "single-image"
  | "single-video"
  | "multi" // ≥2, imágenes y/o vídeos
  | "multi-image"
  | "video-or-photos"; // 1 vídeo O varias imágenes (nunca mezclados)

export interface FormatOption {
  id: string;
  label: string;
  /** Se envía en `platformSpecificData.contentType` (solo Instagram y Facebook). */
  contentType?: "story" | "reel";
  /** Restricción de media que valida el compositor antes de publicar. */
  media: MediaShape;
  hint?: string;
}

const IMAGE_TYPES: MediaType[] = ["image", "gif"];
const isImage = (type: MediaType | undefined): boolean =>
  type !== undefined && IMAGE_TYPES.includes(type);

export const PLATFORM_FORMATS: Partial<Record<ZernioPlatform, FormatOption[]>> = {
  instagram: [
    {
      id: "auto",
      label: "Automático",
      media: "media-required",
      hint: "1 imagen → publicación · 1 vídeo → Reel · varias → carrusel.",
    },
    {
      id: "carousel",
      label: "Carrusel",
      media: "multi",
      hint: "De 2 a 10 elementos (imágenes y/o vídeos).",
    },
    {
      id: "story",
      label: "Historia",
      media: "single",
      contentType: "story",
      hint: "1 imagen o vídeo · desaparece en 24 h.",
    },
  ],
  facebook: [
    {
      id: "post",
      label: "Publicación",
      media: "any",
      hint: "Texto, imagen o vídeo en el feed.",
    },
    {
      id: "reel",
      label: "Reel",
      media: "single-video",
      contentType: "reel",
      hint: "Un único vídeo vertical.",
    },
    {
      id: "story",
      label: "Historia",
      media: "single",
      contentType: "story",
      hint: "1 imagen o vídeo · desaparece en 24 h.",
    },
  ],
  tiktok: [
    {
      id: "auto",
      label: "Automático",
      media: "video-or-photos",
      hint: "1 vídeo → vídeo · varias imágenes → carrusel de fotos.",
    },
    {
      id: "video",
      label: "Vídeo",
      media: "single-video",
      hint: "Un único vídeo (3 s a 10 min).",
    },
    {
      id: "photo",
      label: "Carrusel de fotos",
      media: "multi-image",
      hint: "De 2 a 35 imágenes.",
    },
  ],
};

export function formatOptionsFor(platform: ZernioPlatform): FormatOption[] {
  return PLATFORM_FORMATS[platform] ?? [];
}

export function hasFormats(platform: ZernioPlatform): boolean {
  return formatOptionsFor(platform).length > 0;
}

export function defaultFormatFor(platform: ZernioPlatform): string | undefined {
  return formatOptionsFor(platform)[0]?.id;
}

export function findFormat(
  platform: ZernioPlatform,
  id: string | undefined,
): FormatOption | undefined {
  if (!id) return undefined;
  return formatOptionsFor(platform).find((option) => option.id === id);
}

/**
 * Valida el media adjunto contra el tipo elegido. Devuelve un mensaje de error
 * legible o `null` si el formato es válido.
 */
export function validateFormat(
  format: FormatOption,
  mediaTypes: MediaType[],
): string | null {
  const count = mediaTypes.length;
  const allImages = count > 0 && mediaTypes.every(isImage);

  switch (format.media) {
    case "media-required":
      if (count === 0) {
        return `«${format.label}» necesita al menos un archivo multimedia.`;
      }
      return null;
    case "single":
      if (count !== 1) {
        return `«${format.label}» necesita exactamente un elemento (imagen o vídeo).`;
      }
      return null;
    case "single-image":
      if (count !== 1 || !isImage(mediaTypes[0])) {
        return `«${format.label}» necesita exactamente una imagen.`;
      }
      return null;
    case "single-video":
      if (count !== 1 || mediaTypes[0] !== "video") {
        return `«${format.label}» necesita exactamente un vídeo.`;
      }
      return null;
    case "multi":
      if (count < 2) return `«${format.label}» necesita al menos 2 elementos.`;
      return null;
    case "multi-image":
      if (count < 2) return `«${format.label}» necesita al menos 2 imágenes.`;
      if (!allImages) return `«${format.label}» solo admite imágenes.`;
      return null;
    case "video-or-photos":
      if (count === 0) {
        return `«${format.label}» necesita un vídeo o varias imágenes.`;
      }
      if (count === 1 && mediaTypes[0] === "video") return null;
      if (allImages) return null;
      return `«${format.label}» admite un solo vídeo o varias imágenes (no mezcles).`;
    case "any":
    default:
      return null;
  }
}

/** MIME aceptados por `POST /v1/media/presign` para imágenes, vídeos y PDF. */
export const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-msvideo,application/pdf";

const EXTENSION_TYPES: Record<string, MediaType> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  gif: "gif",
  mp4: "video",
  mov: "video",
  webm: "video",
  m4v: "video",
  avi: "video",
  mpeg: "video",
  mpg: "video",
  pdf: "document",
};

/** Deduce el `MediaItem.type` a partir del MIME (o de la extensión si falta). */
export function guessMediaType(mime: string, filename = ""): MediaType {
  const type = mime.toLowerCase();
  if (type === "image/gif") return "gif";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type === "application/pdf") return "document";
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? "image";
}

/** `true` cuando todo el media es imagen/gif (foto-carrusel de TikTok). */
export function isImageOnly(mediaTypes: MediaType[]): boolean {
  return mediaTypes.length > 0 && mediaTypes.every(isImage);
}
