// src/components/marketing/v2/world/message-stream.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { smooth01 } from "./path";
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

const CARD_H = 0.44;
const VISIBLE_MESSAGES = 6;

/** A straight-on conversation that writes itself one message at a time. */
export function MessageStream({ cards }: { cards: number }) {
  const group = useRef<THREE.Group>(null);

  const items = useMemo(
    () =>
      Array.from({ length: Math.min(cards, VISIBLE_MESSAGES) }, (_, i) => {
        const msg = THREAD[i % THREAD.length];
        const { texture, aspect } = makeBubbleTexture(msg.text, msg.out);
        return {
          texture,
          aspect,
          x: msg.out ? 2.55 : 0.7,
          y: 1.35 - i * 0.56,
          z: -6,
          enterAt: 0.04 + i * 0.115,
        };
      }),
    [cards]
  );

  useEffect(() => () => items.forEach((it) => it.texture.dispose()), [items]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const env =
      smooth01((shift.story - 0.015) / 0.05) *
      (1 - smooth01((shift.story - CHAPTERS.book.start) / 0.08));
    g.visible = env > 0.02;
    if (!g.visible) return;
    const answer = localProgress(shift.story, "answer");
    g.children.forEach((child, i) => {
      const it = items[i];
      const enter = smooth01(clamp01((answer - it.enterAt) / 0.09));
      child.position.set(it.x, it.y - (1 - enter) * 0.28, it.z);
      child.scale.setScalar(Math.max(0.92 + enter * 0.08, 0.0001));
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = enter * env;
    });
  });

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y, it.z]}>
          <planeGeometry args={[CARD_H * it.aspect, CARD_H]} />
          <meshBasicMaterial map={it.texture} transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  );
}
