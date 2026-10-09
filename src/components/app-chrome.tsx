import { type ReactNode } from "react";
import { Play } from "lucide-react";
import { AppNav, type DeskTab } from "@/components/app-nav";
import { launchPlay } from "@/lib/galia-play";

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
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:h-16 md:px-6">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.22em] text-brass uppercase">{kicker}</p>
          <h1 className="truncate font-display text-lg font-semibold leading-tight md:text-2xl">{title}</h1>
        </div>
        {actions}
        <button
          type="button"
          onClick={() => launchPlay()}
          className="flex h-11 items-center gap-2 rounded-lg border border-brass-dim bg-surface-2 px-3 font-display text-sm text-fg"
        >
          <Play className="size-4 text-brass" />
          <span className="hidden md:inline">Играть</span>
        </button>
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
