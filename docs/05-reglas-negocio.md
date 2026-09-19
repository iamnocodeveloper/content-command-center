# 05 · Reglas de negocio

Todas las reglas viven en código, no en configuración dispersa. Se listan con su
umbral exacto y el archivo donde están implementadas.

---

## Biblioteca de hooks

### Clasificación en plantilla

`lib/domain/hook-engine.ts#classifyHook`

Puntuación por plantilla del catálogo:

| Señal | Puntos |
|---|---|
| Coincidencia de patrón «fuerte» del tipo (p. ej. `\bacaba de\b` para callout) | **+3** por coincidencia |
| Coincidencia de patrón «débil» del mismo tipo | **+1** |
| Bonus estructural (la plantilla empieza por «Deja de» y el texto también) | **+4** |
| Desempate histórico: `averageViews / 1 000 000` | **+0 a +0,4** |

Se elige la plantilla con más puntos. `confidence = (top / suma) × min(1, top/4)`
acotado a 1. Si no hay ninguna coincidencia se asigna la plantilla de mayor
rendimiento histórico con `confidence = 0.15`.

**Estructuras con bonus:** número inicial → `[NÚMERO]`; «deja de» →
`Deja de hacer [X]`; «si sigues» → `Si sigues…`; «acaba de» →
`[X] acaba de destruir [Y]`; «cómo pasé de» → `Cómo pasé de [A] a [B]`.

### Nicho

`lib/domain/hook-engine.ts#detectNiche`: palabras clave por nicho sobre el texto
libre + texto en pantalla + tags. `confidence = aciertos_mejor / aciertos_totales`
(0,2 si no hay ninguno).

### Nivel (tier)

| Tier | Condición |
|---|---|
| `viral` | `views ≥ 500 000` |
| `high` | `views ≥ 150 000` |
| `standard` | resto |

### Métricas derivadas

Si no se aportan, se estiman desde las visualizaciones: `likes = 7 %` y
`saves = 2 %`.

---

## Analíticas

Implementado en `lib/domain/analytics-service.ts`.

### Rangos

`7`, `30` o `90` días. La ventana es `(hoy − range, hoy]` en UTC.

### Variación (delta)

```
delta = (total − anterior) / anterior
```

donde `anterior` es la ventana inmediatamente previa del mismo tamaño. Si
`anterior = 0` y `total > 0`, `delta = 1` (+100 %).

### Contenido destacado

```
baseline30d = media de views de los posts publicados en los últimos 30 días
destacado   = post.views ≥ 2 × baseline30d
```

- `STANDOUT_THRESHOLD = 2` (exportado).
- Si no hay posts en los últimos 30 días, la base se calcula sobre **todos** los
  posts para no dejar el panel vacío.
- Si `baseline30d = 0`, no se marca ningún destacado.
- Orden: de mayor a menor multiplicador.

La razón mostrada (`reason`) se compone con las señales que se cumplen:
multiplicador, tasa de guardado > 3 % y ratio de compartidos > 0,8 %.

### Top 5

Ordenado por `views` descendente. Para cada uno se calculan:

| Señal | Fórmula |
|---|---|
| Multiplicador | `views / baseline30d` |
| Engagement | `(likes + comments + shares + saves) / views × 100` |
| Tasa de guardado | `saves / views × 100` |
| Ratio de compartidos | `shares / views × 100` |

Y se redacta una explicación combinando los umbrales que se superan
(multiplicador ≥ 2 o ≥ 1,3; guardado ≥ 3 % o ≥ 2 %; compartidos ≥ 0,8 %;
engagement ≥ 8 %) más la razón de la plantilla del hook detectada.

### Engagement medio

```
engagementRate = (likes + comments + shares + saves) / views × 100
```

con `views ≥ 1` para evitar división por cero.

---

## Competidores

### Cadencia

Semanal, **domingos a las 06:00** en la zona del perfil. En `vercel.json` se
declara `0 12 * * 0` **UTC**, que equivalen a las 06:00 en UTC-6. Si cambias de
zona, ajusta la expresión.

### Selección

Los **5 Reels con mejor rendimiento** de cada cuenta vigilada, ordenados por
`views` y numerados 1..5 por cuenta (`rank`).

### Extracción

1. `transcribe({ mediaUrl })` → transcripción del audio.
2. `extractHook(transcript)` → primera frase con carga semántica, descartando
   muletillas de apertura (`hola`, `qué tal`, `bienvenidos`, `hoy te voy a…`,
   `en este video`). Se exige longitud > 20 caracteres.
3. `extractOnScreenText(overlay)` → hasta 3 líneas de entre 4 y 80 caracteres,
   unidas con ` · `.

### Guardar en el Banco de Hooks

`saveReelToHooks(reelId)` crea un `Hook` con `id = hook_<reelId>` (idempotente:
repetir la acción no duplica) y marca `savedToHooks = true`. Hereda el nicho de la
cuenta competidora.

### Semana

Formato ISO `YYYY-Www` (p. ej. `2026-W37`), calculado con el jueves de la semana
según ISO 8601.

---

## Programador

### Modos de publicación (excluyentes)

| Se envía | Resultado en Zernio |
|---|---|
| `date` + `time` + `timezone` | `scheduledFor` → publica en esa hora local |
| `publishNow: true` | Publica de inmediato |
| `isDraft: true` | Se guarda como borrador |

Sin ninguno de los tres, la API propia devuelve **400**.

### Idempotencia

Toda creación de post envía `x-request-id`. Zernio deduplica por hash de
contenido durante 24 h, así que un reintento devuelve el post original. Sin
`ZERNIO_API_KEY`, el gateway sintetiza el post con el mismo contrato
(`simulated: true`).

### Captions

- Los hashtags se dimensionan por red: Instagram 12, TikTok 5, LinkedIn 5,
  YouTube 4, Facebook 4, Threads 3, X 2.
- Se combinan los hashtags del nicho (5), el del nicho en sí y un banco
  transversal de 10, deduplicando.
- Cada plataforma tiene su CTA propio y su tono.
- Instagram y TikTok reciben además un `firstComment` sugerido.

---

## Tendencias

`lib/services/trend-classifier.ts`.

### Hook score (0-100)

| Dimensión | Peso | Cómo se mide |
|---|---|---|
| Novedad | 0,35 | Verbos de cambio («lanza», «acaba de», «nuevo», «reemplaza»…) `min(1, aciertos / 2,5)` |
| Concreción | 0,25 | Cifras, porcentajes, dinero y plazos `min(1, señales / 3)` |
| Tensión | 0,25 | Riesgo, prohibición, multa, despido, regulación, «adiós», «ya no» `min(1, aciertos / 2,5)` |
| Autoridad | 0,15 | Por categoría de fuente: labs 1,0 · research 0,85 · media 0,7 · newsletter 0,6 · community 0,5 |

```
raw   = Σ (dimensión × peso)        // 0..1
score = round(30 + raw × 69)        // 30..99
```

Se proyecta al rango **30-99** para que ningún item quede inservible ni perfecto.

### Clasificación por categoría

`Agentes` · `Modelos` · `Regulación` · `Vídeo` · `Herramientas` ·
`Investigación` · `Negocio` · `General`, por coincidencia de palabras clave.

### Sugerencia de hook

Se elige la plantilla según el perfil de características:

| Condición | Plantilla sugerida |
|---|---|
| Tensión > 0,5 | Última oportunidad (`warning-last`) → urgencia regulatoria |
| Novedad > 0,6 | Callout destructivo (`callout-destroy`) → demo con antes/después |
| Concreción > 0,5 | Antes y después (`proof-before-after`) → caso con números |
| Resto | Lista (`listicle-wish`) → lista práctica aplicada al nicho |

Se considera **potencial alto** un score `≥ 85` (lo que destaca la cabecera del
panel con el badge).

---

## Calendario

`lib/services/calendar-service.ts`.

### Huecos óptimos

`OPTIMAL_SLOTS` ordena los días por peso histórico de engagement:

| Día | Hora | Peso |
|---|---|---|
| Miércoles | 18:00 | **1,18** |
| Jueves | 12:00 | 1,05 |
| Martes | 12:00 | 1,00 |
| Lunes | 18:00 | 0,92 |
| Domingo | 11:00 | 0,78 |
| Viernes | 10:00 | 0,72 |
| Sábado | 11:00 | 0,70 |

Se toman los `perWeek` huecos de mayor peso (máximo 7).

### Selección de hooks

Orden: **favoritos primero**, luego por `views` descendente. Se **evita repetir la
misma plantilla en publicaciones consecutivas**: si el siguiente hook comparte
`patternId` con el anterior, se avanza uno más.

### Ángulos

Se rotan 12 ángulos (`CONTENT_ANGLES`) de forma cíclica, de modo que un mes de 13
publicaciones no repite enfoque salvo al cerrar el ciclo.

### Inyección de actualidad

Una de cada cuatro piezas incorpora al ángulo una tendencia con
`hookScore ≥ 85`, conectando el plan editorial con lo que está pasando.

### Plataformas

Se distribuyen round-robin entre las seleccionadas, para que ninguna acapare el
calendario.

---

## Integraciones (reglas de seguridad)

- **Precedencia de configuración**: valor guardado en `/settings` > variable de
  entorno > defecto. La procedencia se expone como `file | env | unset`.
- **Secretos**: nunca se devuelven al navegador; la API sólo manda una versión
  enmascarada (`sk_abc••••••••1234`) y un booleano.
- **Persistencia**: `.data/settings.json` con permisos `0600`. Si el disco no
  permite escribir, se devuelve `persisted: false` con un aviso y la
  configuración sigue activa en memoria para esa instancia.
- **Modo demo** (`auto | on | off`): en `auto` se activa cuando no hay API key.
- **Cron**: protegido con `CRON_SECRET` (`Authorization: Bearer …`). Sin la
  variable, el endpoint queda abierto para pruebas locales.

## IA (reglas de degradación)

- El proveedor por defecto es `heuristic`: plantillas locales, sin coste ni red.
- `aiComplete()` lanza `AiUnavailableError` si el proveedor no está configurado o
  falla; **las funciones de alto nivel nunca lanzan**: devuelven el resultado
  local y un campo `note` con el motivo.
- Timeout de 60 s por llamada (20 s en las pruebas de conexión).
- Los formatos JSON se piden explícitamente y se parsean de forma tolerante
  (`parseJsonLoose`: quita vallas de código y recorta al primer objeto/array).
- Si el modelo responde texto libre donde se esperaba JSON, se aprovecha como
  cuerpo del guion en lugar de descartarlo.
