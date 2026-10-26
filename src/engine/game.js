import { cellKey, createBattlefield, getCoverAgainst, getReachable, getVisibleCells, hasLineOfSight, isPassable, makeRandom, VISION_RANGE } from './map.js';
import {
  AP_ACTION_COST, AP_PER_TURN, CRIT_CHANCE, CRIT_MULTIPLIER, COVER_VALUE, DEFAULT_MOVE_RANGE, ENEMY_COVER_FACTOR,
  ENEMY_MOVE_STEPS, ENEMY_SHOT_RANGE, GROUP_RANGE, OVERWATCH_RANGE, SCOUT_RETREAT_RANGE, SHOT_RANGE,
  WANDER_CHANCE, WANDER_RADIUS, WANDER_STEPS,
} from '../rules/constants.js';
import { ENEMY_TEMPLATES, PLAYER_TEMPLATES } from '../rules/templates.js';

export {
  SHOT_RANGE, ENEMY_SHOT_RANGE, OVERWATCH_RANGE, ENEMY_COVER_FACTOR, COVER_VALUE, CRIT_CHANCE, CRIT_MULTIPLIER,
};

// Step limits for a unit's move. With 1 AP left only the cheap (1 AP) half is reachable.
export function movementLimits(unit) {
  const moveRange = unit.moveRange ?? DEFAULT_MOVE_RANGE;
  const cheapSteps = Math.ceil(moveRange / 2);
  return { maxSteps: unit.ap === 1 ? cheapSteps : moveRange, cheapSteps };
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

const spawnDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Enemies within GROUP_RANGE of each other (chained) form one group. A group is
// alerted once any member is visible to the squad; only alerted groups hunt or shoot.
// Unalerted enemies drift around their post: at most WANDER_STEPS per move, never
// further than WANDER_RADIUS from the post.

function assignEnemyGroups(cells) {
  const groupIds = cells.map(() => -1);
  let nextGroup = 0;
  cells.forEach((_, start) => {
    if (groupIds[start] >= 0) return;
    const stack = [start];
    groupIds[start] = nextGroup;
    while (stack.length > 0) {
      const current = stack.pop();
      cells.forEach((other, index) => {
        if (groupIds[index] < 0 && spawnDistance(cells[current], other) <= GROUP_RANGE) {
          groupIds[index] = nextGroup;
          stack.push(index);
        }
      });
    }
    nextGroup += 1;
  });
  return groupIds;
}

// Player squad: all units within SQUAD_RADIUS of each other and mutually reachable.
const SQUAD_RADIUS = 2;
// Hard minimum distance between any enemy spawn and any player spawn, regardless of line of sight.
const MIN_ENEMY_SPAWN_DISTANCE = ENEMY_SHOT_RANGE;

function* squadClusters(map, candidates, random) {
  for (const center of shuffle(candidates, random)) {
    const near = shuffle(
      candidates.filter((cell) => cell !== center && spawnDistance(cell, center) <= SQUAD_RADIUS),
      random,
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
  const distanceToPlaced = (cell) => (
    placed.length === 0 ? Infinity : Math.min(...placed.map((other) => spawnDistance(other, cell)))
  );
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
        random,
      ).find((other) => !placed.some((unit) => spawnDistance(unit, other) === 0));
      if (partner) placed.push(partner);
    }
  }
  return placed.slice(0, count);
}

function createStartingUnits(map, seed) {
  const random = makeRandom(seed ^ 0x9e3779b9);
  const middle = Math.floor(map.size / 2);
  const openGround = Object.values(map.cells).filter((cell) => (
    isPassable(cell) && cell.level === 0 && !cell.structure
  ));
  const enemyCount = map.size >= 48 ? 20 : map.size >= 40 ? 10 : 5;
  const safeCells = openGround.filter((cell) => (
    cell.x > VISION_RANGE && cell.z > VISION_RANGE
    && cell.x < map.size - VISION_RANGE - 1 && cell.z < map.size - VISION_RANGE - 1
  ));
  // The player squad always lands on the map border (the landing point).
  const borderCells = openGround.filter((cell) => (
    cell.x === 0 || cell.z === 0 || cell.x === map.size - 1 || cell.z === map.size - 1
  ));
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
      const enemyCandidates = safeCells.filter((cell) => (
        cluster.reachable.has(cellKey(cell))
        && cluster.squad.every((player) => spawnDistance(player, cell) > MIN_ENEMY_SPAWN_DISTANCE)
        && (!strict || cluster.squad.every((player) => (
          spawnDistance(cell, player) > VISION_RANGE || !hasLineOfSight(map, player, cell)
        )))
      ));
      const placed = placeEnemyGroups(enemyCandidates, enemyCount, random);
      if (placed) {
        playerSpawns = cluster.squad;
        enemySpawns = placed;
      }
    }
    if (enemySpawns) break;
  }

  if (!playerSpawns || !enemySpawns || playerSpawns.length < PLAYER_TEMPLATES.length || enemySpawns.length < enemyCount) {
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
function initialSelection(map, units) {
  const canMove = (unit) => {
    const blocked = new Set(units.filter((other) => other.id !== unit.id && other.hp > 0).map(cellKey));
    const { maxSteps, cheapSteps } = movementLimits(unit);
    return getReachable(map, unit, blocked, maxSteps, cheapSteps).size > 0;
  };
  const players = units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  return (players.find(canMove) ?? players[0]).id;
}

export function createInitialState(seed = 20261024, generation = 0) {
  const map = createBattlefield(seed);
  const units = createStartingUnits(map, seed);
  return {
    // Increments on every level reset. Views key their per-unit components on it
    // so that a reset remounts them instead of reusing stale visual state.
    generation,
    map,
    units,
    selectedId: initialSelection(map, units),
    targetId: null,
    moveMode: true,
    shootMode: false,
    enemyTurnOrder: [],
    enemyTurnIndex: 0,
    // Enemy group ids that the squad has revealed. Alerted groups stay alerted.
    alertedGroups: [],
    movement: null,
    turn: 1,
    phase: 'player',
    showUpper: true,
    logs: [{ id: 1, text: 'Einsatz bereit. Halte die Position.', kind: 'system' }],
    lastShot: null,
  };
}

const addLog = (state, text, kind = 'system') => [
  { id: (state.logs[0]?.id || 0) + 1, text, kind },
  ...state.logs,
].slice(0, 5);

const facingToward = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

function selectNextReadyPlayer(state) {
  if (state.phase !== 'player') return state;
  const current = state.units.find((unit) => unit.id === state.selectedId);
  if (!current || current.team !== 'player' || current.ap > 0) return state;
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const currentIndex = players.findIndex((unit) => unit.id === current.id);
  const next = [...players.slice(currentIndex + 1), ...players.slice(0, currentIndex)]
    .find((unit) => unit.ap > 0);
  return next ? { ...state, selectedId: next.id, targetId: null, moveMode: true, shootMode: false } : state;
}

function moveUnit(state, destination) {
  const unit = state.units.find((entry) => entry.id === state.selectedId);
  if (!unit || unit.team !== 'player' || unit.ap < AP_ACTION_COST) return state;
  const occupied = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const { maxSteps, cheapSteps } = movementLimits(unit);
  const pathData = getReachable(state.map, unit, occupied, maxSteps, cheapSteps).get(cellKey(destination));
  if (!pathData || pathData.apCost > unit.ap) return state;
  const last = pathData.path[pathData.path.length - 1];
  const previous = pathData.path.length > 1 ? pathData.path[pathData.path.length - 2] : unit;
  const facing = facingToward(previous, last);
  return {
    ...state,
    movement: { id: Date.now(), unitId: unit.id, path: [unit, ...pathData.path], step: 0 },
    units: state.units.map((entry) => entry.id === unit.id
      ? { ...entry, x: last.x, z: last.z, level: last.level, ap: entry.ap - pathData.apCost, facing, status: null }
      : entry),
    targetId: null,
    logs: addLog(state, `${unit.name} rückt ${pathData.steps} Felder vor.`, 'move'),
  };
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function computeDistanceModifier(distance) {
  return (5 - distance) * 0.1;
}

// Cover from the side the shot arrives at. A flanking shot gets no cover.
export function computeCoverFor(state, shooter, target) {
  return getCoverAgainst(state.map, target, shooter);
}

// Living enemies that currently flank `target`: they have a clear shot within range
// and arrive from a side without cover while the target is covered elsewhere.
export function getFlankedBy(state, target) {
  if (target.hp <= 0) return [];
  return state.units.filter((unit) => (
    unit.team !== target.team && unit.hp > 0
    && Math.hypot(unit.x - target.x, unit.z - target.z) <= SHOT_RANGE
    && hasLineOfSight(state.map, unit, target)
    && computeCoverFor(state, unit, target).flanked
  ));
}

export function computeHitChance(state, shooter, target, enemyShot = false) {
  const { cover: tier } = computeCoverFor(state, shooter, target);
  const cover = COVER_VALUE[tier];
  const distance = Math.hypot(shooter.x - target.x, shooter.z - target.z);
  const distanceModifier = computeDistanceModifier(distance);
  if (enemyShot) return clamp(0.52 - cover * ENEMY_COVER_FACTOR + distanceModifier, 0.05, 0.95);
  const elevationBonus = shooter.level > target.level ? 0.15 : 0;
  return clamp(0.7 + elevationBonus - cover + distanceModifier, 0.05, 0.95);
}

// Crit chance applies only to player shots; enemy shots never crit.
export function computeCritChance(enemyShot = false) {
  if (enemyShot) return 0;
  return CRIT_CHANCE;
}

function fireAt(state, targetId, shooterId = state.selectedId, enemyShot = false, reaction = false, random = Math.random) {
  const shooter = state.units.find((unit) => unit.id === shooterId);
  const target = state.units.find((unit) => unit.id === targetId);
  if (!shooter || !target || shooter.team === target.team || (!reaction && shooter.ap < AP_ACTION_COST) || target.hp <= 0) return state;
  const visible = hasLineOfSight(state.map, shooter, target);
  if (!visible) {
    return { ...state, targetId, logs: addLog(state, 'Schusslinie blockiert.', 'combat') };
  }
  if (Math.hypot(shooter.x - target.x, shooter.z - target.z) > SHOT_RANGE) {
    return { ...state, targetId, logs: addLog(state, 'Ziel außer Reichweite.', 'combat') };
  }
  const hitChance = computeHitChance(state, shooter, target, enemyShot);
  const hit = random() < hitChance;
  const crit = hit && random() < computeCritChance(enemyShot);
  const baseDamage = enemyShot
    ? 1 + Math.floor(random() * 2)
    : 2 + Math.floor(random() * 3) + (shooter.power ?? 0);
  const damage = hit ? (crit ? baseDamage * CRIT_MULTIPLIER : baseDamage) : 0;
  const remainingDamage = Math.max(0, damage - target.shield);
  const nextUnits = state.units.map((unit) => {
    if (unit.id === shooter.id) return { ...unit, ap: reaction ? unit.ap : unit.ap - AP_ACTION_COST, facing: facingToward(shooter, target) };
    if (unit.id === target.id && hit) {
      const shieldDamage = Math.min(unit.shield, damage);
      return { ...unit, shield: unit.shield - shieldDamage, hp: Math.max(0, unit.hp - remainingDamage) };
    }
    return unit;
  });
  return {
    ...state,
    units: nextUnits,
    targetId: enemyShot ? null : targetId,
    lastShot: { from: shooter, to: target, hit, crit, damage, enemyShot, id: Date.now() },
    logs: addLog(state, (reaction ? 'Overwatch: ' : '') + (hit
      ? crit
        ? `${shooter.name} landet einen KRITISCHEN Treffer auf ${target.name} für ${damage} Schaden.`
        : `${shooter.name} trifft ${target.name} für ${damage} Schaden.`
      : `${shooter.name} verfehlt ${target.name}.`), hit ? 'hit' : 'combat'),
  };
}

function resolveOverwatch(state, enemyId) {
  const enemy = state.units.find((unit) => unit.id === enemyId);
  if (!enemy || enemy.hp <= 0) return state;
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  if (!getVisibleCells(state.map, players).has(cellKey(enemy))) return state;
  const distanceToEnemy = (unit) => Math.hypot(unit.x - enemy.x, unit.z - enemy.z);
  const watcher = players
    .filter((unit) => unit.status === 'overwatch'
      && distanceToEnemy(unit) <= OVERWATCH_RANGE
      && hasLineOfSight(state.map, unit, enemy))
    .sort((a, b) => distanceToEnemy(a) - distanceToEnemy(b))[0];
  if (!watcher) return state;
  const shot = fireAt(state, enemy.id, watcher.id, false, true);
  return {
    ...shot,
    units: shot.units.map((unit) => (unit.id === watcher.id ? { ...unit, status: null } : unit)),
  };
}

function useAbility(state) {
  const unit = state.units.find((entry) => entry.id === state.selectedId);
  if (!unit || unit.ap < AP_ACTION_COST || unit.team !== 'player') return state;
  return {
    ...state,
    units: state.units.map((entry) => entry.id === unit.id
      ? { ...entry, ap: entry.ap - AP_ACTION_COST, status: 'overwatch' }
      : entry),
    logs: addLog(state, `${unit.name}: Overwatch.`, 'system'),
  };
}

function endTurn(stateIn) {
  if (stateIn.phase !== 'player' || stateIn.movement) return stateIn;
  const state = refreshAlerts(stateIn);
  const enemyTurnOrder = state.units.filter((unit) => unit.team === 'alien' && unit.hp > 0).map((unit) => unit.id);
  return {
    ...state,
    phase: 'enemy',
    enemyTurnOrder,
    enemyTurnIndex: 0,
    targetId: null,
    lastShot: null,
    logs: addLog(state, 'Feindzug beginnt.', 'combat'),
  };
}

// Marks every enemy group that has a member inside the squad's vision as alerted.
function refreshAlerts(state) {
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const visibleCells = getVisibleCells(state.map, players);
  const alerted = new Set(state.alertedGroups ?? []);
  for (const unit of state.units) {
    if (unit.team === 'alien' && unit.hp > 0 && visibleCells.has(cellKey(unit))) alerted.add(unit.groupId);
  }
  return { ...state, alertedGroups: [...alerted] };
}

function moveEnemy(state, enemy, destination, logText) {
  const last = destination.path[destination.path.length - 1];
  const previous = destination.path.length > 1 ? destination.path[destination.path.length - 2] : enemy;
  const facing = facingToward(previous, last);
  return {
    ...state,
    movement: { id: Date.now(), unitId: enemy.id, path: [enemy, ...destination.path], step: 0 },
    units: state.units.map((unit) => unit.id === enemy.id
      ? { ...unit, x: last.x, z: last.z, level: last.level, ap: unit.ap - AP_ACTION_COST, facing }
      : unit),
    enemyTurnIndex: state.enemyTurnIndex + 1,
    logs: addLog(state, logText, 'move'),
  };
}

// Unalerted enemy: drifts randomly around its post without knowing where the squad is.
function wanderEnemy(state, enemy, random = Math.random) {
  const skip = (text) => ({
    ...state,
    enemyTurnIndex: state.enemyTurnIndex + 1,
    logs: text ? addLog(state, text, 'combat') : state.logs,
  });
  if (enemy.ap < AP_ACTION_COST || random() > WANDER_CHANCE) return skip(null);
  const blocked = new Set(state.units.filter((unit) => unit.id !== enemy.id && unit.hp > 0).map(cellKey));
  const options = [...getReachable(state.map, enemy, blocked, WANDER_STEPS).values()]
    .map((path) => ({ ...path, cell: path.path[path.path.length - 1] }))
    .filter(({ cell }) => Math.hypot(cell.x - enemy.postX, cell.z - enemy.postZ) <= WANDER_RADIUS);
  if (options.length === 0) return skip(null);
  const destination = options[Math.floor(random() * options.length)];
  return moveEnemy(state, enemy, destination, `${enemy.name} patrouilliert.`);
}

function enemyStep(stateIn) {
  const state = refreshAlerts(stateIn);
  if (state.phase !== 'enemy' || state.enemyTurnIndex >= state.enemyTurnOrder.length) return state;
  const enemy = state.units.find((unit) => unit.id === state.enemyTurnOrder[state.enemyTurnIndex] && unit.hp > 0);
  if (!enemy) return { ...state, enemyTurnIndex: state.enemyTurnIndex + 1 };

  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const target = [...players].sort((a, b) => (
    Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z)
  ))[0];
  if (!target) return { ...state, enemyTurnIndex: state.enemyTurnIndex + 1 };

  if (!state.alertedGroups.includes(enemy.groupId)) return wanderEnemy(state, enemy);

  const distance = Math.hypot(target.x - enemy.x, target.z - enemy.z);
  const visibleCells = getVisibleCells(state.map, players);
  const revealedTargets = visibleCells.has(cellKey(enemy))
    ? players.filter((unit) => Math.hypot(unit.x - enemy.x, unit.z - enemy.z) <= ENEMY_SHOT_RANGE && hasLineOfSight(state.map, enemy, unit))
      .sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z))
    : [];
  const role = enemy.aiRole || enemy.role || 'raider';
  const retreating = role === 'scout' && enemy.hp <= Math.ceil(enemy.maxHp / 2) && distance <= SCOUT_RETREAT_RANGE;

  if (!retreating && enemy.ap > 0 && revealedTargets.length > 0) {
    const targetToShoot = role === 'raider'
      ? [...revealedTargets].sort((a, b) => {
        const coverA = computeCoverFor(state, enemy, a).cover;
        const coverB = computeCoverFor(state, enemy, b).cover;
        return (Math.hypot(a.x - enemy.x, a.z - enemy.z) + coverA * 2)
          - (Math.hypot(b.x - enemy.x, b.z - enemy.z) + coverB * 2);
      })[0]
      : revealedTargets[0];
    const shot = fireAt(state, targetToShoot.id, enemy.id, true);
    return { ...shot, enemyTurnIndex: state.enemyTurnIndex + 1 };
  }

  const blocked = new Set(state.units.filter((unit) => unit.id !== enemy.id && unit.hp > 0).map(cellKey));
  const maxSteps = ENEMY_MOVE_STEPS[role] ?? ENEMY_MOVE_STEPS.raider;
  const paths = getReachable(state.map, enemy, blocked, maxSteps);
  let destinations = [...paths.entries()]
    .map(([key, path]) => ({ cell: state.map.cells[key], ...path }))
    .filter(({ cell }) => {
      const nextDistance = Math.hypot(target.x - cell.x, target.z - cell.z);
      return retreating ? nextDistance > distance : nextDistance < distance;
    });

  if (role === 'guard' && !retreating) {
    const postDistance = Math.hypot(enemy.x - enemy.postX, enemy.z - enemy.postZ);
    if (postDistance <= 1) destinations = [];
    else destinations = destinations.filter(({ cell }) => (
      Math.hypot(cell.x - enemy.postX, cell.z - enemy.postZ) < postDistance
    ));
  }

  if (role === 'stalker' || retreating) {
    const concealed = destinations.filter(({ cell }) => !visibleCells.has(cellKey(cell)));
    if (concealed.length > 0) destinations = concealed;
  }

  destinations.sort((a, b) => {
    const distanceA = Math.hypot(target.x - a.cell.x, target.z - a.cell.z);
    const distanceB = Math.hypot(target.x - b.cell.x, target.z - b.cell.z);
    if (retreating) return distanceB - distanceA || b.steps - a.steps;
    if (role === 'guard') {
      return Math.hypot(a.cell.x - enemy.postX, a.cell.z - enemy.postZ)
        - Math.hypot(b.cell.x - enemy.postX, b.cell.z - enemy.postZ);
    }
    return distanceA - distanceB || b.steps - a.steps;
  });
  const destination = destinations[0];

  if (!destination || enemy.ap < AP_ACTION_COST) {
    const decision = role === 'guard' ? 'hält den Posten' : role === 'stalker' ? 'bleibt verborgen' : 'hält die Position';
    return {
      ...state,
      enemyTurnIndex: state.enemyTurnIndex + 1,
      logs: addLog(state, `${enemy.name} ${decision}.`, 'combat'),
    };
  }
  return moveEnemy(
    state,
    enemy,
    destination,
    `${enemy.name} ${retreating ? 'zieht sich zurück' : role === 'guard' ? 'kehrt zum Posten zurück' : 'rückt vor'}.`,
  );
}

function finishEnemyTurn(state) {
  if (state.phase !== 'enemy' || state.enemyTurnIndex < state.enemyTurnOrder.length) return state;
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const units = state.units.map((unit) => ({ ...unit, ap: unit.hp > 0 ? AP_PER_TURN : 0, status: null }));
  // Every new round starts with the first living player unit in roster order.
  const selectedId = players[0]?.id || null;
  const turn = state.turn + 1;
  return {
    ...state,
    units,
    turn,
    phase: 'player',
    selectedId,
    targetId: null,
    // Every new round starts the selected player unit in movement mode.
    moveMode: true,
    shootMode: false,
    enemyTurnOrder: [],
    enemyTurnIndex: 0,
    logs: addLog(state, `Runde ${turn}: Zug deiner Einheit.`, 'system'),
  };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'select':
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, selectedId: action.id, targetId: null, shootMode: false, moveMode: true };
    case 'target':
      if (state.phase !== 'player' || state.movement) return state;
      // Selecting an enemy leaves move mode and enters shoot mode.
      return {
        ...state,
        targetId: action.id,
        moveMode: false,
        shootMode: true,
        units: state.units.map((unit) => unit.id === state.selectedId
          ? { ...unit, facing: facingToward(unit, state.units.find((target) => target.id === action.id) || unit) }
          : unit),
      };
    case 'toggle-move-mode':
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, moveMode: !state.moveMode, shootMode: false, targetId: null };
    case 'move-mode':
      // Tapping a non-target leaves shoot mode and returns to move mode.
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, moveMode: true, shootMode: false, targetId: null };
    case 'move':
      if (state.phase !== 'player' || state.movement) return state;
      return selectNextReadyPlayer(refreshAlerts(moveUnit(state, action.destination)));
    case 'attack':
      if (state.phase !== 'player' || state.movement) return state;
      // Selection moves on only after the shot has been shown (see finish-shot).
      return { ...refreshAlerts(fireAt(state, action.id)), shootMode: false };
    case 'ability':
      if (state.phase !== 'player' || state.movement) return state;
      return selectNextReadyPlayer(useAbility(state));
    case 'end-turn':
      return endTurn(state);
    case 'advance-movement':
      if (!state.movement || state.movement.id !== action.id) return state;
      if (state.movement.step >= state.movement.path.length - 1) return state;
      return { ...state, movement: { ...state.movement, step: state.movement.step + 1 } };
    case 'complete-movement': {
      if (state.movement?.id !== action.id) return state;
      const mover = state.units.find((unit) => unit.id === state.movement.unitId);
      const cleared = { ...state, movement: null };
      return mover?.team === 'alien' && state.phase === 'enemy'
        ? resolveOverwatch(refreshAlerts(cleared), mover.id)
        : cleared;
    }
    case 'enemy-step':
      return enemyStep(state);
    case 'finish-enemy-turn':
      return finishEnemyTurn(state);
    case 'regenerate':
      return createInitialState(action.seed, state.generation + 1);
    case 'toggle-levels':
      return { ...state, showUpper: !state.showUpper };
    case 'clear-shot':
      return { ...state, lastShot: null };
    case 'finish-shot': {
      // Runs after the shot/death animation: clear the shot and hand over to the next ready player unit.
      if (!state.lastShot || state.lastShot.id !== action.id) return state;
      const cleared = { ...state, lastShot: null };
      return state.lastShot.enemyShot ? cleared : selectNextReadyPlayer(cleared);
    }
    default:
      return state;
  }
}

export { getReachable, cellKey, hasLineOfSight };