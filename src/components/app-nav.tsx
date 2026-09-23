import { Link } from "@tanstack/react-router";
import { Compass, LineChart, Ship, Users, Wallet } from "lucide-react";

export type DeskTab = "map" | "crew" | "ships" | "market" | "wallet";

const ITEMS = [
  { to: "/" as const, id: "map" as const, Icon: Compass, label: "Карта" },
  { to: "/crew" as const, id: "crew" as const, Icon: Users, label: "Экипаж" },
  { to: "/ships" as const, id: "ships" as const, Icon: Ship, label: "Флот" },
  { to: "/market" as const, id: "market" as const, Icon: LineChart, label: "Рынок" },
  { to: "/wallet" as const, id: "wallet" as const, Icon: Wallet, label: "Сейф" },
];

export function AppNav({
  current,
  variant = "bar",
}: {
  current: DeskTab;
  variant?: "bar" | "dock";
}) {
  if (variant === "dock") {
    return (
      <nav className="flex border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        {ITEMS.map(({ to, id, Icon, label }) => (
          <Link
            key={id}
            to={to}
            className={`flex h-14 min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 font-display text-xs tracking-wide ${
              current === id ? "text-fg" : "text-muted"
            }`}
          >
            <Icon className={`size-4 ${current === id ? "text-brass" : "text-faint"}`} />
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1 rounded-xl border border-line bg-surface/90 p-1 backdrop-blur-md">
      {ITEMS.map(({ to, id, Icon, label }) => (
        <Link
          key={id}
          to={to}
          className={`flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2.5 font-display text-sm tracking-wide transition-colors duration-150 ${
            current === id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
          }`}
        >
          <Icon className="size-4 text-brass" />
          <span className="hidden lg:inline">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
