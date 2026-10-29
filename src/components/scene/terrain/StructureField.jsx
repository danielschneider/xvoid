import { useMemo } from 'react';
import { cellKey } from '../../../engine/map.ts';
import { toWorld, toWorldY } from '../coords.js';

// Upper-floor structure: interior partitions (solid, block sight), railings on the edge
// of each upper floor (see-through), and stair steps. Keeps wall/door/box rendering out.
const PARTITION_COLOR = '#3d4b45';
const RAIL_COLOR = '#7d8b84';
const STAIR_COLOR = '#8a9a92';

export function StructureField({ cells }) {
  const partitions = useMemo(() => cells.filter((cell) => cell.terrain === 'partition'), [cells]);
  const rails = useMemo(() => cells.filter((cell) => cell.terrain === 'rail'), [cells]);
  const stairs = useMemo(() => cells.filter((cell) => cell.terrain === 'stairs'), [cells]);

  return (
    <>
      {partitions.map((cell) => {
        const position = [toWorld(cell).x, toWorldY(cell) + 0.62, toWorld(cell).z];
        return (
          <mesh key={`p-${cellKey(cell)}`} position={position}>
            <boxGeometry args={[0.9, 1.24, 0.9]} />
            <meshStandardMaterial color={PARTITION_COLOR} roughness={0.9} metalness={0.2} />
          </mesh>
        );
      })}
      {rails.map((cell) => {
        const position = [toWorld(cell).x, toWorldY(cell) + 0.22, toWorld(cell).z];
        return (
          <mesh key={`r-${cellKey(cell)}`} position={position}>
            <boxGeometry args={[0.94, 0.44, 0.94]} />
            <meshStandardMaterial color={RAIL_COLOR} roughness={0.6} metalness={0.4} wireframe />
          </mesh>
        );
      })}
      {stairs.map((cell) => {
        const position = [toWorld(cell).x, toWorldY(cell) + 0.1, toWorld(cell).z];
        return (
          <mesh key={`s-${cellKey(cell)}`} position={position}>
            <boxGeometry args={[0.8, 0.2, 0.8]} />
            <meshStandardMaterial color={STAIR_COLOR} roughness={0.8} metalness={0.1} />
          </mesh>
        );
      })}
    </>
  );
}
