import Link from "next/link";
import { Button, Card } from "@product/ui";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-2xl font-bold text-white">Register</div>
        <p className="mt-2 text-sm text-slate-400">Alta visual para tenant o partner. Conectar auth real despues.</p>
        <form className="mt-8 space-y-4">
          <input className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" placeholder="Company" />
          <input className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" placeholder="Email" />
          <input className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" placeholder="Password" type="password" />
          <Button className="w-full">Crear cuenta</Button>
        </form>
        <div className="mt-4 text-sm text-slate-500">Ya tenes cuenta? <Link href="/login" className="text-cyan-300">Entrar</Link></div>
      </Card>
    </main>
  );
}
