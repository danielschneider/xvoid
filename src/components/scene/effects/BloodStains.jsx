import { useEffect, useMemo } from 'react';
import { createBloodSplatTexture } from '../textures/bloodTexture.js';

// Persistent green blood splats lying flat on the ground. `stains` is a list of
// { x, y, z, radius, rotation, seed } in world units; the list is owned by the parent.
export function BloodStains({ stains }) {
  const texture = useMemo(() => createBloodSplatTexture(1), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      {stains.map((stain) => (
        <mesh
          key={stain.key}
          position={[stain.x, stain.y, stain.z]}
          rotation={[-Math.PI / 2, 0, stain.rotation]}
          renderOrder={2}
        >
          <planeGeometry args={[stain.radius * 2, stain.radius * 2]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
