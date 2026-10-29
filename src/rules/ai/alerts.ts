import type { GameState, Position, StepResult } from '../types.ts';
import { cellKey } from '../grid/cells.ts';
import { getVisibleCells } from '../sight/fog.ts';
import { spawnDistance } from '../geometry.ts';
import { GROUP_RANGE } from '../constants.ts';
import { alertEvent } from '../../presentation/events.ts';
import { isEnemy } from '../types.ts';

// Enemies within GROUP_RANGE of each other (chained) form one group. A group is
// alerted once any member is visible to the squad; only alerted groups hunt or shoot.
export function assignEnemyGroups(cells: Position[]): number[] {
  const groupIds = cells.map(() => -1);
  let nextGroup = 0;
  cells.forEach((_, start) => {
    if (groupIds[start] >= 0) return;
    const stack = [start];
    groupIds[start] = nextGroup;
    for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
      const from = cells[current];
      cells.forEach((other, index) => {
        if (groupIds[index] < 0 && spawnDistance(from, other) <= GROUP_RANGE) {
          groupIds[index] = nextGroup;
          stack.push(index);
        }
      });
    }
    nextGroup += 1;
  });
  return groupIds;
}

// Marks every enemy group that has a member inside the squad's vision as alerted.
// Returns { state, events }: one alert event per group that was not alerted before.
export function refreshAlerts(state: GameState): StepResult {
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const visibleCells = getVisibleCells(state.map, players);
  const previous = state.alertedGroups ?? [];
  const alerted = new Set(previous);
  const events: StepResult['events'] = [];
  for (const unit of state.units) {
    if (isEnemy(unit) && unit.hp > 0 && visibleCells.has(cellKey(unit)) && !alerted.has(unit.groupId)) {
      alerted.add(unit.groupId);
      events.push(alertEvent({ groupId: unit.groupId }));
    }
  }
  return { state: { ...state, alertedGroups: [...alerted] }, events };
}
