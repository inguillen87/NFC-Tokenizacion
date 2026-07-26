export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request_body_too_large");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readRequestTextBounded(req: Request, maximumBytes: number) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("invalid_request_body_limit");
  }
  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared < 0) throw new Error("invalid_content_length");
    if (declared > maximumBytes) throw new RequestBodyTooLargeError();
  }

  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(combined);
}

export async function readBoundedJsonBody<T = Record<string, unknown>>(
  req: Request,
  maximumBytes: number,
): Promise<T> {
  const raw = await readRequestTextBounded(req, maximumBytes);
  if (!raw.trim()) return {} as T;
  return JSON.parse(raw) as T;
}
