// Pure impact and tracer timing for shot effects. No three.js or React imports.
// Values are seconds, world units, or counts; no rules RNG is used (visuals only).

export const SHAKE_DURATION = 0.16;
export const TRACER_MISS_EXTRA = 1.4;
export const TRACER_TRAIL = 1.6;
export const PARTICLE_LIFE = 0.4;

// Cover is the { cover } object from getCoverAgainst, or a bare tier number.
function coverTier(cover) {
  if (typeof cover === 'number') return cover;
  return cover?.cover ?? 0;
}

// Which kind of impact a shot produces. Crit wins over cover; a miss has no impact.
export function impactKind(shot, cover) {
  if (!shot.hit) return 'miss';
  if (shot.crit) return 'crit';
  return coverTier(cover) > 0 ? 'cover' : 'open';
}

const SPECS = {
  miss: { sparkCount: 0, dustCount: 0, shakeStrength: 0.018, lightIntensity: 0 },
  // Hits on cover kick up dust and a few chips.
  cover: { sparkCount: 3, dustCount: 8, shakeStrength: 0.04, lightIntensity: 1.5 },
  // Open-ground hits throw sparks.
  open: { sparkCount: 10, dustCount: 2, shakeStrength: 0.055, lightIntensity: 3 },
  // Crits: a bigger burst, stronger shake and light.
  crit: { sparkCount: 18, dustCount: 8, shakeStrength: 0.085, lightIntensity: 4.5 },
};

export function impactSpec(shot, cover) {
  const kind = impactKind(shot, cover);
  return { kind, ...SPECS[kind] };
}

// Tracer travel time: the head reaches the far end after this many seconds.
export function travelDuration(enemyShot) {
  return enemyShot ? 0.3 : 0.2;
}

// Total path length of the tracer. Misses run past the target by a fixed extra length.
export function tracerLength(distance, hit) {
  return hit ? distance : distance + TRACER_MISS_EXTRA;
}

// Camera shake offsets. Decays linearly to zero over `duration`; y is slightly
// damped relative to x, matching the original hit shake.
export function shakeAt(elapsed, duration, strength) {
  if (duration <= 0 || elapsed >= duration) return { x: 0, y: 0 };
  const amount = 1 - Math.max(0, elapsed) / duration;
  return {
    // Adding 0 turns a negative zero (zero strength) into +0.
    x: Math.sin(elapsed * 88) * amount * strength + 0,
    y: Math.cos(elapsed * 72) * amount * strength * 0.73 + 0,
  };
}

function hash(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Deterministic burst directions for particles, keyed by seed (e.g. shot id).
// Each velocity leans upwards and is returned as { x, y, z } in world units per second.
export function burstVelocities(count, seed) {
  return Array.from({ length: count }, (_, index) => {
    const angle = hash(seed * 31 + index * 7 + 1) * Math.PI * 2;
    const up = 0.35 + hash(seed * 17 + index * 13 + 2) * 0.65;
    const horizontal = Math.sqrt(1 - up * up);
    const speed = 1.2 + hash(seed * 5 + index * 3 + 3) * 1.4;
    return {
      x: Math.cos(angle) * horizontal * speed,
      y: up * speed,
      z: Math.sin(angle) * horizontal * speed,
    };
  });
}
