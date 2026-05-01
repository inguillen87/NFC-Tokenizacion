"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const labels: Record<string, string> = {
  "es-AR": "Espanol (AR)",
  "pt-BR": "Portugues (BR)",
  en: "English",
};

export function LocaleSwitcher({ value, options }: { value: string; options: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label suppressHydrationWarning className="locale-switcher inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
      <span aria-hidden className="locale-switcher__icon">ID</span>
      <select
        suppressHydrationWarning
        value={value}
        className="bg-transparent pr-1 text-xs font-semibold"
        aria-label="Seleccionar idioma"
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
          <option key={item} value={item}>{labels[item] || item}</option>
        ))}
      </select>
    </label>
  );
}
