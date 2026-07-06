// src/components/marketing/v2/world/world.tsx
"use client";

import { useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { QUALITY, shouldStepDown, stepDown, type Quality } from "./quality";
import { Sky } from "./sky";
import { Particles } from "./particles";
import { CameraRig } from "./camera-rig";

/** Watches real frame times and sheds quality when they stay slow. */
function Governor({ onDegrade }: { onDegrade: () => void }) {
  const acc = { ms: 0, n: 0, cool: 0 };
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, delta) => {
    if (acc.cool > 0) {
      acc.cool -= delta;
      return;
    }
    acc.ms += delta * 1000;
    acc.n += 1;
    if (acc.n >= 90) {
      if (shouldStepDown(acc.ms / acc.n)) {
        onDegrade();
        acc.cool = 4; // let the new tier settle before judging again
      }
      acc.ms = 0;
      acc.n = 0;
    }
  });
  return null;
}

/**
 * The one persistent WebGL world behind the whole page. Opaque background
 * (the Sky owns it); DOM content scrolls above at z-10.
 */
export default function World({ quality: initial }: { quality: Quality }) {
  const [quality, setQuality] = useState(initial);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const fn = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, []);

  return (
    <Canvas
      frameloop={hidden ? "never" : "always"}
      dpr={[1, quality.dprMax]}
      camera={{ position: [0, 0.4, 7], fov: 55 }}
      gl={{
        antialias: quality.tier === "high",
        alpha: false,
        powerPreference: "high-performance",
      }}
    >
      <Sky />
      <CameraRig />
      <Particles count={quality.particles} />
      {quality.tier !== "low" && (
        <Governor onDegrade={() => setQuality((q) => QUALITY[stepDown(q.tier)])} />
      )}
    </Canvas>
  );
}
