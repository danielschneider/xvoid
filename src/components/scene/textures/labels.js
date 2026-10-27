import * as THREE from 'three';
import { COPY } from '../../copy.js';

// Floating "CRIT" label shown above a unit hit by a critical shot.
export function createCritTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.font = 'bold 40px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 8;
  context.strokeStyle = '#17201c';
  context.fillStyle = '#ffd34d';
  context.strokeText(COPY.labels.crit, 64, 34);
  context.fillText(COPY.labels.crit, 64, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Damage or MISS label for one shot. Colour encodes hit, crit or miss.
export function createDamageTexture(shot) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.font = 'bold 84px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 12;
  context.strokeStyle = '#17201c';
  context.fillStyle = shot.hit ? (shot.crit ? '#ffd34d' : '#ff9580') : '#9ce3e3';
  const label = shot.hit ? `${shot.crit ? COPY.labels.critPrefix : ''}-${shot.damage}` : COPY.labels.miss;
  context.strokeText(label, 128, 68);
  context.fillText(label, 128, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
