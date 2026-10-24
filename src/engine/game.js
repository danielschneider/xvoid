import { cellKey, createBattlefield, getReachable, hasLineOfSight } from './map.js';

const initialUnits = [
  { id: 'vanguard', name: 'Vanguard', className: 'BREACHER', team: 'player', x: 3, z: 5, level: 0, hp: 6, maxHp: 6, shield: 2, ap: 2, color: '#62e6c4' },
  { id: 'spectre', name: 'Spectre', className: 'RECON', team: 'player', x: 4, z: 7, level: 0, hp: 5, maxHp: 5, shield: 1, ap: 2, color: '#87b5ff' },
  { id: 'medic', name: 'Medic', className: 'FIELD MEDIC', team: 'player', x: 6, z: 6, level: 0, hp: 5, maxHp: 5, shield: 2, ap: 2, color: '#f0d77e' },
  { id: 'raider-a', name: 'Void Raider', className: 'RAIDER', team: 'alien', x: 27, z: 25, level: 0, hp: 5, maxHp: 5, shield: 0, ap: 2, color: '#ff6f66' },
  { id: 'raider-b', name: 'Void Stalker', className: 'STALKER', team: 'alien', x: 25, z: 27, level: 0, hp: 6, maxHp: 6, shield: 1, ap: 2, color: '#d28cff' },
];

export function createInitialState(seed = 20261024) {
  return {
    map: createBattlefield(seed),
    units: initialUnits.map((unit) => ({ ...unit })),
    selectedId: 'vanguard',
    targetId: null,
    moveMode: true,
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

function moveUnit(state, destination) {
  const unit = state.units.find((entry) => entry.id === state.selectedId);
  if (!unit || unit.team !== 'player' || unit.ap < 1) return state;
  const occupied = new Set(state.units.filter((entry) => entry.id !== unit.id && entry.hp > 0).map(cellKey));
  const pathData = getReachable(state.map, unit, occupied).get(cellKey(destination));
  if (!pathData || pathData.apCost > unit.ap) return state;
  const last = pathData.path[pathData.path.length - 1];
  return {
    ...state,
    units: state.units.map((entry) => entry.id === unit.id
      ? { ...entry, x: last.x, z: last.z, level: last.level, ap: entry.ap - pathData.apCost }
      : entry),
    targetId: null,
    logs: addLog(state, `${unit.name} rückt ${pathData.steps} Felder vor.`, 'move'),
  };
}

function fireAt(state, targetId) {
  const shooter = state.units.find((unit) => unit.id === state.selectedId);
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
  const hitChance = Math.max(0.05, Math.min(0.95, 0.7 + elevationBonus - coverPenalty - distancePenalty));
  const hit = Math.random() < hitChance;
  const damage = hit ? 2 + Math.floor(Math.random() * 3) : 0;
  const remainingDamage = Math.max(0, damage - target.shield);
  const nextUnits = state.units.map((unit) => {
    if (unit.id === shooter.id) return { ...unit, ap: unit.ap - 1 };
    if (unit.id === target.id && hit) {
      const shieldDamage = Math.min(unit.shield, damage);
      return { ...unit, shield: unit.shield - shieldDamage, hp: Math.max(0, unit.hp - remainingDamage) };
    }
    return unit;
  });
  return {
    ...state,
    units: nextUnits,
    targetId,
    lastShot: { from: shooter, to: target, hit, damage, id: Date.now() },
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
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const enemies = state.units.filter((unit) => unit.team === 'alien' && unit.hp > 0);
  let units = state.units.map((unit) => ({ ...unit, ap: unit.hp > 0 ? 2 : 0, status: null }));
  const enemyLogs = [];

  for (const enemy of enemies) {
    const target = players
      .filter((unit) => hasLineOfSight(state.map, enemy, unit))
      .sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z))[0];
    if (!target || Math.hypot(target.x - enemy.x, target.z - enemy.z) > 13) continue;
    const hit = Math.random() < 0.52;
    const damage = hit ? 1 + Math.floor(Math.random() * 2) : 0;
    units = units.map((unit) => {
      if (unit.id !== target.id || !hit) return unit;
      const shieldDamage = Math.min(unit.shield, damage);
      return { ...unit, shield: unit.shield - shieldDamage, hp: Math.max(0, unit.hp - (damage - shieldDamage)) };
    });
    enemyLogs.push(hit ? `${enemy.name} trifft ${target.name}.` : `${enemy.name} verfehlt ${target.name}.`);
  }

  const next = {
    ...state,
    units,
    turn: state.turn + 1,
    phase: 'player',
    selectedId: players.find((unit) => units.some((entry) => entry.id === unit.id && entry.hp > 0))?.id || null,
    targetId: null,
    lastShot: null,
  };
  return { ...next, logs: [...enemyLogs.map((text, index) => ({ id: Date.now() + index, text, kind: 'combat' })), { id: Date.now() + 10, text: `Runde ${next.turn}: Zug deiner Einheit.`, kind: 'system' }, ...state.logs].slice(0, 5) };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'select':
      return { ...state, selectedId: action.id, targetId: null };
    case 'target':
      return { ...state, targetId: action.id };
    case 'toggle-move-mode':
      return { ...state, moveMode: !state.moveMode, targetId: null };
    case 'move':
      return moveUnit(state, action.destination);
    case 'attack':
      return fireAt(state, action.id);
    case 'ability':
      return useAbility(state, action.name);
    case 'end-turn':
      return endTurn(state);
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