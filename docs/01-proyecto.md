# 01 · Proyecto

## Qué es

**Content Command Center** es el panel de operaciones de contenido de un creador
individual. Sustituye la dispersión de notas, hojas de cálculo, capturas de
pantalla y recordatorios por un único dashboard donde el contenido se captura,
se mide, se planifica y se publica.

Está construido sobre la **API de Zernio** para todo lo que toca plataformas
reales (cuentas conectadas, publicación multiplataforma y métricas) y sobre un
modelo propio para lo que Zernio no cubre (biblioteca de hooks, vigilancia de
competidores, tendencias y plan editorial).

## El problema

Un creador que publica a diario se enfrenta a cinco fricciones:

1. **Los hooks se pierden.** Se ven hooks brillantes en el feed de otros, se
   guardan en «Guardados» y nunca se recuperan ni se adaptan.
2. **Los datos no se leen.** Las analíticas de cada plataforma viven en su propia
   app; nadie compara el rendimiento de un Reel contra su propia media.
3. **Los competidores se copian a ojo.** Ver qué funciona en tu nicho exige
   abrir ocho perfiles cada semana y confiar en la memoria.
4. **Publicar multiplica el trabajo.** Cada plataforma tiene su formato, su
   caption y su momento.
5. **Las noticias de IA saturan.** Hay 12 fuentes relevantes; nadie las lee
   todas, y menos con criterio de «¿esto da un hook?».

## Cómo lo resuelve, sección por sección

### 1. Biblioteca de Hooks (`/hooks`)

Cada hook que el creador guarda (pegado a mano, importado de un competidor o
recogido de una tendencia) pasa por el **motor de hooks**, que lo normaliza a una
de las 14 plantillas del catálogo.

- Se conserva el **texto original** y la **versión plantilla**, para no perder el
  matiz de cómo se dijo.
- Se clasifica por **tipo** (callout, contrarian, listicle, prueba, advertencia,
  pregunta, historia, utilidad, brecha de curiosidad) y por **nicho**.
- Se etiqueta con un **nivel** según sus visualizaciones: `viral` (≥500K),
  `high` (≥150K), `standard`.
- Se puede **buscar por nicho, tipo de hook y rango de visualizaciones**, además
  de por texto libre y favoritos.
- Muestra **creador original, visualizaciones y fecha de guardado**.
- El botón **«Usar este hook»** lo inyecta en `/script` y navega allí.

Debajo del listado hay un **catálogo de plantillas** con el uso real de cada una
y la mejor cifra que ha alcanzado en la cuenta.

### 2. Analíticas (`/analytics`)

- Métricas de **visualizaciones, guardados, nuevos seguidores, interacciones,
  compartidos y clics**, cada una con su variación respecto al periodo anterior.
- Gráfica de tendencia con selector de **7 / 30 / 90 días** y de métrica.
- Desglose **por plataforma** y volumen de interacción.
- **Contenido destacado**: todo post que supere **2× la media de 30 días**.
- **Top 5 de la semana** ordenado por visualizaciones, con una explicación
  redactada a partir de sus señales (multiplicador, tasa de guardado, ratio de
  compartidos, engagement y tipo de hook).

### 3. Seguimiento de Competidores (`/competitors`)

- **8 cuentas** vigiladas, agrupadas por nicho.
- Cada domingo a las 06:00 se leen los **5 Reels con mejor rendimiento** de cada
  una, se **transcribe el audio** y se extraen el **hook hablado** y el **texto
  en pantalla**.
- Listado ordenado por visualizaciones con el **usuario del creador**, su **número
  de seguidores** y un botón **«Guardar en el Banco de Hooks»** que crea
  directamente la entrada en la biblioteca (clasificada y con su tier).
- Panel lateral con la **transcripción completa**.

### 4. Programador (`/scheduler`)

- Selección múltiple de cuentas destino (una pieza → todas las plataformas).
- Fecha, hora y zona horaria.
- **Generación automática de captions** por plataforma a partir del hook y el
  ángulo, con hashtags dimensionados a cada red (12 en Instagram, 2 en X…).
- Cada caption se puede **aplicar** al contenido o **reescribir con IA**.
- Tres modos: **programar**, **publicar ahora** o **guardar borrador**.

### 5. Calendario de Contenido (`/calendar`)

- Vista **mensual** con todos los bloques: los del plan local y los ya
  programados en Zernio.
- Cada bloque muestra **hora exacta, plataforma y hook**.
- Al hacer clic se abre un **panel lateral con el guion completo y la caption**,
  el ángulo, el estado y el id de Zernio, con un atajo para enviarlo al
  Programador.
- El botón **«Autocompletar mes»** ejecuta el script que cruza la biblioteca de
  hooks con los ángulos de contenido, coloca cada pieza en el mejor hueco de
  engagement y escribe su caption.

### 6. Tendencias (`/trends`)

- **12 fuentes** de IA (laboratorios, investigación, medios, comunidades y
  newsletters) con su recuento de items.
- Cada noticia llega con un **hook score (0-100)**, un **ángulo de contenido** y
  un **hook sugerido** ya formateado contra el catálogo de plantillas.
- Filtros por fuente, categoría, umbral de score y texto; orden por potencial o
  por fecha.
- Botón **«Usar este hook»** que lo lleva al estudio de guiones.

## Rutas de apoyo

### `/script` — Estudio de guiones

El punto de encuentro de todo el flujo. Aquí aterrizan los hooks de la
Biblioteca, de Competidores y de Tendencias. Permite escribir el desarrollo,
**generar el guion completo con IA**, proponer **variaciones de hook**, generar
la caption y enviarlo al Programador. El borrador persiste en `localStorage`.

### `/settings` — Ajustes y conexiones

Conecta Zernio (API key + profile) y el modelo de IA (OpenAI o Anthropic), y
elige el proveedor de transcripción. Cada tarjeta tiene su botón de **probar
conexión** antes de guardar y muestra de dónde sale cada credencial (panel o
variable de entorno).

## Perfiles de uso

| Perfil | Necesita |
|---|---|
| **Explorar la demo** | Nada. `npm run dev` y listo. |
| **Uso personal en un VPS** | API key de Zernio; opcionalmente una key de IA. |
| **Multi-instancia / serverless** | Variables de entorno + base de datos (ver `03-bases-de-datos.md`). |

## Fuera de alcance (explícito)

- **Multiusuario y autenticación**: el dashboard asume un único creador. Añadir
  login es un paso previo a exponerlo en internet.
- **Gestión de la biblioteca de media**: la subida a Zernio está implementada en
  `lib/zernio/media.ts` (presign + PUT), pero el Programador publica texto sin
  adjuntar archivos desde la UI.
- **Edición colaborativa**: el borrador es local, no compartido.
- **Publicación de los competidores o de terceros**: sólo se lee.
