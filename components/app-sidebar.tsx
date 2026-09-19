"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";

import { NAV_ITEMS, SECONDARY_NAV_ITEMS, type NavItem } from "@/components/nav-config";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const HANDLE = "@tenfoldmarc";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-tight">{item.label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

function BrandBlock() {
  return (
    <Link href="/hooks" className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent/50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-primary/30">
        TM
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
          {HANDLE}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          Content Command Center
        </span>
      </span>
    </Link>
  );
}

function SidebarBody({
  demo,
  onNavigate,
}: {
  demo: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="px-2 pt-2">
        <BrandBlock />
      </div>

      <ScrollArea className="flex-1 px-2">
        <nav className="flex flex-col gap-1 pb-4" aria-label="Secciones">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}

          <div className="my-2 h-px bg-sidebar-border" />

          {SECONDARY_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground">Zernio</p>
            <p className="truncate text-xs text-muted-foreground">
              {demo ? "Modo demo · datos semilla" : "Conectado · API v1"}
            </p>
          </div>
          <ThemeToggle />
        </div>
        {demo ? (
          <Badge variant="warning" className="mt-3">
            DEMO_MODE
          </Badge>
        ) : (
          <Badge variant="success" className="mt-3">
            LIVE
          </Badge>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra lateral fija en escritorio */}
      <aside className="hidden w-[272px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarBody demo={demo} />
        </div>
      </aside>

      {/* Cabecera móvil con hoja deslizante */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar/95 px-4 py-3 backdrop-blur lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Abrir menú">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[288px] bg-sidebar p-0">
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <SidebarBody demo={demo} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold">{HANDLE}</span>
        <ThemeToggle />
      </header>
    </>
  );
}
