// Jellyfish pixel drawer: a domed head with a glowing core, and six tentacles hanging from its rim. No arms or legs.
// Takes the shared context { pixel, glow, armor } and draws on the 48x64 canvas.
const EYE = '#eaffcf';

export function drawJellyfish({ pixel, glow, armor }) {
  pixel(10, 8, 28, 4, armor); // dome, top
  pixel(7, 12, 34, 10, armor); // dome, widest part
  pixel(10, 22, 28, 4, armor); // dome rim
  pixel(14, 14, 20, 2, glow); // glowing band
  pixel(18, 18, 3, 3, EYE); // core
  pixel(27, 18, 3, 3, EYE);
  // Six tentacles hanging from the rim, alternating sway, with glowing tips.
  for (const [x, sway] of [
    [9, -2],
    [15, 2],
    [21, -2],
    [27, 2],
    [33, -2],
    [39, 2],
  ]) {
    pixel(x, 26, 3, 10, armor);
    pixel(x + sway, 36, 3, 10, armor);
    pixel(x, 46, 3, 8, armor);
    pixel(x + sway, 54, 3, 6, glow);
  }
}
