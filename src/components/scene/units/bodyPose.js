import * as THREE from 'three';
import { toWorld, toWorldY } from '../coords.js';

// Walks the group along the route (or lerps to the destination when no route). Mutates motion progress only.
export function moveBody(refs, motion, { route, movement, destination }, delta) {
  if (!refs.group.current) return;
  if (!motion.initialized.current) {
    const first = route?.[0];
    if (first) refs.group.current.position.set(toWorld(first).x, toWorldY(first) + 0.035, toWorld(first).z);
    else refs.group.current.position.copy(destination);
    motion.initialized.current = true;
  }
  if (route?.length > 1) {
    if (motion.movementProgress.current.id !== movement.id)
      motion.movementProgress.current = { id: movement.id, elapsed: 0 };
    motion.movementProgress.current.elapsed += delta;
    const progress = Math.min(motion.movementProgress.current.elapsed / 0.22, route.length - 1);
    const segment = Math.min(Math.floor(progress), route.length - 2);
    const segmentProgress = progress >= route.length - 1 ? 1 : progress - segment;
    const from = route[segment];
    const to = route[segment + 1];
    motion.routeStart.set(toWorld(from).x, toWorldY(from) + 0.035, toWorld(from).z);
    motion.routeEnd.set(toWorld(to).x, toWorldY(to) + 0.035, toWorld(to).z);
    refs.group.current.position.lerpVectors(motion.routeStart, motion.routeEnd, segmentProgress);
  } else {
    refs.group.current.position.lerp(destination, 0.12);
  }
}

// Applies facing, fall tilt and recoil to the body, and the billboard orientation and height.
export function applyBodyPose(refs, { recoil, pose, facing, camera, fallenOrientation, spriteY }) {
  if (refs.bodyGroup.current) {
    refs.bodyGroup.current.rotation.y = facing;
    refs.bodyGroup.current.rotation.x = (-Math.PI / 2) * pose;
    // Body rocks back slightly when firing; pushed along local -z (away from the aim direction).
    refs.bodyGroup.current.position.z = -recoil * 0.08 * (1 - pose);
  }
  if (refs.billboard.current) {
    refs.billboard.current.quaternion.copy(camera.quaternion);
    if (pose > 0) refs.billboard.current.quaternion.slerp(fallenOrientation, pose);
    refs.billboard.current.position.y = THREE.MathUtils.lerp(spriteY, 0.05, pose);
  }
}
