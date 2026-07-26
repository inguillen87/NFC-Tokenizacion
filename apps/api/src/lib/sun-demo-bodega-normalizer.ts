export const DEMO_BODEGA_BID = "DEMO-2026-02";

type SunLikeResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Compatibility hook retained for callers/tests. Demo presentation code must
 * never upgrade a failed NFC verification into a successful one. Physical
 * samples and demo tags follow the same DB + cryptographic verification path.
 */
export function normalizeDemoBodegaSunResult(input: {
  bid: string;
  result: SunLikeResult;
  passport?: Record<string, unknown> | null;
}) {
  return input.result;
}
