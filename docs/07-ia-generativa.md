# 07 · IA generativa

## Qué genera la IA y qué no

| Tarea | ¿IA? | Dónde |
|---|---|---|
| Clasificar un hook en una plantilla | **No** — motor determinista | `lib/domain/hook-engine.ts` |
| Puntuar una noticia por potencial de hook | **No** — fórmula ponderada | `lib/services/trend-classifier.ts` |
| Detectar contenido destacado | **No** — umbral 2× sobre la media | `lib/domain/analytics-service.ts` |
| Escribir un guion completo | **Sí** (o heurístico) | `lib/services/ai.ts#generateScript` |
| Refinar captions por plataforma | **Sí** (o heurístico) | `lib/services/captions.ts` |
| Proponer variaciones de hook | **Sí** (o heurístico) | `lib/services/ai.ts#generateHookVariants` |
| Reescribir una caption | **Sí** (o heurístico) | `lib/services/ai.ts#rewriteCaption` |

Criterio: lo que debe ser **explicable, gratis y determinista** no usa IA. Lo que
requiere redacción se delega al modelo, pero **siempre** con un fallback local.

## Proveedores

| Proveedor | Endpoint | Requisito |
|---|---|---|
| `heuristic` (defecto) | — local | Nada. Plantillas y reglas. |
| `openai` | `POST https://api.openai.com/v1/chat/completions` | `OPENAI_API_KEY` |
| `anthropic` | `POST https://api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` |

Modelos por defecto: `gpt-4o-mini` y `claude-sonnet-4-5`. Ambos configurables
desde `/settings`.

Se elige en `/settings` → tarjeta **Modelo de IA**. El botón *Probar modelo* hace
una llamada real de 60 tokens y muestra la latencia y una muestra de la respuesta,
para verificar la clave antes de guardarla.

## Punto de entrada

```ts
// lib/services/ai.ts
aiComplete(messages, { json?, maxTokens?, temperature? })
  → { text, provider, model }
```

- Añade `response_format: { type: "json_object" }` en OpenAI cuando `json: true`
  (Anthropic no lo soporta: se le pide el JSON en el prompt).
- Timeout de 60 s (`AbortSignal.timeout`).
- Lanza `AiUnavailableError` con un mensaje útil si falta la clave o el
  proveedor responde con error.

## Funciones de alto nivel

Todas **nunca lanzan**: en el peor caso devuelven el resultado local y un campo
`note` con el motivo.

### `generateScript({ hook, angle, niche, platform, durationSeconds, notes })`

Devuelve `{ hook, beats[], cta, caption, hashtags[], source, note? }`.

El prompt pide JSON estricto:

```json
{ "hook": "…", "beats": ["…"], "cta": "…", "caption": "…", "hashtags": ["…"] }
```

Reglas del system prompt: guionista de vídeo vertical en español, frases cortas,
sin relleno, 3-5 bloques de una frase, entre 3 y 12 hashtags sin `#`.

Tolerancias:
- Si el modelo no devuelve JSON válido pero responde texto, se usa el texto como
  `beats` (una línea por bloque) y se avisa en `note`.
- Si falla la llamada, se devuelve `heuristicScript()` con 4 bloques construidos a
  partir del ángulo.

### `generateHookVariants({ base, niche, count, patterns })`

Pide `{ variants: [{ text, pattern, rationale }] }`, limitado a `count` (1-10,
5 por defecto) y con el catálogo de plantillas como referencia.

Fallback heurístico (`heuristicHookVariants`): aplica 5 plantillas al tema
extraído del hook base. `subjectFromBase()` quita la apertura propia del hook
original («nadie te dice la verdad sobre», «deja de», la cifra inicial…) y recorta
a 4 palabras, de modo que `"nadie te dice la verdad sobre crear contenido"` se
convierte en `"crear contenido"` antes de reinyectarlo. Se descartan las variantes
idénticas al texto base.

### `rewriteCaption({ caption, platform, niche, hook })`

Devuelve texto plano. El system prompt obliga a **mantener el hook literal** y
adaptar el tono a la plataforma. Si falla, devuelve la caption original sin
cambios.

### `generateCaptions({ hook, angle, niche, platforms, notes })`

`lib/services/captions.ts`. Genera primero los borradores heurísticos (uno por
plataforma, con su CTA, sus hashtags y su primer comentario) y, si el proveedor no
es `heuristic`, hace **una sola llamada** pidiendo todas las versiones refinadas de
golpe. Motivo: una petición en lugar de N, controlando coste y latencia.

Si el refinamiento falla, se devuelven los borradores heurísticos con `note`.

## Prueba de conexión

`testAiConnection({ provider, apiKey, model })` → `{ ok, provider, model, message,
latencyMs, sample }`.

Acepta una clave **aún no guardada**, así que se puede verificar antes de
escribirla. Construye una configuración temporal y no toca la activa.

Para `heuristic` devuelve `ok: true` sin red, explicando que funciona sin
credenciales.

## Parseo tolerante de JSON

`parseJsonLoose<T>(raw)`:

1. Quita vallas de código (` ```json ` / ` ``` `).
2. Intenta `JSON.parse`.
3. Si falla, recorta desde el primer `{` o `[` hasta el último `}` o `]` e
   intenta de nuevo.
4. Devuelve `null` si no hay forma.

Los modelos añaden texto alrededor del JSON con frecuencia; esto evita tirar una
respuesta útil.

## Coste y control

- El proveedor por defecto es `heuristic`: coste cero hasta que se decide
  conectar una clave.
- Una llamada por acción de usuario; no hay generación en bucle ni en segundo
  plano.
- `maxTokens` acotado por función (guion 1400, variaciones 1200, captions 2000,
  reescritura 700, prueba 60).
- La clasificación de hooks (la operación más frecuente) **nunca** consume
  tokens.

## Cómo probar sin gastar

```bash
# Todo con el generador local
CAPTION_PROVIDER=heuristic npm run dev

curl -X POST http://localhost:3000/api/ai/script \
  -H 'Content-Type: application/json' \
  -d '{"hook":"Deja de publicar todos los días","angle":"Error común","niche":"marketing","platform":"instagram"}'
# → { "source": "fallback", "note": "El proveedor de IA es «heurístico»: …" }
```

## Añadir un proveedor nuevo

1. Implementa el `call…` correspondiente en `lib/services/ai.ts` y enrútalo desde
   `aiComplete`.
2. Añade el valor a `AiProviderId` en `lib/server/settings-store.ts` y su clave a
   `AppSettings.ai`.
3. Extiende `getAiConfig()` en `lib/zernio/config.ts` con la nueva credencial y su
   `ready`.
4. Añade la opción al `Select` de `components/settings/connections-panel.tsx` y el
   campo de clave con `SecretInput`.

Las funciones de alto nivel no cambian: siguen llamando a `aiComplete`.
