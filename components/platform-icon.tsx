import type { ComponentType } from "react";
import {
  AtSign,
  Facebook,
  Instagram,
  Linkedin,
  Music2,
  Twitter,
  Youtube,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Icono de plataforma. Zernio identifica las plataformas con valores como
 * `instagram` o `twitter`; aquí se mapean a iconos legibles con un color de
 * marca para que la UI se lea rápido.
 */

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  threads: AtSign,
};

const COLORS: Record<string, string> = {
  instagram: "text-[#e1306c]",
  tiktok: "text-foreground",
  youtube: "text-[#ff0033]",
  facebook: "text-[#1877f2]",
  linkedin: "text-[#0a66c2]",
  twitter: "text-foreground",
  threads: "text-foreground",
};

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "X",
  threads: "Threads",
  pinterest: "Pinterest",
  reddit: "Reddit",
  bluesky: "Bluesky",
  googlebusiness: "Google Business",
  telegram: "Telegram",
  snapchat: "Snapchat",
  whatsapp: "WhatsApp",
  discord: "Discord",
  slack: "Slack",
};

export function PlatformIcon({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  const Icon = ICONS[platform] ?? AtSign;
  return (
    <Icon
      className={cn("h-4 w-4", COLORS[platform] ?? "text-muted-foreground", className)}
      aria-hidden
    />
  );
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}
