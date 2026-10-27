import * as THREE from 'three';

// Pixel sprite for one unit, drawn on a 48x64 canvas. `view` is front, back, left or right.
export function createSpriteTexture(team, color, className, view) {
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
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
