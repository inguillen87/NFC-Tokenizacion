"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const labels: Record<string, string> = {
  "es-AR": "Espanol (AR)",
  "pt-BR": "Portugues (BR)",
  en: "English",
};

const ariaLabels: Record<string, string> = {
  "es-AR": "Seleccionar idioma",
  "pt-BR": "Selecionar idioma",
  en: "Select language",
};

export function LocaleSwitcher({ value, options }: { value: string; options: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label suppressHydrationWarning className="locale-switcher inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-0 text-xs font-semibold text-slate-200">
      <span aria-hidden className="locale-switcher__icon">ID</span>
      <select
        suppressHydrationWarning
        value={value}
        className="min-h-11 bg-transparent pr-1 text-xs font-semibold"
        aria-label={ariaLabels[value] || ariaLabels["es-AR"]}
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
          <option
            key={item}
            value={item}
            className="bg-slate-950 text-slate-200 dark:bg-slate-950 dark:text-slate-200"
            style={{ backgroundColor: "#070b14", color: "#cbd5e1" }}
          >
            {labels[item] || item}
          </option>
        ))}
      </select>
    </label>
  );
}
