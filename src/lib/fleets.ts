export type SeatAssign = { role: string; crewId: string | null };
export type HullCopy = { seats: SeatAssign[] };
export type FleetHull = {
  mint: string;
  name: string;
  image: string;
  qty: number;
  slots: string[];
  copies: HullCopy[];
};
export type SavedFleet = { id: string; name: string; hulls: FleetHull[] };

const KEY = "galia-fleets";

function seatsFor(slots: string[]): SeatAssign[] {
  const roles = slots.length ? slots : ["Pilot", "слот"];
  return roles.map((role) => ({ role, crewId: null }));
}

function copiesFor(qty: number, slots: string[]): HullCopy[] {
  return Array.from({ length: Math.max(1, qty) }, () => ({ seats: seatsFor(slots) }));
}

export function loadFleets(): SavedFleet[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedFleet[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row.name === "string")
      .map((row) => ({
        ...row,
        hulls: (row.hulls ?? []).map((hull) => ({
          ...hull,
          slots: hull.slots ?? [],
          copies: hull.copies?.length ? hull.copies : copiesFor(hull.qty || 1, hull.slots ?? []),
        })),
      }));
  } catch {
    return [];
  }
}

export function saveFleets(rows: SavedFleet[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function addToFleet(rows: SavedFleet[], fleetName: string, hull: Omit<FleetHull, "copies"> & { slots?: string[] }): SavedFleet[] {
  const name = fleetName.trim();
  if (!name) return rows;
  const next = loadFleets().map((row) => ({ ...row, hulls: row.hulls.map((item) => ({ ...item, copies: item.copies.map((copy) => ({ seats: copy.seats.map((seat) => ({ ...seat })) })) })) }));
  let fleet = next.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (!fleet) {
    fleet = { id: `${Date.now()}`, name, hulls: [] };
    next.push(fleet);
  }
  const slots = hull.slots ?? [];
  const have = fleet.hulls.find((item) => item.mint === hull.mint);
  if (have) {
    have.qty += hull.qty;
    have.slots = slots.length ? slots : have.slots;
    have.copies.push(...copiesFor(hull.qty, have.slots));
  } else {
    fleet.hulls.push({ ...hull, slots, qty: hull.qty, copies: copiesFor(hull.qty, slots) });
  }
  saveFleets(next);
  return next;
}

export function dropHull(rows: SavedFleet[], fleetId: string, mint: string, copyIndex: number | null): SavedFleet[] {
  const next = rows.map((fleet) => {
    if (fleet.id !== fleetId) return fleet;
    return {
      ...fleet,
      hulls: fleet.hulls
        .map((hull) => {
          if (hull.mint !== mint) return hull;
          if (copyIndex == null) return { ...hull, qty: 0, copies: [] };
          const copies = hull.copies.filter((_, index) => index !== copyIndex);
          return { ...hull, copies, qty: copies.length };
        })
        .filter((hull) => hull.qty > 0 && hull.copies.length > 0),
    };
  });
  saveFleets(next);
  return next;
}

export function assignSeat(rows: SavedFleet[], fleetId: string, mint: string, copyIndex: number, seatIndex: number, crewId: string | null): SavedFleet[] {
  const next = rows.map((fleet) => {
    if (fleet.id !== fleetId) return fleet;
    return {
      ...fleet,
      hulls: fleet.hulls.map((hull) => {
        if (hull.mint !== mint) return hull;
        const copies = hull.copies.map((copy, index) => {
          if (index !== copyIndex) return copy;
          return { seats: copy.seats.map((seat, seatAt) => (seatAt === seatIndex ? { ...seat, crewId } : seat)) };
        });
        return { ...hull, copies };
      }),
    };
  });
  saveFleets(next);
  return next;
}
