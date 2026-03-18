"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card } from "@product/ui";

type SummaryEvent = {
  id: number;
  result: string;
  city?: string;
  country_code?: string;
  product_name?: string;
  vertical?: string;
  created_at?: string;
};

type SummaryData = {
  tenant?: { slug: string; name: string };
  batch?: { bid: string; status: string };
  tagCount?: number;
  crm?: { leads: number; tickets: number; orders: number };
  events?: SummaryEvent[];
};

const snapshotCards = [
  { title: "Why it wins", body: "nexID une autenticación física, experiencia mobile, observabilidad y canal comercial en un solo SaaS.", tone: "cyan" as const },
  { title: "Proof", body: "Demo Lab, mobile preview, ops map y audience modes convierten la narrativa en evidencia visible para ventas e inversión.", tone: "green" as const },
  { title: "Scale", body: "Multi-tenant, reseller-ready, API-first y con packaging por plan para crecer por vertical, región o partner.", tone: "amber" as const },
];

async function getSummary() {
  const response = await fetch("/api/internal/demo/summary", { cache: "no-store" });
  if (!response.ok) throw new Error("summary failed");
  return (await response.json()) as SummaryData;
}

export function InvestorSnapshotBoard() {
  const [summary, setSummary] = useState<SummaryData>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getSummary();
        if (active) setSummary(data);
      } catch {
        if (active) setSummary({});
      }
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const latest = summary.events?.[0];
  const validCount = (summary.events || []).filter((event) => event.result === "VALID").length;
  const riskCount = (summary.events || []).filter((event) => event.result !== "VALID").length;
  const activeVerticals = new Set((summary.events || []).map((event) => event.vertical || "wine")).size || 1;

  const metrics = useMemo(
    () => [
      { label: "Audience modes", value: "3", detail: "CEO · Operator · Buyer" },
      { label: "Active verticals", value: String(activeVerticals), detail: "Demo state synced" },
      { label: "Risk signals", value: String(riskCount), detail: "Live from current demo" },
      { label: "Trust stack", value: "PHY + APP + API", detail: `${validCount} auth / ${riskCount} risk` },
    ],
    [activeVerticals, riskCount, validCount],
  );

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "nexID investor snapshot", url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore share failures
    }
  };

  return (
    <main className="space-y-8 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Investor snapshot</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Board-ready product snapshot</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Resumen ejecutivo conectado al estado actual del demo para mostrar valor, evidencia y escala en minutos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200">Print / PDF</button>
          <button type="button" onClick={() => void share()} className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">Share snapshot</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-400">{metric.detail}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {snapshotCards.map((card) => (
          <Card key={card.title} className="p-5">
            <Badge tone={card.tone}>{card.title}</Badge>
            <p className="mt-3 text-sm text-slate-300">{card.body}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white">Suggested investor flow</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            <li>Abrí Demo Lab y corré una historia por vertical.</li>
            <li>Mostrá mobile preview para traducir tecnología en experiencia de usuario.</li>
            <li>Cerrá con ops map y módulos del admin para probar observabilidad, integraciones y monetización.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3 print:hidden">
            <Link href="/demo-lab" className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">Open Demo Lab</Link>
            <Link href="/demo-lab/mobile/demobodega/demo-item-001" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200">Open mobile preview</Link>
            <Link href="/analytics" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">Open analytics proof</Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white">Live demo state</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            <p>Tenant: <b className="text-white">{summary.tenant?.name || "Demo Bodega"}</b></p>
            <p>Batch: <b className="text-white">{summary.batch?.bid || "DEMO-2026-02"}</b></p>
            <p>Tags: <b className="text-white">{summary.tagCount ?? 0}</b></p>
            <p>CRM: <b className="text-white">{summary.crm?.leads ?? 0}</b> leads · <b className="text-white">{summary.crm?.tickets ?? 0}</b> tickets · <b className="text-white">{summary.crm?.orders ?? 0}</b> orders</p>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Latest proof point</p>
            <p className="mt-2">{latest?.result || "AUTH_PENDING"} · {latest?.product_name || "Demo product"}</p>
            <p className="mt-1 text-xs text-slate-400">{latest?.city || "Mendoza"}, {latest?.country_code || "AR"} · {latest?.vertical || "wine"}</p>
            <p className="mt-1 text-xs text-slate-500">{latest?.created_at || "waiting for demo events"}</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
