import { parsePilotBatches, type PilotSource } from './pilot-launchpad-model';
const MAX_BYTES = 262144;
/** A single scoped GET; its deadline includes headers and body, even for a noncooperative transport. */
export async function readPilotSource(fetcher: (signal: AbortSignal) => Promise<Response>, tenant: string, timeoutMs = 12000): Promise<PilotSource> {
 const now = () => new Date().toISOString();
 const controller = new AbortController(); let response: Response | undefined, reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
 const fail = (state: 'unavailable' | 'invalid' | 'forbidden' | 'timeout'): PilotSource => ({ state, rows: null, checkedAt: now() });
 if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(tenant) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 12000) return fail('invalid');
 let timer: ReturnType<typeof setTimeout> | undefined;
 const task = async (): Promise<PilotSource> => {
  try {
   response = await fetcher(controller.signal);
   if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); return fail('timeout'); }
   if (response.status === 401 || response.status === 403) { void response.body?.cancel().catch(() => {}); return fail('forbidden'); }
   if (!response.ok) { void response.body?.cancel().catch(() => {}); return fail('unavailable'); }
   if (response.headers.get('x-nexid-data-mode') !== 'production' || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) { void response.body?.cancel().catch(() => {}); return fail('invalid'); }
   reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
   while (true) {
    const next = await reader.read(); if (controller.signal.aborted) return fail('timeout'); if (next.done) break;
    size += next.value.byteLength; if (size > MAX_BYTES) { void reader.cancel().catch(() => {}); return fail('invalid'); } chunks.push(next.value);
   }
   const bytes = new Uint8Array(size); let cursor = 0; for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.byteLength; }
   const rows = parsePilotBatches(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), tenant);
   return { state: 'ready', rows, checkedAt: now() };
  } catch { return fail(controller.signal.aborted ? 'timeout' : response?.ok ? 'invalid' : 'unavailable'); }
  finally { try { reader?.releaseLock(); } catch {} }
 };
 const deadline = new Promise<PilotSource>(resolve => { timer = setTimeout(() => { controller.abort(); if (reader) void reader.cancel().catch(() => {}); else void response?.body?.cancel().catch(() => {}); resolve(fail('timeout')); }, timeoutMs); });
 try { return await Promise.race([task(), deadline]); } finally { if (timer !== undefined) clearTimeout(timer); }
}
