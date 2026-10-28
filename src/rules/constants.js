// Balance numbers for action points, ranges and movement. Rules modules read
// these; do not repeat the literals elsewhere.

// Action points a unit receives at the start of each player and enemy turn.
export const AP_PER_TURN = 2;
// AP spent by one shot, one overwatch activation, or one ability use.
export const AP_ACTION_COST = 1;

// Shooting and sight.
export const SHOT_RANGE = 10;
export const ENEMY_SHOT_RANGE = SHOT_RANGE;
export const OVERWATCH_RANGE = 8;
// Spawn-safety vision: enemies start outside this radius from the squad when possible.
export const VISION_RANGE = 10;
// Fog reveal radius for the player squad; wider than spawn-safety vision so the map shows more.
export const FOG_REVEAL_RANGE = 18;

// Movement. moveRange is the max steps per turn at full AP; half of it (rounded up)
// is the cheap range that costs 1 AP. DEFAULT_MOVE_RANGE applies to units without moveRange.
export const DEFAULT_MOVE_RANGE = 10;
export const ENEMY_MOVE_STEPS = {
  raider: 5,
  stalker: 6,
  scout: 7,
  guard: 5,
  crawler: 7,
  soldier: 5,
  monster: 4,
  sneaker: 6,
};
// A scout retreats when it is within this distance of its target and below half HP.
export const SCOUT_RETREAT_RANGE = 5;
// Unalerted enemies drift around their post: at most WANDER_STEPS per move, never
// further than WANDER_RADIUS from the post, and only on WANDER_CHANCE of their turns.
export const WANDER_STEPS = 2;
export const WANDER_RADIUS = 3;
export const WANDER_CHANCE = 0.6;

// Combat numbers.
export const CRIT_CHANCE = 0.15;
export const CRIT_MULTIPLIER = 2;
// A missed shot keeps flying this many fields past the target, stopping early at a wall.
export const MISS_OVERSHOOT = 3;
// Cover penalty per tier: 2 = full (wall, pillar), 1 = half (console).
export const COVER_VALUE = { 0: 0, 1: 0.2, 2: 0.4 };
// A flanked target (attacked from an open side while covered elsewhere) has its
// defence turned negative, so the hit chance rises instead of staying at base.
export const FLANK_COVER_VALUE = -0.4;
// Enemies discount cover by this factor when computing their hit chance.
export const ENEMY_COVER_FACTOR = 0.5;

// Enemies within GROUP_RANGE of each other (chained) form one alert group.
export const GROUP_RANGE = 2;

// Events kept in state.eventLog; older entries are dropped so state stays bounded.
export const EVENT_LOG_LIMIT = 50;
