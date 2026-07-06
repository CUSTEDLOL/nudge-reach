// src/components/marketing/v2/world/camera-rig.tsx
"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { shift } from "../progress";
import { cameraAt } from "./path";

/** Drives the camera along the keyframed path, spring-damped, with a
 *  gentle pointer parallax on top. */
export function CameraRig() {
  const target = useMemo(
    () => ({ pos: new THREE.Vector3(0, 0.4, 7), look: new THREE.Vector3() }),
    []
  );

  useFrame(({ camera, pointer }) => {
    const k = cameraAt(shift.story);
    target.pos.set(k.pos[0] + pointer.x * 0.3, k.pos[1] + pointer.y * 0.15, k.pos[2]);
    camera.position.lerp(target.pos, 0.08);
    target.look.set(k.look[0], k.look[1], k.look[2]);
    camera.lookAt(target.look);
  });

  return null;
}
