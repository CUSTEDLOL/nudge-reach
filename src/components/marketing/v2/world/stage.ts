// src/components/marketing/v2/world/stage.ts
import * as THREE from "three";

/**
 * The pinned showcase renders the world through a bordered box that is NOT
 * screen-centred (right half on desktop, lower half on phones). Hand-tuned
 * world offsets only line up at one aspect ratio — on wider screens the
 * scenes drift toward the box's left edge. This helper solves the placement
 * exactly, per frame, from the camera's own projection:
 *
 *   1. project the scene's visual-centre anchor to NDC,
 *   2. unproject the BOX centre at that same depth,
 *   3. offset the scene group by the difference,
 *   4. uniform-scale the composition about the anchor so it fills the box.
 *
 * Box geometry mirrors the mask layout in globals.css:
 *   desktop ≥1024px — box spans 48vw→96vw × 13vh→87vh (centre NDC 0.44, 0)
 *   mobile  <1024px — box spans 20px insets × 47svh→95svh (centre NDC 0, −0.42)
 */

const FILL_DESKTOP = 0.88; // breathing room around the composition
const FILL_MOBILE = 0.94; // the phone box is small — use nearly all of it

const projected = new THREE.Vector3();
const desired = new THREE.Vector3();
const viewSpace = new THREE.Vector3();

export function placeStage(
  camera: THREE.Camera,
  viewportWidth: number,
  anchor: THREE.Vector3,
  halfWidth: number,
  halfHeight: number,
  group: THREE.Object3D,
  maxScale = 1.3
): void {
  const cam = camera as THREE.PerspectiveCamera;
  cam.updateMatrixWorld();

  const mobile = viewportWidth < 1024;
  const box = mobile
    ? {
        x: 0,
        y: -0.42,
        hw: Math.max(0.5, (viewportWidth - 40) / viewportWidth),
        hh: 0.48,
      }
    : { x: 0.44, y: 0, hw: 0.48, hh: 0.74 };

  // World-unit extents of the full view at the anchor's camera depth.
  const depth = -viewSpace.copy(anchor).applyMatrix4(cam.matrixWorldInverse).z;
  const viewHalfH = Math.tan((cam.fov * Math.PI) / 360) * depth;
  const viewHalfW = viewHalfH * cam.aspect;

  const s = Math.min(
    maxScale,
    (mobile ? FILL_MOBILE : FILL_DESKTOP) *
      Math.min(
        (box.hw * viewHalfW) / halfWidth,
        (box.hh * viewHalfH) / halfHeight
      )
  );

  // Translation that puts the anchor at the box centre, at its own depth
  // (same depth ⇒ no apparent size change from the move itself).
  projected.copy(anchor).project(cam);
  desired.set(box.x, box.y, projected.z).unproject(cam);
  group.position.copy(desired).sub(anchor);
  // Scale about the anchor, not the world origin.
  group.position.addScaledVector(anchor, 1 - s);
  group.scale.setScalar(s);
}
