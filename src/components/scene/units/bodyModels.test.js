import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBody, modelDimensions } from './bodyModels.js';

const unit = { team: 'alien', color: '#ff7770' };
const ANIMALS = ['crawler', 'jellyfish'];
const ENEMY_MODELS = ['stalker', 'raider', 'scout', 'guard', 'sneaker'];
const ALL_MODELS = ['humanoid', ...ANIMALS, ...ENEMY_MODELS];

// Comparable signature of a part list: shape, size and position, ignoring colour.
const signature = (parts) => JSON.stringify(parts.map(({ shape, size, position }) => ({ shape, size, position })));

test('humanoid parts keep the original body layout and rifle', () => {
  const body = buildBody('humanoid', unit);
  assert.equal(body.parts.length, 5);
  assert.deepEqual(
    body.parts.map((part) => part.position[1]),
    [0.79, 1.05, 1.31, 0.31, 0.31]
  );
  assert.equal(body.scale, 1);
  assert.equal(body.groundY, 0);
  assert.equal(body.spriteY, 0.82);
  assert.deepEqual(body.rifle.position, [0.28, 0.91, 0.16]);
  assert.equal(body.rifle.parts.length, 2);
});

test('each animal model has its own part list and sprite height', () => {
  const humanoid = buildBody('humanoid', unit);
  const shapes = [humanoid, ...ANIMALS.map((model) => buildBody(model, unit))].map((body) => signature(body.parts));
  assert.equal(new Set(shapes).size, 3);
  assert.equal(new Set(ANIMALS.map((model) => modelDimensions(model).spriteY)).size, 2);
});

test('crawler is scaled away from humanoid and jellyfish is larger', () => {
  assert.ok(modelDimensions('crawler').scale < 1);
  assert.ok(modelDimensions('jellyfish').scale > 1);
});

test('every model has a distinct part list signature', () => {
  const shapes = ALL_MODELS.map((model) => signature(buildBody(model, unit).parts));
  assert.equal(new Set(shapes).size, ALL_MODELS.length);
});

test('enemy models have their own silhouette and sizes', () => {
  const dims = Object.fromEntries(ALL_MODELS.map((model) => [model, modelDimensions(model)]));
  assert.ok(dims.stalker.scale > 1 && dims.stalker.spriteY > dims.humanoid.spriteY);
  assert.ok(dims.scout.scale < 1);
  assert.ok(dims.guard.scale > 1);
  assert.ok(dims.sneaker.scale < dims.humanoid.scale);
  for (const model of ENEMY_MODELS) assert.ok(dims[model].labelY > dims[model].spriteY);
});

test('enemy models render with the enemy colour for the stalker and no rifle', () => {
  const stalker = buildBody('stalker', unit);
  assert.ok(stalker.parts.every((part) => part.color === unit.color));
  for (const model of ENEMY_MODELS) assert.equal(buildBody(model, unit).rifle, null);
});

test('animals carry no rifle', () => {
  for (const model of ANIMALS) assert.equal(buildBody(model, unit).rifle, null);
});

test('no enemy model shares the humanoid part list signature', () => {
  const humanoid = signature(buildBody('humanoid', unit).parts);
  for (const model of ALL_MODELS.filter((name) => name !== 'humanoid')) {
    assert.notEqual(signature(buildBody(model, unit).parts), humanoid, `${model} matches the humanoid layout`);
  }
});

test('no enemy model has a rifle, and only the player humanoid carries one', () => {
  assert.ok(buildBody('humanoid', unit).rifle);
  for (const model of ALL_MODELS.filter((name) => name !== 'humanoid')) {
    assert.equal(buildBody(model, unit).rifle, null, `${model} carries a rifle`);
  }
});

test('jellyfish is a floating dome with tentacles: no legs, no arms and no upright head stack', () => {
  const { parts } = buildBody('jellyfish', unit);
  const upright = parts.filter((part) => part.shape === 'box' && part.position[1] < 0.2 && part.size[1] > 0.3);
  assert.equal(upright.length, 0, 'jellyfish has a limb standing on the ground');
  assert.ok(parts.filter((part) => part.shape === 'box' && part.position[1] < 0.5).length >= 8, 'expected 8 tentacles');
  assert.equal(buildBody('jellyfish', unit).rifle, null);
});

test('stalker is a spider: eight legs, no arms and no upright head stack', () => {
  const { parts } = buildBody('stalker', unit);
  const legs = parts.filter((part) => part.shape === 'box' && part.rotation && part.size[1] > 0.2);
  assert.ok(legs.length >= 16, 'expected eight jointed legs, two boxes each');
  const tallest = Math.max(...parts.map((part) => part.position[1]));
  assert.ok(tallest < 0.7, `stalker stands too tall (${tallest}) to be a biped`);
});

test('unknown or missing model falls back to humanoid', () => {
  const humanoid = buildBody('humanoid', unit);
  for (const model of [undefined, null, 'dragon', 'constructor']) {
    const body = buildBody(model, unit);
    assert.equal(signature(body.parts), signature(humanoid.parts));
    assert.equal(body.scale, humanoid.scale);
  }
});
