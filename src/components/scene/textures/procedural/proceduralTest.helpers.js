import { installCanvasStub } from '../../../../../test/canvasStub.js';

// Runs generator(seed) against the canvas stub and returns the texture plus recorded pixel fills.
export function runGenerator(generator, seed) {
  const stub = installCanvasStub();
  try {
    const texture = generator(seed);
    const canvas = stub.created[0];
    const fills = canvas.calls
      .filter((call) => call.op === 'set' && call.key === 'fillStyle')
      .map((call) => call.value);
    return { texture, canvas, fills, rects: canvas.calls.filter((call) => call.op === 'fillRect') };
  } finally {
    stub.uninstall();
  }
}
