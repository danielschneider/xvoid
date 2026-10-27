import { TIMING } from './timing.js';

// Plays the state's pending steps: arms a timer for each step and dispatches the next action
// when it fires. Plain JS, no React: App.jsx calls sync() after each state change.
//
// Each slot mirrors one former useEffect: it is re-armed only when its dependency values change
// (compared with Object.is), and a change cancels the previous timer first. Slots run in the
// same order as the effects they replace, so timers armed in the same pass keep that order.

// view: { activeEnemyHidden, movementHidden } computed by the caller from fog of war.
// Returns the slot list for this state; timer is null when nothing should be armed.
export function planSteps(state, view) {
  const { activeEnemyHidden, movementHidden } = view;
  const movement = state.movement;
  const enemyTurn = state.phase === 'enemy' && !movement;
  const enemyFinished = state.enemyTurnIndex >= state.enemyTurnOrder.length;
  return [
    {
      key: 'shot',
      deps: [state.lastShot],
      timer: state.lastShot
        ? {
            kind: 'timeout',
            delay: state.lastShot.enemyShot ? TIMING.enemyShotHoldMs : TIMING.shotHoldMs,
            action: { type: 'finish-shot', id: state.lastShot.id },
          }
        : null,
    },
    {
      key: 'enemy',
      deps: [state.enemyTurnIndex, state.enemyTurnOrder.length, state.phase, movement, activeEnemyHidden],
      timer: enemyTurn
        ? {
            kind: 'timeout',
            delay: !enemyFinished && activeEnemyHidden ? TIMING.hiddenStepMs : TIMING.enemyStepMs,
            action: { type: enemyFinished ? 'finish-enemy-turn' : 'enemy-step' },
          }
        : null,
    },
    {
      key: 'movement-tick',
      deps: [movement?.id, movementHidden],
      timer:
        movement && !movementHidden
          ? { kind: 'interval', delay: TIMING.moveStepMs, action: { type: 'advance-movement', id: movement.id } }
          : null,
    },
    {
      key: 'movement-complete',
      deps: [movement, movementHidden],
      timer: movement
        ? {
            kind: 'timeout',
            delay: movementHidden
              ? TIMING.hiddenStepMs
              : movement.path.length * TIMING.moveStepMs + TIMING.moveSettleMs,
            action: { type: 'complete-movement', id: movement.id },
          }
        : null,
    },
  ];
}

function sameDeps(a, b) {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

// dispatch: receives action objects. scheduler: setTimeout/clearTimeout/setInterval/clearInterval
// (injected so tests can use a fake clock; defaults to the global timers).
export function createDirector({ dispatch, scheduler = globalThis }) {
  const armed = new Map();

  const cancel = (entry) => {
    if (entry.kind === 'interval') scheduler.clearInterval(entry.handle);
    else if (entry.kind === 'timeout') scheduler.clearTimeout(entry.handle);
  };

  const arm = (timer) => {
    const fire = () => dispatch(timer.action);
    return timer.kind === 'interval'
      ? scheduler.setInterval(fire, timer.delay)
      : scheduler.setTimeout(fire, timer.delay);
  };

  return {
    sync(state, view) {
      for (const step of planSteps(state, view)) {
        const previous = armed.get(step.key);
        if (previous && sameDeps(previous.deps, step.deps)) continue;
        if (previous) cancel(previous);
        if (step.timer) {
          armed.set(step.key, { deps: step.deps, kind: step.timer.kind, handle: arm(step.timer) });
        } else {
          armed.set(step.key, { deps: step.deps, kind: null, handle: null });
        }
      }
    },
    // Cancels every pending timer. The next sync() re-arms from scratch.
    dispose() {
      for (const entry of armed.values()) cancel(entry);
      armed.clear();
    },
  };
}
