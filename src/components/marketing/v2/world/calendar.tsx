// src/components/marketing/v2/world/calendar.tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";

const COLS = 7;
const ROWS = 5;
const CELL = 0.3;
const GAP = 0.075;
const CENTER = new THREE.Vector3(2.4, 0.3, 0); // camera looks here at 0.42
const STAR = 17; // the slot that gets booked

/** Scattered cells assemble into a month grid; one slot locks in, glowing. */
export function CalendarScene() {
  const group = useRef<THREE.Group>(null);
  const star = useRef<THREE.MeshStandardMaterial>(null);

  const cells = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        return {
          grid: new THREE.Vector3(
            CENTER.x + (col - (COLS - 1) / 2) * (CELL + GAP),
            CENTER.y + ((ROWS - 1) / 2 - row) * (CELL + GAP),
            CENTER.z
          ),
          scatter: new THREE.Vector3(
            CENTER.x + (rand(i, 4) - 0.5) * 7,
            CENTER.y + (rand(i, 5) - 0.5) * 5,
            CENTER.z - 1.5 - rand(i, 6) * 5
          ),
          delay: rand(i, 7) * 0.25,
          tilt: (rand(i, 8) - 0.5) * 2,
        };
      }),
    []
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.visible =
      shift.story > CHAPTERS.answer.end - 0.05 && shift.story < CHAPTERS.chase.end;
    if (!g.visible) return;
    const b = localProgress(shift.story, "book");
    g.children.forEach((child, i) => {
      const c = cells[i];
      const e = smooth01(clamp01((b - c.delay) / 0.6));
      child.position.lerpVectors(c.scatter, c.grid, e);
      const pop = i === STAR ? 1 + smooth01(clamp01((b - 0.75) / 0.2)) * 0.45 : 1;
      child.scale.setScalar(Math.max(e * pop, 0.0001));
      child.rotation.z = (1 - e) * c.tilt;
    });
    if (star.current) {
      const lock = smooth01(clamp01((b - 0.75) / 0.2));
      star.current.emissiveIntensity =
        lock * (1.4 + Math.sin(clock.elapsedTime * 4) * 0.3);
    }
  });

  return (
    <group ref={group} visible={false}>
      {cells.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[CELL, CELL, 0.05]} />
          {i === STAR ? (
            <meshStandardMaterial
              ref={star}
              color="#0f3527"
              emissive="#06c167"
              emissiveIntensity={0}
            />
          ) : (
            <meshStandardMaterial color="#11241c" emissive="#06c167" emissiveIntensity={0.04} />
          )}
        </mesh>
      ))}
    </group>
  );
}
