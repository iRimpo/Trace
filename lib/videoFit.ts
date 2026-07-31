/**
 * Where a video's pixels actually land inside its box.
 *
 * A canvas overlaid on a `<video>` only lines up if it maps video space to
 * canvas space the same way CSS does. `object-cover` scales by `max` and crops
 * the overflow; `object-contain` scales by `min` and letterboxes. Both centre.
 *
 * The calibration overlays used a plain stretch — `x / vW * cW` — which is
 * neither. It agreed with the video only because every pane was `aspect-video`
 * and most cameras are 16:9, so the error was zero in the one case anybody
 * looked at. The moment a pane went full-bleed in portrait (a ~0.55 aspect box
 * showing a 1.78 aspect camera) the skeleton would have drifted off the body
 * entirely — on the exact device and the exact step where landing the skeleton
 * on your body *is* the task.
 *
 * This lives in `lib/` rather than beside its caller because it is geometry,
 * it is silently wrong rather than loudly wrong when it drifts, and three
 * separate canvases now depend on it agreeing with CSS.
 */

export type FitMode = "cover" | "contain";

export interface VideoFit {
  /** Displayed width of the video inside the box, in box pixels. */
  dw: number;
  /** Displayed height of the video inside the box, in box pixels. */
  dh: number;
  /** Left offset of the displayed video. Negative when `cover` crops. */
  ox: number;
  /** Top offset of the displayed video. Negative when `cover` crops. */
  oy: number;
}

/**
 * @param cW,cH  the box (canvas) size
 * @param vW,vH  the video's intrinsic size
 */
export function videoFit(
  cW: number,
  cH: number,
  vW: number,
  vH: number,
  mode: FitMode,
): VideoFit {
  // A zero intrinsic size means metadata has not loaded yet. Returning the box
  // itself keeps the caller drawing something sane rather than dividing by zero
  // and painting NaN, which silently clears the overlay.
  if (!vW || !vH || !cW || !cH) return { dw: cW, dh: cH, ox: 0, oy: 0 };

  const scaleX = cW / vW;
  const scaleY = cH / vH;
  const scale = mode === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const dw = vW * scale;
  const dh = vH * scale;
  return { dw, dh, ox: (cW - dw) / 2, oy: (cH - dh) / 2 };
}

/**
 * Map a normalised point in video space (0–1) to box pixels.
 * `mirrored` for a webcam drawn with `transform: scaleX(-1)`.
 */
export function fitPoint(
  fit: VideoFit,
  nx: number,
  ny: number,
  mirrored = false,
): { x: number; y: number } {
  return {
    x: fit.ox + (mirrored ? 1 - nx : nx) * fit.dw,
    y: fit.oy + ny * fit.dh,
  };
}
