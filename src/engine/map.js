export const GRID_SIZES = [32, 40, 48];
export const VISION_RANGE = 10;
export const cellKey = ({ x, z, level = 0 }) => `${x},${z},${level}`;

const makeRandom = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

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
          cell.cover = random() > 0.45 ? 2 : 1;
          cell.terrain = cell.cover === 2 ? 'pillar' : 'console';
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

  for (let index = 0; index < Math.floor(size * size / 16); index += 1) {
    const x = 2 + Math.floor(random() * (size - 4));
    const z = 2 + Math.floor(random() * (size - 4));
    const cell = cells[cellKey({ x, z })];
    if (cell?.walkable && !cell.structure && cell.cover === 0 && (x + z) % 3 !== 0) {
      cell.cover = random() > 0.68 ? 2 : 1;
      cell.terrain = cell.cover === 2 ? 'pillar' : 'console';
    }
  }

  return { seed, size, cells, transitions, rooms };
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
    const neighbors = [
      { x: current.x + 1, z: current.z, level: current.level },
      { x: current.x - 1, z: current.z, level: current.level },
      { x: current.x, z: current.z + 1, level: current.level },
      { x: current.x, z: current.z - 1, level: current.level },
      ...(map.transitions[currentKey] || []),
    ];

    for (const next of neighbors) {
      const nextKey = cellKey(next);
      const cell = map.cells[nextKey];
      if (!cell?.walkable || blocked.has(nextKey) || distance.has(nextKey) || currentDistance >= maxSteps) continue;
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