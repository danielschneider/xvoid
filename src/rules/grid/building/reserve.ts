// Cell keys that box placement must never overwrite: stair cells and door lanes.
// Built once per building and merged into the map-wide protected set.
export function createReserve(): Set<string> {
  return new Set<string>();
}

export function reserveAll(reserve: Set<string>, keys: Iterable<string>): Set<string> {
  for (const key of keys) reserve.add(key);
  return reserve;
}
