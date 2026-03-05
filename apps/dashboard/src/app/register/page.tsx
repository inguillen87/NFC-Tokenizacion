import Link from "next/link";
import { Button, Card } from "@product/ui";

export default function RegisterPage() {
  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-lg p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Create workspace</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Register your organization</h1>
        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="company name" />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="work email" />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant slug" />
          <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"><option>BASIC</option><option>SECURE</option><option>ENTERPRISE / RESELLER</option></select>
          <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="password" />
          <Link href="/login"><Button className="w-full">Create account</Button></Link>
        </div>
      </Card>
    </main>
  );
}
