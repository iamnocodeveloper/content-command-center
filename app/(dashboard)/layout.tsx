import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { isDemoMode } from "@/lib/zernio/config";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const demo = isDemoMode();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AppSidebar demo={demo} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
