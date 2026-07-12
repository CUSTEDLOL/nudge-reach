// src/components/marketing/v2/world/camera-rig.tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { localProgress, shift } from "../progress";
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
    chapter: -1,
    roll: 0,
  }).current;

  useFrame(({ camera, pointer }) => {
    const k = cameraAt(shift.story);
    const chapter = shift.story < 0.28 ? 0 : shift.story < 0.55 ? 1 : shift.story < 0.8 ? 2 : 3;
    const answer = chapter === 0;
    state.pos.set(
      k.pos[0] + (answer ? pointer.x * 0.3 : 0),
      k.pos[1] + (answer ? pointer.y * 0.15 : 0),
      k.pos[2]
    );

    state.look.set(k.look[0], k.look[1], k.look[2]);
    if (chapter !== state.chapter || !answer) {
      camera.position.copy(state.pos);
      state.lookNow.copy(state.look);
      if (!answer) state.roll = 0;
      state.chapter = chapter;
    } else {
      camera.position.lerp(state.pos, 0.06);
      state.lookNow.lerp(state.look, 0.075);
    }
    camera.lookAt(state.lookNow);

    // Preserve the original gentle bank only for the Answers fly-through.
    const corridor = localProgress(shift.story, "answer");
    const bank = answer
      ? Math.sin(corridor * Math.PI) * 0.06 - pointer.x * 0.025
      : 0;
    state.roll += (bank - state.roll) * 0.08;
    camera.rotation.z += state.roll;
  });

  return null;
}
