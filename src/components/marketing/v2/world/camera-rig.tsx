// src/components/marketing/v2/world/camera-rig.tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { localProgress, shift } from "../progress";
import { cameraAt } from "./path";

/**
 * Drives the camera along the keyframed path, spring-damped, with pointer
 * parallax and a subtle banking roll while flying the message corridor —
 * the difference between a slideshow and a flight.
 */
export function CameraRig() {
  const state = useRef({
    pos: new THREE.Vector3(0, 0.4, 7),
    look: new THREE.Vector3(),
    lookNow: new THREE.Vector3(0, 0, 0),
    roll: 0,
  }).current;

  useFrame(({ camera, pointer }) => {
    const k = cameraAt(shift.story);
    state.pos.set(k.pos[0] + pointer.x * 0.3, k.pos[1] + pointer.y * 0.15, k.pos[2]);
    camera.position.lerp(state.pos, 0.08);

    // Damp the look target too, so chapter handovers glide instead of snap.
    state.look.set(k.look[0], k.look[1], k.look[2]);
    state.lookNow.lerp(state.look, 0.09);
    camera.lookAt(state.lookNow);

    // Banking: lean into the corridor flight, lean with the pointer.
    const corridor = localProgress(shift.story, "answer");
    const bank = Math.sin(corridor * Math.PI) * 0.06 - pointer.x * 0.025;
    state.roll += (bank - state.roll) * 0.06;
    camera.rotation.z += state.roll;
  });

  return null;
}
