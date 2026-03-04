import Link from "next/link";
import { Button, Card } from "@product/ui";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-2xl font-bold text-white">Login</div>
        <p className="mt-2 text-sm text-slate-400">Shell visual. Conectar auth real en fase 2.</p>
        <form className="mt-8 space-y-4">
          <input className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" placeholder="Email" />
          <input className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" placeholder="Password" type="password" />
          <Button className="w-full">Entrar</Button>
        </form>
        <div className="mt-4 text-sm text-slate-500">No tenes cuenta? <Link href="/register" className="text-cyan-300">Registrate</Link></div>
      </Card>
    </main>
  );
}
