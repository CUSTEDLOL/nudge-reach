// src/components/marketing/v2/world/collect.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";
import { makeBubbleTexture, makeRadialTexture } from "./textures";

/** The 6:48 AM receipts — what the night's work turned into. */
const RECEIPTS: { out: boolean; text: string }[] = [
  { out: true, text: "Payment link sent — ₹500 deposit" },
  { out: false, text: "Paid ✓ UPI · 6:41 AM" },
  { out: true, text: "Reminder set — 10:30 AM today" },
  { out: true, text: "See you at 7:30, Priya 🌅" },
];

const CENTER = new THREE.Vector3(1.3, 0.8, -54); // camera frames this at 0.9
const CHIP_H = 0.4;
const MOTES = 14;

/** Dawn scene: the payment thread stacks itself neatly while golden motes
 *  rise with the sun — revenue settling into place. */
export function CollectScene() {
  const group = useRef<THREE.Group>(null);
  const moteGroup = useRef<THREE.Group>(null);
  const moteTexture = useMemo(() => makeRadialTexture(64), []);

  const chips = useMemo(
    () =>
      RECEIPTS.map((r, i) => {
        const { texture, aspect } = makeBubbleTexture(r.text, r.out);
        return {
          texture,
          aspect,
          x: CENTER.x + (r.out ? 0.35 : -0.35) + (rand(i, 21) - 0.5) * 0.2,
          y: CENTER.y + 0.75 - i * 0.5,
          enterAt: i * 0.14,
        };
      }),
    []
  );

  const motes = useMemo(
    () =>
      Array.from({ length: MOTES }, (_, i) => ({
        x: CENTER.x + (rand(i, 22) - 0.5) * 4.5,
        z: CENTER.z + (rand(i, 23) - 0.5) * 3,
        speed: 0.14 + rand(i, 24) * 0.22,
        phase: rand(i, 25) * 10,
        size: 0.1 + rand(i, 26) * 0.16,
      })),
    []
  );

  useEffect(() => () => chips.forEach((c) => c.texture.dispose()), [chips]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const d = localProgress(shift.story, "dawn");
    // On stage through dawn, easing away as the morning zone takes over.
    const env = smooth01(clamp01(d / 0.2)) * (1 - smooth01(shift.after * 2.2));
    g.visible = env > 0.02;
    if (moteGroup.current) moteGroup.current.visible = g.visible;
    if (!g.visible) return;
    const t = clock.elapsedTime;

    g.children.forEach((child, i) => {
      const chip = chips[i];
      const enter = smooth01(clamp01((d - chip.enterAt) / 0.3));
      // rises from below into its slot in the stack
      child.position.set(
        chip.x,
        chip.y - (1 - enter) * 1.4 + Math.sin(t * 0.7 + i * 1.7) * 0.03,
        CENTER.z
      );
      child.scale.setScalar(0.85 + enter * 0.15);
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = enter * env;
    });

    if (moteGroup.current) {
      moteGroup.current.children.forEach((mote, i) => {
        const mt = motes[i];
        const cycle = ((t * mt.speed + mt.phase) % 1 + 1) % 1;
        mote.position.set(mt.x, CENTER.y - 1.6 + cycle * 3.4, mt.z);
        const m = (mote as THREE.Sprite).material as THREE.SpriteMaterial;
        m.opacity = Math.sin(cycle * Math.PI) * 0.5 * env;
      });
    }
  });

  return (
    <>
      <group ref={group} visible={false}>
        {chips.map((chip, i) => (
          <mesh key={i} rotation={[0, -0.12, 0]}>
            <planeGeometry args={[CHIP_H * chip.aspect, CHIP_H]} />
            <meshBasicMaterial map={chip.texture} transparent opacity={0} />
          </mesh>
        ))}
      </group>
      <group ref={moteGroup} visible={false}>
        {motes.map((mt, i) => (
          <sprite key={i} scale={[mt.size, mt.size, 1]}>
            <spriteMaterial
              map={moteTexture}
              color="#ffd9a0"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        ))}
      </group>
    </>
  );
}
