/** Presentation state only. It never grants NFC identity, freshness or actions. */
export type SunAvailability = "ready" | "empty" | "incomplete" | "inaccessible" | "unavailable";
export type SunEntry = "qr" | "demo" | "snapshot" | "dynamic" | "empty" | "incomplete";

export function resolveSunEntry(input: {
  isQrScan: boolean;
  demoRequested: boolean;
  snapshotId: string;
  snapshotTrace: string;
  snapshotAccess: string;
  freshToken: string;
  hasSnapshotMarker?: boolean;
  hasDynamicMarker?: boolean;
  dynamic: readonly string[];
}): SunEntry {
  if (input.isQrScan) return "qr";
  const hasSnapshotMarker = Boolean(input.hasSnapshotMarker || input.snapshotId || input.snapshotTrace || input.snapshotAccess || input.freshToken);
  if (hasSnapshotMarker) {
    return input.snapshotId && input.snapshotTrace && input.snapshotAccess ? "snapshot" : "incomplete";
  }
  if (input.hasDynamicMarker || input.dynamic.some((value) => value.trim())) {
    return input.dynamic.length === 5 && input.dynamic.slice(1).every((value) => value.trim()) ? "dynamic" : "incomplete";
  }
  return input.demoRequested ? "demo" : "empty";
}
