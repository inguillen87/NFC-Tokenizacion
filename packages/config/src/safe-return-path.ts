const SAFE_RETURN_BASE = "https://return.nexid.invalid";
const MAX_RETURN_PATH_LENGTH = 2_048;
const MAX_DECODE_PASSES = 4;
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

function canonicalizeSafePathShape(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.length > MAX_RETURN_PATH_LENGTH || CONTROL_OR_BACKSLASH.test(value)) return null;

  try {
    const url = new URL(value, SAFE_RETURN_BASE);
    if (url.origin !== SAFE_RETURN_BASE) return null;
    const canonicalPath = `${url.pathname}${url.search}${url.hash}`;
    if (!canonicalPath.startsWith("/") || canonicalPath.startsWith("//")) return null;
    if (canonicalPath.length > MAX_RETURN_PATH_LENGTH || CONTROL_OR_BACKSLASH.test(canonicalPath)) return null;
    return canonicalPath;
  } catch {
    return null;
  }
}

function canonicalizeSafeAcrossDecodePasses(value: string): string | null {
  let probe = value;
  let canonicalPath = "";

  for (let pass = 0; pass <= MAX_DECODE_PASSES; pass += 1) {
    const canonicalProbe = canonicalizeSafePathShape(probe);
    if (!canonicalProbe) return null;
    if (pass === 0) canonicalPath = canonicalProbe;

    let decoded: string;
    try {
      decoded = decodeURIComponent(probe);
    } catch {
      return null;
    }

    if (decoded === probe) return canonicalPath;
    probe = decoded;
  }

  // Excessive nested encoding is unnecessary for an application return path
  // and makes browser interpretation harder to reason about.
  return null;
}

/**
 * Accepts only an application-local path. Absolute/protocol-relative URLs,
 * browser-normalized backslashes, control characters and encoded variants of
 * those forms fall back instead of being returned to a navigation API.
 */
export function normalizeSafeReturnPath(value: unknown, fallback = "/") {
  const fallbackCandidate = typeof fallback === "string" ? fallback.trim() : "/";
  const safeFallback = canonicalizeSafeAcrossDecodePasses(fallbackCandidate) || "/";
  if (typeof value !== "string") return safeFallback;

  const candidate = value.trim();
  if (!candidate) return safeFallback;
  return canonicalizeSafeAcrossDecodePasses(candidate) || safeFallback;
}
