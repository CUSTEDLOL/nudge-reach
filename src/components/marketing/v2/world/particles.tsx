// src/components/marketing/v2/world/particles.tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, shift } from "../progress";
import { rand } from "./path";

const PALETTE = ["#06c167", "#6fe3a8", "#37ce86", "#a9f0c9"];

const STREAKS = [
  { period: 7.3, offset: 0.0, x0: -7, y0: 3.6, z: -9, slope: -0.2 },
  { period: 11.1, offset: 4.3, x0: -2, y0: 4.2, z: -12, slope: -0.14 },
];

/** Occasional meteor streaks — deep-night only, gone before dawn. */
function ShootingStars() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const night = shift.story < 0.72;
    const t = clock.elapsedTime;
    STREAKS.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      const local = (t + s.offset) % s.period;
      const dur = 1.2;
      m.visible = night && local < dur;
      if (!m.visible) return;
      const p = local / dur;
      m.position.set(s.x0 + p * 10, s.y0 + p * 10 * s.slope, s.z);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.55;
    });
  });

  return (
    <>
      {STREAKS.map((s, i) => (
        <mesh
          key={i}
          visible={false}
          rotation={[0, 0, Math.atan(s.slope)]}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <planeGeometry args={[1.3, 0.02]} />
          <meshBasicMaterial
            color="#bfffdd"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </>
  );
}

/** The emerald night sky that thins into daylight motes as morning comes. */
export function Particles({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const radius = 4 + Math.pow(rand(i, 11), 0.6) * 18;
      const angle = rand(i, 12) * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (rand(i, 13) - 0.35) * 8;
      pos[i * 3 + 2] = Math.sin(angle) * radius - 4;
      c.set(PALETTE[i % PALETTE.length]);
      const dim = 0.35 + rand(i, 14) * 0.65;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    const p = points.current;
    if (!p) return;
    p.rotation.y += delta * 0.016;
    const px = state.pointer.x * 0.12;
    const py = state.pointer.y * 0.06;
    p.rotation.x += (py - p.rotation.x) * 0.02;
    p.rotation.z += (px * 0.3 - p.rotation.z) * 0.02;
    if (material.current) {
      const day = shift.story >= 1 ? clamp01(shift.after) : 0;
      const twinkle = 0.75 + Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
      material.current.opacity = twinkle * (1 - day * 0.7);
      material.current.size = 0.055 - day * 0.02;
    }
  });

  return (
    <>
      <points ref={points}>
        <bufferGeometry key={count}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={material}
          size={0.055}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <ShootingStars />
    </>
  );
}
