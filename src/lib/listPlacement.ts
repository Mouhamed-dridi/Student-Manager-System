// Where to pin a portalled dropdown list relative to its anchor.
//
// Split out of PeopleMultiSelect so the arithmetic can be exercised on its own:
// it is the part that decides whether a list opens downwards (cut off by the
// viewport) or flips upwards, and getting it wrong is invisible until a user
// scrolls to the bottom of a long form.

/** Matches the list's max-h-56; also the flip threshold. */
export const LIST_MAX_HEIGHT = 224;

/** Minimum gap kept between the list and the viewport edges. */
export const VIEWPORT_MARGIN = 8;

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

/**
 * Returns the `position: fixed` style for the list. Opens downwards by default
 * and flips above the anchor when the space below is too small and there is
 * more room above. The left edge is clamped to the viewport so a list anchored
 * near the right-hand edge is not pushed off screen.
 */
export function listPlacement(
  rect: AnchorRect,
  viewport: { width: number; height: number },
): { position: "fixed"; top?: number; bottom?: number; left: number; width: number } {
  const spaceBelow = viewport.height - rect.bottom;
  const spaceAbove = rect.top;
  const flip = spaceBelow < LIST_MAX_HEIGHT && spaceAbove > spaceBelow;

  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.left, viewport.width - rect.width - VIEWPORT_MARGIN),
  );

  return {
    position: "fixed",
    left,
    width: rect.width,
    ...(flip
      ? { bottom: viewport.height - rect.top + 4 }
      : { top: rect.bottom + 4 }),
  };
}
