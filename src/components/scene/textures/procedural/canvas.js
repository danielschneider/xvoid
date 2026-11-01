import * as THREE from 'three';

// Square canvas with smoothing off so every pixel stays crisp.
export function createProceduralCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

// Paints one 1x1 rect per pixel. pixelAt(x, y) returns [r, g, b] in 0..255.
export function paintPixels(context, size, pixelAt) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixelAt(x, y).map((channel) => Math.round(channel));
      context.fillStyle = `rgb(${r},${g},${b})`;
      context.fillRect(x, y, 1, 1);
    }
  }
}

export function makeCanvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
