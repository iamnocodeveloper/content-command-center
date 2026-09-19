import { NextResponse, type NextRequest } from "next/server";

import { replaceTrends } from "@/lib/domain/repository";
import { SEED_TRENDS, TREND_SOURCES } from "@/lib/domain/seed/trends";
import { classifyTrendItem } from "@/lib/services/trend-classifier";
import { assertCronAuthorized } from "@/lib/server/cron-auth";
import type { TrendItem } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface FeedItem {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
}

/**
 * GET /api/cron/trends
 *
 * Ingesta de las 12 fuentes de IA. Lee cada feed RSS, normaliza los items y les
 * asigna el `hookScore`, el ángulo y la sugerencia de hook. Si una fuente falla
 * (timeout, 403, cambio de formato) se conservan los items de las que sí
 * respondieron; si fallan todas, se mantiene el material anterior.
 */
export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const collected: TrendItem[] = [];
  const perSource: Array<{ source: string; items: number; error?: string }> = [];

  const results = await Promise.allSettled(
    TREND_SOURCES.map(async (source) => {
      const items = await fetchFeed(source.url);
      return { source, items };
    }),
  );

  for (const [index, result] of results.entries()) {
    const source = TREND_SOURCES[index];

    if (result.status === "rejected") {
      perSource.push({
        source: source.name,
        items: 0,
        error: result.reason instanceof Error ? result.reason.message : "error",
      });
      continue;
    }

    const { items } = result.value;
    perSource.push({ source: source.name, items: items.length });

    for (const item of items.slice(0, 6)) {
      const classified = classifyTrendItem(
        { ...item, sourceName: source.name },
        source,
      );

      collected.push({
        id: `trend_${source.id}_${hash(item.url)}`,
        title: item.title,
        summary: item.summary,
        url: item.url,
        sourceId: source.id,
        sourceName: source.name,
        publishedAt: item.publishedAt,
        ...classified,
      });
    }
  }

  const deduped = dedupeByUrl(collected);

  if (deduped.length > 0) {
    await replaceTrends(deduped);
  }

  return NextResponse.json({
    ingested: deduped.length,
    keptPrevious: deduped.length === 0,
    fallbackUsed: deduped.length === 0 ? SEED_TRENDS.length : 0,
    perSource,
    durationMs: Date.now() - startedAt,
  });
}

/** Parser RSS/Atom mínimo, sin dependencias. */
async function fetchFeed(url: string): Promise<FeedItem[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ContentCommandCenter/1.0 (+https://zernio.com)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const blocks = [
    ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  return blocks
    .map((block) => {
      const title = decodeEntities(pickTag(block, "title"));
      const link =
        pickTag(block, "link") ||
        extractHref(block) ||
        pickTag(block, "guid");
      const description =
        pickTag(block, "description") ||
        pickTag(block, "summary") ||
        pickTag(block, "content");
      const published =
        pickTag(block, "pubDate") ||
        pickTag(block, "published") ||
        pickTag(block, "updated") ||
        pickTag(block, "dc:date");

      return {
        title,
        summary: stripHtml(decodeEntities(description)).slice(0, 400),
        url: link.trim(),
        publishedAt: parseDate(published),
      };
    })
    .filter((item) => item.title.length > 12 && item.url.startsWith("http"));
}

function pickTag(block: string, tag: string): string {
  const match = block.match(
    new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "is"),
  );
  return match ? match[1].trim() : "";
}

function extractHref(block: string): string {
  const match = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return match ? match[1] : "";
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function parseDate(input: string): string {
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function hash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8);
}

function dedupeByUrl(items: TrendItem[]): TrendItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = `${item.url}|${item.title.toLowerCase().slice(0, 60)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.hookScore - a.hookScore);
}
