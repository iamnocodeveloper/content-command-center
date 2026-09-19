import {
  BarChart3,
  CalendarDays,
  Film,
  Flame,
  Lightbulb,
  Plug,
  Radar,
  Send,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: typeof BarChart3;
}

/** Las seis secciones del dashboard, en el orden pedido. */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/hooks",
    label: "Biblioteca de Hooks",
    description: "Hooks virales transcritos y organizados en plantillas",
    icon: Lightbulb,
  },
  {
    href: "/analytics",
    label: "Analíticas",
    description: "Vistas, guardados, seguidores y contenido destacado",
    icon: BarChart3,
  },
  {
    href: "/competitors",
    label: "Seguimiento de Competidores",
    description: "Los mejores Reels de las cuentas que sigues, cada semana",
    icon: Radar,
  },
  {
    href: "/scheduler",
    label: "Programador",
    description: "Publicación multiplataforma con un clic y captions automáticas",
    icon: Send,
  },
  {
    href: "/calendar",
    label: "Calendario de Contenido",
    description: "Vista mensual completada automáticamente por scripts",
    icon: CalendarDays,
  },
  {
    href: "/trends",
    label: "Tendencias",
    description: "Noticias de IA de 12 fuentes, clasificadas por potencial de hook",
    icon: Flame,
  },
];

/** Secciones de apoyo referenciadas por las seis principales. */
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  {
    href: "/script",
    label: "Estudio de guiones",
    description: "Compositor donde aterrizan los hooks que eliges",
    icon: Film,
  },
  {
    href: "/settings",
    label: "Ajustes y conexiones",
    description: "Conecta Zernio y el modelo de IA",
    icon: Plug,
  },
];
