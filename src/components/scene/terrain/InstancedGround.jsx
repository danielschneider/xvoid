import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { toWorld, toWorldY } from '../coords.js';
export function InstancedGround({ visibleCells, meshRef }) {
  const data = useMemo(() => visibleCells.filter((cell) => cell.walkable), [visibleCells]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0.12 }), []);

  useEffect(() => {
    if (!meshRef.current) return;
    data.forEach((cell, index) => {
      dummy.position.set(toWorld(cell).x, toWorldY(cell) - 0.08, toWorld(cell).z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index, dummy.matrix);
      const color = cell.level === 0
        ? (cell.corridor ? '#263332' : cell.structure ? '#303c39' : '#202b2b')
        : cell.level === 1 ? '#52605a' : '#6d7568';
      meshRef.current.setColorAt(index, new THREE.Color(color));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    // Raycasts use the bounding sphere; recompute it so taps on the instances are not culled.
    meshRef.current.computeBoundingSphere();
  }, [data, dummy, meshRef]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, material, data.length]} receiveShadow={false}>
      <boxGeometry args={[1.02, 0.16, 1.02]} />
    </instancedMesh>
  );
}
