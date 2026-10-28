import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// Ground circle under a unit's feet. Pulses continuously in scale and opacity.
const FOOT_RADIUS = 0.4;
const FOOT_PULSE_SPEED = 3;
const FOOT_MIN_SCALE = 1;
const FOOT_MAX_SCALE = 1.35;
const FOOT_MIN_OPACITY = 0.35;
const FOOT_MAX_OPACITY = 0.95;

export function FootCircle({ color }) {
  const mesh = useRef();
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * FOOT_PULSE_SPEED);
    mesh.current.scale.setScalar(FOOT_MIN_SCALE + pulse * (FOOT_MAX_SCALE - FOOT_MIN_SCALE));
    mesh.current.material.opacity = FOOT_MIN_OPACITY + pulse * (FOOT_MAX_OPACITY - FOOT_MIN_OPACITY);
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[FOOT_RADIUS * 0.8, FOOT_RADIUS, 40]} />
      <meshBasicMaterial color={color} transparent opacity={FOOT_MIN_OPACITY} depthWrite={false} side={2} />
    </mesh>
  );
}
