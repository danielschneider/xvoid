import { computeHitChance, computePlayerHitParts, hasLineOfSight, SHOT_RANGE } from '../rules/index.ts';

// View data for the combat preview. All numbers come from engine helpers; no formula here.
export function selectCombatPreview(state, shooter, target) {
  if (!shooter || !target) return null;
  const parts = computePlayerHitParts(state, shooter, target);
  const hitChance = computeHitChance(state, shooter, target);
  const distance = parts.distance;
  const visible = hasLineOfSight(state.map, shooter, target) && distance <= SHOT_RANGE;
  return {
    distance,
    inRange: distance <= SHOT_RANGE,
    visible,
    hitChance,
    hitPercent: visible ? Math.round(hitChance * 100) : 0,
    coverTier: parts.coverTier,
    flanked: parts.flanked,
    basePercent: Math.round(parts.base * 100),
    coverPercent: Math.round(parts.cover * 100),
    elevationPercent: Math.round(parts.elevation * 100),
    distancePercent: Math.round(parts.distanceModifier * 100),
  };
}
