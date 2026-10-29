import type { Battlefield, BuildingRecord, Cell, Position, Room } from '../types.ts';
import { makeRandom } from '../rng.ts';
import { cellKey } from './cells.ts';
import { allPassableReachable, restoreRegion, snapshotRegion } from './connectivity.ts';
import { chooseDoors, laneKeys } from './building/doors.ts';
import { doorKeys, isPerimeter } from './building/footprint.ts';
import { raiseFloor } from './building/floors.ts';
import { placeStairs, stairCorners } from './building/stairs.ts';
import { partitionCells } from './building/partitions.ts';
import { floorReachable, lanesOpen } from './building/validate.ts';
import { placeBoxes } from './boxes.ts';
import { firstFreeCandidate } from './candidates.ts';
import { MAP_THEMES, type MapTheme } from './themes.ts';

export const GRID_SIZES = [32, 40, 48];
// Highest level index a building reaches in the standard theme. Level 0 is ground.
export const MAX_BUILDING_LEVEL = 3;
// Footprints sampled per extra-building attempt before the attempt gives up.
const CANDIDATES_PER_ATTEMPT = 40;

// Picks the theme from a hash of the seed, so the theme does not shift layout draws and
// neighbouring seeds spread across all themes (a single LCG step correlates them).
export function themeForSeed(seed: number): MapTheme {
  let h = (seed ^ 0x7f4a7c15) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return MAP_THEMES[(h >>> 0) % MAP_THEMES.length];
}

// Ground-floor shell: walls on the perimeter, doors opened on the chosen sides.
function raiseShell(cells: Record<string, Cell>, room: Room, doors: BuildingRecord['doors']): Set<string> {
  const opened = doorKeys(room, doors.sides, doors.width);
  for (let z = room.z; z < room.z + room.h; z += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      const key = cellKey({ x, z, level: 0 });
      const cell = cells[key];
      cell.structure = true;
      cell.building = { id: room.id, role: 'interior' };
      if (isPerimeter(room, x, z)) {
        if (opened.has(key)) {
          cell.terrain = 'door';
          cell.building.role = 'door';
        } else {
          cell.terrain = 'wall';
          cell.walkable = false;
          cell.cover = 2;
          cell.building.role = 'wall';
        }
      }
    }
  }
  return opened;
}

// Adds rooms with one partition per floor when the interior is big enough. Partitions
// leave a one-cell gap and never touch stairs or lanes; a partition that fails is skipped.
function addPartitions(cells: Record<string, Cell>, room: Room, level: number, protectedKeys: Set<string>): void {
  const { x, z, w, h } = room;
  if (w < 8 && h < 8) return;
  const axis = w >= h ? 'x' : 'z';
  const span = axis === 'x' ? w : h;
  const at = (axis === 'x' ? x : z) + Math.floor(span / 2);
  const gapPos = axis === 'x' ? z + Math.floor(h / 2) : x + Math.floor(w / 2);
  const wall = partitionCells(room, axis, at, gapPos).map((cell) => ({ ...cell, level }));
  if (wall.some((cell) => protectedKeys.has(cellKey(cell)))) return;
  for (const cell of wall) {
    Object.assign(cells[cellKey(cell)], {
      terrain: 'partition',
      walkable: false,
      cover: 2,
      building: { id: room.id, role: 'partition' },
    });
  }
}

// Raises a building with `topLevel + 1` floors. Returns the reserved keys and doors.
function raiseBuilding(
  cells: Record<string, Cell>,
  transitions: Record<string, Position[]>,
  room: Room,
  topLevel: number,
  middle: number,
  anchor: boolean,
  random: () => number,
  protectedKeys: Set<string>
): BuildingRecord {
  const doors = chooseDoors(room, middle, anchor, random);
  raiseShell(cells, room, doors);
  const lanes = laneKeys(room, doors.sides, doors.width);

  for (let level = 1; level <= topLevel; level += 1) raiseFloor(cells, room, level);
  const stairKeys = placeStairs(cells, transitions, room, topLevel);

  for (const key of [...lanes, ...stairKeys]) protectedKeys.add(key);
  for (let level = 0; level <= topLevel; level += 1) addPartitions(cells, room, level, protectedKeys);
  return { doors, lanes, stairKeys, topLevel };
}

// Checks the finished building: global connectivity, every floor reachable, lanes open.
function buildingValid(
  cells: Record<string, Cell>,
  transitions: Record<string, Position[]>,
  room: Room,
  record: BuildingRecord
): boolean {
  if (!allPassableReachable(cells, transitions)) return false;
  for (let level = 0; level <= record.topLevel; level += 1) {
    if (!floorReachable(cells, transitions, room, level, stairCorners(room)[0])) return false;
  }
  return lanesOpen(cells, record.lanes);
}

export function createBattlefield(seed: number): Battlefield {
  const random = makeRandom(seed);
  const size = GRID_SIZES[Math.floor(random() * GRID_SIZES.length)];
  const theme = themeForSeed(seed);
  const middle = Math.floor(size / 2);
  const cells: Record<string, Cell> = {};
  const transitions: Record<string, Position[]> = {};
  const protectedKeys = new Set<string>();

  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const corridor = x === middle || z === middle;
      cells[cellKey({ x, z })] = {
        x,
        z,
        level: 0,
        terrain: 'floor',
        walkable: true,
        cover: 0,
        structure: false,
        corridor,
      };
    }
  }

  // Four large corner buildings keep fixed origins so the spawn and stair layout
  // stays predictable; their size and floor count vary per seed.
  const anchorOrigins = [
    { x: 5, z: 4 },
    { x: size - 13, z: 4 },
    { x: 5, z: size - 12 },
    { x: size - 13, z: size - 12 },
  ];
  const buildings: Room[] = [];
  for (const [index, origin] of anchorOrigins.entries()) {
    const room = {
      id: buildings.length,
      x: origin.x,
      z: origin.z,
      w: 8 + Math.floor(random() * 3),
      h: 8 + Math.floor(random() * 3),
    };
    const topLevel = 1 + Math.floor(random() * theme.maxBuildingLevel);
    const saved = snapshotRegion(cells, transitions, room, topLevel);
    const record = raiseBuilding(cells, transitions, room, topLevel, middle, true, random, protectedKeys);
    if (!buildingValid(cells, transitions, room, record)) {
      restoreRegion(cells, transitions, saved);
      for (const key of [...record.lanes, ...record.stairKeys]) protectedKeys.delete(key);
      continue;
    }
    buildings.push({ ...room, anchor: index < 4, topLevel, doors: record.doors });
  }

  // Extra buildings fill the remaining space in each quadrant. A building is kept only
  // if it leaves a one-cell gap to others and it passes every validation check.
  const baseAttempts = size >= 48 ? 30 : size >= 40 ? 22 : 16;
  const extraAttempts = Math.round(baseAttempts * theme.extraBuildingScale);
  for (let attempt = 0; attempt < extraAttempts; attempt += 1) {
    // Sample several footprints per attempt: a single random spot rarely clears the gap rule.
    const room = firstFreeCandidate(buildings, size, middle, random, CANDIDATES_PER_ATTEMPT);
    if (!room) continue;
    const overlaps = buildings.some(
      (other) =>
        room.x - 1 <= other.x + other.w - 1 &&
        other.x <= room.x + room.w &&
        room.z - 1 <= other.z + other.h - 1 &&
        other.z <= room.z + room.h
    );
    if (overlaps) continue;
    const topLevel = 1 + Math.floor(random() * theme.maxBuildingLevel);
    const saved = snapshotRegion(cells, transitions, room, topLevel);
    const keysBefore = new Set(protectedKeys);
    const record = raiseBuilding(cells, transitions, room, topLevel, middle, false, random, protectedKeys);
    if (!buildingValid(cells, transitions, room, record)) {
      restoreRegion(cells, transitions, saved);
      protectedKeys.clear();
      for (const key of keysBefore) protectedKeys.add(key);
      continue;
    }
    buildings.push({ ...room, anchor: false, topLevel, doors: record.doors });
  }

  placeBoxes(cells, transitions, buildings, size, theme, random, protectedKeys);

  return { seed, size, theme: theme.id, cells, transitions, rooms: buildings };
}
