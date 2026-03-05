"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function LocaleSwitcher({ value, options }: { value: string; options: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      value={value}
      className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-slate-200"
      onChange={(event) => {
        const next = event.target.value;
        document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
        const params = new URLSearchParams(searchParams.toString());
        params.set("lang", next);
        router.push(`${pathname}?${params.toString()}`);
        router.refresh();
      }}
    >
      {options.map((item) => (
        <option key={item} value={item}>{item}</option>
      ))}
    </select>
  );
}
