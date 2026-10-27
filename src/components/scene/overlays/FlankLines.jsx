import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { getFlankedBy } from '../../../engine/game.js';
import { cellKey } from '../../../engine/map.js';
import { toWorld, toWorldY } from '../coords.js';
// Red lines from every enemy that flanks a player unit to that unit.
// Hidden while any unit is moving: positions already show the destination, but the
// bodies are still walking there, so flank lines would point at units not yet in place.
export function FlankLines({ state, visibleCellKeys }) {
  const moving = !!state.movement;
  const pairs = useMemo(
    () =>
      moving
        ? []
        : state.units
            .filter((unit) => unit.team === 'player' && unit.hp > 0)
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
