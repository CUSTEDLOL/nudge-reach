// src/components/marketing/v2/world/camera-rig.tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { shift } from "../progress";
import { cameraAt } from "./path";

/**
 * Moves between four stable chapter framings. Each scene is held straight-on;
 * only the hand-off between chapters moves the camera.
 */
export function CameraRig() {
  const state = useRef({
    pos: new THREE.Vector3(0, 0.4, 7),
    look: new THREE.Vector3(),
    lookNow: new THREE.Vector3(0, 0, 0),
  }).current;

  useFrame(({ camera, pointer }) => {
    const k = cameraAt(shift.story);
    state.pos.set(k.pos[0] + pointer.x * 0.3, k.pos[1] + pointer.y * 0.15, k.pos[2]);
    camera.position.lerp(state.pos, 0.06);

    // Damp the look target too, so chapter handovers glide instead of snap.
    state.look.set(k.look[0], k.look[1], k.look[2]);
    state.lookNow.lerp(state.look, 0.075);
    camera.lookAt(state.lookNow);
  });

  return null;
}
