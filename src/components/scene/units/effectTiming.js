// Timing constants and pure formulas for the unit effects (fire recoil, muzzle flash,
// crit pop and fall). No three.js or React imports; all values are seconds or 0..1 ratios.

export const FIRE_DURATION = 0.3;
export const MUZZLE_DURATION = 0.08;
export const CRIT_DURATION = 0.9;
export const FALL_RATE = 2.5;

// Crit overlay: pops in, holds, then fades out over CRIT_DURATION.
export function critFrame(elapsed) {
  const critT = elapsed / CRIT_DURATION;
  const visible = critT < 1;
  return {
    visible,
    opacity: visible ? Math.min(1, critT * 6) * (1 - Math.max(0, critT - 0.6) / 0.4) : 0,
    scale: 1 + Math.max(0, 0.35 - critT) * 1.5,
  };
}

// Recoil envelope: sharp kick at the shot, ease back to rest over FIRE_DURATION.
export function recoilAt(elapsed) {
  const fireT = Math.min(1, elapsed / FIRE_DURATION);
  return fireT < 1 ? Math.sin(Math.PI * fireT) * (1 - fireT * 0.5) : 0;
}

// Muzzle flash: fades and shrinks over MUZZLE_DURATION.
export function muzzleFrame(elapsed) {
  const flash = Math.max(0, 1 - elapsed / MUZZLE_DURATION);
  return {
    visible: flash > 0,
    scale: 0.6 + flash * 0.6,
    opacity: flash,
  };
}

// Fall progress: 0 while alive; rises towards 1 once dead.
export function fallStep(fall, dead, delta) {
  return dead ? Math.min(1, fall + delta * FALL_RATE) : 0;
}

// Smoothstep of the fall progress, used as the body pose.
export function fallPose(fall) {
  return fall * fall * (3 - 2 * fall);
}
