import { ENEMY_MOVE_STEPS, SCOUT_RETREAT_RANGE } from '../constants.js';

// One entry per enemy role. enemyStep.js reads these parameters; it has no role-name branches.
//   maxSteps:       movement budget per alerted turn
//   retreat:        null, or { range }: retreats when hp <= ceil(maxHp / 2) and the target is within range
//   targetChoice:   'nearest' shoots the closest revealed player; 'exposed' weighs cover against distance
//   movePreference: 'approach' closes distance; 'post' returns to the assigned post;
//                   'conceal' prefers destinations outside the squad's vision
//   holdMessage:    log text when the enemy cannot move or shoot
//   moveMessage:    log text when the enemy moves
//   retreatMessage: log text when the enemy retreats (only roles with retreat)
export const ROLES = Object.freeze({
  raider: {
    maxSteps: ENEMY_MOVE_STEPS.raider,
    retreat: null,
    targetChoice: 'exposed',
    movePreference: 'approach',
    holdMessage: 'hält die Position',
    moveMessage: 'rückt vor',
  },
  stalker: {
    maxSteps: ENEMY_MOVE_STEPS.stalker,
    retreat: null,
    targetChoice: 'nearest',
    movePreference: 'conceal',
    holdMessage: 'bleibt verborgen',
    moveMessage: 'rückt vor',
  },
  scout: {
    maxSteps: ENEMY_MOVE_STEPS.scout,
    retreat: { range: SCOUT_RETREAT_RANGE },
    targetChoice: 'nearest',
    movePreference: 'approach',
    holdMessage: 'hält die Position',
    moveMessage: 'rückt vor',
    retreatMessage: 'zieht sich zurück',
  },
  guard: {
    maxSteps: ENEMY_MOVE_STEPS.guard,
    retreat: null,
    targetChoice: 'nearest',
    movePreference: 'post',
    holdMessage: 'hält den Posten',
    moveMessage: 'kehrt zum Posten zurück',
  },
});

// Returns the role entry for an enemy. Throws for a missing or unknown role; no fallback.
export function getRole(enemy) {
  if (!Object.hasOwn(ROLES, enemy.aiRole)) {
    throw new Error(`Enemy ${enemy.id} has missing or unknown role: ${String(enemy.aiRole)}`);
  }
  return ROLES[enemy.aiRole];
}
