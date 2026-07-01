import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Cpu, Box, Lock, Zap, Fingerprint, Layers3, Activity, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@product/ui";

export const metadata: Metadata = {
  title: "nexID Secure Delivery | Enterprise B2B Solutions",
  description: "Advanced Physical-to-Digital Trust Layers for IT, Pharma, and Luxury. Compare Tracking, Authenticity, and Tamper Evidence.",
};

export default function LandingB2BPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 overflow-hidden font-sans selection:bg-brand-500/30">
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 lg:px-8 max-w-7xl mx-auto z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-600/20 rounded-full blur-[120px] -z-10 opacity-70 animate-pulse" />
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-brand-300 text-sm font-medium backdrop-blur-md">
            <Lock className="w-4 h-4" />
            <span>nexID Secure Delivery for Enterprise</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-neutral-200 to-neutral-500 leading-tight">
            Absolute Trust for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-600">
              High-Stakes Supply Chains
            </span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Deploy cryptographic proof of origin, real-time tamper evidence, and undisputed authenticity for IT, Pharma, and Luxury sectors.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/demo-lab?scenario=polygon-ownership">
              <Button size="lg" className="bg-brand-600 hover:bg-brand-500 text-white rounded-full px-8 py-6 h-auto text-lg shadow-[0_0_40px_-10px_rgba(var(--brand-500),0.5)] transition-all hover:scale-105">
                Launch Enterprise DemoLab <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="rounded-full px-8 py-6 h-auto text-lg border-neutral-800 hover:bg-neutral-900 transition-all">
                View Rollout Specs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Target Verticals */}
      <section className="py-24 relative z-10 border-t border-white/5 bg-black/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Engineered for B2B Excellence</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">Tailored cryptographic layers designed specifically to solve the hardest problems in high-value industries.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* IT / Electronics */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[50px] group-hover:bg-blue-500/20 transition-all" />
              <Cpu className="w-10 h-10 text-blue-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">IT & Electronics</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Prevent gray market diversion and warranty fraud. Authenticate high-end hardware components in the field with offline verification capabilities.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-brand-400" /> Offline Auth Verification</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-brand-400" /> Ownership Transfer (Polygon)</li>
              </ul>
            </div>
            
            {/* Pharma */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] group-hover:bg-emerald-500/20 transition-all" />
              <Activity className="w-10 h-10 text-emerald-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">Pharma & Cold Chain</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                End-to-end audit trails with IOTA proof layer. Detect tampering instantly and ensure compliance with serialized, item-level tracking.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-brand-400" /> Immutable Audit (IOTA)</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-brand-400" /> TagTamper Evidence</li>
              </ul>
            </div>

            {/* Luxury */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[50px] group-hover:bg-amber-500/20 transition-all" />
              <Box className="w-10 h-10 text-amber-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">Luxury Goods</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Deliver digital twins and exclusive brand experiences. Protect brand equity with SUN (Secure Unique NFC) dynamic cryptography.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-brand-400" /> Secure Unique NFC (SUN)</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-brand-400" /> Digital Passport Ready</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">The Trust Spectrum</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">Moving beyond basic barcodes. Discover the difference between tracking, true authenticity, and state-aware product verification.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Tracking (QR) */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 relative group">
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-neutral-800 text-neutral-400 group-hover:scale-110 transition-transform">
                <Layers3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tracking (QR / GS1)</h3>
              <div className="text-sm text-brand-400 font-medium mb-4">Level 1: Visibility</div>
              <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                Standard serialization using printed codes. Excellent for low-cost visibility and GS1 Digital Link compliance, but provides zero protection against cloning or counterfeits.
              </p>
              <div className="space-y-2 pt-6 border-t border-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-500"><CheckCircle2 className="w-3 h-3 text-neutral-400" /> Cost-effective tracking</div>
                <div className="flex items-center gap-2 text-xs text-neutral-500"><ShieldAlert className="w-3 h-3 text-red-400" /> Easy to duplicate</div>
                <div className="flex items-center gap-2 text-xs text-neutral-500"><ShieldAlert className="w-3 h-3 text-red-400" /> No physical proof</div>
              </div>
            </div>

            {/* Authenticity (NFC) */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-neutral-800 to-neutral-900 border border-brand-500/30 relative group shadow-[0_0_30px_-10px_rgba(var(--brand-500),0.2)]">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-50" />
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/20 text-brand-400 group-hover:scale-110 transition-transform">
                <Fingerprint className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Authenticity (NFC 424)</h3>
              <div className="text-sm text-brand-400 font-medium mb-4">Level 2: Cryptographic Proof</div>
              <p className="text-neutral-300 text-sm mb-6 leading-relaxed">
                Dynamic SUN (Secure Unique NFC) generates a one-time cryptographic signature on every tap. Defeats link sharing, cloning, and replay attacks instantly.
              </p>
              <div className="space-y-2 pt-6 border-t border-neutral-700">
                <div className="flex items-center gap-2 text-xs text-neutral-300"><CheckCircle2 className="w-3 h-3 text-brand-400" /> Impossible to clone</div>
                <div className="flex items-center gap-2 text-xs text-neutral-300"><CheckCircle2 className="w-3 h-3 text-brand-400" /> Frictionless UX (No App)</div>
                <div className="flex items-center gap-2 text-xs text-neutral-300"><CheckCircle2 className="w-3 h-3 text-brand-400" /> Premium tokenization ready</div>
              </div>
            </div>

            {/* Tamper Evidence */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-brand-900/40 to-neutral-900 border border-brand-400/50 relative group shadow-[0_0_50px_-15px_rgba(var(--brand-400),0.3)]">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent" />
              <div className="absolute -top-3 right-6 bg-brand-500 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                Ultimate Security
              </div>
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500 text-white group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tamper Evidence</h3>
              <div className="text-sm text-brand-300 font-medium mb-4">Level 3: State-Aware Tags</div>
              <p className="text-neutral-200 text-sm mb-6 leading-relaxed">
                NTAG 424 DNA TT physically detects if a seal has been broken or a package opened. The cryptographic message changes state, proving both origin and integrity.
              </p>
              <div className="space-y-2 pt-6 border-t border-brand-800">
                <div className="flex items-center gap-2 text-xs text-neutral-200"><CheckCircle2 className="w-3 h-3 text-brand-300" /> Physical breach detection</div>
                <div className="flex items-center gap-2 text-xs text-neutral-200"><CheckCircle2 className="w-3 h-3 text-brand-300" /> Dynamic state changes</div>
                <div className="flex items-center gap-2 text-xs text-neutral-200"><CheckCircle2 className="w-3 h-3 text-brand-300" /> Unlocks warranty / NFT upon opening</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-brand-900/20 backdrop-blur-3xl -z-10" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to secure your rollout?</h2>
          <p className="text-xl text-neutral-300 mb-10">Test Polygon Ownership, IOTA Proofs, and Offline Scans in our DemoLab.</p>
          <Link href="/demo-lab">
            <Button size="lg" className="bg-white text-black hover:bg-neutral-200 rounded-full px-10 py-6 h-auto text-lg shadow-xl font-bold">
              Enter DemoLab
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
