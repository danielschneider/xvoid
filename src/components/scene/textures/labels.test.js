import test from 'node:test';
import assert from 'node:assert/strict';
import { installCanvasStub } from '../../../../test/canvasStub.js';
import { createCritTexture, createDamageTexture } from './labels.js';

const texts = (calls) => calls.filter((call) => call.op === 'fillText').map((call) => call.args[0]);
const fillStyles = (calls) =>
  calls.filter((call) => call.op === 'set' && call.key === 'fillStyle').map((call) => call.value);

test('createCritTexture paints the CRIT word on a 128x64 canvas', () => {
  const stub = installCanvasStub();
  try {
    createCritTexture();
    const canvas = stub.created[0];
    assert.equal(canvas.width, 128);
    assert.equal(canvas.height, 64);
    assert.deepEqual(texts(canvas.calls), ['CRIT']);
  } finally {
    stub.uninstall();
  }
});

test('createDamageTexture labels hits with damage and misses with MISS', () => {
  const stub = installCanvasStub();
  try {
    createDamageTexture({ hit: true, crit: false, damage: 2 });
    createDamageTexture({ hit: true, crit: true, damage: 3 });
    createDamageTexture({ hit: false, crit: false, damage: 0 });
    const [plain, crit, miss] = stub.created;
    assert.deepEqual(texts(plain.calls), ['-2']);
    assert.deepEqual(texts(crit.calls), ['CRIT -3']);
    assert.deepEqual(texts(miss.calls), ['MISS']);
    assert.ok(fillStyles(plain.calls).includes('#ff9580'));
    assert.ok(fillStyles(crit.calls).includes('#ffd34d'));
    assert.ok(fillStyles(miss.calls).includes('#9ce3e3'));
  } finally {
    stub.uninstall();
  }
});
