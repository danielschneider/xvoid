import type { Room } from '../types.ts';

// Samples a candidate footprint for an extra building. The anchors leave narrow bands
// of free ground, so extra footprints are small (3-5 cells). The caller still rejects
// overlaps and invalid results. Returns null when the footprint would touch the central
// corridor row or column (plus a one-cell border), so the main lanes stay open.
export function randomCandidate(id: number, size: number, middle: number, random: () => number): Room | null {
  const w = 3 + Math.floor(random() * 3);
  const h = 3 + Math.floor(random() * 3);
  const maxX = size - 2 - w;
  const maxZ = size - 2 - h;
  const x = 1 + Math.floor(random() * (maxX - 1 + 1));
  const z = 1 + Math.floor(random() * (maxZ - 1 + 1));
  const crossesX = x - 1 <= middle && middle <= x + w;
  const crossesZ = z - 1 <= middle && middle <= z + h;
  if (crossesX || crossesZ) return null;
  return { id, x, z, w, h };
}

// Returns the first sampled footprint that is on-map, clear of the corridor and keeps a
// one-cell gap from every existing building. Null when none of `tries` samples fits.
export function firstFreeCandidate(
  buildings: Room[],
  size: number,
  middle: number,
  random: () => number,
  tries: number
): Room | null {
  for (let index = 0; index < tries; index += 1) {
    const room = randomCandidate(buildings.length, size, middle, random);
    if (room && !touchesAny(room, buildings)) return room;
  }
  return null;
}

function touchesAny(room: Room, buildings: Room[]): boolean {
  return buildings.some(
    (other) =>
      room.x - 1 <= other.x + other.w - 1 &&
      other.x <= room.x + room.w &&
      room.z - 1 <= other.z + other.h - 1 &&
      other.z <= room.z + room.h
  );
}
