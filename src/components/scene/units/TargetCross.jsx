import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// Crosshair drawn around the targeted enemy: four arms with a gap at the centre, always
// facing the camera (it lives in the billboard group). It pulses in scale and opacity.
const CROSS_ARM_LENGTH = 0.42;
const CROSS_ARM_WIDTH = 0.1;
const CROSS_GAP = 0.2;
const CROSS_COLOR = '#ff4d42';
const CROSS_OUTLINE = '#120504';
const CROSS_PULSE_SPEED = 4;
const CROSS_PULSE_AMOUNT = 0.18;

function CrossArms({ color, grow }) {
  const half = CROSS_GAP + CROSS_ARM_LENGTH / 2;
  const arms = [
    { pos: [0, half, 0], size: [CROSS_ARM_WIDTH + grow, CROSS_ARM_LENGTH + grow] },
    { pos: [0, -half, 0], size: [CROSS_ARM_WIDTH + grow, CROSS_ARM_LENGTH + grow] },
    { pos: [half, 0, 0], size: [CROSS_ARM_LENGTH + grow, CROSS_ARM_WIDTH + grow] },
    { pos: [-half, 0, 0], size: [CROSS_ARM_LENGTH + grow, CROSS_ARM_WIDTH + grow] },
  ];
  return arms.map((arm, i) => (
    <mesh key={i} position={arm.pos}>
      <planeGeometry args={arm.size} />
      <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} transparent />
    </mesh>
  ));
}

export function TargetCross() {
  const group = useRef();
  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * CROSS_PULSE_SPEED);
    group.current?.scale.setScalar(1 + pulse * CROSS_PULSE_AMOUNT);
  });
  return (
    <group ref={group} position={[0, 0.25, 0.25]} renderOrder={11}>
      <CrossArms color={CROSS_OUTLINE} grow={0.06} />
      <CrossArms color={CROSS_COLOR} grow={0} />
    </group>
  );
}
