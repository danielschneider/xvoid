# XVoid: Architecture and Working Notes

Read this first. The per-session refactoring log is archived at `docs/history/refactoring-log.md` (do not edit it).

## Layout

Dependency direction: `rules` (pure) <- `selectors` <- UI (`components`, `App.jsx`).

- `src/rules/` (TypeScript, pure, deterministic). No React, Three.js, `window`, `document`, `Date`, or `Math.random`.
  - `index.ts` is the public API. UI and selectors import from it only.
  - `constants.ts`, `templates.ts`, `types.ts`, `rng.ts`, `geometry.ts`.
  - `grid/` (cells, generation, buildings, connectivity), `movement/` (pathfinding, `moveUnit`), `sight/` (line of sight, fog), `combat/` (cover, hit chance, trajectory, `resolveShot`), `ai/` (`enemyStep`, roles, alerts, cover-taking, wandering), `turns/` (reducer, actions, ready unit), `spawn/` (placement, initial state).
- `src/selectors/` (JS): derived view data such as `combatPreview.js` and `hud.js`. Reads `rules/index.ts` only.
- `src/presentation/` (JS and TS): event constructors (`events.ts`), log strings (`logText.ts`), animation delays (`timing.js`), and the director that drives enemy steps and movement timing.
- `src/persistence/`: save and load.
- `src/engine/`: compatibility facades (`game.js`, `map.js`) that re-export `rules/` for older imports. New code should import `rules/index.ts` instead.
- `src/components/`: React UI. `TacticalHud.jsx` composes panels in `hud/`. `GameScene.jsx` composes the Three.js scene in `scene/` (`terrain/`, `overlays/`, `units/`, `camera/`, `effects/`, `textures/`). `copy.js` holds all HUD text.
- `src/styles/`: CSS split by component, with design tokens in `tokens.css`.
- `src/App.jsx`, `src/main.jsx`: app shell and wiring.
- `test/`: `fixtures.js` (shared builders), `canvasStub.js`, and `fixtures/golden-hashes.json`.

## Dependency rules

Enforced by `eslint.config.js`:

- `src/rules/**` (non-test) may not import `react`, `react-dom`, `three`, or `@react-three/*`.
- `src/rules/**` may not use `window`, `document`, `Date`, or `Math.random`. Randomness comes from `rules/rng.ts` with a cursor in state.
- `src/rules/**` may not import `src/components`, `App.jsx`, or `main.jsx`.
- `src/components`, `App.jsx`, `main.jsx`, and `src/selectors` may import `rules/` only through `rules/index.ts`.

## Commands

- `npm run check` runs `lint`, `typecheck`, `format:check`, `test`, and `build`. CI runs this same command.
- `npm test` runs the test files listed explicitly in `package.json`. A new test directory must be added to that glob.
- `npm run typecheck` runs `tsc` over `src/rules/**/*.ts` (`tsconfig.json`, `strict`).
- `npm run format` and `npm run format:check` use Prettier (`.prettierrc.json`).

## Golden fixture

`test/fixtures/golden-hashes.json` holds hashes of map generation and starting units for seeds 1..60 (`src/engine/golden.test.js`). It is the main regression guard for rules changes.

- It must not change unless a rule change is intended.
- Regenerate only with `GOLDEN_REGENERATE=1 npm test`, and state the reason in the commit message.
- The hashes were generated from the code at commit `c816ce0`. They are not a pre-refactor baseline.

## Conventions

- Keep source files small and focused. Split a file that takes on a second responsibility.
- Rules return new state and events. They do not mutate inputs or build display strings.
- All player-facing text lives in `src/components/copy.js` (HUD) or `src/presentation/logText.ts` (log).
- Balance numbers live in `src/rules/constants.ts`. Do not duplicate them in UI code.
