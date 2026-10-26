import { cellKey } from '../grid/cells.js';
import { getVisibleCells } from '../sight/fog.js';
import { hasLineOfSight } from '../sight/line.js';
import { makeRandom } from '../rng.js';
import { addLog } from '../log.js';
import { facingToward } from '../geometry.js';
import { computeCritChance, computeHitChance } from './hitChance.js';
import { AP_ACTION_COST, CRIT_MULTIPLIER, OVERWATCH_RANGE, SHOT_RANGE } from '../constants.js';

export function fireAt(state, targetId, shooterId = state.selectedId, enemyShot = false, reaction = false) {
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
  const random = makeRandom(state.rng);
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
    rng: random.cursor,
    nextId: state.nextId + 1,
    units: nextUnits,
    targetId: enemyShot ? null : targetId,
    lastShot: { from: shooter, to: target, hit, crit, damage, enemyShot, id: state.nextId },
    logs: addLog(state, (reaction ? 'Overwatch: ' : '') + (hit
      ? crit
        ? `${shooter.name} landet einen KRITISCHEN Treffer auf ${target.name} für ${damage} Schaden.`
        : `${shooter.name} trifft ${target.name} für ${damage} Schaden.`
      : `${shooter.name} verfehlt ${target.name}.`), hit ? 'hit' : 'combat'),
  };
}

export function resolveOverwatch(state, enemyId) {
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
