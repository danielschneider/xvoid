// Cell keys that box placement must never overwrite: stair cells and door lanes.
// Built once per building and merged into the map-wide protected set.
export function createReserve() {
  return new Set();
}

export function reserveAll(reserve, keys) {
  for (const key of keys) reserve.add(key);
  return reserve;
}
