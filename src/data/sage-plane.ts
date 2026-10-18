/** Mainnet SAGE snapshot, 2026-10-18. Program SAGE2HAwep459SNq61LHvjxPk4pLPEJLoMETef7f7EE.
 *  Star accounts are spectral types at integer [x, y]. The three CSS are Starbase accounts.
 *  SurveyDataUnitTracker says the plane runs −50…50 and lists the same three CSS points.
 *  Official SAGE Map Editor plots screenX = x, screenY = −y. Not an odd-r hex. */
export const SAGE_RANGE = { min: -50, max: 50 } as const;

/** Sector accounts that exist. Names on chain are "Sector [x, y]", not system titles. Not drawn one by one. */
export const SAGE_SECTOR_COUNT = 8177;

export type StarKind = 0 | 1 | 2 | 3 | 4;

export type SageStar = {
  x: number;
  y: number;
  kind: StarKind;
  size: number;
  name: string;
};

const STAR_ROWS: readonly (readonly [number, number, StarKind, number, string])[] = [
  [-2, -44, 3, 15500, "Hot Blue"],
  [10, -41, 2, 11299, "Solar"],
  [0, -39, 1, 8200, "Red Dwarf"],
  [-10, -37, 4, 17100, "Red Giant"],
  [2, -34, 0, 5200, "White Dwarf"],
  [-15, -33, 1, 10500, "Red Dwarf"],
  [12, -31, 0, 5000, "White Dwarf"],
  [21, -26, 1, 9400, "Red Dwarf"],
  [-22, -25, 2, 12600, "Solar"],
  [-8, -24, 0, 5300, "White Dwarf"],
  [0, -24, 2, 11399, "Solar"],
  [2, -23, 1, 8600, "Red Dwarf"],
  [31, -19, 4, 19100, "Red Giant"],
  [-30, -16, 0, 5300, "White Dwarf"],
  [-14, -16, 2, 12500, "Solar"],
  [11, -16, 3, 15700, "Hot Blue"],
  [23, -12, 0, 7200, "White Dwarf"],
  [-36, -7, 2, 12300, "Solar"],
  [16, -5, 2, 13799, "Solar"],
  [39, -1, 2, 12800, "Solar"],
  [-16, 0, 0, 6100, "White Dwarf"],
  [-40, 3, 4, 17400, "Red Giant"],
  [-23, 4, 4, 18000, "Red Giant"],
  [22, 5, 0, 7000, "White Dwarf"],
  [44, 10, 2, 13000, "Solar"],
  [-35, 12, 0, 5699, "White Dwarf"],
  [25, 14, 2, 11700, "Solar"],
  [-45, 15, 4, 19600, "Red Giant"],
  [-25, 15, 2, 11600, "Solar"],
  [0, 16, 0, 6000, "White Dwarf"],
  [35, 16, 4, 17400, "Red Giant"],
  [49, 20, 0, 6400, "White Dwarf"],
  [-28, 21, 0, 5800, "White Dwarf"],
  [17, 21, 0, 5200, "White Dwarf"],
  [28, 21, 1, 9200, "Red Dwarf"],
  [-18, 23, 0, 5300, "White Dwarf"],
  [-9, 24, 2, 12600, "Solar"],
  [-38, 25, 1, 9000, "Red Dwarf"],
  [38, 25, 1, 9900, "Red Dwarf"],
  [2, 26, 3, 15700, "Hot Blue"],
  [30, 28, 4, 18300, "Red Giant"],
  [-47, 30, 3, 16100, "Hot Blue"],
  [-40, 30, 1, 9500, "Red Dwarf"],
  [-30, 30, 0, 5400, "White Dwarf"],
  [40, 30, 3, 15600, "Hot Blue"],
  [22, 31, 1, 10400, "Red Dwarf"],
  [-22, 32, 2, 13899, "Solar"],
  [48, 32, 0, 6600, "White Dwarf"],
  [-42, 35, 1, 10200, "Red Dwarf"],
  [-8, 35, 4, 19100, "Red Giant"],
  [42, 35, 2, 13500, "Solar"],
  [13, 37, 1, 8000, "Red Dwarf"],
  [-19, 40, 3, 14400, "Hot Blue"],
  [5, 44, 3, 15500, "Hot Blue"],
];

export const SAGE_STARS: SageStar[] = STAR_ROWS.map(([x, y, kind, size, name]) => ({ x, y, kind, size, name }));

export const SAGE_CSS = [
  { id: "mud", faction: "MUD", name: "MUD Central Space Station", x: 0, y: -39 },
  { id: "oni", faction: "ONI", name: "ONI Central Space Station", x: -40, y: 30 },
  { id: "ustur", faction: "Ustur", name: "Ustur Central Space Station", x: 40, y: 30 },
] as const;

export type SageCss = (typeof SAGE_CSS)[number];

/** Nearest real stars on the square grid. A one-cell ring around a CSS is empty; the next stars sit a few cells out. */
export function nearestStars(x: number, y: number, within = 8): Array<SageStar & { dist: number }> {
  return SAGE_STARS.map((star) => ({
    ...star,
    dist: Math.max(Math.abs(star.x - x), Math.abs(star.y - y)),
  }))
    .filter((star) => star.dist > 0 && star.dist <= within)
    .sort((a, b) => a.dist - b.dist || b.size - a.size);
}
