import { cellKey, createBattlefield, getReachable, getVisibleCells, hasLineOfSight, isPassable, VISION_RANGE } from './map.js';

export const SHOT_RANGE = 10;
export const ENEMY_SHOT_RANGE = SHOT_RANGE;
export const OVERWATCH_RANGE = 8;
export const HUNKER_COVER_BONUS = 0.15;
export const FLANK_ANGLE = Math.PI / 3;
export const FLANK_COVER_BYPASS = 0.5;
export const ENEMY_COVER_FACTOR = 0.5;
export const CRIT_CHANCE = 0.15;
export const CRIT_MULTIPLIER = 2;

const playerTemplates = [
  { id: 'vanguard', name: 'Vanguard', className: 'BREACHER', team: 'player', hp: 6, maxHp: 6, shield: 2, ap: 2, color: '#62e6c4' },
  { id: 'spectre', name: 'Spectre', className: 'RECON', team: 'player', hp: 5, maxHp: 5, shield: 1, ap: 2, color: '#87b5ff' },
  { id: 'medic', name: 'Medic', className: 'FIELD MEDIC', team: 'player', hp: 5, maxHp: 5, shield: 2, ap: 2, color: '#f0d77e' },
];

const enemyTemplates = [
  { role: 'raider', name: 'Void Raider', className: 'RAIDER', hp: 5, shield: 0, color: '#ff6f66' },
  { role: 'stalker', name: 'Void Stalker', className: 'STALKER', hp: 6, shield: 1, color: '#d28cff' },
  { role: 'scout', name: 'Void Scout', className: 'SCOUT', hp: 4, shield: 0, color: '#ff9b70' },
  { role: 'guard', name: 'Void Guard', className: 'GUARD', hp: 7, shield: 2, color: '#d47682' },
];

function makeRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
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

// Player squad: all units within SQUAD_RADIUS of each other and mutually reachable.
const SQUAD_RADIUS = 2;

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

// Enemies spread across the map in groups of one or two. Every unit keeps at
// least `spacing` distance from every unit of every other group; only the two
// members of one group sit close together.
function placeEnemyGroups(candidates, count, random, spacing) {
  const placed = [];
  const isFree = (cell, ignore = null) => !placed.some((other) => (
    other !== ignore && spawnDistance(other, cell) < spacing
  ));
  for (const leader of shuffle(candidates, random)) {
    if (placed.length >= count) break;
    if (!isFree(leader)) continue;
    placed.push(leader);
    if (placed.length < count && random() < 0.5) {
      const partner = shuffle(
        candidates.filter((other) => spawnDistance(other, leader) >= 1 && spawnDistance(other, leader) <= 2),
        random,
      ).find((other) => !placed.some((unit) => spawnDistance(unit, other) === 0) && isFree(other, leader));
      if (partner) placed.push(partner);
    }
  }
  return placed.length >= count ? placed.slice(0, count) : null;
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
        && !cluster.squad.some((player) => spawnDistance(player, cell) === 0)
        && (!strict || cluster.squad.every((player) => (
          spawnDistance(cell, player) > VISION_RANGE || !hasLineOfSight(map, player, cell)
        )))
      ));
      for (let spacing = Math.floor(map.size * 0.3); spacing >= 2 && !enemySpawns; spacing -= 1) {
        const placed = placeEnemyGroups(enemyCandidates, enemyCount, random, spacing);
        if (placed) {
          playerSpawns = cluster.squad;
          enemySpawns = placed;
        }
      }
    }
    if (enemySpawns) break;
  }

  if (!playerSpawns || !enemySpawns || playerSpawns.length < playerTemplates.length || enemySpawns.length < enemyCount) {
    throw new Error(`Unable to place a fair ${map.size}x${map.size} starting force`);
  }
  const randomizedRoles = shuffle(enemyTemplates, random);
  const players = playerTemplates.map((unit, index) => ({
    ...unit,
    x: playerSpawns[index].x,
    z: playerSpawns[index].z,
    level: 0,
  }));
  const enemies = enemySpawns.map((spawn, index) => {
    const template = randomizedRoles[index % randomizedRoles.length];
    return {
      ...template,
      id: `raider-${String(index + 1).padStart(2, '0')}`,
      team: 'alien',
      aiRole: template.role,
      x: spawn.x,
      z: spawn.z,
      level: 0,
      postX: spawn.x,
      postZ: spawn.z,
      maxHp: template.hp,
      ap: 2,
    };
  });
  return [...players, ...enemies];
}

// Squad placement can box a unit in with its own squadmates. Select the first
// player unit that can actually move so that taps on the map produce a route.
function initialSelection(map, units) {
  const canMove = (unit) => {
    const blocked = new Set(units.filter((other) => other.id !== unit.id && other.hp > 0).map(cellKey));
    return getReachable(map, unit, blocked, unit.ap === 1 ? 5 : 10).size > 0;
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
  if (!unit || unit.team !== 'player' || unit.ap < 1) return state;
  const occupied = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const pathData = getReachable(state.map, unit, occupied).get(cellKey(destination));
  if (!pathData || pathData.apCost > unit.ap) return state;
  const last = pathData.path[pathData.path.length - 1];
  const previous = pathData.path.length > 1 ? pathData.path[pathData.path.length - 2] : unit;
  const facing = facingToward(previous, last);
  return {
    ...state,
    movement: { id: Date.now(), unitId: unit.id, path: [unit, ...pathData.path], step: 0 },
    units: state.units.map((entry) => entry.id === unit.id
      ? { ...entry, x: last.x, z: last.z, level: last.level, ap: entry.ap - pathData.apCost, facing, status: null, coverFacing: null }
      : entry),
    targetId: null,
    logs: addLog(state, `${unit.name} rückt ${pathData.steps} Felder vor.`, 'move'),
  };
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function computeDistanceModifier(distance) {
  return (5 - distance) * 0.1;
}

// A shot is a flank when it arrives >= FLANK_ANGLE away from the side the defender's Deckung faces.
function isFlank(shooter, target) {
  if (target.coverFacing == null) return false;
  const attackAngle = Math.atan2(shooter.x - target.x, shooter.z - target.z);
  return Math.abs(normalizeAngle(attackAngle - target.coverFacing)) >= FLANK_ANGLE;
}

export function computeHitChance(state, shooter, target, enemyShot = false) {
  const targetCell = state.map.cells[cellKey(target)];
  const inDeckung = target.status === 'hunker';
  let cover = (targetCell?.cover === 2 ? 0.4 : targetCell?.cover === 1 ? 0.2 : 0)
    + (inDeckung ? HUNKER_COVER_BONUS : 0);
  if (inDeckung && isFlank(shooter, target)) cover *= 1 - FLANK_COVER_BYPASS;
  const distance = Math.hypot(shooter.x - target.x, shooter.z - target.z);
  const distanceModifier = computeDistanceModifier(distance);
  if (enemyShot) return clamp(0.52 - cover * ENEMY_COVER_FACTOR + distanceModifier, 0.05, 0.95);
  const elevationBonus = shooter.level > target.level ? 0.15 : 0;
  return clamp(0.7 + elevationBonus - cover + distanceModifier, 0.05, 0.95);
}

// Crit chance applies only to player shots; enemy shots never crit.
export function computeCritChance(state, shooter, target, enemyShot = false) {
  if (enemyShot) return 0;
  return CRIT_CHANCE;
}

function fireAt(state, targetId, shooterId = state.selectedId, enemyShot = false, reaction = false, random = Math.random) {
  const shooter = state.units.find((unit) => unit.id === shooterId);
  const target = state.units.find((unit) => unit.id === targetId);
  if (!shooter || !target || shooter.team === target.team || (!reaction && shooter.ap < 1) || target.hp <= 0) return state;
  const visible = hasLineOfSight(state.map, shooter, target);
  if (!visible) {
    return { ...state, targetId, logs: addLog(state, 'Schusslinie blockiert.', 'combat') };
  }
  if (Math.hypot(shooter.x - target.x, shooter.z - target.z) > SHOT_RANGE) {
    return { ...state, targetId, logs: addLog(state, 'Ziel außer Reichweite.', 'combat') };
  }
  const hitChance = computeHitChance(state, shooter, target, enemyShot);
  const hit = random() < hitChance;
  const crit = hit && random() < computeCritChance(state, shooter, target, enemyShot);
  const baseDamage = enemyShot ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * 3);
  const damage = hit ? (crit ? baseDamage * CRIT_MULTIPLIER : baseDamage) : 0;
  const remainingDamage = Math.max(0, damage - target.shield);
  const nextUnits = state.units.map((unit) => {
    if (unit.id === shooter.id) return { ...unit, ap: reaction ? unit.ap : unit.ap - 1, facing: facingToward(shooter, target) };
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

function useAbility(state, ability) {
  const unit = state.units.find((entry) => entry.id === state.selectedId);
  if (!unit || unit.ap < 1 || unit.team !== 'player') return state;
  const name = ability === 'overwatch' ? 'Overwatch' : 'Deckung suchen';
  // Deckung faces the nearest visible enemy; flanking is measured against this fixed side.
  let coverFacing = unit.facing;
  if (ability === 'hunker') {
    const players = state.units.filter((entry) => entry.team === 'player' && entry.hp > 0);
    const visible = getVisibleCells(state.map, players);
    const nearest = state.units
      .filter((entry) => entry.team === 'alien' && entry.hp > 0 && visible.has(cellKey(entry)))
      .sort((a, b) => Math.hypot(a.x - unit.x, a.z - unit.z) - Math.hypot(b.x - unit.x, b.z - unit.z))[0];
    if (nearest) coverFacing = facingToward(unit, nearest);
  }
  return {
    ...state,
    units: state.units.map((entry) => entry.id === unit.id
      ? { ...entry, ap: entry.ap - 1, status: ability, coverFacing }
      : entry),
    logs: addLog(state, `${unit.name}: ${name}.`, 'system'),
  };
}

function endTurn(state) {
  if (state.phase !== 'player' || state.movement) return state;
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

function enemyStep(state) {
  if (state.phase !== 'enemy' || state.enemyTurnIndex >= state.enemyTurnOrder.length) return state;
  const enemy = state.units.find((unit) => unit.id === state.enemyTurnOrder[state.enemyTurnIndex] && unit.hp > 0);
  if (!enemy) return { ...state, enemyTurnIndex: state.enemyTurnIndex + 1 };

  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const target = [...players].sort((a, b) => (
    Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z)
  ))[0];
  if (!target) return { ...state, enemyTurnIndex: state.enemyTurnIndex + 1 };

  const distance = Math.hypot(target.x - enemy.x, target.z - enemy.z);
  const visibleCells = getVisibleCells(state.map, players);
  const revealedTargets = visibleCells.has(cellKey(enemy))
    ? players.filter((unit) => Math.hypot(unit.x - enemy.x, unit.z - enemy.z) <= ENEMY_SHOT_RANGE && hasLineOfSight(state.map, enemy, unit))
      .sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z))
    : [];
  const role = enemy.aiRole || enemy.role || 'raider';
  const retreating = role === 'scout' && enemy.hp <= Math.ceil(enemy.maxHp / 2) && distance <= 5;

  if (!retreating && enemy.ap > 0 && revealedTargets.length > 0) {
    const targetToShoot = role === 'raider'
      ? [...revealedTargets].sort((a, b) => {
        const coverA = state.map.cells[cellKey(a)]?.cover || 0;
        const coverB = state.map.cells[cellKey(b)]?.cover || 0;
        return (Math.hypot(a.x - enemy.x, a.z - enemy.z) + coverA * 2)
          - (Math.hypot(b.x - enemy.x, b.z - enemy.z) + coverB * 2);
      })[0]
      : revealedTargets[0];
    const shot = fireAt(state, targetToShoot.id, enemy.id, true);
    return { ...shot, enemyTurnIndex: state.enemyTurnIndex + 1 };
  }

  const blocked = new Set(state.units.filter((unit) => unit.id !== enemy.id && unit.hp > 0).map(cellKey));
  const maxSteps = role === 'scout' ? 7 : role === 'stalker' ? 6 : 5;
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

  if (!destination || enemy.ap < 1) {
    const decision = role === 'guard' ? 'hält den Posten' : role === 'stalker' ? 'bleibt verborgen' : 'hält die Position';
    return {
      ...state,
      enemyTurnIndex: state.enemyTurnIndex + 1,
      logs: addLog(state, `${enemy.name} ${decision}.`, 'combat'),
    };
  }
  const last = destination.path[destination.path.length - 1];
  const previous = destination.path.length > 1 ? destination.path[destination.path.length - 2] : enemy;
  const facing = facingToward(previous, last);
  return {
    ...state,
    movement: { id: Date.now(), unitId: enemy.id, path: [enemy, ...destination.path], step: 0 },
    units: state.units.map((unit) => unit.id === enemy.id
      ? { ...unit, x: last.x, z: last.z, level: last.level, ap: unit.ap - 1, facing }
      : unit),
    enemyTurnIndex: state.enemyTurnIndex + 1,
    logs: addLog(state, `${enemy.name} ${retreating ? 'zieht sich zurück' : role === 'guard' ? 'kehrt zum Posten zurück' : 'rückt vor'}.`, 'move'),
  };
}

function finishEnemyTurn(state) {
  if (state.phase !== 'enemy' || state.enemyTurnIndex < state.enemyTurnOrder.length) return state;
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const units = state.units.map((unit) => ({ ...unit, ap: unit.hp > 0 ? 2 : 0, status: null, coverFacing: null }));
  const selectedId = players.some((unit) => unit.id === state.selectedId)
    ? state.selectedId
    : players[0]?.id || null;
  const turn = state.turn + 1;
  return {
    ...state,
    units,
    turn,
    phase: 'player',
    selectedId,
    targetId: null,
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
    case 'move':
      if (state.phase !== 'player' || state.movement) return state;
      return selectNextReadyPlayer(moveUnit(state, action.destination));
    case 'attack':
      if (state.phase !== 'player' || state.movement) return state;
      // Selection moves on only after the shot has been shown (see finish-shot).
      return { ...fireAt(state, action.id), shootMode: false };
    case 'ability':
      if (state.phase !== 'player' || state.movement) return state;
      return selectNextReadyPlayer(useAbility(state, action.name));
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
        ? resolveOverwatch(cleared, mover.id)
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