import { createProceduralCanvas, makeCanvasTexture, paintPixels } from './canvas.js';
import { hexToRgb, scaleRgb } from './color.js';
import { seededNoise } from './noise.js';

const SIZE = 16;
// Horizontal bands of irregular stone blocks. Joints sit on these rows.
const BAND_JOINT_ROWS = [5, 11];
const BAND_TOPS = [0, 6, 12];
const STONE = hexToRgb('#7f8a84');
const MORTAR = hexToRgb('#3f4a45');
const SALT_JOINT = 0x31;
const SALT_BLOCK = 0x32;
const SALT_GRAIN = 0x33;

// Irregular grey stone blocks for pillars. Same seed always yields identical pixels.
export function createStoneTexture(seed) {
  const { canvas, context } = createProceduralCanvas(SIZE);
  paintPixels(context, SIZE, (x, y) => stonePixel(seed, x, y));
  return makeCanvasTexture(canvas);
}

function bandOf(y) {
  if (y < BAND_JOINT_ROWS[0]) return 0;
  return y < BAND_JOINT_ROWS[1] ? 1 : 2;
}

// Vertical joint columns for one band; block widths vary between 5 and 8 pixels.
function bandJoints(seed, band) {
  const joints = [];
  let x = Math.floor(seededNoise(seed, band, 0, SALT_JOINT) * 5);
  let index = 1;
  while (x < SIZE) {
    joints.push(x);
    x += 5 + Math.floor(seededNoise(seed, band, index, SALT_JOINT) * 4);
    index += 1;
  }
  return joints;
}

function stonePixel(seed, x, y) {
  const band = bandOf(y);
  const joints = bandJoints(seed, band);
  if (BAND_JOINT_ROWS.includes(y) || joints.includes(x)) {
    return scaleRgb(MORTAR, 0.85 + seededNoise(seed, x, y, SALT_GRAIN) * 0.3);
  }
  const blockStart = joints.filter((joint) => joint <= x).pop() ?? 0;
  const tone = 1 + (seededNoise(seed, blockStart, band, SALT_BLOCK) - 0.5) * 0.2;
  const grain = seededNoise(seed, x, y, SALT_GRAIN);
  const grainFactor = grain > 0.97 ? 0.7 : grain < 0.03 ? 1.15 : 1;
  const bevel = BAND_TOPS.includes(y) ? 1.08 : 1;
  return scaleRgb(STONE, tone * grainFactor * bevel);
}
