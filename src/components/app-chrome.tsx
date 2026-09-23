import { useState, type ReactNode } from "react";
import { AppNav, type DeskTab } from "@/components/app-nav";
import { ArchiveButton, ArchivePanel } from "@/components/archive";

export function AppChrome({
  current,
  kicker,
  title,
  actions,
  children,
}: {
  current: DeskTab;
  kicker: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [archive, setArchive] = useState(false);
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:h-16 md:px-6">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.22em] text-brass uppercase">{kicker}</p>
          <h1 className="truncate font-display text-lg font-semibold leading-tight md:text-2xl">{title}</h1>
        </div>
        {actions}
        <ArchiveButton onClick={() => setArchive(true)} />
        <div className="hidden md:block">
          <AppNav current={current} />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div className="shrink-0 md:hidden">
        <AppNav current={current} variant="dock" />
      </div>
      {archive ? <ArchivePanel onClose={() => setArchive(false)} /> : null}
    </div>
  );
}
