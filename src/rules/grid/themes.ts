// Map themes: balance data that shapes generation. Each seed picks one theme, so maps
// differ in density, cover mix and building height, not only in layout. Every field
// is read by generate.ts or boxes.ts; do not repeat these numbers elsewhere.

export interface MapTheme {
  id: string;
  name: string;
  // Highest storey index a building reaches in this theme (0 is ground, so 1 means two floors).
  maxBuildingLevel: number;
  // Multiplier on the number of extra (non-anchor) building attempts.
  extraBuildingScale: number;
  // Chance that a free cell inside a building footprint becomes a box.
  buildingBoxChance: number;
  // Chance that an upper-floor interior cell becomes a box.
  upperFloorBoxChance: number;
  // Chance that a building box is full cover (pillar) rather than half cover (console).
  buildingFullCover: number;
  // Open-ground scatter: one attempt per (size * size / scatterDivisor) cells.
  scatterDivisor: number;
  // Chance that a scattered box is full cover.
  scatterFullCover: number;
}

export const MAP_THEMES: readonly MapTheme[] = [
  {
    id: 'standard',
    name: 'Standard',
    maxBuildingLevel: 3,
    extraBuildingScale: 1,
    buildingBoxChance: 0.12,
    upperFloorBoxChance: 0.1,
    buildingFullCover: 0.55,
    scatterDivisor: 16,
    scatterFullCover: 0.32,
  },
  {
    id: 'cluttered',
    name: 'Cluttered',
    maxBuildingLevel: 3,
    extraBuildingScale: 1.3,
    buildingBoxChance: 0.2,
    upperFloorBoxChance: 0.18,
    buildingFullCover: 0.7,
    scatterDivisor: 10,
    scatterFullCover: 0.5,
  },
  {
    id: 'open',
    name: 'Open Ground',
    maxBuildingLevel: 2,
    extraBuildingScale: 0.5,
    buildingBoxChance: 0.04,
    upperFloorBoxChance: 0.03,
    buildingFullCover: 0.4,
    scatterDivisor: 40,
    scatterFullCover: 0.2,
  },
  {
    id: 'towers',
    name: 'Towers',
    maxBuildingLevel: 3,
    extraBuildingScale: 0.6,
    buildingBoxChance: 0.08,
    upperFloorBoxChance: 0.12,
    buildingFullCover: 0.6,
    scatterDivisor: 28,
    scatterFullCover: 0.3,
  },
];
