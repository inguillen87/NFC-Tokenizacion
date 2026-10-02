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

export type HorizontalRailNavigationIntent = {
  readonly generation: number;
  readonly index: number;
  readonly left: number;
  readonly reframed: boolean;
};

export function horizontalRailTargetLeft(geometry: {
  itemLeft: number;
  railLeft: number;
  scrollLeft: number;
  clientLeft: number;
  scrollPaddingStart: number;
  maximumLeft: number;
}): number;

export function reconcileHorizontalRailNavigation(
  navigation: HorizontalRailNavigationIntent | null,
  scrollLeft: number,
  generation: number | undefined,
): {
  action: "ignore" | "settled" | "wait" | "reframe";
  navigation: HorizontalRailNavigationIntent | null;
};
