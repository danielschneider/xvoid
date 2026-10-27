import { makeRandom } from '../rng.js';
import { cellKey } from './cells.js';
import { allPassableReachable, restoreRegion, snapshotRegion } from './connectivity.js';

export const GRID_SIZES = [32, 40, 48];
// Highest level index a building reaches. Level 0 is ground, so 3 means up to four floors.
export const MAX_BUILDING_LEVEL = 3;

// Places a box only if the battlefield stays fully connected; otherwise rolls back.
function placeBox(cells, transitions, cell, cover) {
  const previous = { cover: cell.cover, terrain: cell.terrain };
  cell.cover = cover;
  cell.terrain = cover === 2 ? 'pillar' : 'console';
  if (!allPassableReachable(cells, transitions)) Object.assign(cell, previous);
}

// Raises a walled building with `topLevel + 1` floors. Each upper floor is an open
// interior platform, and one stair column in the interior corner links every floor.
function raiseBuilding(cells, transitions, room, topLevel) {
  const { x, z, w, h } = room;
  for (let zz = z; zz < z + h; zz += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const perimeter = xx === x || xx === x + w - 1 || zz === z || zz === z + h - 1;
      const door = (xx === x + Math.floor(w / 2) && zz === z) || (xx === x && zz === z + Math.floor(h / 2));
      const cell = cells[cellKey({ x: xx, z: zz })];
      cell.structure = true;
      if (perimeter && !door) {
        cell.terrain = 'wall';
        cell.walkable = false;
        cell.cover = 2;
      }
    }
  }

  for (let level = 1; level <= topLevel; level += 1) {
    for (let zz = z + 1; zz < z + h - 1; zz += 1) {
      for (let xx = x + 1; xx < x + w - 1; xx += 1) {
        const floor = { x: xx, z: zz, level };
        cells[cellKey(floor)] = {
          ...floor,
          terrain: 'platform',
          walkable: true,
          cover: 0,
          structure: true,
          corridor: false,
        };
      }
    }
  }

  const stairX = x + 1;
  const stairZ = z + 1;
  for (let level = 0; level <= topLevel; level += 1) {
    cells[cellKey({ x: stairX, z: stairZ, level })].terrain = 'stairs';
  }
  for (let level = 0; level < topLevel; level += 1) {
    const lower = cellKey({ x: stairX, z: stairZ, level });
    const upper = cellKey({ x: stairX, z: stairZ, level: level + 1 });
    transitions[lower] = [...(transitions[lower] || []), { x: stairX, z: stairZ, level: level + 1 }];
    transitions[upper] = [...(transitions[upper] || []), { x: stairX, z: stairZ, level }];
  }
}

export function createBattlefield(seed) {
  const random = makeRandom(seed);
  const size = GRID_SIZES[Math.floor(random() * GRID_SIZES.length)];
  const middle = Math.floor(size / 2);
  const cells = {};
  const transitions = {};

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
  const buildings = [];
  for (const origin of anchorOrigins) {
    const room = {
      x: origin.x,
      z: origin.z,
      w: 8 + Math.floor(random() * 3),
      h: 8 + Math.floor(random() * 3),
    };
    raiseBuilding(cells, transitions, room, 1 + Math.floor(random() * MAX_BUILDING_LEVEL));
    buildings.push(room);
  }

  // Extra buildings fill the remaining space in each quadrant. A building is kept only
  // if it leaves a one-cell gap to others and the battlefield stays connected.
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
    raiseBuilding(cells, transitions, room, topLevel);
    if (!allPassableReachable(cells, transitions)) {
      restoreRegion(cells, transitions, saved);
      continue;
    }
    buildings.push(room);
  }

  const interiorBoxCandidates = [];
  const upperFloorCells = [];
  for (const room of buildings) {
    for (let z = room.z + 1; z < room.z + room.h - 1; z += 1) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
        const cell = cells[cellKey({ x, z })];
        if (random() < 0.12) interiorBoxCandidates.push(cell);
      }
    }
  }
  for (const cell of Object.values(cells)) {
    if (cell.level > 0 && cell.terrain === 'platform') upperFloorCells.push(cell);
  }

  // Boxes are placed only after all structure (stairs, platforms) exists, so the
  // connectivity guard sees the real map and can never overwrite a stair.
  for (const cell of interiorBoxCandidates) {
    if (cell.terrain !== 'floor') continue;
    placeBox(cells, transitions, cell, random() > 0.45 ? 2 : 1);
  }
  for (const cell of upperFloorCells) {
    if (random() < 0.1) placeBox(cells, transitions, cell, random() > 0.5 ? 2 : 1);
  }

  for (let index = 0; index < Math.floor((size * size) / 16); index += 1) {
    const x = 2 + Math.floor(random() * (size - 4));
    const z = 2 + Math.floor(random() * (size - 4));
    const cell = cells[cellKey({ x, z })];
    if (cell?.walkable && !cell.structure && cell.cover === 0 && (x + z) % 3 !== 0) {
      placeBox(cells, transitions, cell, random() > 0.68 ? 2 : 1);
    }
  }

  return { seed, size, cells, transitions, rooms: buildings };
}
