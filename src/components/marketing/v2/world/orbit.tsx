// src/components/marketing/v2/world/orbit.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";
import { makeBubbleTexture, makeRadialTexture } from "./textures";

const LEADS = [
  "Priya — asked about the bridal package",
  "Rahul — wanted a root canal quote",
  "Aisha — Saturday slot, never confirmed",
  "Vikram — went quiet on Tuesday",
  "Meera — asked for the price list",
  "Arjun — wanted to reschedule",
  "Sana — follow-up due today",
  "Dev — no-show on Monday",
];

const CENTER = new THREE.Vector3(-2.6, 0.4, -46); // camera looks here at 0.64
const CHIP_H = 0.34;

/** Ghosted leads drift cold, then the chase pulls them back into orbit. */
export function OrbitScene({ fx }: { fx: boolean }) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const glowTexture = useMemo(() => makeRadialTexture(), []);

  const chips = useMemo(
    () =>
      LEADS.map((text, i) => {
        const { texture, aspect } = makeBubbleTexture(text, false);
        return {
          texture,
          aspect,
          angle: (i / LEADS.length) * Math.PI * 2,
          speed: 0.25 + rand(i, 9) * 0.2,
        };
      }),
    []
  );

  useEffect(() => () => chips.forEach((c) => c.texture.dispose()), [chips]);

  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    // Scene envelope: enters with "It chases", gone before the dawn beat.
    const exit = 1 - smooth01((shift.story - CHAPTERS.dawn.start) / 0.08);
    g.visible = shift.story > CHAPTERS.book.end - 0.03 && exit > 0.02;
    if (!g.visible) return;
    const c = localProgress(shift.story, "chase");
    const drift = smooth01(clamp01(c / 0.45)); // leads going cold
    const pull = smooth01(clamp01((c - 0.45) / 0.55)); // the chase brings them back
    const radius = 1.9 + drift * 1.3 - pull * 1.7;
    const t = clock.elapsedTime;

    g.children.forEach((child, i) => {
      if (i >= chips.length) return; // the glow sprite + orbit ring
      const chip = chips[i];
      const a = chip.angle + t * chip.speed * (0.15 + pull);
      child.position.set(
        CENTER.x + Math.cos(a) * radius,
        CENTER.y +
          Math.sin(a) * radius * 0.5 +
          Math.sin(t * chip.speed * 3 + i) * 0.05,
        CENTER.z + Math.sin(a * 1.3) * 0.4
      );
      child.lookAt(camera.position);
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = (0.95 - drift * 0.6 + pull * 0.6) * exit;
    });

    if (glow.current) {
      // The engine's heartbeat quickens as the chase lands.
      (glow.current.material as THREE.SpriteMaterial).opacity =
        (fx ? 0.35 + pull * 0.35 + Math.sin(t * 3) * 0.07 * pull : 0.3) * exit;
    }
    // The orbit line itself materializes as leads come back under control.
    if (ring.current) {
      ring.current.scale.set(radius, radius * 0.5, 1);
      (ring.current.material as THREE.MeshBasicMaterial).opacity =
        pull * 0.3 * exit;
    }
  });

  return (
    <group ref={group} visible={false}>
      {chips.map((chip, i) => (
        <mesh key={i}>
          <planeGeometry args={[CHIP_H * chip.aspect, CHIP_H]} />
          <meshBasicMaterial map={chip.texture} transparent opacity={0.95} />
        </mesh>
      ))}
      <sprite ref={glow} position={[CENTER.x, CENTER.y, CENTER.z]} scale={[2.6, 2.6, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#06c167"
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <mesh ref={ring} position={[CENTER.x, CENTER.y, CENTER.z]}>
        <ringGeometry args={[0.99, 1.02, 64]} />
        <meshBasicMaterial
          color="#06c167"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
