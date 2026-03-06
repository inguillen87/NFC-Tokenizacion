import Link from "next/link";

export function BackLink({ href = "/", label = "← Volver" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10">
      <span aria-hidden>←</span>
      <span>{label}</span>
    </Link>
  );
}
