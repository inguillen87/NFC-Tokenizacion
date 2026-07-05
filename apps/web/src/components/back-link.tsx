import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href = "/", label = "Volver" }: { href?: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className="back-link inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10">
      <span aria-hidden className="back-link__icon">
        <ArrowLeft className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </Link>
  );
}
