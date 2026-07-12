// src/components/marketing/v2/world/orbit.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTERS, clamp01, localProgress, shift } from "../progress";
import { rand, smooth01 } from "./path";
import { makeBubbleTexture, makeRadialTexture } from "./textures";
import { placeStage } from "./stage";

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

const CENTER = new THREE.Vector3(-1.2, 0.1, -46); // the engine dot
// Visual centre of the whole composition (dot left, card columns right) and
// its half-extents — placeStage centres THIS in the box and sizes to fit.
const STAGE = new THREE.Vector3(CENTER.x + 2.2, CENTER.y + 0.05, CENTER.z);
const STAGE_HALF_W = 2.9;
const STAGE_HALF_H = 2.0;
const CHIP_H = 0.42;

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
  const hub = useRef<THREE.Group>(null);
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
      const col = i % 2;
      const row = Math.floor(i / 2);
      return {
        dimTexture: dim.texture,
        caughtTexture: caught.texture,
        aspect: dim.aspect,
        caughtAspect: caught.aspect,
        pos: new THREE.Vector3(
          CENTER.x + 1.0 + col * 2.35,
          CENTER.y + 1.65 - row * 1.08,
          CENTER.z + (rand(i, 33) - 0.5) * 0.18
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

  useFrame(({ clock, camera, size }) => {
    const g = group.current;
    const cg = caughtGroup.current;
    const tg = threadGroup.current;
    if (!g || !cg || !tg) return;
    // Scene envelope: the camera CUTS between fixed chapter frames now, so
    // the scene holds at full strength while its copy is active and fades
    // only in the final beats before the Collects cut.
    const exit =
      1 - smooth01((shift.story - (CHAPTERS.chase.end - 0.035)) / 0.03);
    const on = shift.story > CHAPTERS.book.end - 0.03 && exit > 0.02;
    g.visible = on;
    cg.visible = on;
    tg.visible = on;
    if (!on) return;
    const c = localProgress(shift.story, "chase");
    const t = clock.elapsedTime;

    // Centre the composition in the showcase box on every viewport; the
    // sibling groups must carry the identical transform.
    placeStage(camera, size.width, STAGE, STAGE_HALF_W, STAGE_HALF_H, g, 1.25);
    cg.position.copy(g.position);
    cg.scale.copy(g.scale);
    tg.position.copy(g.position);
    tg.scale.copy(g.scale);
    if (hub.current) {
      hub.current.position.copy(g.position);
      hub.current.scale.copy(g.scale);
    }

    g.children.forEach((child, i) => {
      const chip = chips[i];
      if (!chip) return;
      const enter = smooth01(clamp01((c - chip.enterAt) / 0.1));
      const caught = smooth01(clamp01((c - chip.catchAt) / 0.07));
      // Quiet entrance, then a direct colour change when the follow-up lands.
      const y = chip.pos.y - (1 - enter) * 0.2;
      child.position.set(chip.pos.x, y, chip.pos.z);
      child.quaternion.copy(camera.quaternion);
      child.scale.setScalar(Math.max(enter, 0.0001));
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      // Dim while quiet; the caught overlay carries the lit state.
      m.opacity = enter * (1 - caught) * exit;

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
          ? 0.34 + chasing * 0.12 + Math.sin(t * 2.4) * 0.04 * chasing
          : 0.34) * exit;
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
      <group ref={hub}>
        <sprite
          ref={glow}
          position={[CENTER.x, CENTER.y, CENTER.z]}
          scale={[1.4, 1.4, 1]}
        >
          <spriteMaterial
            map={glowTexture}
            color="#06c167"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </sprite>
        <sprite
          position={[CENTER.x, CENTER.y, CENTER.z + 0.02]}
          scale={[0.3, 0.3, 1]}
        >
          <spriteMaterial
            map={glowTexture}
            color="#06c167"
            transparent
            opacity={1}
            depthWrite={false}
          />
        </sprite>
      </group>
    </>
  );
}
