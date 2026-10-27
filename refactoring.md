# XVoid: Refactoring Proposals

## Status

Read this first in every session. Work one chunk per session; stop when its acceptance check passes.

- [x] Chunk 1: Commit Phase 0 and add a safety net (done)
  - Phase 0 code committed as `c816ce0` ("refa1"); golden test and `test/fixtures/golden-hashes.json` are in that commit
  - `npm run check` (test + build) added in `8ef1549`
  - Verified: `npm run check` passed, 48/48 including golden test, golden hashes unchanged (fixture not modified in `8ef1549`)
- [ ] Chunk 2: Phase 1, single source of truth (D2, D3, D4, D6). Split into sub-chunks because one session hit the output limit. Do one sub-chunk per session, commit it, then stop.
  - [x] 2a: `rules/constants.js` and `rules/templates.js`; replace AP, range and move literals (D4). Acceptance: `npm run check` passes, golden hashes unchanged. (done: 48/48, build ok, fixture unchanged; `game.js` and `map.js` re-export the old names)
  - [x] 2b: state-carried RNG and id counter; remove `Date.now()` and `Math.random` defaults; delete duplicate `makeRandom` (D3, D5). Keep the `createInitialState(seed, generation)` signature. Acceptance: `npm run check` passes, golden hashes unchanged. (done: single LCG in `rules/rng.js` with cursor in `state.rng`, `state.nextId` for movement/shot ids, 48/48, fixture unchanged, grep clean; game tests use a `withDraws` cursor helper instead of stubbing `Math.random`)
  - [x] 2c: `selectors/combatPreview.js` calls `computeHitChance` and `getCoverAgainst`; HUD has no hit-chance arithmetic (D2). Add a parity test over a grid of shooter/target configs. Acceptance: `npm run check` passes. (done: 50/50 incl. parity grid in `selectors/combatPreview.test.js`; `game.js` exports `computePlayerHitParts` so the HUD breakdown reads engine terms; `npm test` glob now includes `src/selectors`; fixture unchanged)
  - [x] 2d: `getNextReadyUnit(state)` in `rules/turns/`, used by reducer and App (D6). Acceptance: `npm run check` passes. (done: `rules/turns/readyUnit.js` walks roster order from the selected unit; `game.js` `selectNextReadyPlayer` and App `readyUnits` both call it, circular sort removed; `rules/turns/readyUnit.test.js` covers 6 states incl. only-self and no-ready; `npm test` glob now includes `src/rules/turns`; 56/56, build ok, fixture unchanged)
  - If a sub-chunk still produces too much output, split it further and record the new split here before editing code.
- [x] Chunk 3: Phase 2a, split `map.js` (no behavior change) (done: modules in `rules/grid/{cells,connectivity,generate}.js`, `rules/movement/pathfinding.js`, `rules/sight/{line,fog}.js`, `rules/combat/cover.js`; `engine/map.js` is now a re-export facade so importers are unchanged; 56/56, build ok, fixture unchanged)
- [x] Chunk 4: Phase 2b, split `game.js`, roles table (D10). Split into sub-chunks because 644 lines plus the role conversion exceed one session's output. Do one sub-chunk per session, commit it, then stop. Chunk 4 is [x] only after 4b.
  - [x] 4a: moved `game.js` code into `rules/{spawn,movement,combat,ai,turns}/` plus `rules/{log,geometry}.js`, no behavior change; `engine/game.js` is now a re-export facade. Roles still use `ENEMY_MOVE_STEPS` and branches. (done: 56/56, build ok, fixture unchanged; largest new file `spawn/placement.js` 166 lines)
  - [x] 4b: convert enemy roles (D10) to `rules/ai/roles.js` table; remove `aiRole || role || 'raider'` fallback so a missing role throws; every file under 250 lines. Acceptance: `npm run check` passes, golden fixture unchanged. (done 4b: `ROLES` table + `getRole` throws on missing/unknown role; `enemyStep.js` has no role-name branches; `ai/roles.test.js` covers the throws; 61/61, build ok, fixture unchanged; differential run old vs new enemyStep identical over 48 scenarios)
- [x] Chunk 5: Phase 3, events and director (riskiest). Split into sub-chunks because it touches every rules module and the App timers. Do one sub-chunk per session, commit it, then stop. Chunk 5 is [x] only after 5f. Each sub-chunk must keep `gameReducer` output identical to the previous commit, except for the new `eventLog` field.
  - [x] 5a: `presentation/events.js` event constructors and `appendEvents`; `EVENT_LOG_LIMIT = 50`; `reduce` wrapper returns `{ state, events }` internally, `gameReducer` appends to `state.eventLog`; `eventLog: []` in initial state; no emitters yet. Done: 64/64, build ok, fixture unchanged, differential run vs HEAD over 3200 actions on 8 seeds identical ignoring `eventLog`.
  - [x] 5b: shots. `fireAt` and `resolveOverwatch` return `{ state, events }`, emitting `shot` (shooter, target, hit, crit, damage, enemyShot, reaction) and `death` when hp reaches 0. `lastShot` and log strings unchanged. Done: `enemyStep` returns `{ state, events }`; reducer `reduce()` routes `attack`, `complete-movement`, `enemy-step` through the event-returning helpers; blocked and out-of-range branches emit nothing; 73/73 (9 new in `rules/combat/resolveShot.test.js`, glob includes `src/rules/combat`); fixture unchanged; lockstep run vs HEAD over 12 seeds / 3000 actions: state identical ignoring `eventLog`, 65 `lastShot` changes each with a matching shot event.
  - [x] 5c: movement and alerts. `moveUnit`, `moveEnemy`, `wanderEnemy` emit `move`; `refreshAlerts` emits `alert` for each newly alerted group. `movement` state unchanged. Done: helpers return `{ state, events }`; reducer routes `move` and `end-turn` through the event-returning `reduce()`; `enemyStep` concatenates alert then step events; new tests `rules/movement/moveUnit.test.js` and `rules/ai/alerts.test.js` (glob includes `src/rules/movement`); 5b test relaxed to find the shot by type since an alert can follow it; check passes, fixture unchanged; lockstep vs HEAD over 12 seeds x 300 steps (4800 actions) identical ignoring `eventLog`, every alert and move start has a matching event. Overwatch reaction shots were rare in this run (1), so that path is only lightly covered.
  - [x] 5d: turn flow and AI. `endTurn`, `finishEnemyTurn`, `enemyStep`, `useAbility` emit `turn-start`, `enemy-turn-end`, `round-start`, `overwatch` and `hold` events. Enemy step returns `{ state, events }` internally. Done: `endTurn` emits alerts then `turn-start`; `finishEnemyTurn` emits `round-start`; `useAbility` emits `overwatch` (reducer `ability` case moved into `reduce()`, `finish-enemy-turn` routed through events); `enemyStep` emits `hold` in the hold branch and `enemy-turn-end` whenever a turn slot is consumed; new `rules/turns/turnFlow.test.js` (12 tests incl. targeted overwatch reaction via `complete-movement`; glob includes `src/rules/turns`); `npm test` 93/93, build ok, fixture unchanged; lockstep differential vs HEAD over 12 seeds x 300 steps (3600 actions) identical ignoring `eventLog`, 0 mismatches, every turn/round/overwatch/hold/enemy-turn-end checked against state (5 reaction shots in batch 1-4 etc.). Note: `npm test` glob was not changed (`src/rules/turns/*.test.js` already included).
  - [x] 5e: log text. `presentation/logText.js` maps events to the existing German strings (identical text, one table). Reducer stops building strings; `state.logs` content must match byte for byte in the differential run. Done: `rules/log.js` deleted; rules emit `blocked` (sight/range) and add `name`, `role`, `intent` to shot, move, hold and overwatch events; `reducer.js` appends `logs` via `appendLogs` from events; intro line in `logText.js` `INTRO_LOG`; role table no longer holds message text. Tests: `npm test` 107/107 (new `presentation/logText.test.js` covers every template); build ok; golden fixture unchanged. Differential vs HEAD e39e573: seeds 1-12 x 300 steps (3600 actions) in three batches, state identical ignoring `eventLog` (incl. `logs` byte for byte), 0 mismatches; each action adds exactly as many log entries as renderable events (248+240+266 = 754), silent events (death, alert, enemy-turn-end) add none.
  - [x] 5f: `presentation/timing.js` and `presentation/director.js` replace the `setTimeout`/`setInterval` effects in `App.jsx` (1000, 1300, 1400, 220, 80 ms and the `finish-shot`, `enemy-step`, `advance-movement`, `complete-movement` dispatches). Delays and dispatch order unchanged. Done: `presentation/timing.js` is the single delay table (1000, 1300, 1400, 0 hidden, 220 per step, 80 settle); `presentation/director.js` has `planSteps(state, view)` and `createDirector({ dispatch, scheduler })` with `sync` (re-arm on dep change, same slot order as the old effects) and `dispose`; `App.jsx` calls `sync` in one effect and `dispose` on unmount, no timer effects left (the 1500 ms "copied" timeout in the seed handler is not a listed effect and stays). Tests: `director.test.js` (fake clock, real reducer, 10 cases across both files incl. ordering and hidden/visible delays) and `timing.test.js`. Check 117/117, build ok, fixture unchanged. Differential vs HEAD 65683d4 (reducer unchanged): seeds 1-12 x 300 steps (3600 actions), state deep-equal incl. `eventLog` and `logs` after every action, 0 mismatches.
- [x] Chunk 6: Phase 4, split `GameScene.jsx` and `game.test.js`. Split into sub-chunks (planned from the code: 902-line scene with 17 components and two groups of pure helpers; 677-line `src/engine/game.test.js` with 47 `test(` calls, importing the `game.js` and `map.js` facades). Paths use `src/components/scene/` because the repo has no `ui/` directory yet (section 2 layout maps `ui/scene` to here). Do one sub-chunk per session, commit it, then stop. Chunk 6 is [x] only after 6e. Each sub-chunk keeps rendering output unchanged (6c's D1 fix is the only exception and must be visually a no-op), keeps `test/fixtures/golden-hashes.json` unchanged, and passes `npm run check`. Every new test directory is added to the `npm test` glob in `package.json`. Every new logic file ships with a test beside it. Importers: only `src/App.jsx` imports `GameScene.jsx` (default export, same props); `src/engine/golden.test.js` is the only other test using the engine facades.
  - [x] 6a: split `src/engine/game.test.js` into `src/rules/grid/grid.test.js`, `src/rules/sight/sight.test.js`, `src/rules/combat/combat.test.js`, `src/rules/ai/ai.test.js`, `src/rules/turns/turns.test.js`, `src/rules/spawn/spawn.test.js`, moving tests without changing their bodies; shared builders and helpers (`makeUnit`, `makeState`, `adjacentWalkableCell`, `withDraws`) go to `test/fixtures.js`; delete `src/engine/game.test.js`. Add `src/rules/grid`, `src/rules/sight` and `src/rules/spawn` to the `npm test` glob (`src/rules/combat`, `src/rules/ai`, `src/rules/turns` are already there). Acceptance: `npm run check` passes; the test count printed by `npm test` equals the count before the split (measure it first, currently 117 after 5f); `git diff` shows only moves, import lines and the new fixtures file; `golden-hashes.json` unchanged. Done: 117/117 tests (unchanged), golden-hashes.json unchanged, build ok. Files: src/rules/{grid/grid,sight/sight,spawn/spawn,movement/movement,turns/turns,ai/ai,combat/combat,combat/cover}.test.js and test/fixtures.js (builders adjacentWalkableCell, isolateEncounter, setSides, withDraws); src/engine/game.test.js deleted; npm test glob extended with src/rules/grid, sight, spawn. Deviation: cover tests and movement tests split into combat/cover.test.js and movement/movement.test.js (a seventh and eighth file beyond the six listed) to keep domains coherent; makeUnit/makeState not needed (no such helpers existed).
  - [x] 6b: pure helpers out of `GameScene.jsx`: `src/components/scene/coords.js` (`CELL_OFFSET = 15.5`, `toWorld(cell)`, `toWorldY(cell)`; the only place the `- 15.5` offset lives, replacing the ~20 inline uses) and `src/components/scene/textures/{tiles,sprites,labels}.js` (`createTileTexture`, `createSpriteTexture`, the crit and damage label canvas code, `seededNoise`), each with a test beside it (`coords.test.js`, and pure-function tests or a canvas stub for the textures). Acceptance: `npm run check` passes; golden fixture unchanged; `grep -n "15.5" src/components/GameScene.jsx` finds nothing; `src/components/scene/**/*.test.js` added to the `npm test` glob. Done: `src/components/scene/coords.js` (`CELL_OFFSET`, `STEP_HEIGHT`, `toWorld`, `toWorldY`; owns the -15.5 offset; `grep -n 15.5 src/components/GameScene.jsx` is empty), `scene/textures/tiles.js` (`seededNoise`, `createTileTexture`, `createGroundTexture` moved from `TilemapGround`), `scene/textures/sprites.js` (`createSpriteTexture`), `scene/textures/labels.js` (`createCritTexture`, `createDamageTexture`); tests `coords.test.js` and `textures/{tiles,sprites,labels}.test.js`, with a canvas stub in `test/canvasStub.js`. Deviation: modules live under `src/components/scene/` (not `src/ui/scene/`); `GameScene.jsx` stays in place. Verification: a differential harness recorded every canvas call and texture property for 47 cases (6 tile crops, noise, 12 sprite views, crit, 4 damage labels, 9 ground maps with full/none/partial visibility) and hashed them. The HEAD snapshot (`git archive`) and the new modules gave identical hashes; a one-character colour mutant was detected. Test count 117 -> 132; build ok; golden fixture unchanged. Visual check not possible in a worker session.
  - [x] 6c: split `PixelUnit` (currently lines 392-613) into `scene/units/UnitBody.jsx` (geometry, billboard, outline), `scene/units/UnitSprite.jsx` (view selection and sprite swap) and `scene/units/UnitEffects.jsx` (fire recoil, muzzle, crit pop, fall); `PixelUnit.jsx` becomes a thin composition. Pure timing constants (`FIRE_DURATION`, `MUZZLE_DURATION`, `CRIT_DURATION`) and the crit opacity and scale formulas move to `scene/units/effectTiming.js` with `effectTiming.test.js` covering t = 0, 0.6, 1 and beyond. D1 status: the duplicate is already gone (one `critOverlay` mesh at y=1.02 inside `billboard`, checked in `c816ce0` and HEAD), so no D1 change is needed; the item must not re-add a second mesh. Acceptance: `npm run check` passes; golden fixture unchanged; `grep -c "ref={critOverlay}"` on the scene folder returns 1; `scene/units/*.test.js` added to the `npm test` glob. Visual check is not possible in a worker session; record that in the commit note.
    - Done: new `scene/units/PixelUnit.jsx` (composition, one `useFrame`), `UnitBody.jsx` (geometry, route move, pose), `UnitSprite.jsx` (sprite meshes, view swap), `UnitEffects.jsx` (effect clock, recoil, muzzle, crit overlay, fall), `effectTiming.js` (FIRE/MUZZLE/CRIT durations and pure crit, recoil, muzzle, fall formulas), `spriteView.js` (`angleDelta`, `selectSpriteView`). Tests: `effectTiming.test.js` (t = 0, 0.6, 1, beyond), `spriteView.test.js`; `npm test` glob includes `src/components/scene/units/*.test.js`. Test count 132 -> 144; build ok; golden fixture unchanged. D1 status: one `critOverlay` mesh (`ref={critOverlay}` count 1 in `src`). Verification: scene-graph diff of the JSX element lines HEAD vs new (types, args, positions, rotations, scales, colours, opacities, renderOrder identical; only ref and prop names differ); pure formulas moved verbatim; no canvas drawing in units. Visual check not possible in a worker session.
  - [x] 6d: `scene/camera/useTacticalCamera.js` hook extracted from `CameraRig` (pointer, wheel and keydown listeners with one cleanup, and the `rotateCamera` call driven by `rotateToken`), plus pure `scene/camera/gestures.js` with `rotationSteps` (and any other pure math copied verbatim from the existing handlers) and `gestures.test.js`. Pinch zoom does not exist in the current code (no pinch handler), so it is NOT added in this item; it stays a future feature. Acceptance: `npm run check` passes; golden fixture unchanged; `src/components/scene/camera/*.test.js` added to the `npm test` glob; `CameraRig` no longer contains `addEventListener` calls.
    - Done: `scene/camera/useTacticalCamera.js` holds the pointer, wheel and keydown listeners (one effect, one cleanup on unmount) and the `rotateToken` effect; `CameraRig` keeps the focus and move-follow effects and `useFrame`, with no `addEventListener` left. `scene/camera/gestures.js` has pure helpers copied from the HEAD handlers (`clampZoom`, `wheelZoom`, `pinchZoom`, `pinchMetrics`, `angleDelta`, `rotationSteps`, `keyRotation`, `keyPanStep`). `gestures.test.js` has 11 tests with expected values taken from HEAD. Pinch zoom is not added. Deviation: exactly half a step (`rotationSteps(PI/4)`) never terminates, in HEAD too; kept as is (no behaviour change) and not tested. Test count 144 -> 155; build ok; golden fixture unchanged; `src/rules` and `src/engine` unchanged vs f32310c. Visual/input check not possible in a worker session.
  - [x] 6e: remaining scene split into `scene/terrain/` (`InstancedGround`, `TilemapGround`, `CoverField`, `WallField`, `FogOfWar`), `scene/overlays/` (`ReachableOverlay`, `MoveTrace`, `AimBeam`, `SideCoverMarkers`, `FlankLines`), `scene/effects/BeamEffect.jsx`, and `GameScene.jsx` reduced to `Canvas` plus `Battlefield` composition. Acceptance: `npm run check` passes; golden fixture unchanged; `wc -l src/components/GameScene.jsx` under 120; no file under `src/components/scene/` over 250 lines; `App.jsx` import path and props unchanged; `git diff` shows only moves, imports and export lines.
    - Done: `GameScene.jsx` is 72 lines (composition: `Canvas` plus `Battlefield`, under 120). Moved verbatim: `scene/terrain/{TilemapGround,InstancedGround,CoverField,WallField,FogOfWar}.jsx` and `scene/terrain/sheet.js` (`ROGUELIKE_SHEET`, shared by the atlas loaders); `scene/overlays/{ReachableOverlay,MoveTrace,AimBeam,SideCoverMarkers,FlankLines}.jsx`; `scene/effects/BeamEffect.jsx`; `scene/camera/CameraRig.jsx` (moved out of GameScene, since it is not listed in 6e but must leave the composition file to meet the line target). Verification: each moved function body is byte-identical to its `3807ce6` line range (diff, only the `export` keyword and import headers differ); largest `scene/` file 145 lines; `npm run check` 155/155, build ok; golden-hashes.json unchanged; no `src/rules` or `src/engine` change. Visual check not possible in a worker session.
- [ ] Chunk 7: Phase 5, HUD, copy, CSS, tooling (ESLint, JSDoc `checkJs`, Prettier). Split into sub-items (planned from the code). Findings: `src/components/TacticalHud.jsx` (184 lines; exports `ActionButton`, `HealthBar`, `UnitPanel`, `CombatPreview`, `PositionPanel`, `TacticalHud`; imports the `engine/game.js` and `engine/map.js` facades). D2 arithmetic is already gone (`CombatPreview` reads `selectCombatPreview`). D7 is already gone (no `dispatchEvent` outside tests). `src/styles.css` (278 lines) has no hex colours; the listed colours are in JSX: legend `#4aa8ff`/`#7fe08a`/`#8c9a94` in TacticalHud, `#00cfff`/`#ffc247`/`#ffd34d`/`#7fe08a` in `scene/overlays/ReachableOverlay.jsx`. No `eslint`, `prettier`, `jsconfig.json` or `typescript` in the repo or `node_modules/.bin`. `src/rules/` has no `react`, `three`, `window`, `document` or `Date` imports outside tests, and `Math.random` appears only in tests. There is no `rules/index.js` yet. `.github/workflows/deployci.yml` and `deploy.yml` both run `npm ci`, `npm test`, `npm run build`; `deploy.yml` adds the Pages steps. Each sub-item is one commit and one worker session.
  - [x] 7a: tooling foundation only. Add ESLint flat config (`eslint.config.js`) with `eslint-plugin-import` `no-restricted-imports`: `src/rules/**` (non-test) may not import `react`, `react-dom`, `three` or `@react-three/*`; no `window`, `document`, `Date` or `Math.random` in `src/rules/**` (non-test). Add a `lint` script and wire it into `check` (`npm run lint && npm run test && npm run build`). Do not restrict UI imports yet (no `rules/index.js` until 7d). Acceptance: `npm run check` passes; pre-existing violations are either fixed without behaviour change or scoped out with a reason written in `eslint.config.js`; golden fixture unchanged; no logic change under `src/`.
    - Done: `eslint.config.js` (flat config, `@eslint/js` recommended + `eslint-plugin-import`). `rules/**` non-test: `no-restricted-imports` for react, react-dom, three, @react-three/*; `no-restricted-globals` window, document, Date; `no-restricted-properties` Math.random; `import/no-restricted-paths` blocks `rules/` importing `src/components`, `App.jsx`, `main.jsx`. Scoped exceptions with reasons in the config header: `no-unused-vars` off for `*.jsx` (JSX usage invisible without eslint-plugin-react); max-lines and max-lines-per-function not added yet (tree not split to limits). Fixes: removed 2 unused locals in `rules/combat/combat.test.js`; removed unused `cells` prop destructure in `InstancedGround.jsx` (callers still pass it); removed 2 `eslint-disable` comments naming the unloaded `react-hooks` plugin (`CameraRig.jsx`, `useTacticalCamera.js`). No logic change. `npm run lint` clean; probe file with react/three/Date/Math.random/window/document import fired 7 errors, then deleted. `npm run check` lint + 155/155 tests + build ok; golden fixture unchanged. UI import restriction deferred to 7d.
  - [x] 7b: `jsconfig.json` with `checkJs: true` and `include` limited to `src/rules/**/*.js` (non-test). Add `typescript` as devDependency and a `typecheck` script (`tsc --noEmit -p jsconfig.json`), wired into `check` after `lint`. Fix type errors in `src/rules` with JSDoc only (typedefs for `State`, `Unit`, `Cell`, `Action`, `Event` in `src/rules/types.js`). Directories outside `src/rules` are excluded explicitly in `jsconfig.json`, with the reason in the commit message. Acceptance: `npm run typecheck` passes; `npm run check` passes; no runtime code changed (JSDoc comments and the types file only).
    - Done: `jsconfig.json` (`checkJs`, `allowJs`, `noEmit`, `strict: false`, `skipLibCheck`, target ES2020 with lib ES2022 because `Object.hasOwn` is used in `ai/roles.js`, `moduleResolution: Bundler`). `include`: `src/rules/**/*.js`. Excluded explicitly: `src/rules/**/*.test.js` (345 errors under the same settings, tests not typed), `src/App.jsx`, `src/main.jsx`, `src/engine`, `src/selectors`, `src/presentation`, `src/components`, `test`, plus `node_modules` and `dist`. Added `typescript` devDependency (npm resolved ^7.0.2) and `typecheck` script; `check` = lint + typecheck + test + build. Strictness: `strict: false`; with `--strict` src/rules has 240 errors, so strict is not enabled. Errors: 1 before (`Object.hasOwn` vs lib), 0 after (lib change, no source edit). No JSDoc or types.js was needed. `src/rules` source unchanged (`git diff -U0 a582bb7 -- src` has 0 changed lines). `npm run check` 155/155, build ok; golden fixture unchanged.
  - [x] 7c: Prettier with a committed `.prettierrc` and `.prettierignore` (ignore `dist` and `test/fixtures/golden-hashes.json`), plus `format` and `format:check` scripts. Run `prettier --write` over the tree as ONE formatting-only commit. Wire `format:check` into `check` only if it passes on the tree. Acceptance: `npm run format:check` passes; `test/fixtures/golden-hashes.json` byte-identical to before; test count unchanged (155/155 from `npm test`); no logic change (AST-equivalent or reviewed with `git diff -w`). (done: `prettier` 3.9.10 devDependency; `.prettierrc.json` `singleQuote`, `semi`, `printWidth: 120`, `trailingComma: es5` (120 chosen over 100/80 because it changes fewer lines: 3927 vs 4890 at 100); `.prettierignore` ignores `dist`, `node_modules`, `coverage`, `package-lock.json`, `test/fixtures/golden-hashes.json`, and `refactoring.md` (prettier rewrites a code span and reflows its tables); `format` and `format:check` scripts; `format:check` wired into `check` after typecheck. `prettier --write .` ran once over the tree: 72 files changed, formatting-only. Verification: JS/JSX token streams equal with all whitespace removed (64 files); exact string, template and identifier tokens equal, except `TacticalHud.jsx` where only JSX text-node splits around `{" "}` differ and render the same; CSS token-equal after normalising quotes, leading zeros and whitespace. `test/fixtures/golden-hashes.json` unchanged. `npm run check` passes, 155/155 tests, build ok.)
  - [ ] 7d: HUD split. `TacticalHud.jsx` becomes a composition file importing one file per panel under `src/components/hud/` (`UnitPanel.jsx`, `CombatPreview.jsx`, `PositionPanel.jsx`, `ActionDock.jsx`, `MissionPanel.jsx`, `CommsLog.jsx`, `ConfirmDialog.jsx`; `ActionButton` and `HealthBar` go to `hud/primitives.jsx`). Remove unused props (D9) after checking each one: `seedCopied`, `onCopySeed`, `hasShootableEnemy`, `nextReadyUnit`, `pendingCover` are all referenced in the body today, so keep those that are read. Replace the `engine/game.js` and `engine/map.js` facade imports in the HUD with `selectors/` exports (for `targetVisible` and `targetInRange`, add a selector in `selectors/hud.js` that reads `hasLineOfSight` and `SHOT_RANGE` from `rules/`). Add `rules/index.js` (public API, re-exports only). Add the UI import restriction to ESLint in this sub-item: UI may import only `rules/index.js` and `selectors/`. Acceptance: `npm run check` passes; `grep -rn "engine/" src/components/hud` is empty; `grep -rn "rules/" src/components/hud` is empty; rendering unchanged (markup from `react-dom/server` before and after is identical for a fixed state); no file in `hud/` over 150 lines.
  - [ ] 7e1: copy move only. Create `src/components/copy.js` holding every HUD string as it is today, English labels included (`ENEMY TURN`, `OVERWATCH`, `FLANKIERT`, `SEKTOR 07 / NEMESIS`, `FEIND IM SCHUSSFELD`, `KEIN ZIEL ERFASST`, and the rest). HUD components read from the table. No visible change; text identical byte for byte. Acceptance: `npm run check` passes; `grep -rn "ENEMY TURN\|OVERWATCH\|FLANKIERT\|NEMESIS" src/components/hud src/components/TacticalHud.jsx` returns only `copy.js`; markup identical to before.
  - [ ] 7e2: BLOCKED on D11 user decision. The final wording of the English HUD labels (`ENEMY TURN`, `OVERWATCH`, `FLANKIERT`) and whether `SEKTOR 07 / NEMESIS` moves to German are a user decision. Do not implement any copy change until the orchestrator provides the decision in writing. When unblocked, record the decision here and then change only the strings in `copy.js` (German-first, one language per surface).
  - [ ] 7f: CSS split and tokens. Split `src/styles.css` (278 lines) into per-component files under `src/styles/` (`base.css`, `hud/*.css`, `scene.css`), imported from `main.jsx` in the same cascade order so computed styles are unchanged. Put CSS custom properties in `src/styles/tokens.css` for the HUD colours `#4aa8ff`, `#7fe08a`, `#8c9a94` and `#ffc247` (and `#00cfff` if the HUD uses it). Replace the legend `style={{ background: ... }}` in the HUD with classes (`legend-full`, `legend-half`, `legend-open`) that use the tokens. Three.js colours in `scene/overlays/ReachableOverlay.jsx` stay as JS constants because CSS variables cannot reach three.js; record that in the commit note. Acceptance: `npm run build` passes; each token value equals the literal it replaces (grep-verified); computed colours unchanged; visual check not possible in a worker session, recorded in the commit note; `grep -rn "background: '#" src/components` is empty.
  - [ ] 7g: CI and bundle. (1) One reusable workflow `.github/workflows/check.yml` (`on: workflow_call`) that runs `npm ci` and `npm run check`. `deployci.yml` and `deploy.yml` call it; `deploy.yml` keeps only the Pages steps after it. (2) Bundle: `React.lazy` for the Three.js scene in `App.jsx`, or `manualChunks` for `three` and `@react-three/*` in `vite.config.js`. Pick one and record why. Acceptance: `npm run check` passes locally; the `npm run build` chunk-size warning is gone or its remaining size is documented in the commit note; both workflow YAML files parse.
- Chunk 7 is [x] only after 7g, and 7e2 must be unblocked and done first.

Golden hashes: generated from the code in `c816ce0`, so they guard against changes after that point. They are not a pre-refactor baseline.

Note: `npm run check` runs test and build only. Lint and typecheck will be added in chunk 7.

Goal: a codebase that stays correct and easy to change over many iterations, including iterations done by AI agents. That means small files with one responsibility, a pure and deterministic rules engine, one source of truth per rule, explicit data contracts, and checks an agent can run itself.

Baseline (measured, not estimated):

- `npm test`: 47/47 passing. `npm run build`: succeeds (bundle > 500 kB warning).
- `src/components/GameScene.jsx`: 902 lines, mixes texture generation, 3D components, input handling and camera logic.
- `src/engine/game.js`: 646 lines, mixes RNG, placement, combat, enemy AI, turn flow and reducer.
- `src/engine/map.js`: 384 lines, mixes map generation, pathing, line of sight, cover and fog.
- `src/engine/game.test.js`: 684 lines in one file, no fixtures or shared helpers.
- No linter, no type checking, no formatter, no agent-facing project notes beyond README and add.md.
- Uncommitted work is in progress in `GameScene.jsx` and `map.js` (`LEVEL_HEIGHT` renamed to `cellHeight(cell) * STEP_HEIGHT`). `cellHeight` reads `cell.elevation`, which no code ever sets, so it currently equals `cell.level`. Finish or revert that change before starting the refactor.

---

## 1. Defects and drift risks found during the review

These should be fixed first. Each is small and independent.

| # | Location | Problem | Risk |
|---|----------|---------|------|
| D1 | `GameScene.jsx` `PixelUnit`, lines ~601 and ~611 | `critOverlay` and `critMaterial` refs are attached to two meshes. The second (y=1.72, outside `billboard`) overwrites the first (y=1.02, inside `billboard`). The inner crit mesh is never animated. | Visual bug; a second copy of the same JSX confuses readers. |
| D2 | `TacticalHud.jsx` `CombatPreview` (~line 80) | Recomputes the hit chance as `70 + elevation - coverPenalty + distanceModifier` with its own clamp, instead of calling `computeHitChance`. The README promises that preview and engine use the same rules (`add.md`: "Anzeige und Engine müssen dieselbe Sicht- und Trefferlogik verwenden"). | Preview and actual shot can silently diverge. Already differs: the engine uses `ENEMY_COVER_FACTOR` and the shooter/target `level` directly, the HUD re-derives both. |
| D3 | `game.js` `fireAt`, `resolveOverwatch`, `useAbility`, `moveUnit`; `map.js` `createBattlefield` default | IDs come from `Date.now()` (`movement.id`, `lastShot.id`), and `createBattlefield(seed = Date.now())` has a time-based default. `fireAt` takes `random = Math.random` while `wanderEnemy` takes its own default. | Non-deterministic state, flaky tests, impossible replay. Reducer is not pure with respect to time or randomness. |
| D4 | `game.js` `finishEnemyTurn` and `createStartingUnits` | AP reset value `2` is hard-coded in several places, and `unit.ap` default in `moveEnemy` uses `- 1`. `movementLimits` duplicates AP rules. | Changing AP rules requires edits in 4+ places. |
| D5 | `game.js` `makeRandom` vs `map.js` `makeRandom` | Two identical LCG implementations. | Divergent seeds if one is changed. |
| D6 | `game.js` `selectNextReadyPlayer`, `App.jsx` `readyUnits` / `requestEndTurn` | "Next ready unit" is computed in two places with different logic (reducer walks roster order from the current unit; App sorts ready units by circular distance). | Two definitions of "next unit" can disagree. |
| D7 | `TacticalHud.jsx` crit/rotate buttons | `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }))` is used to rotate the camera. | Hidden coupling through the global event bus; breaks if the key handler changes. |
| D8 | `App.jsx` keyboard effect | Depends on `requestEndTurn`, which is a new function every render, so the window listener is re-bound on every render. | Wasteful and hard to reason about. |
| D9 | Unused props | `TacticalHud`: `moveMode`, `onRegenerate`-style callbacks are passed but unused; `App` passes `onRegenerate` that the HUD ignores. `computeCritChance(state, shooter, target, enemyShot)` ignores everything except `enemyShot`. | Dead surface that misleads both humans and agents. |
| D10 | `game.js` `enemyStep` role handling | `role` is a string checked in 6+ `if`/ternary branches (`scout`, `stalker`, `guard`, `raider`). `enemy.aiRole || enemy.role || 'raider'` fallback hides malformed data. | Adding a role means touching many branches; silent fallback masks bugs. |
| D11 | UI strings | Mixed languages: German game text, English "ENEMY TURN", "OVERWATCH", "FLANKIERT" in the same HUD. Mission string "SEKTOR 07 / NEMESIS" is hard-coded. | Inconsistent player-facing text; no single place to change copy. |

---

## 2. Target architecture

Three layers with strict dependency direction: `rules` (pure) <- `selectors` (derived view data) <- `ui` (React + Three.js). Nothing in `rules` imports React, Three.js, `window`, `Date`, or `Math.random`.

```
src/
  rules/                      # pure, deterministic, no DOM / React / three
    constants.js              # all balance numbers (ranges, chances, AP, move ranges)
    templates.js              # player and enemy unit templates (data only)
    rng.js                    # single seeded PRNG; state carries its own rng cursor
    grid/
      cells.js                # cellKey, parseKey, neighbours, cellHeight, isPassable
      terrain.js              # terrain kinds table: blocks movement? blocks sight? cover tier?
      generate.js             # createBattlefield (split: buildings.js, boxes.js, connectivity.js)
      connectivity.js         # allPassableReachable, snapshot/restore
    movement/
      pathfinding.js          # getReachable, movementLimits, AP cost
    sight/
      line.js                 # hasLineOfSight (combat)
      fog.js                  # getVisibleCells (fog of war)
    combat/
      cover.js                # getSideCover, getCoverAgainst, getCoverProfile, getFlankedBy
      hitChance.js            # computeHitChance, computeCritChance, damage roll
      resolveShot.js          # fireAt, overwatch resolution (returns events, not log strings)
    ai/
      roles.js                # one object per role: { maxSteps, canShoot, choose(...) }
      enemyTurn.js            # generic loop that delegates to the role object
      alerts.js               # group alert logic
    turns/
      phases.js               # phase state machine: player -> enemy -> player
      reducer.js              # gameReducer: action -> new state (+ events)
    mission/
      mission.js              # objective, extraction, win/lose checks (see add.md Priority 1)
    spawn/
      placement.js            # squad + enemy placement (fair-start rules)
    index.js                  # public API of rules/ (only file other layers import)
  selectors/                  # derived data used by UI, computed once per state change
    visibility.js             # visibleCellKeys for the active observer set
    combatPreview.js          # hit chance, cover, flank for (shooter, target), uses rules
    targets.js                # shootableEnemyIds, reachablePaths, coverProfiles
  presentation/
    events.js                 # event types emitted by rules (shot, move, death, alert)
    timing.js                 # all animation / delay constants in one table
    director.js               # plays event queue: decides delays, sends "next step" actions
    logText.js                # maps events -> German log strings (single copy table)
  ui/
    App.jsx                   # composition only: wires store, director, scene and HUD
    store.js                  # useReducer / small store wrapper around rules reducer
    hud/                      # one component per panel (TopBar, MissionPanel, SquadPanel, CombatPreview, CommsLog, ActionDock, ConfirmDialog)
    scene/
      GameScene.jsx           # Canvas + composition only
      coords.js               # toWorld(cell), toWorldY(cell): the only place the -15.5 offset lives
      textures/
        tiles.js              # tilemap canvas generation
        sprites.js            # pixel sprite generation per team/class/view
        labels.js             # CRIT / damage label textures
      units/PixelUnit.jsx     # split: UnitBody, UnitSprite, UnitEffects (crit, muzzle, fall)
      terrain/                # InstancedGround, WallField, CoverField, FogOfWar
      overlays/               # ReachableOverlay, MoveTrace, AimBeam, SideCoverMarkers, FlankLines
      effects/BeamEffect.jsx
      camera/useTacticalCamera.js  # pan / pinch / wheel / keyboard as one hook with a cleanup
  styles/                     # styles.css split by component; design tokens as CSS variables
```

### 2.1 Key principles

1. **One rule, one implementation.** Hit chance, cover, flank, visibility and reachability are computed in `rules/` only. UI reads selector output and never re-implements a formula (fixes D2, D6, D9).
2. **Pure reducer with explicit randomness.** The seeded RNG lives in state (`state.rng` as an integer cursor). Every random draw advances it. `Date.now()` and `Math.random()` are removed from `rules/`. IDs come from a counter in state (fixes D3). Tests become deterministic without mocks.
3. **Actions return events.** `resolveShot` returns `{ state, events }` where events are plain objects (`{ type: 'shot', shooterId, targetId, hit, crit, damage }`). Log text and animation are derived from events in `presentation/`. Today the reducer builds German log strings inline and the HUD/Three.js layer infers animations from `state.lastShot`. This removes the `lastShot`/`movement` polling hacks.
4. **Data over branches.** Enemy roles become a table (`roles.js`), terrain kinds become a table (`terrain.js`). Blocking, sight, cover and passability rules read the table. `BLOCKING_TERRAIN`, `SOLID_TERRAIN`, `COVER_BOXES` and the literal `'wall' || 'pillar'` checks in `map.js` collapse into one table.
5. **Timing is data.** All delays now in `App.jsx` (1000, 1300, 1400, 220, 80 ms) and animation constants in GameScene move to `presentation/timing.js`. The director, not `useEffect` chains, decides when the next enemy step or movement tick happens.
6. **Coordinates in one place.** The `x - 15.5` / `z - 15.5` offset and the `mapOffset` group offset appear in about 15 places across GameScene and App. `coords.js` owns this (fixes a class of visual-alignment bugs).
7. **Keep the public surface small.** `rules/index.js` is the only import target for UI code. Deep imports from `rules/combat/...` are forbidden by an ESLint rule (see section 4).

---

## 3. Prioritised refactoring plan

Each phase ends with `npm test` and `npm run build` green, and behavior unchanged (verified by the golden test in 4.2) unless the phase explicitly changes rules.

### Phase 0: stabilise (small, low risk, do first)

- Finish or revert the in-progress `cellHeight` change. Either set `elevation` in the map generator or remove the field and keep `cellHeight = level`.
- Fix D1: keep one crit overlay mesh inside `billboard`; delete the duplicate block.
- Fix D9: remove unused props and the unused `computeCritChance` parameters.
- Fix D5: delete the duplicate `makeRandom` in `game.js` and import from one module.
- Fix D8: wrap `requestEndTurn` in `useCallback` with real dependencies, or read state through a ref.
- Replace the `window.dispatchEvent(KeyboardEvent)` camera rotation (D7) with a `rotateCamera` action or a callback prop.

### Phase 1: single source of truth for rules

- Create `rules/constants.js` and `rules/templates.js`. Move `SHOT_RANGE`, `OVERWATCH_RANGE`, `COVER_VALUE`, AP values, move ranges and role parameters there (D4).
- Make `selectors/combatPreview.js` call `computeHitChance` and `getCoverAgainst`. Delete the HUD arithmetic (fixes D2). Add a test that asserts the HUD-facing numbers equal `computeHitChance` for a grid of shooter/target configurations.
- Introduce `getNextReadyUnit(state)` in `rules/turns/` and use it from the reducer and from the UI (fixes D6).
- Replace `Date.now()` ids and the `Math.random` defaults with state-carried RNG and counters (fixes D3). Keep the public `createInitialState(seed, generation)` signature.

### Phase 2: split the rules engine into modules

- Split `game.js` (646 lines) into `combat/`, `ai/`, `turns/`, `spawn/`. Target: no file over 250 lines.
- Split `map.js` (384 lines) into `grid/generate.js`, `grid/connectivity.js`, `movement/pathfinding.js`, `sight/line.js`, `sight/fog.js`, `combat/cover.js`. Keep behavior identical.
- Convert enemy roles (D10) to the table in `ai/roles.js`. Each role exposes `maxSteps`, `retreatWhen(enemy)`, `preferCell(...)`, `shouldHold(...)`. The generic `enemyTurn.js` loop calls them. Remove the `aiRole || role || 'raider'` fallback; a missing role must throw in tests.
- Keep `gameReducer` as the only public mutation entry point. Internal helpers return new state or events and never mutate.

### Phase 3: events and presentation

- Introduce `presentation/events.js` and make reducer actions return `{ state, events }` internally (the store keeps only `state` and appends events to `state.eventLog` with a bounded length).
- Move log text into `presentation/logText.js`. The reducer stops building German strings (fixes D11 partially; text is now in one table).
- Replace the `lastShot` / `movement` / `enemyTurnIndex` timers in `App.jsx` with `presentation/director.js`. The director consumes events, waits for `timing.js` durations, and dispatches `advance` actions. `App.jsx` shrinks to composition.

### Phase 4: split the Three.js layer

- Split `GameScene.jsx` (902 lines) per section 2 layout. Move texture generators (`createTileTexture`, `createSpriteTexture`, crit/damage label canvas code) into `scene/textures/`. These are pure functions and can be unit-tested with a canvas stub or snapshot the pixel array.
- Extract `CameraRig` input handling (~150 lines of pointer and gesture logic) into `useTacticalCamera`, with pure helpers for gesture math (`pinchZoom`, `rotationSteps`) that can be unit-tested.
- Split `PixelUnit` (~200 lines, 6 refs, animation loop) into `UnitBody` (geometry), `UnitSprite` (view selection and sprite swap) and `UnitEffects` (fire recoil, crit pop, fall).
- Introduce `coords.js` (fixes D6-style alignment and the repeated offset).

### Phase 5: HUD and styling

- One file per HUD panel under `ui/hud/`. `TacticalHud.jsx` becomes a composition file.
- Move copy (German and English labels, mission title) into `ui/copy.js`. Use one language per surface; the game is German-first (README), so English labels such as "ENEMY TURN", "OVERWATCH" and "FLANKIERT" move to the copy table with a decision on final wording.
- Split `styles.css` by component and introduce CSS custom properties for colours already used inline (`#4aa8ff`, `#7fe08a`, `#8c9a94`, `#00cfff`, `#ffc247`). Remove inline `style={{ background: ... }}` in the legend in favour of classes.

---

## 4. Maintainability for AI agents and humans

These changes make each iteration cheaper and less error-prone. They matter more than any single code change for the stated goal.

### 4.1 Tooling

- **Type checking via JSDoc + `tsc --checkJs`** (`checkJs: true` in a `jsconfig.json`). No migration to TypeScript required; types are enforced on `rules/` first. Typed contracts (`State`, `Unit`, `Cell`, `Action`, `Event`) give agents a single definition to read.
- **ESLint** with `eslint-plugin-import` rule `no-restricted-imports`: UI may import only from `rules/index.js` and `selectors/`. `rules/` may not import `react`, `three`, `@react-three/*`, or use `window`, `document`, `Date`, `Math.random`.
- **Prettier** with a committed config. Removes formatting churn in diffs (the current long one-line JSX blocks in HUD and GameScene are the main example).
- **Single check command**: `npm run check` = lint + typecheck + test + build. CI (`deployci.yml`) and deploy (`deploy.yml`) run the same script. Today both workflows duplicate the test and build steps; collapse them to one reusable workflow.
- **Bundle split**: lazy-load the Three.js scene (`React.lazy`) or set `manualChunks` for `three` and `@react-three/*`. Removes the >500 kB warning and speeds first paint.

### 4.2 Tests

- **Golden test for map generation**: for seeds 1..60, store a hash of `createBattlefield` and `createStartingUnits` output. Any unintended change to generation then fails loudly. Regenerate golden values only with an explicit flag, so agents cannot silently update them.
- **Split the 684-line test file** by domain: `rules/grid`, `rules/sight`, `rules/combat`, `rules/ai`, `rules/turns`, `rules/spawn`. Put shared builders (`makeUnit`, `makeState`, `openMap(size)`) in `test/fixtures.js`. Replace hand-built maps with fixture builders such as `mapFromAscii(\`...\`)`: a readable ASCII map (`#` wall, `P` pillar, `C` console, `.` floor) makes tests self-explanatory for agents and humans.
- **Property tests** for invariants already listed in `add.md` (no unit on a blocked cell, map connectivity, spawns reachable, no hidden-enemy shots). Use the existing seed loop, but move it into a helper.
- **Rule-to-test traceability**: each bullet in README and add.md gets a test ID comment (`// rule: R-COMBAT-03`). A script lists rules without tests. Agents can then find the test for a rule without searching.
- **Replay test**: run a scripted action list from a seed twice and assert identical final state. This proves determinism after D3.

### 4.3 Documentation for agents

- Add `AGENTS.md` (the project already reads it) with: layer rules (section 2), where each rule lives, how to add a new enemy role or terrain kind, the check command, and what must not change silently (golden hashes, balance constants).
- Keep README for players. Move the engine-rules section (sight, AI roles) into `docs/rules.md` and generate the numbers from `rules/constants.js` where possible, so docs cannot drift from balance values.
- Keep `add.md` as the roadmap. Mark each item with the module that implements it, so a future agent can find the entry point.

### 4.4 Conventions

- No file over 300 lines; no function over ~60 lines (enforced by ESLint `max-lines`, `max-lines-per-function` as warnings first).
- No new file without a test file next to it for `rules/`.
- No magic numbers in `rules/` outside `constants.js` or `templates.js`.
- Reducer actions are documented in one table (`rules/actions.js`): name, payload shape, preconditions, emitted events.

---

## 5. Roadmap alignment (add.md)

The refactor should be done in an order that makes the roadmap cheaper, not blocked by it:

- **Mission (Priority 1)**: implement after Phase 2 as `rules/mission/mission.js`. It needs a data record per mission and an `evaluateMission(state)` that returns `'ongoing' | 'won' | 'lost'`. It does not need UI knowledge.
- **Overwatch / cover / flank (Priority 2)**: already in `rules/combat/`. After Phase 1 these become table-driven (`terrain.js`) and previews come from `selectors/combatPreview.js`, so the previews in Priority 3 need no new formulas.
- **Previews and danger zones (Priority 3)**: selectors only. Must not read hidden enemies; the selector receives the same `visibleCellKeys` the engine uses.
- **Roles (Priority 4)**: already close to the table form (Phase 2).
- **Map quality (Priority 5)**: golden tests (4.2) plus the existing 60-seed test.
- **Faster enemy turn (Priority 6)**: the director (Phase 3) makes the enemy action sequence skippable with one state flag; no engine change needed.

---

## 6. Non-goals

- No change to game balance, visual style or German copy during the structural phases (except where D11 explicitly asks for a decision).
- No state-management library. A reducer plus selectors is sufficient; adding Redux or Zustand adds indirection without solving the actual problems above.
- No backend, persistence or multiplayer. Those would change the RNG and state model and should be designed only when needed.
- No full TypeScript migration. JSDoc with `checkJs` gives most of the benefit at a fraction of the churn.

---

## 7. Acceptance criteria

The refactor is complete when:

1. `npm run check` (lint, typecheck, tests, build) passes on a clean checkout.
2. The golden map-generation hashes are unchanged for all seeds, unless a rule change was intended and recorded.
3. `rules/` contains no references to `window`, `document`, `Date`, `Math.random`, React or Three.js.
4. No hit chance, cover, flank or visibility formula exists outside `rules/` (grep-verified).
5. `GameScene.jsx`, `game.js`, `map.js`, `TacticalHud.jsx` and `App.jsx` are each under 300 lines, or are composition-only files that import smaller modules.
6. A replay test with a fixed action list is deterministic across runs.
7. An agent can add a new enemy role by editing only `rules/ai/roles.js`, `rules/templates.js` and its test file, with the check command passing.
