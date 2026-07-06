// src/components/marketing/v2/world/message-stream.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, shift } from "../progress";
import { rand, smooth01 } from "./path";
import { makeBubbleTexture } from "./textures";

/** Real conversations, alternating customer (in) and Front Desk (out). */
const THREAD: { out: boolean; text: string }[] = [
  { out: false, text: "Hi — do you have anything tomorrow evening?" },
  { out: true, text: "Yes! 7:30 PM with Dr. Mehta is open. Shall I book it?" },
  { out: false, text: "How much is a classic facial?" },
  { out: true, text: "₹1,800, about 50 minutes. Want Saturday 4 PM?" },
  { out: false, text: "Can I move my 11 AM to later this week?" },
  { out: true, text: "Done — Thursday 4 PM. Confirmation sent ✓" },
  { out: false, text: "Do you take insurance?" },
  { out: true, text: "We do — Star Health and HDFC Ergo. Bring your card." },
];

const CARD_H = 0.5;

/** The corridor of chat bubbles the camera flies through after midnight. */
export function MessageStream({ cards }: { cards: number }) {
  const group = useRef<THREE.Group>(null);

  // One chat column drifting on the RIGHT of the flight path (the chapter
  // copy owns the left half of the screen): inbound messages sit on the
  // column's inner lane, Front Desk replies on the outer lane — a real
  // conversation thread floating in space.
  const items = useMemo(
    () =>
      Array.from({ length: cards }, (_, i) => {
        const msg = THREAD[i % THREAD.length];
        const { texture, aspect } = makeBubbleTexture(msg.text, msg.out);
        return {
          texture,
          aspect,
          x: msg.out ? 2.2 + rand(i, 1) * 0.7 : 0.9 + rand(i, 1) * 0.5,
          y: -0.5 + rand(i, 2) * 1.5,
          // constant-length corridor (z −2…−30) whatever the card count, so
          // the camera's flight always reaches the end of the thread
          z: -2 - (i * 28) / cards,
          bob: 0.5 + rand(i, 3),
        };
      }),
    [cards]
  );

  useEffect(() => () => items.forEach((it) => it.texture.dispose()), [items]);

  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    // Scene envelope: nothing at the hero, fade in as "It answers" opens,
    // fully gone before the calendar chapter starts. One tableau at a time.
    const env =
      smooth01((shift.story - 0.015) / 0.05) *
      (1 - smooth01((shift.story - CHAPTERS.book.start) / 0.08));
    g.visible = env > 0.02;
    if (!g.visible) return;
    const t = clock.elapsedTime;
    g.children.forEach((child, i) => {
      const it = items[i];
      child.position.y = it.y + Math.sin(t * it.bob + i) * 0.08;
      // Proximity activation: each bubble wakes as the camera reaches it —
      // scales up and brightens just ahead of the flight path, dims behind.
      const dz = it.z - camera.position.z;
      const prox = Math.exp(-((dz + 2.2) * (dz + 2.2)) / 3.5);
      child.scale.setScalar(1 + prox * 0.18);
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = (0.5 + prox * 0.5) * env;
    });
  });

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y, it.z]} rotation={[0, -0.24, 0]}>
          <planeGeometry args={[CARD_H * it.aspect, CARD_H]} />
          <meshBasicMaterial map={it.texture} transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  );
}
