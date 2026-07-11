// src/components/marketing/v2/world/sky.tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { localProgress, shift } from "../progress";
import { skyAt } from "./palette";
import { smooth01 } from "./path";
import { makeRadialTexture } from "./textures";

/**
 * The sky: scene background + fog + a horizon glow sprite + lights, all
 * scrubbed by scroll every frame — plus the sun itself, which climbs from
 * below the horizon through dawn and hangs in the morning sky.
 */
export function Sky() {
  const { scene } = useThree();
  const colors = useMemo(() => {
    const bg = new THREE.Color("#f5faf7");
    // eslint-disable-next-line react-hooks/immutability
    scene.background = bg;
    // eslint-disable-next-line react-hooks/immutability
    scene.fog = new THREE.FogExp2("#f5faf7", 0.05);
    return { bg };
  }, [scene]);

  const glow = useRef<THREE.Sprite>(null);
  const sunDisc = useRef<THREE.Sprite>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const glowTexture = useMemo(() => makeRadialTexture(), []);

  useFrame(({ camera }) => {
    const s = skyAt(shift.story, shift.after);
    colors.bg.set(s.top);
    (scene.fog as THREE.FogExp2).color.set(s.fog);
    if (glow.current) {
      const m = glow.current.material as THREE.SpriteMaterial;
      m.color.set(s.horizon);
      m.opacity = 0.38; // visible colour, while the page itself remains white
      // The horizon is infinitely far away: it travels with the camera.
      glow.current.position.set(camera.position.x, -1.6, camera.position.z - 16);
    }
    if (amb.current) amb.current.intensity = 0.4 + s.ambient * 1.2;
    if (sun.current) sun.current.intensity = s.ambient * 1.8;

    // Sunrise: starts breaking the horizon late in the dawn chapter,
    // fully up by the end of the daylight zone.
    if (sunDisc.current) {
      const rise = localProgress(shift.story, "dawn") * 0.35 + shift.after * 0.65;
      const m = sunDisc.current.material as THREE.SpriteMaterial;
      m.opacity = smooth01(rise) * 0.72;
      sunDisc.current.position.set(
        camera.position.x + 1.8,
        -3.4 + rise * 4.8,
        camera.position.z - 15
      );
      const scale = 3 + rise * 2.5;
      sunDisc.current.scale.set(scale, scale, 1);
    }
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
        />
      </sprite>
      <sprite ref={sunDisc} position={[1.8, -3.4, -15]} scale={[3, 3, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#f4b64f"
          transparent
          opacity={0}
          depthWrite={false}
          fog={false}
        />
      </sprite>
    </>
  );
}
