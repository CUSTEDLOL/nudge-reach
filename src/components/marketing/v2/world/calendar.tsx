// src/components/marketing/v2/world/calendar.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";
import { makeRadialTexture, makeSlotTexture } from "./textures";

const COLS = 7;
const ROWS = 5;
const CELL_W = 0.38;
const CELL_H = 0.28;
const GAP = 0.07;
const CENTER = new THREE.Vector3(2.4, 0.3, -38); // camera holds here 0.40–0.54
const STAR = 17; // the slot that gets booked
const TIMES = ["9:00", "10:30", "12:00", "3:30", "5:00"]; // one per row

/** A week of real appointment slots — white cards that arc into a grid;
 *  the booked one flips green with a check and an expanding ring. */
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
          texture: makeSlotTexture(TIMES[row]),
          grid: new THREE.Vector3(
            CENTER.x + (col - (COLS - 1) / 2) * (CELL_W + GAP),
            CENTER.y + ((ROWS - 1) / 2 - row) * (CELL_H + GAP),
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
  const bookedTexture = useMemo(() => makeSlotTexture("7:30", true), []);

  useEffect(
    () => () => {
      cells.forEach((c) => c.texture.dispose());
      bookedTexture.dispose();
    },
    [cells, bookedTexture]
  );

  useFrame(({ clock }) => {
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

    g.children.forEach((child, i) => {
      if (i >= cells.length) return; // booked overlay + ring come after
      const c = cells[i];
      const e = smooth01(clamp01((b - c.delay) / 0.6));
      child.position.lerpVectors(c.scatter, c.grid, e);
      // Arc toward the camera mid-flight, breathe gently once settled.
      child.position.z += Math.sin(e * Math.PI) * 0.5;
      child.position.y += Math.sin(t * 1.2 + i) * 0.012 * e;
      const pop = i === STAR ? 1 + lock * 0.35 : 1;
      child.scale.setScalar(Math.max(e * pop * exit, 0.0001));
      child.rotation.z = (1 - e) * c.tilt;
    });

    // The booked card: the green version crossfades over the white slot and
    // pops with it.
    if (booked.current) {
      const cell = g.children[STAR];
      booked.current.position.copy(cell.position);
      booked.current.position.z += 0.01;
      booked.current.scale.copy(cell.scale);
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
