import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { placeStage } from "@/components/marketing/v2/world/stage";

/** The fixed BOOK chapter camera, at an arbitrary aspect. */
function makeCamera(aspect: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(55, aspect, 0.1, 200);
  cam.position.set(0, 0.5, -32.8);
  cam.lookAt(1.0, 0.25, -38);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

const ANCHOR = new THREE.Vector3(3.04, 0.3, -38);

/** Screen-space (NDC) position of a world point under the group transform. */
function projectUnder(
  group: THREE.Group,
  point: THREE.Vector3,
  cam: THREE.Camera
): THREE.Vector3 {
  return point
    .clone()
    .multiplyScalar(group.scale.x)
    .add(group.position)
    .project(cam);
}

describe("placeStage (showcase-box framing)", () => {
  it("puts the anchor at the desktop box centre at EVERY aspect ratio", () => {
    for (const [w, aspect] of [
      [1440, 1.6],
      [1920, 1.78],
      [3440, 2.39],
      [1024, 1.33],
    ] as const) {
      const cam = makeCamera(aspect);
      const g = new THREE.Group();
      placeStage(cam, w, ANCHOR, 1.85, 0.95, g);
      const ndc = projectUnder(g, ANCHOR, cam);
      expect(ndc.x).toBeCloseTo(0.44, 4);
      expect(ndc.y).toBeCloseTo(0, 4);
    }
  });

  it("puts the anchor at the phone box centre below 1024px", () => {
    const cam = makeCamera(390 / 844);
    const g = new THREE.Group();
    placeStage(cam, 390, ANCHOR, 1.85, 0.95, g);
    const ndc = projectUnder(g, ANCHOR, cam);
    expect(ndc.x).toBeCloseTo(0, 4);
    expect(ndc.y).toBeCloseTo(-0.42, 4);
  });

  it("keeps the composition's edges inside the box on every viewport", () => {
    const halfW = 1.85;
    const halfH = 0.95;
    for (const [w, aspect, boxX, boxHw] of [
      [1440, 1.6, 0.44, 0.48],
      [2560, 2.37, 0.44, 0.48],
      [390, 390 / 844, 0, (390 - 40) / 390],
    ] as const) {
      const cam = makeCamera(aspect);
      const g = new THREE.Group();
      placeStage(cam, w, ANCHOR, halfW, halfH, g);
      const right = projectUnder(
        g,
        ANCHOR.clone().add(new THREE.Vector3(halfW, 0, 0)),
        cam
      );
      const left = projectUnder(
        g,
        ANCHOR.clone().add(new THREE.Vector3(-halfW, 0, 0)),
        cam
      );
      expect(right.x).toBeLessThanOrEqual(boxX + boxHw + 1e-4);
      expect(left.x).toBeGreaterThanOrEqual(boxX - boxHw - 1e-4);
      // and it genuinely uses the box — at least 55% of the half-width
      // (ultrawide screens hit the deliberate maxScale readability cap)
      expect(right.x - boxX).toBeGreaterThan(0.55 * boxHw);
    }
  });

  it("moving to the box centre does not change apparent size (same depth)", () => {
    const cam = makeCamera(1.78);
    const g = new THREE.Group();
    placeStage(cam, 1920, ANCHOR, 1.85, 0.95, g, 1);
    const before = ANCHOR.clone().applyMatrix4(cam.matrixWorldInverse).z;
    const after = ANCHOR.clone()
      .multiplyScalar(g.scale.x)
      .add(g.position)
      .applyMatrix4(cam.matrixWorldInverse).z;
    expect(after).toBeCloseTo(before, 4);
  });
});
