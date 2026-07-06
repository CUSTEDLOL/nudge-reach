// src/components/marketing/v2/world/calendar.tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";
import { makeRadialTexture } from "./textures";

const COLS = 7;
const ROWS = 5;
const CELL = 0.3;
const GAP = 0.075;
const CENTER = new THREE.Vector3(2.4, 0.3, 0); // camera looks here at 0.42
const STAR = 17; // the slot that gets booked

/** Scattered cells arc into a month grid; the booked slot locks in with an
 *  emissive pulse and an expanding confirmation ring. */
export function CalendarScene() {
  const group = useRef<THREE.Group>(null);
  const star = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.Sprite>(null);
  const ringTexture = useMemo(() => makeRadialTexture(), []);

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
    // Scene envelope: assembles through "It books", scales out cleanly as
    // "It chases" begins — never shares the stage with the orbit.
    const exit = 1 - smooth01((shift.story - CHAPTERS.chase.start) / 0.08);
    g.visible = shift.story > CHAPTERS.book.start - 0.02 && exit > 0.02;
    if (!g.visible) return;
    const b = localProgress(shift.story, "book");
    const t = clock.elapsedTime;
    const lock = smooth01(clamp01((b - 0.75) / 0.2));

    g.children.forEach((child, i) => {
      if (i >= cells.length) return; // the confirmation ring sprite
      const c = cells[i];
      const e = smooth01(clamp01((b - c.delay) / 0.6));
      child.position.lerpVectors(c.scatter, c.grid, e);
      // Arc toward the camera mid-flight, breathe gently once settled.
      child.position.z += Math.sin(e * Math.PI) * 0.5;
      child.position.y += Math.sin(t * 1.2 + i) * 0.012 * e;
      const pop = i === STAR ? 1 + lock * 0.45 : 1;
      child.scale.setScalar(Math.max(e * pop * exit, 0.0001));
      child.rotation.z = (1 - e) * c.tilt;
    });

    if (star.current) {
      star.current.emissiveIntensity =
        0.22 + lock * (1.4 + Math.sin(t * 4) * 0.3);
    }
    // Confirmation ring: an expanding pulse that radiates from the booked
    // slot for as long as it is locked in.
    if (ring.current) {
      const pulse = (t * 0.9) % 1;
      const m = ring.current.material as THREE.SpriteMaterial;
      m.opacity = lock * (1 - pulse) * 0.55 * exit;
      const s = 0.5 + pulse * 2.1;
      ring.current.scale.set(s, s, 1);
      ring.current.position.copy(cells[STAR].grid);
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
              color="#1d4938"
              emissive="#06c167"
              emissiveIntensity={0.22}
            />
          ) : (
            <meshStandardMaterial color="#1d4938" emissive="#06c167" emissiveIntensity={0.22} />
          )}
        </mesh>
      ))}
      <sprite ref={ring} scale={[0.5, 0.5, 1]}>
        <spriteMaterial
          map={ringTexture}
          color="#06c167"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}
