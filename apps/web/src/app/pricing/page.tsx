import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing | nexID',
  description: 'Choose the right plan for your physical-to-digital NFC tokenization needs.',
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 py-20 px-6">
      <div className="max-w-7xl mx-auto space-y-20">
        {/* Header */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight text-white">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Unlock the power of physical-to-digital tokenization with nexID. Choose the perfect plan for your business size and needs.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 items-start mt-12">
          {/* Starter */}
          <div className="relative flex flex-col p-8 rounded-3xl bg-slate-900/50 border border-white/10 backdrop-blur-md shadow-xl">
            <h3 className="text-xl font-semibold text-white">Starter</h3>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-white">
              Free
            </div>
            <p className="mt-4 text-slate-400">Perfect for exploring nexID's capabilities.</p>
            <ul className="mt-8 space-y-4 flex-1">
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Basic NFC routing</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Up to 100 tags</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Community support</span>
              </li>
            </ul>
            <Link href="/register" className="mt-8 block w-full py-3 px-4 rounded-lg bg-slate-800 text-white text-center font-medium hover:bg-slate-700 transition">
              Get Started
            </Link>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col p-8 rounded-3xl bg-slate-900/80 border border-blue-500/30 backdrop-blur-md shadow-2xl scale-105 z-10">
            <div className="absolute top-0 right-6 transform -translate-y-1/2">
              <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Most Popular
              </span>
            </div>
            <h3 className="text-xl font-semibold text-white">Pro</h3>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-white">
              $299<span className="text-xl font-medium text-slate-400 ml-1">/mo</span>
            </div>
            <p className="mt-4 text-slate-400">For growing businesses needing advanced insights.</p>
            <ul className="mt-8 space-y-4 flex-1">
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Advanced NFC routing</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Built-in CRM</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Detailed Analytics</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Up to 10,000 tags</span>
              </li>
            </ul>
            <Link href="/register?plan=pro" className="mt-8 block w-full py-3 px-4 rounded-lg bg-blue-600 text-white text-center font-medium hover:bg-blue-500 transition">
              Start Free Trial
            </Link>
          </div>

          {/* Enterprise */}
          <div className="relative flex flex-col p-8 rounded-3xl bg-slate-900/50 border border-white/10 backdrop-blur-md shadow-xl">
            <h3 className="text-xl font-semibold text-white">Enterprise</h3>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-white">
              Custom
            </div>
            <p className="mt-4 text-slate-400">Tailored solutions for large-scale operations.</p>
            <ul className="mt-8 space-y-4 flex-1">
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Unlimited NFC routing</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Blockchain anchors (Polygon/IOTA)</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Dedicated support</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckIcon />
                <span>Custom Integrations</span>
              </li>
            </ul>
            <Link href="/contact" className="mt-8 block w-full py-3 px-4 rounded-lg bg-slate-800 text-white text-center font-medium hover:bg-slate-700 transition">
              Contact Sales
            </Link>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-center text-white mb-10">Compare Features</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-5 px-6 font-semibold text-white">Features</th>
                  <th className="py-5 px-6 font-semibold text-white text-center">Starter</th>
                  <th className="py-5 px-6 font-semibold text-blue-400 text-center">Pro</th>
                  <th className="py-5 px-6 font-semibold text-white text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300">
                <tr>
                  <td className="py-4 px-6">NFC Routing</td>
                  <td className="py-4 px-6 text-center">Basic</td>
                  <td className="py-4 px-6 text-center">Advanced</td>
                  <td className="py-4 px-6 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">Analytics & Insights</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center">Yes</td>
                  <td className="py-4 px-6 text-center">Custom Dashboards</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">Built-in CRM</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center">Yes</td>
                  <td className="py-4 px-6 text-center">Advanced / API</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">Blockchain Anchors</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center">Polygon / IOTA</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">Support</td>
                  <td className="py-4 px-6 text-center">Community</td>
                  <td className="py-4 px-6 text-center">Priority Email</td>
                  <td className="py-4 px-6 text-center">Dedicated SLA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
