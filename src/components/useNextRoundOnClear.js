import { useEffect, useRef } from 'react';
import { selectEnemyCounts } from '../selectors/hud.ts';

export const NEXT_ROUND_DELAY_MS = 2500;

// Once every alien unit is gone and no shot or movement is still playing, starts the next round
// after a short delay. The callback is read through a ref so re-renders do not restart the timer.
export function useNextRoundOnClear(state, startNextRound) {
  const callbackRef = useRef(startNextRound);
  callbackRef.current = startNextRound;
  const ready = selectEnemyCounts(state).living === 0 && !state.lastShot && !state.movement;
  useEffect(() => {
    if (!ready) return undefined;
    const timer = window.setTimeout(() => callbackRef.current(), NEXT_ROUND_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);
}
