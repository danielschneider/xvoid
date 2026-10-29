// Interior partition walls that split a floor into rooms. Each partition has a one-cell
// gap so every room stays reachable. Partitions never touch stairs or door lanes; the
// caller passes those keys in `protectedKeys`.

// One partition across the interior: vertical if `axis` is 'x', horizontal if 'z'.
// `gap` is the cell offset along the wall where the opening is left.
export function partitionCells(room, axis, at, gap) {
  const cells = [];
  if (axis === 'x') {
    for (let z = room.z + 1; z < room.z + room.h - 1; z += 1) {
      if (z !== gap) cells.push({ x: at, z });
    }
  } else {
    for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
      if (x !== gap) cells.push({ x, z: at });
    }
  }
  return cells;
}

// Returns the partition cells for one floor that do not hit protected keys, or null if
// the wall would hit one (the caller then skips that partition).
export function safePartition(room, level, axis, at, gap, protectedKeys) {
  const cells = partitionCells(room, axis, at, gap);
  const keys = cells.map((cell) => `${cell.x},${cell.z},${level}`);
  if (keys.some((key) => protectedKeys.has(key))) return null;
  return cells;
}
