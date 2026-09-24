/**
 * Places an <Html> panel at its marker, but never outside the canvas.
 *
 * Shared by both scenes on this route, which is why it lives alone: the lab's
 * screens hang off objects you fly right up to, so they hit this problem even
 * harder than the outdoor markers did.
 */

import { Vector3, type Camera, type Object3D } from 'three';

/** Roughly the panel's rendered box. Only used to keep it inside the frame. */
const PANEL_W = 336;
const PANEL_H = 300;
const PANEL_MARGIN = 12;

const projected = new Vector3();

/**
 * Places the panel at its marker, but never outside the canvas.
 *
 * drei's default projects the anchor and leaves it there, which is fine until
 * you are close to the marker - and being close is the only time the panel is
 * open. Arriving at a zone put the anchor near the top of the frame and the
 * first lines of every panel ran off the edge.
 *
 * Clamping keeps the whole panel readable, and has a pleasant side effect:
 * when the marker drifts off-screen the panel slides along that edge, pointing
 * back towards what it belongs to instead of vanishing.
 */
export function clampedPosition(
  el: Object3D,
  camera: Camera,
  size: { width: number; height: number },
): [number, number] {
  projected.setFromMatrixPosition(el.matrixWorld).project(camera);

  const halfW = size.width / 2;
  const halfH = size.height / 2;

  // Behind the camera the projection mirrors; flipping it back keeps the panel
  // on the side the marker actually is.
  const behind = projected.z > 1;
  const x = (behind ? -projected.x : projected.x) * halfW + halfW;
  const y = -((behind ? -projected.y : projected.y) * halfH) + halfH;

  const clamp = (value: number, max: number) =>
    Math.max(PANEL_MARGIN, Math.min(max, value));

  return [
    clamp(x - PANEL_W / 2, size.width - PANEL_W - PANEL_MARGIN),
    clamp(y - PANEL_H - PANEL_MARGIN, size.height - PANEL_H - PANEL_MARGIN),
  ];
}
