export const ENTERPRISE_PERMISSION_ALIASES: Readonly<Record<string, readonly string[]>>;
export function permissionDenied(denied: unknown, requested?: string | null): boolean;
export function permissionMatches(granted: unknown, requested?: string | null, denied?: unknown): boolean;
