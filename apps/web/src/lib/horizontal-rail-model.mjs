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
