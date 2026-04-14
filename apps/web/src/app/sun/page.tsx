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
  const status = String(result.result || result.reason || (result.ok ? "AUTH_OK" : "INVALID"));
  const isValid = status === "VALID" || status === "AUTH_OK";

  return (
    <main className="container-shell py-10 text-slate-100">
      <h1 className="text-2xl font-semibold">SUN Validation Center</h1>
      <p className="mt-2 text-sm text-slate-300">Enterprise validation view: autenticidad criptográfica + CTA comercial operable.</p>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Validation status</p>
          <p className={`mt-2 text-lg font-semibold ${isValid ? "text-emerald-300" : "text-amber-300"}`}>{status}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Batch ID</p>
          <p className="mt-2 text-sm text-white">{bid || "(missing)"}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">UID</p>
          <p className="mt-2 text-sm text-white break-all">{uid || "(missing)"}</p>
        </article>
      </section>

      <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>

      {bid && uid ? (
        <section className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <p className="text-sm font-semibold text-cyan-100">Post-scan CTA</p>
          <p className="mt-1 text-xs text-cyan-50">Activá ownership, garantía, provenance y tokenización opcional desde esta misma validación.</p>
          <CtaActions bid={bid} uid={uid} />
        </section>
      ) : (
        <p className="mt-4 text-xs text-amber-200">No CTA available yet: missing bid/uid in SUN result.</p>
      )}
    </main>
  );
}
