// Renders every player and enemy sprite to PNG files for visual inspection.
// Output goes to <project root>/test-output/unit-renders/ and is cleared at the start of each run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENEMY_TEMPLATES, PLAYER_TEMPLATES } from '../src/rules/templates.ts';
import { installCanvasStub } from './canvasStub.js';
import { createSpriteTexture } from '../src/components/scene/textures/sprites.js';
import { rasterizeCanvasCalls } from './helpers/rasterizeCanvasCalls.js';
import { encodePng, PNG_SIGNATURE } from './helpers/encodePng.js';
import { buildContactSheet } from './helpers/contactSheet.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWS = ['front', 'right', 'back', 'left'];

// Player units use the default humanoid model (no model field on the template).
const playerUnits = PLAYER_TEMPLATES.map((template) => ({
  team: 'player',
  label: template.id,
  model: undefined,
  template,
}));
// Enemy files are keyed by role: soldier and crawler share the 'crawler' model, so the model alone is ambiguous.
const enemyUnits = ENEMY_TEMPLATES.map((template) => ({
  team: 'alien',
  label: template.role,
  model: template.model,
  template,
}));

// Renders one unit in every view and returns the rasterized images keyed by view.
function renderUnit(stub, unit) {
  const images = {};
  for (const view of VIEWS) {
    const { template } = unit;
    const before = stub.created.length;
    createSpriteTexture(unit.team, template.color, template.className, view, unit.model);
    const canvas = stub.created[before];
    assert.equal(stub.created.length, before + 1, 'expected exactly one canvas per texture');
    images[view] = rasterizeCanvasCalls(canvas);
  }
  return images;
}

test('renders every player and enemy sprite to PNG files', () => {
  const outDir = path.join(PROJECT_ROOT, 'test-output', 'unit-renders');
  fs.mkdirSync(outDir, { recursive: true });
  for (const old of fs.readdirSync(outDir)) {
    if (old.endsWith('.png')) fs.unlinkSync(path.join(outDir, old));
  }
  console.log(`[renderUnitSprites] sprite PNGs written to: ${outDir}`);

  const stub = installCanvasStub();
  const written = [];
  try {
    const groups = [
      { name: 'players', units: playerUnits },
      { name: 'enemies', units: enemyUnits },
    ];
    for (const group of groups) {
      const rendered = group.units.map((unit) => ({ unit, images: renderUnit(stub, unit) }));

      for (const { unit, images } of rendered) {
        for (const view of VIEWS) {
          const file = `${unit.team}-${unit.label}-${view}.png`;
          fs.writeFileSync(path.join(outDir, file), encodePng(images[view]));
          written.push(file);
        }
      }

      // Contact sheet: one row per view, one column per unit, scaled 4x.
      const sheetRows = VIEWS.map((view) => rendered.map(({ images }) => images[view]));
      const sheetFile = `${group.name}.png`;
      fs.writeFileSync(path.join(outDir, sheetFile), encodePng(buildContactSheet(sheetRows, { scale: 4 })));
      written.push(sheetFile);
    }
  } finally {
    stub.uninstall();
  }

  const expectedUnitFiles = (playerUnits.length + enemyUnits.length) * VIEWS.length;
  assert.equal(written.length, expectedUnitFiles + 2, 'one PNG per unit per view plus two contact sheets');
  assert.equal(fs.readdirSync(outDir).length, written.length, 'output directory holds exactly the written files');

  for (const file of written) {
    const bytes = fs.readFileSync(path.join(outDir, file));
    assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${file} is not a PNG`);
    assert.ok(bytes.length > 64, `${file} is suspiciously small`);
  }
});
