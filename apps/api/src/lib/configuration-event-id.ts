/** Canonical positive PostgreSQL bigint, preserved as the caller's exact string. */
export function isPublicConfigurationEventId(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 19 || value[0] === "0") return false;
  for (const digit of value) {
    if (digit < "0" || digit > "9") return false;
  }
  // Equal-length ASCII decimal strings compare exactly without numeric conversion.
  return value.length < 19 || value <= "9223372036854775807";
}
