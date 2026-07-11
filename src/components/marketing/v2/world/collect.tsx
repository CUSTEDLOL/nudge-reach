// src/components/marketing/v2/world/collect.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";
import {
  makeBubbleTexture,
  makeRadialTexture,
  type BubbleStyle,
} from "./textures";

/** The 6:48 AM receipts — a real WhatsApp exchange, not four floating chips:
 *  link sent → customer replies → UPI receipt → deposit logged → reminder →
 *  the warm sign-off. Sender right, customer left, system receipts centered. */
const THREAD: { style: BubbleStyle; text: string }[] = [
  {
    style: "out",
    text: "Hi Priya! Saturday 7:30 PM is yours — here's the ₹500 deposit link to lock it in",
  },
  { style: "in", text: "done, paid just now 🙏" },
  { style: "receipt", text: "₹500 received · UPI · 6:41 AM ✓" },
  { style: "receipt", text: "Deposit logged → Priya · Sat, 7:30 PM" },
  { style: "out", text: "Perfect, you're all set! Reminder scheduled for 10:30 AM today." },
  { style: "out", text: "See you at 7:30, Priya ✨" },
];
const CUSTOMER_INDEX = 1; // the reply that gets a typing indicator first

const CENTER = new THREE.Vector3(1.3, 0.8, -54); // camera frames this at 0.9
const CHIP_H = 0.62; // ~2× — the thread must read like a real chat, not confetti
const ROW = 0.78;
const TOP = CENTER.y + 1.9;
const MOTES = 14;

/** Dawn scene: the payment thread writes itself while golden motes rise. */
export function CollectScene() {
  const group = useRef<THREE.Group>(null);
  const typing = useRef<THREE.Mesh>(null);
  const moteGroup = useRef<THREE.Group>(null);
  const moteTexture = useMemo(() => makeRadialTexture(64), []);
  const typingTexture = useMemo(() => makeBubbleTexture("• • •", "in", undefined, 2), []);

  const chips = useMemo(
    () =>
      THREAD.map((r, i) => {
        const { texture, aspect } = makeBubbleTexture(r.text, r.style, undefined, 2);
        const lane =
          r.style === "out" ? 0.85 : r.style === "in" ? -1.0 : -0.15;
        return {
          texture,
          aspect,
          x: CENTER.x + lane + (rand(i, 21) - 0.5) * 0.12,
          y: TOP - i * ROW,
          // Sequential reveal: one bubble at a time, reading order.
          enterAt: 0.06 + i * 0.11,
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

  useEffect(
    () => () => {
      chips.forEach((c) => c.texture.dispose());
      typingTexture.texture.dispose();
    },
    [chips, typingTexture]
  );

  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    const d = localProgress(shift.story, "dawn");
    // On stage through dawn, FULLY gone by the story's end so nothing ever
    // lingers behind the morning section (belt: dawn tail; braces: after).
    const env =
      smooth01(clamp01(d / 0.15)) *
      (1 - smooth01((d - 0.86) / 0.14)) *
      (1 - smooth01(shift.after * 2.2));
    g.visible = env > 0.02;
    if (moteGroup.current) moteGroup.current.visible = g.visible;
    if (typing.current) typing.current.visible = g.visible;
    if (!g.visible) return;
    const t = clock.elapsedTime;

    // Portrait: nudge the thread toward the look axis and a touch deeper.
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1.6;
    const squeeze = smooth01((1.05 - aspect) / 0.5);
    g.position.set(-0.85 * squeeze, -0.35 * squeeze, -1.2 * squeeze);

    g.children.forEach((child, i) => {
      const chip = chips[i];
      if (!chip) return;
      const enter = smooth01(clamp01((d - chip.enterAt) / 0.09));
      // Rises into its row like a message landing in a chat.
      child.position.set(
        chip.x,
        chip.y - (1 - enter) * 0.5 + Math.sin(t * 0.7 + i * 1.7) * 0.02,
        CENTER.z
      );
      child.scale.setScalar(Math.max(0.85 + enter * 0.15, 0.0001));
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = enter * env;
    });

    // Typing indicator: flickers in just before the customer's reply.
    if (typing.current) {
      const reply = chips[CUSTOMER_INDEX];
      const pre = smooth01(clamp01((d - (reply.enterAt - 0.1)) / 0.05));
      const done = smooth01(clamp01((d - reply.enterAt) / 0.04));
      typing.current.position.set(reply.x, reply.y, CENTER.z + 0.01);
      (typing.current.material as THREE.MeshBasicMaterial).opacity =
        pre * (1 - done) * env;
    }

    if (moteGroup.current) {
      moteGroup.current.position.copy(g.position);
      moteGroup.current.children.forEach((mote, i) => {
        const mt = motes[i];
        const cycle = ((t * mt.speed + mt.phase) % 1 + 1) % 1;
        mote.position.set(mt.x, CENTER.y - 1.6 + cycle * 3.4, mt.z);
        const m = (mote as THREE.Sprite).material as THREE.SpriteMaterial;
        m.opacity = Math.sin(cycle * Math.PI) * 0.35 * env;
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
      <mesh ref={typing} rotation={[0, -0.12, 0]} visible={false}>
        <planeGeometry
          args={[CHIP_H * typingTexture.aspect * 0.8, CHIP_H * 0.8]}
        />
        <meshBasicMaterial map={typingTexture.texture} transparent opacity={0} />
      </mesh>
      <group ref={moteGroup} visible={false}>
        {motes.map((mt, i) => (
          <sprite key={i} scale={[mt.size, mt.size, 1]}>
            <spriteMaterial
              map={moteTexture}
              color="#e4b566"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </sprite>
        ))}
      </group>
    </>
  );
}
