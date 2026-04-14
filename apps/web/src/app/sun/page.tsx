import { CtaActions } from "./cta-actions";
import { productUrls } from "@product/config";

function apiBase() {
  return productUrls.api;
}

export default async function SunPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  ["v", "bid", "picc_data", "enc", "cmac"].forEach((key) => {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  });

  const response = await fetch(`${apiBase()}/sun?${query.toString()}`, { cache: "no-store" });
  const result = await response.json().catch(() => ({ ok: false, reason: "invalid response" }));
  const bid = String(params.bid || result.bid || "");
  const uid = String(result.uid_hex || "");

  return (
    <main className="container-shell py-10 text-slate-100">
      <h1 className="text-2xl font-semibold">SUN Validation</h1>
      <p className="mt-2 text-sm text-slate-300">Resultado: <strong>{result.result || result.reason || (result.ok ? "AUTH_OK" : "INVALID")}</strong></p>
      <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
      {bid && uid ? <CtaActions bid={bid} uid={uid} /> : <p className="mt-4 text-xs text-amber-200">No CTA available yet: missing bid/uid in SUN result.</p>}
    </main>
  );
}
