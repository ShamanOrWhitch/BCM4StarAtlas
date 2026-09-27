export type FleetHull = { mint: string; name: string; image: string; qty: number };
export type SavedFleet = { id: string; name: string; hulls: FleetHull[] };

const KEY = "galia-fleets";

export function loadFleets(): SavedFleet[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedFleet[]) : [];
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.name === "string") : [];
  } catch {
    return [];
  }
}

export function saveFleets(rows: SavedFleet[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function addToFleet(rows: SavedFleet[], fleetName: string, hull: FleetHull): SavedFleet[] {
  const name = fleetName.trim();
  if (!name) return rows;
  const next = rows.map((row) => ({ ...row, hulls: row.hulls.map((item) => ({ ...item })) }));
  let fleet = next.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (!fleet) {
    fleet = { id: `${Date.now()}`, name, hulls: [] };
    next.push(fleet);
  }
  const have = fleet.hulls.find((item) => item.mint === hull.mint);
  if (have) have.qty += hull.qty;
  else fleet.hulls.push(hull);
  saveFleets(next);
  return next;
}
