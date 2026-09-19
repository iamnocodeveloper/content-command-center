/**
 * Ingesta manual de tendencias.
 *
 * Uso:  npm run ingest:trends
 *
 * Reutiliza el mismo clasificador que la ruta /api/cron/trends, pero desde la
 * terminal, útil para poblar el store en local sin desplegar. Requiere que las
 * fuentes sean accesibles desde tu red.
 */
import { TREND_SOURCES } from "../lib/domain/seed/trends";
import { classifyTrendItem } from "../lib/services/trend-classifier";
import type { TrendItem } from "../lib/domain/types";

async function main() {
  console.log(`Leyendo ${TREND_SOURCES.length} fuentes…\n`);

  const collected: TrendItem[] = [];

  for (const source of TREND_SOURCES) {
    try {
      const response = await fetch(source.url, {
        headers: {
          "User-Agent": "ContentCommandCenter/1.0",
          Accept: "application/rss+xml, application/atom+xml, application/xml",
        },
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        console.warn(`  ✗ ${source.name} · HTTP ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const blocks = [
        ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
        ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
      ]
        .map((match) => match[0])
        .slice(0, 6);

      for (const [index, block] of blocks.entries()) {
        const title = decode(block.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] ?? "");
        const summary = strip(
          decode(
            block.match(/<description[^>]*>(.*?)<\/description>/is)?.[1] ??
              block.match(/<summary[^>]*>(.*?)<\/summary>/is)?.[1] ??
              "",
          ),
        ).slice(0, 400);
        const url =
          block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ??
          decode(block.match(/<link[^>]*>(.*?)<\/link>/is)?.[1] ?? "");

        if (title.length < 12) continue;

        const classified = classifyTrendItem(
          { title, summary, sourceName: source.name },
          source,
        );

        collected.push({
          id: `trend_${source.id}_${index}`,
          title,
          summary,
          url,
          sourceId: source.id,
          sourceName: source.name,
          publishedAt: new Date().toISOString(),
          ...classified,
        });
      }

      console.log(`  ✓ ${source.name} · ${blocks.length} items`);
    } catch (error) {
      console.warn(
        `  ✗ ${source.name} · ${error instanceof Error ? error.message : "error"}`,
      );
    }
  }

  collected.sort((a, b) => b.hookScore - a.hookScore);

  console.log(`\n${collected.length} noticias clasificadas.\n`);
  console.log("Top 5 por potencial de hook:");
  for (const item of collected.slice(0, 5)) {
    console.log(`  ${item.hookScore}  ${item.title}`);
    console.log(`       → ${item.hookSuggestion}`);
  }
}

function decode(input: string): string {
  return input
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function strip(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
