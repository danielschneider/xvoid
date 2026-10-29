import type { Battlefield, BuildingRecord, Cell, Cover, Position, Room } from '../types.ts';
import { makeRandom } from '../rng.ts';
import { cellKey } from './cells.ts';
import { allPassableReachable, restoreRegion, snapshotRegion } from './connectivity.ts';
import { chooseDoors, laneKeys } from './building/doors.ts';
import { doorKeys, isPerimeter } from './building/footprint.ts';
import { raiseFloor } from './building/floors.ts';
import { placeStairs, stairCorners } from './building/stairs.ts';
import { partitionCells } from './building/partitions.ts';
import { floorReachable, lanesOpen } from './building/validate.ts';

export const GRID_SIZES = [32, 40, 48];
// Highest level index a building reaches. Level 0 is ground, so 3 means up to four floors.
export const MAX_BUILDING_LEVEL = 3;

// Places a box only if the battlefield stays connected and no protected cell is touched.
function placeBox(
  cells: Record<string, Cell>,
  transitions: Record<string, Position[]>,
  cell: Cell,
  cover: Cover,
  protectedKeys: Set<string>
): void {
  if (protectedKeys.has(cellKey(cell))) return;
  const previous = { cover: cell.cover, terrain: cell.terrain };
  cell.cover = cover;
  cell.terrain = cover === 2 ? 'pillar' : 'console';
  if (!allPassableReachable(cells, transitions)) Object.assign(cell, previous);
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
function addPartitions(
  cells: Record<string, Cell>,
  room: Room,
  level: number,
  protectedKeys: Set<string>
): void {
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
    const topLevel = 1 + Math.floor(random() * MAX_BUILDING_LEVEL);
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
  const extraAttempts = size >= 48 ? 30 : size >= 40 ? 22 : 16;
  const bounds = {
    left: { min: 2, max: middle - 3 },
    right: { min: middle + 2, max: size - 3 },
  };
  for (let attempt = 0; attempt < extraAttempts; attempt += 1) {
    const xBounds = bounds[random() < 0.5 ? 'left' : 'right'];
    const zBounds = bounds[random() < 0.5 ? 'left' : 'right'];
    const w = 6 + Math.floor(random() * 4);
    const h = 6 + Math.floor(random() * 4);
    const maxX = xBounds.max - w + 1;
    const maxZ = zBounds.max - h + 1;
    if (maxX < xBounds.min || maxZ < zBounds.min) continue;
    const room = {
      id: buildings.length,
      x: xBounds.min + Math.floor(random() * (maxX - xBounds.min + 1)),
      z: zBounds.min + Math.floor(random() * (maxZ - zBounds.min + 1)),
      w,
      h,
    };
    const overlaps = buildings.some(
      (other) =>
        room.x - 1 <= other.x + other.w - 1 &&
        other.x <= room.x + room.w &&
        room.z - 1 <= other.z + other.h - 1 &&
        other.z <= room.z + room.h
    );
    if (overlaps) continue;
    const topLevel = 1 + Math.floor(random() * MAX_BUILDING_LEVEL);
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

  // Boxes are placed only after all structure exists, so the connectivity guard sees the
  // real map. Protected keys (stairs, lanes) are never overwritten.
  for (const room of buildings) {
    for (let z = room.z + 1; z < room.z + room.h - 1; z += 1) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
        const cell = cells[cellKey({ x, z })];
        if (random() < 0.12 && cell.terrain === 'floor') {
          placeBox(cells, transitions, cell, random() > 0.45 ? 2 : 1, protectedKeys);
        }
      }
    }
  }
  for (const cell of Object.values(cells)) {
    if (cell.level > 0 && cell.terrain === 'floor' && cell.building?.role === 'interior' && random() < 0.1) {
      placeBox(cells, transitions, cell, random() > 0.5 ? 2 : 1, protectedKeys);
    }
  }

  for (let index = 0; index < Math.floor((size * size) / 16); index += 1) {
    const x = 2 + Math.floor(random() * (size - 4));
    const z = 2 + Math.floor(random() * (size - 4));
    const cell = cells[cellKey({ x, z })];
    if (cell?.walkable && !cell.structure && cell.cover === 0 && (x + z) % 3 !== 0) {
      placeBox(cells, transitions, cell, random() > 0.68 ? 2 : 1, protectedKeys);
    }
  }

  return { seed, size, cells, transitions, rooms: buildings };
}
