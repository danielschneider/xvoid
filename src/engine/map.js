import { AP_MOVE_CHEAP, AP_MOVE_FULL, DEFAULT_MOVE_RANGE, FOG_REVEAL_RANGE, VISION_RANGE } from '../rules/constants.js';

export { FOG_REVEAL_RANGE, VISION_RANGE };
export const GRID_SIZES = [32, 40, 48];
// Highest level index a building reaches. Level 0 is ground, so 3 means up to four floors.
export const MAX_BUILDING_LEVEL = 3;
export const cellKey = ({ x, z, level = 0 }) => `${x},${z},${level}`;
// Height of a cell in steps. Currently the storey index only: no generator sets an
// elevation, so this is the single place to change if terrain height is added later.
export const cellHeight = (cell) => cell?.level || 0;

// Terrain that physically blocks movement. Boxes (pillar/console) are rendered as
// solid cover objects, so they must never be walkable. Single source of truth for
// movement, spawning, and map-connectivity checks.
export const BLOCKING_TERRAIN = new Set(['wall', 'pillar', 'console']);
export const isPassable = (cell) => Boolean(cell && cell.walkable && !BLOCKING_TERRAIN.has(cell.terrain));

// Single seeded LCG for the whole engine. game.js imports it, so seeds stay consistent.
export const makeRandom = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const neighborsOf = (current, transitions) => [
  { x: current.x + 1, z: current.z, level: current.level },
  { x: current.x - 1, z: current.z, level: current.level },
  { x: current.x, z: current.z + 1, level: current.level },
  { x: current.x, z: current.z - 1, level: current.level },
  ...(transitions[cellKey(current)] || []),
];

// True when every passable cell (all levels) can be reached from a corner anchor.
// The anchor corner is never covered, so it is always passable.
function allPassableReachable(cells, transitions) {
  const total = Object.values(cells).filter(isPassable).length;
  const anchor = cells[cellKey({ x: 0, z: 0 })];
  if (!isPassable(anchor)) return false;
  const seen = new Set([cellKey(anchor)]);
  const queue = [anchor];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const next of neighborsOf(queue[cursor], transitions)) {
      const key = cellKey(next);
      const cell = cells[key];
      if (seen.has(key) || !isPassable(cell)) continue;
      seen.add(key);
      queue.push(cell);
    }
  }
  return seen.size === total;
}

// Places a box only if the battlefield stays fully connected; otherwise rolls back.
function placeBox(cells, transitions, cell, cover) {
  const previous = { cover: cell.cover, terrain: cell.terrain };
  cell.cover = cover;
  cell.terrain = cover === 2 ? 'pillar' : 'console';
  if (!allPassableReachable(cells, transitions)) Object.assign(cell, previous);
}

// Saves every cell and transition inside a building's footprint (all levels) so a
// failed placement can be undone exactly.
function snapshotRegion(cells, transitions, room, topLevel) {
  const saved = [];
  for (let level = 0; level <= topLevel; level += 1) {
    for (let z = room.z - 1; z <= room.z + room.h; z += 1) {
      for (let x = room.x - 1; x <= room.x + room.w; x += 1) {
        const key = cellKey({ x, z, level });
        saved.push([key, cells[key] ? { ...cells[key] } : undefined, transitions[key]]);
      }
    }
  }
  return saved;
}

function restoreRegion(cells, transitions, saved) {
  for (const [key, cell, transition] of saved) {
    if (cell) cells[key] = cell;
    else delete cells[key];
    if (transition) transitions[key] = transition;
    else delete transitions[key];
  }
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
        cells[cellKey(floor)] = { ...floor, terrain: 'platform', walkable: true, cover: 0, structure: true, corridor: false };
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

export function createBattlefield(seed = Date.now()) {
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
    const overlaps = buildings.some((other) => (
      room.x - 1 <= other.x + other.w - 1 && other.x <= room.x + room.w
      && room.z - 1 <= other.z + other.h - 1 && other.z <= room.z + room.h
    ));
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

  for (let index = 0; index < Math.floor(size * size / 16); index += 1) {
    const x = 2 + Math.floor(random() * (size - 4));
    const z = 2 + Math.floor(random() * (size - 4));
    const cell = cells[cellKey({ x, z })];
    if (cell?.walkable && !cell.structure && cell.cover === 0 && (x + z) % 3 !== 0) {
      placeBox(cells, transitions, cell, random() > 0.68 ? 2 : 1);
    }
  }

  return { seed, size, cells, transitions, rooms: buildings };
}

export function getReachable(map, start, blocked = new Set(), maxSteps = DEFAULT_MOVE_RANGE, cheapSteps = Math.ceil(DEFAULT_MOVE_RANGE / 2)) {
  const startKey = cellKey(start);
  const queue = [start];
  const distance = new Map([[startKey, 0]]);
  const previous = new Map();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const currentKey = cellKey(current);
    const currentDistance = distance.get(currentKey);

    for (const next of neighborsOf(current, map.transitions)) {
      const nextKey = cellKey(next);
      const cell = map.cells[nextKey];
      if (!isPassable(cell) || blocked.has(nextKey) || distance.has(nextKey) || currentDistance >= maxSteps) continue;
      distance.set(nextKey, currentDistance + 1);
      previous.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  const paths = new Map();
  for (const [key, steps] of distance) {
    if (key === startKey) continue;
    const path = [];
    let cursor = key;
    while (cursor !== startKey) {
      path.unshift(map.cells[cursor]);
      cursor = previous.get(cursor);
    }
    paths.set(key, { steps, path, apCost: steps <= cheapSteps ? AP_MOVE_CHEAP : AP_MOVE_FULL });
  }
  return paths;
}

export function hasLineOfSight(map, from, to) {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.z - from.z));
  if (steps === 0) return true;
  for (let step = 1; step < steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(from.x + (to.x - from.x) * ratio);
    const z = Math.round(from.z + (to.z - from.z) * ratio);
    const cell = map.cells[cellKey({ x, z, level: Math.min(from.level, to.level) })];
    if (cell?.terrain === 'wall' || cell?.terrain === 'pillar') return false;
  }
  return true;
}

// Cover is measured per side of a cell: the neighbour on that side on the same
// level decides it. Tier 2 = full (wall, pillar), tier 1 = half (console), 0 = open.
const SIDE_OFFSETS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export function getSideCover(map, cell) {
  return Object.fromEntries(Object.entries(SIDE_OFFSETS).map(([side, [dx, dz]]) => [
    side,
    map.cells[cellKey({ x: cell.x + dx, z: cell.z + dz, level: cell.level })]?.cover || 0,
  ]));
}

// Summary of a cell's protection, independent of who is shooting: the strongest
// side decides the tier shown to the player. Used to preview a destination.
export function getCoverProfile(map, cell) {
  const sides = getSideCover(map, cell);
  const best = Math.max(...Object.values(sides));
  return { sides, tier: best, label: best === 2 ? 'full' : best === 1 ? 'half' : 'open' };
}

// Which side(s) of `target` face `shooter`. A diagonal attacker touches two sides.
function facingSides(target, shooter) {
  const dx = shooter.x - target.x;
  const dz = shooter.z - target.z;
  if (dx === 0 && dz === 0) return [];
  if (Math.abs(dx) > Math.abs(dz)) return [dx > 0 ? 'E' : 'W'];
  if (Math.abs(dz) > Math.abs(dx)) return [dz > 0 ? 'S' : 'N'];
  return [dx > 0 ? 'E' : 'W', dz > 0 ? 'S' : 'N'];
}

// Cover that `target` gets against a shot from `shooter`, and whether the shooter
// flanks it: the attacking side is open while the target has cover on another side.
// Diagonal attackers get the weaker of their two sides.
export function getCoverAgainst(map, target, shooter) {
  const sides = getSideCover(map, target);
  const facing = facingSides(target, shooter);
  if (facing.length === 0) return { cover: 0, flanked: false };
  const cover = Math.min(...facing.map((side) => sides[side]));
  const flanked = cover === 0 && Object.values(sides).some((tier) => tier > 0);
  return { cover, flanked };
}

// Fog sight is more forgiving than combat LOS: a cell counts as seen when any ray from
// the observer to the cell's centre or inset corners is clear. This keeps floor beside
// a box or wall visible instead of being hidden by a single rounded centre line.
const SIGHT_INSET = 0.45;
const SIGHT_OFFSETS = [
  [0, 0],
  [-SIGHT_INSET, -SIGHT_INSET], [SIGHT_INSET, -SIGHT_INSET],
  [-SIGHT_INSET, SIGHT_INSET], [SIGHT_INSET, SIGHT_INSET],
];

function hasSightRay(map, from, targetX, targetZ, level) {
  const dx = targetX - from.x;
  const dz = targetZ - from.z;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) * 4);
  for (let step = 1; step < steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(from.x + dx * ratio);
    const z = Math.round(from.z + dz * ratio);
    const cell = map.cells[cellKey({ x, z, level })];
    if (cell?.terrain === 'wall' || cell?.terrain === 'pillar') return false;
  }
  return true;
}

function canSeeCell(map, observer, cell) {
  const level = Math.min(observer.level, cell.level);
  return SIGHT_OFFSETS.some(([ox, oz]) => hasSightRay(map, observer, cell.x + ox, cell.z + oz, level));
}

const SOLID_TERRAIN = new Set(['wall', 'pillar', 'console']);
const SIGHT_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function getVisibleCells(map, units) {
  const observers = units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const visible = new Set();
  for (const cell of Object.values(map.cells)) {
    if (observers.some((unit) => (
      Math.hypot(unit.x - cell.x, unit.z - cell.z) <= FOG_REVEAL_RANGE
      && canSeeCell(map, unit, cell)
    ))) visible.add(cellKey(cell));
  }
  // Floor between a seen cover box and the solid cell behind it is also seen. The wall
  // behind a box is itself hidden by the box, so only the box must be visible.
  const COVER_BOXES = new Set(['pillar', 'console']);
  for (const cell of Object.values(map.cells)) {
    const key = cellKey(cell);
    if (visible.has(key) || !isPassable(cell)) continue;
    const behindBox = SIGHT_DIRECTIONS.some(([dx, dz]) => {
      const box = map.cells[cellKey({ x: cell.x + dx, z: cell.z + dz, level: cell.level })];
      const beyond = map.cells[cellKey({ x: cell.x - dx, z: cell.z - dz, level: cell.level })];
      return visible.has(cellKey(box ?? {})) && COVER_BOXES.has(box?.terrain) && SOLID_TERRAIN.has(beyond?.terrain);
    });
    if (behindBox) visible.add(key);
  }
  return visible;
}
