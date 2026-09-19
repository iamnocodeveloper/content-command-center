# 11 · Atribución de autoría

## Qué hay

En el pie de la barra lateral, justo debajo del estado de Zernio y del badge
`DEMO_MODE` / `LIVE`, se muestra el crédito de autoría:

> ♥ © por Joel Araujo · Nocodeveloper

Está definido en `components/app-sidebar.tsx` como una constante y se renderiza
en `SidebarBody`, por lo que aparece tanto en la barra fija de escritorio como en
el menú lateral de móvil.

```tsx
const COPYRIGHT = "© por Joel Araujo · Nocodeveloper";
```

## Cómo se protege

`scripts/verify-attribution.mjs` comprueba que el crédito sigue en su sitio. Está
enganchado al ciclo de build:

| Momento | Comando | Qué verifica |
|---|---|---|
| `prebuild` | `node scripts/verify-attribution.mjs` | Que la constante existe, que se renderiza con `{COPYRIGHT}` y que el icono `Heart` está importado y usado. |
| `postbuild` | `node scripts/verify-attribution.mjs --dist` | Que la cadena completa viaja dentro del bundle compilado en `.next/static`. |

Si la comprobación falla, el script sale con código 1 y **el build no termina**.
Como el despliegue (Vercel, Docker, CI) depende de `npm run build`, una versión
sin atribución no puede llegar a producción.

```
✗ Atribución eliminada o alterada

  · La constante COPYRIGHT no contiene "© por Joel Araujo · Nocodeveloper"

  El crédito de autoría es obligatorio en este proyecto.
  Restaura esta línea en components/app-sidebar.tsx:

      const COPYRIGHT = "© por Joel Araujo · Nocodeveloper";

  y vuelve a renderizarla con {COPYRIGHT}. Ver docs/11-atribucion.md.
```

También se ejecuta en `npm run check` (`verify:attribution`), así que salta en
local antes de subir nada.

### Detalle del chequeo del bundle

El bundler escapa los caracteres no ASCII, de modo que en el bundle la cadena
aparece como:

```js
"\xa9 por Joel Araujo \xb7 Nocodeveloper"
```

El verificador genera las tres representaciones posibles (cruda, `\xHH` y
`\uHHHH`) y exige la **cadena completa**. Esto importa: si sólo se buscara
`"Joel Araujo"` daría un falso positivo, porque la cabecera de la barra lateral
también muestra el nombre. Así el chequeo falla de verdad si se quita el crédito.

## Qué NO puede hacer esto

Hay que ser claro para no dar una falsa sensación de seguridad:

- **No hace el crédito imposible de borrar.** Es código fuente abierto bajo MIT:
  cualquiera que clone el repositorio puede editar `app-sidebar.tsx`, borrar el
  script y compilar. Ningún mecanismo dentro del propio código puede impedirlo.
- **No protege contra un fork.** Quien copie el proyecto puede quitar todo lo que
  quiera. Lo único que obtienes es que el fork no pase *tu* build.
- **No sustituye a una licencia.** Si necesitas que la atribución sea legalmente
  exigible, el instrumento correcto es la licencia (por ejemplo, cambiar de MIT a
  una licencia que exija mantener el aviso de copyright).

Lo que sí consigue, que es lo razonablemente alcanzable:

- Evita que el crédito desaparezca **por descuido** en una refactorización.
- Hace que quitarlo sea una decisión **deliberada y visible**: hay que borrar el
  script y los hooks del `package.json`, no basta con ignorarlo.
- Garantiza que **tu** despliegue siempre lo lleva.

## Si quieres reforzarlo más

Opciones, de menor a mayor alcance:

1. **Añadir el chequeo al CI** (ya ocurre de forma indirecta, porque el workflow
   ejecuta `npm run build`, que dispara `prebuild` y `postbuild`).
2. **Cambiar la licencia** a una que exija preservar el aviso de copyright. Es la
   única vía con efectos legales.
3. **Proteger la rama `main`** en GitHub para que los cambios entren por pull
   request y se vea cuándo alguien toca la atribución.
4. **Firmar los commits** con GPG para que el historial sea verificable.

## Cómo cambiarlo

Si en algún momento quieres modificar el texto del crédito, hay que actualizar
**los tres sitios** a la vez o el build fallará (que es justo lo que se busca):

1. La constante `COPYRIGHT` en `components/app-sidebar.tsx`.
2. La constante `REQUIRED` en `scripts/verify-attribution.mjs`.
3. Este documento.
