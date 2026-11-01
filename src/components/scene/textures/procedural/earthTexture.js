import { createProceduralCanvas, makeCanvasTexture, paintPixels } from './canvas.js';
import { hexToRgb, scaleRgb } from './color.js';
import { seededNoise, valueNoise2D } from './noise.js';

const SIZE = 16;
const EARTH = hexToRgb('#6e6446');
const SEAM = hexToRgb('#4a4330');
const PEBBLE = hexToRgb('#a39775');
const SALT_PEBBLE = 0x41;
const SALT_SEAM = 0x42;

// Muted brown-olive packed earth with horizontal grain, for consoles. Same seed, same pixels.
export function createEarthTexture(seed) {
  const { canvas, context } = createProceduralCanvas(SIZE);
  paintPixels(context, SIZE, (x, y) => earthPixel(seed, x, y));
  return makeCanvasTexture(canvas);
}

function earthPixel(seed, x, y) {
  const grain = valueNoise2D(seed, x * 0.4, y * 1.6);
  const pebble = seededNoise(seed, x, y, SALT_PEBBLE);
  if (y % 6 === 5) {
    return scaleRgb(SEAM, 0.9 + seededNoise(seed, x, y, SALT_SEAM) * 0.2);
  }
  if (pebble > 0.93) {
    return scaleRgb(PEBBLE, 0.85 + grain * 0.3);
  }
  return scaleRgb(EARTH, 0.8 + grain * 0.4);
}
