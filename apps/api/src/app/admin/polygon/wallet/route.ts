export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";

export async function GET(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const rpcUrl = String(process.env.POLYGON_RPC_URL || "").trim();
  const walletAddress = String(process.env.POLYGON_DEFAULT_RECIPIENT || "").trim();
  const simulated = Number(process.env.POLYGON_SIM_GAS_AVAILABLE || "0");
  const mode = String(process.env.TOKENIZATION_MODE || "simulated").trim().toLowerCase();

  if (mode === "simulated" || !rpcUrl || !walletAddress) {
    return json({
      ok: true,
      network: "polygon-amoy",
      wallet: walletAddress || null,
      balancePol: simulated || 0,
      mode: "simulated",
      warning: mode === "simulated" ? "TOKENIZATION_MODE=simulated" : "POLYGON_RPC_URL or POLYGON_DEFAULT_RECIPIENT missing",
    });
  }

  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [walletAddress, "latest"] }),
      cache: "no-store",
    }).then((res) => res.json()) as { result?: string };
    const hexWei = String(rpcResponse?.result || "0x0");
    const wei = BigInt(hexWei);
    const balance = Number(wei) / 1e18;
    return json({
      ok: true,
      network: "polygon-amoy",
      wallet: walletAddress,
      balancePol: Number(balance.toFixed(6)),
      mode: "polygon",
    });
  } catch (error) {
    return json({
      ok: true,
      network: "polygon-amoy",
      wallet: walletAddress,
      balancePol: simulated || 0,
      mode: "fallback",
      warning: error instanceof Error ? error.message : "polygon_balance_fetch_failed",
    });
  }
}
