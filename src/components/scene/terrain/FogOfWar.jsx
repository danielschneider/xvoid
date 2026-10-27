import { useMemo } from 'react';
import * as THREE from 'three';
import { cellKey } from '../../../engine/map.js';
import { toWorld, toWorldY } from '../coords.js';
export function FogOfWar({ cells, visibleCellKeys }) {
  const foggedCells = useMemo(() => cells.filter((cell) => cell.level > 0 && !visibleCellKeys.has(cellKey(cell))), [cells, visibleCellKeys]);
  return foggedCells.map((cell) => (
    <mesh key={`fog-${cellKey(cell)}`} position={[toWorld(cell).x, toWorldY(cell) + 0.026, toWorld(cell).z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#080d0e" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  ));
}
