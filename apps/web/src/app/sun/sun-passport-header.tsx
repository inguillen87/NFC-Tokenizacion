import { BrandLockup, LocaleSwitcher, ThemeToggle } from "@product/ui";

type SunPassportHeaderProps = {
  isQrScan: boolean;
  livePillLabel: string;
  locale: string;
  locales: readonly string[];
  pulseClass: string;
};

export function SunPassportHeader({
  isQrScan,
  livePillLabel,
  locale,
  locales,
  pulseClass,
}: SunPassportHeaderProps) {
  const passportLabel = isQrScan ? "Pasaporte QR" : "Pasaporte NFC";

  return (
    <header
      className="sun-passport-header sun-topbar grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2"
      aria-label="Controles del pasaporte"
      data-testid="sun-passport-header"
    >
      <div className="sun-passport-brand min-w-0 overflow-hidden">
        <BrandLockup size={36} variant="ripple" theme="dark" />
        <span className="sun-passport-brand__caption mt-1 block truncate whitespace-nowrap">
          {passportLabel}
        </span>
      </div>

      <div
        className="sun-live-tap-pill flex min-w-0 max-w-full items-center justify-self-end gap-1.5 rounded-full border border-white/5 bg-slate-900/80 px-2.5 py-1.5 backdrop-blur-md"
        role="status"
        aria-label={`Estado: ${livePillLabel}`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${pulseClass} animate-pulse`} aria-hidden="true" />
        <span className="truncate whitespace-nowrap text-[9px] font-black uppercase tracking-wider text-slate-300">
          {livePillLabel}
        </span>
      </div>

      <div className="sun-topbar-actions col-span-2 flex w-full min-w-0 items-center gap-2 border-t border-white/5 pt-2">
        <div className="min-w-0 flex-1 [&_.locale-switcher]:flex [&_.locale-switcher]:w-full [&_.locale-switcher]:min-w-0 [&_.locale-switcher_select]:w-full [&_.locale-switcher_select]:min-w-0">
          <LocaleSwitcher value={locale} options={[...locales]} />
        </div>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
