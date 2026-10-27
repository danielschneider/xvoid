import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld, toWorldY } from '../coords.js';
import { useTacticalCamera } from './useTacticalCamera.js';
export function CameraRig({ floorRef, cells, onCellTap, focusUnit, focusToken, mapOffset, movingUnitId, rotateToken }) {
  const { camera, scene } = useThree();
  const focusId = focusUnit?.id;

  useEffect(() => {
    if (!focusUnit || movingUnitId) return;
    const target = new THREE.Vector3(
      toWorld(focusUnit).x + mapOffset,
      toWorldY(focusUnit),
      toWorld(focusUnit).z + mapOffset,
    );
    const forward = camera.getWorldDirection(new THREE.Vector3());
    if (Math.abs(forward.y) < 1e-6) return;
    // Intersect the view ray with the unit's height plane to find the current view center.
    const t = (target.y - camera.position.y) / forward.y;
    const center = camera.position.clone().addScaledVector(forward, t);
    camera.position.x += target.x - center.x;
    camera.position.z += target.z - center.z;
  }, [focusId, focusToken, movingUnitId]);

  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!movingUnitId) return;
    const obj = scene.getObjectByName(`unit-${movingUnitId}`);
    if (obj) {
      obj.getWorldPosition(worldPos);
      camera.getWorldDirection(forward);
      if (Math.abs(forward.y) > 1e-6) {
        const t = (worldPos.y - camera.position.y) / forward.y;
        const center = camera.position.clone().addScaledVector(forward, t);
        const k = Math.min(1, delta * 10);
        camera.position.x += (worldPos.x - center.x) * k;
        camera.position.z += (worldPos.z - center.z) * k;
      }
    }
  });

  useTacticalCamera({ floorRef, cells, onCellTap, rotateToken });

  return null;
}
