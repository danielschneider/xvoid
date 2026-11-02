import * as THREE from 'three';

// Canvas texture for one green blood splat: a dark rim, a bright body and a few droplets.
// Pixel-art look: no smoothing, hard edges.
export function createBloodSplatTexture(seed = 1) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const cx = size / 2;
  context.fillStyle = '#0f3d12';
  context.beginPath();
  context.arc(cx, cx, 26, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#44e63a';
  context.beginPath();
  context.arc(cx, cx, 21, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#b8ff9e';
  for (let i = 0; i < 4; i += 1) {
    const a = ((seed * 0.37 + i * 1.7) % 1) * Math.PI * 2;
    const d = 14 + ((seed * 0.11 + i * 0.29) % 1) * 12;
    context.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cx + Math.sin(a) * d), 3, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
