import Link from "next/link";
import { Badge, LocaleSwitcher, Sidebar } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, locale, locales } = await getDashboardI18n();
  const items = [
    { href: "/", label: t.dashboard.overview },
    { href: "/tenants", label: t.dashboard.tenants },
    { href: "/batches", label: t.dashboard.batches },
    { href: "/tags", label: t.dashboard.tags },
    { href: "/analytics", label: t.dashboard.analytics },
    { href: "/events", label: t.dashboard.events },
    { href: "/resellers", label: t.common.resellers },
    { href: "/subscriptions", label: t.dashboard.subscriptions },
    { href: "/api-keys", label: t.dashboard.apiKeys },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white lg:flex">
      <Sidebar title={t.dashboard.title} items={items} />
      <div className="min-w-0 flex-1">
        <header className="border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-xs uppercase tracking-[0.18em] text-cyan-300">{t.dashboard.subtitle}</div><div className="mt-1 text-xl font-bold text-white">{t.dashboard.title}</div></div>
            <div className="flex items-center gap-2"><LocaleSwitcher value={locale} options={[...locales]} /><Badge tone="green">{t.common.apiConnected}</Badge><Link href="/login" className="rounded-lg border border-white/10 px-3 py-2 text-xs">{t.common.logout}</Link></div>
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
