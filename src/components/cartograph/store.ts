import { create } from "zustand";
import { SYSTEMS, cssMarker } from "@/data/systems";
import { saveFavorites } from "@/lib/favorites";

type CartographState = {
  systemId: string;
  markerId: string | null;
  favorites: string[];
  autoRotate: boolean;
  interacting: boolean;
  focusNonce: number;
  setSystem: (id: string) => void;
  selectMarker: (id: string | null) => void;
  toggleFavorite: (key: string) => void;
  setInteracting: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
};

export const useCartograph = create<CartographState>((set, get) => ({
  systemId: SYSTEMS[0].id,
  markerId: "oni-css",
  favorites: [],
  autoRotate: true,
  interacting: false,
  focusNonce: 0,
  setSystem: (id) => {
    if (id === get().systemId) return;
    const sys = SYSTEMS.find((s) => s.id === id);
    const station = sys ? cssMarker(sys) : null;
    set({ systemId: id, markerId: station?.id ?? null, focusNonce: 0 });
  },
  selectMarker: (id) =>
    set((s) => ({
      markerId: id,
      autoRotate: id ? false : s.autoRotate,
      focusNonce: id ? s.focusNonce + 1 : s.focusNonce,
    })),
  toggleFavorite: (key) => {
    const has = get().favorites.includes(key);
    const next = has ? get().favorites.filter((k) => k !== key) : [...get().favorites, key];
    saveFavorites(next);
    set({ favorites: next });
  },
  setInteracting: (v) => set({ interacting: v, autoRotate: v ? false : get().autoRotate }),
  setAutoRotate: (v) => set({ autoRotate: v }),
}));
