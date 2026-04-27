import Link from "next/link";
import { BrandLockup } from "@product/ui";

export default function Loading() {
  return (
    <main className="container-shell grid min-h-screen place-items-center py-16">
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8">
        <Link href="/" aria-label="nexID home" className="inline-flex items-center"><BrandLockup size={40} variant="pulse" theme="dark" className="brand-surface-loading" /></Link>
      </div>
    </main>
  );
}
