"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

type Props = {
  shipmentId: string;
};

function readText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export function SecureDeliveryClaimForm({ shipmentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(event.currentTarget);
    const description = readText(formData, "description");
    if (!description) {
      setError("Claim description is required.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/admin/logistics/shipments/${encodeURIComponent(shipmentId)}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_type: readText(formData, "issue_type"),
          description,
          location: readText(formData, "location"),
          reported_by: readText(formData, "reported_by"),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.reason || data.message || "Failed to open claim");
      setSuccess("Claim opened and custody timeline updated.");
      event.currentTarget.reset();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to open claim");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submitClaim} className="rounded-3xl border border-rose-500/20 bg-rose-950/20 p-5">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-rose-400/10 p-3 text-rose-300"><ShieldAlert className="h-5 w-5" /></span>
        <div>
          <h3 className="text-lg font-black text-white">Open delivery claim</h3>
          <p className="text-xs text-rose-100/70">Use this when the recipient reports an opened seal, mismatch, missing item or damaged package.</p>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm font-semibold text-rose-100">{error}</div> : null}
      {success ? <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-100">{success}</div> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Issue type
          <select name="issue_type" defaultValue="tamper_report" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-rose-400">
            <option value="tamper_report">Tamper report</option>
            <option value="missing_item">Missing item</option>
            <option value="wrong_recipient">Wrong recipient</option>
            <option value="damaged_package">Damaged package</option>
            <option value="chain_of_custody_gap">Chain of custody gap</option>
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Location
          <input name="location" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-rose-400" placeholder="Recipient doorstep / depot" />
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 md:col-span-2">
          Reported by
          <input name="reported_by" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-rose-400" placeholder="recipient@company.com" />
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 md:col-span-2">
          Claim description
          <textarea name="description" required className="mt-1 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-rose-400" placeholder="Recipient reports seal opened before handoff." />
        </label>
      </div>

      <button disabled={loading} className="mt-5 rounded-2xl bg-rose-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:bg-rose-300 disabled:opacity-60">
        {loading ? "Opening claim..." : "Open claim"}
      </button>
    </form>
  );
}
