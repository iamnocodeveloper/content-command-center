export interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

export interface MediaUploadResult {
  publicUrl: string;
  key: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
  avi: "video/x-msvideo",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  pdf: "application/pdf",
};

/** Zernio rechaza `application/octet-stream`: si falta el MIME, se deduce. */
export function contentTypeFor(filename: string, mime?: string): string {
  if (mime && mime !== "application/octet-stream") return mime;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "image/jpeg";
}

/** Convierte una data URL (p. ej. una lámina del estudio) en un Blob subible. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function putToStorage(
  uploadUrl: string,
  body: Blob,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`La subida a storage falló (${request.status}).`));
    };
    request.onerror = () => reject(new Error("La subida a storage falló."));
    request.send(body);
  });
}

/**
 * Sube un binario a Zernio: pide la URL prefirmada a nuestra API y hace el `PUT`
 * directamente al storage (sin pasar por el servidor del dashboard).
 * Devuelve la `publicUrl` que después viaja en `mediaItems`.
 */
export async function uploadMediaBlob(input: {
  filename: string;
  contentType: string;
  size?: number;
  body: Blob;
  onProgress?: (percent: number) => void;
}): Promise<MediaUploadResult> {
  const response = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: input.filename,
      contentType: input.contentType,
      size: input.size,
    }),
  });

  const presigned = (await response.json().catch(() => null)) as
    | (PresignResponse & { error?: string })
    | null;

  if (!response.ok || !presigned?.uploadUrl) {
    throw new Error(presigned?.error ?? "No se pudo preparar la subida.");
  }

  await putToStorage(
    presigned.uploadUrl,
    input.body,
    input.contentType,
    input.onProgress,
  );

  return { publicUrl: presigned.publicUrl, key: presigned.key };
}
