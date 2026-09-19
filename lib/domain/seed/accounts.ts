import type { ZernioAccount, ZernioPost } from "@/lib/zernio/types";

/**
 * Cuentas y publicaciones de demostración.
 *
 * Se usan cuando `DEMO_MODE=true` o no hay `ZERNIO_API_KEY`, para que el
 * Programador y el Calendario sean completamente navegables sin credenciales.
 */

export const DEMO_ACCOUNTS: ZernioAccount[] = [
  {
    _id: "acc_ig_main",
    platform: "instagram",
    username: "tenfoldmarc",
    displayName: "Marc · tenfoldmarc",
    profileId: "demo_profile",
    isActive: true,
    followerCount: 41_280,
  },
  {
    _id: "acc_tt_main",
    platform: "tiktok",
    username: "tenfoldmarc",
    displayName: "Marc · tenfoldmarc",
    profileId: "demo_profile",
    isActive: true,
    followerCount: 26_140,
  },
  {
    _id: "acc_yt_main",
    platform: "youtube",
    username: "@tenfoldmarc",
    displayName: "tenfoldmarc",
    profileId: "demo_profile",
    isActive: true,
    followerCount: 11_930,
  },
  {
    _id: "acc_th_main",
    platform: "threads",
    username: "tenfoldmarc",
    displayName: "Marc · tenfoldmarc",
    profileId: "demo_profile",
    isActive: true,
    followerCount: 8_410,
  },
  {
    _id: "acc_li_main",
    platform: "linkedin",
    username: "tenfoldmarc",
    displayName: "Marc · tenfoldmarc",
    profileId: "demo_profile",
    isActive: true,
    followerCount: 5_260,
  },
];

const DAY = 86_400_000;
const NOW = new Date();

function at(offsetDays: number, hour: number, minute = 0): string {
  const d = new Date(NOW.getTime() + offsetDays * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

interface ScheduledSeed {
  id: string;
  content: string;
  platform: ZernioPost["platforms"][number]["platform"];
  accountId: string;
  offsetDays: number;
  hour: number;
  status?: ZernioPost["status"];
}

const SCHEDULED: ScheduledSeed[] = [
  {
    id: "post_sched_01",
    content:
      "Este prompt acaba de destruir 3 horas de edición manual. Te dejo la plantilla en el comentario fijado.",
    platform: "instagram",
    accountId: "acc_ig_main",
    offsetDays: 0,
    hour: 18,
    status: "published",
  },
  {
    id: "post_sched_02",
    content: "Deja de publicar todos los días. Publica mejor.",
    platform: "tiktok",
    accountId: "acc_tt_main",
    offsetDays: 1,
    hour: 12,
  },
  {
    id: "post_sched_03",
    content:
      "5 cosas que me hubiera gustado saber antes de automatizar mi negocio.",
    platform: "instagram",
    accountId: "acc_ig_main",
    offsetDays: 2,
    hour: 18,
  },
  {
    id: "post_sched_04",
    content: "La plantilla exacta que uso para escribir hooks en 5 minutos.",
    platform: "youtube",
    accountId: "acc_yt_main",
    offsetDays: 3,
    hour: 11,
  },
  {
    id: "post_sched_05",
    content: "Si sigues midiendo solo los likes, para ya.",
    platform: "threads",
    accountId: "acc_th_main",
    offsetDays: 4,
    hour: 9,
  },
  {
    id: "post_sched_06",
    content: "El sistema paso a paso para planificar 30 días de contenido.",
    platform: "linkedin",
    accountId: "acc_li_main",
    offsetDays: 5,
    hour: 8,
  },
  {
    id: "post_sched_07",
    content: "Cómo pasé de 0 a 40.000 seguidores en 6 meses.",
    platform: "instagram",
    accountId: "acc_ig_main",
    offsetDays: 7,
    hour: 18,
  },
  {
    id: "post_sched_08",
    content: "El truco que usan los editores de Netflix para retener.",
    platform: "tiktok",
    accountId: "acc_tt_main",
    offsetDays: 8,
    hour: 12,
  },
  {
    id: "post_sched_09",
    content: "3 errores que te cuestan 10.000 seguidores al mes.",
    platform: "instagram",
    accountId: "acc_ig_main",
    offsetDays: 10,
    hour: 18,
  },
  {
    id: "post_sched_10",
    content: "¿Por qué el contenido feo sigue funcionando mejor?",
    platform: "youtube",
    accountId: "acc_yt_main",
    offsetDays: 12,
    hour: 11,
  },
  {
    id: "post_sched_11",
    content: "Nadie te dice la verdad sobre vivir de crear contenido.",
    platform: "instagram",
    accountId: "acc_ig_main",
    offsetDays: 14,
    hour: 18,
  },
  {
    id: "post_sched_12",
    content: "Esta función desaparece en 30 días. Esto es lo que tienes que hacer.",
    platform: "threads",
    accountId: "acc_th_main",
    offsetDays: 16,
    hour: 9,
  },
  {
    id: "post_sched_13",
    content: "Cómo lancé un producto digital en 9 días.",
    platform: "instagram",
    accountId: "acc_ig_main",
    offsetDays: 18,
    hour: 18,
  },
  {
    id: "post_sched_14",
    content: "7 señales de que tu contenido está bien y el algoritmo miente.",
    platform: "tiktok",
    accountId: "acc_tt_main",
    offsetDays: 21,
    hour: 12,
  },
  {
    id: "post_sched_15",
    content: "Deja de gastar en ads antes de leer esto.",
    platform: "linkedin",
    accountId: "acc_li_main",
    offsetDays: 24,
    hour: 8,
  },
  {
    id: "post_sched_16",
    content: "El prompt que uso para convertir una idea en 30 posts.",
    platform: "instagram",
    accountId: "acc_ig_main",
    offsetDays: 27,
    hour: 18,
  },
];

export const DEMO_SCHEDULED_POSTS: ZernioPost[] = SCHEDULED.map((seed) => ({
  _id: seed.id,
  content: seed.content,
  status: seed.status ?? "scheduled",
  scheduledFor: at(seed.offsetDays, seed.hour),
  publishedAt: seed.status === "published" ? at(seed.offsetDays, seed.hour) : null,
  timezone: "America/Mexico_City",
  platforms: [
    {
      platform: seed.platform,
      accountId: seed.accountId,
      status: seed.status === "published" ? "published" : "pending",
      platformPostUrl:
        seed.status === "published"
          ? `https://${seed.platform}.com/p/${seed.id}`
          : undefined,
    },
  ],
  createdAt: new Date(NOW.getTime() - 3 * DAY).toISOString(),
  updatedAt: new Date().toISOString(),
}));
