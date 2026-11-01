import { createProceduralCanvas, makeCanvasTexture, paintPixels } from './canvas.js';
import { hexToRgb, scaleRgb } from './color.js';
import { seededNoise } from './noise.js';

const SIZE = 16;
const COURSE_HEIGHT = 4;
const BRICK_WIDTH = 8;
const CONCRETE = hexToRgb('#7a8880');
const MORTAR = hexToRgb('#4f5b54');
const SALT_BRICK = 0x21;
const SPECKLE_SALT = 0x22;

// Brick-course concrete wall. Same seed always yields identical pixels.
export function createWallTexture(seed) {
  const { canvas, context } = createProceduralCanvas(SIZE);
  paintPixels(context, SIZE, (x, y) => wallPixel(seed, x, y));
  return makeCanvasTexture(canvas);
}

function wallPixel(seed, x, y) {
  const course = Math.floor(y / COURSE_HEIGHT);
  const offset = course % 2 ? BRICK_WIDTH / 2 : 0;
  const shiftedX = x + offset;
  const isMortar = y % COURSE_HEIGHT === COURSE_HEIGHT - 1 || shiftedX % BRICK_WIDTH === 0;
  const speckle = seededNoise(seed, x, y, SPECKLE_SALT);
  const speckleFactor = speckle > 0.9 ? 1.12 : speckle < 0.06 ? 0.88 : 1;
  if (isMortar) {
    return scaleRgb(MORTAR, (0.9 + speckle * 0.2) * speckleFactor);
  }
  const brick = Math.floor(shiftedX / BRICK_WIDTH);
  const jitter = 1 + (seededNoise(seed, brick, course, SALT_BRICK) - 0.5) * 0.16;
  return scaleRgb(CONCRETE, jitter * speckleFactor);
}
