import { ENEMY_MOVE_STEPS, SCOUT_RETREAT_RANGE } from '../constants.ts';

// One entry per enemy role. enemyStep.js reads these parameters; it has no role-name branches.
//   maxSteps:       movement budget per alerted turn
//   retreat:        null, or { range }: retreats when hp <= ceil(maxHp / 2) and the target is within range
//   targetChoice:   'nearest' shoots the closest revealed player; 'exposed' weighs cover against distance
//   movePreference: 'approach' closes distance; 'post' returns to the assigned post;
//                   'conceal' prefers destinations outside the squad's vision;
//                   'flank' circles to the rear arc of the nearest player, staying concealed
//   seeksCover:     true: when exposed to player fire, moves to the least exposed reachable cell first
//                   (takeCover.js). false: charges regardless of cover.
//   Log wording for each role lives in presentation/logText.js (ENEMY_TEXT).
export const ROLES = Object.freeze({
  raider: {
    maxSteps: ENEMY_MOVE_STEPS.raider,
    retreat: null,
    targetChoice: 'exposed',
    movePreference: 'approach',
    seeksCover: true,
  },
  stalker: {
    maxSteps: ENEMY_MOVE_STEPS.stalker,
    retreat: null,
    targetChoice: 'nearest',
    movePreference: 'conceal',
    seeksCover: true,
  },
  scout: {
    maxSteps: ENEMY_MOVE_STEPS.scout,
    retreat: { range: SCOUT_RETREAT_RANGE },
    targetChoice: 'nearest',
    movePreference: 'approach',
    seeksCover: true,
  },
  guard: {
    maxSteps: ENEMY_MOVE_STEPS.guard,
    retreat: null,
    targetChoice: 'nearest',
    movePreference: 'post',
    seeksCover: true,
  },
  // Fast, fragile swarm unit: closes distance quickly and shoots the nearest target.
  crawler: {
    maxSteps: ENEMY_MOVE_STEPS.crawler,
    retreat: null,
    targetChoice: 'nearest',
    movePreference: 'approach',
    seeksCover: false,
  },
  // Disciplined infantry: holds its post, takes cover under fire and picks shots by cover.
  soldier: {
    maxSteps: ENEMY_MOVE_STEPS.soldier,
    retreat: null,
    targetChoice: 'exposed',
    movePreference: 'post',
    seeksCover: true,
  },
  // Slow heavy: advances on the nearest target and absorbs damage.
  monster: {
    maxSteps: ENEMY_MOVE_STEPS.monster,
    retreat: null,
    targetChoice: 'nearest',
    movePreference: 'approach',
    seeksCover: false,
  },
  // Sneaks around to a player's rear arc and lurks there; it fires from the rear once revealed.
  sneaker: {
    maxSteps: ENEMY_MOVE_STEPS.sneaker,
    retreat: null,
    targetChoice: 'nearest',
    movePreference: 'flank',
    seeksCover: true,
  },
});

// Returns the role entry for an enemy. Throws for a missing or unknown role; no fallback.
export function getRole(enemy) {
  if (!Object.hasOwn(ROLES, enemy.aiRole)) {
    throw new Error(`Enemy ${enemy.id} has missing or unknown role: ${String(enemy.aiRole)}`);
  }
  return ROLES[enemy.aiRole];
}
