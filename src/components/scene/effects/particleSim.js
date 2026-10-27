// Pure particle pool for visual effects. No three.js or React imports.
// Positions, velocities, colours and sizes live in typed arrays so the renderer can
// share them directly. Randomness for visuals comes from mulberry32 (not rules/rng.js).

// Seeded PRNG returning floats in [0, 1). Same seed, same sequence.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Parses '#rrggbb' into [r, g, b] floats in 0..1.
export function hexColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createPool(capacity) {
  const n = Math.max(1, Math.floor(capacity));
  return {
    capacity: n,
    positions: new Float32Array(n * 3),
    velocities: new Float32Array(n * 3),
    life: new Float32Array(n),
    maxLife: new Float32Array(n),
    size: new Float32Array(n),
    color: new Float32Array(n * 3),
    cursor: 0,
    alive: 0,
  };
}

export function aliveCount(pool) {
  return pool.alive;
}

// Writes one particle into a free slot (searching forward from the cursor). When the pool
// is full the slot under the cursor is reused, which is the oldest particle in write order.
// Returns the slot index, or -1 if the spawn has no lifetime.
export function spawn(pool, p) {
  if (!(p.life > 0)) return -1;
  const n = pool.capacity;
  let slot = -1;
  for (let k = 0; k < n; k += 1) {
    const i = (pool.cursor + k) % n;
    if (pool.life[i] <= 0) {
      slot = i;
      break;
    }
  }
  if (slot < 0) {
    slot = pool.cursor;
  } else {
    pool.alive += 1;
  }
  const j = slot * 3;
  pool.positions[j] = p.x;
  pool.positions[j + 1] = p.y;
  pool.positions[j + 2] = p.z;
  pool.velocities[j] = p.vx;
  pool.velocities[j + 1] = p.vy;
  pool.velocities[j + 2] = p.vz;
  pool.life[slot] = p.life;
  pool.maxLife[slot] = p.life;
  pool.size[slot] = p.size;
  pool.color[j] = p.color[0];
  pool.color[j + 1] = p.color[1];
  pool.color[j + 2] = p.color[2];
  pool.cursor = (slot + 1) % n;
  return slot;
}

// Advances all live particles by dt seconds: gravity on vy, then position, then lifetime.
// Particles whose life runs out are marked dead (life 0).
export function step(pool, dt, gravity = 0) {
  const { life, positions, velocities, capacity } = pool;
  for (let i = 0; i < capacity; i += 1) {
    if (life[i] <= 0) continue;
    const j = i * 3;
    velocities[j + 1] += gravity * dt;
    positions[j] += velocities[j] * dt;
    positions[j + 1] += velocities[j + 1] * dt;
    positions[j + 2] += velocities[j + 2] * dt;
    life[i] -= dt;
    if (life[i] <= 0) {
      life[i] = 0;
      pool.alive -= 1;
    }
  }
}

// Spawn list for a radial burst: one particle per velocity, starting at origin.
export function burstSpawns(origin, velocities, { life, size, color }) {
  return velocities.map((v) => ({
    x: origin.x,
    y: origin.y,
    z: origin.z,
    vx: v.x,
    vy: v.y,
    vz: v.z,
    life,
    size,
    color,
  }));
}

// Spawn list for a forward cone around dir (a unit {x,y,z}). Directions are drawn from rng.
// `spread` is the maximum angle from dir in radians; speeds are uniform in [speedMin, speedMax].
export function coneSpawns(rng, origin, dir, count, { speedMin, speedMax, spread, life, size, color }) {
  const helper = Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  // u = normalize(dir x helper), v = dir x u: an orthonormal frame around dir.
  let ux = dir.y * helper.z - dir.z * helper.y;
  let uy = dir.z * helper.x - dir.x * helper.z;
  let uz = dir.x * helper.y - dir.y * helper.x;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const vx = dir.y * uz - dir.z * uy;
  const vy = dir.z * ux - dir.x * uz;
  const vz = dir.x * uy - dir.y * ux;
  const spawns = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * spread;
    const phi = rng() * Math.PI * 2;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const ox = (ux * Math.cos(phi) + vx * Math.sin(phi)) * s;
    const oy = (uy * Math.cos(phi) + vy * Math.sin(phi)) * s;
    const oz = (uz * Math.cos(phi) + vz * Math.sin(phi)) * s;
    const speed = speedMin + rng() * (speedMax - speedMin);
    spawns.push({
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: (dir.x * c + ox) * speed,
      vy: (dir.y * c + oy) * speed,
      vz: (dir.z * c + oz) * speed,
      life,
      size,
      color,
    });
  }
  return spawns;
}
