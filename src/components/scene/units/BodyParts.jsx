import { useMemo } from 'react';
import { sharedGeometry } from './bodyGeometry.js';

// Renders one part list from the body registry. Each mesh gets its own material and a shared geometry.
function BodyPart({ part }) {
  const geometry = useMemo(() => sharedGeometry(part.shape, part.size), [part.shape, part.size]);
  return (
    <mesh geometry={geometry} position={part.position} rotation={part.rotation ?? [0, 0, 0]}>
      <meshStandardMaterial color={part.color} roughness={part.roughness ?? 0.8} metalness={part.metalness ?? 0} />
    </mesh>
  );
}

export function BodyParts({ parts }) {
  return parts.map((part, index) => <BodyPart key={index} part={part} />);
}
