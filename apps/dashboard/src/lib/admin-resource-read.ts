export type AdminResourceAvailability =
  | "ready"
  | "not_found"
  | "upstream_error"
  | "invalid_payload"
  | "unreachable"
  | "scope_mismatch";

export type AdminResourceReadResult<T> =
  | { availability: "ready"; data: T; status: number }
  | {
      availability: Exclude<AdminResourceAvailability, "ready">;
      data: null;
      status: number | null;
    };

type AdminResourceFailure = Exclude<AdminResourceAvailability, "ready">;

export function adminResourceFailure<T>(
  availability: AdminResourceFailure,
  status: number | null = null,
): AdminResourceReadResult<T> {
  return { availability, data: null, status };
}

/**
 * Preserves the difference between a confirmed HTTP 404 and an unavailable or
 * malformed upstream. Callers decide the resource schema through `select`.
 */
export async function readAdminResourceResponse<T>(
  response: Response,
  select: (payload: unknown) => T | null,
): Promise<AdminResourceReadResult<T>> {
  if (response.status === 404) return adminResourceFailure("not_found", 404);
  if (!response.ok) return adminResourceFailure("upstream_error", response.status);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return adminResourceFailure("invalid_payload", response.status);
  }

  const data = select(payload);
  if (data === null) return adminResourceFailure("invalid_payload", response.status);
  return { availability: "ready", data, status: response.status };
}
