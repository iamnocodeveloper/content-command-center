import { zernioFetch } from "@/lib/zernio/client";
import type { MediaPresignResponse } from "@/lib/zernio/types";

/**
 * Subida de media en 3 pasos (https://docs.zernio.com/guides/media-uploads):
 *  1. POST /v1/media/presign  -> uploadUrl + publicUrl
 *  2. PUT  uploadUrl          -> sube el binario (sin Authorization)
 *  3. POST /v1/posts          -> usa publicUrl en mediaItems
 *
 * Nota: las subidas caducan a los 7 días si no se publican.
 */
export async function presignMedia(input: {
  filename: string;
  contentType: string;
  size?: number;
}): Promise<MediaPresignResponse> {
  return zernioFetch<MediaPresignResponse>("/media/presign", {
    method: "POST",
    body: input,
  });
}

/** Sube el binario a la URL presignada. Devuelve la `publicUrl` reutilizable. */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: Blob,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!response.ok) {
    throw new Error(
      `La subida a storage falló con ${response.status} ${response.statusText}`,
    );
  }
}

/** Helper de alto nivel: presigna, sube y devuelve la URL pública. */
export async function uploadMedia(file: File): Promise<{
  publicUrl: string;
  key: string;
  expiresIn: number;
}> {
  const contentType = file.type || "application/octet-stream";
  const presigned = await presignMedia({
    filename: file.name,
    contentType,
    size: file.size,
  });

  await uploadToPresignedUrl(presigned.uploadUrl, file, contentType);

  return {
    publicUrl: presigned.publicUrl,
    key: presigned.key,
    expiresIn: presigned.expiresIn,
  };
}
