import Link from "next/link";
import { Button, Card } from "@product/ui";

export default function WebLoginPage() {
  return <main className="container-shell grid min-h-screen place-items-center"><Card className="w-full max-w-md p-8"><h1 className="text-2xl font-bold text-white">Client login</h1><p className="mt-2 text-sm text-slate-400">Sign in to access dashboard operations.</p><div className="mt-6 grid gap-3"><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" placeholder="email"/><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" placeholder="password" type="password"/><a href="https://dashboard.tudominio.com/login"><Button className="w-full">Go to dashboard</Button></a></div><p className="mt-4 text-xs text-slate-400">Need access? <Link className="text-cyan-300" href="/register">Register</Link></p></Card></main>;
}
