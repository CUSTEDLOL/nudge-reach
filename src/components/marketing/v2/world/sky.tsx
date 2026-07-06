// src/components/marketing/v2/world/sky.tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { shift } from "../progress";
import { skyAt } from "./palette";
import { makeRadialTexture } from "./textures";

/**
 * The sky: scene background + fog + a horizon glow sprite + lights, all
 * scrubbed by scroll every frame. This is what turns night into morning.
 */
export function Sky() {
  const { scene } = useThree();
  const colors = useMemo(() => {
    const bg = new THREE.Color("#050d0a");
    // eslint-disable-next-line react-hooks/immutability
    scene.background = bg;
    // eslint-disable-next-line react-hooks/immutability
    scene.fog = new THREE.FogExp2("#050d0a", 0.05);
    return { bg };
  }, [scene]);

  const glow = useRef<THREE.Sprite>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const glowTexture = useMemo(() => makeRadialTexture(), []);

  useFrame(() => {
    const s = skyAt(shift.story, shift.after);
    colors.bg.set(s.top);
    (scene.fog as THREE.FogExp2).color.set(s.fog);
    if (glow.current) {
      const m = glow.current.material as THREE.SpriteMaterial;
      m.color.set(s.horizon);
      m.opacity = 0.45 + s.ambient * 0.35;
    }
    if (amb.current) amb.current.intensity = 0.4 + s.ambient * 1.2;
    if (sun.current) sun.current.intensity = s.ambient * 1.8;
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.5} />
      <directionalLight ref={sun} position={[3, 5, 2]} intensity={0.4} />
      <sprite ref={glow} position={[0, -1.6, -16]} scale={[48, 18, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.5}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </>
  );
}
