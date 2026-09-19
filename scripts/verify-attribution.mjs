/**
 * Verificador de atribución.
 *
 * Comprueba que el crédito de autoría sigue presente en la barra lateral y, en
 * modo `--dist`, que además viaja dentro del bundle compilado.
 *
 * Se ejecuta automáticamente:
 *   - `prebuild` → revisa el código fuente.
 *   - `postbuild` → revisa el bundle generado en `.next`.
 *
 * Si el crédito desaparece, el script sale con código 1 y **el build falla**,
 * de modo que un despliegue sin atribución no puede llegar a producción.
 *
 * Uso:
 *   node scripts/verify-attribution.mjs           # fuente
 *   node scripts/verify-attribution.mjs --dist    # fuente + bundle
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Cadena exacta que debe existir en el código fuente. */
const REQUIRED = "© por Joel Araujo · Nocodeveloper";

/**
 * El bundler escapa los caracteres no ASCII (`©` → `\xa9`, `·` → `\xb7`), así
 * que en el bundle hay que buscar cualquiera de estas representaciones. Se
 * exige la cadena completa para que no valga con la cabecera de la barra
 * lateral, que también menciona el nombre.
 */
function bundleVariants(text) {
  const hex = (char) =>
    `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`;
  const unicode = (char) =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;

  const nonAscii = [...text].filter((char) => char.charCodeAt(0) > 127);

  return [
    text,
    nonAscii.reduce((acc, char) => acc.replace(char, hex(char)), text),
    nonAscii.reduce((acc, char) => acc.replace(char, unicode(char)), text),
  ];
}

const DIST_VARIANTS = bundleVariants(REQUIRED);

const SOURCE_FILE = join(process.cwd(), "components", "app-sidebar.tsx");
const DIST_DIR = join(process.cwd(), ".next", "static");

const red = (text) => `\u001b[31m${text}\u001b[0m`;
const green = (text) => `\u001b[32m${text}\u001b[0m`;
const dim = (text) => `\u001b[2m${text}\u001b[0m`;

function fail(messages) {
  console.error(`\n${red("✗ Atribución eliminada o alterada")}\n`);
  for (const message of messages) console.error(`  · ${message}`);
  console.error(
    `\n  El crédito de autoría es obligatorio en este proyecto.\n` +
      `  Restaura esta línea en components/app-sidebar.tsx:\n\n` +
      `      const COPYRIGHT = "${REQUIRED}";\n\n` +
      `  y vuelve a renderizarla con {COPYRIGHT}. Ver docs/11-atribucion.md.\n`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Comprobación sobre el código fuente
// ---------------------------------------------------------------------------

if (!existsSync(SOURCE_FILE)) {
  fail([`No existe ${SOURCE_FILE}`]);
}

const source = readFileSync(SOURCE_FILE, "utf8");
const missing = [];

if (!source.includes(REQUIRED)) {
  missing.push(`La constante COPYRIGHT no contiene "${REQUIRED}"`);
}

if (!/\{COPYRIGHT\}/.test(source)) {
  missing.push("La constante COPYRIGHT existe pero no se renderiza en el JSX");
}

if (!/from "lucide-react"/.test(source) || !/\bHeart\b/.test(source)) {
  missing.push("Falta el icono Heart junto al crédito");
}

if (!/<Heart/.test(source)) {
  missing.push("El icono Heart no se está usando en el JSX");
}

if (missing.length > 0) fail(missing);

console.log(`${green("✓")} Atribución presente en el código fuente`);
console.log(dim(`  ${SOURCE_FILE}`));

// ---------------------------------------------------------------------------
// 2. Comprobación opcional sobre el bundle compilado
// ---------------------------------------------------------------------------

if (!process.argv.includes("--dist")) {
  process.exit(0);
}

if (!existsSync(DIST_DIR)) {
  console.log(
    dim("  (sin .next/static todavía: se omite la comprobación del bundle)"),
  );
  process.exit(0);
}

function collectJs(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectJs(full, files);
    else if (entry.endsWith(".js")) files.push(full);
  }
  return files;
}

const chunks = collectJs(DIST_DIR);
let matched = false;
let matchedChunk = null;

for (const chunk of chunks) {
  const content = readFileSync(chunk, "utf8");
  if (DIST_VARIANTS.some((variant) => content.includes(variant))) {
    matched = true;
    matchedChunk = chunk;
    break;
  }
}

if (!matched) {
  fail([
    `El crédito no aparece en el bundle compilado (${chunks.length} chunks revisados)`,
    `Se buscaba: ${REQUIRED}`,
  ]);
}

console.log(
  `${green("✓")} Atribución presente en el bundle compilado (${chunks.length} chunks)`,
);
console.log(dim(`  ${matchedChunk}`));
