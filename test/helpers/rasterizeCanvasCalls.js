// Replays the calls recorded by test/canvasStub.js onto an RGBA buffer, so unit sprites can be
// written out as real images. Supports clearRect, fillRect, translate, scale and fillStyle (#rrggbb).
// Other recorded operations (text, strokes, save/restore) are ignored: sprites do not use them.

function parseHexColor(value) {
  const match = /^#([0-9a-fA-F]{6})$/.exec(value);
  if (!match) throw new Error(`rasterizeCanvasCalls: unsupported fillStyle "${value}"`);
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

// Affine matrix [a, b, c, d, e, f] mapping user space to device space, as in the 2D canvas API.
const IDENTITY = [1, 0, 0, 1, 0, 0];

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function multiplyTranslate(m, tx, ty) {
  return [m[0], m[1], m[2], m[3], m[4] + m[0] * tx + m[2] * ty, m[5] + m[1] * tx + m[3] * ty];
}

function multiplyScale(m, sx, sy) {
  return [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]];
}

function fillUserRect(image, matrix, x, y, width, height, rgba) {
  const [a, b, c, d, e, f] = matrix;
  const det = a * d - b * c;
  if (det === 0) return;
  const corners = [
    apply(matrix, x, y),
    apply(matrix, x + width, y),
    apply(matrix, x, y + height),
    apply(matrix, x + width, y + height),
  ];
  const minX = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))));
  const maxX = Math.min(image.width, Math.ceil(Math.max(...corners.map((p) => p[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))));
  const maxY = Math.min(image.height, Math.ceil(Math.max(...corners.map((p) => p[1]))));
  for (let py = minY; py < maxY; py++) {
    for (let px = minX; px < maxX; px++) {
      // Sample the pixel centre and map it back into user space to test containment.
      const dx = px + 0.5 - e;
      const dy = py + 0.5 - f;
      const u = (d * dx - c * dy) / det;
      const v = (-b * dx + a * dy) / det;
      if (u < x || u >= x + width || v < y || v >= y + height) continue;
      const index = (py * image.width + px) * 4;
      image.data.set(rgba, index);
    }
  }
}

// Returns { width, height, data } where data is RGBA8 (Uint8Array), transparent where nothing was drawn.
export function rasterizeCanvasCalls(canvas) {
  const image = {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(canvas.width * canvas.height * 4),
  };
  let matrix = IDENTITY;
  let fillRgba = [0, 0, 0, 255];
  for (const call of canvas.calls) {
    if (call.op === 'set' && call.key === 'fillStyle') {
      fillRgba = parseHexColor(call.value);
    } else if (call.op === 'translate') {
      matrix = multiplyTranslate(matrix, call.args[0], call.args[1]);
    } else if (call.op === 'scale') {
      matrix = multiplyScale(matrix, call.args[0], call.args[1]);
    } else if (call.op === 'fillRect') {
      const [x, y, width, height] = call.args;
      fillUserRect(image, matrix, x, y, width, height, fillRgba);
    }
  }
  return image;
}
