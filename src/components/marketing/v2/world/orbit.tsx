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

const CENTER = new THREE.Vector3(-2.6, 0.15, -46); // camera looks here at 0.64
const CHIP_H = 0.34;

/**
 * The chase, literally: quiet leads pop into the night at scattered spots,
 * dim and cold. Then, one by one, a thread of light reaches out from the
 * engine and each lead is CAUGHT — it brightens, gains a "follow-up sent ✓"
 * line, and settles. Everything is a pure function of scroll progress
 * (no spinning, no clock-driven orbits) so it reads at any scrub speed.
 */
export function OrbitScene({ fx }: { fx: boolean }) {
  const group = useRef<THREE.Group>(null);
  const caughtGroup = useRef<THREE.Group>(null);
  const threadGroup = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Sprite>(null);
  const glowTexture = useMemo(() => makeRadialTexture(), []);

  const chips = useMemo(() => {
    // Deterministic catch order: a shuffled permutation of the chips.
    const order = LEADS.map((_, i) => i).sort(
      (a, b) => rand(a, 35) - rand(b, 35)
    );
    const rankOf = new Map(order.map((chip, rank) => [chip, rank]));
    return LEADS.map((text, i) => {
      const dim = makeBubbleTexture(text, "dim", undefined, 2);
      const caught = makeBubbleTexture(text, "caught", "↳ follow-up sent ✓", 2);
      // Jittered 4×2 slot grid: generous, deterministic spacing so chips
      // never pile on top of each other (checkerboard y-offset for air).
      const col = i % 4;
      const row = Math.floor(i / 4);
      return {
        dimTexture: dim.texture,
        caughtTexture: caught.texture,
        aspect: dim.aspect,
        caughtAspect: caught.aspect,
        pos: new THREE.Vector3(
          CENTER.x + 0.15 + col * 1.24 + (rand(i, 31) - 0.5) * 0.3,
          CENTER.y +
            (row === 0 ? 1.05 : -1.05) +
            (col % 2 ? 0.42 : -0.18) +
            (rand(i, 32) - 0.5) * 0.24,
          CENTER.z + (rand(i, 33) - 0.5) * 0.5
        ),
        // Quiet leads appear at semi-random moments…
        enterAt: 0.03 + rand(i, 34) * 0.19,
        // …then get pursued one by one — all caught before the camera
        // begins its dawn flight through this part of the sky.
        catchAt: 0.3 + (rankOf.get(i) ?? 0) * 0.04,
      };
    });
  }, []);

  // Pursuit threads (imperative THREE.Line — <line> clashes with SVG JSX).
  const threads = useMemo(
    () =>
      LEADS.map(() => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(6), 3)
        );
        const mat = new THREE.LineBasicMaterial({
          color: "#059957",
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        return new THREE.Line(geo, mat);
      }),
    []
  );

  useEffect(
    () => () => {
      chips.forEach((c) => {
        c.dimTexture.dispose();
        c.caughtTexture.dispose();
      });
      threads.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });
    },
    [chips, threads]
  );

  useFrame(({ clock, camera }) => {
    const g = group.current;
    const cg = caughtGroup.current;
    const tg = threadGroup.current;
    if (!g || !cg || !tg) return;
    // Scene envelope: enters with "It chases"; fades BEFORE the camera's
    // dawn flight reaches the chip field (story ~0.75), so no giant
    // close-up bubbles ever sweep across the next chapter's copy.
    const exit = 1 - smooth01((shift.story - 0.695) / 0.055);
    const on = shift.story > CHAPTERS.book.end - 0.03 && exit > 0.02;
    g.visible = on;
    cg.visible = on;
    tg.visible = on;
    if (!on) return;
    const c = localProgress(shift.story, "chase");
    const t = clock.elapsedTime;

    // Portrait screens: pull the cloud toward the look axis and deeper.
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1.6;
    const squeeze = smooth01((1.05 - aspect) / 0.5);
    g.position.set(-0.7 * squeeze, -0.55 * squeeze, -1.5 * squeeze);
    cg.position.copy(g.position);
    tg.position.copy(g.position);

    g.children.forEach((child, i) => {
      const chip = chips[i];
      if (!chip) return;
      const enter = smooth01(clamp01((c - chip.enterAt) / 0.1));
      const caught = smooth01(clamp01((c - chip.catchAt) / 0.07));
      // Subtle entrance: fade + slight rise. Then a gentle pop when caught.
      const floatY = Math.sin(t * 0.5 + i * 2.1) * 0.02;
      const y = chip.pos.y - (1 - enter) * 0.35 + floatY;
      child.position.set(chip.pos.x, y, chip.pos.z);
      child.lookAt(camera.position);
      const popScale = 1 + Math.sin(caught * Math.PI) * 0.09;
      child.scale.setScalar(Math.max(enter * popScale, 0.0001));
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      // Dim while quiet; the caught overlay carries the lit state.
      m.opacity = enter * (0.85 - caught * 0.85) * exit;

      // Caught overlay: same spot, brighter texture, crossfades in.
      const over = cg.children[i] as THREE.Mesh | undefined;
      if (over) {
        over.position.copy(child.position);
        over.position.z += 0.012;
        over.quaternion.copy(child.quaternion);
        over.scale.copy(child.scale).multiplyScalar(1.04);
        (over.material as THREE.MeshBasicMaterial).opacity = caught * exit;
      }

      // The pursuit thread: draws from the engine toward the lead just
      // before the catch, then dissolves once it has landed.
      const line = tg.children[i] as THREE.Line | undefined;
      if (line) {
        const draw = smooth01(clamp01((c - (chip.catchAt - 0.06)) / 0.06));
        const fadeOut = smooth01(clamp01((c - chip.catchAt - 0.08) / 0.12));
        const geo = line.geometry as THREE.BufferGeometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        const ex = CENTER.x + (child.position.x - CENTER.x) * draw;
        const ey = CENTER.y + (child.position.y - CENTER.y) * draw;
        const ez = CENTER.z + (child.position.z - CENTER.z) * draw;
        posAttr.setXYZ(0, CENTER.x, CENTER.y, CENTER.z);
        posAttr.setXYZ(1, ex, ey, ez);
        posAttr.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).opacity =
          draw * (1 - fadeOut) * 0.65 * exit;
      }
    });

    if (glow.current) {
      // The engine's heartbeat — quickens while the chase is landing.
      const chasing = smooth01(clamp01((c - 0.35) / 0.5));
      (glow.current.material as THREE.SpriteMaterial).opacity =
        (fx
          ? 0.12 + chasing * 0.1 + Math.sin(t * 2.4) * 0.03 * chasing
          : 0.12) * exit;
    }
  });

  return (
    <>
      <group ref={group} visible={false}>
        {chips.map((chip, i) => (
          <mesh key={i}>
            <planeGeometry args={[CHIP_H * chip.aspect, CHIP_H]} />
            <meshBasicMaterial map={chip.dimTexture} transparent opacity={0} />
          </mesh>
        ))}
      </group>
      <group ref={caughtGroup} visible={false}>
        {chips.map((chip, i) => (
          <mesh key={i}>
            <planeGeometry
              args={[
                CHIP_H * chip.aspect,
                (CHIP_H * chip.aspect) / chip.caughtAspect,
              ]}
            />
            <meshBasicMaterial
              map={chip.caughtTexture}
              transparent
              opacity={0}
            />
          </mesh>
        ))}
      </group>
      <group ref={threadGroup} visible={false}>
        {threads.map((l, i) => (
          <primitive key={i} object={l} />
        ))}
      </group>
      <sprite
        ref={glow}
        position={[CENTER.x, CENTER.y, CENTER.z]}
        scale={[2.6, 2.6, 1]}
      >
        <spriteMaterial
          map={glowTexture}
          color="#06c167"
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </sprite>
    </>
  );
}
