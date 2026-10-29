import { cellHeight } from '../../engine/map.ts';

// World-space coordinates for grid cells. This module owns the -15.5 offset that
// centres the map on the origin; no other file may subtract it directly.
export const CELL_OFFSET = 15.5;
export const STEP_HEIGHT = 1.5;

// Cell position on the ground plane (x and z in world units).
export function toWorld(cell) {
  return { x: cell.x - CELL_OFFSET, z: cell.z - CELL_OFFSET };
}

// Height of a cell's floor in world units. Callers add their own lift (e.g. +0.035).
export function toWorldY(cell) {
  return cellHeight(cell) * STEP_HEIGHT;
}
