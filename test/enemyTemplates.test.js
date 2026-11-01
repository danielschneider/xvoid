import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_TEMPLATES, PLAYER_TEMPLATES } from '../src/rules/templates.ts';
import { buildBody, resolveModel } from '../src/components/scene/units/bodyModels.js';
import { SPRITE_MODELS } from '../src/components/scene/textures/sprites.js';

const PLAYER_CLASS_NAMES = PLAYER_TEMPLATES.map((unit) => unit.className);

test('every enemy template has a string model registered in the 3D body registry', () => {
  for (const template of ENEMY_TEMPLATES) {
    assert.equal(typeof template.model, 'string', `${template.name} has no model`);
    assert.equal(
      resolveModel(template.model),
      template.model,
      `${template.name}: "${template.model}" is not registered`
    );
  }
});

test('every enemy template model is a registered sprite drawer', () => {
  for (const template of ENEMY_TEMPLATES) {
    assert.ok(SPRITE_MODELS.includes(template.model), `${template.name}: "${template.model}" has no sprite drawer`);
  }
});

test('no enemy template uses the humanoid model', () => {
  for (const template of ENEMY_TEMPLATES) {
    assert.notEqual(template.model, 'humanoid', `${template.name} renders as a player humanoid`);
  }
});

test('no enemy className collides with a player class name', () => {
  for (const template of ENEMY_TEMPLATES) {
    assert.ok(
      !PLAYER_CLASS_NAMES.includes(template.className),
      `${template.name} uses player class ${template.className}`
    );
  }
});

test('every enemy template body differs from the humanoid layout', () => {
  const unit = { team: 'alien', color: '#ffffff' };
  const layout = (model) =>
    JSON.stringify(buildBody(model, unit).parts.map(({ shape, size, position }) => ({ shape, size, position })));
  const humanoid = layout('humanoid');
  for (const template of ENEMY_TEMPLATES) {
    assert.notEqual(layout(template.model), humanoid, `${template.name} has the humanoid body layout`);
  }
});

test('enemy templates share a model only for the crawler (Void Crawler and Void Soldier)', () => {
  const counts = new Map();
  for (const template of ENEMY_TEMPLATES) counts.set(template.model, (counts.get(template.model) ?? 0) + 1);
  const shared = [...counts].filter(([, count]) => count > 1).map(([model]) => model);
  assert.deepEqual(shared, ['crawler']);
});
