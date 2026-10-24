import { cellKey, createBattlefield, getReachable, getVisibleCells, hasLineOfSight } from './map.js';

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

function createStartingUnits(map, seed) {
  const random = makeRandom(seed ^ 0x9e3779b9);
  const axis = random() < 0.5 ? 'x' : 'z';
  const playerStartsLow = random() < 0.5;
  const lowBoundary = Math.floor(map.size * 0.24);
  const highBoundary = Math.ceil(map.size * 0.76);
  const onSide = (cell, low) => low ? cell[axis] <= lowBoundary : cell[axis] >= highBoundary;
  const openGround = Object.values(map.cells).filter((cell) => (
    cell.level === 0 && cell.terrain === 'floor' && cell.walkable && !cell.structure
  ));
  const playerSpawns = shuffle(openGround.filter((cell) => onSide(cell, playerStartsLow)), random).slice(0, playerTemplates.length);
  const enemyCount = map.size >= 48 ? 20 : map.size >= 40 ? 10 : 5;
  const enemySpawns = shuffle(openGround.filter((cell) => onSide(cell, !playerStartsLow)), random).slice(0, enemyCount);
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

export function createInitialState(seed = 20261024) {
  const map = createBattlefield(seed);
  return {
    map,
    units: createStartingUnits(map, seed),
    selectedId: 'vanguard',
    targetId: null,
    moveMode: true,
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
  return next ? { ...state, selectedId: next.id, targetId: null } : state;
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
    movement: { id: Date.now(), unitId: unit.id, path: [unit, ...pathData.path] },
    units: state.units.map((entry) => entry.id === unit.id
      ? { ...entry, x: last.x, z: last.z, level: last.level, ap: entry.ap - pathData.apCost, facing }
      : entry),
    targetId: null,
    logs: addLog(state, `${unit.name} rückt ${pathData.steps} Felder vor.`, 'move'),
  };
}

function fireAt(state, targetId, shooterId = state.selectedId, enemyShot = false) {
  const shooter = state.units.find((unit) => unit.id === shooterId);
  const target = state.units.find((unit) => unit.id === targetId);
  if (!shooter || !target || shooter.team === target.team || shooter.ap < 1 || target.hp <= 0) return state;
  const visible = hasLineOfSight(state.map, shooter, target);
  if (!visible) {
    return { ...state, targetId, logs: addLog(state, 'Schusslinie blockiert.', 'combat') };
  }
  const targetCell = state.map.cells[cellKey(target)];
  const distance = Math.hypot(shooter.x - target.x, shooter.z - target.z);
  const coverPenalty = targetCell?.cover === 2 ? 0.4 : targetCell?.cover === 1 ? 0.2 : 0;
  const elevationBonus = shooter.level > target.level ? 0.15 : 0;
  const distancePenalty = Math.max(0, distance - 8) * 0.015;
  const hitChance = enemyShot ? 0.52 : Math.max(0.05, Math.min(0.95, 0.7 + elevationBonus - coverPenalty - distancePenalty));
  const hit = Math.random() < hitChance;
  const damage = hit ? enemyShot ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3) : 0;
  const remainingDamage = Math.max(0, damage - target.shield);
  const nextUnits = state.units.map((unit) => {
    if (unit.id === shooter.id) return { ...unit, ap: unit.ap - 1, facing: facingToward(shooter, target) };
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
    lastShot: { from: shooter, to: target, hit, damage, enemyShot, id: Date.now() },
    logs: addLog(state, hit ? `${shooter.name} trifft ${target.name} für ${damage} Schaden.` : `${shooter.name} verfehlt ${target.name}.`, hit ? 'hit' : 'combat'),
  };
}

function useAbility(state, ability) {
  const unit = state.units.find((entry) => entry.id === state.selectedId);
  if (!unit || unit.ap < 1 || unit.team !== 'player') return state;
  const name = ability === 'overwatch' ? 'Overwatch' : 'Deckung suchen';
  return {
    ...state,
    units: state.units.map((entry) => entry.id === unit.id ? { ...entry, ap: entry.ap - 1, status: ability } : entry),
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
    ? players.filter((unit) => Math.hypot(unit.x - enemy.x, unit.z - enemy.z) <= 13 && hasLineOfSight(state.map, enemy, unit))
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
    movement: { id: Date.now(), unitId: enemy.id, path: [enemy, ...destination.path] },
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
  const units = state.units.map((unit) => ({ ...unit, ap: unit.hp > 0 ? 2 : 0, status: null }));
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
      return { ...state, selectedId: action.id, targetId: null };
    case 'target':
      if (state.phase !== 'player' || state.movement) return state;
      return {
        ...state,
        targetId: action.id,
        units: state.units.map((unit) => unit.id === state.selectedId
          ? { ...unit, facing: facingToward(unit, state.units.find((target) => target.id === action.id) || unit) }
          : unit),
      };
    case 'toggle-move-mode':
      if (state.phase !== 'player' || state.movement) return state;
      return { ...state, moveMode: !state.moveMode, targetId: null };
    case 'move':
      if (state.phase !== 'player' || state.movement) return state;
      return selectNextReadyPlayer(moveUnit(state, action.destination));
    case 'attack':
      if (state.phase !== 'player' || state.movement) return state;
      return selectNextReadyPlayer(fireAt(state, action.id));
    case 'ability':
      if (state.phase !== 'player' || state.movement) return state;
      return selectNextReadyPlayer(useAbility(state, action.name));
    case 'end-turn':
      return endTurn(state);
    case 'complete-movement':
      if (state.movement?.id !== action.id) return state;
      return { ...state, movement: null };
    case 'enemy-step':
      return enemyStep(state);
    case 'finish-enemy-turn':
      return finishEnemyTurn(state);
    case 'regenerate':
      return createInitialState(action.seed);
    case 'toggle-levels':
      return { ...state, showUpper: !state.showUpper };
    case 'clear-shot':
      return { ...state, lastShot: null };
    default:
      return state;
  }
}

export { getReachable, cellKey, hasLineOfSight };