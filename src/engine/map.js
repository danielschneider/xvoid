export const GRID_SIZES = [32, 40, 48];
export const VISION_RANGE = 10;
export const cellKey = ({ x, z, level = 0 }) => `${x},${z},${level}`;

// Terrain that physically blocks movement. Boxes (pillar/console) are rendered as
// solid cover objects, so they must never be walkable. Single source of truth for
// movement, spawning, and map-connectivity checks.
export const BLOCKING_TERRAIN = new Set(['wall', 'pillar', 'console']);
export const isPassable = (cell) => Boolean(cell && cell.walkable && !BLOCKING_TERRAIN.has(cell.terrain));

const makeRandom = (seed) => {
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

export function createBattlefield(seed = Date.now()) {
  const random = makeRandom(seed);
  const size = GRID_SIZES[Math.floor(random() * GRID_SIZES.length)];
  const middle = Math.floor(size / 2);
  const cells = {};
  const transitions = {};
  const rooms = [
    { x: 5, z: 4, w: 7, h: 7 },
    { x: size - 13, z: 4, w: 8, h: 7 },
    { x: 5, z: size - 12, w: 8, h: 7 },
    { x: size - 13, z: size - 12, w: 8, h: 7 },
  ];

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

  const interiorBoxCandidates = [];

  rooms.forEach((room, roomIndex) => {
    for (let z = room.z; z < room.z + room.h; z += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        const perimeter = x === room.x || x === room.x + room.w - 1 || z === room.z || z === room.z + room.h - 1;
        const door = (x === room.x + Math.floor(room.w / 2) && z === room.z)
          || (x === room.x && z === room.z + Math.floor(room.h / 2));
        const cell = cells[cellKey({ x, z })];
        cell.structure = true;
        if (perimeter && !door) {
          cell.terrain = 'wall';
          cell.walkable = false;
          cell.cover = 2;
        } else if (!perimeter && random() < 0.12) {
          interiorBoxCandidates.push(cell);
        }
      }
    }

    for (let z = room.z + 1; z < room.z + room.h - 1; z += 1) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
        const roof = { x, z, level: 1 };
        cells[cellKey(roof)] = { ...roof, terrain: 'platform', walkable: true, cover: 0, structure: true };
      }
    }

    const stair = { x: room.x + 1, z: room.z + 1, level: 0 };
    const upperStair = { ...stair, level: 1 };
    cells[cellKey(stair)].terrain = 'stairs';
    cells[cellKey(upperStair)].terrain = 'stairs';
    transitions[cellKey(stair)] = [upperStair];
    transitions[cellKey(upperStair)] = [stair];

    if (roomIndex === 0) {
      for (let z = room.z + 2; z < room.z + room.h - 2; z += 1) {
        for (let x = room.x + 2; x < room.x + room.w - 2; x += 1) {
          const control = { x, z, level: 2 };
          cells[cellKey(control)] = { ...control, terrain: 'platform', walkable: true, cover: 0, structure: true };
        }
      }
      const controlStair = { x: room.x + 2, z: room.z + 2, level: 1 };
      const controlDeck = { ...controlStair, level: 2 };
      cells[cellKey(controlStair)].terrain = 'stairs';
      cells[cellKey(controlDeck)].terrain = 'stairs';
      transitions[cellKey(controlStair)] = [...(transitions[cellKey(controlStair)] || []), controlDeck];
      transitions[cellKey(controlDeck)] = [controlStair];
    }
  });

  // Boxes are placed only after all structure (stairs, platforms) exists, so the
  // connectivity guard sees the real map and can never overwrite a stair.
  for (const cell of interiorBoxCandidates) {
    if (cell.terrain !== 'floor') continue;
    placeBox(cells, transitions, cell, random() > 0.45 ? 2 : 1);
  }

  for (let index = 0; index < Math.floor(size * size / 16); index += 1) {
    const x = 2 + Math.floor(random() * (size - 4));
    const z = 2 + Math.floor(random() * (size - 4));
    const cell = cells[cellKey({ x, z })];
    if (cell?.walkable && !cell.structure && cell.cover === 0 && (x + z) % 3 !== 0) {
      placeBox(cells, transitions, cell, random() > 0.68 ? 2 : 1);
    }
  }

  const objectiveTargets = [0.35, 0.5, 0.65].map((ratio) => ({ x: middle, z: Math.round(size * ratio) }));
  const objectiveCandidates = Object.values(cells).filter((cell) => (
    cell.level === 0 && cell.terrain === 'floor' && cell.walkable && !cell.structure
  ));
  const usedObjectiveCells = new Set();
  const objectives = objectiveTargets.map((target, index) => {
    const candidates = objectiveCandidates
      .filter((cell) => !usedObjectiveCells.has(cellKey(cell)))
      .sort((a, b) => (
        Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z)
      ));
    const cell = candidates[0];
    usedObjectiveCells.add(cellKey(cell));
    return { id: `control-${index + 1}`, x: cell.x, z: cell.z, level: 0 };
  });

  return { seed, size, cells, transitions, rooms, objectives };
}

export function getReachable(map, start, blocked = new Set(), maxSteps = 10) {
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
    paths.set(key, { steps, path, apCost: steps <= 5 ? 1 : 2 });
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

export function getVisibleCells(map, units) {
  const observers = units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const visible = new Set();
  for (const cell of Object.values(map.cells)) {
    if (observers.some((unit) => (
      Math.hypot(unit.x - cell.x, unit.z - cell.z) <= VISION_RANGE
      && hasLineOfSight(map, unit, cell)
    ))) visible.add(cellKey(cell));
  }
  return visible;
}