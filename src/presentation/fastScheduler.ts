// Fast mode: scales every presentation delay by a factor (e.g. ?fast=4 runs animations 4x faster).
// Wraps the scheduler passed to createDirector; game rules and the TIMING table are untouched.

// Timer API the director needs. Structurally satisfied by globalThis and by test fake clocks.
export interface Scheduler {
  setTimeout: (fn: () => void, delay: number, ...args: unknown[]) => unknown;
  clearTimeout: (handle: unknown) => void;
  setInterval: (fn: () => void, delay: number, ...args: unknown[]) => unknown;
  clearInterval: (handle: unknown) => void;
}

// Accepts "4", "4x" or a bare "fast" (= 4x). Anything else, or a factor <= 1, disables fast mode.
export function parseFastFactor(value: string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 1;
  if (value === 'fast' || value === 'true') return 4;
  const factor = Number.parseFloat(String(value).replace(/x$/i, ''));
  return Number.isFinite(factor) && factor > 1 ? factor : 1;
}

// base: a scheduler with setTimeout/clearTimeout/setInterval/clearInterval.
export function scaledScheduler(base: Scheduler, factor: number): Scheduler {
  if (factor <= 1) return base;
  const scale = (delay: number) => Math.max(0, Math.round(delay / factor));
  return {
    setTimeout: (fn, delay, ...args) => base.setTimeout(fn, scale(delay), ...args),
    clearTimeout: (handle) => base.clearTimeout(handle),
    setInterval: (fn, delay, ...args) => base.setInterval(fn, scale(delay), ...args),
    clearInterval: (handle) => base.clearInterval(handle),
  };
}
