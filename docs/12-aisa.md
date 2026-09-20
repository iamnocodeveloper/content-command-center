# 12 · AIsa

[AIsa](https://aisa.one/docs) es un **gateway multi-modelo** compatible con
OpenAI: un único token da acceso a 108 modelos (GPT, Claude, Gemini, Grok,
DeepSeek, Qwen, Kimi, MiniMax, GLM…) y a APIs de datos, todo facturado contra el
saldo de la cuenta.

En este proyecto AIsa aparece en **dos superficies independientes**, con la misma
clave y el mismo endpoint pero ciclos de vida distintos:

| Superficie | Dónde vive | Para qué | Lo configuras… |
|---|---|---|---|
| **Entorno del agente** (BYOK) | `~/.commandcode/providers.json` | Que los modelos `aisa/…` estén disponibles en `/model` del CLI | Una vez, por máquina |
| **Dashboard** (proveedor `aisa`) | `/settings` → tarjeta *Modelo de IA* | Generar guiones, captions, hooks y reescrituras desde la app | Por despliegue |

> **Regla común:** la clave **nunca** se escribe en el repositorio. En las dos
> superficies se lee de la variable de entorno `AISA_API_KEY`.

---

## 1. Entorno del agente (BYOK)

BYOK es la vía del CLI para conectar un proveedor externo. Las peticiones salen
de tu máquina directas a AIsa con tu clave; no pasan por los servidores de
Command Code.

Los proveedores BYOK son **sólo a nivel de usuario** (no se pueden declarar por
proyecto) y viven en `~/.commandcode/providers.json`.

### Qué se declaró

```jsonc
// ~/.commandcode/providers.json
{
  "provider": {
    "aisa": {
      "name": "AIsa",
      "baseURL": "https://api.aisa.one/v1",
      "apiKey": "$AISA_API_KEY",
      "models": {
        "gpt-5.4":                      { "contextWindow": 1050000, "cost": { /* … */ } },
        "gpt-5.3-codex":                { "contextWindow": 1000000, "cost": { /* … */ } },
        "claude-opus-4-8":              { "contextWindow": 1000000, "cost": { /* … */ } },
        "claude-sonnet-4-5-20250929":   { "contextWindow": 200000,  "cost": { /* … */ } },
        "claude-haiku-4-5-20251001":    { "contextWindow": 200000,  "cost": { /* … */ } },
        "deepseek-v4-flash":            { "contextWindow": 262144,  "cost": { /* … */ } },
        "deepseek-v4-pro":              { "contextWindow": 262144,  "cost": { /* … */ } },
        "qwen3.7-max":                  { "contextWindow": 1000000, "cost": { /* … */ } },
        "MiniMax-M3":                   { "contextWindow": 1000000, "cost": { /* … */ } },
        "kimi-k2.5":                    { "contextWindow": 262144,  "cost": { /* … */ } },
        "glm-5":                        { "contextWindow": 128000,  "cost": { /* … */ } },
        "grok-4.3":                     { "contextWindow": 1000000, "cost": { /* … */ } }
      }
    }
  }
}
```

`api` se omite a propósito: el valor por defecto es `openai-completions`, que es
el protocolo que AIsa sirve en `/chat/completions`.

### Por qué `apiKey` es `"$AISA_API_KEY"` y no la clave

El esquema de BYOK sólo acepta **referencias**, nunca un secreto en crudo:

| Forma | Significado |
|---|---|
| `"$ENV_VAR"` / `"{env:VAR}"` | Lee esa variable de entorno |
| `"!command"` | Ejecuta el comando y usa su salida |
| `false` | Endpoint sin autenticación |

Una clave pegada tal cual en el archivo **se rechaza al parsear** (el proveedor
sobrevive, la clave se ignora). Además, una clave guardada desde `/connect` gana
sobre la referencia del archivo.

### Poner la clave en el entorno

Windows (alcance de usuario, persistente):

```powershell
[Environment]::SetEnvironmentVariable('AISA_API_KEY', 'sk-aisa-…', 'User')
```

Unix:

```bash
echo 'export AISA_API_KEY=sk-aisa-…' >> ~/.bashrc
```

Hay que abrir una **sesión nueva** del CLI para que herede la variable.

### Verificar sin gastar

```bash
aisa login --help      # rutas de autenticación
aisa balance           # prueba real de credencial: imprime el saldo
cmdc --list-models     # confirma que el proveedor carga y lista sus modelos
```

`aisa whoami` **no** sirve como prueba: es local. `aisa balance` sí, porque hace
una llamada autenticada. Ninguno de los dos consume saldo.

Salida esperada de `cmdc --list-models`:

```text
AIsa (byok)
  aisa/gpt-5.4                 GPT-5.4
  aisa/gpt-5.3-codex           GPT-5.3 Codex
  aisa/deepseek-v4-flash       DeepSeek V4 Flash
  …
```

### Usar un modelo

```bash
# Cambiar el modelo de esta sesión
/model aisa/gpt-5.4

# Fijarlo como modelo por defecto de las sesiones nuevas
cmdc config set model aisa/gpt-5.4 --scope user
```

Una sesión en curso **mantiene** su modelo: el cambio por `cmdc config set` se
aplica a partir de la siguiente sesión (o al hacer `/model` en la actual).

### Gestionar el proveedor

```bash
/connect        # tarjeta del proveedor: r = reemplazar clave, u = refrescar
                # modelos, d = eliminar
```

`u` vuelve a leer la lista de modelos (del registro primero y del `/models` del
endpoint como respaldo), de modo que cuando AIsa publica modelos nuevos basta con
esa tecla.

### Límites conocidos

- **`reasoningEfforts` no está declarado.** La detección automática sólo cubre
  proveedores conocidos; para uno personalizado hay que declararlo a mano en
  `providers.json`. Se dejó fuera a propósito en vez de inventar qué niveles
  acepta cada modelo. Si quieres control de esfuerzo, añade
  `"reasoningEfforts": ["low", "medium", "high"]` (el conjunto válido es
  `low | medium | high | xhigh | max`; los niveles desconocidos se descartan con
  un aviso).
- **Doce de los 108 modelos** están en el BYOK. El resto se añade a mano o
  refrescando con `u`; el catálogo completo está en
  <https://aisa.one/docs/guides/models>.
- Los `cost` son la tarifa publicada en $ por 1M de tokens; sirven para el
  cálculo de coste del CLI, no son una factura.

---

## 2. Dashboard (proveedor `aisa`)

El dashboard tiene su propia capa de IA (`lib/services/ai.ts`) con degradación
garantizada: si el proveedor falla, devuelve el generador heurístico local y un
campo `note` con el motivo. AIsa se añadió como un proveedor más.

### Archivos tocados

| Archivo | Cambio |
|---|---|
| `lib/server/settings-store.ts` | `AiProviderId` incluye `"aisa"`; `AppSettings.ai` gana `aisaApiKey` y `aisaModel` (por defecto `gpt-5.4`) |
| `lib/zernio/config.ts` | Constante `AISA_BASE_URL`; `AiConfig` y `getAiConfig()` resuelven la clave y el modelo de AIsa |
| `lib/services/ai.ts` | `callOpenAiCompatible()` (cliente común), `callAisa()`, ramas en `aiComplete`, `testAiConnection` y `testConfiguredAi`; helpers `aiModelForProvider()` y `aiActiveModel()` |
| `app/api/settings/route.ts` | Zod de `ai` y de `test-ai` aceptan `"aisa"`; el payload enmascarado expone `aisaApiKey*` y `aisaModel` |
| `components/settings/connections-panel.tsx` | Opción **AIsa (gateway multi-modelo)** en el selector, con campo de clave y de modelo |
| `app/(dashboard)/script/page.tsx` · `scheduler/page.tsx` | Pasan de un ternario `openai ? … : anthropicModel` a `aiActiveModel(ai)` |
| `.env.example` · `docker-compose.yml` | Nuevas variables `AISA_API_KEY`, `AISA_MODEL`, `AISA_BASE_URL` |

### Por qué se reutiliza el cliente de OpenAI

AIsa habla el protocolo OpenAI en `POST {AISA_BASE_URL}/chat/completions`, así
que `callOpenAI` y `callAisa` eran el mismo código salvo endpoint, clave y modelo.
Se extrajo `callOpenAiCompatible()` y los dos pasan a ser envoltorios de tres
líneas. Añadir un proveedor OpenAI-compatible nuevo cuesta ahora una función.

`AISA_MODEL` y `AISA_BASE_URL` son sobrescribibles, igual que el resto de
credenciales: `AISA_BASE_URL` permite apuntar a un proxy o a un entorno de
pruebas sin tocar código.

### Precedencia de credenciales

La misma que el resto del proyecto:

```text
valor guardado en /settings  >  AISA_API_KEY (entorno)  >  sin definir
```

`GET /api/settings` nunca devuelve el secreto: sólo una versión enmascarada
(`sk-••••••••4f2a`) y un booleano `aisaApiKeyConfigured`.

### Probarlo

En `/settings` → **Modelo de IA** → proveedor *AIsa* → pega la clave y pulsa
**Probar modelo**. Es una llamada real de 60 tokens (~coste despreciable) que
devuelve latencia y una muestra del texto, y verifica la clave **antes** de
guardarla.

---

## 3. Seguridad de la clave

- **Una clave por entorno.** AIsa permite etiquetar claves y ponerles tope de
  gasto, límite de RPM y *allowlist* de modelos. Para este proyecto conviene una
  clave distinta de las de otros servicios.
- **La clave vive en variables de entorno**, nunca en archivos versionados.
  `.gitignore` ya cubre `.env*`, `.data/settings.json` y `.commandcode/`, así que
  ni la clave del panel ni la config local del agente entran al repositorio.
- **Rotación.** AIsa recomienda rotar cada 90 días, y **de inmediato si
  sospechas exposición**: una clave filtrada da autoridad de gasto completa sobre
  el saldo. El orden es: crear la clave nueva → desplegarla → revocar la vieja
  desde <https://console.aisa.one>.
- **En serverless** (Vercel) usa variables de entorno, no el panel: el sistema de
  archivos es efímero y `.data/settings.json` no persiste.

---

## 4. Coste

AIsa factura **por llamada, contra el saldo de la cuenta**. No hay cuota fija.

- Consultar `GET /v1/models` y el saldo (`aisa balance`) es **gratis**.
- Cada generación del dashboard es **una** llamada. `lib/services/captions.ts`
  agrupa todas las plataformas en una sola petición precisamente por esto.
- El proveedor por defecto del dashboard sigue siendo `heuristic`: **coste cero**
  hasta que se conecta una clave a propósito.
- Una llamada con clave inválida agotada o sin saldo devuelve error y el
  dashboard cae al heurístico con el motivo en `note`, sin romper la UI.

---

## 5. Referencias

| Recurso | URL |
|---|---|
| Documentación | <https://aisa.one/docs> |
| Agent Quickstart | <https://aisa.one/docs/agent-quickstart> |
| Catálogo de modelos (IDs exactos) | <https://aisa.one/docs/guides/models> |
| Autenticación y rotación | <https://aisa.one/docs/guides/authentication> |
| Consola (claves, saldo, uso) | <https://console.aisa.one> |
| Skill oficial | `npx skills add AIsa-team/agent-skills --skill aisa --agent <harness> --global` |
| MCP remoto (alternativa al CLI) | `https://tools.aisa.one/mcp` |
