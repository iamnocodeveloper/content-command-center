# 04 · Diseño

## Principios

1. **Modo oscuro de serie.** El dashboard se usa de noche, con luz baja y
   durante sesiones largas. El tema oscuro no es una opción secundaria: es el
   defecto y el modo claro es el alternativo.
2. **Terracota como único acento.** Un solo color de marca, usado con disciplina
   (foco, acción primaria, datos destacados). Todo lo demás es superficie neutra
   cálida. Si todo brilla, nada destaca.
3. **Densidad informativa sin ruido.** Es un panel de operaciones: mucha
   información por pantalla, jerarquizada con tamaño y opacidad, no con líneas y
   cajas de colores.
4. **Cero sorpresas.** Estados hover, focus y disabled consistentes en todos los
   interactivos; el foco siempre visible.

## Paleta

### Superficies oscuras (cálidas, no neutras)

| Token | HSL | Uso |
|---|---|---|
| `--background` | `24 12% 6%` | Fondo de la app |
| `--card` | `24 12% 9%` | Tarjetas y paneles |
| `--popover` | `24 13% 11%` | Menús, tooltips, hojas |
| `--muted` | `24 10% 15%` | Rellenos secundarios |
| `--border` | `24 10% 17%` | Bordes de 1 px |
| `--sidebar` | `24 13% 8%` | Barra lateral |

El matiz **24** (naranja muy apagado) es deliberado: un gris frío (matiz 220)
haría que el terracota pareciera sucio. Con base cálida, el acento se integra.

### Marca

| Token | Claro | Oscuro | Nota |
|---|---|---|---|
| `--primary` | `16 55% 50%` | `16 62% 56%` | Terracota. En oscuro se **aclara** para alcanzar contraste AA sobre `#100c0a`. |
| `--primary-foreground` | `30 30% 98%` | `24 20% 8%` | Texto sobre el acento (se invierte por tema). |
| `--accent` | `18 60% 95%` | `16 30% 18%` | Fondo de hover muy suave. |
| `--ring` | = `--primary` | = `--primary` | El foco siempre es terracota. |

Además, la escala completa `terracotta-50 … terracotta-950` está disponible en
`tailwind.config.ts` para usos puntuales (degradados, ilustraciones).

### Semánticos

| Token | Oscuro | Uso |
|---|---|---|
| `--success` | `152 45% 45%` | Estado publicado, deltas positivos, conexión OK |
| `--warning` | `38 80% 55%` | Modo demo, advertencias, tier «alto» |
| `--destructive` | `0 62% 52%` | Errores, deltas negativos |

### Series de gráficas

`--chart-1 … --chart-5` van del terracota al índigo pasando por ámbar y cian.
En oscuro suben de luminosidad (~62 %) para leerse sobre `--card`. Se asignan por
índice, así que el orden importa: **chart-1 es siempre la marca**.

## Tipografía

- **Geist Sans** (variable `--font-geist-sans`) para UI, servida localmente desde
  el paquete `geist`. Sin peticiones a Google Fonts en build.
- **Geist Mono** (variable `--font-geist-mono`) para identificadores, IDs de
  Zernio, plantillas de hook e inputs de credenciales.
- Cifras siempre con `tabular-nums` en métricas, tablas y contadores, para que no
  bailen al actualizarse.
- Escala usada: `text-2xl` (título de página y valores de KPI), `text-base`
  (títulos de tarjeta), `text-sm` (cuerpo), `text-xs` (metadatos y etiquetas).

## Espaciado y forma

- Radio base `--radius: 0.75rem`; las tarjetas usan `rounded-lg`, los controles
  `rounded-md`, los chips `rounded-full`.
- Tarjetas: `p-4`/`p-5`, borde de 1 px y **sin sombra** en reposo. La elevación
  se reserva a elementos flotantes (menús, hojas, diálogos).
- Rejilla de contenido: `max-w-[1440px]` con `px-6`, y rejillas de 1/2/3 columnas
  según breakpoint para las tarjetas de listado.

## Componentes del sistema

Primitivos shadcn/ui (estilo *new-york*) copiados al repo en `components/ui/`:

`button` · `card` · `input` · `textarea` · `label` · `badge` · `separator` ·
`tabs` · `dialog` · `sheet` · `select` · `dropdown-menu` · `checkbox` · `switch` ·
`popover` · `tooltip` · `table` · `avatar` · `progress` · `skeleton` ·
`scroll-area` · `sonner`

### Variantes propias

- **`button`** añade `variant="success"` y el tamaño `icon-sm` (32 px), pensado
  para acciones dentro de tarjetas densas.
- **`badge`** añade `success`, `warning` y `muted` para estados sin gritar.
- **`sheet`** el panel lateral arranca en `sm:max-w-xl`, que es el ancho con el
  que se lee cómodo un guion completo.

### Componentes de producto

| Componente | Papel |
|---|---|
| `app-sidebar` | Barra lateral con **@nocodeveloper** arriba, las 6 secciones, las 2 de apoyo, el estado de Zernio y el conmutador de tema. En móvil se convierte en `Sheet`. |
| `page-header` | Cabecera con `eyebrow` («Sección 2»), título, descripción y acciones. Lleva el degradado `brand-glow`. |
| `stat-card` | KPI con valor, delta con flecha e sparkline SVG propia (sin librería). |
| `empty-state` | Estado vacío consistente: icono, título, explicación y acción. |
| `platform-icon` | Mapea valores de Zernio (`instagram`, `twitter`…) a icono y color de marca. |
| `hook-card` | Tarjeta de hook: original, plantilla, métricas, creador y acciones. |
| `connections-panel` | Tarjetas de conexión con prueba, guardado y procedencia del valor. |

## Barra lateral

- 272 px fijos en `lg+`, pegada arriba (`sticky`) para que no se desplace con el
  contenido.
- **Cabecera**: avatar con iniciales `NC` sobre `bg-primary/15`, el handle
  `@nocodeveloper` y el nombre «Joel Araujo».
- Cada entrada muestra **etiqueta + descripción corta**: en un panel de seis
  secciones con nombres largos, la descripción evita tener que entrar para
  recordar qué hace cada una.
- Estado activo: fondo `--sidebar-accent`, texto de acento y el icono en
  terracota. También se marca con `aria-current="page"`.
- **Pie**: estado de la integración (badge `DEMO_MODE` en ámbar o `LIVE` en
  verde) y el conmutador de tema.

## Accesibilidad

- Foco visible en todo interactivo: `focus-visible:ring-2 ring-ring ring-offset-2`.
- Botones de sólo icono con `aria-label` descriptivo.
- Navegación con `aria-current` y `aria-label="Secciones"`.
- Los títulos de los `Sheet`/`Dialog` siempre presentes (ocultos con `sr-only`
  cuando el diseño no los muestra).
- Contraste: el terracota oscuro se eligió para superar AA sobre el fondo más
  oscuro; nunca se usa terracota claro como fondo de texto pequeño.
- Ni el color ni la posición son el único indicador de estado: los deltas llevan
  flecha además del color, y los estados llevan texto además del badge.

## Movimiento

- Transiciones cortas y funcionales: `transition-colors` en hover, ~200 ms.
- Animación de entrada `fade-in` (0,25 s, 4 px de desplazamiento) **sólo** en
  tarjetas que aparecen al filtrar.
- `prefers-reduced-motion` no requiere tratamiento especial: no hay animaciones
  continuas ni autoplay.

## Modo claro

Existe y es funcional, con la misma estructura de tokens invertida, pero no es la
experiencia objetivo: `defaultTheme` es `dark` y `enableSystem` está desactivado
para que el tema no cambie según la máquina. Se cambia desde el botón de la barra
lateral o el de la cabecera móvil.

## Referencia rápida de tokens

```css
/* app/globals.css */
:root  { --background: 30 20% 98%; --primary: 16 55% 50%; /* … */ }
.dark  { --background: 24 12% 6%;  --primary: 16 62% 56%; /* … */ }
```

```tsx
/* Uso */
<div className="bg-background text-foreground" />
<Card className="border-border" />
<Badge variant="warning">DEMO_MODE</Badge>
<Button className="bg-primary text-primary-foreground" />
<span className="font-mono text-xs">{postId}</span>
```
