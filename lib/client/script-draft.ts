"use client";

import type { Niche, ScriptDraft } from "@/lib/domain/types";

/**
 * Borrador del Estudio de guiones.
 *
 * Vive en `localStorage` para que el botón "Usar este hook" de la Biblioteca
 * pueda insertar el hook y navegar a /script sin round-trip al servidor. Se
 * emite un evento propio para que otras pestañas/componentes reaccionen.
 */

const KEY = "ccc.scriptDraft.v1";
export const SCRIPT_DRAFT_EVENT = "ccc:script-draft";

export const EMPTY_DRAFT: ScriptDraft = {
  hookText: "",
  body: "",
  caption: "",
  angle: "",
  niche: "marketing",
  platform: "instagram",
  updatedAt: new Date(0).toISOString(),
};

export function readScriptDraft(): ScriptDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<ScriptDraft>) };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeScriptDraft(draft: ScriptDraft): ScriptDraft {
  const next: ScriptDraft = { ...draft, updatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SCRIPT_DRAFT_EVENT, { detail: next }));
  }
  return next;
}

export function clearScriptDraft(): void {
  writeScriptDraft({ ...EMPTY_DRAFT, updatedAt: new Date().toISOString() });
}

/** Inserta un hook en el borrador, conservando el cuerpo si ya existía. */
export function insertHookIntoDraft(input: {
  hookId?: string;
  hookText: string;
  niche?: Niche;
}): ScriptDraft {
  const current = readScriptDraft();
  return writeScriptDraft({
    ...current,
    hookId: input.hookId,
    hookText: input.hookText,
    niche: input.niche ?? current.niche,
  });
}

export function setDraftField<K extends keyof ScriptDraft>(
  key: K,
  value: ScriptDraft[K],
): ScriptDraft {
  const current = readScriptDraft();
  return writeScriptDraft({ ...current, [key]: value });
}
