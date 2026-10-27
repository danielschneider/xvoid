// Every presentation delay in one table (milliseconds). Consumed by presentation/director.js.
export const TIMING = Object.freeze({
  // Player shot: the shooter stays selected while the shot or death is shown.
  shotHoldMs: 1000,
  // Enemy shot: held a little longer before the enemy turn continues.
  enemyShotHoldMs: 1300,
  // Pause between visible enemy actions.
  enemyStepMs: 1400,
  // Enemy action out of the player's sight: no pause.
  hiddenStepMs: 0,
  // One cell of unit movement.
  moveStepMs: 220,
  // Pause after the last movement step before the move completes.
  moveSettleMs: 80,
});
