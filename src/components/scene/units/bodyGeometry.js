import * as THREE from 'three';

// Shared geometries keyed by shape and size. Each distinct shape is built once and reused by every unit.
const geometries = new Map();

function buildGeometry(shape, size) {
  if (shape === 'box') return new THREE.BoxGeometry(...size);
  if (shape === 'cone') return new THREE.ConeGeometry(...size);
  if (shape === 'sphere') return new THREE.SphereGeometry(...size);
  throw new Error(`Unknown body shape: ${shape}`);
}

export function sharedGeometry(shape, size) {
  const key = `${shape}:${size.join(',')}`;
  if (!geometries.has(key)) geometries.set(key, buildGeometry(shape, size));
  return geometries.get(key);
}
