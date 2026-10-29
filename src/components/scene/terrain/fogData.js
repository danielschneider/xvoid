import { cellKey } from '../../../engine/map.ts';

// Pure fog data. Fog is per cell: every cell with level > 0 that is not visible is fogged.
// Flat ground (level 0) is never fogged. Each elevated level gets its own layer (a size x size
// texture of one texel per (x, z)), so a hidden upper floor is fogged even when a visible floor
// sits above or below it in the same column. FogOfWar draws one plane per layer at that level's Y.
// Texels that are not fogged are written as FOG_VISIBLE so the shader leaves them clear.

export const FOG_HIDDEN = 0;
export const FOG_VISIBLE = 255;

// Map span (cells per side) from the cells list. Map columns run 0..size-1.
export function getMapSpan(cells) {
  let span = 0;
  for (const cell of cells) {
    span = Math.max(span, cell.x + 1, cell.z + 1);
  }
  return span;
}

// Texel index for column (x, z). With flipY false, DataTexture row 0 sits at v = 0. The fog
// plane is rotated -PI/2 about X, so v grows toward world -z: v = 1 - (z + 0.5) / size, which
// puts map row z at texture row size - 1 - z.
export function fogTexelIndex(size, x, z) {
  return (size - 1 - z) * size + x;
}

// Builds one byte layer per elevated level that has at least one fogged cell.
// Returns [{ level, bytes }] sorted by level, where bytes is size * size texels.
// `size` is the map span (cells per side); cells outside 0..size-1 are ignored.
export function buildFogLayers(size, cells, visibleCellKeys) {
  const layers = new Map();
  for (const cell of cells) {
    if (!(cell.level > 0)) continue;
    if (cell.x < 0 || cell.z < 0 || cell.x >= size || cell.z >= size) continue;
    let bytes = layers.get(cell.level);
    if (!bytes) {
      bytes = new Uint8Array(size * size).fill(FOG_VISIBLE);
      layers.set(cell.level, bytes);
    }
    if (!visibleCellKeys.has(cellKey(cell))) bytes[fogTexelIndex(size, cell.x, cell.z)] = FOG_HIDDEN;
  }
  return [...layers]
    .filter(([, bytes]) => bytes.includes(FOG_HIDDEN))
    .sort(([a], [b]) => a - b)
    .map(([level, bytes]) => ({ level, bytes }));
}

// Smooth-edge sample: 4-tap average around (u, v) in [0, 1] texture space, offsets given in
// texel units. Reference for the shader's blur so the edge behaviour can be tested in node.
export function sampleFogSmooth(bytes, size, u, v, radius = 0.6) {
  const offsets = [
    [-radius, -radius],
    [radius, -radius],
    [-radius, radius],
    [radius, radius],
  ];
  let total = 0;
  for (const [du, dv] of offsets) {
    const x = clampIndex(Math.floor(u * size + du), size);
    const row = clampIndex(Math.floor(v * size + dv), size);
    total += bytes[row * size + x] / FOG_VISIBLE;
  }
  return total / offsets.length;
}

function clampIndex(value, size) {
  return Math.min(size - 1, Math.max(0, value));
}
