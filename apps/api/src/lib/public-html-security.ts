export function escapeHtmlText(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] || character));
}

/**
 * Produces a display-only clone whose string leaves are safe in HTML text and
 * quoted attribute contexts. Keep the original object for authorization,
 * persistence and API calls so escaping never changes business identifiers.
 */
export function escapeHtmlTreeForMarkup<T>(value: T): T {
  if (typeof value === "string") return escapeHtmlText(value) as T;
  if (Array.isArray(value)) return value.map((entry) => escapeHtmlTreeForMarkup(entry)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, escapeHtmlTreeForMarkup(entry)]),
    ) as T;
  }
  return value;
}

/** JSON embedded in an inline script must not be able to terminate the script. */
export function serializeForInlineScript(value: unknown) {
  return (JSON.stringify(value) ?? "null")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
