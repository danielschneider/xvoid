import test from 'node:test';
import assert from 'node:assert/strict';
import { COPY } from './copy.js';

// Pins the D11 (7e2) wording. A change here means visible copy changed.
test('HUD labels use the D11 German wording; mission title is unchanged', () => {
  assert.equal(COPY.tactical.enemyTurn.trim(), 'GEGNERISCHER ZUG');
  assert.equal(COPY.shared.flanked, 'FLANKIERT');
  assert.equal(COPY.topBar.mission, 'SEKTOR 07 / NEMESIS');
  assert.equal(COPY.squad.overwatch.trim(), 'ÜBERWACHUNG');
});

test('German HUD copy keeps its wording', () => {
  assert.equal(COPY.combat.noTarget, 'KEIN ZIEL ERFASST');
  assert.equal(COPY.combat.shootable, 'FEIND IM SCHUSSFELD');
  assert.equal(COPY.dialog.title, 'NEUES SPIEL STARTEN');
  assert.equal(COPY.dialog.confirm.trim(), 'NEUES SPIEL');
  assert.equal(COPY.dock.endTurn, 'ZUG BEENDEN');
});

test('parameterised copy produces the same text the markup produced', () => {
  assert.equal(COPY.topBar.round(3), 'R-03');
  assert.equal(COPY.topBar.round(12), 'R-12');
  assert.equal(COPY.combat.targetMeta('RECON', 4.4), 'RECON · 4 M');
  assert.equal(COPY.combat.coverValue(40), '−40%');
  assert.equal(COPY.dock.confirmMoveTitle(2), 'Bewegung für 2 AP bestätigen');
  assert.equal(COPY.squad.apLabel(1), '1 Aktionspunkte');
  assert.equal(COPY.position.openSides(['Nord', 'Ost']), 'Offen: Nord, Ost · Angriffe von dort flankieren');
  assert.equal(COPY.shared.actionTitle('Feuern', 'O'), 'Feuern · O');
  assert.equal(COPY.shared.actionTitle('Feuern'), 'Feuern');
});
