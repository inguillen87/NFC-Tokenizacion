export const HORIZONTAL_RAIL_INDEX_CHANGE_EVENT = "nexid:horizontal-rail-index-change";
export const HORIZONTAL_RAIL_NAVIGATE_EVENT = "nexid:horizontal-rail-navigate";

export function clampHorizontalRailIndex(index, itemCount) {
  if (!Number.isFinite(index) || itemCount <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(index), itemCount - 1));
}

export function wrapHorizontalRailIndex(index, itemCount) {
  if (!Number.isFinite(index) || itemCount <= 0) return 0;
  return ((Math.trunc(index) % itemCount) + itemCount) % itemCount;
}

export function closestHorizontalRailIndex(railLeft, itemLefts) {
  if (!Number.isFinite(railLeft) || itemLefts.length === 0) return 0;

  return itemLefts.reduce((closestIndex, itemLeft, index) => {
    if (!Number.isFinite(itemLeft)) return closestIndex;
    const distance = Math.abs(itemLeft - railLeft);
    const closestDistance = Math.abs(itemLefts[closestIndex] - railLeft);
    return distance < closestDistance ? index : closestIndex;
  }, 0);
}

export function horizontalRailTargetLeft({ itemLeft, railLeft, scrollLeft, clientLeft, scrollPaddingStart, maximumLeft }) {
  if (![itemLeft, railLeft, scrollLeft, clientLeft, scrollPaddingStart, maximumLeft].every(Number.isFinite)) return 0;
  const left = itemLeft - railLeft + scrollLeft - clientLeft - scrollPaddingStart;
  return Math.max(0, Math.min(left, Math.max(0, maximumLeft)));
}

export function reconcileHorizontalRailNavigation(navigation, scrollLeft, generation) {
  if (!navigation || navigation.generation !== generation || !Number.isFinite(scrollLeft)) {
    return { action: "ignore", navigation };
  }
  // Native scroll positions can round a fractional CSS target.
  // An observed scrollend can precede later scroll updates without new user input.
  // Keep the explicit destination until a newer command or user gesture replaces it.
  if (Math.abs(scrollLeft - navigation.left) <= 1) return { action: "settled", navigation };
  if (navigation.reframed) return { action: "wait", navigation };
  return { action: "reframe", navigation: { ...navigation, reframed: true } };
}
