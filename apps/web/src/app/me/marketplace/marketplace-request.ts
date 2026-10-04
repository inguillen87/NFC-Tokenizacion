type RequestPayload = { quantity: number; message: string | null; ageGateAccepted: boolean };
type ResponsePayload = { ok?: boolean; error?: string; deduplicated?: boolean };
type Result =
  | { kind: "response"; status: number; ok: boolean; payload: ResponsePayload }
  | { kind: "uncertain" };

export const MARKETPLACE_REQUEST_TIMEOUT_MS = 12_000;

// A timeout cannot undo a request already received by the server. The caller
// must preserve the draft and ask the user to check before sending again.
export async function sendMarketplaceRequest(
  path: string,
  body: RequestPayload,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<Result> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const uncertain = { kind: "uncertain" } as const;
  const deadline = new Promise<Result>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(uncertain);
    }, options.timeoutMs ?? MARKETPLACE_REQUEST_TIMEOUT_MS);
  });
  const operation = (async (): Promise<Result> => {
    try {
      const response = await (options.fetcher ?? fetch)(path, {
        method: "POST", credentials: "include", signal: controller.signal,
        headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return uncertain;
      if (typeof (payload as ResponsePayload).ok !== "boolean") return uncertain;
      return { kind: "response", status: response.status, ok: response.ok, payload: payload as ResponsePayload };
    } catch { return uncertain; }
  })();
  try { return await Promise.race([operation, deadline]); }
  finally { clearTimeout(timer); }
}
