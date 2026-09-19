import type { TrendItem, TrendSource } from "@/lib/domain/types";

/**
 * Tendencias: 12 fuentes de noticias de IA.
 *
 * La ingesta (`/api/cron/trends`) lee cada fuente, normaliza el contenido y le
 * asigna un `hookScore` (0-100) según su potencial para convertirse en hook,
 * más un ángulo de contenido y una sugerencia de hook ya formateada.
 */

export const TREND_SOURCES: TrendSource[] = [
  {
    id: "openai-blog",
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    kind: "rss",
    category: "labs",
  },
  {
    id: "anthropic-news",
    name: "Anthropic News",
    url: "https://www.anthropic.com/news",
    kind: "scrape",
    category: "labs",
  },
  {
    id: "google-ai-blog",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    kind: "rss",
    category: "labs",
  },
  {
    id: "meta-ai",
    name: "Meta AI",
    url: "https://ai.meta.com/blog/rss/",
    kind: "rss",
    category: "labs",
  },
  {
    id: "huggingface-blog",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    kind: "rss",
    category: "research",
  },
  {
    id: "arxiv-ai",
    name: "arXiv cs.AI",
    url: "http://export.arxiv.org/rss/cs.AI",
    kind: "rss",
    category: "research",
  },
  {
    id: "mit-tech-review-ai",
    name: "MIT Technology Review · AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    kind: "rss",
    category: "media",
  },
  {
    id: "the-verge-ai",
    name: "The Verge · AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    kind: "rss",
    category: "media",
  },
  {
    id: "techcrunch-ai",
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    kind: "rss",
    category: "media",
  },
  {
    id: "hn-frontpage",
    name: "Hacker News (top)",
    url: "https://hnrss.org/frontpage?points=150",
    kind: "rss",
    category: "community",
  },
  {
    id: "reddit-localllama",
    name: "r/LocalLLaMA",
    url: "https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day",
    kind: "rss",
    category: "community",
  },
  {
    id: "bensbites",
    name: "Ben's Bites",
    url: "https://bensbites.beehiiv.com/feed",
    kind: "rss",
    category: "newsletter",
  },
];

interface TrendSeed {
  title: string;
  summary: string;
  url: string;
  sourceId: string;
  publishedAt: string;
  hookScore: number;
  angle: string;
  hookSuggestion: string;
  patternId: string;
  category: string;
}

const HOUR = 3_600_000;
const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * HOUR).toISOString();

const SEEDS: TrendSeed[] = [
  {
    title: "OpenAI lanza un modo de agentes que ejecuta tareas en el navegador",
    summary:
      "Un modo que combina navegación, ejecución de código y memoria persistente para completar flujos de trabajo de extremo a extremo.",
    url: "https://openai.com/blog/agent-mode",
    sourceId: "openai-blog",
    publishedAt: hoursAgo(4),
    hookScore: 96,
    angle:
      "Demostración práctica: automatiza una tarea real de tu negocio en tiempo real y muestra el antes/después.",
    hookSuggestion:
      "Esto acaba de destruir 6 horas de trabajo administrativo a la semana",
    patternId: "callout-destroy",
    category: "Agentes",
  },
  {
    title: "Anthropic publica una guía de evaluación para agentes en producción",
    summary:
      "Marco para medir fiabilidad de agentes con tareas reproducibles, tasas de alucinación y coste por tarea resuelta.",
    url: "https://anthropic.com/news/agent-evals",
    sourceId: "anthropic-news",
    publishedAt: hoursAgo(9),
    hookScore: 88,
    angle:
      "Cuenta el error que cometiste por no medir: un fallo que costó dinero o clientes.",
    hookSuggestion: "Nadie te dice cómo medir si tu agente de IA sirve de algo",
    patternId: "contrarian-nobody",
    category: "Evaluación",
  },
  {
    title: "Google integró generación de video en su suite de productividad",
    summary:
      "Generación de clips cortos a partir de un documento, con plantillas verticales pensadas para redes sociales.",
    url: "https://blog.google/technology/ai/video-en-workspace",
    sourceId: "google-ai-blog",
    publishedAt: hoursAgo(14),
    hookScore: 94,
    angle:
      "Reemplaza tu flujo de edición: muestra el antes (2 horas) contra el después (4 minutos).",
    hookSuggestion: "Deja de pagar un editor por clips verticales",
    patternId: "contrarian-stop",
    category: "Vídeo",
  },
  {
    title: "Meta abre modelos multimodales para dispositivos de gama media",
    summary:
      "Modelos optimizados que corren en teléfonos sin conexión, con foco en entrada de voz e imagen.",
    url: "https://ai.meta.com/blog/on-device-multimodal",
    sourceId: "meta-ai",
    publishedAt: hoursAgo(20),
    hookScore: 82,
    angle:
      "Contenido móvil: graba el resultado directamente desde el teléfono, sin postproducción.",
    hookSuggestion: "El truco que usan los desarrolladores móviles para no pagar GPU",
    patternId: "curiosity-secret",
    category: "Modelos",
  },
  {
    title: "Nuevo benchmark abierto compara 40 modelos en tareas de negocio",
    summary:
      "Resultados públicos por coste, latencia y precisión en tareas de atención al cliente, análisis y redacción.",
    url: "https://huggingface.co/blog/business-benchmark",
    sourceId: "huggingface-blog",
    publishedAt: hoursAgo(26),
    hookScore: 85,
    angle:
      "Dato duro y contraintuitivo: 'el modelo caro no gana en esta tarea'.",
    hookSuggestion: "5 cosas que me hubiera gustado saber antes de elegir modelo",
    patternId: "listicle-wish",
    category: "Benchmarks",
  },
  {
    title: "Investigación: la compresión de contexto reduce costes un 60%",
    summary:
      "Un método de resumen jerárquico mantiene la calidad de respuesta con una fracción de los tokens.",
    url: "https://arxiv.org/abs/2609.01234",
    sourceId: "arxiv-ai",
    publishedAt: hoursAgo(30),
    hookScore: 76,
    angle:
      "Traduce la investigación a dinero: cuánto ahorras al mes en tu caso concreto.",
    hookSuggestion: "Cómo reducir tu factura de IA un 60% sin perder calidad",
    patternId: "proof-without",
    category: "Investigación",
  },
  {
    title: "El coste real de la IA generativa en empresas, según 200 CTOs",
    summary:
      "Encuesta con desglose de gasto en inferencia, evaluación, datos y personal.",
    url: "https://technologyreview.com/ai-cost-survey",
    sourceId: "mit-tech-review-ai",
    publishedAt: hoursAgo(34),
    hookScore: 79,
    angle:
      "Rompe un mito: la partida más cara no es el modelo, es el dato.",
    hookSuggestion: "El error que te cuesta el 70% de tu presupuesto de IA",
    patternId: "listicle-errors",
    category: "Negocio",
  },
  {
    title: "Regulador europeo aclara obligaciones de transparencia para contenido sintético",
    summary:
      "Directrices sobre etiquetado de material generado y responsabilidad de la plataforma.",
    url: "https://theverge.com/eu-ai-transparency",
    sourceId: "the-verge-ai",
    publishedAt: hoursAgo(38),
    hookScore: 91,
    angle:
      "Urgencia regulatoria: qué cambia esta semana para quien publica con IA.",
    hookSuggestion: "Estas reglas desaparecen en 30 días. Esto es lo que tienes que hacer",
    patternId: "warning-last",
    category: "Regulación",
  },
  {
    title: "Startup recauda 80M para agentes de soporte al cliente",
    summary:
      "Ronda liderada por fondos de growth; la empresa reporta resolución automática del 71% de tickets.",
    url: "https://techcrunch.com/ai-support-agents-raise",
    sourceId: "techcrunch-ai",
    publishedAt: hoursAgo(42),
    hookScore: 74,
    angle:
      "Lectura de negocio: dónde está el dinero y qué puedes copiar como creador.",
    hookSuggestion: "Cómo pasaron de 0 a resolver el 71% de tickets sin humanos",
    patternId: "proof-before-after",
    category: "Industria",
  },
  {
    title: "Hilo: cómo un dev redujo su factura de inferencia de 900€ a 120€",
    summary:
      "Cinco cambios concretos: caché, enrutado por dificultad, batching y prompts más cortos.",
    url: "https://news.ycombinator.com/item?id=45000000",
    sourceId: "hn-frontpage",
    publishedAt: hoursAgo(46),
    hookScore: 89,
    angle:
      "Caso replicable paso a paso, con números verificables.",
    hookSuggestion: "Cómo pasé de 900€ a 120€ al mes en IA",
    patternId: "proof-before-after",
    category: "Ingeniería",
  },
  {
    title: "Modelo abierto de 8B supera a uno propietario en español",
    summary:
      "Evaluación comunitaria muestra mejor rendimiento en tareas hispanas con hardware de consumo.",
    url: "https://reddit.com/r/LocalLLaMA/8b-spanish",
    sourceId: "reddit-localllama",
    publishedAt: hoursAgo(50),
    hookScore: 83,
    angle:
      "Angulo local: 'en español funciona mejor' y por qué eso importa para LATAM.",
    hookSuggestion: "El modelo que usan los que no quieren pagar por IA",
    patternId: "curiosity-secret",
    category: "Open source",
  },
  {
    title: "Newsletter: 3 herramientas que cambiaron el flujo de trabajo esta semana",
    summary:
      "Selección curada con casos de uso de automatización editorial y edición asistida.",
    url: "https://bensbites.beehiiv.com/p/3-tools",
    sourceId: "bensbites",
    publishedAt: hoursAgo(54),
    hookScore: 71,
    angle:
      "Formato de lista rápida: tres herramientas, un caso de uso y un límite cada una.",
    hookSuggestion: "3 herramientas de IA que me hubiera gustado conocer antes",
    patternId: "listicle-wish",
    category: "Herramientas",
  },
];

const SOURCE_BY_ID = new Map(TREND_SOURCES.map((s) => [s.id, s]));

export function createSeedTrends(): TrendItem[] {
  return SEEDS.map((seed, index) => ({
    id: `trend_${String(index + 1).padStart(3, "0")}`,
    title: seed.title,
    summary: seed.summary,
    url: seed.url,
    sourceId: seed.sourceId,
    sourceName: SOURCE_BY_ID.get(seed.sourceId)?.name ?? seed.sourceId,
    publishedAt: seed.publishedAt,
    hookScore: seed.hookScore,
    angle: seed.angle,
    hookSuggestion: seed.hookSuggestion,
    patternId: seed.patternId,
    category: seed.category,
  })).sort((a, b) => b.hookScore - a.hookScore);
}

export const SEED_TRENDS: TrendItem[] = createSeedTrends();
