import { buildParts as buildHumanoid, DIMENSIONS as HUMANOID } from './bodyHumanoid.js';
import { buildParts as buildCrawler, DIMENSIONS as CRAWLER } from './bodyCrawler.js';
import { buildParts as buildJellyfish, DIMENSIONS as JELLYFISH } from './bodyJellyfish.js';
import { buildParts as buildStalker, DIMENSIONS as STALKER } from './bodyStalker.js';
import { buildParts as buildRaider, DIMENSIONS as RAIDER } from './bodyRaider.js';
import { buildParts as buildScout, DIMENSIONS as SCOUT } from './bodyScout.js';
import { buildParts as buildGuard, DIMENSIONS as GUARD } from './bodyGuard.js';
import { buildParts as buildSneaker, DIMENSIONS as SNEAKER } from './bodySneaker.js';

// Registry of 3D body shapes. Each entry: scale (multiplies the body and billboard), groundY (body offset),
// spriteY (billboard height at rest), labelY (hit-chance label height) and buildParts(unit).
const MODELS = {
  humanoid: { ...HUMANOID, buildParts: buildHumanoid },
  crawler: { ...CRAWLER, buildParts: buildCrawler },
  jellyfish: { ...JELLYFISH, buildParts: buildJellyfish },
  stalker: { ...STALKER, buildParts: buildStalker },
  raider: { ...RAIDER, buildParts: buildRaider },
  scout: { ...SCOUT, buildParts: buildScout },
  guard: { ...GUARD, buildParts: buildGuard },
  sneaker: { ...SNEAKER, buildParts: buildSneaker },
};

// Unknown or missing models fall back to the humanoid.
export function resolveModel(model) {
  return Object.hasOwn(MODELS, model) ? model : 'humanoid';
}

// Layout numbers for a model (scale, groundY, spriteY, labelY) without building any parts.
export function modelDimensions(model) {
  const { scale, groundY, spriteY, labelY } = MODELS[resolveModel(model)];
  return { scale, groundY, spriteY, labelY };
}

// The 3D parts for a unit: { scale, groundY, spriteY, labelY, parts, rifle }. rifle is null when the model has none.
export function buildBody(model, unit) {
  const entry = MODELS[resolveModel(model)];
  return { ...modelDimensions(model), ...entry.buildParts(unit) };
}
