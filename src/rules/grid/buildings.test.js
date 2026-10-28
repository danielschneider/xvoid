import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattlefield } from './generate.js';
import { cellKey, isPassable } from './cells.js';
import { getReachable } from '../movement/pathfinding.js';

const SEEDS = [1, 2, 3, 7, 42, 555, 9001, 123456];

function buildingCells(map, room) {
  return Object.values(map.cells).filter(
    (cell) =>
      cell.building?.id === room.id &&
      cell.x >= room.x &&
      cell.x < room.x + room.w &&
      cell.z >= room.z &&
      cell.z < room.z + room.h
  );
}

test('normal buildings have 2-wide doors and anchor buildings 3-wide, on ground floor', () => {
  for (const seed of SEEDS) {
    const map = createBattlefield(seed);
    for (const room of map.rooms) {
      const doors = buildingCells(map, room).filter((cell) => cell.level === 0 && cell.terrain === 'door');
      const sides = new Set(doors.map((door) => (door.z === room.z || door.z === room.z + room.h - 1 ? 'ns' : 'ew')));
      const expected = room.anchor ? 3 : 2;
      assert.ok(doors.length >= expected, `seed ${seed} building ${room.id}: door cells ${doors.length}`);
      assert.equal(
        doors.length % expected,
        0,
        `seed ${seed} building ${room.id}: doors come in ${expected}-cell openings`
      );
      assert.ok(sides.size >= 1);
    }
  }
});

test('every floor of every building is reachable from ground', () => {
  for (const seed of SEEDS) {
    const map = createBattlefield(seed);
    for (const room of map.rooms) {
      const entrance = buildingCells(map, room).find((cell) => cell.level === 0 && cell.terrain === 'door');
      assert.ok(entrance, `seed ${seed} building ${room.id} has a door`);
      const reachable = getReachable(map, { x: entrance.x, z: entrance.z, level: 0 }, new Set(), map.size * 8);
      for (let level = 0; level <= room.topLevel; level += 1) {
        const floor = buildingCells(map, room).filter((cell) => cell.level === level && isPassable(cell));
        assert.ok(floor.length > 0);
        const missing = floor.filter((cell) => !reachable.has(cellKey(cell)) && cellKey(cell) !== cellKey(entrance));
        assert.equal(
          missing.length,
          0,
          `seed ${seed} building ${room.id} floor ${level}: ${missing.length} unreachable`
        );
      }
    }
  }
});

test('every upper floor has exactly two stair access cells', () => {
  for (const seed of SEEDS) {
    const map = createBattlefield(seed);
    for (const room of map.rooms) {
      for (let level = 0; level <= room.topLevel; level += 1) {
        const stairs = buildingCells(map, room).filter((cell) => cell.level === level && cell.terrain === 'stairs');
        assert.equal(stairs.length, 2, `seed ${seed} building ${room.id} level ${level}`);
      }
    }
  }
});

test('stairs link adjacent floors in both directions', () => {
  for (const seed of SEEDS) {
    const map = createBattlefield(seed);
    for (const room of map.rooms) {
      const stairs = buildingCells(map, room).filter((cell) => cell.terrain === 'stairs');
      for (const stair of stairs) {
        const links = map.transitions[cellKey(stair)] || [];
        const expected = [stair.level - 1, stair.level + 1].filter((level) => level >= 0 && level <= room.topLevel);
        for (const level of expected) {
          assert.ok(
            links.some((link) => link.x === stair.x && link.z === stair.z && link.level === level),
            `seed ${seed} building ${room.id}: stair at ${cellKey(stair)} links to level ${level}`
          );
        }
      }
    }
  }
});

test('boxes and partitions never sit on door lanes or stairs', () => {
  for (const seed of SEEDS) {
    const map = createBattlefield(seed);
    for (const room of map.rooms) {
      const doors = buildingCells(map, room).filter((cell) => cell.level === 0 && cell.terrain === 'door');
      for (const door of doors) {
        // The inward lane cell is the one that is inside the footprint (structure) and not a wall.
        const inward = [
          { x: door.x, z: door.z + 1 },
          { x: door.x, z: door.z - 1 },
          { x: door.x + 1, z: door.z },
          { x: door.x - 1, z: door.z },
        ]
          .map((cell) => map.cells[cellKey({ ...cell, level: 0 })])
          .find((cell) => cell && cell.building?.id === room.id && cell.terrain !== 'door' && cell.terrain !== 'wall');
        assert.ok(inward, `seed ${seed} building ${room.id}: door has an inward cell`);
        assert.ok(isPassable(inward), `seed ${seed} building ${room.id}: lane open`);
      }
      for (const stair of buildingCells(map, room).filter((cell) => cell.terrain === 'stairs')) {
        assert.equal(stair.cover, 0, `seed ${seed}: stair has no cover`);
      }
    }
  }
});

test('rails are non-walkable but do not block sight terrain list', () => {
  const map = createBattlefield(42);
  const rails = Object.values(map.cells).filter((cell) => cell.terrain === 'rail');
  assert.ok(rails.length > 0);
  assert.ok(rails.every((rail) => !isPassable(rail)));
});
