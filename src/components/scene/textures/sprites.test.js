import test from 'node:test';
import assert from 'node:assert/strict';
import { installCanvasStub } from '../../../../test/canvasStub.js';
import { createSpriteTexture } from './sprites.js';

const fills = (calls) =>
  calls.filter((call) => call.op === 'set' && call.key === 'fillStyle').map((call) => call.value);

test('createSpriteTexture draws a 48x64 sprite and flips only the left view', () => {
  const stub = installCanvasStub();
  try {
    createSpriteTexture('player', '#4aa8ff', 'RECON', 'front');
    createSpriteTexture('player', '#4aa8ff', 'RECON', 'left');
    const [front, left] = stub.created;
    assert.equal(front.width, 48);
    assert.equal(front.height, 64);
    assert.ok(!front.calls.some((call) => call.op === 'translate'));
    assert.ok(left.calls.some((call) => call.op === 'translate' && call.args[0] === 48));
    assert.ok(left.calls.some((call) => call.op === 'scale' && call.args[0] === -1));
  } finally {
    stub.uninstall();
  }
});

test('createSpriteTexture uses the alien palette for alien units', () => {
  const stub = installCanvasStub();
  try {
    createSpriteTexture('alien', '#4aa8ff', 'RECON', 'front');
    createSpriteTexture('player', '#4aa8ff', 'RECON', 'front');
    const [alien, player] = stub.created.map((canvas) => fills(canvas.calls));
    assert.ok(alien.includes('#ff7770'));
    assert.ok(alien.includes('#39242d'));
    assert.ok(player.includes('#4aa8ff'));
    assert.ok(player.includes('#203737'));
    assert.ok(!player.includes('#ff7770'));
  } finally {
    stub.uninstall();
  }
});

test('enemy models draw different bodies and the default is the humanoid', () => {
  const stub = installCanvasStub();
  try {
    createSpriteTexture('alien', '#ff7770', 'RAIDER', 'front');
    createSpriteTexture('alien', '#ff7770', 'RAIDER', 'front', 'humanoid');
    createSpriteTexture('alien', '#ff7770', 'CRAWLER', 'front', 'crawler');
    createSpriteTexture('alien', '#ff7770', 'MONSTER', 'front', 'jellyfish');
    const [humanoid, humanoidExplicit, crawler, monster] = stub.created.map((canvas) => canvas.calls);
    assert.deepEqual(humanoid, humanoidExplicit);
    const shapes = [crawler, monster].map((calls) => JSON.stringify(calls));
    assert.equal(new Set([...shapes, JSON.stringify(humanoid)]).size, 3);
  } finally {
    stub.uninstall();
  }
});

test('class accessories are added only for their class', () => {
  const stub = installCanvasStub();
  try {
    createSpriteTexture('player', '#4aa8ff', 'RECON', 'front');
    createSpriteTexture('player', '#4aa8ff', 'FIELD MEDIC', 'front');
    createSpriteTexture('player', '#4aa8ff', 'ASSAULT', 'front');
    const [recon, medic, plain] = stub.created.map((canvas) => fills(canvas.calls));
    assert.ok(recon.includes('#98baff'));
    assert.ok(!medic.includes('#98baff'));
    assert.ok(medic.includes('#f5efc7'));
    assert.ok(!plain.includes('#f5efc7'));
    assert.ok(!plain.includes('#98baff'));
  } finally {
    stub.uninstall();
  }
});

test('each enemy model draws a distinct sprite from the humanoid', () => {
  const stub = installCanvasStub();
  try {
    const models = ['humanoid', 'crawler', 'jellyfish', 'stalker', 'raider', 'scout', 'guard', 'sneaker'];
    for (const model of models) createSpriteTexture('alien', '#d28cff', model.toUpperCase(), 'front', model);
    const sequences = stub.created.map((canvas) => JSON.stringify(canvas.calls));
    assert.equal(new Set(sequences).size, models.length);
  } finally {
    stub.uninstall();
  }
});

test('the stalker sprite uses its enemy colour for every body fill', () => {
  const stub = installCanvasStub();
  try {
    createSpriteTexture('alien', '#d28cff', 'STALKER', 'front', 'stalker');
    const [stalker] = stub.created.map((canvas) => fills(canvas.calls));
    assert.ok(stalker.includes('#d28cff'));
    assert.ok(!stalker.includes('#39242d'));
    assert.ok(!stalker.includes('#ff7770'));
  } finally {
    stub.uninstall();
  }
});
