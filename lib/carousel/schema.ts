import { z } from "zod";

export const imageDataSchema = z.string().max(18_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "Imagen no válida (PNG, JPG o WebP).");
export const assetSchema = z.object({ id: z.string().max(80), name: z.string().max(200), data: imageDataSchema });
export const brandSchema = z.object({
  name: z.string().max(120), colors: z.string().max(500), typography: z.string().max(500),
  style: z.string().max(3000), audience: z.string().max(1000), tone: z.string().max(1000),
  rules: z.string().max(2000), logo: assetSchema.nullable(), examples: z.array(assetSchema).max(5),
});
// Drafts may temporarily have an empty title while being edited. Generation validates it separately.
export const slideSchema = z.object({ title: z.string().max(200), text: z.string().max(1000), visual: z.string().max(2000) });
export const planSchema = z.object({ analysis: z.string().max(5000), direction: z.string().max(3000), caption: z.string().max(3000), slides: z.array(slideSchema).min(2).max(12) });
export const briefSchema = z.object({ topic: z.string().max(3000), count: z.number().int().min(2).max(12), size: z.enum(["1024x1280", "1024x1024", "1024x1536", "1536x1024"]), quality: z.enum(["low", "medium", "high"]), references: z.array(assetSchema).max(12) });
export const projectSchema = z.object({ version: z.literal(1), brand: brandSchema, brief: briefSchema, plan: planSchema.nullable(), images: z.array(z.object({ index: z.number().int().min(0).max(11), data: imageDataSchema })).max(12) });
export type Asset = z.infer<typeof assetSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Project = z.infer<typeof projectSchema>;
export const EMPTY_BRAND: Brand = { name: "", colors: "", typography: "", style: "", audience: "", tone: "", rules: "", logo: null, examples: [] };
export function newProject(brand: Brand = EMPTY_BRAND): Project {
  return { version: 1, brand, brief: { topic: "", count: 6, size: "1024x1280", quality: "high", references: [] }, plan: null, images: [] };
}
export function brandInstructions(brand: Brand): string {
  return JSON.stringify({ marca: brand.name, colores: brand.colors, tipografia: brand.typography, estilo: brand.style, publico: brand.audience, tono: brand.tone, reglas: brand.rules });
}
