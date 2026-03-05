import Link from "next/link";
import { Button, Card } from "@product/ui";

export default function LoginPage() {
  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Dashboard access</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-400">Secure access for super admins, tenant admins, resellers and viewers.</p>
        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="work email" />
          <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="password" />
          <Link href="/"><Button className="w-full">Sign in</Button></Link>
        </div>
        <p className="mt-6 text-xs text-slate-400">No account? <Link className="text-cyan-300" href="/register">Create one</Link></p>
      </Card>
    </main>
  );
}
