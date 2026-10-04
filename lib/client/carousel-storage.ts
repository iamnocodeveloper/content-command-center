import { projectSchema, type Asset, type Project } from "@/lib/carousel/schema";

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ccc-carousels", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("No se pudo abrir el almacenamiento de este navegador."));
  });
}
export async function loadProject(): Promise<Project | null> {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readonly");
    const request = tx.objectStore("workspace").get("current");
    request.onsuccess = () => {
      try { resolve(request.result ? projectSchema.parse(request.result) : null); }
      catch { reject(new Error("El proyecto guardado no es compatible. Exporta una copia antes de reemplazarlo.")); }
    };
    request.onerror = () => reject(new Error("No se pudo leer el proyecto guardado."));
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}
export async function saveProject(project: Project): Promise<void> {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(project, "current");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(new Error("No se pudo guardar. Descarga una copia del proyecto para no perderlo.")); };
    tx.onabort = () => { db.close(); reject(new Error("Guardado interrumpido. Descarga una copia del proyecto.")); };
  });
}
export async function readImage(file: File, compress = true): Promise<Asset> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Usa imágenes PNG, JPG o WebP.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Cada imagen puede pesar hasta 12 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
  return { id: crypto.randomUUID(), name: file.name.slice(0, 200), data: compress ? await compressImage(data) : data };
}
// References are normalized locally before uploading. Outputs retain their original resolution.
export async function compressImage(data: string): Promise<string> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("El archivo no es una imagen válida.")); image.src = data; });
  const canvas = document.createElement("canvas");
  let edge = 1400;
  for (let attempt = 0; attempt < 6; attempt++) {
    const ratio = Math.min(1, edge / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL("image/webp", 0.85 - attempt * 0.06);
    if (encoded.length <= 190_000) return encoded;
    edge *= 0.8;
  }
  throw new Error("Esta referencia es demasiado compleja. Reduce su tamaño y vuelve a subirla.");
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function imageBytes(data: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(data.split(",")[1]), (char) => char.charCodeAt(0));
}
export function downloadImage(data: string, index: number) {
  const mime = data.slice(5, data.indexOf(";"));
  downloadBlob(new Blob([imageBytes(data)], { type: mime }), `lamina-${String(index + 1).padStart(2, "0")}.${mime.split("/")[1]}`);
}
