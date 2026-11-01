// Pixel drawers for the non-humanoid enemy models: raider, scout, guard and sneaker (stalker and jellyfish live in their own files).
// Each takes the shared context { pixel, glow, armor, color, view } and draws on the 48x64 canvas.
import { drawStalker } from './spriteStalker.js';
import { drawJellyfish } from './spriteJellyfish.js';

const DARK = '#20302f';
const BONE = '#f2f0d0';
const BEAK = '#ffd9a8';
const EYE = '#eaffcf';

// Brute quadruped: wide low body, big head forward with horns and tusks, four thick stumpy legs. No arms.
function drawRaider({ pixel, glow, armor }) {
  pixel(8, 22, 18, 14, armor); // head, forward and lowered
  pixel(9, 20, 16, 2, glow); // brow
  pixel(9, 36, 3, 5, BONE); // tusks
  pixel(22, 36, 3, 5, BONE);
  pixel(10, 12, 3, 9, BONE); // horns
  pixel(20, 12, 3, 9, BONE);
  pixel(22, 26, 24, 16, armor); // low, wide body
  pixel(38, 22, 3, 5, BONE); // back spikes
  pixel(43, 24, 3, 5, BONE);
  for (const x of [22, 30, 38]) {
    pixel(x, 42, 6, 12, DARK); // four thick legs
  }
  pixel(10, 42, 6, 12, DARK);
  pixel(20, 54, 6, 4, glow);
  pixel(28, 54, 6, 4, glow);
  pixel(36, 54, 6, 4, glow);
  pixel(8, 54, 6, 4, glow);
}

// Horizontal bird: level body, forward-reaching neck and head with crest and beak, tail trailing backward, thin legs.
function drawScout({ pixel, glow, armor }) {
  pixel(14, 30, 22, 12, armor); // body lies level
  pixel(30, 20, 10, 12, armor); // head, forward
  pixel(34, 16, 3, 5, glow); // crest
  pixel(40, 24, 6, 3, BEAK); // beak
  pixel(35, 23, 2, 2, EYE);
  pixel(8, 26, 8, 3, armor); // tail, trailing back and up
  pixel(4, 22, 5, 3, armor);
  pixel(20, 42, 2, 20, DARK); // thin legs
  pixel(28, 42, 2, 20, DARK);
  pixel(18, 61, 6, 2, DARK); // feet
  pixel(26, 61, 6, 2, DARK);
}

// Beetle: large domed carapace, small head at the front, six short legs in three pairs.
function drawGuard({ pixel, glow, armor }) {
  pixel(12, 10, 24, 4, armor); // dome
  pixel(8, 14, 32, 6, armor);
  pixel(6, 20, 36, 12, armor);
  pixel(14, 12, 20, 2, glow); // shield ridge
  pixel(18, 38, 12, 8, armor); // head
  pixel(19, 40, 3, 2, EYE);
  pixel(26, 40, 3, 2, EYE);
  for (const y of [26, 34, 42]) {
    pixel(4, y, 6, 3, DARK); // left legs
    pixel(38, y, 6, 3, DARK); // right legs
  }
}

// Serpent: slim body built from tapering S-curved segments, small head, no legs.
function drawSneaker({ pixel, glow, armor, color }) {
  pixel(4, 42, 8, 5, armor); // tail
  pixel(12, 37, 8, 6, color);
  pixel(20, 32, 8, 6, armor);
  pixel(28, 27, 8, 6, color);
  pixel(34, 21, 8, 6, armor);
  pixel(35, 14, 10, 8, color); // head
  pixel(38, 17, 2, 2, glow); // eye
  pixel(41, 19, 4, 1, glow); // tongue line
}

// The stalker's body uses its own colour (not the alien glow) so it stays purple on alien units.
export const ENEMY_DRAWERS = {
  stalker: drawStalker,
  raider: drawRaider,
  scout: drawScout,
  guard: drawGuard,
  sneaker: drawSneaker,
  jellyfish: drawJellyfish,
};
