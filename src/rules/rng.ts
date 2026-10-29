// Single seeded LCG for the whole engine. Callers keep the integer cursor in state
// (`state.rng`) and every draw advances it. `makeRandom(cursor)` returns a draw
// function; read `random.cursor` after the draws and store it back in state.
const MULTIPLIER = 1664525;
const INCREMENT = 1013904223;
const SCALE = 4294967296;

export interface Random {
  (): number;
  cursor: number;
}

export function makeRandom(cursor?: number): Random {
  const random: Random = Object.assign(
    () => {
      random.cursor = (random.cursor * MULTIPLIER + INCREMENT) >>> 0;
      return random.cursor / SCALE;
    },
    { cursor: (cursor ?? 0) >>> 0 }
  );
  return random;
}
