import { useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { AppChrome } from "@/components/app-chrome";
import { CrewBay } from "@/components/crew/bay";
import { ShipsPage } from "@/routes/ships";
import { MarketPage } from "@/routes/market";
import { WalletPage } from "@/routes/wallet";
import "../styles.css";

type Tab = "crew" | "map" | "ships" | "market" | "wallet";

function tabFromHash(): Tab {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  if (hash.startsWith("/map")) return "map";
  if (hash.startsWith("/ships")) return "ships";
  if (hash.startsWith("/market")) return "market";
  if (hash.startsWith("/wallet")) return "wallet";
  return "crew";
}

function MapTab() {
  const [View, setView] = useState<ComponentType | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void import("@/routes/map")
      .then((mod) => {
        if (alive) setView(() => mod.MapPage);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "map.js не загрузился");
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <AppChrome current="map" kicker="Galia · карта" title="Карта">
      {error ? (
        <p className="p-6 text-sm text-muted">
          Карта не загрузилась ({error}). Файл map.js должен лежать в той же папке, что и app.js. Меню сверху работает.
        </p>
      ) : View ? (
        <View />
      ) : (
        <p className="p-6 text-sm text-muted">Карта откроется по запросу, без автокручения.</p>
      )}
    </AppChrome>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (tab === "map") return <MapTab />;
  if (tab === "ships") return <ShipsPage />;
  if (tab === "market") return <MarketPage />;
  if (tab === "wallet") return <WalletPage />;
  return <CrewBay />;
}

const root = document.getElementById("galia-root");
if (root) createRoot(root).render(<Shell />);
