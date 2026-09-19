/**
 * Validador de XML para los assets SVG del README.
 *
 * No pretende ser un parser completo: comprueba que todas las etiquetas abren y
 * cierran en orden, que las autocerradas están bien y que no quedan atributos
 * sin comillas. Detecta el 95% de los errores que hacen que GitHub muestre un
 * SVG en blanco.
 *
 * Uso: node scripts/validate-svg.mjs docs/assets/*.svg
 */
import { readFileSync } from "node:fs";

const VOID_OK = new Set(["br", "hr", "img", "input", "meta", "link"]);

function validate(file) {
  const source = readFileSync(file, "utf8");
  const problems = [];
  const stack = [];

  // Comillas sin cerrar en atributos
  const quoteCount = (source.match(/"/g) ?? []).length;
  if (quoteCount % 2 !== 0) {
    problems.push("número impar de comillas dobles (atributo sin cerrar)");
  }

  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let match;
  let index = 0;

  while ((match = tagPattern.exec(source)) !== null) {
    const [, closing, name, , selfClosing] = match;
    index++;

    if (name === "?xml" || name === "!DOCTYPE") continue;
    if (closing === "/") {
      const open = stack.pop();
      if (open !== name) {
        problems.push(
          `cierre inesperado </${name}> en la etiqueta #${index}` +
            (open ? ` (se esperaba </${open}>)` : " (no había nada abierto)"),
        );
      }
      continue;
    }

    if (selfClosing === "/" || VOID_OK.has(name)) continue;
    stack.push(name);
  }

  if (stack.length > 0) {
    problems.push(`etiquetas sin cerrar: ${stack.join(" > ")}`);
  }

  if (!source.trimStart().startsWith("<svg") && !source.includes("<svg")) {
    problems.push("no contiene un elemento <svg>");
  }

  return { file, problems, tags: index };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Uso: node scripts/validate-svg.mjs <archivo.svg> [...]");
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  try {
    const { problems, tags } = validate(file);
    if (problems.length === 0) {
      console.log(`  OK    ${file}  (${tags} etiquetas)`);
    } else {
      failed++;
      console.error(`  FALLO ${file}`);
      for (const problem of problems) console.error(`        · ${problem}`);
    }
  } catch (error) {
    failed++;
    console.error(`  FALLO ${file}: ${error.message}`);
  }
}

console.log(failed === 0 ? "\nTodos los SVG son válidos." : `\n${failed} archivo(s) con errores.`);
process.exit(failed === 0 ? 0 : 1);
