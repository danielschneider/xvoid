// Pure camera gesture math. No DOM, no three.js: values copied from the handlers in CameraRig at f32310c.

export const ZOOM_MIN = 18;
export const ZOOM_MAX = 72;
export const WHEEL_ZOOM_OUT = 0.92;
export const WHEEL_ZOOM_IN = 1.08;
export const ROTATION_STEP = Math.PI / 2;
export const KEY_PAN_DISTANCE = 1.2;

// Same result as THREE.MathUtils.clamp(zoom, ZOOM_MIN, ZOOM_MAX).
export function clampZoom(zoom) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}

export function wheelZoom(zoom, deltaY) {
  return clampZoom(zoom * (deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN));
}

export function pinchZoom(zoom, previousDistance, distance) {
  return clampZoom(zoom * (distance / Math.max(1, previousDistance)));
}

// points: the active pointers as [{ x, y }, ...]; returns null unless there are two.
export function pinchMetrics(points) {
  const [first, second] = points;
  if (!first || !second) return null;
  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    angle: Math.atan2(second.y - first.y, second.x - first.x),
  };
}

// Shortest signed angle from `previous` to `current`, in [-PI, PI] (applied as two sequential wraps).
export function angleDelta(current, previous) {
  let delta = current - previous;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

// Turns an accumulated twist into whole quarter turns. A turn fires once the remainder reaches half a step.
// Returns the turn directions in order and the remaining accumulator.
export function rotationSteps(accumulated, step = ROTATION_STEP) {
  let remainder = accumulated;
  const directions = [];
  while (Math.abs(remainder) >= step / 2) {
    const direction = Math.sign(remainder);
    directions.push(direction);
    remainder -= direction * step;
  }
  return { directions, remainder };
}

// Q turns -1, E turns +1, anything else null. `key` is already lower-cased.
export function keyRotation(key) {
  if (key === 'q') return -1;
  if (key === 'e') return 1;
  return null;
}

// WASD and arrow keys as a pan direction in screen units (dx right, dy down); null for other keys.
export function keyPanStep(key) {
  if (!['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) return null;
  const dx = key === 'a' || key === 'arrowleft' ? 1 : key === 'd' || key === 'arrowright' ? -1 : 0;
  const dy = key === 'w' || key === 'arrowup' ? -1 : key === 's' || key === 'arrowdown' ? 1 : 0;
  return { dx, dy };
}
