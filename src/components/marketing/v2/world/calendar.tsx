// src/components/marketing/v2/world/calendar.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";
import { makeRadialTexture, makeSlotTexture } from "./textures";

const COLS = 6;
const ROWS = 4;
const CELL_W = 0.38;
const CELL_H = 0.28;
const GAP = 0.07;
// Grid sits clearly right-of-center so the chapter copy on the left is
// never covered (the camera's look-target stays left of this anchor).
const CENTER = new THREE.Vector3(3.1, 0.3, -38);
const STAR = 21; // 7:30 PM — the slot that gets booked (and keeps its time)

/** Every cell is a distinct half-hour slot: 9:00 → 8:30, left to right. */
function slotLabel(i: number): string {
  const mins = 9 * 60 + i * 30;
  const h = Math.floor(mins / 60) % 12 || 12;
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** A day of real half-hour appointments — white cards that arc into a grid;
 *  the 7:30 slot flips green with a check and an expanding ring. */
export function CalendarScene() {
  const group = useRef<THREE.Group>(null);
  const booked = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Sprite>(null);
  const ringTexture = useMemo(() => makeRadialTexture(), []);

  const cells = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        return {
          texture: makeSlotTexture(slotLabel(i)),
          grid: new THREE.Vector3(
            CENTER.x + (col - (COLS - 1) / 2) * (CELL_W + GAP),
            CENTER.y + ((ROWS - 1) / 2 - row) * (CELL_H + GAP),
            CENTER.z
          ),
          // Scatter stays strictly right of the copy column — both endpoints
          // of the flight are right of the text, so the whole path is too.
          scatter: new THREE.Vector3(
            CENTER.x + (rand(i, 4) + 0.08) * 3.9,
            CENTER.y + (rand(i, 5) - 0.5) * 4.4,
            CENTER.z - 0.3 - rand(i, 6) * 0.5
          ),
          delay: rand(i, 7) * 0.25,
        };
      }),
    []
  );
  const bookedTexture = useMemo(() => makeSlotTexture(slotLabel(STAR), true), []);

  useEffect(
    () => () => {
      cells.forEach((c) => c.texture.dispose());
      bookedTexture.dispose();
    },
    [cells, bookedTexture]
  );

  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    // Scene envelope: assembles through "It books", exits fast the moment
    // "It chases" begins — the lock moment happens center-stage.
    const exit = 1 - smooth01((shift.story - CHAPTERS.chase.start) / 0.05);
    g.visible = shift.story > CHAPTERS.book.start - 0.02 && exit > 0.02;
    if (!g.visible) return;
    const b = localProgress(shift.story, "book");
    const t = clock.elapsedTime;
    const lock = smooth01(clamp01((b - 0.72) / 0.18));

    // Portrait screens can't fit copy-left + grid-right side by side: slide
    // the whole tableau down, left and deeper so it reads below the copy.
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1.6;
    const squeeze = smooth01((1.05 - aspect) / 0.5);
    g.position.set(-1.45 * squeeze, -1.05 * squeeze, -1.7 * squeeze);

    g.children.forEach((child, i) => {
      if (i >= cells.length) return; // booked overlay + ring come after
      const c = cells[i];
      const e = smooth01(clamp01((b - c.delay) / 0.6));
      child.position.lerpVectors(c.scatter, c.grid, e);
      // Assemble on one flat plane; only a tiny idle breath remains.
      child.position.y += Math.sin(t * 1.2 + i) * 0.012 * e;
      const pop = i === STAR ? 1 + lock * 0.35 : 1;
      child.scale.setScalar(Math.max(e * pop * exit, 0.0001));
      child.rotation.set(0, 0, 0);
    });

    // The booked card: the green 7:30 crossfades over the white 7:30.
    if (booked.current) {
      const cell = g.children[STAR];
      booked.current.position.copy(cell.position);
      booked.current.position.z += 0.01;
      booked.current.scale.copy(cell.scale);
      booked.current.rotation.copy(cell.rotation);
      (booked.current.material as THREE.MeshBasicMaterial).opacity = lock * exit;
    }
    // Confirmation ring: an expanding pulse radiating from the booked slot.
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
      {cells.map((c, i) => (
        <mesh key={i}>
          <planeGeometry args={[CELL_W, CELL_H]} />
          <meshBasicMaterial map={c.texture} transparent />
        </mesh>
      ))}
      <mesh ref={booked}>
        <planeGeometry args={[CELL_W, CELL_H]} />
        <meshBasicMaterial map={bookedTexture} transparent opacity={0} />
      </mesh>
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
