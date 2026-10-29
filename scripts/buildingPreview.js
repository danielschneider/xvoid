// Prints ASCII floor plans of generated buildings, one block per floor, for judging layout
// without rendering. Usage: node scripts/buildingPreview.js [seed ...]
import { createBattlefield } from '../src/rules/grid/generate.ts';
import { cellKey } from '../src/rules/grid/cells.ts';

// Legend: # wall  + door  P pillar  C console  | partition  = rail  S stairs  . floor
const SYMBOLS = {
  wall: '#',
  door: '+',
  pillar: 'P',
  console: 'C',
  partition: '|',
  rail: '=',
  stairs: 'S',
  floor: '.',
};

function inRoom(room, cell) {
  return cell.x >= room.x && cell.x < room.x + room.w && cell.z >= room.z && cell.z < room.z + room.h;
}

function floorLines(map, room, level) {
  const lines = [];
  for (let z = room.z; z < room.z + room.h; z += 1) {
    let line = '';
    for (let x = room.x; x < room.x + room.w; x += 1) {
      const cell = map.cells[cellKey({ x, z, level })];
      line += cell ? (SYMBOLS[cell.terrain] ?? '?') : ' ';
    }
    lines.push(line);
  }
  return lines;
}

function topLevelOf(map, room) {
  let top = 0;
  for (const cell of Object.values(map.cells)) {
    if (inRoom(room, cell) && cell.level > top && cell.building?.id === room.id) top = cell.level;
  }
  return top;
}

function summarize(map, room, topLevel) {
  const cells = Object.values(map.cells).filter((cell) => inRoom(room, cell) && cell.building?.id === room.id);
  const doors = cells.filter((cell) => cell.level === 0 && cell.terrain === 'door').length;
  const stairs = [];
  for (let level = 0; level <= topLevel; level += 1) {
    stairs.push(cells.filter((cell) => cell.level === level && cell.terrain === 'stairs').length);
  }
  const partitions = cells.filter((cell) => cell.terrain === 'partition').length;
  return `  door cells (ground): ${doors}  stair cells per floor: [${stairs.join(', ')}]  partition cells: ${partitions}`;
}

function printSeed(seed) {
  const map = createBattlefield(seed);
  console.log(`\n=== seed ${seed}  size ${map.size}  buildings ${map.rooms.length} ===`);
  map.rooms.forEach((room, index) => {
    const topLevel = topLevelOf(map, room);
    console.log(`\nbuilding ${index}  origin (${room.x},${room.z})  ${room.w}x${room.h}  floors ${topLevel + 1}`);
    console.log(summarize(map, room, topLevel));
    for (let level = 0; level <= topLevel; level += 1) {
      console.log(`  floor ${level}:`);
      for (const line of floorLines(map, room, level)) console.log(`    ${line}`);
    }
  });
}

const seeds = process.argv.slice(2).map(Number).filter(Number.isFinite);
for (const seed of seeds.length ? seeds : [1, 2, 3]) printSeed(seed);
