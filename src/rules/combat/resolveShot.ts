import { cellKey } from '../grid/cells.ts';
import { getVisibleCells } from '../sight/fog.ts';
import { hasLineOfSight } from '../sight/line.ts';
import { makeRandom } from '../rng.ts';
import { facingToward } from '../geometry.ts';
import { computeCritChance, computeHitChance } from './hitChance.ts';
import { missOvershoot } from './trajectory.ts';
import { AP_ACTION_COST, CRIT_MULTIPLIER, OVERWATCH_RANGE, SHOT_RANGE } from '../constants.ts';
import { blockedEvent, deathEvent, shotEvent } from '../../presentation/events.js';

// Returns { state, events }. Blocked or out-of-range attempts resolve without a shot event.
// Never mutates `state`.

export function fireAt(state, targetId, shooterId = state.selectedId, enemyShot = false, reaction = false) {
  const shooter = state.units.find((unit) => unit.id === shooterId);
  const target = state.units.find((unit) => unit.id === targetId);
  if (
    !shooter ||
    !target ||
    shooter.team === target.team ||
    (!reaction && shooter.ap < AP_ACTION_COST) ||
    target.hp <= 0
  )
    return { state, events: [] };
  const visible = hasLineOfSight(state.map, shooter, target);
  if (!visible) {
    return {
      state: { ...state, targetId },
      events: [blockedEvent({ shooterId: shooter.id, targetId: target.id, reason: 'sight' })],
    };
  }
  if (Math.hypot(shooter.x - target.x, shooter.z - target.z) > SHOT_RANGE) {
    return {
      state: { ...state, targetId },
      events: [blockedEvent({ shooterId: shooter.id, targetId: target.id, reason: 'range' })],
    };
  }
  const hitChance = computeHitChance(state, shooter, target, enemyShot);
  const random = makeRandom(state.rng);
  const hit = random() < hitChance;
  const crit = hit && random() < computeCritChance(enemyShot);
  const baseDamage = enemyShot ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * 3) + (shooter.power ?? 0);
  const damage = hit ? (crit ? baseDamage * CRIT_MULTIPLIER : baseDamage) : 0;
  const overshoot = hit ? 0 : missOvershoot(state.map, shooter, target);
  const remainingDamage = Math.max(0, damage - target.shield);
  const nextUnits = state.units.map((unit) => {
    if (unit.id === shooter.id)
      return { ...unit, ap: reaction ? unit.ap : unit.ap - AP_ACTION_COST, facing: facingToward(shooter, target) };
    if (unit.id === target.id && hit) {
      const shieldDamage = Math.min(unit.shield, damage);
      return { ...unit, shield: unit.shield - shieldDamage, hp: Math.max(0, unit.hp - remainingDamage) };
    }
    return unit;
  });
  const defeated = hit && nextUnits.find((unit) => unit.id === target.id).hp === 0;
  const nextState = {
    ...state,
    rng: random.cursor,
    nextId: state.nextId + 1,
    units: nextUnits,
    targetId: enemyShot ? null : targetId,
    lastShot: { from: shooter, to: target, hit, crit, damage, overshoot, enemyShot, id: state.nextId },
  };
  const events = [
    shotEvent({
      shooterId: shooter.id,
      shooterName: shooter.name,
      targetId: target.id,
      targetName: target.name,
      hit,
      crit,
      damage,
      enemyShot,
      reaction,
    }),
    ...(defeated ? [deathEvent({ unitId: target.id })] : []),
  ];
  return { state: nextState, events };
}

export function resolveOverwatch(state, enemyId) {
  const enemy = state.units.find((unit) => unit.id === enemyId);
  if (!enemy || enemy.hp <= 0) return { state, events: [] };
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  if (!getVisibleCells(state.map, players).has(cellKey(enemy))) return { state, events: [] };
  const distanceToEnemy = (unit) => Math.hypot(unit.x - enemy.x, unit.z - enemy.z);
  const watcher = players
    .filter(
      (unit) =>
        unit.status === 'overwatch' &&
        distanceToEnemy(unit) <= OVERWATCH_RANGE &&
        hasLineOfSight(state.map, unit, enemy)
    )
    .sort((a, b) => distanceToEnemy(a) - distanceToEnemy(b))[0];
  if (!watcher) return { state, events: [] };
  const shot = fireAt(state, enemy.id, watcher.id, false, true);
  return {
    state: {
      ...shot.state,
      units: shot.state.units.map((unit) => (unit.id === watcher.id ? { ...unit, status: null } : unit)),
    },
    events: shot.events,
  };
}
