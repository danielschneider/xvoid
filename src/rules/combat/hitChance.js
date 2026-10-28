import { getCoverAgainst } from './cover.js';
import { hasLineOfSight } from '../sight/line.js';
import { clamp, spawnDistance } from '../geometry.js';
import { COVER_VALUE, CRIT_CHANCE, ENEMY_COVER_FACTOR, FLANK_COVER_VALUE, SHOT_RANGE } from '../constants.js';

// Per-cell distance modifier: +0.05 per cell inside 5, -0.05 per cell beyond it.
// Max range (SHOT_RANGE) costs -0.25 instead of -0.5.
export function computeDistanceModifier(distance) {
  return (5 - distance) * 0.05;
}

// Cover from the side the shot arrives at. A flanking shot gets no cover.
export function computeCoverFor(state, shooter, target) {
  return getCoverAgainst(state.map, target, shooter);
}

// Defence value of a target against one shot: a flank is negative (raises hit chance),
// otherwise the cover tier's value applies.
function defenceValue({ cover: tier, flanked }) {
  return flanked ? FLANK_COVER_VALUE : COVER_VALUE[tier];
}

// Living enemies that currently flank `target`: they have a clear shot within range
// and arrive from a side without cover while the target is covered elsewhere.
export function getFlankedBy(state, target) {
  if (target.hp <= 0) return [];
  return state.units.filter(
    (unit) =>
      unit.team !== target.team &&
      unit.hp > 0 &&
      Math.hypot(unit.x - target.x, unit.z - target.z) <= SHOT_RANGE &&
      hasLineOfSight(state.map, unit, target) &&
      computeCoverFor(state, unit, target).flanked
  );
}

// Terms of the player-shot hit chance, shown one-to-one in the combat preview.
export function computePlayerHitParts(state, shooter, target) {
  const { cover: tier, flanked } = computeCoverFor(state, shooter, target);
  const distance = spawnDistance(shooter, target);
  return {
    base: 0.7,
    elevation: shooter.level > target.level ? 0.15 : 0,
    cover: defenceValue({ cover: tier, flanked }),
    coverTier: tier,
    flanked,
    distance,
    distanceModifier: computeDistanceModifier(distance),
  };
}

export function computeHitChance(state, shooter, target, enemyShot = false) {
  if (enemyShot) {
    const cover = computeCoverFor(state, shooter, target);
    const distance = spawnDistance(shooter, target);
    return clamp(0.52 - defenceValue(cover) * ENEMY_COVER_FACTOR + computeDistanceModifier(distance), 0.05, 0.95);
  }
  const parts = computePlayerHitParts(state, shooter, target);
  return clamp(parts.base + parts.elevation - parts.cover + parts.distanceModifier, 0.05, 0.95);
}

// Crit chance applies only to player shots; enemy shots never crit.
export function computeCritChance(enemyShot = false) {
  if (enemyShot) return 0;
  return CRIT_CHANCE;
}
