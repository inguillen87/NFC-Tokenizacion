import { CtaActions } from "./cta-actions";
import { OnboardDemoButton } from "./onboard-demo-button";
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
  const reason = String(result.reason || "");
  const troubleshooting = reason.toLowerCase().includes("unknown batch")
    ? [
        "Este BID no está registrado en este entorno.",
        "Registrá batch + importá manifest + activá tags desde Dashboard.",
        "Si el lote existe en otro ambiente, cambiá dominio/base API.",
      ]
    : reason.toLowerCase().includes("replay")
      ? [
          "Se detectó payload reutilizado (URL copiada).",
          "Pedí un tap real al NFC para generar nuevo contador.",
          "Usá este caso como storytelling anti-fraude en ventas.",
        ]
      : [
          "Revisá llaves y onboarding del batch.",
          "Validá que el UID esté importado/activo.",
          "Si persiste, inspeccioná eventos y claves del lote.",
        ];
  const canAutoOnboard = reason.toLowerCase().includes("unknown batch") && /^DEMO-[A-Z0-9-]{3,40}$/.test(bid);

  return (
    <main className="container-shell py-10 text-slate-100">
      <section className="rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.15),transparent_40%),#020617] p-6 shadow-[0_30px_80px_rgba(2,6,23,.65)]">
        <h1 className="text-2xl font-semibold">SUN Validation Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">Vista premium para demo comercial e inversores: autenticidad criptográfica, antifraude y acciones de conversión en una sola pantalla.</p>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Validation status</p>
            <p className={`mt-2 text-lg font-semibold ${isValid ? "text-emerald-300" : "text-amber-300"}`}>{status}</p>
            <p className="mt-2 text-[11px] text-slate-300">{isValid ? "Activo y autenticado" : "Requiere atención operativa"}</p>
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

        <section className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-100">Troubleshooting guiado</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-50">
            {troubleshooting.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {canAutoOnboard ? <OnboardDemoButton bid={bid} /> : null}
        </section>

        <section className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-100">Enterprise story · Digital Product Passport</p>
          <p className="mt-1 text-xs text-emerald-50">
            Esto no es un flujo crypto-first: primero autenticidad y trazabilidad; luego ownership/provenance/warranty;
            y finalmente una capa blockchain-ready opcional para clientes premium.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {[
              { title: "1) Authenticity", body: "Validación NFC criptográfica + anti-clonación." },
              { title: "2) Risk", body: "Replay/tamper intelligence para operaciones y fraude." },
              { title: "3) Ownership", body: "Ownership + warranty + provenance como estado real." },
              { title: "4) Optional tokenization", body: "Anchoring/smart-contract layer opcional según caso de negocio." },
            ].map((step) => (
              <article key={step.title} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-[11px] text-slate-300">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
      </section>

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
