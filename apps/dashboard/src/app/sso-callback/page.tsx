import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-slate-900/80 p-6 text-center shadow-[0_30px_90px_rgba(6,182,212,0.16)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Google OAuth</p>
        <h1 className="mt-3 text-2xl font-black">Validando identidad</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Clerk está validando tu sesión. Después NexID verifica el perfil y el alcance autorizados para tu cuenta.
        </p>
        <AuthenticateWithRedirectCallback />
      </section>
    </main>
  );
}
