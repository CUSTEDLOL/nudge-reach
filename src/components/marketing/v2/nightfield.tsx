"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The nightfield: a slow emerald particle sky + three drifting aurora glows,
 * rendered in one shared canvas behind the hero. Loaded lazily (dynamic
 * import, desktop + motion-gate only) so it costs nothing on mobile, no-JS,
 * or reduced-motion. `active` drops the frameloop when the hero is offscreen.
 */

const PALETTE = ["#06c167", "#6fe3a8", "#37ce86", "#a9f0c9"];

function Particles({ count = 2200 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // A wide, shallow disc the camera sits inside — depth without clutter.
      const radius = 4 + Math.pow(Math.random(), 0.6) * 16;
      const angle = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.35) * 7;
      pos[i * 3 + 2] = Math.sin(angle) * radius - 4;
      c.set(PALETTE[i % PALETTE.length]);
      const dim = 0.35 + Math.random() * 0.65;
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
    // Pointer parallax — the sky leans with the cursor, spring-damped.
    const px = state.pointer.x * 0.12;
    const py = state.pointer.y * 0.06;
    p.rotation.x += (py - p.rotation.x) * 0.02;
    p.rotation.z += (px * 0.3 - p.rotation.z) * 0.02;
    if (material.current) {
      material.current.opacity =
        0.75 + Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
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
  );
}

/** Soft radial-gradient sprite used for the drifting aurora glows. */
function useGlowTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    g.addColorStop(0, "rgba(6,193,103,0.55)");
    g.addColorStop(0.4, "rgba(6,193,103,0.18)");
    g.addColorStop(1, "rgba(6,193,103,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
}

function Aurora() {
  const texture = useGlowTexture();
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.children.forEach((child, i) => {
      child.position.x = Math.sin(t * 0.05 + i * 2.1) * (3 + i * 1.4);
      child.position.y = Math.cos(t * 0.04 + i * 1.7) * 1.2 - 0.5;
    });
  });

  const sprites = [
    { scale: 14, z: -8, opacity: 0.5 },
    { scale: 9, z: -5, opacity: 0.4 },
    { scale: 6, z: -3, opacity: 0.35 },
  ];

  return (
    <group ref={group}>
      {sprites.map((s, i) => (
        <sprite key={i} position={[0, 0, s.z]} scale={[s.scale, s.scale, 1]}>
          <spriteMaterial
            map={texture}
            transparent
            opacity={s.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

export default function Nightfield({ active }: { active: boolean }) {
  return (
    <Canvas
      className="!absolute !inset-0"
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.4, 7], fov: 58 }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
    >
      <Particles />
      <Aurora />
      <Fog />
    </Canvas>
  );
}

function Fog() {
  const { scene } = useThree();
  useMemo(() => {
    scene.fog = new THREE.FogExp2("#050d0a", 0.055);
  }, [scene]);
  return null;
}
