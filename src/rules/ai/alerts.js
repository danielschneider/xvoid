import { cellKey } from '../grid/cells.js';
import { getVisibleCells } from '../sight/fog.js';
import { spawnDistance } from '../geometry.js';
import { GROUP_RANGE } from '../constants.js';

// Enemies within GROUP_RANGE of each other (chained) form one group. A group is
// alerted once any member is visible to the squad; only alerted groups hunt or shoot.
export function assignEnemyGroups(cells) {
  const groupIds = cells.map(() => -1);
  let nextGroup = 0;
  cells.forEach((_, start) => {
    if (groupIds[start] >= 0) return;
    const stack = [start];
    groupIds[start] = nextGroup;
    while (stack.length > 0) {
      const current = stack.pop();
      cells.forEach((other, index) => {
        if (groupIds[index] < 0 && spawnDistance(cells[current], other) <= GROUP_RANGE) {
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
export function refreshAlerts(state) {
  const players = state.units.filter((unit) => unit.team === 'player' && unit.hp > 0);
  const visibleCells = getVisibleCells(state.map, players);
  const alerted = new Set(state.alertedGroups ?? []);
  for (const unit of state.units) {
    if (unit.team === 'alien' && unit.hp > 0 && visibleCells.has(cellKey(unit))) alerted.add(unit.groupId);
  }
  return { ...state, alertedGroups: [...alerted] };
}
