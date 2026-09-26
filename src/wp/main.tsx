import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { GlobeCanvas } from "@/components/cartograph/scene";
import { Overlay } from "@/components/cartograph/overlay";
import { CrewBay } from "@/components/crew/bay";
import { ShipsPage } from "@/routes/ships";
import { MarketPage } from "@/routes/market";
import { WalletPage } from "@/routes/wallet";
import "../styles.css";

type Tab = "map" | "crew" | "ships" | "market" | "wallet";

function tabFromHash(): Tab {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  if (hash.startsWith("/crew")) return "crew";
  if (hash.startsWith("/ships")) return "ships";
  if (hash.startsWith("/market")) return "market";
  if (hash.startsWith("/wallet")) return "wallet";
  return "map";
}

function Shell() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (tab === "crew") return <CrewBay />;
  if (tab === "ships") return <ShipsPage />;
  if (tab === "market") return <MarketPage />;
  if (tab === "wallet") return <WalletPage />;
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <GlobeCanvas />
      <Overlay />
    </main>
  );
}

const root = document.getElementById("galia-root");
if (root) createRoot(root).render(<Shell />);
