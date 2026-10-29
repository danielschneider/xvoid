import { cellKey } from '../cells.ts';

// Wall ring and door openings for a building's ground floor.
// Doors are `width` cells wide and centred on the chosen side. Door cells are returned
// as keys so the caller can mark them; they are never walls.

export const SIDES = ['north', 'south', 'west', 'east'];

// Cells along one side of the footprint, in order, for a door of `width` cells.
export function doorCells(room, side, width) {
  const start = (length) => Math.floor((length - width) / 2);
  if (side === 'north' || side === 'south') {
    const z = side === 'north' ? room.z : room.z + room.h - 1;
    const offset = start(room.w);
    return Array.from({ length: width }, (_, index) => ({ x: room.x + offset + index, z }));
  }
  const x = side === 'west' ? room.x : room.x + room.w - 1;
  const offset = start(room.h);
  return Array.from({ length: width }, (_, index) => ({ x, z: room.z + offset + index }));
}

export function isPerimeter(room, x, z) {
  return x === room.x || x === room.x + room.w - 1 || z === room.z || z === room.z + room.h - 1;
}

// Keys of every ground-floor door cell for the given sides.
export function doorKeys(room, sides, width) {
  const keys = new Set();
  for (const side of sides) {
    for (const cell of doorCells(room, side, width)) keys.add(cellKey({ ...cell, level: 0 }));
  }
  return keys;
}

// Opposite side of a door face, used to pick a second entrance.
export function oppositeSide(side) {
  return { north: 'south', south: 'north', west: 'east', east: 'west' }[side];
}
