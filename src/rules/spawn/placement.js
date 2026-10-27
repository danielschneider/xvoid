import { cellKey, isPassable } from '../grid/cells.js';
import { getReachable } from '../movement/pathfinding.js';
import { hasLineOfSight } from '../sight/line.js';
import { assignEnemyGroups } from '../ai/alerts.js';
import { spawnDistance } from '../geometry.js';
import { AP_PER_TURN, ENEMY_SHOT_RANGE, VISION_RANGE } from '../constants.js';
import { ENEMY_TEMPLATES, PLAYER_TEMPLATES } from '../templates.js';
import { movementLimits } from '../movement/moveUnit.js';

export function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

// Player squad: all units within SQUAD_RADIUS of each other and mutually reachable.
const SQUAD_RADIUS = 2;
// Hard minimum distance between any enemy spawn and any player spawn, regardless of line of sight.
const MIN_ENEMY_SPAWN_DISTANCE = ENEMY_SHOT_RANGE;

function* squadClusters(map, candidates, random) {
  for (const center of shuffle(candidates, random)) {
    const near = shuffle(
      candidates.filter((cell) => cell !== center && spawnDistance(cell, center) <= SQUAD_RADIUS),
      random
    );
    if (near.length < 2) continue;
    const reachable = new Set(getReachable(map, center, new Set(), map.size * 2).keys());
    reachable.add(cellKey(center));
    const connected = near.filter((cell) => reachable.has(cellKey(cell)));
    for (let first = 0; first < connected.length - 1; first += 1) {
      for (let second = first + 1; second < connected.length; second += 1) {
        if (spawnDistance(connected[first], connected[second]) > SQUAD_RADIUS) continue;
        yield { squad: [center, connected[first], connected[second]], reachable };
      }
    }
  }
}

// Enemies spread across the map in groups of one or two. Leaders are chosen by
// farthest-point sampling: each new leader is one of the cells furthest from all
// enemies placed so far, which covers every quadrant. A random pick among the
// top candidates keeps layouts varied per seed. Only partners sit close together.
const FARTHEST_POOL = 6;

function placeEnemyGroups(candidates, count, random) {
  const placed = [];
  const distanceToPlaced = (cell) =>
    placed.length === 0 ? Infinity : Math.min(...placed.map((other) => spawnDistance(other, cell)));
  const pickLeader = () => {
    const ranked = shuffle(candidates, random)
      .filter((cell) => !placed.some((unit) => spawnDistance(unit, cell) === 0))
      .map((cell) => ({ cell, distance: distanceToPlaced(cell) }))
      .sort((a, b) => b.distance - a.distance);
    if (ranked.length === 0) return null;
    return ranked[Math.floor(random() * Math.min(FARTHEST_POOL, ranked.length))].cell;
  };
  while (placed.length < count) {
    const leader = pickLeader();
    if (!leader) return null;
    placed.push(leader);
    if (placed.length < count && random() < 0.5) {
      const partner = shuffle(
        candidates.filter((other) => spawnDistance(other, leader) >= 1 && spawnDistance(other, leader) <= 2),
        random
      ).find((other) => !placed.some((unit) => spawnDistance(unit, other) === 0));
      if (partner) placed.push(partner);
    }
  }
  return placed.slice(0, count);
}

export function createStartingUnits(map, random) {
  const middle = Math.floor(map.size / 2);
  const openGround = Object.values(map.cells).filter((cell) => isPassable(cell) && cell.level === 0 && !cell.structure);
  const enemyCount = map.size >= 48 ? 20 : map.size >= 40 ? 10 : 5;
  const safeCells = openGround.filter(
    (cell) =>
      cell.x > VISION_RANGE &&
      cell.z > VISION_RANGE &&
      cell.x < map.size - VISION_RANGE - 1 &&
      cell.z < map.size - VISION_RANGE - 1
  );
  // The player squad always lands on the map border (the landing point).
  const borderCells = openGround.filter(
    (cell) => cell.x === 0 || cell.z === 0 || cell.x === map.size - 1 || cell.z === map.size - 1
  );
  const quadrants = [
    (cell) => cell.x < middle && cell.z < middle,
    (cell) => cell.x >= middle && cell.z < middle,
    (cell) => cell.x < middle && cell.z >= middle,
    (cell) => cell.x >= middle && cell.z >= middle,
  ];
  let playerSpawns = null;
  let enemySpawns = null;

  // Strict pass: squad lands on a border cell of a random quadrant and no enemy is in its initial vision.
  // Relaxed pass (fallback): squad anywhere on the border, enemies only avoid the squad's cells.
  const passes = [
    ...shuffle(quadrants, random).map((inQuadrant) => ({ area: borderCells.filter(inQuadrant), strict: true })),
    { area: borderCells, strict: false },
  ];
  for (const { area, strict } of passes) {
    for (const cluster of squadClusters(map, area, random)) {
      if (enemySpawns) break;
      const enemyCandidates = safeCells.filter(
        (cell) =>
          cluster.reachable.has(cellKey(cell)) &&
          cluster.squad.every((player) => spawnDistance(player, cell) > MIN_ENEMY_SPAWN_DISTANCE) &&
          (!strict ||
            cluster.squad.every(
              (player) => spawnDistance(cell, player) > VISION_RANGE || !hasLineOfSight(map, player, cell)
            ))
      );
      const placed = placeEnemyGroups(enemyCandidates, enemyCount, random);
      if (placed) {
        playerSpawns = cluster.squad;
        enemySpawns = placed;
      }
    }
    if (enemySpawns) break;
  }

  if (
    !playerSpawns ||
    !enemySpawns ||
    playerSpawns.length < PLAYER_TEMPLATES.length ||
    enemySpawns.length < enemyCount
  ) {
    throw new Error(`Unable to place a fair ${map.size}x${map.size} starting force`);
  }
  const randomizedRoles = shuffle(ENEMY_TEMPLATES, random);
  const players = PLAYER_TEMPLATES.map((unit, index) => ({
    ...unit,
    x: playerSpawns[index].x,
    z: playerSpawns[index].z,
    level: 0,
  }));
  const groupIds = assignEnemyGroups(enemySpawns);
  const enemies = enemySpawns.map((spawn, index) => {
    const template = randomizedRoles[index % randomizedRoles.length];
    return {
      ...template,
      id: `raider-${String(index + 1).padStart(2, '0')}`,
      team: 'alien',
      aiRole: template.role,
      groupId: groupIds[index],
      x: spawn.x,
      z: spawn.z,
      level: 0,
      postX: spawn.x,
      postZ: spawn.z,
      maxHp: template.hp,
      ap: AP_PER_TURN,
    };
  });
  return [...players, ...enemies];
}

// Squad placement can box a unit in with its own squadmates. Select the first
// player unit that can actually move so that taps on the map produce a route.
export function initialSelection(map, units) {
  const canMove = (unit) => {
    const blocked = new Set(units.filter((other) => other.id !== unit.id && other.hp > 0).map(cellKey));
    const { maxSteps, cheapSteps } = movementLimits(unit);
    return getReachable(map, unit, blocked, maxSteps, cheapSteps).size > 0;
  };
  const players = units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  return (players.find(canMove) ?? players[0]).id;
}
