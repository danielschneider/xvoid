import { createBattlefield } from '../grid/generate.ts';
import { makeRandom } from '../rng.ts';
import { createStartingUnits, initialSelection } from './placement.ts';
import { INTRO_LOG } from '../../presentation/logText.js';

export function createInitialState(seed = 20261024, generation = 0) {
  const map = createBattlefield(seed);
  const random = makeRandom(seed ^ 0x9e3779b9);
  const units = createStartingUnits(map, random);
  return {
    // Increments on every level reset. Views key their per-unit components on it
    // so that a reset remounts them instead of reusing stale visual state.
    generation,
    map,
    units,
    selectedId: initialSelection(map, units),
    targetId: null,
    moveMode: true,
    shootMode: false,
    enemyTurnOrder: [],
    enemyTurnIndex: 0,
    // Enemy group ids that the squad has revealed. Alerted groups stay alerted.
    alertedGroups: [],
    movement: null,
    turn: 1,
    phase: 'player',
    showUpper: true,
    logs: [INTRO_LOG],
    lastShot: null,
    // Bounded list of plain events emitted by the reducer (see presentation/events.js).
    eventLog: [],
    // Integer RNG cursor: every random draw advances it (see rules/rng.js).
    rng: random.cursor,
    // Counter for movement and shot ids, so ids stay deterministic across runs.
    nextId: 1,
  };
}
