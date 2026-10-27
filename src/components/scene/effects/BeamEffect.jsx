import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld, toWorldY } from '../coords.js';
import { createDamageTexture } from '../textures/labels.js';
import { Particles } from './Particles.jsx';
import { burstSpawns } from './particleSim.js';
import {
  SHAKE_DURATION,
  TRACER_TRAIL,
  burstVelocities,
  impactSpec,
  shakeAt,
  tracerLength,
  travelDuration,
} from './impact.js';

const TRACER_WIDTH = 0.12;
const PARTICLE_CAPACITY = 64;
const CRIT_EXTRA_SPARKS = 6;
const DUST_SPEED = 0.5;
const MUZZLE_COUNT = 6;
const MUZZLE_OPTIONS = { speedMin: 1.5, speedMax: 3, spread: 0.35, life: 0.25, size: 3, color: [1, 0.88, 0.55] };
const SPARK_LIFE = 0.4;
const SPARK_SIZE = 3;
const SPARK_COLOR = [1, 0.66, 0.2];
const DUST_LIFE = 0.5;
const DUST_SIZE = 6;
const DUST_COLOR = [0.72, 0.66, 0.56];
const UP = new THREE.Vector3(0, 1, 0);

const tracerVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Bright head with a trail behind it. Alpha is quantised to 3 steps for the pixel-art look.
const tracerFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLength;
  uniform float uHead;
  uniform float uTrail;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float s = vUv.x * uLength;
    float behind = uHead - s;
    if (behind < 0.0 || behind > uTrail) discard;
    float fall = 1.0 - behind / uTrail;
    float a = pow(fall, 1.5) * uOpacity;
    a *= 1.0 - abs(vUv.y - 0.5) * 1.6;
    a = floor(clamp(a, 0.0, 1.0) * 3.0 + 0.5) / 3.0;
    if (a <= 0.0) discard;
    float head = smoothstep(0.8, 1.0, fall);
    vec3 col = mix(uColor, vec3(1.0), head * 0.7);
    gl_FragColor = vec4(col, a);
  }
`;

function createTracerMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uLength: { value: 1 },
      uHead: { value: 0 },
      uTrail: { value: TRACER_TRAIL },
      uOpacity: { value: 1 },
    },
    vertexShader: tracerVertexShader,
    fragmentShader: tracerFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Builds a ribbon from start to end, lying in the plane spanned by the direction and world up.
function tracerBasis(direction) {
  const side = new THREE.Vector3().crossVectors(direction, UP);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(side, direction).normalize();
  return new THREE.Matrix4().makeBasis(direction, up, side);
}

export function BeamEffect({ shot, camera, cover }) {
  const damageMaterial = useRef();
  const tracerRef = useRef();
  const lightRef = useRef();
  const particlesRef = useRef();
  const impactEmitted = useRef(false);
  const elapsed = useRef(0);
  const previousShake = useRef({ x: 0, y: 0 });
  const damageTexture = useMemo(() => createDamageTexture(shot), [shot.damage, shot.hit, shot.crit]);
  const spec = useMemo(() => impactSpec(shot, cover), [shot.hit, shot.crit, cover]);
  const animationDuration = shot.enemyShot ? 1.15 : 0.65;
  const travel = travelDuration(shot.enemyShot);

  const start = useMemo(() => {
    const from = toWorld(shot.from);
    return new THREE.Vector3(from.x, toWorldY(shot.from) + 0.8, from.z);
  }, [shot.from]);
  const end = useMemo(() => {
    const to = toWorld(shot.to);
    return new THREE.Vector3(to.x, toWorldY(shot.to) + 0.8, to.z);
  }, [shot.to]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), []);
  const tracerMaterial = useMemo(() => createTracerMaterial(shot.hit ? '#ff705f' : '#57d8ed'), [shot.hit]);
  // Crits add extra sparks on top of the impactSpec counts.
  const sparkCount = spec.sparkCount > 0 ? spec.sparkCount + (shot.crit ? CRIT_EXTRA_SPARKS : 0) : 0;
  const impactVelocities = useMemo(
    () => ({
      sparks: burstVelocities(sparkCount, shot.id),
      dust: burstVelocities(spec.dustCount, shot.id + 1000).map((v) => ({
        x: v.x * DUST_SPEED,
        y: v.y * DUST_SPEED,
        z: v.z * DUST_SPEED,
      })),
    }),
    [sparkCount, spec.dustCount, shot.id]
  );

  const direction = useMemo(() => new THREE.Vector3().subVectors(end, start), [start, end]);
  const distance = direction.length();
  const unitDirection = useMemo(() => direction.clone().normalize(), [direction]);
  const totalLength = tracerLength(distance, shot.hit);

  useEffect(
    () => () => {
      geometry.dispose();
      tracerMaterial.dispose();
      damageTexture.dispose();
    },
    [geometry, tracerMaterial, damageTexture]
  );

  const tracerQuaternion = useMemo(
    () => new THREE.Quaternion().setFromRotationMatrix(tracerBasis(unitDirection)),
    [unitDirection]
  );

  // Muzzle flash at the shooter, pointed along the shot.
  useEffect(() => {
    particlesRef.current?.emitCone(start, unitDirection, MUZZLE_COUNT, MUZZLE_OPTIONS);
  }, [start, unitDirection]);

  const emitImpact = () => {
    const particles = particlesRef.current;
    if (!particles) return;
    if (sparkCount > 0) {
      particles.emitBurst(
        burstSpawns(end, impactVelocities.sparks, { life: SPARK_LIFE, size: SPARK_SIZE, color: SPARK_COLOR })
      );
    }
    if (spec.dustCount > 0) {
      particles.emitBurst(
        burstSpawns(end, impactVelocities.dust, { life: DUST_LIFE, size: DUST_SIZE, color: DUST_COLOR })
      );
    }
  };

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;
    const opacity = Math.max(0, 1 - t / animationDuration);

    if (!impactEmitted.current && t >= travel) {
      impactEmitted.current = true;
      emitImpact();
    }

    const progress = Math.min(1, t / travel);
    const tracer = tracerRef.current;
    if (tracer) {
      tracer.material.uniforms.uOpacity.value = opacity;
      tracer.material.uniforms.uLength.value = totalLength;
      tracer.material.uniforms.uHead.value = progress * totalLength;
    }
    if (damageMaterial.current) damageMaterial.current.opacity = opacity;
    if (lightRef.current) {
      lightRef.current.intensity = t >= travel ? spec.lightIntensity * opacity : 0;
    }

    const shake = shakeAt(t, SHAKE_DURATION, spec.shakeStrength);
    camera.position.x += shake.x - previousShake.current.x;
    camera.position.y += shake.y - previousShake.current.y;
    previousShake.current = shake;
  });

  return (
    <>
      <mesh
        ref={tracerRef}
        geometry={geometry}
        material={tracerMaterial}
        position={start}
        quaternion={tracerQuaternion}
        scale={[totalLength, TRACER_WIDTH, 1]}
        renderOrder={8}
        frustumCulled={false}
      />
      {shot.hit && <pointLight ref={lightRef} position={end} color="#ff664f" intensity={0} distance={3} decay={2} />}
      <Particles ref={particlesRef} seed={shot.id} capacity={PARTICLE_CAPACITY} gravity={-6} />
      <mesh position={[end.x, end.y + 1.1, end.z]} quaternion={camera.quaternion} renderOrder={10}>
        <planeGeometry args={[2.6, 1.3]} />
        <meshBasicMaterial
          ref={damageMaterial}
          map={damageTexture}
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
