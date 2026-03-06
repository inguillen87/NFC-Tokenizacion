"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const labels: Record<string, string> = {
  "es-AR": "Español (AR)",
  "pt-BR": "Português (BR)",
  en: "English",
};

export function LocaleSwitcher({ value, options }: { value: string; options: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="locale-switcher inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-200">
      <span aria-hidden>🌐</span>
      <select
        value={value}
        className="bg-transparent text-xs"
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
