// Balance numbers for action points, ranges and movement. Rules modules read
// these; do not repeat the literals elsewhere.

// Action points a unit receives at the start of each player and enemy turn.
export const AP_PER_TURN = 2;
// AP spent by one shot, one overwatch activation, or one ability use.
export const AP_ACTION_COST = 1;
// AP spent by a move: cheap (within cheapSteps) and full (beyond cheapSteps).
export const AP_MOVE_CHEAP = 1;
export const AP_MOVE_FULL = 2;

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
// Steps reachable for 1 AP (the cheap move). Full AP reaches the unit's moveRange.
export const CHEAP_MOVE_STEPS = 8;
export const ENEMY_MOVE_STEPS = { raider: 5, stalker: 6, scout: 7, guard: 5 };
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
// Cover penalty per tier: 2 = full (wall, pillar), 1 = half (console).
export const COVER_VALUE = { 0: 0, 1: 0.2, 2: 0.4 };
// Enemies discount cover by this factor when computing their hit chance.
export const ENEMY_COVER_FACTOR = 0.5;

// Enemies within GROUP_RANGE of each other (chained) form one alert group.
export const GROUP_RANGE = 2;

// Events kept in state.eventLog; older entries are dropped so state stays bounded.
export const EVENT_LOG_LIMIT = 50;
