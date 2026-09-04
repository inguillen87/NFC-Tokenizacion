export const HORIZONTAL_RAIL_INDEX_CHANGE_EVENT: "nexid:horizontal-rail-index-change";
export const HORIZONTAL_RAIL_NAVIGATE_EVENT: "nexid:horizontal-rail-navigate";

export type HorizontalRailIndexChangeDetail = {
  index: number;
};

export type HorizontalRailNavigateDetail = {
  focus?: boolean;
  index: number;
};

export function clampHorizontalRailIndex(index: number, itemCount: number): number;
export function wrapHorizontalRailIndex(index: number, itemCount: number): number;
export function closestHorizontalRailIndex(railLeft: number, itemLefts: readonly number[]): number;
