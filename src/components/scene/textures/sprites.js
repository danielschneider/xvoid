import * as THREE from 'three';
import { ENEMY_DRAWERS } from './spriteEnemies.js';

// Enemy sprite models. Each one is drawn with the same pixel helper on a 48x64 canvas.
// `humanoid` is the default and is used by player units.
export const SPRITE_MODELS = ['humanoid', 'crawler', 'jellyfish', 'stalker', 'raider', 'scout', 'guard', 'sneaker'];

// Small low crawler: flat armored shell, four splayed legs, two glowing eyes.
function drawCrawler({ pixel, glow, armor, view }) {
  pixel(12, 34, 24, 12, armor);
  pixel(15, 32, 18, 3, armor);
  if (view === 'back') {
    pixel(14, 37, 20, 2, glow);
    pixel(18, 41, 12, 3, '#547b70');
  } else {
    pixel(17, 37, 4, 4, '#eaffcf');
    pixel(27, 37, 4, 4, '#eaffcf');
    pixel(20, 39, 1, 1, glow);
    pixel(26, 39, 1, 1, glow);
  }
  // Four short legs splayed outward from the shell.
  pixel(6, 39, 6, 3, armor);
  pixel(4, 42, 4, 4, '#20302f');
  pixel(36, 39, 6, 3, armor);
  pixel(40, 42, 4, 4, '#20302f');
  pixel(10, 43, 5, 3, armor);
  pixel(14, 46, 4, 4, '#20302f');
  pixel(33, 43, 5, 3, armor);
  pixel(30, 46, 4, 4, '#20302f');
  pixel(3, 42, 3, 2, glow);
  pixel(42, 42, 3, 2, glow);
  pixel(20, 46, 8, 4, '#20302f');
  pixel(19, 50, 3, 3, glow);
  pixel(26, 50, 3, 3, glow);
}

const MODEL_DRAWERS = { crawler: drawCrawler, ...ENEMY_DRAWERS };

// Pixel sprite for one unit, drawn on a 48x64 canvas. `view` is front, back, left or right.
// `model` picks the body shape; unknown or missing models use the default humanoid.
export function createSpriteTexture(team, color, className, view, model = 'humanoid') {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  const pixel = (x, y, width, height, fill) => {
    context.fillStyle = fill;
    context.fillRect(x, y, width, height);
  };
  const glow = team === 'alien' ? '#ff7770' : color;
  const armor = team === 'alien' ? '#39242d' : '#203737';
  const sideView = view === 'left' || view === 'right';
  if (view === 'left') {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  const drawModel = MODEL_DRAWERS[model];
  if (drawModel) {
    drawModel({ pixel, glow, armor, team, view, color });
  } else {
    pixel(sideView ? 19 : 18, 3, sideView ? 10 : 12, 3, glow);
    pixel(sideView ? 17 : 15, 6, sideView ? 14 : 18, 13, '#a8c3b8');
    pixel(sideView ? 14 : 13, 10, 3, 6, armor);
    pixel(sideView ? 31 : 32, 10, 3, 6, armor);
    pixel(sideView ? 18 : 16, 18, sideView ? 12 : 16, 2, glow);
    pixel(sideView ? 14 : 11, 21, sideView ? 20 : 26, 20, armor);
    pixel(sideView ? 10 : 8, 23, 5, 16, glow);
    pixel(sideView ? 34 : 35, 23, 5, 16, glow);
    pixel(sideView ? 17 : 14, 24, sideView ? 15 : 20, 7, '#547b70');
    pixel(sideView ? 20 : 20, 31, 8, 8, glow);
    pixel(sideView ? 15 : 14, 41, 7, 15, '#20302f');
    pixel(sideView ? 27 : 26, 41, 7, 15, '#20302f');
    pixel(sideView ? 12 : 10, 55, 10, 4, glow);
    pixel(sideView ? 27 : 26, 55, 10, 4, glow);
    if (view === 'back') {
      pixel(18, 9, 12, 5, '#36524c');
      pixel(22, 21, 4, 19, '#71877b');
      pixel(18, 27, 12, 3, glow);
    } else if (sideView) {
      pixel(23, 10, 7, 4, team === 'alien' ? '#ffb19a' : '#eaffcf');
      pixel(28, 27, 12, 4, '#718078');
      pixel(37, 26, 8, 2, '#c5c3a3');
      pixel(30, 31, 3, 5, '#35433d');
      pixel(31, 25, 4, 2, glow);
    } else {
      pixel(19, 10, 3, 3, team === 'alien' ? '#ffb19a' : '#eaffcf');
      pixel(24, 10, 3, 3, team === 'alien' ? '#ffb19a' : '#eaffcf');
      pixel(28, 28, 11, 4, '#718078');
      pixel(37, 27, 8, 2, '#c5c3a3');
      pixel(31, 32, 3, 5, '#35433d');
      pixel(33, 25, 4, 2, glow);
    }
    if (className === 'RECON') pixel(36, 20, 4, 28, '#98baff');
    if (className === 'FIELD MEDIC') pixel(20, 23, 8, 3, '#f5efc7');
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
