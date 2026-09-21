import { type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";

export function AppChrome({
  current,
  kicker,
  title,
  actions,
  children,
}: {
  current: "map" | "crew" | "ships";
  kicker: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:h-16 md:px-6">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.22em] text-brass uppercase">{kicker}</p>
          <h1 className="truncate font-display text-lg font-semibold leading-tight md:text-2xl">{title}</h1>
        </div>
        {actions}
        <div className="hidden md:block">
          <AppNav current={current} />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div className="shrink-0 md:hidden">
        <AppNav current={current} variant="dock" />
      </div>
    </div>
  );
}
