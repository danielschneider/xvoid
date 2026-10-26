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
  - [ ] 2c: `selectors/combatPreview.js` calls `computeHitChance` and `getCoverAgainst`; HUD has no hit-chance arithmetic (D2). Add a parity test over a grid of shooter/target configs. Acceptance: `npm run check` passes.
  - [ ] 2d: `getNextReadyUnit(state)` in `rules/turns/`, used by reducer and App (D6). Acceptance: `npm run check` passes.
  - If a sub-chunk still produces too much output, split it further and record the new split here before editing code.
- [ ] Chunk 3: Phase 2a, split `map.js` (no behavior change)
- [ ] Chunk 4: Phase 2b, split `game.js`, roles table (D10)
- [ ] Chunk 5: Phase 3, events and director (riskiest)
- [ ] Chunk 6: Phase 4, split `GameScene.jsx` and `game.test.js`
- [ ] Chunk 7: Phase 5, HUD, copy, CSS, tooling (ESLint, JSDoc `checkJs`, Prettier)

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
