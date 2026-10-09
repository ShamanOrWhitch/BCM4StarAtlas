type PlayShip = { quantity?: number; crew?: number };
type PlayCrew = { id?: string };

type Ready = {
  source: "wallet" | "default";
  owner: string;
  crew: PlayCrew[];
  ships: PlayShip[];
  selectedId: string | null;
};

let ready: Ready | null = null;

export function publishPlayReady(next: Ready) {
  ready = next;
}

export function launchPlay(selectedId?: string | null) {
  if (!ready?.crew.length) return;
  const id = selectedId || ready.selectedId;
  const first = ready.crew.find((crew) => crew.id && crew.id === id) ?? ready.crew[0];
  const crew = [first, ...ready.crew.filter((row) => row !== first)];
  const capacity = ready.ships.reduce((sum, ship) => sum + Number(ship.quantity || 1) * Number(ship.crew || 0), 0) || 2;
  const payload = {
    source: ready.source,
    owner: ready.owner,
    crew,
    ships: ready.ships,
    maxPlayers: capacity,
    startMode: "space-labyrinth",
  };
  window.GALIA_PLAY_STATE = payload;
  window.dispatchEvent(new CustomEvent("galia-play-request", { detail: payload }));
  document.querySelector(".bcm-mini-sim")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
