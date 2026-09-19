import type { CompetitorAccount, CompetitorReel } from "@/lib/domain/types";

/**
 * Seguimiento de competidores: 8 cuentas vigiladas.
 *
 * El job semanal (`/api/cron/competitors`, domingos 06:00) recorre estas
 * cuentas, toma los 5 Reels con mejor rendimiento de la semana, transcribe el
 * audio y extrae el hook + el texto en pantalla. En modo demo se sirve esta
 * captura ya procesada de la semana anterior.
 */

const DAY = 86_400_000;
const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();

export const SEED_COMPETITORS: CompetitorAccount[] = [
  {
    id: "cmp_001",
    platform: "instagram",
    username: "@growthlab.io",
    displayName: "Growth Lab",
    followerCount: 842_000,
    niche: "marketing",
    isActive: true,
    addedAt: daysAgo(210),
  },
  {
    id: "cmp_002",
    platform: "instagram",
    username: "@aiwithsarah",
    displayName: "Sarah · IA aplicada",
    followerCount: 617_000,
    niche: "ia_automatizacion",
    isActive: true,
    addedAt: daysAgo(180),
  },
  {
    id: "cmp_003",
    platform: "tiktok",
    username: "@thecontentdude",
    displayName: "The Content Dude",
    followerCount: 1_450_000,
    niche: "marketing",
    isActive: true,
    addedAt: daysAgo(165),
  },
  {
    id: "cmp_004",
    platform: "instagram",
    username: "@martinbuilds",
    displayName: "Martín · SaaS",
    followerCount: 388_000,
    niche: "tecnologia",
    isActive: true,
    addedAt: daysAgo(140),
  },
  {
    id: "cmp_005",
    platform: "tiktok",
    username: "@laura.automatiza",
    displayName: "Laura Automatiza",
    followerCount: 534_000,
    niche: "ia_automatizacion",
    isActive: true,
    addedAt: daysAgo(120),
  },
  {
    id: "cmp_006",
    platform: "youtube",
    username: "@CreatorEconomy",
    displayName: "Creator Economy Weekly",
    followerCount: 296_000,
    niche: "negocios",
    isActive: true,
    addedAt: daysAgo(98),
  },
  {
    id: "cmp_007",
    platform: "instagram",
    username: "@hookmachine",
    displayName: "Hook Machine",
    followerCount: 771_000,
    niche: "marketing",
    isActive: true,
    addedAt: daysAgo(75),
  },
  {
    id: "cmp_008",
    platform: "threads",
    username: "@danielfinance",
    displayName: "Daniel · Dinero digital",
    followerCount: 163_000,
    niche: "finanzas",
    isActive: true,
    addedAt: daysAgo(52),
  },
];

interface ReelSeed {
  accountId: string;
  platform: string;
  slug: string;
  views: number;
  likes: number;
  comments: number;
  daysAgo: number;
  hookText: string;
  onScreenText: string;
  transcript: string;
}

const REELS: ReelSeed[] = [
  {
    accountId: "cmp_001",
    platform: "instagram",
    slug: "CL001",
    views: 2_140_000,
    likes: 168_000,
    comments: 4_120,
    daysAgo: 5,
    hookText: "Tu embudo está roto antes de que el cliente te vea",
    onScreenText: "EL 90% ROMPE EL EMBUDO AQUÍ",
    transcript:
      "Tu embudo está roto antes de que el cliente te vea. Y no es por el anuncio: es por la primera línea de tu perfil. Si tu bio no dice a quién ayudas ni en cuánto tiempo, el tráfico que pagas se muere en la puerta...",
  },
  {
    accountId: "cmp_001",
    platform: "instagram",
    slug: "CL002",
    views: 1_380_000,
    likes: 104_000,
    comments: 2_310,
    daysAgo: 4,
    hookText: "3 métricas que deberías borrar de tu dashboard hoy",
    onScreenText: "BORRA ESTAS 3 MÉTRICAS",
    transcript:
      "3 métricas que deberías borrar de tu dashboard hoy. Alcance, impresiones y seguidores nuevos no pagan facturas. Lo que paga facturas es tiempo de visualización por visita al perfil...",
  },
  {
    accountId: "cmp_001",
    platform: "instagram",
    slug: "CL003",
    views: 990_000,
    likes: 78_400,
    comments: 1_640,
    daysAgo: 6,
    hookText: "Cómo pasé de 400 a 12.000 suscriptores con una sola página",
    onScreenText: "400 → 12.000 SUSCRIPTORES",
    transcript:
      "Cómo pasé de 400 a 12.000 suscriptores con una sola página. No fue el diseño, fue el orden de los bloques. Te enseño el orden exacto en 30 segundos...",
  },
  {
    accountId: "cmp_001",
    platform: "instagram",
    slug: "CL004",
    views: 640_000,
    likes: 51_200,
    comments: 980,
    daysAgo: 2,
    hookText: "Deja de usar testimonios en texto",
    onScreenText: "DEJA DE USAR TESTIMONIOS EN TEXTO",
    transcript:
      "Deja de usar testimonios en texto. Un screenshot con nombre y foto convierte hasta 3 veces más que cinco párrafos de elogios. Te muestro cómo pedirlo sin incomodar al cliente...",
  },
  {
    accountId: "cmp_001",
    platform: "instagram",
    slug: "CL005",
    views: 512_000,
    likes: 41_800,
    comments: 730,
    daysAgo: 3,
    hookText: "Este anuncio se apagó solo y facturó 8.000€",
    onScreenText: "ANUNCIO APAGADO · 8.000€",
    transcript:
      "Este anuncio se apagó solo y facturó 8.000€. Sí, apagado. Porque el mejor CPM no se compra, se hereda del contenido orgánico que ya funcionó...",
  },
  {
    accountId: "cmp_002",
    platform: "instagram",
    slug: "CL006",
    views: 1_820_000,
    likes: 152_000,
    comments: 5_240,
    daysAgo: 3,
    hookText: "Esta IA acaba de destruir el trabajo de 4 personas",
    onScreenText: "1 IA = 4 PUESTOS",
    transcript:
      "Esta IA acaba de destruir el trabajo de 4 personas en mi equipo. Editor, diseñador, community manager y guionista. Y no, no despedí a nadie: los moví a estrategia...",
  },
  {
    accountId: "cmp_002",
    platform: "instagram",
    slug: "CL007",
    views: 1_260_000,
    likes: 98_000,
    comments: 3_180,
    daysAgo: 5,
    hookText: "5 prompts que reemplazan un asistente de 2.000€ al mes",
    onScreenText: "5 PROMPTS · AHORRA 2.000€",
    transcript:
      "5 prompts que reemplazan un asistente de 2.000€ al mes. El primero escribe tus emails difíciles mejor que tú, y lo tengo copiado en el comentario fijado...",
  },
  {
    accountId: "cmp_002",
    platform: "instagram",
    slug: "CL008",
    views: 870_000,
    likes: 69_300,
    comments: 2_010,
    daysAgo: 6,
    hookText: "Si todavía escribes tus captions a mano, para ya",
    onScreenText: "PARA YA · CAPTIONS A MANO",
    transcript:
      "Si todavía escribes tus captions a mano, para ya. No porque sea difícil, sino porque estás gastando tu mejor energía en la parte que menos importa del proceso...",
  },
  {
    accountId: "cmp_002",
    platform: "instagram",
    slug: "CL009",
    views: 604_000,
    likes: 48_100,
    comments: 1_220,
    daysAgo: 1,
    hookText: "El truco que usan los equipos de producto para no alucinar con la IA",
    onScreenText: "CERO ALUCINACIONES",
    transcript:
      "El truco que usan los equipos de producto para no alucinar con la IA: le dan fuentes, no memoria. Te explico la diferencia en 20 segundos...",
  },
  {
    accountId: "cmp_002",
    platform: "instagram",
    slug: "CL010",
    views: 455_000,
    likes: 36_700,
    comments: 890,
    daysAgo: 4,
    hookText: "Cómo lancé un curso de IA sin grabar una sola clase",
    onScreenText: "CURSO SIN GRABAR CLASES",
    transcript:
      "Cómo lancé un curso de IA sin grabar una sola clase. Usé tres herramientas y un documento. El resultado: 41.000€ en preventa...",
  },
  {
    accountId: "cmp_003",
    platform: "tiktok",
    slug: "CL011",
    views: 3_450_000,
    likes: 402_000,
    comments: 8_760,
    daysAgo: 2,
    hookText: "Deja de intentar ser original en internet",
    onScreenText: "DEJA DE SER ORIGINAL",
    transcript:
      "Deja de intentar ser original en internet. Nadie inventa nada. Lo único que cambia es el envoltorio. Toma un formato que ya funciona y cámbiale el contexto...",
  },
  {
    accountId: "cmp_003",
    platform: "tiktok",
    slug: "CL012",
    views: 2_610_000,
    likes: 298_000,
    comments: 6_140,
    daysAgo: 4,
    hookText: "7 cosas que me hubiera gustado saber antes de publicar a diario",
    onScreenText: "7 COSAS · PUBLICAR A DIARIO",
    transcript:
      "7 cosas que me hubiera gustado saber antes de publicar a diario durante un año. La número 4 me costó 30.000 seguidores...",
  },
  {
    accountId: "cmp_003",
    platform: "tiktok",
    slug: "CL013",
    views: 1_530_000,
    likes: 187_000,
    comments: 3_920,
    daysAgo: 6,
    hookText: "Este guion de 15 segundos me dio 4 millones de vistas",
    onScreenText: "4M VISTAS · 15 SEGUNDOS",
    transcript:
      "Este guion de 15 segundos me dio 4 millones de vistas. Tiene 6 frases y ninguna sobra. Te lo leo y te explico por qué cada una está ahí...",
  },
  {
    accountId: "cmp_003",
    platform: "tiktok",
    slug: "CL014",
    views: 1_120_000,
    likes: 134_000,
    comments: 2_780,
    daysAgo: 3,
    hookText: "Cómo gané 60.000 seguidores con contenido que da vergüenza",
    onScreenText: "CONTENIDO QUE DA VERGÜENZA",
    transcript:
      "Cómo gané 60.000 seguidores con contenido que da vergüenza. Grabado con el móvil en el baño. La producción no es el problema...",
  },
  {
    accountId: "cmp_003",
    platform: "tiktok",
    slug: "CL015",
    views: 880_000,
    likes: 102_000,
    comments: 1_940,
    daysAgo: 5,
    hookText: "Si tu video no retiene a los 3 segundos, no es culpa del algoritmo",
    onScreenText: "NO ES CULPA DEL ALGORITMO",
    transcript:
      "Si tu video no retiene a los 3 segundos, no es culpa del algoritmo. Es que tu primera frase es una introducción y nadie pidió una introducción...",
  },
  {
    accountId: "cmp_004",
    platform: "instagram",
    slug: "CL016",
    views: 720_000,
    likes: 61_400,
    comments: 2_210,
    daysAgo: 4,
    hookText: "Lancé un SaaS solo y facturé 3.000€ el primer mes",
    onScreenText: "SAAS SOLO · 3.000€ MES 1",
    transcript:
      "Lancé un SaaS solo y facturé 3.000€ el primer mes. No usé React ni TypeScript al principio. Usé la herramienta más aburrida del mercado y la conecté a Stripe en una tarde...",
  },
  {
    accountId: "cmp_004",
    platform: "instagram",
    slug: "CL017",
    views: 512_000,
    likes: 43_900,
    comments: 1_480,
    daysAgo: 2,
    hookText: "3 decisiones de arquitectura que me ahorraron 6 meses",
    onScreenText: "3 DECISIONES · 6 MESES",
    transcript:
      "3 decisiones de arquitectura que me ahorraron 6 meses de trabajo. La segunda es contraintuitiva: no optimices hasta que duela...",
  },
  {
    accountId: "cmp_004",
    platform: "instagram",
    slug: "CL018",
    views: 388_000,
    likes: 32_100,
    comments: 970,
    daysAgo: 6,
    hookText: "Nadie te dice la verdad sobre el código con IA",
    onScreenText: "LA VERDAD DEL CÓDIGO CON IA",
    transcript:
      "Nadie te dice la verdad sobre el código con IA: escribe rápido y revisa lento. La deuda técnica no desaparece, cambia de sitio...",
  },
  {
    accountId: "cmp_004",
    platform: "instagram",
    slug: "CL019",
    views: 296_000,
    likes: 25_800,
    comments: 620,
    daysAgo: 3,
    hookText: "Cómo consigo 10 clientes al mes sin vender",
    onScreenText: "10 CLIENTES SIN VENDER",
    transcript:
      "Cómo consigo 10 clientes al mes sin vender. Publico el proceso, no el resultado. La gente compra el cómo, no el qué...",
  },
  {
    accountId: "cmp_004",
    platform: "instagram",
    slug: "CL020",
    views: 214_000,
    likes: 18_400,
    comments: 510,
    daysAgo: 5,
    hookText: "Esta herramienta acaba de reemplazar mi gestor de tareas",
    onScreenText: "ADIÓS GESTOR DE TAREAS",
    transcript:
      "Esta herramienta acaba de reemplazar mi gestor de tareas y mi calendario a la vez. Y es gratis. Te enseño cómo la configuro...",
  },
  {
    accountId: "cmp_005",
    platform: "tiktok",
    slug: "CL021",
    views: 1_640_000,
    likes: 176_000,
    comments: 4_480,
    daysAgo: 3,
    hookText: "Deja de hacer todo manualmente, esto se automatiza en 10 minutos",
    onScreenText: "AUTOMATIZA EN 10 MINUTOS",
    transcript:
      "Deja de hacer todo manualmente, esto se automatiza en 10 minutos. Yo tardaba 4 horas cada lunes en el reporte semanal. Ahora se envía solo a las 7am...",
  },
  {
    accountId: "cmp_005",
    platform: "tiktok",
    slug: "CL022",
    views: 1_090_000,
    likes: 118_000,
    comments: 2_960,
    daysAgo: 5,
    hookText: "5 automatizaciones que gana cualquier negocio de una persona",
    onScreenText: "5 AUTOMATIZACIONES · NEGOCIO SOLO",
    transcript:
      "5 automatizaciones que gana cualquier negocio de una persona. La primera es responder las mismas 3 preguntas que te hacen por DM cada día...",
  },
  {
    accountId: "cmp_005",
    platform: "tiktok",
    slug: "CL023",
    views: 734_000,
    likes: 79_800,
    comments: 1_770,
    daysAgo: 2,
    hookText: "Cómo pasé de 12 a 4 horas de trabajo al día",
    onScreenText: "12H → 4H AL DÍA",
    transcript:
      "Cómo pasé de 12 a 4 horas de trabajo al día sin contratar a nadie. No es magia, es documentar antes de delegar...",
  },
  {
    accountId: "cmp_005",
    platform: "tiktok",
    slug: "CL024",
    views: 486_000,
    likes: 51_200,
    comments: 1_140,
    daysAgo: 6,
    hookText: "Si sigues copiando y pegando entre apps, para ya",
    onScreenText: "PARA YA · COPIAR Y PEGAR",
    transcript:
      "Si sigues copiando y pegando entre apps, para ya. Cada copia es un minuto que no vuelve y un error esperando a pasar...",
  },
  {
    accountId: "cmp_005",
    platform: "tiktok",
    slug: "CL025",
    views: 342_000,
    likes: 35_600,
    comments: 780,
    daysAgo: 4,
    hookText: "El truco que usan las agencias para entregar el doble",
    onScreenText: "EL DOBLE ENTREGADO",
    transcript:
      "El truco que usan las agencias para entregar el doble: plantillas, no personas. Un sistema de plantillas convierte 3 horas en 20 minutos...",
  },
  {
    accountId: "cmp_006",
    platform: "youtube",
    slug: "CL026",
    views: 420_000,
    likes: 38_100,
    comments: 1_620,
    daysAgo: 4,
    hookText: "El modelo de negocio del creador está cambiando y nadie lo nota",
    onScreenText: "EL MODELO ESTÁ CAMBIANDO",
    transcript:
      "El modelo de negocio del creador está cambiando y nadie lo nota. Las marcas ya no pagan por alcance, pagan por conversión atribuida...",
  },
  {
    accountId: "cmp_006",
    platform: "youtube",
    slug: "CL027",
    views: 318_000,
    likes: 27_400,
    comments: 1_080,
    daysAgo: 6,
    hookText: "Cómo vendí mi canal por 6 cifras",
    onScreenText: "VENTA DE 6 CIFRAS",
    transcript:
      "Cómo vendí mi canal por 6 cifras. El comprador no pagó por suscriptores: pagó por 4 años de datos de audiencia...",
  },
  {
    accountId: "cmp_006",
    platform: "youtube",
    slug: "CL028",
    views: 236_000,
    likes: 21_700,
    comments: 740,
    daysAgo: 2,
    hookText: "3 formas de diversificar ingresos sin quemar tu audiencia",
    onScreenText: "3 INGRESOS · SIN QUEMAR",
    transcript:
      "3 formas de diversificar ingresos sin quemar tu audiencia. La tercera es la más rentable y la que menos gente hace...",
  },
  {
    accountId: "cmp_006",
    platform: "youtube",
    slug: "CL029",
    views: 187_000,
    likes: 16_900,
    comments: 520,
    daysAgo: 5,
    hookText: "Deja de medir tu éxito en seguidores",
    onScreenText: "DEJA DE MEDIR SEGUIDORES",
    transcript:
      "Deja de medir tu éxito en seguidores. Un canal de 8.000 personas correctas vale más que uno de 300.000 curiosos...",
  },
  {
    accountId: "cmp_006",
    platform: "youtube",
    slug: "CL030",
    views: 141_000,
    likes: 12_800,
    comments: 390,
    daysAgo: 3,
    hookText: "El error que comete el 95% al firmar con una marca",
    onScreenText: "95% FIRMA MAL",
    transcript:
      "El error que comete el 95% al firmar con una marca: cobrar por publicación y no por uso. La licencia vale más que el post...",
  },
  {
    accountId: "cmp_007",
    platform: "instagram",
    slug: "CL031",
    views: 2_980_000,
    likes: 264_000,
    comments: 7_120,
    daysAgo: 2,
    hookText: "Este hook acaba de destruir mi forma de escribir",
    onScreenText: "EL HOOK QUE ROMPE TODO",
    transcript:
      "Este hook acaba de destruir mi forma de escribir. Se llama hook de contradicción y consiste en afirmar lo contrario de lo que tu audiencia cree...",
  },
  {
    accountId: "cmp_007",
    platform: "instagram",
    slug: "CL032",
    views: 2_050_000,
    likes: 189_000,
    comments: 5_310,
    daysAgo: 4,
    hookText: "Nadie te dice que los hooks se entrenan",
    onScreenText: "LOS HOOKS SE ENTRENAN",
    transcript:
      "Nadie te dice que los hooks se entrenan. Escribí 300 en 30 días. Los primeros 100 eran basura. El 200 ya funcionaba...",
  },
  {
    accountId: "cmp_007",
    platform: "instagram",
    slug: "CL033",
    views: 1_310_000,
    likes: 118_000,
    comments: 3_240,
    daysAgo: 6,
    hookText: "12 plantillas de hook que uso cada semana",
    onScreenText: "12 PLANTILLAS DE HOOK",
    transcript:
      "12 plantillas de hook que uso cada semana. Te doy las tres mejores gratis en el comentario fijado. Empieza por la de 'deja de'...",
  },
  {
    accountId: "cmp_007",
    platform: "instagram",
    slug: "CL034",
    views: 940_000,
    likes: 84_200,
    comments: 2_180,
    daysAgo: 3,
    hookText: "Cómo escribo 30 hooks en una hora",
    onScreenText: "30 HOOKS EN 1 HORA",
    transcript:
      "Cómo escribo 30 hooks en una hora. No los escribo: los vario. Un ángulo, diez formatos...",
  },
  {
    accountId: "cmp_007",
    platform: "instagram",
    slug: "CL035",
    views: 612_000,
    likes: 55_900,
    comments: 1_340,
    daysAgo: 5,
    hookText: "Si tu hook explica el video, para ya",
    onScreenText: "PARA YA · HOOK EXPLICATIVO",
    transcript:
      "Si tu hook explica el video, para ya. El hook no resume, promete. Resumir es trabajo del cuerpo...",
  },
  {
    accountId: "cmp_008",
    platform: "threads",
    slug: "CL036",
    views: 380_000,
    likes: 29_400,
    comments: 1_820,
    daysAgo: 3,
    hookText: "Deja de invertir antes de tener esto",
    onScreenText: "DEJA DE INVERTIR YA",
    transcript:
      "Deja de invertir antes de tener esto: tres meses de gastos en efectivo. Sin esa base, cualquier caída te obliga a vender en el peor momento...",
  },
  {
    accountId: "cmp_008",
    platform: "threads",
    slug: "CL037",
    views: 264_000,
    likes: 21_100,
    comments: 1_240,
    daysAgo: 5,
    hookText: "4 cosas que me hubiera gustado saber antes de mi primer crédito",
    onScreenText: "4 COSAS · PRIMER CRÉDITO",
    transcript:
      "4 cosas que me hubiera gustado saber antes de mi primer crédito. La tasa no es el costo real: el plazo lo es...",
  },
  {
    accountId: "cmp_008",
    platform: "threads",
    slug: "CL038",
    views: 178_000,
    likes: 14_600,
    comments: 690,
    daysAgo: 2,
    hookText: "Cómo pasé de 0 a 100.000€ invertidos sin ingresos altos",
    onScreenText: "0 → 100.000€",
    transcript:
      "Cómo pasé de 0 a 100.000€ invertidos sin ingresos altos. Automatizando el ahorro el mismo día que cobro...",
  },
  {
    accountId: "cmp_008",
    platform: "threads",
    slug: "CL039",
    views: 132_000,
    likes: 11_200,
    comments: 420,
    daysAgo: 6,
    hookText: "El error que te cuesta 20 años de jubilación",
    onScreenText: "20 AÑOS PERDIDOS",
    transcript:
      "El error que te cuesta 20 años de jubilación: empezar a los 40. Cada década que esperas duplica lo que tienes que aportar...",
  },
  {
    accountId: "cmp_008",
    platform: "threads",
    slug: "CL040",
    views: 96_000,
    likes: 8_100,
    comments: 310,
    daysAgo: 4,
    hookText: "Nadie te dice la verdad sobre los fondos indexados",
    onScreenText: "LA VERDAD DE LOS INDEXADOS",
    transcript:
      "Nadie te dice la verdad sobre los fondos indexados: son aburridos, y eso es exactamente el punto...",
  },
];

function isoWeek(date: Date): string {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Construye los reels de la semana anterior, ordenados por views. */
export function createSeedReels(): CompetitorReel[] {
  const week = isoWeek(new Date(NOW - 7 * DAY));

  const byAccount = new Map<string, ReelSeed[]>();
  for (const reel of REELS) {
    const list = byAccount.get(reel.accountId) ?? [];
    list.push(reel);
    byAccount.set(reel.accountId, list);
  }

  const reels: CompetitorReel[] = [];
  for (const [, list] of byAccount) {
    list
      .slice()
      .sort((a, b) => b.views - a.views)
      .forEach((reel, index) => {
        reels.push({
          id: `reel_${reel.slug.toLowerCase()}`,
          accountId: reel.accountId,
          platform: reel.platform,
          url: buildReelUrl(reel),
          views: reel.views,
          likes: reel.likes,
          comments: reel.comments,
          postedAt: daysAgo(reel.daysAgo),
          hookText: reel.hookText,
          onScreenText: reel.onScreenText,
          transcript: reel.transcript,
          rank: index + 1,
          week,
          ingestedAt: daysAgo(1),
          savedToHooks: false,
        });
      });
  }

  return reels.sort((a, b) => b.views - a.views);
}

function buildReelUrl(reel: ReelSeed): string {
  switch (reel.platform) {
    case "instagram":
      return `https://instagram.com/reel/${reel.slug}xyz/`;
    case "tiktok":
      return `https://tiktok.com/@competitor/video/73000000000${reel.slug}`;
    case "youtube":
      return `https://youtube.com/shorts/${reel.slug}xyz`;
    case "threads":
      return `https://threads.net/@competitor/post/${reel.slug}`;
    default:
      return `https://example.com/${reel.slug}`;
  }
}

export const SEED_REELS: CompetitorReel[] = createSeedReels();

/** Copia mutable de las cuentas vigiladas, para el store en memoria. */
export function createSeedCompetitors(): CompetitorAccount[] {
  return SEED_COMPETITORS.map((competitor) => ({ ...competitor }));
}
