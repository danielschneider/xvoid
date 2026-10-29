import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { getFlankedBy } from '../../../engine/game.ts';
import { cellKey } from '../../../engine/map.ts';
import { toWorld, toWorldY } from '../coords.js';
// Red lines from every unit that flanks a target to that target. Targets are player units
// (flanked by enemies) and visible enemies (flanked by player units).
// Hidden while any unit is moving: positions already show the destination, but the
// bodies are still walking there, so flank lines would point at units not yet in place.
export function FlankLines({ state, visibleCellKeys }) {
  const moving = !!state.movement;
  const pairs = useMemo(
    () =>
      moving
        ? []
        : state.units
            .filter((unit) => unit.hp > 0 && (unit.team === 'player' || visibleCellKeys.has(cellKey(unit))))
            .flatMap((unit) =>
              getFlankedBy(state, unit)
                .filter((enemy) => visibleCellKeys.has(cellKey(enemy)))
                .map((enemy) => ({ key: `${unit.id}-${enemy.id}`, from: enemy, to: unit }))
            ),
    [state, visibleCellKeys, moving]
  );
  return pairs.map(({ key, from, to }) => {
    const points = [from, to].map((cell) => new THREE.Vector3(toWorld(cell).x, toWorldY(cell) + 0.9, toWorld(cell).z));
    return (
      <Line
        key={key}
        points={points}
        color="#ff4d42"
        lineWidth={3}
        dashed
        dashSize={0.25}
        gapSize={0.15}
        depthTest={false}
        renderOrder={997}
      />
    );
  });
}
