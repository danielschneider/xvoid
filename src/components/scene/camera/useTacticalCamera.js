import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  KEY_PAN_DISTANCE,
  angleDelta,
  keyPanStep,
  keyRotation,
  pinchMetrics,
  pinchZoom,
  rotationSteps,
  wheelZoom,
} from './gestures.js';

// Rotates the orbit camera a quarter turn around the map centre.
function rotateCamera(camera, direction) {
  const offset = camera.position.clone();
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 2);
  camera.position.copy(offset);
  camera.lookAt(0, 0, 0);
}

// Pointer, wheel and keyboard camera input for the tactical view, plus HUD quarter-turn requests.
// All listeners are removed on unmount or when a dependency changes.
export function useTacticalCamera({ floorRef, cells, onCellTap, rotateToken }) {
  const { camera, gl, size } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  // Quarter-turn requests from the HUD (rotateToken changes) and keyboard use the same rotator.
  useEffect(() => {
    if (!rotateToken) return;
    rotateCamera(camera, rotateToken.direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateToken]);

  useEffect(() => {
    const element = gl.domElement;
    const pointers = new Map();
    let gesture = null;
    let moved = false;

    const distanceAndAngle = () => pinchMetrics([...pointers.values()]);
    const pan = (dx, dy) => {
      const scale = (camera.top - camera.bottom) / (camera.zoom * size.height);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const vertical = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      right.y = 0;
      vertical.y = 0;
      right.normalize();
      vertical.normalize();
      camera.position.addScaledVector(right, -dx * scale);
      camera.position.addScaledVector(vertical, dy * scale);
    };
    const pointerDown = (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      element.setPointerCapture?.(event.pointerId);
      moved = false;
      if (pointers.size === 1) gesture = { last: { x: event.clientX, y: event.clientY }, origin: { x: event.clientX, y: event.clientY }, isPinch: false };
      if (pointers.size === 2) {
        gesture = { ...distanceAndAngle(), isPinch: true, lastAngle: distanceAndAngle().angle, rotationAcc: 0 };
      }
    };
    const pointerMove = (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2 && gesture?.isPinch) {
        const current = distanceAndAngle();
        if (!current) return;
        camera.zoom = pinchZoom(camera.zoom, gesture.distance, current.distance);
        gesture.distance = current.distance;
        gesture.rotationAcc += angleDelta(current.angle, gesture.lastAngle);
        gesture.lastAngle = current.angle;
        const turns = rotationSteps(gesture.rotationAcc);
        for (const dir of turns.directions) rotateCamera(camera, dir);
        gesture.rotationAcc = turns.remainder;
        moved = true;
        camera.updateProjectionMatrix();
      } else if (pointers.size === 1 && gesture && !gesture.isPinch) {
        const dx = event.clientX - gesture.last.x;
        const dy = event.clientY - gesture.last.y;
        if (Math.hypot(event.clientX - gesture.origin.x, event.clientY - gesture.origin.y) > 6) moved = true;
        if (moved) pan(dx, dy);
        gesture.last = { x: event.clientX, y: event.clientY };
      }
    };
    const pointerUp = (event) => {
      const point = pointers.get(event.pointerId);
      if (point && !moved && pointers.size === 1 && floorRef.current) {
        const rect = element.getBoundingClientRect();
        pointer.set(((point.x - rect.left) / rect.width) * 2 - 1, -((point.y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(floorRef.current)[0];
        if (hit?.instanceId !== undefined) onCellTap(cells[hit.instanceId]);
      }
      pointers.delete(event.pointerId);
      if (pointers.size === 1) {
        const [remaining] = pointers.values();
        gesture = { last: remaining, origin: remaining, isPinch: false };
        moved = false;
      } else if (pointers.size === 0) {
        gesture = null;
      }
    };
    const wheel = (event) => {
      event.preventDefault();
      camera.zoom = wheelZoom(camera.zoom, event.deltaY);
      camera.updateProjectionMatrix();
    };
    const keydown = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      const turn = keyRotation(key);
      if (turn !== null) {
        rotateCamera(camera, turn);
        return;
      }
      const step = keyPanStep(key);
      if (step) {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const vertical = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        right.y = 0;
        vertical.y = 0;
        right.normalize();
        vertical.normalize();
        camera.position.addScaledVector(right, step.dx * KEY_PAN_DISTANCE).addScaledVector(vertical, step.dy * KEY_PAN_DISTANCE);
      }
    };

    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerUp);
    element.addEventListener('pointercancel', pointerUp);
    element.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keydown);
    return () => {
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp);
      element.removeEventListener('pointercancel', pointerUp);
      element.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', keydown);
    };
  }, [camera, cells, floorRef, gl, onCellTap, pointer, raycaster, size.height]);
}
