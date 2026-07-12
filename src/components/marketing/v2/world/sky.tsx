// src/components/marketing/v2/world/sky.tsx
"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The world's backdrop is plain white — the showcase box must read as part
 * of the page, not a tinted scene. Scenes use unlit materials, so no lights
 * are needed; depth comes from the compositions themselves.
 */
export function Sky() {
  const { scene } = useThree();
  useMemo(() => {
    // eslint-disable-next-line react-hooks/immutability
    scene.background = new THREE.Color("#ffffff");
    // eslint-disable-next-line react-hooks/immutability
    scene.fog = null;
  }, [scene]);
  return null;
}
