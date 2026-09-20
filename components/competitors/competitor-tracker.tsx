"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookmarkPlus,
  Check,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  Radar,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PlatformIcon, platformLabel } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  NICHE_LABELS,
  NICHES,
  type CompetitorAccount,
  type CompetitorReel,
  type Niche,
} from "@/lib/domain/types";
import { formatCompact, formatNumber } from "@/lib/utils";

export interface ReelWithAccount extends CompetitorReel {
  account?: CompetitorAccount;
}

/** Plataformas que tiene sentido vigilar en este panel. */
const TRACKABLE_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "linkedin",
  "twitter",
  "threads",
] as const;

export function CompetitorTracker({
  competitors,
  reels,
  weeks,
  demo,
}: {
  competitors: CompetitorAccount[];
  reels: ReelWithAccount[];
  weeks: string[];
  demo: boolean;
}) {
  const router = useRouter();
  const [week, setWeek] = React.useState(weeks[0] ?? "all");
  const [accountId, setAccountId] = React.useState("all");
  const [platform, setPlatform] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [saved, setSaved] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ReelWithAccount | null>(null);

  // Gestión de las cuentas vigiladas (sólo en producción: en demo la lista es
  // la muestra fija y el formulario ni se muestra).
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [newUsername, setNewUsername] = React.useState("");
  const [newPlatform, setNewPlatform] = React.useState("instagram");
  const [newNiche, setNewNiche] = React.useState<Niche>("marketing");
  const [newFollowers, setNewFollowers] = React.useState("");

  const platforms = React.useMemo(
    () => [...new Set(reels.map((r) => r.platform))].sort(),
    [reels],
  );

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return reels
      .filter((reel) => {
        if (week !== "all" && reel.week !== week) return false;
        if (accountId !== "all" && reel.accountId !== accountId) return false;
        if (platform !== "all" && reel.platform !== platform) return false;
        if (term) {
          const haystack = `${reel.hookText} ${reel.onScreenText} ${reel.transcript} ${reel.account?.username ?? ""}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => b.views - a.views);
  }, [reels, week, accountId, platform, search]);

  const totalViews = filtered.reduce((acc, r) => acc + r.views, 0);

  async function saveToHooks(reel: ReelWithAccount) {
    setSaving(reel.id);
    try {
      const response = await fetch(`/api/competitors/reels/${reel.id}/save`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("No se pudo guardar");
      setSaved((prev) => ({ ...prev, [reel.id]: true }));
      toast.success("Guardado en el Banco de Hooks", {
        description: "Ya está disponible en la Biblioteca de Hooks.",
      });
    } catch {
      toast.error("No se pudo guardar el hook");
    } finally {
      setSaving(null);
    }
  }

  async function addAccount(event: React.FormEvent) {
    event.preventDefault();

    const username = newUsername.trim();
    if (username.length < 2) {
      toast.error("Escribe un usuario válido");
      return;
    }

    setAdding(true);
    try {
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          platform: newPlatform,
          niche: newNiche,
          ...(newFollowers.trim()
            ? { followerCount: Number(newFollowers) }
            : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        competitor?: CompetitorAccount;
        persisted?: boolean;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo añadir la cuenta");
      }

      setNewUsername("");
      setNewFollowers("");
      toast.success(
        `${payload?.competitor?.username ?? username} está en seguimiento`,
        {
          description:
            payload?.persisted === false
              ? "No se pudo escribir en disco: la cuenta queda sólo en memoria."
              : "Se analizará en la próxima ingesta de los domingos.",
        },
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error inesperado",
      );
    } finally {
      setAdding(false);
    }
  }

  async function removeAccount(account: CompetitorAccount) {
    setRemoving(account.id);
    try {
      const response = await fetch(`/api/competitors/${account.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudo dejar de seguir la cuenta");
      }
      toast.success(`${account.username} fuera del seguimiento`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error inesperado",
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Radar} label="Cuentas vigiladas" value={formatNumber(competitors.length)} />
        <Tile icon={Users} label="Reels analizados" value={formatNumber(filtered.length)} />
        <Tile icon={BookmarkPlus} label="Views agregadas" value={formatCompact(totalViews)} />
        <Tile
          icon={Check}
          label="Semana"
          value={week === "all" ? "Todas" : week}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" />
            Cuentas que sigues
          </CardTitle>
          {demo ? (
            <Badge variant="warning">Muestra de demostración</Badge>
          ) : (
            <Badge variant="muted">
              {formatNumber(competitors.length)} en seguimiento
            </Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {demo
              ? "En modo demo esta lista es una muestra fija de 8 cuentas y no se edita. Conecta Zernio en Ajustes para pasar a datos en vivo y elegir tú las cuentas."
              : "Añade las cuentas que quieres vigilar. Cada domingo a las 06:00 se analizan sus 5 Reels con mejor rendimiento."}
          </p>

          {competitors.length === 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Todavía no sigues ninguna cuenta. Añade la primera con el
                formulario de abajo.
              </span>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {competitors.map((account) => (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center gap-3 p-3"
                >
                  <PlatformIcon platform={account.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {account.username}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.displayName} ·{" "}
                      {formatCompact(account.followerCount)} seguidores ·{" "}
                      {NICHE_LABELS[account.niche]} · {platformLabel(account.platform)}
                    </p>
                  </div>
                  {demo ? null : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Dejar de seguir a ${account.username}`}
                      disabled={removing === account.id}
                      onClick={() => removeAccount(account)}
                    >
                      {removing === account.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {demo ? null : (
            <form onSubmit={addAccount} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="competitor-username" className="text-xs text-muted-foreground">
                  Usuario
                </Label>
                <Input
                  id="competitor-username"
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  placeholder="@creador"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Plataforma</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKABLE_PLATFORMS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {platformLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nicho</Label>
                <Select
                  value={newNiche}
                  onValueChange={(value) => setNewNiche(value as Niche)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NICHES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {NICHE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="competitor-followers" className="text-xs text-muted-foreground">
                  Seguidores (opcional)
                </Label>
                <Input
                  id="competitor-followers"
                  value={newFollowers}
                  onChange={(event) => setNewFollowers(event.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" size="sm" disabled={adding}>
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Añadir al seguimiento
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            Ingesta semanal · domingos 06:00
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada domingo se leen los 5 Reels con mejor rendimiento de cada cuenta,
            se transcribe el audio y se extraen el hook hablado y el texto en
            pantalla.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Semana</Label>
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las semanas</SelectItem>
                {weeks.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Creador</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {competitors.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {platforms.map((item) => (
                  <SelectItem key={item} value={item}>
                    {platformLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Hook, texto o creador…"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Radar}
          title={
            competitors.length === 0 && !demo
              ? "Ninguna cuenta en seguimiento"
              : "Sin reels para estos filtros"
          }
          description={
            competitors.length === 0 && !demo
              ? "Añade arriba las cuentas que quieres vigilar. La ingesta de los domingos a las 06:00 analizará sus 5 mejores Reels."
              : "Cambia la semana o el creador. Los resultados se recopilan automáticamente cada domingo."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((reel, index) => {
            const isSaved = saved[reel.id] || reel.savedToHooks;
            return (
              <Card key={reel.id} className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex items-center gap-3 lg:w-56 lg:shrink-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {reel.account?.username ?? "@desconocido"}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <PlatformIcon platform={reel.platform} className="h-3 w-3" />
                        {formatCompact(reel.account?.followerCount ?? 0)} seguidores
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-medium leading-snug">
                      «{reel.hookText}»
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium uppercase tracking-wide">
                        En pantalla ·{" "}
                      </span>
                      {reel.onScreenText}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {formatNumber(reel.views)} views
                      </span>
                      <span>{formatCompact(reel.likes)} likes</span>
                      <span>{formatCompact(reel.comments)} comentarios</span>
                      <button
                        onClick={() => setSelected(reel)}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Ver transcripción completa
                      </button>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a
                        href={reel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Abrir reel original"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant={isSaved ? "outline" : "default"}
                      disabled={isSaved || saving === reel.id}
                      onClick={() => saveToHooks(reel)}
                    >
                      {isSaved ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Guardado
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="h-3.5 w-3.5" />
                          {saving === reel.id ? "Guardando…" : "Guardar en el Banco de Hooks"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8">
                  {selected.account?.username} ·{" "}
                  {formatNumber(selected.views)} views
                </SheetTitle>
                <SheetDescription>
                  {platformLabel(selected.platform)} · {selected.week} · ranking #
                  {selected.rank} de la cuenta
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-6 pb-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {formatCompact(selected.likes)} likes
                  </Badge>
                  <Badge variant="outline">
                    {formatCompact(selected.comments)} comentarios
                  </Badge>
                  <Badge variant="outline">
                    {formatNumber(selected.account?.followerCount ?? 0)} seguidores
                  </Badge>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Hook extraído del audio
                  </p>
                  <p className="mt-1 text-sm font-medium">«{selected.hookText}»</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Texto en pantalla
                  </p>
                  <p className="mt-1 text-sm">{selected.onScreenText}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Transcripción completa
                  </p>
                  <ScrollArea className="mt-2 h-56 rounded-md border border-border p-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {selected.transcript}
                    </p>
                  </ScrollArea>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={selected.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir reel
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    disabled={saved[selected.id] || selected.savedToHooks}
                    onClick={() => saveToHooks(selected)}
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    {saved[selected.id] || selected.savedToHooks
                      ? "Ya está en el Banco de Hooks"
                      : "Guardar en el Banco de Hooks"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/12 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </Card>
  );
}

export type { CompetitorAccount };
