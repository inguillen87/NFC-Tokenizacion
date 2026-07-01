import type { Metadata } from "next";
import Link from "next/link";
import { getWebI18n } from "../../../lib/locale";
import { DemoLabClient } from "./demo-lab-client";
import { Box, Network, ShieldCheck, ArrowRight, Layers3, Smartphone } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return {
    title: "Demo Lab · nexID",
    openGraph: {
      title: "Demo Lab · nexID",
      images: [{ url: `/opengraph-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Demo Lab · nexID",
      images: [`/twitter-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`],
    },
  };
}

type DemoLabPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DemoLabPage({ searchParams }: DemoLabPageProps) {
  const { locale } = await getWebI18n();
  const params = searchParams ? await searchParams : {};
  const initialVertical = firstParam(params.vertical || params.rubro || params.industry || params.useCase);
  const initialScenario = firstParam(params.scenario || params.proof || params.layer);

  // If a scenario or vertical is selected, render the lab client
  if (initialScenario || initialVertical) {
    return <DemoLabClient locale={locale} initialVertical={initialVertical} initialScenario={initialScenario} />;
  }

  // Otherwise, render the Enterprise Scenarios Menu
  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-brand-500/30 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-900/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-brand-300 text-sm font-medium backdrop-blur-md mb-6">
            <Layers3 className="w-4 h-4" />
            <span>Enterprise Scenarios</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
            Select a <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-blue-500">Trust Layer</span>
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Experience the end-to-end flow of different cryptographic proofs and their impact on your supply chain and consumer experience.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Polygon Ownership */}
          <Link href="/demo-lab?scenario=polygon-ownership" className="group relative p-8 rounded-3xl bg-neutral-900/60 border border-white/5 hover:border-brand-500/50 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 overflow-hidden flex flex-col h-full shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="mb-6 w-14 h-14 rounded-2xl bg-brand-500/20 flex items-center justify-center text-brand-400 group-hover:scale-110 transition-transform">
              <Box className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Polygon Ownership Layer</h3>
            <p className="text-neutral-400 mb-8 flex-grow">
              Luxury goods demo showing NFT tokenization, digital twins, and secure ownership transfer upon valid tap and seal opening.
            </p>
            <div className="flex items-center text-brand-400 font-semibold group-hover:text-brand-300">
              Launch Scenario <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* IOTA Proof */}
          <Link href="/demo-lab?scenario=iota-proof" className="group relative p-8 rounded-3xl bg-neutral-900/60 border border-white/5 hover:border-emerald-500/50 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 overflow-hidden flex flex-col h-full shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="mb-6 w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Network className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-3">IOTA Proof Layer</h3>
            <p className="text-neutral-400 mb-8 flex-grow">
              Logistics & QA evidence demo. Explore immutable audit trails, Merkle roots, and sensor evidence (temperature) anchored to the Tangle.
            </p>
            <div className="flex items-center text-emerald-400 font-semibold group-hover:text-emerald-300">
              Launch Scenario <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Offline Field Scan */}
          <Link href="/demo-lab?scenario=offline-verifier" className="group relative p-8 rounded-3xl bg-neutral-900/60 border border-white/5 hover:border-blue-500/50 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 overflow-hidden flex flex-col h-full shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="mb-6 w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Offline Field Scan Demo</h3>
            <p className="text-neutral-400 mb-8 flex-grow">
              Agricultural seeds demo. Witness how offline verification validates products deep in the field without connectivity, syncing later.
            </p>
            <div className="flex items-center text-blue-400 font-semibold group-hover:text-blue-300">
              Launch Scenario <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        <div className="mt-16 text-center">
          <Link href="/demo-lab?scenario=qr-gs1" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
            <Smartphone className="w-5 h-5" />
            <span>Or explore standard QR/GS1 Tracking</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
