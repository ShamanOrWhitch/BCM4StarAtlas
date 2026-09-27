import { useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
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

function Shell() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [MapView, setMapView] = useState<ComponentType | null>(null);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (tab !== "map" || MapView) return;
    void import("@/routes/map").then((mod) => setMapView(() => mod.MapPage));
  }, [tab, MapView]);
  if (tab === "map") return MapView ? <MapView /> : <p className="p-6 text-muted">Карта откроется по запросу, без автокручения.</p>;
  if (tab === "ships") return <ShipsPage />;
  if (tab === "market") return <MarketPage />;
  if (tab === "wallet") return <WalletPage />;
  return <CrewBay />;
}

const root = document.getElementById("galia-root");
if (root) createRoot(root).render(<Shell />);
